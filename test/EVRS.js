// test/EVRS.js
// Load dependencies
const { expect } = require('chai');
const { ethers } = require('hardhat');

const UNPRIVILEGED_ADDRESS = ethers.Wallet.createRandom().address;
const AIRDROP_SUPPLY = ethers.utils.parseUnits("11500000", 18);
const TOTAL_SUPPLY = ethers.utils.parseUnits("230000000", 18);
const ZERO_ADDRESS = ethers.constants.AddressZero;
const UINT96_MAX = ethers.BigNumber.from("2").pow("96").sub("1");

// Start test block
// Only tests for the new features added by shung
describe('EVRS', function () {

  before(async function () {
    [ this.admin, ] = await ethers.getSigners();
    this.EVRS = await ethers.getContractFactory("Evrs");
  });

  beforeEach(async function () {
    this.evrs = await this.EVRS.deploy(TOTAL_SUPPLY, AIRDROP_SUPPLY, "EVRS", "Everest");
    await this.evrs.deployed();
  });


  // Test cases


  //////////////////////////////
  //     Constructor
  //////////////////////////////
  describe("Constructor", function () {
    it('arg 1: max supply', async function () {
      expect(await this.evrs.maxSupply()).to.equal(TOTAL_SUPPLY);
    });
    it('arg 2: initial supply', async function () {
      expect(await this.evrs.totalSupply()).to.equal(AIRDROP_SUPPLY);
    });
    it('arg 3: symbol', async function () {
      expect(await this.evrs.symbol()).to.equal("EVRS");
    });
    it('arg 4: name', async function () {
      expect(await this.evrs.name()).to.equal("Everest");
    });
    it('default: hardcapped', async function () {
      expect(await this.evrs.hardcapped()).to.be.false;
    });
    it('default: admin', async function () {
      expect(await this.evrs.admin()).to.equal(this.admin.address);
    });
    it('default: minter', async function () {
      expect(await this.evrs.minter()).to.equal(ZERO_ADDRESS);
    });
    it('default: burnedSupply', async function() {
      expect(await this.evrs.burnedSupply()).to.equal(0);
    });
  });


  //////////////////////////////
  //     mint
  //////////////////////////////
  describe("mint", function () {
    it('unauthorized cannot mint', async function() {
      await expect(this.evrs.mint(this.admin.address, 1)).to.be.revertedWith("Evrs::mint: unauthorized");
    });

    it('authorized can mint', async function() {
      expect(await this.evrs.balanceOf(this.admin.address)).to.equal(AIRDROP_SUPPLY);
      expect(await this.evrs.totalSupply()).to.equal(AIRDROP_SUPPLY);

      await expect(this.evrs.setMinter(this.admin.address)).to.emit(this.evrs, "MinterChanged");

      await expect(this.evrs.mint(this.admin.address, 1)).to.emit(this.evrs, "Transfer");

      expect(await this.evrs.balanceOf(this.admin.address)).to.equal(AIRDROP_SUPPLY.add("1"));
      expect(await this.evrs.totalSupply()).to.equal(AIRDROP_SUPPLY.add("1"));
      expect(await this.evrs.balanceOf(ZERO_ADDRESS)).to.equal(0);
    });

    it('cannot mint over max supply', async function() {
      expect(await this.evrs.balanceOf(this.admin.address)).to.equal(AIRDROP_SUPPLY);
      expect(await this.evrs.totalSupply()).to.equal(AIRDROP_SUPPLY);

      await expect(this.evrs.setMinter(this.admin.address)).to.emit(this.evrs, "MinterChanged");

      await expect(this.evrs.mint(this.admin.address, TOTAL_SUPPLY.sub(AIRDROP_SUPPLY).add("1"))).to.be.revertedWith("Evrs::_mintTokens: mint result exceeds max supply");

      expect(await this.evrs.balanceOf(this.admin.address)).to.equal(AIRDROP_SUPPLY);
      expect(await this.evrs.totalSupply()).to.equal(AIRDROP_SUPPLY);
      expect(await this.evrs.balanceOf(ZERO_ADDRESS)).to.equal(0);
    });

    it('cannot mint to zero address', async function() {
      expect(await this.evrs.balanceOf(ZERO_ADDRESS)).to.equal("0");
      expect(await this.evrs.totalSupply()).to.equal(AIRDROP_SUPPLY);

      await expect(this.evrs.setMinter(this.admin.address)).to.emit(this.evrs, "MinterChanged");

      await expect(this.evrs.mint(ZERO_ADDRESS, 1)).to.be.revertedWith("Evrs::_mintTokens: cannot mint to the zero address");

      expect(await this.evrs.totalSupply()).to.equal(AIRDROP_SUPPLY);
      expect(await this.evrs.balanceOf(ZERO_ADDRESS)).to.equal(0);
    });

    it('cannot mint above 96 bits', async function() {
      expect(await this.evrs.balanceOf(this.admin.address)).to.equal(AIRDROP_SUPPLY);
      expect(await this.evrs.totalSupply()).to.equal(AIRDROP_SUPPLY);

      await expect(this.evrs.setMinter(this.admin.address)).to.emit(this.evrs, "MinterChanged");

      await expect(this.evrs.mint(this.admin.address, UINT96_MAX.sub(AIRDROP_SUPPLY).add("1"))).to.be.revertedWith("Evrs::_mintTokens: mint amount overflows");

      expect(await this.evrs.totalSupply()).to.equal(AIRDROP_SUPPLY);
      expect(await this.evrs.balanceOf(this.admin.address)).to.equal(AIRDROP_SUPPLY);
    });

  });


  //////////////////////////////
  //     burn
  //////////////////////////////
  describe("burn", function () {
    it('cannot burn above 96 bits', async function() {
      expect(await this.evrs.balanceOf(this.admin.address)).to.equal(AIRDROP_SUPPLY);

      await expect(this.evrs.burn(UINT96_MAX.add("1"))).to.be.revertedWith("Evrs::burn: amount exceeds 96 bits");

      expect(await this.evrs.burnedSupply()).to.equal("0");
      expect(await this.evrs.balanceOf(this.admin.address)).to.equal(AIRDROP_SUPPLY);
    });

    it('cannot burn more than balance', async function() {
      expect(await this.evrs.balanceOf(this.admin.address)).to.equal(AIRDROP_SUPPLY);

      await expect(this.evrs.burn(AIRDROP_SUPPLY.add("1"))).to.be.revertedWith("Evrs::_burnTokens: burn amount exceeds balance");

      expect(await this.evrs.burnedSupply()).to.equal("0");
      expect(await this.evrs.balanceOf(this.admin.address)).to.equal(AIRDROP_SUPPLY);
    });

    it('burns balance', async function() {
      expect(await this.evrs.balanceOf(this.admin.address)).to.equal(AIRDROP_SUPPLY);

      await expect(this.evrs.burn(AIRDROP_SUPPLY)).to.emit(this.evrs, "Transfer");

      expect(await this.evrs.burnedSupply()).to.equal(AIRDROP_SUPPLY);
      expect(await this.evrs.totalSupply()).to.equal("0");
      expect(await this.evrs.balanceOf(this.admin.address)).to.equal("0");
    });

    /* TODO Should also check changes due to _moveDelegates */

  });


  //////////////////////////////
  //     burnFrom
  //////////////////////////////
  describe("burnFrom", function () {
    it('cannot burn above 96 bits', async function() {
      [ , altAddr] = await ethers.getSigners();
      altContract = await this.evrs.connect(altAddr);

      expect(await this.evrs.balanceOf(this.admin.address)).to.equal(AIRDROP_SUPPLY);

      await expect(altContract.burnFrom(this.admin.address, UINT96_MAX.add("1"))).to.be.revertedWith("Evrs::burnFrom: amount exceeds 96 bits");

      expect(await this.evrs.burnedSupply()).to.equal("0");
      expect(await this.evrs.totalSupply()).to.equal(AIRDROP_SUPPLY);
      expect(await this.evrs.balanceOf(this.admin.address)).to.equal(AIRDROP_SUPPLY);
    });

    it('cannot burn without allowance', async function() {
      [ , altAddr] = await ethers.getSigners();
      altContract = await this.evrs.connect(altAddr);

      expect(await this.evrs.balanceOf(this.admin.address)).to.equal(AIRDROP_SUPPLY);

      await expect(altContract.burnFrom(this.admin.address, "1")).to.be.revertedWith("Evrs::burnFrom: burn amount exceeds spender allowance");

      expect(await this.evrs.burnedSupply()).to.equal("0");
      expect(await this.evrs.totalSupply()).to.equal(AIRDROP_SUPPLY);
      expect(await this.evrs.balanceOf(this.admin.address)).to.equal(AIRDROP_SUPPLY);
    });

    it('can burn with allowance', async function() {
      [ , altAddr] = await ethers.getSigners();
      altContract = await this.evrs.connect(altAddr);

      expect(await this.evrs.balanceOf(this.admin.address)).to.equal(AIRDROP_SUPPLY);

      await expect(this.evrs.approve(altAddr.address, AIRDROP_SUPPLY)).to.emit(this.evrs, "Approval");
      expect(await this.evrs.allowance(this.admin.address, altAddr.address)).to.equal(AIRDROP_SUPPLY);

      await expect(altContract.burnFrom(this.admin.address, AIRDROP_SUPPLY)).to.emit(this.evrs, "Transfer");

      expect(await this.evrs.burnedSupply()).to.equal(AIRDROP_SUPPLY);
      expect(await this.evrs.balanceOf(this.admin.address)).to.equal("0");
      expect(await this.evrs.totalSupply()).to.equal("0");
      expect(await this.evrs.allowance(this.admin.address, altAddr.address)).to.equal("0");
    });

    it('cannot burn more than balance', async function() {
      [ , altAddr] = await ethers.getSigners();
      altContract = await this.evrs.connect(altAddr);

      expect(await this.evrs.balanceOf(this.admin.address)).to.equal(AIRDROP_SUPPLY);

      await expect(this.evrs.approve(altAddr.address, UINT96_MAX)).to.emit(this.evrs, "Approval");
      expect(await this.evrs.allowance(this.admin.address, altAddr.address)).to.equal(UINT96_MAX);

      await expect(altContract.burnFrom(this.admin.address, AIRDROP_SUPPLY.add("1"))).to.be.revertedWith("Evrs::_burnTokens: burn amount exceeds balance");

      expect(await this.evrs.burnedSupply()).to.equal("0");
      expect(await this.evrs.balanceOf(this.admin.address)).to.equal(AIRDROP_SUPPLY);
      expect(await this.evrs.totalSupply()).to.equal(AIRDROP_SUPPLY);
      expect(await this.evrs.allowance(this.admin.address, altAddr.address)).to.equal(UINT96_MAX);
    });

    /* TODO Should also check changes due to _moveDelegates */

  });


  //////////////////////////////
  //     setMinter
  //////////////////////////////
  describe("setMinter", function () {
    it('admin set minter', async function() {
      expect(await this.evrs.minter()).to.equal(ZERO_ADDRESS);

      await expect(this.evrs.setMinter(this.admin.address)).to.emit(this.evrs, "MinterChanged");

      expect(await this.evrs.minter()).to.equal(this.admin.address);
    });

    it('unauthorized cannot set minter', async function() {
      [ , altAddr] = await ethers.getSigners();
      altContract = await this.evrs.connect(altAddr);

      expect(await this.evrs.minter()).to.equal(ZERO_ADDRESS);

      await expect(altContract.setMinter(altAddr.address)).to.be.revertedWith("Evrs::setMinter: unauthorized");

      expect(await this.evrs.minter()).to.equal(ZERO_ADDRESS);
    });

  });


  //////////////////////////////
  //     setAdmin
  //////////////////////////////
  describe("setAdmin", function () {
    it('admin can set admin', async function() {
      [ , altAddr] = await ethers.getSigners();

      expect(await this.evrs.admin()).to.equal(this.admin.address);

      await expect(this.evrs.setAdmin(altAddr.address)).to.emit(this.evrs, "AdminChanged");

      expect(await this.evrs.admin()).to.equal(altAddr.address);
    });

    it('unauthorized cannot set admin', async function() {
      [ , altAddr] = await ethers.getSigners();
      altContract = await this.evrs.connect(altAddr);

      expect(await this.evrs.admin()).to.equal(this.admin.address);

      await expect(altContract.setAdmin(altAddr.address)).to.be.revertedWith("Evrs::setAdmin: unauthorized");

      expect(await this.evrs.admin()).to.equal(this.admin.address);
    });

    it('cannot set zero address admin', async function() {
      expect(await this.evrs.admin()).to.equal(this.admin.address);

      await expect(this.evrs.setAdmin(ZERO_ADDRESS)).to.be.revertedWith("Evrs::setAdmin: cannot make zero address the admin");

      expect(await this.evrs.admin()).to.equal(this.admin.address);
    });

  });


  //////////////////////////////
  //     setMaxSupply
  //////////////////////////////
  describe("setMaxSupply", function () {
    it('unauthorized cannot set max supply', async function() {
      [ , altAddr] = await ethers.getSigners();
      altContract = await this.evrs.connect(altAddr);

      expect(await this.evrs.maxSupply()).to.equal(TOTAL_SUPPLY);

      await expect(altContract.setMaxSupply(AIRDROP_SUPPLY)).to.be.revertedWith("Evrs::setMaxSupply: unauthorized");

      expect(await this.evrs.maxSupply()).to.equal(TOTAL_SUPPLY);
    });

    it('admin can set max supply', async function() {
      expect(await this.evrs.maxSupply()).to.equal(TOTAL_SUPPLY);

      await expect(this.evrs.setMaxSupply(AIRDROP_SUPPLY)).to.emit(this.evrs, "MaxSupplyChanged");

      expect(await this.evrs.maxSupply()).to.equal(AIRDROP_SUPPLY);
    });

    it('cannot set max supply less than circulating supply', async function() {
      expect(await this.evrs.maxSupply()).to.equal(TOTAL_SUPPLY);

      await expect(this.evrs.setMaxSupply(AIRDROP_SUPPLY.sub("1"))).to.be.revertedWith("Evrs::setMaxSupply: circulating supply exceeds new max supply");

      expect(await this.evrs.maxSupply()).to.equal(TOTAL_SUPPLY);
    });

    it('cannot set max supply more than 96 bits', async function() {
      expect(await this.evrs.maxSupply()).to.equal(TOTAL_SUPPLY);

      await expect(this.evrs.setMaxSupply(UINT96_MAX.add("1"))).to.be.revertedWith("Evrs::setMaxSupply: new max supply exceeds 96 bits");

      expect(await this.evrs.maxSupply()).to.equal(TOTAL_SUPPLY);
    });

    it('cannot set max supply when hardcap is enabled', async function() {
      expect(await this.evrs.maxSupply()).to.equal(TOTAL_SUPPLY);

      await expect(this.evrs.disableSetMaxSupply()).to.emit(this.evrs, "HardcapEnabled");
      await expect(this.evrs.setMaxSupply(AIRDROP_SUPPLY)).to.be.revertedWith("Evrs::setMaxSupply: function was disabled");

      expect(await this.evrs.maxSupply()).to.equal(TOTAL_SUPPLY);
    });

  });


  //////////////////////////////
  //     disableSetMaxSupply
  //////////////////////////////
  describe("disableSetMaxSupply", function () {
    it('unauthorized cannot disable setMaxSupply', async function() {
      [ , altAddr] = await ethers.getSigners();
      altContract = await this.evrs.connect(altAddr);

      expect(await this.evrs.hardcapped()).to.equal(false);

      await expect(altContract.disableSetMaxSupply()).to.be.revertedWith("Evrs::disableSetMaxSupply: unauthorized");
      await expect(this.evrs.setMaxSupply(AIRDROP_SUPPLY)).to.emit(this.evrs, "MaxSupplyChanged");

      expect(await this.evrs.hardcapped()).to.equal(false);
    });

    it('admin can disable setMaxSupply', async function() {
      expect(await this.evrs.hardcapped()).to.equal(false);

      await expect(this.evrs.disableSetMaxSupply()).to.emit(this.evrs, "HardcapEnabled");
      await expect(this.evrs.setMaxSupply(AIRDROP_SUPPLY)).to.be.revertedWith("Evrs::setMaxSupply: function was disabled");

      expect(await this.evrs.hardcapped()).to.equal(true);
    });

  });


});
