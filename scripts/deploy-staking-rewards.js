const { ethers } = require('hardhat');

const { EVRS_ADDRESS, WICZ_ADDRESS } = require("./mainnet-constants");

async function main() {

    const [deployer] = await ethers.getSigners();

    console.log("Deploying contracts with the account:", deployer.address);

    const rewardsTokenAddress = ethers.utils.getAddress(WICZ_ADDRESS);
    const stakingTokenAddress = ethers.utils.getAddress(EVRS_ADDRESS);

    // Deploy StakingRewards
    const StakingRewards = await ethers.getContractFactory("StakingRewards");
    const stakingRewards = await StakingRewards.deploy(
      rewardsTokenAddress,
      stakingTokenAddress,
    );
    await stakingRewards.deployed();

    console.log("StakingRewards address: ", stakingRewards.address);
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
