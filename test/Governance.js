// test/TreasuryVester.js
// Load dependencies
const { expect } = require('chai');
const { BigNumber } = require('ethers');
const { ethers } = require('hardhat');
const Web3 = require('web3');

// TODO: adapt with real addresses
const OWNER_ADDRESS = ethers.utils.getAddress("0xd5Ca5E8fE68a8609ec91659C29eC31aCCfe3B0e1");

const oneToken = BigNumber.from("1000000000000000000");

const UNPRIVILEGED_ADDRESS = ethers.utils.getAddress("0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65");

const TOTAL_VEST_AMOUNT = ethers.BigNumber.from("511100000000000000000000000");
const STARTING_VEST_AMOUNT = BigNumber.from('175034246575342000000000');
const HALVING = 1460;
const INTERVAL = 86400;

const token0 = Web3.utils.sha3('token0()').slice(0,10);
const token1 = Web3.utils.sha3('token1()').slice(0,10);

const DELAY = 14 * 24 * 60 * 60

const VOTING_DELAY = 60*60*24
const VOTING_PERIOD = 60*60*24*3

async function setGovAdmin(latestTime, timelock, governanceAddress) {
    await ethers.provider.send("evm_setNextBlockTimestamp", [latestTime]);

    const target = timelock.address;
    const value = 0;
    var sig = 'setPendingAdmin(address)';
    var callData = ethers.utils.defaultAbiCoder.encode(['address'], [governanceAddress]);

    latestTime = latestTime + (DELAY * 4);

    await timelock.queueTransaction(target, value, sig, callData, latestTime);

    await ethers.provider.send("evm_setNextBlockTimestamp", [latestTime]);
    await timelock.executeTransaction(target, value, sig, callData, latestTime);
    expect(await timelock.pendingAdmin()).to.equal(governanceAddress);

    //sig = 'accept'

    return latestTime;
}

