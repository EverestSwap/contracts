pragma solidity =0.5.16;

import '../EverestERC20.sol';

contract ERC20 is EverestERC20 {
    constructor(uint _totalSupply) public {
        _mint(msg.sender, _totalSupply);
    }
}
