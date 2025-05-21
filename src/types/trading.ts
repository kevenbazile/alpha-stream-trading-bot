
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
