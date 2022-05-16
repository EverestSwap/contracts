pragma solidity ^0.7.6;

import "openzeppelin-contracts-legacy/access/Ownable.sol";
import "openzeppelin-contracts-legacy/token/ERC20/SafeERC20.sol";
import "openzeppelin-contracts-legacy/token/ERC20/IERC20.sol";

/**
 * Custodian of community's EVRS. Deploy this contract, then change the owner to be a
 * governance protocol. Send community treasury funds to the deployed contract, then
 * spend them through governance proposals.
 */
contract CommunityTreasury is Ownable {
    using SafeERC20 for IERC20;

    // Token to custody
    IERC20 public evrs;

    constructor(address evrs_) {
        evrs = IERC20(evrs_);
    }

    /**
     * Transfer EVRS to the destination. Can only be called by the contract owner.
     */
    function transfer(address dest, uint amount) external onlyOwner {
        evrs.safeTransfer(dest, amount);
    }

    /**
     * Return the EVRS balance of this contract.
     */
    function balance() view external returns(uint) {
        return evrs.balanceOf(address(this));
    }

}