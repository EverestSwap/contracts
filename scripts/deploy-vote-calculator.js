const { ethers } = require('hardhat');

const { EVRS_ADDRESS, MINICHEF_V2_ADDRESS } = require("./mainnet-constants");

async function main() {

    const [deployer] = await ethers.getSigners();

    console.log("Deploying contracts with the account:", deployer.address);

    const initBalance = await deployer.getBalance();
    console.log("Account balance:", initBalance.toString());

    const evrs = ethers.utils.getAddress(EVRS_ADDRESS);
    const miniChefV2 = ethers.utils.getAddress(MINICHEF_V2_ADDRESS);

    // Deploy EverestVoteCalculator
    const EverestVoteCalculator = await ethers.getContractFactory("EverestVoteCalculator");
    const everestVoteCalculator = await EverestVoteCalculator.deploy(
      evrs,
      miniChefV2,
    );
    await everestVoteCalculator.deployed();

    console.log("EverestVoteCalculator address: ", everestVoteCalculator.address);

    const endBalance = await deployer.getBalance();
    console.log("Deploy cost: ", initBalance.sub(endBalance).toString());
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
