
import { Trade, PortfolioSummary, PerformanceData, DailyReturn } from "../types/trading";

export function calculatePortfolioSummary(trades: Trade[]): PortfolioSummary {
  try {
    // Take the last trade's cash remaining as current capital
    const capital = trades.length > 0 ? trades[trades.length - 1].cashRemaining : 100;
    
    // Calculate total PnL
    const totalPnL = trades.reduce((sum, trade) => sum + (trade.pnl || 0), 0);
    
    // Count trades
    const totalTrades = trades.length;
    
    // Calculate win rate
    const profitableTrades = trades.filter(trade => trade.pnl > 0).length;
    const winRate = totalTrades > 0 ? Math.round((profitableTrades / totalTrades) * 100) : 0;
    
    // Count open and closed positions
    // We'll consider buys without corresponding sells as open positions
    const positions: Record<string, { shares: number, symbol: string }> = {};
    let openPositions = 0;
    let closedPositions = 0;
    
    trades.forEach(trade => {
      if (!trade || !trade.symbol || !trade.action) return;
      
      const key = trade.symbol;
      
      if (trade.action.startsWith('BUY')) {
        if (!positions[key]) {
          positions[key] = { shares: 0, symbol: key };
        }
        positions[key].shares += trade.shares;
      } else if (trade.action.startsWith('SELL')) {
        if (positions[key]) {
          positions[key].shares -= trade.shares;
          if (positions[key].shares <= 0) {
            delete positions[key];
            closedPositions += 1;
          }
        }
      }
    });
    
    openPositions = Object.keys(positions).length;
    
    console.log('Portfolio summary calculated successfully:', { 
      capital, totalPnL, totalTrades, openPositions, closedPositions, winRate 
    });
    
    return {
      capital,
      totalPnL,
      totalTrades,
      openPositions,
      closedPositions,
      winRate
    };
    
  } catch (err) {
    console.error("Error calculating portfolio summary:", err);
    // Set default values if calculation fails
    return {
      capital: 100,
      totalPnL: 0,
      totalTrades: trades.length,
      openPositions: 0,
      closedPositions: 0,
      winRate: 0
    };
  }
}

export function generatePerformanceData(trades: Trade[]): { performance: PerformanceData[], returns: DailyReturn[] } {
  if (!trades || trades.length === 0) {
    return { 
      performance: [{ day: 1, capital: 100 }], 
      returns: [{ day: 1, return: 0 }] 
    };
  }
  
  // Start with initial capital of 100
  let capital = 100;
  const performance: PerformanceData[] = [];
  const returns: DailyReturn[] = [];
  
  try {
    // Group trades by day
    const tradesByDay: Record<string, Trade[]> = {};
    
    trades.forEach(trade => {
      if (!trade || !trade.timestamp) return;
      
      const datePart = trade.timestamp.split(' ')[0];
      if (!datePart) return;
      
      if (!tradesByDay[datePart]) {
        tradesByDay[datePart] = [];
      }
      tradesByDay[datePart].push(trade);
    });
    
    // Convert to daily data points
    let day = 1;
    let previousCapital = capital;
    
    Object.keys(tradesByDay).forEach(date => {
      const dailyTrades = tradesByDay[date];
      if (!dailyTrades || dailyTrades.length === 0) return;
      
      const lastTrade = dailyTrades[dailyTrades.length - 1];
      if (!lastTrade || typeof lastTrade.cashRemaining !== 'number') return;
      
      capital = lastTrade.cashRemaining;
      performance.push({ day, capital });
      
      // Calculate daily return
      const dailyReturn = ((capital - previousCapital) / previousCapital) * 100;
      returns.push({ day, return: parseFloat(dailyReturn.toFixed(1)) });
      
      previousCapital = capital;
      day++;
    });
    
    // If we have less than 14 days of data, extrapolate to 14 days
    if (performance.length < 14) {
      const lastCapital = performance[performance.length - 1].capital;
      const avgDailyReturn = returns.reduce((sum, item) => sum + item.return, 0) / returns.length;
      
      for (let i = performance.length + 1; i <= 14; i++) {
        const projectedCapital = lastCapital * (1 + (avgDailyReturn / 100));
        performance.push({ day: i, capital: parseFloat(projectedCapital.toFixed(2)) });
        returns.push({ day: i, return: avgDailyReturn });
      }
    }
    
    console.log('Performance data generated successfully:', { 
      days: performance.length, 
      finalCapital: performance[performance.length - 1].capital 
    });
    
    return { performance, returns };
    
  } catch (err) {
    console.error("Error generating performance data:", err);
    
    // Create minimal fallback data if generation fails
    return { 
      performance: [{ day: 1, capital: 100 }], 
      returns: [{ day: 1, return: 0 }] 
    };
  }
}
