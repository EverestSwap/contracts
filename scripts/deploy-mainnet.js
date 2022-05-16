const { ethers } = require("hardhat");
const fs = require("fs");
const { FOUNDATION_MULTISIG, MAX_GAS } = require("../constants/shared.js");
const {
    EVRS_SYMBOL,
    EVRS_NAME,
    TOTAL_SUPPLY,
    MULTISIG,
    USE_GNOSIS_SAFE,
    PROPOSAL_THRESHOLD,
    WRAPPED_NATIVE_TOKEN,
    INITIAL_FARMS,
    AIRDROP_AMOUNT,
    VESTER_ALLOCATIONS,
    REVENUE_DISTRIBUTION,
    TIMELOCK_DELAY,
    EVRS_STAKING_ALLOCATION,
    WETH_EVRS_FARM_ALLOCATION,
} = require(`../constants/${network.name}.js`);
if (USE_GNOSIS_SAFE) {
    var { EthersAdapter, SafeFactory } = require("@gnosis.pm/safe-core-sdk");
}

var contracts = [];

function delay(timeout) {
    return new Promise((resolve) => {
        setTimeout(resolve, timeout);
    });
}

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("\nDeployer:", deployer.address);

    
    const initBalance = await deployer.getBalance();
    console.log("Balance:", ethers.utils.formatEther(initBalance) + "\n");
    
    console.log("\nMultisig Owners:");
    for (const owner of MULTISIG.owners) {
        console.log(owner);
    }

    if (USE_GNOSIS_SAFE) {
        console.log("✅ Using Gnosis Safe.");
    } else {
        console.log("⚠️  Using legacy multisig.");
    }
    if (WRAPPED_NATIVE_TOKEN === undefined || WRAPPED_NATIVE_TOKEN == "") {
        console.log("⚠️  No wrapped gas token is defined.");
    } else {
        console.log("✅ An existing wrapped gas token is defined.");
    }
    if (INITIAL_FARMS.length === 0 || INITIAL_FARMS === undefined) {
        console.log("⚠️  No initial farm is defined.");
    }

    // dirty hack to circumvent duplicate nonce submission error
    var txCount = await ethers.provider.getTransactionCount(deployer.address);
    async function confirmTransactionCount() {
        let newTxCount;
        while (true) {
            try {
                newTxCount = await ethers.provider.getTransactionCount(
                    deployer.address
                );
                if (newTxCount != txCount + 1) {
                    continue;
                }
                txCount++;
            } catch (err) {
                console.log(err);
                process.exit(0);
            }
            break;
        }
    }

    async function deploy(factory, args, overrides = {}) {
        const ContractFactory = await ethers.getContractFactory(factory);
        const contract = await ContractFactory.deploy(...args, overrides);
        await contract.deployed();
        contracts.push({ name: factory, address: contract.address, args: args });
        await confirmTransactionCount();
        console.log(contract.address, ":", factory);
        return contract;
    }

    console.log("\n============\n DEPLOYMENT \n============");

    // Deploy WICY if not defined
    let nativeToken;
    if (WRAPPED_NATIVE_TOKEN === undefined) {
        console.log('No wrapped native token found. Deploying WICY...');
        nativeToken = (await deploy("WICY", [])).address;
    } else {
        nativeToken = WRAPPED_NATIVE_TOKEN;
        console.log('Wrapped native token found. Using existing WICY:', nativeToken);
    }

    /**************
     * GOVERNANCE *
     **************/

    // Deploy EVRS
    console.log('Deploying EVRS...');
    const evrs = await deploy("Evrs", [
        ethers.utils.parseUnits(TOTAL_SUPPLY.toString(), 18),
        ethers.utils.parseUnits(AIRDROP_AMOUNT.toString(), 18),
        EVRS_SYMBOL,
        EVRS_NAME,
    ]);

    // Deploy this chain’s multisig
    let multisig;
    if (USE_GNOSIS_SAFE) {
        console.log('Deploying main multisig (no Gnosis safe)...');
        const ethAdapter = new EthersAdapter({
            ethers,
            signer: deployer,
        });
        const MultisigGNOSafe = await SafeFactory.create({ ethAdapter });
        multisig = await MultisigGNOSafe.deploySafe(MULTISIG);
        await confirmTransactionCount();
        multisig.address = multisig.getAddress();
        console.log(multisig.address, ": Gnosis");
    } else {
        console.log('Deploying main multisig...');
        multisig = await deploy("MultiSigWalletWithDailyLimit", [
            MULTISIG.owners,
            MULTISIG.threshold,
            0,
        ]);
    }

    // Deploy foundation multisig
    let foundation;
    if (USE_GNOSIS_SAFE) {
        console.log('Deploying foundation multisig (no Gnosis safe)...');
        foundation = await MultisigGNOSafe.deploySafe(FOUNDATION_MULTISIG);
        await confirmTransactionCount();
        foundation.address = foundation.getAddress();
        console.log(foundation.address, ": Gnosis");
    } else {
        console.log('Deploying foundation multisig...');
        foundation = await deploy("MultiSigWalletWithDailyLimit", [
            FOUNDATION_MULTISIG.owners,
            FOUNDATION_MULTISIG.threshold,
            0,
        ]);
    }

    console.log('Deploying timelock...');
    const timelock = await deploy("Timelock", [
        multisig.address,
        TIMELOCK_DELAY,
    ], {
        gasLimit: MAX_GAS,
    });
    console.log('Deploying factory...');
    const factory = await deploy("EverestFactory", [deployer.address]);
    console.log('Deploying router...');
    const router = await deploy("EverestRouter", [
        factory.address,
        nativeToken,
    ]);
    console.log('Deploying chef...');
    const chef = await deploy("MiniChefV2", [evrs.address, deployer.address]);
    console.log('Deploying treasury...');
    const treasury = await deploy("CommunityTreasury", [evrs.address]);
    console.log('Deploying staking...');
    const staking = await deploy("StakingRewards", [evrs.address, evrs.address]);

    // Deploy Airdrop
    console.log('Deploying airdrop...');
    const airdrop = await deploy("Airdrop", [
        ethers.utils.parseUnits(AIRDROP_AMOUNT.toString(), 18),
        evrs.address,
        multisig.address,
        treasury.address,
    ], {
        gasLimit: MAX_GAS,
    });

    console.log('Deploying treasury vester...');
    // Deploy TreasuryVester
    var vesterAllocations = [];
    for (let i = 0; i < VESTER_ALLOCATIONS.length; i++) {
        vesterAllocations.push([
            eval(VESTER_ALLOCATIONS[i].recipient + ".address"),
            VESTER_ALLOCATIONS[i].allocation,
            VESTER_ALLOCATIONS[i].isMiniChef,
        ]);
    }
    const vester = await deploy("TreasuryVester", [
        evrs.address, // vested token
        ethers.utils.parseUnits((TOTAL_SUPPLY - AIRDROP_AMOUNT).toString(), 18),
        vesterAllocations,
        multisig.address,
    ]);

    /*****************
     * FEE COLLECTOR *
     *****************/

     console.log('Deploying joint multisig...');
    // Deploy 2/2 Joint MultisigGNOSafe
    if (USE_GNOSIS_SAFE) {
        var jointMultisig = await MultisigGNOSafe.deploySafe({
            owners: [multisig.address, foundation.address],
            threshold: 2,
        });
        await confirmTransactionCount();
        jointMultisig.address = jointMultisig.getAddress();
        console.log(jointMultisig.address, ": Gnosis");
    } else {
        var jointMultisig = await deploy("MultiSigWalletWithDailyLimit", [
            [multisig.address, foundation.address],
            2,
            0,
        ]);
    }

    console.log('Deploying revenue distributor...');
    // Deploy Revenue Distributor (Joint treasury of EVRS and FEVRS)
    var revenueDistribution = [];
    for (let i = 0; i < REVENUE_DISTRIBUTION.length; i++) {
        revenueDistribution.push([
            eval(REVENUE_DISTRIBUTION[i].recipient + ".address"),
            REVENUE_DISTRIBUTION[i].allocation,
        ]);
    }
    const revenueDistributor = await deploy("RevenueDistributor", [
        revenueDistribution,
    ], {
        gasLimit: MAX_GAS,
    });

    console.log('Deploying fee collector...');
    // Deploy Fee Collector
    const feeCollector = await deploy("EverestFeeCollector", [
        staking.address,
        router.address,
        chef.address,
        0, // chef pid for dummy EVRSL
        timelock.address,
        nativeToken,
        revenueDistributor.address,
    ]);

    console.log('Deploying dummy ERC20...');
    // Deploy DummyERC20 for diverting some EVRS emissions to EVRS staking
    const dummyERC20 = await deploy("DummyERC20", [
        "Dummy ERC20",
        "EVRSL",
        deployer.address,
        100, // arbitrary amount
    ]);

    console.log("\n===============\n CONFIGURATION \n===============");

    await treasury.transferOwnership(timelock.address);
    await confirmTransactionCount();
    console.log("Transferred CommunityTreasury ownership to Timelock.");

    await evrs.setMinter(vester.address);
    await confirmTransactionCount();
    console.log("Transferred EVRS minter role to TreasuryVester.");

    await evrs.setAdmin(timelock.address);
    await confirmTransactionCount();
    console.log("Transferred EVRS ownership to Timelock.");

    await evrs.transfer(
        airdrop.address,
        ethers.utils.parseUnits(AIRDROP_AMOUNT.toString(), 18)
    );
    await confirmTransactionCount();
    console.log(
        "Transferred",
        AIRDROP_AMOUNT.toString(),
        EVRS_SYMBOL,
        "to Airdrop."
    );

    await vester.transferOwnership(timelock.address);
    await confirmTransactionCount();
    console.log("Transferred TreasuryVester ownership to Timelock.");

    await revenueDistributor.transferOwnership(jointMultisig.address);
    await confirmTransactionCount();
    console.log("Transferred RevenueDistributor ownership to Joint MultisigGNOSafe.");

    await feeCollector.transferOwnership(multisig.address);
    await confirmTransactionCount();
    console.log("Transferred FeeCollector ownership to MultisigGNOSafe.");

    await dummyERC20.renounceOwnership();
    await confirmTransactionCount();
    console.log("Renounced DummyERC20 ownership.");

    // add dummy EVRSL to minichef
    await chef.addPool(
        EVRS_STAKING_ALLOCATION,
        dummyERC20.address,
        ethers.constants.AddressZero
    );
    await confirmTransactionCount();
    console.log("Added MiniChefV2 pool 0 for FeeCollector.");

    // deposit dummy EVRSL for the fee collector
    console.log("dummyERC20.approve")
    await dummyERC20.approve(chef.address, 100);
    await confirmTransactionCount();
    console.log("chef.deposit")
    await chef.deposit(
        0, // minichef pid
        100, // amount
        feeCollector.address, // deposit to address
        { gasLimit: MAX_GAS }
    );
    await confirmTransactionCount();
    console.log("Deposited DummyERC20 to MiniChefV2 pool 0.");

    // change swap fee recipient to fee collector
    await factory.setFeeTo(feeCollector.address);
    await confirmTransactionCount();
    console.log("Set FeeCollector as the swap fee recipient.");

    await factory.setFeeToSetter(multisig.address);
    await confirmTransactionCount();
    console.log("Transferred EverestFactory ownership to MultisigGNOSafe.");

    /********************
     * MINICHEFv2 FARMS *
     ********************/

    await factory.createPair(evrs.address, nativeToken);
    await confirmTransactionCount();
    var evrsPair = await factory.getPair(evrs.address, nativeToken);
    await chef.addPool(
        WETH_EVRS_FARM_ALLOCATION,
        evrsPair,
        ethers.constants.AddressZero,
        { gasLimit: MAX_GAS }
    );
    await confirmTransactionCount();
    console.log("Added MiniChef pool 1 for WICY-EVRS.");

    // create native token paired farms for tokens in INITIAL_FARMS
    for (let i = 0; i < INITIAL_FARMS.length; i++) {
        const tokenA = INITIAL_FARMS[i]["tokenA"];
        const tokenB = INITIAL_FARMS[i]["tokenB"];
        const weight = INITIAL_FARMS[i]["weight"];

        await factory.createPair(tokenA, tokenB);
        await confirmTransactionCount();

        const pair = await factory.getPair(tokenA, tokenB);

        await chef.addPool(
            weight,
            pair,
            ethers.constants.AddressZero,
            { gasLimit: MAX_GAS }
        );
        await confirmTransactionCount();
    }

    const pools = await chef.poolInfos();

    if (pools.length > 2) console.log("Added", (pools.length - 2).toString(), "more farms to MiniChefV2.");

    await chef.addFunder(vester.address);
    await confirmTransactionCount();

    console.log("Added TreasuryVester as MiniChefV2 funder.");

    await chef.transferOwnership(multisig.address);
    await confirmTransactionCount();
    console.log("Transferred MiniChefV2 ownership to MultisigGNOSafe.");

    const endBalance = await deployer.getBalance();
    console.log("\nDeploy cost:", ethers.utils.formatEther(initBalance.sub(endBalance)) + "\n");
    console.log("Recorded contract addresses to `addresses/" + network.name + ".js`.");
    console.log("Refer to `addresses/README.md` for Etherscan verification.\n");

    try {
        fs.writeFileSync(
            "addresses/" + network.name + ".js",
            "exports.ADDRESSES=" + JSON.stringify(contracts)
        );
        //file written successfully
    } catch (err) {
        console.error(err);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
