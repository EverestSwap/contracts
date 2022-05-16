const { OWNERS } = require('./shared')

exports.WRAPPED_NATIVE_TOKEN = "0xDbd5b8C9cF1e13d6eba4Cf05868F9dc20e093FE1";
exports.EVRS_SYMBOL = "EVRS";
exports.EVRS_NAME = "Everest";
exports.TOTAL_SUPPLY = 230000000; // 230M
exports.AIRDROP_AMOUNT = 11500000; // 11.5M or 5% of max supply
exports.TIMELOCK_DELAY = 3 * 24 * 60 * 60; // 3 days
exports.MULTISIG = {
  owners: OWNERS,
  threshold: 1 // multisig owners count
};
exports.USE_GNOSIS_SAFE = false;
exports.PROPOSAL_THRESHOLD = 100000; // 100K
exports.EVRS_STAKING_ALLOCATION = 500, // 5x weight in minichef
exports.WETH_EVRS_FARM_ALLOCATION = 3000, // 30x weight
exports.INITIAL_FARMS = [];
exports.VESTER_ALLOCATIONS = [
  {
    recipient: "treasury", // community treasury
    allocation: 2105, // 20%
  },
  {
    recipient: "multisig", // fEVRS team
    allocation: 1579, // 10% team + 5% vc investor
  },
  {
    recipient: "foundation", // EVRS Foundation multisig
    allocation: 263, // 2.5% advisory
  },
  {
    recipient: "chef", // MiniChef
    allocation: 6053, // 57.5% LPs & EVRS Staking
    isMiniChef: true
  }
];
exports.REVENUE_DISTRIBUTION = [
  {
    recipient: "foundation", // Everest Foundation
    allocation: 2000,        // 20%
  },
  {
    recipient: "multisig", // New team
    allocation: 8000,      // 80%
  }
]
