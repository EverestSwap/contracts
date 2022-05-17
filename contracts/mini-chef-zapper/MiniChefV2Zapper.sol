pragma solidity 0.8.11;

import "../everest-core/interfaces/IERC20.sol";
import "../everest-core/interfaces/IEverestPair.sol";
import "../everest-periphery/interfaces/IEverestRouter.sol";
import "../everest-periphery/interfaces/IWICZ.sol";

import "../everest-lib/libraries/Babylonian.sol";
import "../everest-lib/libraries/TransferHelper.sol";


// SPDX-License-Identifier: MIT

/// @author Wivern for Beefy.Finance
/// @author bmino for Everest
/// @notice This contract adds liquidity to Everest compatible liquidity pair pools and farms.


interface IMiniChefV2 {
    function lpToken(uint256 pid) external returns (address lpToken);
    function deposit(uint256 pid, uint256 amount, address to) external;
    function depositWithPermit(uint256 pid, uint256 amount, address to, uint deadline, uint8 v, bytes32 r, bytes32 s) external;
    function withdraw(uint256 pid, uint256 amount, address to) external;
    function harvest(uint256 pid, address to) external;
    function withdrawAndHarvest(uint256 pid, uint256 amount, address to) external;
}

contract MiniChefV2Zapper {

    IEverestRouter public immutable router;
    IMiniChefV2 public immutable miniChefV2;
    address public immutable WICZ;
    uint256 public constant minimumAmount = 1000;

    constructor(address _router, address _miniChefV2, address _WICZ) {
        // Safety checks to ensure WICZ token address
        IWICZ(_WICZ).deposit{value: 0}();
        IWICZ(_WICZ).withdraw(0);

        router = IEverestRouter(_router);
        miniChefV2 = IMiniChefV2(_miniChefV2);
        WICZ = _WICZ;
    }

    receive() external payable {
        assert(msg.sender == WICZ);
    }

    function zapInICZ(address pairAddress, uint256 tokenAmountOutMin) external payable {
        require(msg.value >= minimumAmount, 'Insignificant input amount');
        require(pairAddress != address(0), 'Invalid pair address');

        IWICZ(WICZ).deposit{value: msg.value}();

        _swapAndFarm(pairAddress, WICZ, tokenAmountOutMin, 0, false);
    }

    function zapInAndFarmICZ(address pairAddress, uint256 tokenAmountOutMin, uint256 pid) external payable {
        require(msg.value >= minimumAmount, 'Insignificant input amount');
        require(pairAddress != address(0), 'Invalid pair address');
        require(miniChefV2.lpToken(pid) == pairAddress, 'Pair address does not correspond with pid');

        IWICZ(WICZ).deposit{value: msg.value}();

        _swapAndFarm(pairAddress, WICZ, tokenAmountOutMin, pid, true);
    }

    function zapIn(address pairAddress, address tokenIn, uint256 tokenInAmount, uint256 tokenAmountOutMin) public {
        require(tokenInAmount >= minimumAmount, 'Insignificant input amount');
        require(pairAddress != address(0), 'Invalid pair address');

        TransferHelper.safeTransferFrom(tokenIn, msg.sender, address(this), tokenInAmount);

        _swapAndFarm(pairAddress, tokenIn, tokenAmountOutMin, 0, false);
    }

    function zapInViaPermit(
        address pairAddress,
        address tokenIn,
        uint256 tokenInAmount,
        uint256 tokenAmountOutMin,
        uint256 deadline,
        uint8 v, bytes32 r, bytes32 s
    ) external {
        IEverestPair(tokenIn).permit(msg.sender, address(this), tokenInAmount, deadline, v, r, s);
        zapIn(pairAddress, tokenIn, tokenInAmount, tokenAmountOutMin);
    }

    function zapInAndFarm(
        address pairAddress,
        address tokenIn,
        uint256 tokenInAmount,
        uint256 tokenAmountOutMin,
        uint256 pid
    ) public {
        require(tokenInAmount >= minimumAmount, 'Insignificant input amount');
        require(pairAddress != address(0), 'Invalid pair address');
        require(miniChefV2.lpToken(pid) == pairAddress, 'Pair address does not correspond with pid');

        TransferHelper.safeTransferFrom(tokenIn, msg.sender, address(this), tokenInAmount);

        _swapAndFarm(pairAddress, tokenIn, tokenAmountOutMin, pid, true);
    }

    function zapInAndFarmViaPermit(
        address pairAddress,
        address tokenIn,
        uint256 tokenInAmount,
        uint256 tokenAmountOutMin,
        uint256 pid,
        uint256 deadline,
        uint8 v, bytes32 r, bytes32 s
    ) external {
        IEverestPair(tokenIn).permit(msg.sender, address(this), tokenInAmount, deadline, v, r, s);
        zapInAndFarm(pairAddress, tokenIn, tokenInAmount, tokenAmountOutMin, pid);
    }

    function zapOutAndSwapICZ(
        address pairAddress,
        uint256 withdrawAmount,
        uint256 desiredICZOutMin,
        address to
    ) public {
        zapOutAndSwap(pairAddress, withdrawAmount, WICZ, desiredICZOutMin, address(this));

        uint256 balance = IERC20(WICZ).balanceOf(address(this));
        IWICZ(WICZ).withdraw(balance);

        TransferHelper.safeTransferICZ(to, balance);
    }

    function zapOutAndSwapICZViaPermit(
        address pairAddress,
        uint256 withdrawAmount,
        uint256 desiredICZOutMin,
        address to,
        uint256 deadline,
        uint8 v, bytes32 r, bytes32 s
    ) external {
        IEverestPair(pairAddress).permit(msg.sender, address(this), withdrawAmount, deadline, v, r, s);
        zapOutAndSwapICZ(pairAddress, withdrawAmount, desiredICZOutMin, to);
    }

    function zapOut(address pairAddress, uint256 withdrawAmount, address to) public {
        TransferHelper.safeTransferFrom(pairAddress, msg.sender, address(this), withdrawAmount);
        _removeLiquidity(pairAddress, to);
    }

    function zapOutViaPermit(
        address pairAddress,
        uint256 withdrawAmount,
        address to,
        uint256 deadline,
        uint8 v, bytes32 r, bytes32 s
    ) external {
        IEverestPair(pairAddress).permit(msg.sender, address(this), withdrawAmount, deadline, v, r, s);
        zapOut(pairAddress, withdrawAmount, to);
    }

    function zapOutAndSwap(
        address pairAddress,
        uint256 withdrawAmount,
        address desiredToken,
        uint256 desiredTokenOutMin,
        address to
    ) public {
        IEverestPair pair = IEverestPair(pairAddress);

        address token0 = pair.token0();
        address token1 = pair.token1();
        require(token0 == desiredToken || token1 == desiredToken, 'desired token not present in liquidity pair');

        TransferHelper.safeTransferFrom(pairAddress, msg.sender, address(this), withdrawAmount);

        _removeLiquidity(pairAddress, address(this));

        address swapToken = token1 == desiredToken ? token0 : token1;
        address[] memory path = new address[](2);
        path[0] = swapToken;
        path[1] = desiredToken;

        _approveTokenIfNeeded(path[0], address(router));
        router.swapExactTokensForTokens(
            IERC20(swapToken).balanceOf(address(this)),
            desiredTokenOutMin,
            path,
            address(this),
            block.timestamp
        );

        _returnAssets(path, to);
    }

    function zapOutAndSwapViaPermit(
        address pairAddress,
        uint256 withdrawAmount,
        address desiredToken,
        uint256 desiredTokenOutMin,
        address to,
        uint256 deadline,
        uint8 v, bytes32 r, bytes32 s
    ) external {
        IEverestPair(pairAddress).permit(msg.sender, address(this), withdrawAmount, deadline, v, r, s);
        zapOutAndSwap(pairAddress, withdrawAmount, desiredToken, desiredTokenOutMin, to);
    }

    function _removeLiquidity(address pair, address to) private {
        TransferHelper.safeTransfer(pair, pair, IERC20(pair).balanceOf(address(this)));
        (uint256 amount0, uint256 amount1) = IEverestPair(pair).burn(to);

        require(amount0 >= minimumAmount, 'EverestRouter: INSUFFICIENT_A_AMOUNT');
        require(amount1 >= minimumAmount, 'EverestRouter: INSUFFICIENT_B_AMOUNT');
    }

    function _swapAndFarm(
        address pairAddress,
        address tokenIn,
        uint256 tokenAmountOutMin,
        uint256 pid,
        bool farmFlag
    ) private {
        IEverestPair pair = IEverestPair(pairAddress);

        (uint256 reserve0, uint256 reserve1,) = pair.getReserves();
        require(reserve0 > minimumAmount && reserve1 > minimumAmount, 'Liquidity pair reserves too low');

        bool isInput0 = pair.token0() == tokenIn;
        require(isInput0 || pair.token1() == tokenIn, 'Input token not present in liquidity pair');

        address[] memory path = new address[](2);
        path[0] = tokenIn;
        path[1] = isInput0 ? pair.token1() : pair.token0();

        uint256 fullInvestment = IERC20(tokenIn).balanceOf(address(this));
        uint256 swapAmountIn;
        if (isInput0) {
            swapAmountIn = _getSwapAmount(fullInvestment, reserve0, reserve1);
        } else {
            swapAmountIn = _getSwapAmount(fullInvestment, reserve1, reserve0);
        }

        _approveTokenIfNeeded(path[0], address(router));
        uint256[] memory swappedAmounts = router.swapExactTokensForTokens(
            swapAmountIn,
            tokenAmountOutMin,
            path,
            address(this),
            block.timestamp
        );

        // Send liquidity receipt token directly to user when not depositing in a farm
        address liquidityTo = farmFlag == true ? address(this) : msg.sender;

        _approveTokenIfNeeded(path[1], address(router));
        (,, uint256 amountLiquidity) = router.addLiquidity(
            path[0],
            path[1],
            fullInvestment - swappedAmounts[0],
            swappedAmounts[1],
            1,
            1,
            liquidityTo,
            block.timestamp
        );

        if (farmFlag == true) {
            _approveTokenIfNeeded(pairAddress, address(miniChefV2));
            miniChefV2.deposit(pid, amountLiquidity, msg.sender);
        }

        // Return any dust
        _returnAssets(path, msg.sender);
    }

    function _returnAssets(address[] memory tokens, address to) private {
        uint256 balance;
        for (uint256 i; i < tokens.length; ++i) {
            balance = IERC20(tokens[i]).balanceOf(address(this));
            if (balance > 0) {
                TransferHelper.safeTransfer(tokens[i], to, balance);
            }
        }
    }

    function _getSwapAmount(
        uint256 investment,
        uint256 reserve0,
        uint256 reserve1
    ) private view returns (uint256 swapAmount) {
        uint256 halfInvestment = investment / 2;
        uint256 nominator = router.getAmountOut(halfInvestment, reserve0, reserve1);
        uint256 denominator = router.quote(halfInvestment, reserve0 + halfInvestment, reserve1 - nominator);
        swapAmount = investment - Babylonian.sqrt(halfInvestment * halfInvestment * nominator / denominator);
    }

    function estimateSwap(
        address pairAddress,
        address tokenIn,
        uint256 fullInvestmentIn
    ) external view returns(uint256 swapAmountIn, uint256 swapAmountOut, address swapTokenOut) {
        IEverestPair pair = IEverestPair(pairAddress);

        bool isInputA = pair.token0() == tokenIn;
        require(isInputA || pair.token1() == tokenIn, 'Input token not present in liquidity pair');

        (uint256 reserveA, uint256 reserveB,) = pair.getReserves();
        (reserveA, reserveB) = isInputA ? (reserveA, reserveB) : (reserveB, reserveA);

        swapAmountIn = _getSwapAmount(fullInvestmentIn, reserveA, reserveB);
        swapAmountOut = router.getAmountOut(swapAmountIn, reserveA, reserveB);
        swapTokenOut = isInputA ? pair.token1() : pair.token0();
    }

    function _approveTokenIfNeeded(address token, address spender) private {
        if (IERC20(token).allowance(address(this), spender) == 0) {
            TransferHelper.safeApprove(token, spender, type(uint256).max);
        }
    }

}
