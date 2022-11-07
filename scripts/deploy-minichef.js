const fs = require("fs");
const { ethers } = require("hardhat");
const { MAX_GAS } = require("../constants/shared.js");
const {
    WETH_EVRS_FARM_ALLOCATION,
    WRAPPED_NATIVE_TOKEN
} = require(`../constants/${network.name}.js`);

const contracts = [];

async function main() {
    const [deployer] = await ethers.getSigners();
    const initBalance = await deployer.getBalance();
    
    console.log("Task started: deploying minichef...");
    console.log("\n============\n CURRENT PARAMS \n============");
    console.log("\nDeployer:", deployer.address);
    console.log("Balance:", ethers.utils.formatEther(initBalance), '\n');

    if (WRAPPED_NATIVE_TOKEN === undefined || WRAPPED_NATIVE_TOKEN == "") {
        console.log("⚠️ No wrapped gas token is defined. Stopping now...");
        return
    } else {
        console.log("✅ An existing wrapped gas token is defined.");
    }

    const WICZ = await ethers.getContractAt("WICZ", WRAPPED_NATIVE_TOKEN);

    // dirty hack to circumvent duplicate nonce submission error
    let txCount = await ethers.provider.getTransactionCount(deployer.address);

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

    function updateLogger(data){
        process.stdout.clearLine();
        process.stdout.cursorTo(0);
        process.stdout.write(data + '\n');
    }

    async function deploy(factory, args, overrides = {}) {
        const ContractFactory = await ethers.getContractFactory(factory);
        const contract = await ContractFactory.deploy(...args, overrides);
        await contract.deployed();
        contracts.push({ name: factory, address: contract.address, args: args });
        await confirmTransactionCount();
        updateLogger(`✅ ${factory}: ${contract.address}`);
        return contract;
    }

    console.log("\n============\n DEPLOYMENT \n============\n");

    process.stdout.write("⌛ DummyERC20: ...");
    const dummyERC20 = await deploy("DummyERC20", [
        "Dummy Everest LP",
        "EVRSL",
        deployer.address,
        100, // arbitrary amount
    ]);

    process.stdout.write("⌛ Minichef: ...");
    const chef = await deploy("MiniChefV2", [WRAPPED_NATIVE_TOKEN, deployer.address]);

    console.log("\n===============\n CONFIGURATION \n===============\n");

    process.stdout.write("⌛ Renouncing DummyERC20 ownership...");
    await dummyERC20.renounceOwnership();
    await confirmTransactionCount();
    updateLogger("✅ Renouncing DummyERC20 ownership...");

    process.stdout.write("⌛ Adding WICZ pool to minichef...");
    await chef.addPool(
        WETH_EVRS_FARM_ALLOCATION,
        dummyERC20.address,
        ethers.constants.AddressZero
    );
    await confirmTransactionCount();
    updateLogger("✅ Adding WICZ pool to minichef...");

    process.stdout.write("⌛ Approving wrapped token...");
    await dummyERC20.approve(chef.address, 100);
    await confirmTransactionCount();
    updateLogger("✅ Approving wrapped token...");

    process.stdout.write("⌛ Depositing WICZ to minichef pool...");
    await chef.deposit(
        0, // minichef pid
        100, // amount
        deployer.address, // deposit to address
        { gasLimit: MAX_GAS }
    );
    await confirmTransactionCount();
    updateLogger("✅ Depositing WICZ to minichef pool...");

    process.stdout.write("⌛ Setting minichef funder role...");
    await chef.addFunder(deployer.address);
    await confirmTransactionCount();
    updateLogger("✅ Setting minichef funder role...");

    const endBalance = await deployer.getBalance();

    console.log("\nDeploy cost:", ethers.utils.formatEther(initBalance.sub(endBalance)) + "\n");
    console.log("Recorded contract addresses to `addresses/" + network.name + "-minichef.js`.");
    console.log("Refer to `addresses/README.md` for Etherscan verification.\n");

    try {
        fs.writeFileSync(
            "addresses/" + network.name + "-minichef.js",
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
