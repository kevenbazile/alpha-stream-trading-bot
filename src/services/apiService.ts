
import { Trade } from "../types/trading";
import { apiConfig } from "../utils/apiConfig";

// New interface to match Kalshi API response structure
interface KalshiContract {
  ticker: string;
  price: number;
  volume?: number;
  open_interest?: number;
}

interface KalshiMarket {
  id: string;
  ticker: string;
  title: string;
  contracts: KalshiContract[];
  volume24h?: number;
  open_interest?: number;
}

interface KalshiEvent {
  id: string;
  ticker: string;
  title: string;
  markets: KalshiMarket[];
}

interface KalshiResponse {
  events: KalshiEvent[];
}

// Main function to fetch Kalshi data
export async function fetchKalshiData() {
  const { baseUrl, apiKey, timeout, sampleLimit } = apiConfig.kalshiApi;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    console.log('Connecting to Kalshi Elections API...');
    
    // Add limit query parameter to only fetch a sample of data
    const response = await fetch(`${baseUrl}/events?limit=${sampleLimit}`, {
      headers: {
        'accept': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      signal: controller.signal,
      method: 'GET'
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.error('API returned error status:', response.status);
      throw new Error(`API returned ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json() as KalshiResponse;
    console.log('Successfully connected to Kalshi API:', data);
    
    // Check if we have events data
    if (!data.events || data.events.length === 0) {
      throw new Error('No events data found in Kalshi API response');
    }
    
    console.log(`Found ${data.events.length} events with market data`);
    
    // Transform Kalshi data into the format our app expects
    return transformKalshiData(data);
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      console.error('API connection timed out after', timeout, 'ms');
      throw new Error(`API connection timed out after ${timeout}ms`);
    } else {
      console.error('Kalshi API error:', error.message);
      throw error;
    }
  }
}

// Transform Kalshi data into our application's structure
function transformKalshiData(data: KalshiResponse) {
  const opportunities = [];
  const trades = [];
  
  // Process each event and its markets
  data.events.forEach(event => {
    event.markets.forEach(market => {
      // Only add markets with at least YES and NO contracts
      if (market.contracts && market.contracts.length >= 2) {
        // Find YES and NO contracts
        const yesContract = market.contracts.find(c => c.ticker.endsWith('YES'));
        const noContract = market.contracts.find(c => c.ticker.endsWith('NO'));
        
        if (yesContract && noContract) {
          // Determine if this is a potential opportunity
          const yesPrice = yesContract.price;
          const noPrice = noContract.price;
          
          // Simple opportunity detection: any market with YES price > 0.6 is a BUY
          // This is a placeholder - your actual strategy may be more complex
          const isOpportunity = yesPrice > 0.6;
          const action = isOpportunity ? "BUY" : "WAIT";
          const confidence = isOpportunity ? yesPrice : (1 - yesPrice);
          
          // Calculate potential profit (simplified)
          const potentialProfit = isOpportunity ? 
            ((1 - yesPrice) / yesPrice) * 100 : 
            ((1 - noPrice) / noPrice) * 100;
          
          // Add to opportunities
          opportunities.push({
            marketTicker: market.ticker,
            marketTitle: market.title,
            yesPrice: yesPrice, 
            noPrice: noPrice,
            volume: market.volume24h || yesContract.volume || 0,
            openInterest: market.open_interest || yesContract.open_interest || 0,
            action: action,
            confidence: confidence
          });
          
          // For demo purposes, create a historical trade for the first market
          // In a real app, you would track actual trades made by the user
          if (opportunities.length === 1) {
            const now = new Date();
            const yesterday = new Date(now);
            yesterday.setDate(now.getDate() - 1);
            
            // Mock a BUY trade from yesterday
            trades.push({
              timestamp: yesterday.toISOString().replace('T', ' ').substring(0, 19),
              symbol: market.ticker,
              action: "BUY",
              price: yesPrice,
              shares: 0.5,
              pnl: 0,
              strategy: "sentiment",
              cashRemaining: 100 - (yesPrice * 0.5 * 100)
            });
            
            // Mock a SELL trade from today with some profit
            const profitPrice = yesPrice * 1.05; // 5% profit
            const profit = (profitPrice - yesPrice) * 0.5 * 100;
            
            trades.push({
              timestamp: now.toISOString().replace('T', ' ').substring(0, 19),
              symbol: market.ticker,
              action: "SELL (take_profit)",
              price: profitPrice,
              shares: 0.5,
              pnl: profit,
              strategy: "sentiment",
              cashRemaining: (100 - (yesPrice * 0.5 * 100)) + (profitPrice * 0.5 * 100)
            });
          }
        }
      }
    });
  });
  
  return {
    opportunities: opportunities,
    trades: trades
  };
}

export async function fetchCsvData(): Promise<Trade[]> {
  try {
    console.log('Attempting to load fallback CSV data...');
    const response = await fetch('/trades.csv');
    if (!response.ok) {
      throw new Error(`Failed to load CSV data: ${response.status} ${response.statusText}`);
    }
    const csvText = await response.text();
    
    // Parse CSV
    const lines = csvText.split('\n');
    const headers = lines[0].split(',');
    
    const parsedTrades: Trade[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      
      const values = lines[i].split(',');
      const trade: Record<string, any> = {};
      
      headers.forEach((header, index) => {
        const value = values[index]?.trim();
        if (header === 'price' || header === 'shares' || header === 'pnl') {
          trade[header] = value ? parseFloat(value) : 0;
        } else if (header === 'cash_remaining') {
          trade['cashRemaining'] = value ? parseFloat(value) : 0;
        } else {
          trade[header] = value || '';
        }
      });
      
      parsedTrades.push(trade as Trade);
    }
    
    // Sort by timestamp
    parsedTrades.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    
    console.log('Successfully loaded and parsed fallback trade data:', parsedTrades.length, 'trades');
    return parsedTrades;
  } catch (error) {
    console.error('Error loading CSV fallback data:', error);
    throw error; // Re-throw to trigger the mock data generator fallback
  }
}
