
// Secure configuration for API access
export const apiConfig = {
  kalshiApi: {
    baseUrl: 'https://api.elections.kalshi.com/trade-api/v2',
    apiKey: '445a5c17-7d78-4869-8dcb-eedffa8b830c',
    timeout: 5000, // 5 seconds
    sampleLimit: 5  // Limit initial data fetch to 5 items
  }
};
