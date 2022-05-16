const owners = [
  "0xd5Ca5E8fE68a8609ec91659C29eC31aCCfe3B0e1"
]

const maxGas = 4000000

const LOCALHOST = {
  id: 'localhost',
  chain_id: 2,
  name: 'ETH local',
  symbol: 'ETH',
  token_symbol: 'EVRS',
  mainnet: false,
  dex_is_live: false,
  tracked_by_debank: false,
  supported_by_gelato: false,
  rpc_uri: 'http://127.0.0.1:8545/',
  contracts: { // TODO: add contracts addresses
    token: '',
    factory: '',
    router: '',
    wrapped_native_token: '',
  },
  nativeCurrency:{
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  blockExplorerUrls: [],
}

const ICE_MAINNET = {
  id: 'ice_mainnet',
  chain_id: 550,
  name: 'ICE Network',
  symbol: 'ICY',
  token_symbol: 'EVRS',
  mainnet: true,
  dex_is_live: false,
  tracked_by_debank: false,
  supported_by_gelato: false,
  rpc_uri: 'https://ice-rpc.icenetwork.io',
  contracts: { // TODO: add contracts addresses
    token: '',
    factory: '',
    router: '',
    wrapped_native_token: '',
  },
  nativeCurrency:{
    name: 'ICE',
    symbol: 'ICY',
    decimals: 18,
  },
  blockExplorerUrls: [],
}

const ICE_FROST = {
  id: 'ice_frost',
  chain_id: 553,
  name: 'ICE Frost Testnet',
  symbol: 'ICY',
  token_symbol: 'EVRS',
  mainnet: false,
  dex_is_live: true,
  tracked_by_debank: false,
  supported_by_gelato: false,
  rpc_uri: 'https://frost-rpc.icenetwork.io:9933',
  contracts: {
    token: '',
    factory: '',
    router: '',
    wrapped_native_token: '',
  },
  nativeCurrency:{
    name: 'ICE',
    symbol: 'ICY',
    decimals: 18,
  },
  blockExplorerUrls: ['https://frost-blockscout.icenetwork.io'],
}

const ICE_ARCTIC = {
  id: 'ice_arctic',
  chain_id: 552,
  name: 'ICE Arctic Testnet',
  symbol: 'ICY',
  token_symbol: 'EVRS',
  mainnet: false,
  dex_is_live: true,
  tracked_by_debank: false,
  supported_by_gelato: false,
  rpc_uri: 'https://arctic-rpc.icenetwork.io:9933',
  contracts: { // TODO: add contracts addresses
    token: '',
    factory: '',
    router: '',
    wrapped_native_token: '',
  },
  nativeCurrency:{
    name: 'ICE',
    symbol: 'ICY',
    decimals: 18,
  },
  blockExplorerUrls: ['https://frost-blockscout.icenetwork.io'],
}

exports.FOUNDATION_MULTISIG = {
  owners: owners,
  threshold: 1
};

exports.CHAINS = [
  LOCALHOST,
  ICE_MAINNET,
  ICE_FROST,
  ICE_ARCTIC,
]

exports.OWNERS = [...owners];
exports.MAX_GAS = maxGas;