
import { useState, useEffect } from 'react';
import { Trade, PortfolioSummary, PerformanceData, DailyReturn } from '../types/trading';
import { fetchKalshiData, fetchCsvData } from '../services/apiService';
import { generateMockTradeData } from './mockDataGenerator';
import { calculatePortfolioSummary, generatePerformanceData } from './portfolioCalculations';

export type { Trade, PortfolioSummary, PerformanceData, DailyReturn };

export const useTradingData = () => {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [portfolioSummary, setPortfolioSummary] = useState<PortfolioSummary>({
    capital: 100,
    totalPnL: 0,
    totalTrades: 0,
    openPositions: 0,
    closedPositions: 0,
    winRate: 0
  });
  const [performanceData, setPerformanceData] = useState<PerformanceData[]>([
    { day: 1, capital: 100 }
  ]);
  const [dailyReturns, setDailyReturns] = useState<DailyReturn[]>([
    { day: 1, return: 0 }
  ]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTrades = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // First try to fetch from Kalshi Elections API
        try {
          console.log('Attempting to fetch data from Kalshi API...');
          await fetchKalshiData();
          // If we get here, it means the API call succeeded but we're still using fallback data
          // because the API response format differs from our application needs
          console.log('Kalshi API connected successfully but using fallback data due to format differences');
        } catch (apiError) {
          console.log('Falling back to local CSV data due to:', apiError.message);
          
          // Fallback to local CSV data
          try {
            console.log('Loading fallback CSV data...');
            const parsedTrades = await fetchCsvData();
            
            if (parsedTrades && parsedTrades.length > 0) {
              // Ensure all trades have valid properties to prevent startsWith errors
              const validatedTrades = parsedTrades.map(trade => ({
                ...trade,
                action: trade.action || 'UNKNOWN',
                symbol: trade.symbol || 'UNKNOWN',
                price: trade.price || 0,
                shares: trade.shares || 0,
                pnl: trade.pnl || 0,
                timestamp: trade.timestamp || new Date().toISOString(),
                strategy: trade.strategy || 'unknown',
                cashRemaining: trade.cashRemaining || 100
              }));
              
              setTrades(validatedTrades);
              
              // Calculate portfolio summary
              const summary = calculatePortfolioSummary(validatedTrades);
              setPortfolioSummary(summary);
              
              // Generate performance data
              const { performance, returns } = generatePerformanceData(validatedTrades);
              setPerformanceData(performance);
              setDailyReturns(returns);
              
              console.log('Successfully loaded and processed CSV data:', validatedTrades.length, 'trades');
            } else {
              throw new Error("CSV data was empty or invalid");
            }
          } catch (csvError) {
            console.error("Error with CSV data:", csvError);
            throw csvError; // Rethrow to trigger the mock data fallback
          }
        }
        
        setIsLoading(false);
      } catch (err) {
        console.error("Error fetching trade data:", err);
        setError("Failed to load trade data. Please try again later.");
        
        // Generate mock data as absolute fallback
        console.log('Using mock trade data as emergency fallback...');
        const mockTrades = generateMockTradeData();
        setTrades(mockTrades);
        
        const summary = calculatePortfolioSummary(mockTrades);
        setPortfolioSummary(summary);
        
        const { performance, returns } = generatePerformanceData(mockTrades);
        setPerformanceData(performance);
        setDailyReturns(returns);
        
        setIsLoading(false);
      }
    };
    
    fetchTrades();
  }, []);

  return {
    trades,
    isLoading,
    error,
    portfolioSummary,
    performanceData,
    dailyReturns
  };
};
