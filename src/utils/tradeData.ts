
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
        
        // First try to fetch from Kalshi Elections API
        try {
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
          
          // Use the fallback CSV data as we don't have the right format from this API
          throw new Error('Using fallback data since API response format differs from our application needs');
          
        } catch (apiError) {
          console.log('Falling back to local CSV data due to:', apiError);
          // Fallback to local CSV data
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
          setTrades(parsedTrades);
          
          // Calculate portfolio summary with safety checks
          calculatePortfolioSummary(parsedTrades);
          
          // Generate performance data
          generatePerformanceData(parsedTrades);
        }
        
        setIsLoading(false);
      } catch (err) {
        console.error("Error fetching trade data:", err);
        setError("Failed to load trade data. Please try again later.");
        setIsLoading(false);
        
        // Generate mock data as absolute fallback
        const mockTrades = generateMockTradeData();
        setTrades(mockTrades);
        calculatePortfolioSummary(mockTrades);
        generatePerformanceData(mockTrades);
      }
    };
    
    fetchTrades();
  }, []);

  const generateMockTradeData = (): Trade[] => {
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
  };

  const calculatePortfolioSummary = (trades: Trade[]) => {
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
        const key = trade.symbol;
        
        if (trade.action && trade.action.startsWith('BUY')) {
          if (!positions[key]) {
            positions[key] = { shares: 0, symbol: key };
          }
          positions[key].shares += trade.shares;
        } else if (trade.action && trade.action.startsWith('SELL')) {
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
      
      console.log('Portfolio summary calculated successfully:', { 
        capital, totalPnL, totalTrades, openPositions, closedPositions, winRate 
      });
      
    } catch (err) {
      console.error("Error calculating portfolio summary:", err);
      // Set default values if calculation fails
      setPortfolioSummary({
        capital: 100,
        totalPnL: 0,
        totalTrades: trades.length,
        openPositions: 0,
        closedPositions: 0,
        winRate: 0
      });
    }
  };

  const generatePerformanceData = (trades: Trade[]) => {
    if (trades.length === 0) return;
    
    // Start with initial capital of 100
    let capital = 100;
    const performance: PerformanceData[] = [];
    const returns: DailyReturn[] = [];
    
    try {
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
      
      console.log('Performance data generated successfully:', { 
        days: performance.length, 
        finalCapital: performance[performance.length - 1].capital 
      });
      
    } catch (err) {
      console.error("Error generating performance data:", err);
      
      // Create minimal fallback data if generation fails
      const fallbackPerformance = [{ day: 1, capital: 100 }];
      const fallbackReturns = [{ day: 1, return: 0 }];
      
      setPerformanceData(fallbackPerformance);
      setDailyReturns(fallbackReturns);
    }
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
