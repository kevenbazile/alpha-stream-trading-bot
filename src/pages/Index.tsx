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
import { useTradingData } from '@/utils/tradeData';

const TradingDashboard = () => {
  const [selectedTab, setSelectedTab] = useState("dashboard");
  const [autoTrading, setAutoTrading] = useState(false);
  const [riskLevel, setRiskLevel] = useState([50]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const {
    trades,
    isLoading,
    error,
    portfolioSummary,
    performanceData,
    dailyReturns
  } = useTradingData();

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
    
    // Simulate API refresh
    setTimeout(() => {
      setIsRefreshing(false);
      toast("Data refreshed", {
        description: `Last updated: ${new Date().toLocaleTimeString()}`,
      });
      // We would reload the data here in a real application
      window.location.reload();
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

  // For opportunities tab - we'll keep the mock data for now
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

  if (error) {
    return (
      <div className="container mx-auto p-4">
        <Card>
          <CardHeader>
            <CardTitle>Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-500">{error}</p>
            <button 
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-blue-500 text-white rounded"
            >
              Retry
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Make sure portfolioSummary always has default values to prevent undefined errors
  const safeSummary = {
    capital: portfolioSummary?.capital ?? 100,
    totalPnL: portfolioSummary?.totalPnL ?? 0,
    totalTrades: portfolioSummary?.totalTrades ?? 0,
    openPositions: portfolioSummary?.openPositions ?? 0,
    closedPositions: portfolioSummary?.closedPositions ?? 0,
    winRate: portfolioSummary?.winRate ?? 0
  };

  // Ensure we have valid trade data for display
  const latestTrade = trades && trades.length > 0 ? trades[trades.length - 1] : null;

  return (
    <div className="container mx-auto p-4">
      <Toaster />
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Algorithmic Trading Bot</h1>
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
                {isLoading ? (
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
                      <span className="font-bold text-lg">${safeSummary.capital.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total P&L:</span>
                      <span className={`font-bold text-lg ${safeSummary.totalPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        ${safeSummary.totalPnL.toFixed(2)} ({((safeSummary.totalPnL / safeSummary.capital) * 100).toFixed(2)}%)
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Win Rate:</span>
                      <span className="font-bold text-lg">{safeSummary.winRate}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Trades:</span>
                      <span className="font-bold">{safeSummary.totalTrades}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Open Positions:</span>
                      <span className="font-bold">{safeSummary.openPositions}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Closed Positions:</span>
                      <span className="font-bold">{safeSummary.closedPositions}</span>
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
                {isLoading ? (
                  <div className="w-full h-full flex items-center justify-center">
                    <Skeleton className="h-[250px] w-full" />
                  </div>
                ) : (
                  <AreaChart 
                    data={performanceData}
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
                {isLoading ? (
                  <div className="w-full h-full flex items-center justify-center">
                    <Skeleton className="h-[250px] w-full" />
                  </div>
                ) : (
                  <BarChart 
                    data={dailyReturns}
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
                {isLoading ? (
                  <Skeleton className="h-12 w-full" />
                ) : latestTrade ? (
                  <div className="flex flex-col">
                    <div className="flex items-center space-x-2">
                      {latestTrade.action && latestTrade.action.startsWith('BUY') ? (
                        <ArrowUpCircle className="text-green-500 h-5 w-5" />
                      ) : (
                        <ArrowDownCircle className="text-red-500 h-5 w-5" />
                      )}
                      <span className="font-bold">
                        {latestTrade.action || 'UNKNOWN'} {latestTrade.symbol || 'UNKNOWN'}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground mt-1">
                      {latestTrade.shares ? latestTrade.shares.toFixed(4) : '0'} shares @ ${latestTrade.price || 0}
                    </span>
                  </div>
                ) : (
                  <p>No trades available</p>
                )}
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Top Opportunity</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-12 w-full" />
                ) : (
                  <div className="flex flex-col">
                    <div className="flex items-center space-x-2">
                      <TrendingUp className="text-blue-500 h-5 w-5" />
                      <span className="font-bold">{mockOpportunities[0].action} {mockOpportunities[0].marketTicker}</span>
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
              {isLoading ? (
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
                          Current: ${opp.yesPrice}<br />
                          Target: ${opp.noPrice}
                        </TableCell>
                        <TableCell>{opp.volume.toLocaleString()}</TableCell>
                        <TableCell>
                          <span className="px-2 py-1 rounded-md text-xs font-semibold bg-green-100 text-green-800">
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
              {isLoading ? (
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
                      <TableHead>Symbol</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Shares</TableHead>
                      <TableHead>P&L</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trades.map((trade, index) => (
                      <TableRow key={index}>
                        <TableCell>{trade.timestamp}</TableCell>
                        <TableCell className="font-medium">{trade.symbol}</TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded-md text-xs font-semibold ${
                            trade.action.startsWith('BUY') ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                          }`}>
                            {trade.action}
                          </span>
                        </TableCell>
                        <TableCell>${trade.price}</TableCell>
                        <TableCell>{trade.shares.toFixed(4)}</TableCell>
                        <TableCell>
                          {trade.pnl !== undefined ? (
                            <span className={trade.pnl >= 0 ? "text-green-600" : "text-red-600"}>
                              ${trade.pnl.toFixed(2)}
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
