const fs = require("fs");
const { ethers } = require("hardhat");
const { EthersAdapter, SafeFactory } = require("@gnosis.pm/safe-core-sdk");
const { MAX_GAS } = require("../constants/shared.js");
const {
    MULTISIG,
    USE_GNOSIS_SAFE,
    GNOSIS_SAFE_ADDRESSES,
    FEE_RECIPIENT,
    WRAPPED_NATIVE_TOKEN,
    NATIVE_TOKEN_NAME,
    MULTICALL_ADDRESS
} = require(`../constants/${network.name}.js`);

const contracts = [];

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Task started: deploying contracts WITHOUT token...");
    console.log("\n============\n CURRENT PARAMS \n============");
    console.log("\nDeployer:", deployer.address);

    const initBalance = await deployer.getBalance();
    console.log("Balance:", ethers.utils.formatEther(initBalance));

    console.log("\nMultisig Owners:");
    for (const owner of MULTISIG.owners) {
        console.log(owner);
    }

    console.log('\n')

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
    if (MULTICALL_ADDRESS === undefined || MULTICALL_ADDRESS == "") {
        console.log("⚠️  No multicall contract is defined.");
    } else {
        console.log("✅ An existing multicall contract is defined.");
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

    // Deploy WICZ or WICY if not defined
    let nativeToken;
    const nativeTokenName = NATIVE_TOKEN_NAME || 'ICZ';
    if (WRAPPED_NATIVE_TOKEN === undefined) {
        console.log(`No wrapped native token found. Deploying W${nativeTokenName}...`);
        nativeToken = (await deploy(`W${nativeTokenName}`, [])).address;
    } else {
        nativeToken = WRAPPED_NATIVE_TOKEN;
    }

    // Deploy Multicall
    if (MULTICALL_ADDRESS === undefined) {
        console.log(`Deploying Multicall...`);
        await deploy(`Multicall`, [], { gasLimit: MAX_GAS });
    }

    /************
     * MULTISIG *
     ************/

    // Deploy multisig
    let multisig;
    if (USE_GNOSIS_SAFE) {
        if (!GNOSIS_SAFE_ADDRESSES.multiSendAddress.length || !GNOSIS_SAFE_ADDRESSES.multiSendAddress.length || !GNOSIS_SAFE_ADDRESSES.multiSendAddress.length) {
            console.log("⚠️  No Gnosis Safe address is defined.\n");
            console.log("Please deploy a Gnosis safe contracts set as described here then specify the addresses in GNOSIS_SAFE_ADDRESSES.\n");
            console.log("https://github.com/safe-global/safe-contracts#deployments\n");
            return
        }

        console.log('Deploying main multisig (Gnosis safe)...');
        const ethAdapter = new EthersAdapter({
            ethers,
            signer: deployer,
        });

        const contractNetworks = {
            [552]: { // replace the ID with the correct network ID (currently Arctic)
                ...GNOSIS_SAFE_ADDRESSES,
            }
        }

        const MultisigGNOSafe = await SafeFactory.create({ ethAdapter, contractNetworks });
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

    await factory.setFeeTo(FEE_RECIPIENT);
    await confirmTransactionCount();
    console.log("Set swap fee recipient.");

    await factory.setFeeToSetter(FEE_RECIPIENT);
    await confirmTransactionCount();
    console.log("Transferred EverestFactory ownership.");

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
