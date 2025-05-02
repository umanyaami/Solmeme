const axios = require('axios');

module.exports = async (req, res) => {
  try {
    // Fetch data from pump.fun API
    const response = await axios.get('https://api.pump.fun/coins');
    let coins = response.data;

    // Process and filter coins
    coins = coins.map(coin => {
      const ageInMinutes = (new Date() - new Date(coin.createdAt)) / (1000 * 60);
      const priceChange = ((coin.price - coin.initialPrice) / coin.initialPrice) * 100;
      const score = calculateScore(coin, ageInMinutes, priceChange);
      
      return {
        ...coin,
        ageInMinutes,
        priceChange,
        score,
        contractUrl: `https://etherscan.io/token/${coin.contractAddress}`
      };
    });

    // Filter only good coins (adjust thresholds as needed)
    const filteredCoins = coins
      .filter(coin => coin.score >= 15 && coin.liquidity >= 1)
      .sort((a, b) => b.score - a.score);

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
    res.json({ success: true, data: filteredCoins });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch coins' });
  }
};

function calculateScore(coin, ageInMinutes, priceChange) {
  let score = 0;
  
  // Liquidity (max 30 points)
  score += Math.min(coin.liquidity * 3, 30);
  
  // Holders (max 25 points)
  score += Math.min(coin.holders.length / 4, 25);
  
  // Age (newer is better, max 20 points)
  score += (1 - Math.min(ageInMinutes / 120, 1)) * 20;
  
  // Price change (max 25 points)
  score += Math.min(Math.abs(priceChange) / 2, 25);
  
  return Math.round(score);
}
