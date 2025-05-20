
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/sonner";
import { AreaChart, BarChart } from '@/components/ui/custom-charts';
import { ArrowUpCircle, ArrowDownCircle, TrendingUp, AlertCircle, BarChart3, Settings, RefreshCw } from "lucide-react";

// Mock trading data
const mockPortfolioData = {
  capital: 137.52,
  totalPnL: 37.52,
  totalTrades: 12,
  openPositions: 2,
  closedPositions: 10,
  winRate: 75
};

const mockPerformanceData = [
  { day: 1, capital: 98.50 },
  { day: 2, capital: 105.20 },
  { day: 3, capital: 102.80 },
  { day: 4, capital: 110.15 },
  { day: 5, capital: 115.60 },
  { day: 6, capital: 120.25 },
  { day: 7, capital: 117.90 },
  { day: 8, capital: 125.40 },
  { day: 9, capital: 130.75 },
  { day: 10, capital: 128.30 },
  { day: 11, capital: 135.80 },
  { day: 12, capital: 140.20 },
  { day: 13, capital: 137.52 },
  { day: 14, capital: 145.10 }
];

const mockDailyReturns = [
  { day: 1, return: -1.5 },
  { day: 2, return: 6.8 },
  { day: 3, return: -2.3 },
  { day: 4, return: 7.1 },
  { day: 5, return: 5.0 },
  { day: 6, return: 4.0 },
  { day: 7, return: -1.9 },
  { day: 8, return: 6.4 },
  { day: 9, return: 4.3 },
  { day: 10, return: -1.9 },
  { day: 11, return: 5.8 },
  { day: 12, return: 3.2 },
  { day: 13, return: -1.9 },
  { day: 14, return: 5.5 }
];

const mockOpportunities = [
  {
    marketTicker: "MKT-3456",
    marketTitle: "Will the Fed raise rates by September?",
    yesPrice: 0.35,
    noPrice: 0.65,
    volume: 32540,
    openInterest: 4500,
    action: "BUY YES",
    confidence: 0.85
  },
  {
    marketTicker: "MKT-7890",
    marketTitle: "Will unemployment drop below 4% in Q3?",
    yesPrice: 0.62,
    noPrice: 0.38,
    volume: 18750,
    openInterest: 3200,
    action: "BUY NO",
    confidence: 0.72
  },
  {
    marketTicker: "MKT-2345",
    marketTitle: "Will Company X announce layoffs this month?",
    yesPrice: 0.28,
    noPrice: 0.72,
    volume: 25300,
    openInterest: 5100,
    action: "BUY YES",
    confidence: 0.78
  }
];

const mockTrades = [
  {
    id: "T-1001",
    marketTicker: "MKT-3456",
    contractTicker: "MKT-3456-YES",
    action: "BUY",
    price: 0.35,
    quantity: 28,
    cost: 9.8,
    timestamp: "2023-05-18 10:32:15"
  },
  {
    id: "T-1002",
    marketTicker: "MKT-3456",
    contractTicker: "MKT-3456-YES",
    action: "SELL",
    price: 0.48,
    quantity: 28,
    proceeds: 13.44,
    profitLoss: 3.64,
    timestamp: "2023-05-19 14:45:22"
  },
  {
    id: "T-1003",
    marketTicker: "MKT-7890",
    contractTicker: "MKT-7890-NO",
    action: "BUY",
    price: 0.38,
    quantity: 26,
    cost: 9.88,
    timestamp: "2023-05-20 09:15:03"
  },
  {
    id: "T-1004", 
    marketTicker: "MKT-2345",
    contractTicker: "MKT-2345-YES",
    action: "BUY",
    price: 0.28,
    quantity: 35,
    cost: 9.8,
    timestamp: "2023-05-20 11:05:45"
  }
];

const TradingDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState("dashboard");
  const [autoTrading, setAutoTrading] = useState(false);
  const [riskLevel, setRiskLevel] = useState([50]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    // Simulate API data loading
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1200);

    return () => clearTimeout(timer);
  }, []);

  const handleTabChange = (value: string) => {
    setSelectedTab(value);
  };

  const handleToggleAutoTrading = () => {
    const newValue = !autoTrading;
    setAutoTrading(newValue);
    toast(newValue ? "Auto trading enabled" : "Auto trading disabled", {
      description: newValue 
        ? "The trading bot will automatically execute trades based on your risk settings." 
        : "Trades will require manual confirmation.",
      action: {
        label: "Settings",
        onClick: () => setSelectedTab("settings"),
      },
    });
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    setLoading(true);
    
    // Simulate API refresh
    setTimeout(() => {
      setIsRefreshing(false);
      setLoading(false);
      toast("Data refreshed", {
        description: `Last updated: ${new Date().toLocaleTimeString()}`,
      });
    }, 1000);
  };

  const handleRiskLevelChange = (value: number[]) => {
    setRiskLevel(value);
    
    let riskDescription;
    if (value[0] <= 33) {
      riskDescription = "Conservative: Lower returns, higher safety";
    } else if (value[0] <= 66) {
      riskDescription = "Moderate: Balanced risk-reward profile";
    } else {
      riskDescription = "Aggressive: Higher returns, higher risk";
    }
    
    toast("Risk level updated", {
      description: riskDescription,
    });
  };

  return (
    <div className="container mx-auto p-4">
      <Toaster />
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Kalshi Trading Bot</h1>
        <div className="flex items-center space-x-2">
          <button 
            onClick={handleRefresh}
            className="flex items-center gap-1 px-3 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      <Tabs defaultValue="dashboard" onValueChange={handleTabChange} value={selectedTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="opportunities">Opportunities</TabsTrigger>
          <TabsTrigger value="history">Trade History</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <Card>
              <CardHeader>
                <CardTitle>Portfolio Summary</CardTitle>
                <CardDescription>Current trading statistics</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-4 w-5/6" />
                    <Skeleton className="h-4 w-2/3" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Capital:</span>
                      <span className="font-bold text-lg">${mockPortfolioData.capital.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total P&L:</span>
                      <span className={`font-bold text-lg ${mockPortfolioData.totalPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        ${mockPortfolioData.totalPnL.toFixed(2)} ({(mockPortfolioData.totalPnL / 100 * 100).toFixed(2)}%)
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Win Rate:</span>
                      <span className="font-bold text-lg">{mockPortfolioData.winRate}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Trades:</span>
                      <span className="font-bold">{mockPortfolioData.totalTrades}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Open Positions:</span>
                      <span className="font-bold">{mockPortfolioData.openPositions}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Closed Positions:</span>
                      <span className="font-bold">{mockPortfolioData.closedPositions}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Performance Chart</CardTitle>
                <CardDescription>Account value over time</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                {loading ? (
                  <div className="w-full h-full flex items-center justify-center">
                    <Skeleton className="h-[250px] w-full" />
                  </div>
                ) : (
                  <AreaChart 
                    data={mockPerformanceData}
                    index="day"
                    categories={["capital"]}
                    colors={["blue"]}
                    valueFormatter={(value) => `$${value.toFixed(2)}`}
                    showLegend={false}
                    showGridLines={true}
                    startEndOnly={false}
                    className="h-[250px]"
                  />
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Daily Returns</CardTitle>
                <CardDescription>Profit/loss per trading day</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                {loading ? (
                  <div className="w-full h-full flex items-center justify-center">
                    <Skeleton className="h-[250px] w-full" />
                  </div>
                ) : (
                  <BarChart 
                    data={mockDailyReturns}
                    index="day"
                    categories={["return"]}
                    colors={["blue"]}
                    valueFormatter={(value) => `${value.toFixed(2)}%`}
                    showLegend={false}
                    showGridLines={true}
                    startEndOnly={false}
                    className="h-[250px]"
                  />
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Latest Action</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-12 w-full" />
                ) : (
                  <div className="flex flex-col">
                    <div className="flex items-center space-x-2">
                      {mockTrades[3].action === "BUY" ? (
                        <ArrowUpCircle className="text-green-500 h-5 w-5" />
                      ) : (
                        <ArrowDownCircle className="text-red-500 h-5 w-5" />
                      )}
                      <span className="font-bold">
                        {mockTrades[3].action} {mockTrades[3].contractTicker}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground mt-1">
                      {mockTrades[3].quantity} contracts @ ${mockTrades[3].price}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Top Opportunity</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-12 w-full" />
                ) : (
                  <div className="flex flex-col">
                    <div className="flex items-center space-x-2">
                      <TrendingUp className="text-blue-500 h-5 w-5" />
                      <span className="font-bold">{mockOpportunities[0].action}</span>
                    </div>
                    <span className="text-xs text-muted-foreground mt-1 line-clamp-1">
                      {mockOpportunities[0].marketTitle} (${mockOpportunities[0].yesPrice})
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Auto-Trading</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className="font-medium">Status</span>
                  <Switch 
                    checked={autoTrading} 
                    onCheckedChange={handleToggleAutoTrading}
                  />
                </div>
                <span className="text-xs text-muted-foreground block mt-2">
                  {autoTrading ? "Bot will trade automatically" : "Manual confirmation required"}
                </span>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="opportunities">
          <Card>
            <CardHeader>
              <CardTitle>Trading Opportunities</CardTitle>
              <CardDescription>Markets with favorable conditions based on your strategy</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-4">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Market</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Volume</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Confidence</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mockOpportunities.map((opp, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <div className="font-medium line-clamp-2">{opp.marketTitle}</div>
                          <div className="text-xs text-muted-foreground">{opp.marketTicker}</div>
                        </TableCell>
                        <TableCell>
                          YES: ${opp.yesPrice}<br />
                          NO: ${opp.noPrice}
                        </TableCell>
                        <TableCell>{opp.volume.toLocaleString()}</TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded-md text-xs font-semibold ${
                            opp.action.includes("YES") ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                          }`}>
                            {opp.action}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div 
                                className={`h-full ${
                                  opp.confidence > 0.8 ? "bg-green-500" : 
                                  opp.confidence > 0.6 ? "bg-blue-500" : "bg-yellow-500"
                                }`}
                                style={{ width: `${opp.confidence * 100}%` }}
                              />
                            </div>
                            <span>{(opp.confidence * 100).toFixed(0)}%</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Trading History</CardTitle>
              <CardDescription>Record of executed trades</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-4">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Contract</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>P&L</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mockTrades.map((trade) => (
                      <TableRow key={trade.id}>
                        <TableCell>{trade.timestamp}</TableCell>
                        <TableCell className="font-medium">{trade.contractTicker}</TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded-md text-xs font-semibold ${
                            trade.action === "BUY" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                          }`}>
                            {trade.action}
                          </span>
                        </TableCell>
                        <TableCell>${trade.price}</TableCell>
                        <TableCell>{trade.quantity}</TableCell>
                        <TableCell>
                          {trade.profitLoss !== undefined ? (
                            <span className={trade.profitLoss >= 0 ? "text-green-600" : "text-red-600"}>
                              ${trade.profitLoss.toFixed(2)}
                            </span>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Trading Parameters</CardTitle>
                <CardDescription>Configure your trading strategy</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Risk Level</span>
                    <span className="text-sm">
                      {riskLevel[0] <= 33 ? "Low" : riskLevel[0] <= 66 ? "Medium" : "High"}
                    </span>
                  </div>
                  <Slider 
                    value={riskLevel}
                    onValueChange={handleRiskLevelChange}
                    max={100}
                    step={1}
                    className="mb-6"
                  />
                  <p className="text-sm text-muted-foreground">
                    {riskLevel[0] <= 33 
                      ? "Conservative: Lower positions, tighter stops, targeting 5-10% returns" 
                      : riskLevel[0] <= 66 
                        ? "Moderate: Balanced approach, targeting 10-50% returns" 
                        : "Aggressive: Larger positions, wider stops, targeting 50-200% returns"
                    }
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Auto-Trading</span>
                    <Switch 
                      checked={autoTrading} 
                      onCheckedChange={handleToggleAutoTrading}
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    When enabled, the bot will automatically execute trades based on the detected opportunities
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Max Trade Size</span>
                    <span className="font-bold">${riskLevel[0] / 2}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Maximum amount to risk on any single trade
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Stop Loss</span>
                    <span className="font-bold">{5 + (riskLevel[0] / 20)}%</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Exit position if this percentage loss is reached
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Strategy Configuration</CardTitle>
                <CardDescription>Select and configure trading strategies</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Sentiment Strategy</span>
                    <Switch defaultChecked />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Trade based on social media sentiment and post volume
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Breakout Strategy</span>
                    <Switch defaultChecked />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Trade breakouts with volume confirmation
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Mean Reversion Strategy</span>
                    <Switch />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Trade mean reversion for more stable returns
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Daily Loss Limit</span>
                    <span className="font-bold">15%</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Stop trading if daily losses exceed this percentage
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TradingDashboard;
