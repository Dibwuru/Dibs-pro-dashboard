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

    struct UserStake {
        uint256 amount;
        uint256 releaseTime;
        uint256 apyRate;
        uint256 lockDays;
        bool claimed;
    }

    mapping(address => UserStake[]) public userStakes;

    event AssetSwapped(address indexed user, string direction, uint256 amountIn, uint256 amountOut);
    event ExchangeRateUpdated(uint256 oldRate, uint256 newRate);
    event TokensStaked(address indexed user, uint256 amount, uint256 releaseTime, uint256 apyRate, uint256 lockDays);
    event TokensUnstaked(address indexed user, uint256 amount, uint256 reward);

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

    // 3. Stake DIBS with variable time locks and APY rewards
    function stake(uint256 amount, uint256 lockDays) external {
        require(amount > 0, "Cannot stake 0 tokens");
        require(lockDays == 7 || lockDays == 30 || lockDays == 90 || lockDays == 180, "Invalid lock duration");

        require(dibsToken.transferFrom(msg.sender, address(this), amount), "DIBS deposit failed");

        // Determine APY rate (in basis points) based on lock duration
        // 7 days -> 8.5% (850 bps), 30 days -> 12.5% (1250 bps)
        // 90 days -> 18.0% (1800 bps), 180 days -> 24.0% (2400 bps)
        uint256 apyRate;
        if (lockDays == 7) {
            apyRate = 850;
        } else if (lockDays == 30) {
            apyRate = 1250;
        } else if (lockDays == 90) {
            apyRate = 1800;
        } else {
            // lockDays == 180
            apyRate = 2400;
        }

        uint256 releaseTime = block.timestamp + (lockDays * 1 days);
        userStakes[msg.sender].push(UserStake({
            amount: amount,
            releaseTime: releaseTime,
            apyRate: apyRate,
            lockDays: lockDays,
            claimed: false
        }));

        emit TokensStaked(msg.sender, amount, releaseTime, apyRate, lockDays);
    }

    // 4. Unstake DIBS after lock duration expires — with reward payout
    function unstake(uint256 stakeIndex) external {
        require(stakeIndex < userStakes[msg.sender].length, "Invalid stake index");
        UserStake storage s = userStakes[msg.sender][stakeIndex];

        // RE-ENTRANCY & DOUBLE-CLAIM GUARD: enforce claim flag before any transfers
        require(!s.claimed, "Already claimed");

        // TIME-GATE LOCK: enforce maturity before release
        require(block.timestamp >= s.releaseTime, "Lock period has not expired yet");

        // STATE FLIP FIRST — mark claimed BEFORE any external calls (checks-effects-interactions)
        s.claimed = true;

        // Calculate rewards capped at maturity
        // Formula: reward = (amount * apyRate * lockDays) / (365 * 100)
        // apyRate is in basis points (e.g. 850 = 8.5%), 365 days, 100 for percentage
        uint256 reward = (s.amount * s.apyRate * s.lockDays) / (365 * 100);
        uint256 totalPayout = s.amount + reward;

        require(dibsToken.transfer(msg.sender, totalPayout), "DIBS payout failed");

        emit TokensUnstaked(msg.sender, s.amount, reward);
    }

    // Helper view function for frontend integration
    function getUserStakesCount(address user) external view returns (uint256) {
        return userStakes[user].length;
    }

    // Explicitly allow the contract to hold native currency for reverse swap liquidity
    receive() external payable {}
}
