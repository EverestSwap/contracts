const { ethers, network } = require('hardhat');

const {
    EVEREST_GNOSIS_SAFE,
    MINICHEF_V2_ADDRESS,
    EVRS_ADDRESS,
} = require("./mainnet-constants");

const USDTe_ADDRESS = "0xc7198437980c041c805a1edcba50c1ce5db95118"; // TODO: replace with ICE's USDT address

// TODO: addapt when farms deployed
async function main() {

    const [deployer, user1] = await ethers.getSigners();

    await network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [EVEREST_GNOSIS_SAFE]
    });

    const multisigSigner = await ethers.provider.getSigner(EVEREST_GNOSIS_SAFE);

    // Ensure multisig has ICY to pay for gas
    await user1.sendTransaction({
        to: multisigSigner._address,
        value: ethers.utils.parseEther('1000.0')
    });

    const EVRS = await ethers.getContractFactory("Evrs");
    const evrs = await EVRS.attach(EVRS_ADDRESS);

    const USDTe = await ethers.getContractFactory("Evrs");
    const usdte = await USDTe.attach(USDTe_ADDRESS);

    const RewarderViaMultiplier = await ethers.getContractFactory("RewarderViaMultiplier");

    console.log("Deploying contracts with the account:", deployer.address);
    console.log();

    const MiniChef = await ethers.getContractFactory("MiniChefV2");
    const miniChef = await MiniChef.attach(MINICHEF_V2_ADDRESS);

    // Deploy Rewarder (EVRS rewards @ 2x)
    console.log(`Deploying single rewarder ...`);
    const rewarderViaMultiplier1 = await RewarderViaMultiplier.deploy(
        [EVRS_ADDRESS], // LOOT
        ["2" + "0".repeat(18)], // 2x @ 18 decimals
        18,
        miniChef.address
    );
    await rewarderViaMultiplier1.deployed();
    console.log(`Deployed single rewarder:`, rewarderViaMultiplier1.address);
    console.log();

    // Fund EVRS rewarder
    console.log(`Funding single rewarder ...`);
    await evrs.connect(multisigSigner).transfer(
        rewarderViaMultiplier1.address,
        "40000" + "0".repeat(18),
    );
    console.log(`Funded single rewarder`);
    console.log();


    // Deploy double rewarder (EVRS @ 1.5x and USDT.e @ 1x)
    console.log(`Deploying double rewarder ...`);
    const rewarderViaMultiplier2 = await RewarderViaMultiplier.deploy(
        [EVRS_ADDRESS, USDTe_ADDRESS],
        ["15" + "0".repeat(17), "1" + "0".repeat(6)],
        18,
        miniChef.address
    );
    await rewarderViaMultiplier2.deployed();
    console.log(`Deployed double rewarder:`, rewarderViaMultiplier2.address);
    console.log();

    // Fund double rewarder (EVRS and USDT.e)
    console.log(`Funding double Rewarder ...`);
    await evrs.connect(multisigSigner).transfer(
        rewarderViaMultiplier2.address,
        "50000" + "0".repeat(18),
    );
    await usdte.connect(multisigSigner).transfer(
        rewarderViaMultiplier2.address,
        "25000" + "0".repeat(6),
    );
    console.log(`Funded double rewarder`);
    console.log();

    console.log(`Adding LOOT-WICY and ISA-WICY farms`);
    await miniChef.connect(multisigSigner).addPools(
        ["300", "300"], // _allocPoints
        ["0x1bfae75b28925bf4a5bf830c141ea29cb0a868f1", "0xfba30990f79e1df3842bb8ac3d86b2454a760151"], // _lpTokens
        [rewarderViaMultiplier1.address, rewarderViaMultiplier2.address] // _rewarders
    );

    console.log('Done');
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
