# Everest Smart Contracts
This repo contains all of the smart contracts used to run EverestSwap.

This code was originaly forked from [Pangolin](https://github.com/pangolindex/exchange-contracts)

## Deployed Contracts
Factory address: TBD

Router address: TBD

## Running
These contracts are compiled and deployed using [Hardhat](https://hardhat.org/). They can also be run using the Remix IDE. A tutorial for using Remix is located [here](https://docs.icenetwork.io/build/evm-and-solidity-smart-contracts/using-remix).

To prepare the dev environment, run `yarn install`. To compile the contracts, run `yarn compile`. Yarn is available to install [here](https://classic.yarnpkg.com/en/docs/install/#debian-stable) if you need it.

**Please note** Currently Hedera does not support Hardhat. There are instructions for Hedera under `contracts/hedera/readme.md`


## Accessing the ABI
If you need to use any of the contract ABIs, you can install this repo as an npm package with `npm install --dev @everestswap/contracts`. Then import the ABI like so: `import { abi as IEverestPairABI } from '@everestswap/contracts/artifacts/contracts/everest-core/interfaces/IEverestPair.sol/IEverestPair.json'`.

## Attribution
These contracts were adapted from these Uniswap repos: [uniswap-v2-core](https://github.com/Uniswap/uniswap-v2-core), [uniswap-v2-periphery](https://github.com/Uniswap/uniswap-v2-core), and [uniswap-lib](https://github.com/Uniswap/uniswap-lib).

# Deployment

To deploy to any chain you want, you need to complete the following steps:
- [ ] Copy `.env.example` to `.env` and add your private key there
- [ ] Create a new configuration under `constants/NETWORK_NAME.js`
- [ ] Run the following command
```bash
yarn deploy [--network NETWORK_NAME]
```
The deployment script will deploy all the contracts and set them up according to the configuration file.

## Configuration

The deployment scripts gets chain specific configuration from the respective file in `constants/`. You can copy an existing configuration such as `constants/fantom_mainnet.js` when creating a configuration file for another chain. The deployer must be familiar with the purpose of each constant.

## Contracts

### Airdrop

The deployment script transfers the amount specified in the config to the Airdrop contract. But the script does not manage the whitelisting. To handle airdrop, the multisig **must** call `setWhitelister()` function of `Airdrop` to appoint a trusted individual to whitelist airdrop recipients using a bot. After multisig ensures that whitelist is accurate, it **must** call `allowClaiming()` to begin the airdrop.

### Treasury Vester

The deployment script transfers all the EVRS (except what went to Airdrop) to `TreasuryVester`. After the deployment, the multisig **must** call `startVesting()` function of `TreasuryVester`. Then, a bot **must** be set up the ensure `distribute()` function of `TreasuryVester` is called every 24 hours. Vester allocation can only be changed through governance (timelock+multisig by default).

### EVRS Staking

The deployment script sets up `FeeCollector` to manage funding of the EVRS staking contract. A bot **must** be set up to call `harvest()` function of `FeeCollector` daily to divert MiniChef rewards to the EVRS staking contract. The bot would also track swap fees accumulated in `FeeCollector` and call the `harvest()` function accordingly to distribute the swap fees to the recipients.

### Revenue Distributor

Portion of swap fees accumulated in `FeeCollector` is sent to `RevenueDistributor`. This contract allows anyone to call its `distributeToken` function to allocate revenue to pre-determined recipients. In default configuration, these recipients are the new DAO with 80% allocation, and Everest Foundation DAO with 20% allocation. The allocation can be later changed by the joint agreement of both DAOs, using the `JointMultisig` contract. Any future ERC20 revenue of the DAO **must** also be transferred to the Revenue Distributor.

### Mini Chef

The deployment script adds minimum two farms to MiniChef, based on the constants `EVRS_STAKING_ALLOCATION`, `WETH_EVRS_FARM_ALLOCATION`, and `INITIAL_FARMS`. `INITIAL_FARMS` is optional and can be left as an empty array. Multisig can later add or remove farms without timelock or governance.