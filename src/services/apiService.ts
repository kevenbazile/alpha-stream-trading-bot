
import { Trade } from "../types/trading";

export async function fetchKalshiData() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
  
  const response = await fetch('https://api.elections.kalshi.com/trade-api/v2/events', {
    headers: {
      'accept': 'application/json'
    },
    signal: controller.signal,
    method: 'GET'
  });
  
  clearTimeout(timeoutId);
  
  if (!response.ok) {
    console.log('API returned error status:', response.status);
    throw new Error(`API returned ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  console.log('Successfully connected to Kalshi API, limiting to 5 events:', data.events?.slice(0, 5));
  
  // Since the API response format differs from our application needs, throw an error
  throw new Error('Using fallback data since API response format differs from our application needs');
}

export async function fetchCsvData(): Promise<Trade[]> {
  const response = await fetch('/trades.csv');
  if (!response.ok) {
    throw new Error('Failed to load fallback data');
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
}
