
import { useState, useEffect } from 'react';

export interface Trade {
  timestamp: string;
  symbol: string;
  action: string;
  price: number;
  shares: number;
  pnl: number;
  strategy: string;
  cashRemaining: number;
}

export interface PortfolioSummary {
  capital: number;
  totalPnL: number;
  totalTrades: number;
  openPositions: number;
  closedPositions: number;
  winRate: number;
}

export interface PerformanceData {
  day: number;
  capital: number;
}

export interface DailyReturn {
  day: number;
  return: number;
}

export const useTradingData = () => {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [portfolioSummary, setPortfolioSummary] = useState<PortfolioSummary>({
    capital: 0,
    totalPnL: 0,
    totalTrades: 0,
    openPositions: 0,
    closedPositions: 0,
    winRate: 0
  });
  const [performanceData, setPerformanceData] = useState<PerformanceData[]>([]);
  const [dailyReturns, setDailyReturns] = useState<DailyReturn[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTrades = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/trades.csv');
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
        
        setTrades(parsedTrades);
        
        // Calculate portfolio summary
        calculatePortfolioSummary(parsedTrades);
        
        // Generate performance data
        generatePerformanceData(parsedTrades);
        
        setIsLoading(false);
      } catch (err) {
        console.error("Error fetching trade data:", err);
        setError("Failed to load trade data. Please try again later.");
        setIsLoading(false);
      }
    };
    
    fetchTrades();
  }, []);

  const calculatePortfolioSummary = (trades: Trade[]) => {
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
    
    setPortfolioSummary({
      capital,
      totalPnL,
      totalTrades,
      openPositions,
      closedPositions,
      winRate
    });
  };

  const generatePerformanceData = (trades: Trade[]) => {
    if (trades.length === 0) return;
    
    // Start with initial capital of 100
    let capital = 100;
    const performance: PerformanceData[] = [];
    const returns: DailyReturn[] = [];
    
    // Group trades by day
    const tradesByDay: Record<string, Trade[]> = {};
    
    trades.forEach(trade => {
      const date = trade.timestamp.split(' ')[0];
      if (!tradesByDay[date]) {
        tradesByDay[date] = [];
      }
      tradesByDay[date].push(trade);
    });
    
    // Convert to daily data points
    let day = 1;
    let previousCapital = capital;
    
    Object.keys(tradesByDay).forEach(date => {
      const dailyTrades = tradesByDay[date];
      const lastTrade = dailyTrades[dailyTrades.length - 1];
      
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
    
    setPerformanceData(performance);
    setDailyReturns(returns);
  };

  return {
    trades,
    isLoading,
    error,
    portfolioSummary,
    performanceData,
    dailyReturns
  };
};
