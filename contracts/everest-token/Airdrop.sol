// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

interface IEVRS {
    function balanceOf(address account) external view returns (uint);
    function transfer(address dst, uint rawAmount) external returns (bool);
}

/**
 *  Contract for administering the Airdrop of xEVRS to EVRS holders.
 *  Arbitrary amount EVRS will be made available in the airdrop. After the
 *  Airdrop period is over, all unclaimed EVRS will be transferred to the
 *  community treasury.
 */
contract Airdrop {
    address public immutable evrs;
    address public owner;
    address public whitelister;
    address public remainderDestination;

    // amount of EVRS to transfer
    mapping (address => uint) public withdrawAmount;

    uint public totalAllocated;
    uint public airdropSupply;

    bool public claimingAllowed;

    /**
     * Initializes the contract. Sets token addresses, owner, and leftover token
     * destination. Claiming period is not enabled.
     *
     * @param evrs_ the EVRS token contract address
     * @param owner_ the privileged contract owner
     * @param remainderDestination_ address to transfer remaining EVRS to when
     *     claiming ends. Should be community treasury.
     */
    constructor(
        uint supply_,
        address evrs_,
        address owner_,
        address remainderDestination_
    ) {
        require(owner_ != address(0), 'Airdrop::Construct: invalid new owner');
        require(evrs_ != address(0), 'Airdrop::Construct: invalid evrs address');

        airdropSupply = supply_;
        evrs = evrs_;
        owner = owner_;
        remainderDestination = remainderDestination_;
    }

    /**
     * Changes the address that receives the remaining EVRS at the end of the
     * claiming period. Can only be set by the contract owner.
     *
     * @param remainderDestination_ address to transfer remaining EVRS to when
     *     claiming ends.
     */
    function setRemainderDestination(address remainderDestination_) external {
        require(
            msg.sender == owner,
            'Airdrop::setRemainderDestination: unauthorized'
        );
        remainderDestination = remainderDestination_;
    }

    /**
     * Changes the contract owner. Can only be set by the contract owner.
     *
     * @param owner_ new contract owner address
     */
    function setOwner(address owner_) external {
        require(owner_ != address(0), 'Airdrop::setOwner: invalid new owner');
        require(msg.sender == owner, 'Airdrop::setOwner: unauthorized');
        owner = owner_;
    }

    /**
     *  Optionally set a secondary address to manage whitelisting (e.g. a bot)
     */
    function setWhitelister(address addr) external {
        require(msg.sender == owner, 'Airdrop::setWhitelister: unauthorized');
        whitelister = addr;
    }

    function setAirdropSupply(uint supply) external {
        require(msg.sender == owner, 'Airdrop::setAirdropSupply: unauthorized');
        require(
            !claimingAllowed,
            'Airdrop::setAirdropSupply: claiming in session'
        );
        require(
            supply >= totalAllocated,
            'Airdrop::setAirdropSupply: supply less than total allocated'
        );
        airdropSupply = supply;
    }

    /**
     * Enable the claiming period and allow user to claim EVRS. Before
     * activation, this contract must have a EVRS balance equal to airdropSupply
     * All claimable EVRS tokens must be whitelisted before claiming is enabled.
     * Only callable by the owner.
     */
    function allowClaiming() external {
        require(IEVRS(evrs).balanceOf(
            address(this)) >= airdropSupply,
            'Airdrop::allowClaiming: incorrect EVRS supply'
        );
        require(msg.sender == owner, 'Airdrop::allowClaiming: unauthorized');
        claimingAllowed = true;
        emit ClaimingAllowed();
    }

    /**
     * End the claiming period. All unclaimed EVRS will be transferred to the address
     * specified by remainderDestination. Can only be called by the owner.
     */
    function endClaiming() external {
        require(msg.sender == owner, 'Airdrop::endClaiming: unauthorized');
        require(claimingAllowed, "Airdrop::endClaiming: Claiming not started");

        claimingAllowed = false;

        // Transfer remainder
        uint amount = IEVRS(evrs).balanceOf(address(this));
        require(
            IEVRS(evrs).transfer(remainderDestination, amount),
            'Airdrop::endClaiming: Transfer failed'
        );

        emit ClaimingOver();
    }

    /**
     * Withdraw your EVRS. In order to qualify for a withdrawal, the
     * caller's address must be whitelisted. All EVRS must be claimed at
     * once. Only the full amount can be claimed and only one claim is
     * allowed per user.
     */
    function claim() external {
        require(claimingAllowed, 'Airdrop::claim: Claiming is not allowed');
        require(
            withdrawAmount[msg.sender] > 0,
            'Airdrop::claim: No EVRS to claim'
        );

        uint amountToClaim = withdrawAmount[msg.sender];
        withdrawAmount[msg.sender] = 0;

        require(
            IEVRS(evrs).transfer(msg.sender, amountToClaim),
            'Airdrop::claim: Transfer failed'
        );

        emit EvrsClaimed(msg.sender, amountToClaim);
    }

    /**
     * Whitelist multiple addresses in one call.
     * All parameters are arrays. Each array must be the same length. Each index
     * corresponds to one (address, evrs) tuple. Callable by the owner or whitelister.
     */
    function whitelistAddresses(
        address[] memory addrs,
        uint[] memory evrsOuts
    ) external {
        require(
            !claimingAllowed,
            'Airdrop::whitelistAddresses: claiming in session'
        );
        require(
            msg.sender == owner || msg.sender == whitelister,
            'Airdrop::whitelistAddresses: unauthorized'
        );
        require(
            addrs.length == evrsOuts.length,
            'Airdrop::whitelistAddresses: incorrect array length'
        );
        for (uint i; i < addrs.length; ++i) {
            address addr = addrs[i];
            uint evrsOut = evrsOuts[i];
            totalAllocated = totalAllocated + evrsOut - withdrawAmount[addr];
            withdrawAmount[addr] = evrsOut;
        }
        require(
            totalAllocated <= airdropSupply,
            'Airdrop::whitelistAddresses: Exceeds EVRS allocation'
        );
    }

    // Events
    event ClaimingAllowed();
    event ClaimingOver();
    event EvrsClaimed(address claimer, uint amount);
}
