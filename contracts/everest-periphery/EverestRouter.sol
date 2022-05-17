pragma solidity =0.6.6;

import '../everest-core/interfaces/IEverestFactory.sol';
import '../everest-lib/libraries/TransferHelper.sol';

import './interfaces/IEverestRouter.sol';
import './libraries/EverestLibrary.sol';
import './libraries/SafeMath.sol';
import './interfaces/IERC20.sol';
import './interfaces/IWICZ.sol';

contract EverestRouter is IEverestRouter {
    using SafeMath for uint;

    address public immutable override factory;
    address public immutable override WICZ;

    modifier ensure(uint deadline) {
        require(deadline >= block.timestamp, 'EverestRouter: EXPIRED');
        _;
    }

    constructor(address _factory, address _WICZ) public {
        factory = _factory;
        WICZ = _WICZ;
    }

    receive() external payable {
        assert(msg.sender == WICZ); // only accept ICZ via fallback from the WICZ contract
    }

    // **** ADD LIQUIDITY ****
    function _addLiquidity(
        address tokenA,
        address tokenB,
        uint amountADesired,
        uint amountBDesired,
        uint amountAMin,
        uint amountBMin
    ) internal virtual returns (uint amountA, uint amountB) {
        // create the pair if it doesn't exist yet
        if (IEverestFactory(factory).getPair(tokenA, tokenB) == address(0)) {
            IEverestFactory(factory).createPair(tokenA, tokenB);
        }
        (uint reserveA, uint reserveB) = EverestLibrary.getReserves(factory, tokenA, tokenB);
        if (reserveA == 0 && reserveB == 0) {
            (amountA, amountB) = (amountADesired, amountBDesired);
        } else {
            uint amountBOptimal = EverestLibrary.quote(amountADesired, reserveA, reserveB);
            if (amountBOptimal <= amountBDesired) {
                require(amountBOptimal >= amountBMin, 'EverestRouter: INSUFFICIENT_B_AMOUNT');
                (amountA, amountB) = (amountADesired, amountBOptimal);
            } else {
                uint amountAOptimal = EverestLibrary.quote(amountBDesired, reserveB, reserveA);
                assert(amountAOptimal <= amountADesired);
                require(amountAOptimal >= amountAMin, 'EverestRouter: INSUFFICIENT_A_AMOUNT');
                (amountA, amountB) = (amountAOptimal, amountBDesired);
            }
        }
    }
    function addLiquidity(
        address tokenA,
        address tokenB,
        uint amountADesired,
        uint amountBDesired,
        uint amountAMin,
        uint amountBMin,
        address to,
        uint deadline
    ) external virtual override ensure(deadline) returns (uint amountA, uint amountB, uint liquidity) {
        (amountA, amountB) = _addLiquidity(tokenA, tokenB, amountADesired, amountBDesired, amountAMin, amountBMin);
        address pair = EverestLibrary.pairFor(factory, tokenA, tokenB);
        TransferHelper.safeTransferFrom(tokenA, msg.sender, pair, amountA);
        TransferHelper.safeTransferFrom(tokenB, msg.sender, pair, amountB);
        liquidity = IEverestPair(pair).mint(to);
    }
    function addLiquidityICZ(
        address token,
        uint amountTokenDesired,
        uint amountTokenMin,
        uint amountICZMin,
        address to,
        uint deadline
    ) external virtual override payable ensure(deadline) returns (uint amountToken, uint amountICZ, uint liquidity) {
        (amountToken, amountICZ) = _addLiquidity(
            token,
            WICZ,
            amountTokenDesired,
            msg.value,
            amountTokenMin,
            amountICZMin
        );
        address pair = EverestLibrary.pairFor(factory, token, WICZ);
        TransferHelper.safeTransferFrom(token, msg.sender, pair, amountToken);
        IWICZ(WICZ).deposit{value: amountICZ}();
        assert(IWICZ(WICZ).transfer(pair, amountICZ));
        liquidity = IEverestPair(pair).mint(to);
        // refund dust ICZ, if any
        if (msg.value > amountICZ) TransferHelper.safeTransferICZ(msg.sender, msg.value - amountICZ);
    }

    // **** REMOVE LIQUIDITY ****
    function removeLiquidity(
        address tokenA,
        address tokenB,
        uint liquidity,
        uint amountAMin,
        uint amountBMin,
        address to,
        uint deadline
    ) public virtual override ensure(deadline) returns (uint amountA, uint amountB) {
        address pair = EverestLibrary.pairFor(factory, tokenA, tokenB);
        IEverestPair(pair).transferFrom(msg.sender, pair, liquidity); // send liquidity to pair
        (uint amount0, uint amount1) = IEverestPair(pair).burn(to);
        (address token0,) = EverestLibrary.sortTokens(tokenA, tokenB);
        (amountA, amountB) = tokenA == token0 ? (amount0, amount1) : (amount1, amount0);
        require(amountA >= amountAMin, 'EverestRouter: INSUFFICIENT_A_AMOUNT');
        require(amountB >= amountBMin, 'EverestRouter: INSUFFICIENT_B_AMOUNT');
    }
    function removeLiquidityICZ(
        address token,
        uint liquidity,
        uint amountTokenMin,
        uint amountICZMin,
        address to,
        uint deadline
    ) public virtual override ensure(deadline) returns (uint amountToken, uint amountICZ) {
        (amountToken, amountICZ) = removeLiquidity(
            token,
            WICZ,
            liquidity,
            amountTokenMin,
            amountICZMin,
            address(this),
            deadline
        );
        TransferHelper.safeTransfer(token, to, amountToken);
        IWICZ(WICZ).withdraw(amountICZ);
        TransferHelper.safeTransferICZ(to, amountICZ);
    }
    function removeLiquidityWithPermit(
        address tokenA,
        address tokenB,
        uint liquidity,
        uint amountAMin,
        uint amountBMin,
        address to,
        uint deadline,
        bool approveMax, uint8 v, bytes32 r, bytes32 s
    ) external virtual override returns (uint amountA, uint amountB) {
        address pair = EverestLibrary.pairFor(factory, tokenA, tokenB);
        uint value = approveMax ? uint(-1) : liquidity;
        IEverestPair(pair).permit(msg.sender, address(this), value, deadline, v, r, s);
        (amountA, amountB) = removeLiquidity(tokenA, tokenB, liquidity, amountAMin, amountBMin, to, deadline);
    }
    function removeLiquidityICZWithPermit(
        address token,
        uint liquidity,
        uint amountTokenMin,
        uint amountICZMin,
        address to,
        uint deadline,
        bool approveMax, uint8 v, bytes32 r, bytes32 s
    ) external virtual override returns (uint amountToken, uint amountICZ) {
        address pair = EverestLibrary.pairFor(factory, token, WICZ);
        uint value = approveMax ? uint(-1) : liquidity;
        IEverestPair(pair).permit(msg.sender, address(this), value, deadline, v, r, s);
        (amountToken, amountICZ) = removeLiquidityICZ(token, liquidity, amountTokenMin, amountICZMin, to, deadline);
    }

    // **** REMOVE LIQUIDITY (supporting fee-on-transfer tokens) ****
    function removeLiquidityICZSupportingFeeOnTransferTokens(
        address token,
        uint liquidity,
        uint amountTokenMin,
        uint amountICZMin,
        address to,
        uint deadline
    ) public virtual override ensure(deadline) returns (uint amountICZ) {
        (, amountICZ) = removeLiquidity(
            token,
            WICZ,
            liquidity,
            amountTokenMin,
            amountICZMin,
            address(this),
            deadline
        );
        TransferHelper.safeTransfer(token, to, IERC20(token).balanceOf(address(this)));
        IWICZ(WICZ).withdraw(amountICZ);
        TransferHelper.safeTransferICZ(to, amountICZ);
    }
    function removeLiquidityICZWithPermitSupportingFeeOnTransferTokens(
        address token,
        uint liquidity,
        uint amountTokenMin,
        uint amountICZMin,
        address to,
        uint deadline,
        bool approveMax, uint8 v, bytes32 r, bytes32 s
    ) external virtual override returns (uint amountICZ) {
        address pair = EverestLibrary.pairFor(factory, token, WICZ);
        uint value = approveMax ? uint(-1) : liquidity;
        IEverestPair(pair).permit(msg.sender, address(this), value, deadline, v, r, s);
        amountICZ = removeLiquidityICZSupportingFeeOnTransferTokens(
            token, liquidity, amountTokenMin, amountICZMin, to, deadline
        );
    }

    // **** SWAP ****
    // requires the initial amount to have already been sent to the first pair
    function _swap(uint[] memory amounts, address[] memory path, address _to) internal virtual {
        for (uint i; i < path.length - 1; i++) {
            (address input, address output) = (path[i], path[i + 1]);
            (address token0,) = EverestLibrary.sortTokens(input, output);
            uint amountOut = amounts[i + 1];
            (uint amount0Out, uint amount1Out) = input == token0 ? (uint(0), amountOut) : (amountOut, uint(0));
            address to = i < path.length - 2 ? EverestLibrary.pairFor(factory, output, path[i + 2]) : _to;
            IEverestPair(EverestLibrary.pairFor(factory, input, output)).swap(
                amount0Out, amount1Out, to, new bytes(0)
            );
        }
    }
    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external virtual override ensure(deadline) returns (uint[] memory amounts) {
        amounts = EverestLibrary.getAmountsOut(factory, amountIn, path);
        require(amounts[amounts.length - 1] >= amountOutMin, 'EverestRouter: INSUFFICIENT_OUTPUT_AMOUNT');
        TransferHelper.safeTransferFrom(
            path[0], msg.sender, EverestLibrary.pairFor(factory, path[0], path[1]), amounts[0]
        );
        _swap(amounts, path, to);
    }
    function swapTokensForExactTokens(
        uint amountOut,
        uint amountInMax,
        address[] calldata path,
        address to,
        uint deadline
    ) external virtual override ensure(deadline) returns (uint[] memory amounts) {
        amounts = EverestLibrary.getAmountsIn(factory, amountOut, path);
        require(amounts[0] <= amountInMax, 'EverestRouter: EXCESSIVE_INPUT_AMOUNT');
        TransferHelper.safeTransferFrom(
            path[0], msg.sender, EverestLibrary.pairFor(factory, path[0], path[1]), amounts[0]
        );
        _swap(amounts, path, to);
    }
    function swapExactICZForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline)
        external
        virtual
        override
        payable
        ensure(deadline)
        returns (uint[] memory amounts)
    {
        require(path[0] == WICZ, 'EverestRouter: INVALID_PATH');
        amounts = EverestLibrary.getAmountsOut(factory, msg.value, path);
        require(amounts[amounts.length - 1] >= amountOutMin, 'EverestRouter: INSUFFICIENT_OUTPUT_AMOUNT');
        IWICZ(WICZ).deposit{value: amounts[0]}();
        assert(IWICZ(WICZ).transfer(EverestLibrary.pairFor(factory, path[0], path[1]), amounts[0]));
        _swap(amounts, path, to);
    }
    function swapTokensForExactICZ(uint amountOut, uint amountInMax, address[] calldata path, address to, uint deadline)
        external
        virtual
        override
        ensure(deadline)
        returns (uint[] memory amounts)
    {
        require(path[path.length - 1] == WICZ, 'EverestRouter: INVALID_PATH');
        amounts = EverestLibrary.getAmountsIn(factory, amountOut, path);
        require(amounts[0] <= amountInMax, 'EverestRouter: EXCESSIVE_INPUT_AMOUNT');
        TransferHelper.safeTransferFrom(
            path[0], msg.sender, EverestLibrary.pairFor(factory, path[0], path[1]), amounts[0]
        );
        _swap(amounts, path, address(this));
        IWICZ(WICZ).withdraw(amounts[amounts.length - 1]);
        TransferHelper.safeTransferICZ(to, amounts[amounts.length - 1]);
    }
    function swapExactTokensForICZ(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline)
        external
        virtual
        override
        ensure(deadline)
        returns (uint[] memory amounts)
    {
        require(path[path.length - 1] == WICZ, 'EverestRouter: INVALID_PATH');
        amounts = EverestLibrary.getAmountsOut(factory, amountIn, path);
        require(amounts[amounts.length - 1] >= amountOutMin, 'EverestRouter: INSUFFICIENT_OUTPUT_AMOUNT');
        TransferHelper.safeTransferFrom(
            path[0], msg.sender, EverestLibrary.pairFor(factory, path[0], path[1]), amounts[0]
        );
        _swap(amounts, path, address(this));
        IWICZ(WICZ).withdraw(amounts[amounts.length - 1]);
        TransferHelper.safeTransferICZ(to, amounts[amounts.length - 1]);
    }
    function swapICZForExactTokens(uint amountOut, address[] calldata path, address to, uint deadline)
        external
        virtual
        override
        payable
        ensure(deadline)
        returns (uint[] memory amounts)
    {
        require(path[0] == WICZ, 'EverestRouter: INVALID_PATH');
        amounts = EverestLibrary.getAmountsIn(factory, amountOut, path);
        require(amounts[0] <= msg.value, 'EverestRouter: EXCESSIVE_INPUT_AMOUNT');
        IWICZ(WICZ).deposit{value: amounts[0]}();
        assert(IWICZ(WICZ).transfer(EverestLibrary.pairFor(factory, path[0], path[1]), amounts[0]));
        _swap(amounts, path, to);
        // refund dust ICZ, if any
        if (msg.value > amounts[0]) TransferHelper.safeTransferICZ(msg.sender, msg.value - amounts[0]);
    }

    // **** SWAP (supporting fee-on-transfer tokens) ****
    // requires the initial amount to have already been sent to the first pair
    function _swapSupportingFeeOnTransferTokens(address[] memory path, address _to) internal virtual {
        for (uint i; i < path.length - 1; i++) {
            (address input, address output) = (path[i], path[i + 1]);
            (address token0,) = EverestLibrary.sortTokens(input, output);
            IEverestPair pair = IEverestPair(EverestLibrary.pairFor(factory, input, output));
            uint amountInput;
            uint amountOutput;
            { // scope to avoid stack too deep errors
            (uint reserve0, uint reserve1,) = pair.getReserves();
            (uint reserveInput, uint reserveOutput) = input == token0 ? (reserve0, reserve1) : (reserve1, reserve0);
            amountInput = IERC20(input).balanceOf(address(pair)).sub(reserveInput);
            amountOutput = EverestLibrary.getAmountOut(amountInput, reserveInput, reserveOutput);
            }
            (uint amount0Out, uint amount1Out) = input == token0 ? (uint(0), amountOutput) : (amountOutput, uint(0));
            address to = i < path.length - 2 ? EverestLibrary.pairFor(factory, output, path[i + 2]) : _to;
            pair.swap(amount0Out, amount1Out, to, new bytes(0));
        }
    }
    function swapExactTokensForTokensSupportingFeeOnTransferTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external virtual override ensure(deadline) {
        TransferHelper.safeTransferFrom(
            path[0], msg.sender, EverestLibrary.pairFor(factory, path[0], path[1]), amountIn
        );
        uint balanceBefore = IERC20(path[path.length - 1]).balanceOf(to);
        _swapSupportingFeeOnTransferTokens(path, to);
        require(
            IERC20(path[path.length - 1]).balanceOf(to).sub(balanceBefore) >= amountOutMin,
            'EverestRouter: INSUFFICIENT_OUTPUT_AMOUNT'
        );
    }
    function swapExactICZForTokensSupportingFeeOnTransferTokens(
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    )
        external
        virtual
        override
        payable
        ensure(deadline)
    {
        require(path[0] == WICZ, 'EverestRouter: INVALID_PATH');
        uint amountIn = msg.value;
        IWICZ(WICZ).deposit{value: amountIn}();
        assert(IWICZ(WICZ).transfer(EverestLibrary.pairFor(factory, path[0], path[1]), amountIn));
        uint balanceBefore = IERC20(path[path.length - 1]).balanceOf(to);
        _swapSupportingFeeOnTransferTokens(path, to);
        require(
            IERC20(path[path.length - 1]).balanceOf(to).sub(balanceBefore) >= amountOutMin,
            'EverestRouter: INSUFFICIENT_OUTPUT_AMOUNT'
        );
    }
    function swapExactTokensForICZSupportingFeeOnTransferTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    )
        external
        virtual
        override
        ensure(deadline)
    {
        require(path[path.length - 1] == WICZ, 'EverestRouter: INVALID_PATH');
        TransferHelper.safeTransferFrom(
            path[0], msg.sender, EverestLibrary.pairFor(factory, path[0], path[1]), amountIn
        );
        _swapSupportingFeeOnTransferTokens(path, address(this));
        uint amountOut = IERC20(WICZ).balanceOf(address(this));
        require(amountOut >= amountOutMin, 'EverestRouter: INSUFFICIENT_OUTPUT_AMOUNT');
        IWICZ(WICZ).withdraw(amountOut);
        TransferHelper.safeTransferICZ(to, amountOut);
    }

    // **** LIBRARY FUNCTIONS ****
    function quote(uint amountA, uint reserveA, uint reserveB) public pure virtual override returns (uint amountB) {
        return EverestLibrary.quote(amountA, reserveA, reserveB);
    }

    function getAmountOut(uint amountIn, uint reserveIn, uint reserveOut)
        public
        pure
        virtual
        override
        returns (uint amountOut)
    {
        return EverestLibrary.getAmountOut(amountIn, reserveIn, reserveOut);
    }

    function getAmountIn(uint amountOut, uint reserveIn, uint reserveOut)
        public
        pure
        virtual
        override
        returns (uint amountIn)
    {
        return EverestLibrary.getAmountIn(amountOut, reserveIn, reserveOut);
    }

    function getAmountsOut(uint amountIn, address[] memory path)
        public
        view
        virtual
        override
        returns (uint[] memory amounts)
    {
        return EverestLibrary.getAmountsOut(factory, amountIn, path);
    }

    function getAmountsIn(uint amountOut, address[] memory path)
        public
        view
        virtual
        override
        returns (uint[] memory amounts)
    {
        return EverestLibrary.getAmountsIn(factory, amountOut, path);
    }
}
