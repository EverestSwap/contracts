// test/Airdrop.js
// Load dependencies
const { expect } = require('chai');
const { BigNumber } = require('ethers');
const { ethers } = require('hardhat');

const UNPRIVILEGED_ADDRESS = ethers.Wallet.createRandom().address;
const TREASURY = ethers.Wallet.createRandom().address;

const AIRDROP_SUPPLY = ethers.utils.parseUnits("11500000", 18);
const TOTAL_SUPPLY = ethers.utils.parseUnits("230000000", 18);
const ONE_TOKEN = ethers.utils.parseUnits("1", 18);

// Start test block
describe('Airdrop', function () {
    before(async function () {
        [ this.admin, ] = await ethers.getSigners();
        this.Airdrop = await ethers.getContractFactory("Airdrop");
        this.EVRS = await ethers.getContractFactory("Evrs");
    });

    beforeEach(async function () {
        this.evrs = await this.EVRS.deploy(TOTAL_SUPPLY, AIRDROP_SUPPLY, "EVRS", "Everest");
        await this.evrs.deployed();
        this.airdrop = await this.Airdrop.deploy(AIRDROP_SUPPLY, this.evrs.address, this.admin.address, TREASURY);
        await this.airdrop.deployed();

    });

    // Test cases

    //////////////////////////////
    //       Constructor
    //////////////////////////////
    describe("Constructor", function () {
        it('airdrop supply', async function () {
            expect((await this.airdrop.airdropSupply())).to.equal(AIRDROP_SUPPLY);
        });
        it('evrs address', async function () {
            expect((await this.airdrop.evrs())).to.equal(this.evrs.address);
        });
        it('owner address', async function () {
            expect((await this.airdrop.owner())).to.equal(this.admin.address);
        });
        it('remainderDestination address', async function () {
            expect((await this.airdrop.remainderDestination())).to.equal(TREASURY);
        });
        it('claiming default', async function () {
            expect((await this.airdrop.claimingAllowed())).to.be.false;
        });
        it('totalAllocated default', async function () {
            expect((await this.airdrop.totalAllocated())).to.equal(0);
        });
    });

    //////////////////////////////
    //  setRemainderDestination
    //////////////////////////////
    describe("setRemainderDestination", function () {
        it('set remainder successfully', async function () {
            expect((await this.airdrop.remainderDestination())).to.not.equal(UNPRIVILEGED_ADDRESS);
            await this.airdrop.setRemainderDestination(UNPRIVILEGED_ADDRESS);
            expect((await this.airdrop.remainderDestination())).to.equal(UNPRIVILEGED_ADDRESS);
        });

        it('set remainder unsuccessfully', async function () {
            [ , altAddr] = await ethers.getSigners();
            altContract = await this.airdrop.connect(altAddr);
            await expect(altContract.setRemainderDestination(altAddr.getAddress())).to.be.revertedWith(
                "Airdrop::setRemainderDestination: unauthorized");
        });
    });

    //////////////////////////////
    //     setOwner
    //////////////////////////////
    describe("setOwner", function () {
        it('set owner successfully', async function () {
            expect((await this.airdrop.owner())).to.not.equal(UNPRIVILEGED_ADDRESS);
            await this.airdrop.setOwner(UNPRIVILEGED_ADDRESS);
            expect((await this.airdrop.owner())).to.equal(UNPRIVILEGED_ADDRESS);
        });

        it('set owner unsuccessfully', async function () {
            [ , altAddr] = await ethers.getSigners();
            altContract = await this.airdrop.connect(altAddr);
            await expect(altContract.setOwner(altAddr.getAddress())).to.be.revertedWith(
                "Airdrop::setOwner: unauthorized");
        });
    });

    //////////////////////////////
    //     setWhitelister
    //////////////////////////////
    describe("setWhitelister", function () {
        it('set whitelister successfully', async function () {
            expect((await this.airdrop.whitelister())).to.not.equal(UNPRIVILEGED_ADDRESS);
            await this.airdrop.setWhitelister(UNPRIVILEGED_ADDRESS);
            expect((await this.airdrop.whitelister())).to.equal(UNPRIVILEGED_ADDRESS);
        });

        it('set whitelister unsuccessfully', async function () {
            [ , altAddr] = await ethers.getSigners();
            altContract = await this.airdrop.connect(altAddr);
            await expect(altContract.setWhitelister(altAddr.getAddress())).to.be.revertedWith(
                "Airdrop::setWhitelister: unauthorized");
        });
    });

    //////////////////////////////
    //     setAirdropSupply
    //////////////////////////////
    describe("setAirdropSupply", function () {
        it('set airdropSupply successfully', async function () {
            const newAirdropSupply = AIRDROP_SUPPLY.add(500000);
            expect((await this.airdrop.airdropSupply())).to.equal(AIRDROP_SUPPLY);

            await this.airdrop.setAirdropSupply(newAirdropSupply);
            expect((await this.airdrop.airdropSupply())).to.equal(newAirdropSupply);
        });

        it('unauthorized call', async function () {
            const newAirdropSupply = AIRDROP_SUPPLY.add(500000);

            [ , altAddr] = await ethers.getSigners();
            altContract = await this.airdrop.connect(altAddr);
            await expect(altContract.setAirdropSupply(newAirdropSupply)).to.be.revertedWith(
                "Airdrop::setAirdropSupply: unauthorized");
        });

        it('less airdrop amount than already allocated', async function () {
            expect(await this.airdrop.withdrawAmount(UNPRIVILEGED_ADDRESS)).to.equal(0);
            await this.airdrop.whitelistAddresses([UNPRIVILEGED_ADDRESS], [AIRDROP_SUPPLY]);

            expect((await this.airdrop.airdropSupply())).to.equal(AIRDROP_SUPPLY);

            expect(await this.airdrop.withdrawAmount(UNPRIVILEGED_ADDRESS)).to.equal(AIRDROP_SUPPLY);
            await expect(this.airdrop.setAirdropSupply(AIRDROP_SUPPLY.sub(1))).to.be.revertedWith(
                "Airdrop::setAirdropSupply: supply less than total allocated");
        });

        it('claiming in session', async function () {
            expect((await this.airdrop.claimingAllowed())).to.be.false;
            await this.evrs.transfer(this.airdrop.address, AIRDROP_SUPPLY);

            expect(await this.evrs.balanceOf(this.airdrop.address)).to.equal(AIRDROP_SUPPLY);
            await this.airdrop.allowClaiming();

            expect((await this.airdrop.claimingAllowed())).to.be.true;

            const newAirdropSupply = AIRDROP_SUPPLY.add(500000);
            expect((await this.airdrop.airdropSupply())).to.equal(AIRDROP_SUPPLY);
            await expect(this.airdrop.setAirdropSupply(newAirdropSupply)).to.be.revertedWith(
                "Airdrop::setAirdropSupply: claiming in session");
        });

    });

    //////////////////////////////
    //     allowClaiming
    //////////////////////////////
    describe("allowClaiming", function () {
        it('set claiming successfully', async function () {
            expect((await this.airdrop.claimingAllowed())).to.be.false;
            await this.evrs.transfer(this.airdrop.address, AIRDROP_SUPPLY);
            expect(await this.evrs.balanceOf(this.airdrop.address)).to.equal(AIRDROP_SUPPLY);
            await this.airdrop.allowClaiming();
            expect((await this.airdrop.claimingAllowed())).to.be.true;
        });

        it('ClaimingAllowed emitted', async function () {
            expect((await this.airdrop.claimingAllowed())).to.be.false;
            await this.evrs.transfer(this.airdrop.address, AIRDROP_SUPPLY);
            expect(await this.evrs.balanceOf(this.airdrop.address)).to.equal(AIRDROP_SUPPLY);

            await expect(this.airdrop.allowClaiming()).to.emit(this.airdrop, 'ClaimingAllowed')
        });

        it('set claiming insufficient EVRS', async function () {
            expect((await this.airdrop.claimingAllowed())).to.be.false;
            await expect(this.airdrop.allowClaiming()).to.be.revertedWith(
                'Airdrop::allowClaiming: incorrect EVRS supply');
        });

        it('set claiming unathorized', async function () {
            expect((await this.airdrop.claimingAllowed())).to.be.false;
            await this.evrs.transfer(this.airdrop.address, AIRDROP_SUPPLY);
            expect(await this.evrs.balanceOf(this.airdrop.address)).to.equal(AIRDROP_SUPPLY);

            [ , altAddr] = await ethers.getSigners();
            altContract = await this.airdrop.connect(altAddr);
            await expect(altContract.allowClaiming()).to.be.revertedWith(
                'Airdrop::allowClaiming: unauthorized');
        });

        it('set claiming unathorized and insufficient EVRS', async function () {
            expect((await this.airdrop.claimingAllowed())).to.be.false;
            [ , altAddr] = await ethers.getSigners();
            altContract = await this.airdrop.connect(altAddr);
            await expect(altContract.allowClaiming()).to.be.revertedWith(
                'Airdrop::allowClaiming: incorrect EVRS supply');
        });
    });

    //////////////////////////////
    //       endClaiming
    //////////////////////////////
    describe("endClaiming", function () {
        it('end claiming successfully', async function () {
            // allow claiming
            expect((await this.airdrop.claimingAllowed())).to.be.false;
            await this.evrs.transfer(this.airdrop.address, AIRDROP_SUPPLY);
            expect(await this.evrs.balanceOf(this.airdrop.address)).to.equal(AIRDROP_SUPPLY);
            await this.airdrop.allowClaiming();
            expect((await this.airdrop.claimingAllowed())).to.be.true;

            // end claiming
            expect(await this.evrs.balanceOf(TREASURY)).to.equal(0);
            await this.airdrop.endClaiming();
            expect((await this.airdrop.claimingAllowed())).to.be.false;
            expect(await this.evrs.balanceOf(TREASURY)).to.equal(AIRDROP_SUPPLY);
            expect(await this.evrs.balanceOf(this.airdrop.address)).to.equal(0);
        });

        it('claiming not started', async function () {
            // end claiming
            expect((await this.airdrop.claimingAllowed())).to.be.false;
            await expect(this.airdrop.endClaiming()).to.be.revertedWith("Airdrop::endClaiming: Claiming not started");
        });

        it('ClaimingOver emitted', async function () {
            // allow claiming
            expect((await this.airdrop.claimingAllowed())).to.be.false;
            await this.evrs.transfer(this.airdrop.address, AIRDROP_SUPPLY);
            expect(await this.evrs.balanceOf(this.airdrop.address)).to.equal(AIRDROP_SUPPLY);
            await this.airdrop.allowClaiming();
            expect((await this.airdrop.claimingAllowed())).to.be.true;

            await expect(this.airdrop.endClaiming()).to.emit(this.airdrop, 'ClaimingOver')
        });

        it('end claiming with some claimed EVRS', async function () {
            // whitelist address
            [ , altAddr] = await ethers.getSigners();
            altContract = await this.airdrop.connect(altAddr);
            const evrsOut = ONE_TOKEN.mul(100)
            await this.airdrop.whitelistAddresses([altAddr.getAddress()], [evrsOut]);

            // enable claiming
            expect((await this.airdrop.claimingAllowed())).to.be.false;
            await this.evrs.transfer(this.airdrop.address, AIRDROP_SUPPLY);
            expect(await this.evrs.balanceOf(this.airdrop.address)).to.equal(AIRDROP_SUPPLY);
            await this.airdrop.allowClaiming();
            expect((await this.airdrop.claimingAllowed())).to.be.true;

            // claim
            await altContract.claim();

            // end claiming
            expect(await this.evrs.balanceOf(TREASURY)).to.equal(0);
            await this.airdrop.endClaiming();
            expect((await this.airdrop.claimingAllowed())).to.be.false;
            expect(await this.evrs.balanceOf(TREASURY)).to.equal(AIRDROP_SUPPLY.sub(evrsOut));
            expect(await this.evrs.balanceOf(this.airdrop.address)).to.equal(0);
        });

        it('end claiming with all claimed EVRS', async function () {
            // whitelist address
            [ , altAddr] = await ethers.getSigners();
            altContract = await this.airdrop.connect(altAddr);
            const evrsOut = AIRDROP_SUPPLY;
            await this.airdrop.whitelistAddresses([altAddr.getAddress()], [evrsOut]);

            // enable claiming
            expect((await this.airdrop.claimingAllowed())).to.be.false;
            await this.evrs.transfer(this.airdrop.address, AIRDROP_SUPPLY);
            expect(await this.evrs.balanceOf(this.airdrop.address)).to.equal(AIRDROP_SUPPLY);
            await this.airdrop.allowClaiming();
            expect((await this.airdrop.claimingAllowed())).to.be.true;

            // claim
            await altContract.claim();

            // end claiming
            expect(await this.evrs.balanceOf(TREASURY)).to.equal(0);
            await this.airdrop.endClaiming();
            expect((await this.airdrop.claimingAllowed())).to.be.false;
            expect(await this.evrs.balanceOf(TREASURY)).to.equal(0);
            expect(await this.evrs.balanceOf(this.airdrop.address)).to.equal(0);
        });

        it('end claiming unauthorized', async function () {
            // allow claiming
            expect((await this.airdrop.claimingAllowed())).to.be.false;
            await this.evrs.transfer(this.airdrop.address, AIRDROP_SUPPLY);
            expect(await this.evrs.balanceOf(this.airdrop.address)).to.equal(AIRDROP_SUPPLY);
            await this.airdrop.allowClaiming();
            expect((await this.airdrop.claimingAllowed())).to.be.true;

            // end claiming
            [ , altAddr] = await ethers.getSigners();
            altContract = await this.airdrop.connect(altAddr);
            await expect(altContract.endClaiming()).to.be.revertedWith(
                'Airdrop::endClaiming: unauthorized');
        });
    });

    //////////////////////////////
    //          claim
    //////////////////////////////
    describe("claim", function () {
        it('successful claim', async function () {
            // Check balance starts at 0
            [ , altAddr] = await ethers.getSigners();
            altContract = await this.airdrop.connect(altAddr);
            expect(await this.evrs.balanceOf(altAddr.getAddress())).to.equal(0);

            // Whitelist address
            const evrsOut = ethers.BigNumber.from('100');
            await this.airdrop.whitelistAddresses([altAddr.getAddress()], [evrsOut]);
            expect(await this.airdrop.withdrawAmount(altAddr.getAddress())).to.equal(evrsOut);

            // Enable claiming
            await this.evrs.transfer(this.airdrop.address, AIRDROP_SUPPLY);
            await this.airdrop.allowClaiming();
            expect((await this.airdrop.claimingAllowed())).to.be.true;

            // Claim
            await altContract.claim();

            // Check balance has increased
            expect(await this.evrs.balanceOf(altAddr.getAddress())).to.equal(evrsOut);
        });

        it('event emitted', async function () {
            // Check balance starts at 0
            [ , altAddr] = await ethers.getSigners();
            altContract = await this.airdrop.connect(altAddr);
            expect(await this.evrs.balanceOf(altAddr.getAddress())).to.equal(0);

            // Whitelist address
            const evrsOut = ethers.BigNumber.from('100');
            await this.airdrop.whitelistAddresses([altAddr.getAddress()], [evrsOut]);
            expect(await this.airdrop.withdrawAmount(altAddr.getAddress())).to.equal(evrsOut);

            // Enable claiming
            await this.evrs.transfer(this.airdrop.address, AIRDROP_SUPPLY);
            await this.airdrop.allowClaiming();
            expect((await this.airdrop.claimingAllowed())).to.be.true;

            // Claim
            await expect(altContract.claim()).to.emit(altContract, "EvrsClaimed").withArgs(altAddr.address, evrsOut);

            // Check balance has increased
            expect(await this.evrs.balanceOf(altAddr.getAddress())).to.equal(evrsOut);
        });

        it('claiming not enabled', async function () {
            // Check balance starts at 0
            [ , altAddr] = await ethers.getSigners();
            altContract = await this.airdrop.connect(altAddr);
            expect(await this.evrs.balanceOf(altAddr.getAddress())).to.equal(0);

            // Whitelist address
            const evrsOut = ethers.BigNumber.from('100');
            await this.airdrop.whitelistAddresses([altAddr.getAddress()], [evrsOut]);
            expect(await this.airdrop.withdrawAmount(altAddr.getAddress())).to.equal(evrsOut);

            // Claim
            await expect(altContract.claim()).to.be.revertedWith(
                'Airdrop::claim: Claiming is not allowed');
        });

        it('EVRS already claimed', async function () {
            // Check balance starts at 0
            [ , altAddr] = await ethers.getSigners();
            altContract = await this.airdrop.connect(altAddr);
            expect(await this.evrs.balanceOf(altAddr.getAddress())).to.equal(0);

            // Whitelist address
            const evrsOut = ethers.BigNumber.from('100');
            await this.airdrop.whitelistAddresses([altAddr.getAddress()], [evrsOut]);
            expect(await this.airdrop.withdrawAmount(altAddr.getAddress())).to.equal(evrsOut);

            // Enable claiming
            await this.evrs.transfer(this.airdrop.address, AIRDROP_SUPPLY);
            await this.airdrop.allowClaiming();
            expect((await this.airdrop.claimingAllowed())).to.be.true;

            // Claim
            await altContract.claim();

            // Check balance has increased
            expect(await this.evrs.balanceOf(altAddr.getAddress())).to.equal(evrsOut);

            // Try to claim again
            await expect(altContract.claim()).to.be.revertedWith(
                'Airdrop::claim: No EVRS to claim');
        });

        it('Nothing to claim', async function () {
            // Check balance starts at 0
            [ , altAddr] = await ethers.getSigners();
            altContract = await this.airdrop.connect(altAddr);
            expect(await this.evrs.balanceOf(altAddr.getAddress())).to.equal(0);

            // Whitelist address
            const evrsOut = ethers.BigNumber.from('0');

            // Enable claiming
            await this.evrs.transfer(this.airdrop.address, AIRDROP_SUPPLY);
            await this.airdrop.allowClaiming();
            expect((await this.airdrop.claimingAllowed())).to.be.true;

            // Attempt claim
            await expect(altContract.claim()).to.be.revertedWith(
                'Airdrop::claim: No EVRS to claim');
        });

        it('Nothing to claim but balances present', async function () {
            // Check balance starts at 0
            [ , altAddr] = await ethers.getSigners();
            altContract = await this.airdrop.connect(altAddr);
            expect(await this.evrs.balanceOf(altAddr.getAddress())).to.equal(0);

            // Whitelist address
            const evrsOut = ethers.BigNumber.from('0');

            // Enable claiming
            await this.evrs.transfer(this.airdrop.address, AIRDROP_SUPPLY);
            await this.airdrop.allowClaiming();
            expect((await this.airdrop.claimingAllowed())).to.be.true;

            // Attempt claim
            await expect(altContract.claim()).to.be.revertedWith(
                'Airdrop::claim: No EVRS to claim');
        });

        it('Multiple successful claims', async function () {
            [ , altAddr, addr3] = await ethers.getSigners();
            altContract = await this.airdrop.connect(altAddr);
            altContract2 = await this.airdrop.connect(addr3);

            // Whitelist address
            const evrsOut = ethers.BigNumber.from('100');
            await this.airdrop.whitelistAddresses([altAddr.getAddress()], [evrsOut]);
            expect(await this.airdrop.withdrawAmount(altAddr.getAddress())).to.equal(evrsOut);
            await this.airdrop.whitelistAddresses([addr3.getAddress()], [evrsOut]);
            expect(await this.airdrop.withdrawAmount(addr3.getAddress())).to.equal(evrsOut);

            // Enable claiming
            await this.evrs.transfer(this.airdrop.address, AIRDROP_SUPPLY);
            await this.airdrop.allowClaiming();
            expect((await this.airdrop.claimingAllowed())).to.be.true;

            // Check balance starts at 0

            expect(await this.evrs.balanceOf(altAddr.getAddress())).to.equal(0);
            expect(await this.evrs.balanceOf(addr3.getAddress())).to.equal(0);

            // Claim
            await altContract.claim();
            await altContract2.claim();


            // Check balance has increased
            expect(await this.evrs.balanceOf(altAddr.getAddress())).to.equal(evrsOut);
            expect(await this.evrs.balanceOf(addr3.getAddress())).to.equal(evrsOut);
        });
    });

    //////////////////////////////
    //    whitelistAddresses
    //////////////////////////////
    describe("whitelistAddresses", function () {
        it('Add single address', async function () {
            const evrsOut = ethers.BigNumber.from('100');

            expect(await this.airdrop.withdrawAmount(UNPRIVILEGED_ADDRESS)).to.equal(0);

            await this.airdrop.whitelistAddresses([UNPRIVILEGED_ADDRESS], [evrsOut]);

            expect(await this.airdrop.withdrawAmount(UNPRIVILEGED_ADDRESS)).to.equal(evrsOut);
        });

        it('Add single address with whitelister', async function () {
            const evrsOut = ethers.BigNumber.from('100');

            [ , altAddr] = await ethers.getSigners();
            altContract = await this.airdrop.connect(altAddr);

            await this.airdrop.setWhitelister(altAddr.address);
            expect((await this.airdrop.whitelister())).to.equal(altAddr.address);

            expect(await altContract.withdrawAmount(UNPRIVILEGED_ADDRESS)).to.equal(0);

            await altContract.whitelistAddresses([UNPRIVILEGED_ADDRESS], [evrsOut]);

            expect(await this.airdrop.withdrawAmount(UNPRIVILEGED_ADDRESS)).to.equal(evrsOut);
        });

        it('Add multiple addresses', async function () {
            const evrsOut = ethers.BigNumber.from('100');
            const evrsOut2 = ethers.BigNumber.from('543');

            expect(await this.airdrop.withdrawAmount(UNPRIVILEGED_ADDRESS)).to.equal(0);

            expect(await this.airdrop.withdrawAmount(this.admin.address)).to.equal(0);

            await this.airdrop.whitelistAddresses([UNPRIVILEGED_ADDRESS, this.admin.address],
                [evrsOut, evrsOut2]);

            expect(await this.airdrop.withdrawAmount(UNPRIVILEGED_ADDRESS)).to.equal(evrsOut);

            expect(await this.airdrop.withdrawAmount(this.admin.address)).to.equal(evrsOut2);
        });

        it('Add multiple addresses with whitelister', async function () {
            const evrsOut = ethers.BigNumber.from('100');
            const evrsOut2 = ethers.BigNumber.from('543');

            [ , altAddr] = await ethers.getSigners();
            altContract = await this.airdrop.connect(altAddr);

            await this.airdrop.setWhitelister(altAddr.address);
            expect((await this.airdrop.whitelister())).to.equal(altAddr.address);

            expect(await this.airdrop.withdrawAmount(UNPRIVILEGED_ADDRESS)).to.equal(0);

            expect(await this.airdrop.withdrawAmount(this.admin.address)).to.equal(0);

            await altContract.whitelistAddresses([UNPRIVILEGED_ADDRESS, this.admin.address],
                [evrsOut, evrsOut2]);

            expect(await this.airdrop.withdrawAmount(UNPRIVILEGED_ADDRESS)).to.equal(evrsOut);

            expect(await this.airdrop.withdrawAmount(this.admin.address)).to.equal(evrsOut2);
        });

        it('Exceeds EVRS supply cummulatively', async function () {
            const evrsOut = AIRDROP_SUPPLY;

            await expect(this.airdrop.whitelistAddresses([UNPRIVILEGED_ADDRESS, this.admin.address],
                [evrsOut, evrsOut])).to.be.revertedWith(
                'Airdrop::whitelistAddresses: Exceeds EVRS allocation'
            );
        });

        it('Unauthorized call', async function () {
            const evrsOut = ethers.BigNumber.from('100');

            [ , altAddr] = await ethers.getSigners();
            altContract = await this.airdrop.connect(altAddr);

            await expect(altContract.whitelistAddresses([UNPRIVILEGED_ADDRESS], [evrsOut])).to.be.revertedWith(
                'Airdrop::whitelistAddresses: unauthorized'
            );
        });

        it('Add address twice to override', async function () {
            const evrsOut = ethers.BigNumber.from('2000');
            const totalAlloc = await this.airdrop.totalAllocated();

            expect(await this.airdrop.withdrawAmount(UNPRIVILEGED_ADDRESS)).to.equal(0);

            await this.airdrop.whitelistAddresses([UNPRIVILEGED_ADDRESS], [evrsOut]);

            expect(await this.airdrop.withdrawAmount(UNPRIVILEGED_ADDRESS)).to.equal(evrsOut);
            expect(await this.airdrop.totalAllocated()).to.equal(totalAlloc.add(evrsOut));

            await this.airdrop.whitelistAddresses([UNPRIVILEGED_ADDRESS], ['0']);

            expect(await this.airdrop.withdrawAmount(UNPRIVILEGED_ADDRESS)).to.equal(0);
            expect(await this.airdrop.totalAllocated()).to.equal(totalAlloc);

        });

        it('Incorrect addr length', async function () {
            const evrsOut = ethers.BigNumber.from('2000');

            await expect(this.airdrop.whitelistAddresses([UNPRIVILEGED_ADDRESS],
                [evrsOut, evrsOut])).to.be.revertedWith(
                'Airdrop::whitelistAddresses: incorrect array length'
            );
        });

        it('Incorrect evrs length', async function () {
            const evrsOut = ethers.BigNumber.from('2000');

            await expect(this.airdrop.whitelistAddresses([UNPRIVILEGED_ADDRESS, this.admin.address],
                [evrsOut])).to.be.revertedWith(
                'Airdrop::whitelistAddresses: incorrect array length'
            );
        });

    });

    //////////////////////////////
    //       End-to-End
    //////////////////////////////
    describe("End-to-End", function () {
        it('Single claim', async function () {
            // Check balance starts at 0
            [ , altAddr] = await ethers.getSigners();
            altContract = await this.airdrop.connect(altAddr);
            expect(await this.evrs.balanceOf(altAddr.getAddress())).to.equal(0);

            // Whitelist address
            const evrsOut = ethers.BigNumber.from('100');
            await this.airdrop.whitelistAddresses([altAddr.getAddress()], [evrsOut]);
            expect(await this.airdrop.withdrawAmount(altAddr.getAddress())).to.equal(evrsOut);

            // Enable claiming
            await this.evrs.transfer(this.airdrop.address, AIRDROP_SUPPLY);
            await this.airdrop.allowClaiming();
            expect((await this.airdrop.claimingAllowed())).to.be.true;

            // Claim
            await altContract.claim();

            // Check balance has increased
            expect(await this.evrs.balanceOf(altAddr.getAddress())).to.equal(evrsOut);

            // End claiming
            expect(await this.evrs.balanceOf(TREASURY)).to.equal(0);
            await this.airdrop.endClaiming();
            expect((await this.airdrop.claimingAllowed())).to.be.false;
            expect(await this.evrs.balanceOf(TREASURY)).to.equal(AIRDROP_SUPPLY.sub(evrsOut));
            expect(await this.evrs.balanceOf(this.airdrop.address)).to.equal(0);
        });

        it('Multiple claims', async function () {
            // Check balance starts at 0
            [ , altAddr, addr3] = await ethers.getSigners();
            altContract = await this.airdrop.connect(altAddr);
            altContract2 = await this.airdrop.connect(addr3);
            expect(await this.evrs.balanceOf(altAddr.getAddress())).to.equal(0);
            expect(await this.evrs.balanceOf(addr3.getAddress())).to.equal(0);

            // Whitelist address
            const evrsOut = ethers.BigNumber.from('100');
            const evrsOut2 = ethers.BigNumber.from('4326543');

            await this.airdrop.whitelistAddresses([altAddr.getAddress(), addr3.getAddress()], [evrsOut, evrsOut2]);
            expect(await this.airdrop.withdrawAmount(altAddr.getAddress())).to.equal(evrsOut);
            expect(await this.airdrop.withdrawAmount(addr3.getAddress())).to.equal(evrsOut2);

            // Enable claiming
            await this.evrs.transfer(this.airdrop.address, AIRDROP_SUPPLY);
            await this.airdrop.allowClaiming();
            expect((await this.airdrop.claimingAllowed())).to.be.true;

            // Claim
            await altContract.claim();
            await altContract2.claim();

            // Check balance has increased
            expect(await this.evrs.balanceOf(altAddr.getAddress())).to.equal(evrsOut);
            expect(await this.evrs.balanceOf(addr3.getAddress())).to.equal(evrsOut2);

            // End claiming
            expect(await this.evrs.balanceOf(TREASURY)).to.equal(0);
            await this.airdrop.endClaiming();
            expect((await this.airdrop.claimingAllowed())).to.be.false;
            expect(await this.evrs.balanceOf(TREASURY)).to.equal(AIRDROP_SUPPLY.sub(evrsOut).sub(evrsOut2));
            expect(await this.evrs.balanceOf(this.airdrop.address)).to.equal(0);
        });
    });
});
