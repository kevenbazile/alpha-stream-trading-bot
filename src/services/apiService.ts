
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
    // Skip events with no markets
    if (!event.markets || event.markets.length === 0) return;
    
    event.markets.forEach(market => {
      // Only add markets with at least YES and NO contracts
      if (market.contracts && market.contracts.length >= 2) {
        // Find YES and NO contracts
        const yesContract = market.contracts.find(c => c.ticker.endsWith('YES'));
        const noContract = market.contracts.find(c => c.ticker.endsWith('NO'));
        
        if (yesContract && noContract) {
          // Get prices for YES and NO positions
          const yesPrice = yesContract.price;
          const noPrice = noContract.price;
          
          // Calculate market liquidity (volume or open interest)
          const volume = market.volume24h || 0;
          const openInterest = market.open_interest || 0;
          
          // Calculate confidence based on price and liquidity
          // Higher price differential and higher liquidity = higher confidence
          const priceSpread = Math.abs(yesPrice - noPrice);
          const liquidity = volume > 0 ? volume : openInterest > 0 ? openInterest : 1;
          
          // Simple liquidity-weighted confidence score (0.5-1.0)
          // Higher YES price = BUY, Higher NO price = SELL
          const isYesOpportunity = yesPrice > noPrice;
          const confidenceBase = isYesOpportunity ? yesPrice : noPrice;
          
          // Scale liquidity logarithmically (prevents extremely high volume from skewing too much)
          const liquidityFactor = Math.min(0.2, Math.log10(liquidity) / 50);
          
          // Final confidence is base confidence plus liquidity adjustment
          const confidence = Math.min(0.99, confidenceBase + liquidityFactor);
          
          // Determine action based on price comparison
          // YES price > 0.6 suggests buying YES, otherwise suggest NO
          const action = isYesOpportunity ? "BUY YES" : "BUY NO";
          
          // Add to opportunities
          opportunities.push({
            marketTicker: market.ticker,
            marketTitle: market.title,
            yesPrice: yesPrice, 
            noPrice: noPrice,
            volume: volume,
            openInterest: openInterest,
            action: action,
            confidence: confidence
          });
          
          // For demo purposes, create a historical trade for some markets
          // In a real app, this would come from actual trade execution
          if (Math.random() > 0.7) { // Only create trades for ~30% of opportunities
            const now = new Date();
            const yesterday = new Date(now);
            yesterday.setDate(now.getDate() - 1);
            
            // Position size based on confidence (higher confidence = larger position)
            const positionSize = 0.5 * confidence;
            
            // Choose the price based on the action
            const entryPrice = isYesOpportunity ? yesPrice : noPrice;
            
            // Mock a BUY trade from yesterday
            trades.push({
              timestamp: yesterday.toISOString().replace('T', ' ').substring(0, 19),
              symbol: market.ticker,
              action: action,
              price: entryPrice,
              shares: positionSize,
              pnl: 0, // Initial PnL is 0
              strategy: "prediction",
              cashRemaining: 100 - (entryPrice * positionSize * 100)
            });
            
            // Simulate price movement for settlement
            const priceChange = (Math.random() * 0.2) - 0.1; // -10% to +10% change
            const exitPrice = Math.min(0.99, Math.max(0.01, entryPrice + priceChange));
            
            // Calculate profit/loss
            const profit = isYesOpportunity ? 
              ((exitPrice - entryPrice) * positionSize * 100) : 
              ((entryPrice - exitPrice) * positionSize * 100);
            
            // Mock a SELL/SETTLEMENT trade from today
            trades.push({
              timestamp: now.toISOString().replace('T', ' ').substring(0, 19),
              symbol: market.ticker,
              action: profit >= 0 ? "SETTLEMENT (win)" : "SETTLEMENT (loss)",
              price: exitPrice,
              shares: positionSize,
              pnl: profit,
              strategy: "prediction",
              cashRemaining: (100 - (entryPrice * positionSize * 100)) + (exitPrice * positionSize * 100)
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