// Start test block
describe('Governance', function () {
    before(async function () {
        [ , this.addr2, this.addr3] = await ethers.getSigners();

        this.Governor = await ethers.getContractFactory("GovernorAlpha");
        this.Timelock = await ethers.getContractFactory("Timelock");
        this.EVRS = await ethers.getContractFactory("Evrs");

        this.Wicz = await ethers.getContractFactory("Evrs");
        this.AltCoin = await ethers.getContractFactory("Evrs");
        this.TreasuryVester = await ethers.getContractFactory("TreasuryVester");
        this.LpManager = await ethers.getContractFactory("LiquidityPoolManagerV2");
        this.Community = await ethers.getContractFactory("CommunityTreasury");

        this.Factory = await ethers.getContractFactory("EverestFactory");

        this.MockPairIcz = await ethers.getContractFactory("contracts/MockContract.sol:MockContract");
    });

    beforeEach(async function () {
        // EVRS
        this.evrs = await this.EVRS.deploy(OWNER_ADDRESS);
        await this.evrs.deployed();
        this.evrsHandle2 = await this.evrs.connect(this.addr2);
        this.evrsHandle3 = await this.evrs.connect(this.addr3);

        // Timelock
        this.timelock = await this.Timelock.deploy(OWNER_ADDRESS, DELAY);
        await this.timelock.deployed();

        // GovernorAlpha
        this.governor = await this.Governor.deploy(this.timelock.address, this.evrs.address, OWNER_ADDRESS);
        await this.governor.deployed();
        this.governorHandle2 = await this.governor.connect(this.addr2);
        this.governorHandle3 = await this.governor.connect(this.addr3);

        // TreasuryVester
        this.treasury = await this.TreasuryVester.deploy(this.evrs.address);
        await this.treasury.deployed();

        // Community Treasury
        this.community = await this.Community.deploy(this.evrs.address);
        await this.community.deployed();

        // WICZ
        this.wicz = await this.Wicz.deploy(OWNER_ADDRESS);
        await this.wicz.deployed();

        // AltCoin
        this.altCoin = await this.AltCoin.deploy(OWNER_ADDRESS);
        await this.altCoin.deployed();

        // LiquidityPoolManager
        this.lpManager = await this.LpManager.deploy(this.wicz.address, this.evrs.address,
            this.treasury.address);
        await this.lpManager.deployed();

        // Mock Icz Pair
        this.mockPairIcz = await this.MockPairIcz.deploy();
        await this.mockPairIcz.deployed();
        // Setup mocks
        await this.mockPairIcz.givenMethodReturnAddress(token0, this.wicz.address);
        await this.mockPairIcz.givenMethodReturnAddress(token1, this.altCoin.address);

        this.factory = await this.Factory.deploy(OWNER_ADDRESS);
        await this.factory.deployed();

        this.proposalThreshold = (await this.governor.proposalThreshold()).add(1);
        this.voteThreshold = oneToken.mul(1000)
        this.votingPeriod = (await this.governor.votingPeriod()).add(2);
    });

    // Test cases

    //////////////////////////////
    //       Timelock
    //////////////////////////////
    describe("Timelock Proposals", function () {
        it('Change Admin', async function () {
            const startTime = 1611242739;
            await setGovAdmin(startTime, this.timelock, this.governor.address);
        });

        it('Add whitelisted Pool', async function () {
            const startTime = 1621342739;

            // Set LpManager owner
            await this.lpManager.transferOwnership(this.timelock.address);
            expect(await this.lpManager.isWhitelisted(this.mockPairIcz.address)).to.be.false;
            await expect(this.lpManager.addWhitelistedPool(this.mockPairIcz.address,1)).to.be.revertedWith('Ownable: caller is not the owner');

            const target = this.lpManager.address;
            const value = 0;
            const sig = 'addWhitelistedPool(address,uint256)';
            const callData = ethers.utils.defaultAbiCoder.encode(['address','uint256'], [this.mockPairIcz.address, 1]);

            await ethers.provider.send("evm_setNextBlockTimestamp", [startTime]);

            await this.timelock.queueTransaction(target, value, sig, callData, startTime + DELAY);

            var updateTime = startTime + DELAY;
            await ethers.provider.send("evm_setNextBlockTimestamp", [updateTime]);
            await this.timelock.executeTransaction(target, value, sig, callData, startTime + DELAY);
            expect(await this.lpManager.isWhitelisted(this.mockPairIcz.address)).to.be.true;
        });

        it('Remove Whitelisted Pool', async function () {
            const startTime = 1631342739;

            // Whitelist the pool
            await this.lpManager.addWhitelistedPool(this.mockPairIcz.address, 1);
            expect(await this.lpManager.isWhitelisted(this.mockPairIcz.address)).to.be.true;

            // Set LpManager owner
            await this.lpManager.transferOwnership(this.timelock.address);
            await expect(this.lpManager.removeWhitelistedPool(this.mockPairIcz.address)).to.be.revertedWith('Ownable: caller is not the owner');

            const target = this.lpManager.address;
            const value = 0;
            const sig = 'removeWhitelistedPool(address)';
            const callData = ethers.utils.defaultAbiCoder.encode(['address'], [this.mockPairIcz.address]);

            await ethers.provider.send("evm_setNextBlockTimestamp", [startTime]);

            await this.timelock.queueTransaction(target, value, sig, callData, startTime + DELAY);

            var updateTime = startTime + DELAY;
            await ethers.provider.send("evm_setNextBlockTimestamp", [updateTime]);
            await this.timelock.executeTransaction(target, value, sig, callData, startTime + DELAY);
            expect(await this.lpManager.isWhitelisted(this.mockPairIcz.address)).to.be.false;
        });
        it('Change LpManager', async function () {
            const startTime = 1641342739;

            // Set Treasury Recipient and change owner
            await this.treasury.setRecipient(this.lpManager.address);
            await this.treasury.transferOwnership(this.timelock.address);

            // Check preconditions
            expect(await this.treasury.recipient()).to.equal(this.lpManager.address);
            await expect(this.treasury.setRecipient(OWNER_ADDRESS)).to.be.revertedWith('Ownable: caller is not the owner');

            const target = this.treasury.address;
            const value = 0;
            const sig = 'setRecipient(address)';
            const callData = ethers.utils.defaultAbiCoder.encode(['address'], [OWNER_ADDRESS]);

            await ethers.provider.send("evm_setNextBlockTimestamp", [startTime]);

            await this.timelock.queueTransaction(target, value, sig, callData, startTime + DELAY);

            var updateTime = startTime + DELAY;
            await ethers.provider.send("evm_setNextBlockTimestamp", [updateTime]);
            await this.timelock.executeTransaction(target, value, sig, callData, startTime + DELAY);
            expect(await this.treasury.recipient()).to.be.equal(OWNER_ADDRESS);
        });

        it('Spend From Community Treasury', async function () {
            const startTime = 1651342739;
            const transferAmount = oneToken.mul(100);

            // Set Community Treasury and change owner
            await this.community.transferOwnership(this.timelock.address);

            // Check preconditions
            await this.evrs.transfer(this.community.address, transferAmount);
            expect(await this.community.balance()).to.equal(transferAmount);
            expect(await this.evrs.balanceOf(UNPRIVILEGED_ADDRESS)).to.equal(0);

            const target = this.community.address;
            const value = 0;
            const sig = 'transfer(address,uint256)';
            const callData = ethers.utils.defaultAbiCoder.encode(['address', 'uint256'], [UNPRIVILEGED_ADDRESS, transferAmount]);

            await ethers.provider.send("evm_setNextBlockTimestamp", [startTime]);

            await this.timelock.queueTransaction(target, value, sig, callData, startTime + DELAY);

            var updateTime = startTime + DELAY;
            await ethers.provider.send("evm_setNextBlockTimestamp", [updateTime]);
            await this.timelock.executeTransaction(target, value, sig, callData, startTime + DELAY);
            expect(await this.evrs.balanceOf(UNPRIVILEGED_ADDRESS)).to.equal(transferAmount);
            expect(await this.community.balance()).to.equal(0);
        });

        it('Enable fee switch', async function () {
            const startTime = 1661342739;

            // Set FeeTo setter
            await this.factory.setFeeToSetter(this.timelock.address);

            // Check preconditions
            expect(await this.factory.feeTo()).to.equal(ethers.constants.AddressZero);

            const target = this.factory.address;
            const value = 0;
            const sig = 'setFeeTo(address)';
            const callData = ethers.utils.defaultAbiCoder.encode(['address'], [UNPRIVILEGED_ADDRESS]);

            await ethers.provider.send("evm_setNextBlockTimestamp", [startTime]);

            await this.timelock.queueTransaction(target, value, sig, callData, startTime + DELAY);

            var updateTime = startTime + DELAY;
            await ethers.provider.send("evm_setNextBlockTimestamp", [updateTime]);
            await this.timelock.executeTransaction(target, value, sig, callData, startTime + DELAY);
            expect(await this.factory.feeTo()).to.equal(UNPRIVILEGED_ADDRESS);
        });

        it('Change FeeTo Setter', async function () {
            const startTime = 1671342739;

            // Set FeeTo setter
            await this.factory.setFeeToSetter(this.timelock.address);

            // Check preconditions
            expect(await this.factory.feeToSetter()).to.equal(this.timelock.address);

            const target = this.factory.address;
            const value = 0;
            const sig = 'setFeeToSetter(address)';
            const callData = ethers.utils.defaultAbiCoder.encode(['address'], [UNPRIVILEGED_ADDRESS]);

            await ethers.provider.send("evm_setNextBlockTimestamp", [startTime]);

            await this.timelock.queueTransaction(target, value, sig, callData, startTime + DELAY);

            var updateTime = startTime + DELAY;
            await ethers.provider.send("evm_setNextBlockTimestamp", [updateTime]);
            await this.timelock.executeTransaction(target, value, sig, callData, startTime + DELAY);
            expect(await this.factory.feeToSetter()).to.equal(UNPRIVILEGED_ADDRESS);
        });
    });

    //////////////////////////////
    //       Governor
    //////////////////////////////
    describe("Governor Proposals", function () {
        it('Change Admin', async function () {
            const startTime = 1681642739;

            // Transfer EVRS
            await this.evrs.transfer(this.addr2.address, this.proposalThreshold);
            await this.evrs.transfer(this.addr3.address, this.voteThreshold);

            // Delegate EVRS so addresses can vote, must delegate to themselves
            await this.evrsHandle2.delegate(this.addr2.address);
            await this.evrsHandle3.delegate(this.addr3.address);
            await this.evrs.delegate(OWNER_ADDRESS);

            // Change the timelock admin to the Governor
            var latestTime = await setGovAdmin(startTime, this.timelock, this.governor.address);
            await this.governor.__acceptAdmin();

            // Setup proposal
            const target = this.timelock.address;
            const value = 0;
            const sig = 'setPendingAdmin(address)';
            const callData = ethers.utils.defaultAbiCoder.encode(['address'], [UNPRIVILEGED_ADDRESS]);

            // Submit proposal
            await this.governorHandle2.propose([target], [value], [sig], [callData], "Change timelock admin");
            const proposalId = await this.governor.latestProposalIds(this.addr2.address);

            await ethers.provider.send("evm_increaseTime", [VOTING_DELAY + 1]);

            // Vote for the proposal
            await this.governorHandle3.castVote(proposalId, true);

            // Increase time till voting period is over
            await ethers.provider.send("evm_increaseTime", [this.votingPeriod.toNumber()]);

            // Queue the proposal for execution
            await this.governor.queue(proposalId);

            // Increase time till we're ready to execute
            await ethers.provider.send("evm_increaseTime", [DELAY]);

            // Execute the proposal
            await this.governor.execute(proposalId);

            // Check the results
            expect(await this.timelock.pendingAdmin()).to.equal(UNPRIVILEGED_ADDRESS);
        });

        it('Add whitelisted Pool', async function () {
            const startTime = 1689742739;

            // Transfer EVRS
            await this.evrs.transfer(this.addr2.address, this.proposalThreshold);
            await this.evrs.transfer(this.addr3.address, this.voteThreshold);

            // Delegate EVRS so addresses can vote, must delegate to themselves
            await this.evrsHandle2.delegate(this.addr2.address);
            await this.evrsHandle3.delegate(this.addr3.address);
            await this.evrs.delegate(OWNER_ADDRESS);

            // Change the timelock admin to the Governor
            await setGovAdmin(startTime, this.timelock, this.governor.address);
            await this.governor.__acceptAdmin();

            // Set LpManager owner
            await this.lpManager.transferOwnership(this.timelock.address);
            expect(await this.lpManager.isWhitelisted(this.mockPairIcz.address)).to.be.false;

            // Setup proposal
            const target = this.lpManager.address;
            const value = 0;
            const sig = 'addWhitelistedPool(address,uint256)';
            const callData = ethers.utils.defaultAbiCoder.encode(['address', 'uint256'], [this.mockPairIcz.address, 5]);

            // Submit proposal
            await this.governorHandle2.propose([target], [value], [sig], [callData], "Change timelock admin");
            const proposalId = await this.governor.latestProposalIds(this.addr2.address);

            await ethers.provider.send("evm_increaseTime", [VOTING_DELAY + 1]);

            // Vote for the proposal
            await this.governorHandle3.castVote(proposalId, true);

            // Increase time till voting period is over
            await ethers.provider.send("evm_increaseTime", [this.votingPeriod.toNumber()]);

            // Queue the proposal for execution
            await this.governor.queue(proposalId);

            // Increase time till we're ready to execute
            await ethers.provider.send("evm_increaseTime", [DELAY]);

            // Execute the proposal
            await this.governor.execute(proposalId);

            // Check the results
            expect(await this.lpManager.isWhitelisted(this.mockPairIcz.address)).to.be.true;
        });
        it('Remove Whitelisted Pool', async function () {
            const startTime = 1697742739;

            // Transfer EVRS
            await this.evrs.transfer(this.addr2.address, this.proposalThreshold);
            await this.evrs.transfer(this.addr3.address, this.voteThreshold);

            // Delegate EVRS so addresses can vote, must delegate to themselves
            await this.evrsHandle2.delegate(this.addr2.address);
            await this.evrsHandle3.delegate(this.addr3.address);
            await this.evrs.delegate(OWNER_ADDRESS);

            // Change the timelock admin to the Governor
            await setGovAdmin(startTime, this.timelock, this.governor.address);
            await this.governor.__acceptAdmin();

            // Whitelist the pool
            await this.lpManager.addWhitelistedPool(this.mockPairIcz.address, 5);
            expect(await this.lpManager.isWhitelisted(this.mockPairIcz.address)).to.be.true;

            // Set LpManager owner
            await this.lpManager.transferOwnership(this.timelock.address);

            // Setup proposal
            const target = this.lpManager.address;
            const value = 0;
            const sig = 'removeWhitelistedPool(address)';
            const callData = ethers.utils.defaultAbiCoder.encode(['address'], [this.mockPairIcz.address]);

            // Submit proposal
            await this.governorHandle2.propose([target], [value], [sig], [callData], "Change timelock admin");
            const proposalId = await this.governor.latestProposalIds(this.addr2.address);

            await ethers.provider.send("evm_increaseTime", [VOTING_DELAY + 1]);

            // Vote for the proposal
            await this.governorHandle3.castVote(proposalId, true);

            // Increase time till voting period is over
            await ethers.provider.send("evm_increaseTime", [this.votingPeriod.toNumber()]);

            // Queue the proposal for execution
            await this.governor.queue(proposalId);

            // Increase time till we're ready to execute
            await ethers.provider.send("evm_increaseTime", [DELAY]);

            // Execute the proposal
            await this.governor.execute(proposalId);

            // Check the results
            expect(await this.lpManager.isWhitelisted(this.mockPairIcz.address)).to.be.false;
        });
        it('Change LpManager', async function () {
            const startTime = 1717742739;

            // Transfer EVRS
            await this.evrs.transfer(this.addr2.address, this.proposalThreshold);
            await this.evrs.transfer(this.addr3.address, this.voteThreshold);

            // Delegate EVRS so addresses can vote, must delegate to themselves
            await this.evrsHandle2.delegate(this.addr2.address);
            await this.evrsHandle3.delegate(this.addr3.address);
            await this.evrs.delegate(OWNER_ADDRESS);

            // Change the timelock admin to the Governor
            await setGovAdmin(startTime, this.timelock, this.governor.address);
            await this.governor.__acceptAdmin();

            // Set Treasury owner
            await this.treasury.transferOwnership(this.timelock.address);

            // Setup proposal
            const target = this.treasury.address;
            const value = 0;
            const sig = 'setRecipient(address)';
            const callData = ethers.utils.defaultAbiCoder.encode(['address'], [OWNER_ADDRESS]);

            // Submit proposal
            await this.governorHandle2.propose([target], [value], [sig], [callData], "Change timelock admin");
            const proposalId = await this.governor.latestProposalIds(this.addr2.address);

            await ethers.provider.send("evm_increaseTime", [VOTING_DELAY + 1]);

            // Vote for the proposal
            await this.governorHandle3.castVote(proposalId, true);

            // Increase time till voting period is over
            await ethers.provider.send("evm_increaseTime", [this.votingPeriod.toNumber()]);

            // Queue the proposal for execution
            await this.governor.queue(proposalId);

            // Increase time till we're ready to execute
            await ethers.provider.send("evm_increaseTime", [DELAY]);

            // Execute the proposal
            await this.governor.execute(proposalId);

            // Check the results
            expect(await this.treasury.recipient()).to.equal(OWNER_ADDRESS);
        });
        it('Spend From Community Treasury', async function () {
            const startTime = 1737742739;
            const transferAmount = oneToken.mul(100);

            // Transfer EVRS
            await this.evrs.transfer(this.addr2.address, this.proposalThreshold);
            await this.evrs.transfer(this.addr3.address, this.voteThreshold);

            // Delegate EVRS so addresses can vote, must delegate to themselves
            await this.evrsHandle2.delegate(this.addr2.address);
            await this.evrsHandle3.delegate(this.addr3.address);
            await this.evrs.delegate(OWNER_ADDRESS);

            // Change the timelock admin to the Governor
            await setGovAdmin(startTime, this.timelock, this.governor.address);
            await this.governor.__acceptAdmin();

            // Set Community Treasury and change owner
            await this.community.transferOwnership(this.timelock.address);

            // Check preconditions
            await this.evrs.transfer(this.community.address, transferAmount);
            expect(await this.community.balance()).to.equal(transferAmount);
            expect(await this.evrs.balanceOf(UNPRIVILEGED_ADDRESS)).to.equal(0);

            const target = this.community.address;
            const value = 0;
            const sig = 'transfer(address,uint256)';
            const callData = ethers.utils.defaultAbiCoder.encode(['address', 'uint256'], [UNPRIVILEGED_ADDRESS, transferAmount]);

            // Submit proposal
            await this.governorHandle2.propose([target], [value], [sig], [callData], "Change timelock admin");
            const proposalId = await this.governor.latestProposalIds(this.addr2.address);

            await ethers.provider.send("evm_increaseTime", [VOTING_DELAY + 1]);

            // Vote for the proposal
            await this.governorHandle3.castVote(proposalId, true);

            // Increase time till voting period is over
            await ethers.provider.send("evm_increaseTime", [this.votingPeriod.toNumber()]);

            // Queue the proposal for execution
            await this.governor.queue(proposalId);

            // Increase time till we're ready to execute
            await ethers.provider.send("evm_increaseTime", [DELAY]);

            // Execute the proposal
            await this.governor.execute(proposalId);

            // Check the results
            expect(await this.evrs.balanceOf(UNPRIVILEGED_ADDRESS)).to.equal(transferAmount);
            expect(await this.community.balance()).to.equal(0);
        });

        it('Enable fee switch', async function () {
            const startTime = 1757742739;
            const transferAmount = oneToken.mul(100);

            // Transfer EVRS
            await this.evrs.transfer(this.addr2.address, this.proposalThreshold);
            await this.evrs.transfer(this.addr3.address, this.voteThreshold);

            // Delegate EVRS so addresses can vote, must delegate to themselves
            await this.evrsHandle2.delegate(this.addr2.address);
            await this.evrsHandle3.delegate(this.addr3.address);
            await this.evrs.delegate(OWNER_ADDRESS);

            // Change the timelock admin to the Governor
            await setGovAdmin(startTime, this.timelock, this.governor.address);
            await this.governor.__acceptAdmin();

            // Set FeeTo setter
            await this.factory.setFeeToSetter(this.timelock.address);

            // Check preconditions
            expect(await this.factory.feeTo()).to.equal(ethers.constants.AddressZero);

            const target = this.factory.address;
            const value = 0;
            const sig = 'setFeeTo(address)';
            const callData = ethers.utils.defaultAbiCoder.encode(['address'], [UNPRIVILEGED_ADDRESS]);

            // Submit proposal
            await this.governorHandle2.propose([target], [value], [sig], [callData], "Change timelock admin");
            const proposalId = await this.governor.latestProposalIds(this.addr2.address);

            await ethers.provider.send("evm_increaseTime", [VOTING_DELAY + 1]);

            // Vote for the proposal
            await this.governorHandle3.castVote(proposalId, true);

            // Increase time till voting period is over
            await ethers.provider.send("evm_increaseTime", [this.votingPeriod.toNumber()]);

            // Queue the proposal for execution
            await this.governor.queue(proposalId);

            // Increase time till we're ready to execute
            await ethers.provider.send("evm_increaseTime", [DELAY]);

            // Execute the proposal
            await this.governor.execute(proposalId);

            // Check the results
            expect(await this.factory.feeTo()).to.equal(UNPRIVILEGED_ADDRESS);
        });

        it('Change FeeTo Setter', async function () {
            const startTime = 1777742739;
            const transferAmount = oneToken.mul(100);

            // Transfer EVRS
            await this.evrs.transfer(this.addr2.address, this.proposalThreshold);
            await this.evrs.transfer(this.addr3.address, this.voteThreshold);

            // Delegate EVRS so addresses can vote, must delegate to themselves
            await this.evrsHandle2.delegate(this.addr2.address);
            await this.evrsHandle3.delegate(this.addr3.address);
            await this.evrs.delegate(OWNER_ADDRESS);

            // Change the timelock admin to the Governor
            await setGovAdmin(startTime, this.timelock, this.governor.address);
            await this.governor.__acceptAdmin();

            // Set FeeTo setter
            await this.factory.setFeeToSetter(this.timelock.address);

            // Check preconditions
            expect(await this.factory.feeToSetter()).to.equal(this.timelock.address);

            const target = this.factory.address;
            const value = 0;
            const sig = 'setFeeToSetter(address)';
            const callData = ethers.utils.defaultAbiCoder.encode(['address'], [UNPRIVILEGED_ADDRESS]);

            // Submit proposal
            await this.governorHandle2.propose([target], [value], [sig], [callData], "Change timelock admin");
            const proposalId = await this.governor.latestProposalIds(this.addr2.address);

            await ethers.provider.send("evm_increaseTime", [VOTING_DELAY + 1]);

            // Vote for the proposal
            await this.governorHandle3.castVote(proposalId, true);

            // Increase time till voting period is over
            await ethers.provider.send("evm_increaseTime", [this.votingPeriod.toNumber()]);

            // Queue the proposal for execution
            await this.governor.queue(proposalId);

            // Increase time till we're ready to execute
            await ethers.provider.send("evm_increaseTime", [DELAY]);

            // Execute the proposal
            await this.governor.execute(proposalId);

            // Check the results
            expect(await this.factory.feeToSetter()).to.equal(UNPRIVILEGED_ADDRESS);
        });

        it('Failed vote', async function () {
            const startTime = 1785395565;

            // Transfer EVRS
            await this.evrs.transfer(this.addr2.address, this.proposalThreshold);
            await this.evrs.transfer(this.addr3.address, this.voteThreshold);

            // Delegate EVRS so addresses can vote, must delegate to themselves
            await this.evrsHandle2.delegate(this.addr2.address);
            await this.evrsHandle3.delegate(this.addr3.address);
            await this.evrs.delegate(OWNER_ADDRESS);

            // Change the timelock admin to the Governor
            var latestTime = await setGovAdmin(startTime, this.timelock, this.governor.address);
            await this.governor.__acceptAdmin();

            // Setup proposal
            const target = this.timelock.address;
            const value = 0;
            const sig = 'setPendingAdmin(address)';
            const callData = ethers.utils.defaultAbiCoder.encode(['address'], [UNPRIVILEGED_ADDRESS]);

            // Submit proposal
            await this.governorHandle2.propose([target], [value], [sig], [callData], "Change timelock admin");
            const proposalId = await this.governor.latestProposalIds(this.addr2.address);

            await ethers.provider.send("evm_increaseTime", [VOTING_DELAY + 1]);

            // Vote for the proposal with more declining votes
            await this.governorHandle2.castVote(proposalId, false);
            await this.governorHandle3.castVote(proposalId, true);

            // Increase time till voting period is over
            await ethers.provider.send("evm_increaseTime", [this.votingPeriod.toNumber()]);

            // Queue the proposal for execution
            await expect(this.governor.queue(proposalId)).to.be.revertedWith("GovernorAlpha::queue: proposal can only be queued if it is succeeded");

            // Increase time till we're ready to execute
            await ethers.provider.send("evm_increaseTime", [DELAY]);

            // Execute the proposal
            await expect(this.governor.execute(proposalId)).to.be.revertedWith("GovernorAlpha::execute: proposal can only be executed if it is queued");

            // Check the results
            expect(await this.timelock.pendingAdmin()).to.equal(ethers.constants.AddressZero);
        });
    });

    describe("Governor Changes", function () {
        it('Set start time', async function () {
            const startTime = 1795395565;

            // Transfer EVRS
            await this.evrs.transfer(this.addr2.address, this.proposalThreshold);
            await this.evrs.transfer(this.addr3.address, this.voteThreshold);

            // Delegate EVRS so addresses can vote, must delegate to themselves
            await this.evrsHandle2.delegate(this.addr2.address);
            await this.evrsHandle3.delegate(this.addr3.address);
            await this.evrs.delegate(OWNER_ADDRESS);

            // Setup proposal
            const target = this.lpManager.address;
            const value = 0;
            const sig = 'addWhitelistedPool(address)';
            const callData = ethers.utils.defaultAbiCoder.encode(['address'], [this.mockPairIcz.address]);

            await ethers.provider.send("evm_setNextBlockTimestamp", [startTime]);

            // Submit proposal
            await this.governorHandle2.propose([target], [value], [sig], [callData], "Change timelock admin");
            const proposalId = await this.governor.latestProposalIds(this.addr2.address);

            let proposal = await this.governor.proposals(proposalId);
            expect(proposal.startTime).to.equal(startTime + VOTING_DELAY)
            expect(proposal.endTime).to.equal(startTime + VOTING_DELAY + VOTING_PERIOD)
            expect(proposal.startBlock).to.equal(0)

            await ethers.provider.send("evm_increaseTime", [VOTING_DELAY + 1]);

            // Vote for the proposal
            await this.governorHandle3.castVote(proposalId, true);

            proposal = await this.governor.proposals(proposalId);
            expect(proposal.startBlock.toNumber()).to.be.greaterThan(0);

            // Increase time till voting period is over
            await ethers.provider.send("evm_increaseTime", [VOTING_PERIOD]);

            // Queue the proposal for execution
            await expect(this.governorHandle3.castVote(proposalId, true)).to.be.revertedWith(
                'GovernorAlpha::_castVote: voting is closed'
            );
        });

        it('Start too early', async function () {
            // Transfer EVRS
            await this.evrs.transfer(this.addr2.address, this.proposalThreshold);
            await this.evrs.transfer(this.addr3.address, this.voteThreshold);

            // Delegate EVRS so addresses can vote, must delegate to themselves
            await this.evrsHandle2.delegate(this.addr2.address);
            await this.evrsHandle3.delegate(this.addr3.address);
            await this.evrs.delegate(OWNER_ADDRESS);

            // Setup proposal
            const target = this.lpManager.address;
            const value = 0;
            const sig = 'addWhitelistedPool(address)';
            const callData = ethers.utils.defaultAbiCoder.encode(['address'], [this.mockPairIcz.address]);

            // Submit proposal
            await this.governorHandle2.propose([target], [value], [sig], [callData], "Change timelock admin");
            const proposalId = await this.governor.latestProposalIds(this.addr2.address);

            await ethers.provider.send("evm_increaseTime", [VOTING_DELAY - 1]);

            // Vote for the proposal
            await expect(this.governorHandle3.castVote(proposalId, true)).to.be.revertedWith(
                'GovernorAlpha::_castVote: voting is closed'
            );
        });

        it('Set start block', async function () {
            // Transfer EVRS
            await this.evrs.transfer(this.addr2.address, this.proposalThreshold);
            await this.evrs.transfer(this.addr3.address, this.voteThreshold);

            // Delegate EVRS so addresses can vote, must delegate to themselves
            await this.evrsHandle2.delegate(this.addr2.address);
            await this.evrsHandle3.delegate(this.addr3.address);
            await this.evrs.delegate(OWNER_ADDRESS);

            // Setup proposal
            const target = this.lpManager.address;
            const value = 0;
            const sig = 'addWhitelistedPool(address)';
            const callData = ethers.utils.defaultAbiCoder.encode(['address'], [this.mockPairIcz.address]);

            // Submit proposal
            await this.governorHandle2.propose([target], [value], [sig], [callData], "Change timelock admin");
            const proposalId = await this.governor.latestProposalIds(this.addr2.address);

            let proposal = await this.governor.proposals(proposalId);
            expect(proposal.startBlock).to.equal(0)

            await ethers.provider.send("evm_increaseTime", [VOTING_DELAY + 1]);

            // Vote for the proposal
            await this.governorHandle3.castVote(proposalId, true);

            proposal = await this.governor.proposals(proposalId);

            let blockNum = await ethers.provider.send("eth_blockNumber", []);

            expect(proposal.startBlock.toNumber()).to.equal(blockNum - 1);
        });
    });

    describe("Constants", function () {
        it('Remove Whitelisted Pool', async function () {

        });
        it('Change LpManager', async function () {

        });
        it('Spend From Community Treasury', async function () {

        });
    });





});
