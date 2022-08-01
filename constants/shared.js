const owners = [
  "0x3915dC8c57eA4c0978C34ef64820dFeb3760CeF7"
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

const ICE_SNOW = {
  id: 'ice_snow',
  chain_id: 551,
  name: 'SNOW Network',
  symbol: 'ICZ',
  token_symbol: 'EVRS',
  mainnet: true,
  dex_is_live: false,
  tracked_by_debank: false,
  supported_by_gelato: false,
  rpc_uri: 'https://snow-rpc.icenetwork.io',
  contracts: { // TODO: add contracts addresses
    token: '',
    factory: '',
    router: '',
    wrapped_native_token: '',
  },
  nativeCurrency:{
    name: 'ICE',
    symbol: 'ICZ',
    decimals: 18,
  },
  blockExplorerUrls: [],
}

const ICE_ARCTIC = {
  id: 'ice_arctic',
  chain_id: 552,
  name: 'ICE Arctic Testnet',
  symbol: 'ICZ',
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
    symbol: 'ICZ',
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
  ICE_SNOW,
  ICE_ARCTIC,
]

exports.OWNERS = [...owners];
exports.MAX_GAS = maxGas;