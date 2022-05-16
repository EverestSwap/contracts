pragma solidity >=0.5.0;

import "../../everest-core/interfaces/IEverestERC20.sol";

interface IBridgeToken is IEverestERC20 {
    function swap(address token, uint256 amount) external;
    function swapSupply(address token) external view returns (uint256);
}