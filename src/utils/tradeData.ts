
import { useState, useEffect } from 'react';
import { Trade, PortfolioSummary, PerformanceData, DailyReturn } from '../types/trading';
import { fetchKalshiData, fetchCsvData } from '../services/apiService';
import { generateMockTradeData } from './mockDataGenerator';
import { calculatePortfolioSummary, generatePerformanceData } from './portfolioCalculations';

export type { Trade, PortfolioSummary, PerformanceData, DailyReturn };

// New type for market opportunities
export interface MarketOpportunity {
  marketTicker: string;
  marketTitle: string;
  yesPrice: number;
  noPrice: number;
  volume: number;
  openInterest: number;
  action: string;
  confidence: number;
}

export const useTradingData = () => {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [opportunities, setOpportunities] = useState<MarketOpportunity[]>([]);
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
          const kalshiData = await fetchKalshiData();
          
          // Set opportunities from Kalshi data
          if (kalshiData.opportunities && kalshiData.opportunities.length > 0) {
            console.log('Successfully loaded Kalshi market opportunities:', kalshiData.opportunities.length);
            setOpportunities(kalshiData.opportunities);
          }
          
          // Use trades from Kalshi data if available (these would be demo trades)
          if (kalshiData.trades && kalshiData.trades.length > 0) {
            console.log('Using sample trades from Kalshi markets:', kalshiData.trades.length);
            
            // Ensure all trades have valid properties
            const validatedTrades = kalshiData.trades.map(trade => ({
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
            
            console.log('Successfully processed Kalshi API data');
            setIsLoading(false);
            return; // Exit early since we have valid data
          } else {
            console.log('No trade data from Kalshi API, falling back to CSV data');
          }
        } catch (apiError) {
          console.log('Falling back to local CSV data due to:', apiError.message);
          
          // If we have opportunities but no trades, we'll still need to load trades from CSV
          if (opportunities.length === 0) {
            console.log('No market opportunities from Kalshi API');
          }
          
          // Fallback to local CSV data for trades
          try {
            console.log('Loading fallback CSV data for trades...');
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
        
        // Generate mock opportunities if needed
        if (opportunities.length === 0) {
          const mockOpportunities = [
            {
              marketTicker: "TSLA",
              marketTitle: "Tesla showing bullish pattern on 4h chart",
              yesPrice: 180.25,
              noPrice: 175.65,
              volume: 32540,
              openInterest: 4500,
              action: "BUY",
              confidence: 0.85
            },
            {
              marketTicker: "NVDA",
              marketTitle: "NVIDIA momentum growing after earnings",
              yesPrice: 125.50,
              noPrice: 120.75,
              volume: 18750,
              openInterest: 3200,
              action: "BUY",
              confidence: 0.72
            },
            {
              marketTicker: "AMD",
              marketTitle: "AMD showing support at key level",
              yesPrice: 145.25,
              noPrice: 140.50,
              volume: 25300,
              openInterest: 5100,
              action: "BUY",
              confidence: 0.78
            }
          ];
          setOpportunities(mockOpportunities);
        }
        
        setIsLoading(false);
      }
    };
    
    fetchTrades();
  }, []);

  return {
    trades,
    opportunities,
    isLoading,
    error,
    portfolioSummary,
    performanceData,
    dailyReturns
  };
};
