
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
          await fetchKalshiData();
          // If we get here, it means the API call succeeded but we're still using fallback data
          // because the API response format differs from our application needs
          throw new Error('Using fallback data since API response format differs from our application needs');
        } catch (apiError) {
          console.log('Falling back to local CSV data due to:', apiError);
          
          // Fallback to local CSV data
          try {
            const parsedTrades = await fetchCsvData();
            setTrades(parsedTrades);
            
            // Calculate portfolio summary
            const summary = calculatePortfolioSummary(parsedTrades);
            setPortfolioSummary(summary);
            
            // Generate performance data
            const { performance, returns } = generatePerformanceData(parsedTrades);
            setPerformanceData(performance);
            setDailyReturns(returns);
          } catch (csvError) {
            console.error("Error with CSV data:", csvError);
            throw csvError; // Rethrow to trigger the mock data fallback
          }
        }
        
        setIsLoading(false);
      } catch (err) {
        console.error("Error fetching trade data:", err);
        setError("Failed to load trade data. Please try again later.");
        setIsLoading(false);
        
        // Generate mock data as absolute fallback
        const mockTrades = generateMockTradeData();
        setTrades(mockTrades);
        
        const summary = calculatePortfolioSummary(mockTrades);
        setPortfolioSummary(summary);
        
        const { performance, returns } = generatePerformanceData(mockTrades);
        setPerformanceData(performance);
        setDailyReturns(returns);
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

