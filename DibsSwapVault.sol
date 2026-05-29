// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract DibsSwapVault {
    address public owner;
    IERC20 public dibsToken;
    uint256 public exchangeRate = 10; 

    event AssetSwapped(address indexed user, uint256 usdcSpent, uint256 dibsReceived);
    event ExchangeRateUpdated(uint256 oldRate, uint256 newRate);

    constructor(address _dibsToken) {
        owner = msg.sender;
        dibsToken = IERC20(_dibsToken);
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only the Terminal Owner can call this");
        _;
    }

    function setExchangeRate(uint256 _newRate) external onlyOwner {
        require(_newRate > 0, "Rate must be greater than zero");
        emit ExchangeRateUpdated(exchangeRate, _newRate);
        exchangeRate = _newRate;
    }

    function swapUsdcForDibs() external payable {
        require(msg.value > 0, "Must send USDC to swap");
        uint256 dibsAmount = msg.value * exchangeRate;
        
        require(dibsToken.balanceOf(address(this)) >= dibsAmount, "Vault is out of DIBS tokens");
        require(dibsToken.transfer(msg.sender, dibsAmount), "DIBS transfer failed");

        emit AssetSwapped(msg.sender, msg.value, dibsAmount);
    }

    function withdraw(address tokenAddress) external onlyOwner {
        if (tokenAddress == address(0)) {
            payable(owner).transfer(address(this).balance);
        } else {
            IERC20(tokenAddress).transfer(owner, IERC20(tokenAddress).balanceOf(address(this)));
        }
    }

    receive() external payable {}
}
