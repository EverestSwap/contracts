const { ethers } = require("hardhat")

const FARMS = []
const MINICHEF_ADDRESS = "0x6A21eE0519a3614161A60CD59887A9392b8b9FC1"
const FACTORY_ADDRESS = "0x18FECf0be494D6ca90e302d08Fe4B5b6c51e5D4C"

async function main() {
    const [owner] = await ethers.getSigners()
    console.log(`\nAddress used: ${owner.address}`)

    const initBalance = await owner.getBalance()
    console.log(`Balance: ${ethers.utils.formatEther(initBalance)}\n`)

    const Chef = await ethers.getContractFactory('MiniChefV2')
    const chef = Chef.attach(MINICHEF_ADDRESS)

    const Factory = await ethers.getContractFactory('EverestFactory')
    const factory = Factory.attach(FACTORY_ADDRESS)

    if (FARMS.length > 0) {
        console.log(`\nAdding ${FARMS.length} new farms...`)

        for (let i = 0; i < FARMS.length; i++) {
            const tokenA = FARMS[i]["tokenA"]
            const tokenB = FARMS[i]["tokenB"]
            const weight = FARMS[i]["weight"]
    
            await factory.createPair(tokenA, tokenB)
            await confirmTransactionCount()
    
            const pair = await factory.getPair(tokenA, tokenB)
    
            await chef.addPool(
                weight,
                pair,
                ethers.constants.AddressZero,
                { gasLimit: MAX_GAS }
            )

            await confirmTransactionCount()
        }
    } else {
        console.log("No farms to add. Skipping...")
    }

    const pools = await chef.poolInfos()

    if (pools.length > 2) console.log("Added", (pools.length - 2).toString(), "more farms to MiniChefV2.")
    console.log(`\nMiniChefV2 has ${pools.length.toString()} farms.`)
    console.log(`\nFarm infos:`)

    console.log(pools)
    // for (let i = 0; i < pools.length; i++) {
    //     const pool = pools[i]
    //     const tokenA = pool.tokenA
    //     const tokenB = pool.tokenB
    //     const weight = pool.weight
    //     const pair = await factory.getPair(tokenA, tokenB)
    //     const pairAddress = pair.address
    //     const pairWeight = await chef.getPairWeight(pairAddress)
    //     console.log(`\nFarm ${i.toString()}: ${pair.address}\nweight: ${pairWeight.toString()}\ntokenA: ${tokenA}\ntokenB: ${tokenB}`)
    // }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    });