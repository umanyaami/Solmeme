const axios = require('axios');

// Auto-configure thresholds
const MIN_LIQUIDITY = 2; // ETH
const MAX_AGE_MINUTES = 60; 
const MIN_HOLDERS = 50;
const MIN_SCORE = 20;

module.exports = async (req, res) => {
  try {
    // Fetch all coins from pump.fun
    const response = await axios.get('https://api.pump.fun/coins');
    const now = new Date();
    
    // Process and score all coins automatically
    const scoredCoins = response.data.map(coin => {
      const ageInMinutes = (now - new Date(coin.createdAt)) / (1000 * 60);
      const priceChange = ((coin.price - coin.initialPrice) / coin.initialPrice) * 100;
      const score = calculateScore(coin, ageInMinutes, priceChange);
      
      return {
        ...coin,
        ageInMinutes,
        priceChange,
        score,
        contractUrl: coin.contractAddress ? `https://etherscan.io/token/${coin.contractAddress}` : null
      };
    });

    // Auto-filter the best coins
    const bestCoins = scoredCoins
      .filter(coin => 
        coin.liquidity >= MIN_LIQUIDITY &&
        coin.ageInMinutes <= MAX_AGE_MINUTES &&
        coin.holders.length >= MIN_HOLDERS &&
        coin.score >= MIN_SCORE
      )
      .sort((a, b) => b.score - a.score)
      .slice(0, 50); // Show top 50 max

    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate');
    res.json({ 
      success: true, 
      data: bestCoins,
      config: {
        minLiquidity: MIN_LIQUIDITY,
        maxAge: MAX_AGE_MINUTES,
        minHolders: MIN_HOLDERS,
        minScore: MIN_SCORE
      }
    });

  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Auto-fetch failed. Trying again soon...',
      retryIn: 30
    });
  }
};

function calculateScore(coin, age, priceChange) {
  // Liquidity (0-30 points)
  const liquidityScore = Math.min(coin.liquidity * 3, 30);
  
  // Holders (0-25 points)
  const holdersScore = Math.min(coin.holders.length / 2, 25);
  
  // Age (newer = better, 0-20 points)
  const ageScore = (1 - Math.min(age / 120, 1)) * 20;
  
  // Price momentum (0-25 points)
  const momentumScore = Math.min(Math.abs(priceChange) / 2, 25);
  
  return Math.round(liquidityScore + holdersScore + ageScore + momentumScore);
}
