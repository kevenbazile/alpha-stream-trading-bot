
import { Trade } from "../types/trading";
import { apiConfig } from "../utils/apiConfig";

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
    
    const data = await response.json();
    console.log('Successfully connected to Kalshi API, limiting to 5 events:', data.events?.slice(0, 5));
    
    // Since the API response format differs from our application needs, throw an error
    throw new Error('Using fallback data since API response format differs from our application needs');
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
