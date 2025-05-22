
// Secure configuration for API access
export const apiConfig = {
  kalshiApi: {
    baseUrl: 'https://api.elections.kalshi.com/trade-api/v2',
    apiKey: '445a5c17-7d78-4869-8dcb-eedffa8b830c',
    timeout: 10000, // Increased from 5000 to 10000 milliseconds (10s)
    sampleLimit: 10  // Increased from 5 to 10 items for more data
  }
};
