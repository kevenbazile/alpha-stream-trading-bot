
import { useState, useEffect } from 'react';
import { Trade, PortfolioSummary, PerformanceData, DailyReturn } from '../types/trading';
import { fetchKalshiData, fetchCsvData } from '../services/apiService';
import { generateMockTradeData } from './mockDataGenerator';
import { calculatePortfolioSummary, generatePerformanceData } from './portfolioCalculations';
import { toast } from "@/components/ui/sonner";

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
            
            // Show toast notification of successful data load
            toast("Market data loaded", {
              description: `${kalshiData.opportunities.length} trading opportunities found`,
            });
          } else {
            console.warn('No opportunities found in Kalshi data response');
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
          // Use Kalshi-like prediction market data instead of stock-like data
          const mockOpportunities = [
            {
              marketTicker: "DEM_PRES_2024",
              marketTitle: "Will the Democratic candidate win the 2024 US Presidential Election?",
              yesPrice: 0.65,
              noPrice: 0.35,
              volume: 32540,
              openInterest: 4500,
              action: "BUY YES",
              confidence: 0.85
            },
            {
              marketTicker: "REP_HOUSE_2024",
              marketTitle: "Will Republicans maintain control of the US House after 2024 elections?",
              yesPrice: 0.58,
              noPrice: 0.42,
              volume: 18750,
              openInterest: 3200,
              action: "BUY YES",
              confidence: 0.72
            },
            {
              marketTicker: "CPI_JUN_5PCT",
              marketTitle: "Will CPI inflation be above 5% in June 2024?",
              yesPrice: 0.22,
              noPrice: 0.78,
              volume: 25300,
              openInterest: 5100,
              action: "BUY NO",
              confidence: 0.78
            }
          ];
          setOpportunities(mockOpportunities);
        }
        
        toast("Using demo data", {
          description: "Could not connect to Kalshi API. Using example data instead.",
          duration: 5000
        });
        
        setIsLoading(false);
        // Don't set error here so UI still shows the mock data
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
