// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract DibsSwapVault {
    address public owner;
    IERC20 public dibsToken;
    uint256 public exchangeRate = 10; // 1 Native Token = 10 DIBS

    struct StakeInfo {
        uint256 amount;
        uint256 releaseTime;
        bool claimed;
    }

    mapping(address => StakeInfo[]) public userStakes;

    event AssetSwapped(address indexed user, string direction, uint256 amountIn, uint256 amountOut);
    event ExchangeRateUpdated(uint256 oldRate, uint256 newRate);
    event TokensStaked(address indexed user, uint256 amount, uint256 releaseTime);
    event TokensUnstaked(address indexed user, uint256 amount);

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

    // 1. Swap Native (USDC on Arc Testnet) -> DIBS
    function swapUsdcForDibs() external payable {
        require(msg.value > 0, "Must send USDC to swap");
        uint256 dibsAmount = msg.value * exchangeRate;

        require(dibsToken.balanceOf(address(this)) >= dibsAmount, "Vault is out of DIBS tokens");
        require(dibsToken.transfer(msg.sender, dibsAmount), "DIBS transfer failed");

        emit AssetSwapped(msg.sender, "USDC_TO_DIBS", msg.value, dibsAmount);
    }

    // 2. Swap DIBS -> Native (USDC on Arc Testnet)
    function swapDibsForUsdc(uint256 dibsAmount) external {
        require(dibsAmount > 0, "Must send DIBS to swap");
        uint256 usdcAmount = dibsAmount / exchangeRate;
        require(address(this).balance >= usdcAmount, "Vault lacks native USDC liquidity");

        require(dibsToken.transferFrom(msg.sender, address(this), dibsAmount), "DIBS transfer failed");
        
        (bool success, ) = payable(msg.sender).call{value: usdcAmount}("");
        require(success, "USDC transfer failed");

        emit AssetSwapped(msg.sender, "DIBS_TO_USDC", dibsAmount, usdcAmount);
    }

    // 3. Stake DIBS with variable time locks
    function stake(uint256 amount, uint256 lockDays) external {
        require(amount > 0, "Cannot stake 0 tokens");
        require(lockDays == 7 || lockDays == 30 || lockDays == 90 || lockDays == 180, "Invalid lock duration");

        require(dibsToken.transferFrom(msg.sender, address(this), amount), "DIBS deposit failed");

        uint256 releaseTime = block.timestamp + (lockDays * 1 days);
        userStakes[msg.sender].push(StakeInfo({
            amount: amount,
            releaseTime: releaseTime,
            claimed: false
        }));

        emit TokensStaked(msg.sender, amount, releaseTime);
    }

    // 4. Unstake DIBS after lock duration expires
    function unstake(uint256 stakeIndex) external {
        require(stakeIndex < userStakes[msg.sender].length, "Invalid stake index");
        StakeInfo storage userStake = userStakes[msg.sender][stakeIndex];
        
        require(!userStake.claimed, "Stake already claimed");
        require(block.timestamp >= userStake.releaseTime, "Tokens are still locked");

        userStake.claimed = true;
        uint256 amountToReturn = userStake.amount;

        require(dibsToken.transfer(msg.sender, amountToReturn), "DIBS return failed");

        emit TokensUnstaked(msg.sender, amountToReturn);
    }

    // Helper view function for frontend integration
    function getUserStakesCount(address user) external view returns (uint256) {
        return userStakes[user].length;
    }

    // Explicitly allow the contract to hold native currency for reverse swap liquidity
    receive() external payable {}
}
