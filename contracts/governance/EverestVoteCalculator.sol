pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";

interface IMiniChefV2 {
    struct UserInfo {
        uint256 amount;
        int256 rewardDebt;
    }

    function lpTokens() external view returns (address[] memory);
    function userInfo(uint pid, address user) external view returns (IMiniChefV2.UserInfo memory);
}

interface IEverestPair {
    function totalSupply() external view returns (uint);
    function balanceOf(address owner) external view returns (uint);
}

interface IEverestERC20 {
    function balanceOf(address owner) external view returns (uint);
    function getCurrentVotes(address account) external view returns (uint);
    function delegates(address account) external view returns (address);
}

interface IStakingRewards {
    function stakingToken() external view returns (address);
    function balanceOf(address owner) external view returns (uint);
}

// SPDX-License-Identifier: MIT
contract EverestVoteCalculator is Ownable {

    IEverestERC20 evrs;
    IMiniChefV2 miniChef;

    constructor(address _evrs, address _miniChef) {
        evrs = IEverestERC20(_evrs);
        miniChef = IMiniChefV2(_miniChef);
    }

    function getVotesFromFarming(address voter, uint[] calldata pids) external view returns (uint votes) {
        address[] memory lpTokens = miniChef.lpTokens();

        for (uint i; i<pids.length; i++) {
            // Skip invalid pids
            if (pids[i] >= lpTokens.length) continue;

            address evrslAddress = lpTokens[pids[i]];
            IEverestPair pair = IEverestPair(evrslAddress);

            uint pair_total_EVRS = evrs.balanceOf(evrslAddress);
            uint pair_total_EVRSL = pair.totalSupply(); // Could initially be 0 in rare pre-mint situations

            uint EVRSL_hodling = pair.balanceOf(voter);
            uint EVRSL_staking = miniChef.userInfo(pids[i], voter).amount;

            votes += ((EVRSL_hodling + EVRSL_staking) * pair_total_EVRS) / pair_total_EVRSL;
        }
    }

    function getVotesFromStaking(address voter, address[] calldata stakes) external view returns (uint votes) {
        for (uint i; i<stakes.length; i++) {
            IStakingRewards staking = IStakingRewards(stakes[i]);

            // Safety check to ensure staking token is EVRS
            if (staking.stakingToken() == address(evrs)) {
                votes += staking.balanceOf(voter);
            }
        }
    }

    function getVotesFromWallets(address voter) external view returns (uint votes) {
        // Votes delegated to the voter
        votes += evrs.getCurrentVotes(voter);

        // Voter has never delegated
        if (evrs.delegates(voter) == address(0)) {
            votes += evrs.balanceOf(voter);
        }
    }

}
