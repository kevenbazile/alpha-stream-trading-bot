
import { Trade } from "../types/trading";

export function generateMockTradeData(): Trade[] {
  console.log('Generating mock trade data as emergency fallback');
  const mockTrades: Trade[] = [];
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 5);
  
  const symbols = ['AAPL', 'TSLA', 'NVDA', 'AMD', 'MSFT'];
  const strategies = ['sentiment', 'breakout'];
  let cash = 100;
  
  // Generate 5 sample trades
  for (let i = 0; i < 5; i++) {
    const date = new Date(startDate);
    date.setHours(9 + i);
    date.setMinutes(30 + i * 15);
    
    const symbol = symbols[i % symbols.length];
    const price = Math.round(100 + Math.random() * 100);
    const shares = +(Math.random() * 0.5).toFixed(4);
    const cost = price * shares;
    
    if (i % 2 === 0) {
      // Buy action
      mockTrades.push({
        timestamp: date.toISOString().replace('T', ' ').substring(0, 19),
        symbol,
        action: 'BUY',
        price,
        shares,
        pnl: 0,
        strategy: strategies[i % strategies.length],
        cashRemaining: cash - cost
      });
      cash -= cost;
    } else {
      // Sell action based on previous buy
      const prevTrade = mockTrades[i - 1];
      const sellPrice = prevTrade.price * (1 + (Math.random() * 0.1)); // 0-10% profit
      const pnl = (sellPrice - prevTrade.price) * prevTrade.shares;
      
      mockTrades.push({
        timestamp: date.toISOString().replace('T', ' ').substring(0, 19),
        symbol: prevTrade.symbol,
        action: 'SELL (take_profit)',
        price: sellPrice,
        shares: prevTrade.shares,
        pnl,
        strategy: prevTrade.strategy,
        cashRemaining: cash + (prevTrade.shares * sellPrice)
      });
      cash += (prevTrade.shares * sellPrice);
    }
  }
  
  return mockTrades;
}
