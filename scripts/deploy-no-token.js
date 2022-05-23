const { ethers } = require("hardhat");
const fs = require("fs");
const {
    MULTISIG,
    USE_GNOSIS_SAFE,
    WRAPPED_NATIVE_TOKEN
} = require(`../constants/${network.name}.js`);
if (USE_GNOSIS_SAFE) {
    const { EthersAdapter, SafeFactory } = require("@gnosis.pm/safe-core-sdk");
}

const contracts = [];

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
        console.log("⚠️ Using legacy multisig.");
    }
    if (WRAPPED_NATIVE_TOKEN === undefined || WRAPPED_NATIVE_TOKEN == "") {
        console.log("⚠️ No wrapped gas token is defined.");
    } else {
        console.log("✅ An existing wrapped gas token is defined.");
    }

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

    // Deploy WICZ if not defined
    let nativeToken;
    if (WRAPPED_NATIVE_TOKEN === undefined) {
        console.log('No wrapped native token found. Deploying WICZ...');
        nativeToken = (await deploy("WICZ", [])).address;
    } else {
        nativeToken = WRAPPED_NATIVE_TOKEN;
        console.log('Wrapped native token found. Using existing WICZ:', nativeToken);
    }

    /************
     * MULTISIG *
     ************/

    // Deploy multisig
    let multisig;
    if (USE_GNOSIS_SAFE) {
        console.log('Deploying main multisig (Gnosis safe)...');
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
        console.log('Deploying main multisig (legacy)...');
        multisig = await deploy("MultiSigWalletWithDailyLimit", [
            MULTISIG.owners,
            MULTISIG.threshold,
            0,
        ]);
    }

    console.log('Deploying factory...');
    const factory = await deploy("EverestFactory", [deployer.address]);
    
    console.log('Deploying router...');
    await deploy("EverestRouter", [
        factory.address,
        nativeToken,
    ]);

    console.log("\n===============\n CONFIGURATION \n===============");

    await factory.setFeeTo(multisig.address);
    await confirmTransactionCount();
    console.log("Set Multisig as the swap fee recipient.");

    await factory.setFeeToSetter(multisig.address);
    await confirmTransactionCount();
    console.log("Transferred EverestFactory ownership to Multisig.");

    const endBalance = await deployer.getBalance();
    console.log("\nDeploy cost:", ethers.utils.formatEther(initBalance.sub(endBalance)) + "\n");
    console.log("Recorded contract addresses to `addresses/" + network.name + ".js`.");
    console.log("Refer to `addresses/README.md` for Etherscan verification.\n");

    try {
        fs.writeFileSync(
            "addresses/" + network.name + "-no-token.js",
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
