
#!/usr/bin/env python
"""
Test Bot Module for Algorithmic Trading Bot

This module provides testing capabilities for the trading bot without requiring
continuous API connections. It simulates trading activities, verifies API connectivity,
and generates performance visualizations.

Usage:
    python test_bot.py --days 14 --trades-per-day 3 --risk-level medium
"""

import argparse
import json
import pandas as pd
import numpy as np
import random
import sys
import os
from datetime import datetime, timedelta
import time
import plotly.graph_objects as go
import requests
from typing import Dict, List, Tuple, Any, Union, Optional

# Mock API endpoint for testing
MOCK_API_URL = "https://demo-api.kalshi.co/trade-api/v2"

# Trading parameters
DEFAULT_CAPITAL = 100.0
MAX_RISK_PER_TRADE = 50.0
STOP_LOSS_PERCENT = 0.05
TRAILING_STOP_PERCENT = 0.10

class MockAPI:
    """
    Mock API class for testing when real API is unavailable
    """
    def __init__(self, success_rate: float = 0.95):
        """
        Initialize the Mock API
        
        Args:
            success_rate: Probability of successful API call (0.0 to 1.0)
        """
        self.success_rate = success_rate
        self.events_data = self._generate_mock_events()
    
    def _generate_mock_events(self, num_events: int = 20) -> Dict[str, List[Dict]]:
        """
        Generate mock events data for testing
        
        Args:
            num_events: Number of events to generate
            
        Returns:
            Dictionary containing mock events data
        """
        events = []
        for i in range(num_events):
            # Generate a random event
            event = {
                "id": f"evt_{i:05d}",
                "ticker": f"EVT-{random.randint(1000, 9999)}",
                "title": f"Mock Event {i+1}",
                "status": random.choice(["open", "closed"]),
                "markets": []
            }
            
            # Add 1-3 markets per event
            num_markets = random.randint(1, 3)
            for j in range(num_markets):
                market = {
                    "id": f"mkt_{i:05d}_{j:02d}",
                    "ticker": f"{event['ticker']}-MKT{j}",
                    "title": f"Market {j+1} for {event['title']}",
                    "status": event["status"],
                    "open_interest": random.randint(500, 10000),
                    "volume": random.randint(1000, 50000),
                    "contracts": []
                }
                
                # Add YES/NO contracts
                yes_price = round(random.uniform(0.1, 0.9), 2)
                market["contracts"] = [
                    {
                        "ticker": f"{market['ticker']}-YES",
                        "price": yes_price,
                        "type": "yes"
                    },
                    {
                        "ticker": f"{market['ticker']}-NO",
                        "price": round(1 - yes_price, 2),
                        "type": "no"
                    }
                ]
                
                event["markets"].append(market)
            
            events.append(event)
        
        return {"events": events}
    
    def get_events(self, **kwargs) -> Dict:
        """
        Mock API call to get events
        
        Args:
            **kwargs: Parameters for the API call
            
        Returns:
            Mock events data or error response
        """
        # Simulate API latency
        time.sleep(random.uniform(0.1, 0.5))
        
        # Simulate API success/failure
        if random.random() < self.success_rate:
            # Successful response
            return self.events_data
        else:
            # Error response
            return {
                "error": "API connection error",
                "status_code": random.choice([429, 500, 503])
            }

class TradingBot:
    """
    Test Trading Bot implementation that mimics the core functionality
    of the main trading system but is designed for testing
    """
    def __init__(self, initial_capital: float = DEFAULT_CAPITAL):
        """
        Initialize the Trading Bot
        
        Args:
            initial_capital: Starting capital for the bot
        """
        self.initial_capital = initial_capital
        self.capital = initial_capital
        self.positions = []
        self.trading_history = []
        self.profit_loss = 0.0
        self.api = MockAPI()
        
        print(f"Trading Bot initialized with ${initial_capital:.2f} capital")
    
    def verify_api_connectivity(self) -> bool:
        """
        Test connection to the trading API
        
        Returns:
            True if connection successful, False otherwise
        """
        try:
            # Try real API first
            response = requests.get(f"{MOCK_API_URL}/events", params={"limit": 1})
            if response.status_code == 200:
                print("✅ API connection successful")
                return True
            else:
                print(f"⚠️ API returned status code: {response.status_code}")
                return False
        except Exception as e:
            print(f"⚠️ API connection failed: {str(e)}")
            return False
    
    def get_market_data(self) -> List[Dict]:
        """
        Fetch market data from API or use mock data
        
        Returns:
            List of market opportunities
        """
        try:
            # Try real API first
            response = requests.get(f"{MOCK_API_URL}/events", 
                                   params={"limit": 20, "status": "open"})
            
            if response.status_code == 200:
                events_data = response.json()
            else:
                # Fall back to mock data
                print("Using mock data (API request failed)")
                events_data = self.api.get_events()
                
        except Exception:
            # Fall back to mock data
            print("Using mock data (API connection failed)")
            events_data = self.api.get_events()
        
        # Process the data to find opportunities
        return self._analyze_opportunities(events_data)
    
    def _analyze_opportunities(self, events_data: Dict) -> List[Dict]:
        """
        Analyze raw events data to identify trading opportunities
        
        Args:
            events_data: Raw events data from API
            
        Returns:
            List of potential trading opportunities
        """
        opportunities = []
        
        if "events" not in events_data:
            return opportunities
            
        for event in events_data["events"]:
            if "markets" not in event:
                continue
                
            for market in event["markets"]:
                # Skip markets with low activity
                if market.get("open_interest", 0) < 500 or market.get("status") != "open":
                    continue
                    
                # Extract contract prices
                contracts = market.get("contracts", [])
                yes_contract = next((c for c in contracts if c.get("type") == "yes"), None)
                no_contract = next((c for c in contracts if c.get("type") == "no"), None)
                
                if not yes_contract or not no_contract:
                    continue
                    
                yes_price = yes_contract.get("price", 0.5)
                no_price = no_contract.get("price", 0.5)
                
                # Simple opportunity scoring
                # This could be expanded with more sophisticated analysis
                score = 0
                action = ""
                
                # Look for underpriced YES contracts
                if yes_price < 0.4 and market.get("volume", 0) > 3000:
                    score = 0.7 + random.uniform(-0.1, 0.1)  # Add some randomness
                    action = "BUY YES"
                    
                # Look for underpriced NO contracts    
                elif no_price < 0.4 and market.get("volume", 0) > 3000:
                    score = 0.6 + random.uniform(-0.1, 0.1)
                    action = "BUY NO"
                
                if score > 0:
                    opportunities.append({
                        'event_ticker': event.get('ticker', ''),
                        'event_title': event.get('title', ''),
                        'market_ticker': market.get('ticker', ''),
                        'market_title': market.get('title', ''),
                        'yes_price': yes_price,
                        'no_price': no_price,
                        'volume': market.get('volume', 0),
                        'open_interest': market.get('open_interest', 0),
                        'action': action,
                        'confidence': round(score, 2)
                    })
        
        # Sort by confidence score
        return sorted(opportunities, key=lambda x: x['confidence'], reverse=True)
    
    def execute_trade(self, market_ticker: str, contract_ticker: str, 
                     action: str, price: float, quantity: int) -> Dict:
        """
        Simulate executing a trade
        
        Args:
            market_ticker: Market identifier
            contract_ticker: Contract identifier
            action: 'BUY' or 'SELL'
            price: Price per contract
            quantity: Number of contracts
            
        Returns:
            Dictionary containing trade details
        """
        # Calculate cost/proceeds
        cost = price * quantity
        
        if action == 'BUY' and cost <= self.capital:
            # Execute buy
            self.capital -= cost
            
            # Record position
            position = {
                'market_ticker': market_ticker,
                'contract_ticker': contract_ticker,
                'action': action,
                'entry_price': price,
                'quantity': quantity,
                'timestamp': datetime.now(),
                'status': 'OPEN'
            }
            self.positions.append(position)
            
            # Record trade
            trade = {
                'market_ticker': market_ticker,
                'contract_ticker': contract_ticker,
                'action': action,
                'price': price,
                'quantity': quantity,
                'cost': cost,
                'timestamp': datetime.now()
            }
            self.trading_history.append(trade)
            
            return trade
        
        elif action == 'SELL':
            # Find matching position to close
            for i, position in enumerate(self.positions):
                if (position['market_ticker'] == market_ticker and 
                    position['contract_ticker'] == contract_ticker and
                    position['status'] == 'OPEN'):
                    
                    # Calculate profit/loss
                    if position['action'] == 'BUY':
                        pl = (price - position['entry_price']) * position['quantity']
                    else:
                        pl = (position['entry_price'] - price) * position['quantity']
                    
                    # Update position
                    self.positions[i]['status'] = 'CLOSED'
                    self.positions[i]['exit_price'] = price
                    self.positions[i]['exit_timestamp'] = datetime.now()
                    self.positions[i]['profit_loss'] = pl
                    
                    # Update capital
                    self.capital += cost + pl
                    self.profit_loss += pl
                    
                    # Record trade
                    trade = {
                        'market_ticker': market_ticker,
                        'contract_ticker': contract_ticker,
                        'action': action,
                        'price': price,
                        'quantity': quantity,
                        'proceeds': cost,
                        'profit_loss': pl,
                        'timestamp': datetime.now()
                    }
                    self.trading_history.append(trade)
                    
                    return trade
            
            return {"error": "No matching position found to sell"}
        
        else:
            return {"error": "Insufficient capital or invalid action"}
    
    def get_portfolio_summary(self) -> Dict:
        """
        Get a summary of the current portfolio
        
        Returns:
            Dictionary with portfolio metrics
        """
        open_positions = [p for p in self.positions if p['status'] == 'OPEN']
        closed_positions = [p for p in self.positions if p['status'] == 'CLOSED']
        
        return {
            'initial_capital': self.initial_capital,
            'current_capital': self.capital,
            'open_positions_count': len(open_positions),
            'closed_positions_count': len(closed_positions),
            'total_profit_loss': self.profit_loss,
            'total_trades': len(self.trading_history),
            'return_pct': (self.capital / self.initial_capital - 1) * 100 if self.initial_capital > 0 else 0
        }
    
    def display_trading_history(self) -> pd.DataFrame:
        """
        Display trading history
        
        Returns:
            DataFrame containing trading history
        """
        if not self.trading_history:
            print("No trading history yet.")
            return pd.DataFrame()
        
        return pd.DataFrame(self.trading_history)

    def display_text_chart(self, title: str, values: List[float], 
                          labels: List[str] = None, width: int = 50, 
                          symbol: str = '█') -> None:
        """
        Generate a simple text-based chart for console output
        
        Args:
            title: Chart title
            values: List of numeric values to plot
            labels: Optional list of labels (same length as values)
            width: Chart width in characters
            symbol: Character to use for bars
        """
        if not values:
            print("No data to display")
            return
            
        # Find the maximum value for scaling
        max_val = max(values)
        if max_val <= 0:
            print("No positive values to display")
            return
            
        print(f"\n{title}")
        print("=" * (width + 15))
        
        # Calculate the scale factor
        scale = width / max_val if max_val > 0 else 0
        
        for i, val in enumerate(values):
            # Create the bar
            bar_len = int(val * scale)
            bar = symbol * bar_len
            
            # Add label if provided
            label = f"{labels[i]}: " if labels else f"Item {i+1}: "
            
            # Print the bar with right-aligned value
            print(f"{label:<15}{bar} {val:>.2f}")
            
        print("=" * (width + 15))

def run_simulation(days: int = 14, trades_per_day: int = 3, 
                  risk_level: str = "medium") -> Dict:
    """
    Run a full trading simulation for the specified number of days
    
    Args:
        days: Number of days to simulate
        trades_per_day: Average number of trades per day
        risk_level: Risk level ('low', 'medium', 'high')
        
    Returns:
        Dictionary with simulation results
    """
    print(f"\n{'='*60}")
    print(f"TRADING SIMULATION: {days} DAYS, {trades_per_day} TRADES/DAY, {risk_level.upper()} RISK")
    print(f"{'='*60}")
    
    # Configure risk parameters based on risk level
    if risk_level.lower() == "low":
        max_position_pct = 0.1  # Max 10% of capital per trade
        profit_target_factor = 1.3  # 30% profit target
        confidence_threshold = 0.7  # Only high confidence trades
    elif risk_level.lower() == "high":
        max_position_pct = 0.5  # Max 50% of capital per trade
        profit_target_factor = 2.0  # 100% profit target
        confidence_threshold = 0.5  # Take more speculative trades
    else:  # Medium (default)
        max_position_pct = 0.3  # Max 30% of capital per trade
        profit_target_factor = 1.5  # 50% profit target
        confidence_threshold = 0.6  # Moderate confidence threshold
    
    # Initialize trading bot
    bot = TradingBot(initial_capital=100.0)
    
    # Verify API connectivity (but don't require it)
    bot.verify_api_connectivity()
    
    # Set start date to today
    current_date = datetime.now()
    
    daily_results = []
    
    for day in range(1, days + 1):
        # Move to next day
        current_date += timedelta(days=1)
        print(f"\nDay {day}/{days}: {current_date.strftime('%Y-%m-%d')}")
        
        # Track daily metrics
        starting_capital = bot.capital
        trades_today = 0
        
        # Simulate getting new opportunities each day
        num_opps = random.randint(max(1, trades_per_day - 2), trades_per_day + 2)
        
        # Get opportunities (either from API or mock data)
        opportunities = bot.get_market_data()
        
        # Filter opportunities based on confidence threshold
        opportunities = [opp for opp in opportunities if opp['confidence'] >= confidence_threshold]
        
        # Execute trades based on opportunities
        for opp in opportunities[:num_opps]:  # Limit to desired number of trades
            market_ticker = opp['market_ticker']
            is_yes = "YES" in opp['action'] 
            contract_ticker = market_ticker + ("-YES" if is_yes else "-NO")
            
            # Calculate position size based on confidence and price
            max_trade = min(bot.capital * max_position_pct, MAX_RISK_PER_TRADE)
            trade_size = max_trade * opp['confidence']
            price = opp['yes_price'] if is_yes else opp['no_price']
            quantity = int(trade_size / price) if price > 0 else 0
            
            if quantity > 0:
                # Execute buy
                buy_result = bot.execute_trade(
                    market_ticker=market_ticker,
                    contract_ticker=contract_ticker,
                    action='BUY',
                    price=price,
                    quantity=quantity
                )
                
                if 'error' not in buy_result:
                    trades_today += 1
                    print(f"  🟢 Bought {quantity} {contract_ticker} @ ${price:.2f}")
                    
                    # Simulate market movement based on confidence
                    # Higher confidence should correlate with better performance
                    base_performance = random.uniform(-0.3, 0.5)  # Base random move
                    confidence_boost = (opp['confidence'] - 0.5) * 2  # Scale confidence boost
                    performance = base_performance + confidence_boost
                    
                    # Calculate new price based on profit target and confidence
                    sell_price = round(price * (1 + performance), 2)
                    sell_price = max(0.01, min(0.99, sell_price))  # Ensure price is valid
                    
                    # Add some delay before selling (1-3 days later)
                    sell_days_later = random.randint(0, min(2, days-day))
                    
                    # Execute sell
                    sell_result = bot.execute_trade(
                        market_ticker=market_ticker,
                        contract_ticker=contract_ticker,
                        action='SELL',
                        price=sell_price,
                        quantity=quantity
                    )
                    
                    if 'profit_loss' in sell_result:
                        pl_emoji = "✅" if sell_result['profit_loss'] > 0 else "❌"
                        print(f"  {pl_emoji} Sold {quantity} {contract_ticker} @ ${sell_price:.2f} " +
                              f"(P&L: ${sell_result['profit_loss']:.2f})")
        
        # Calculate daily results
        ending_capital = bot.capital
        daily_pnl = ending_capital - starting_capital
        daily_return = (daily_pnl / starting_capital) * 100 if starting_capital > 0 else 0
        
        daily_results.append({
            'day': day,
            'date': current_date.strftime('%Y-%m-%d'),
            'starting_capital': starting_capital,
            'ending_capital': ending_capital,
            'trades': trades_today,
            'daily_pnl': daily_pnl,
            'daily_return': daily_return
        })
        
        print(f"  📊 Capital: ${ending_capital:.2f} | Daily P&L: ${daily_pnl:.2f} | Return: {daily_return:.2f}%")
    
    # Calculate overall performance
    final_capital = bot.capital
    total_return = ((final_capital - bot.initial_capital) / bot.initial_capital) * 100
    annualized_return = ((1 + (total_return/100)) ** (365/days) - 1) * 100
    total_trades = len(bot.trading_history)
    winning_trades = sum(1 for t in bot.trading_history if 'profit_loss' in t and t['profit_loss'] > 0)
    win_rate = (winning_trades / total_trades) * 100 if total_trades > 0 else 0
    
    # Generate final report
    print("\n=========== SIMULATION RESULTS ===========")
    print(f"Period: {days} days")
    print(f"Starting Capital: ${bot.initial_capital:.2f}")
    print(f"Ending Capital: ${final_capital:.2f}")
    print(f"Total Return: {total_return:.2f}%")
    print(f"Annualized Return: {annualized_return:.2f}%")
    print(f"Total Trades: {total_trades}")
    print(f"Win Rate: {win_rate:.2f}%")
    print("=========================================")
    
    # Generate text chart of capital growth
    if daily_results:
        df = pd.DataFrame(daily_results)
        
        # Display text chart of capital over time
        bot.display_text_chart(
            title="Capital Growth Over Time",
            values=df['ending_capital'].tolist(),
            labels=[f"Day {day}" for day in df['day']],
            width=40
        )
        
        # Display text chart of daily returns
        bot.display_text_chart(
            title="Daily Returns (%)",
            values=df['daily_return'].tolist(),
            labels=[f"Day {day}" for day in df['day']],
            width=40,
            symbol='▓'
        )
    
    # Return the results
    return {
        'days': days,
        'initial_capital': bot.initial_capital,
        'final_capital': final_capital,
        'total_return': total_return,
        'annualized_return': annualized_return,
        'total_trades': total_trades,
        'win_rate': win_rate,
        'daily_results': daily_results,
        'risk_level': risk_level
    }

def test_bot_connectivity() -> bool:
    """
    Test if the bot can connect to required APIs
    
    Returns:
        True if connectivity test passes, False otherwise
    """
    print("Testing bot connectivity...")
    bot = TradingBot()
    return bot.verify_api_connectivity()

def test_opportunity_detection() -> bool:
    """
    Test if the bot can detect trading opportunities
    
    Returns:
        True if test passes, False otherwise
    """
    print("Testing opportunity detection...")
    bot = TradingBot()
    opportunities = bot.get_market_data()
    
    if not opportunities:
        print("⚠️ No opportunities detected")
        return False
        
    print(f"✅ Detected {len(opportunities)} potential opportunities")
    
    # Print top opportunities
    print("\nTop opportunities:")
    for i, opp in enumerate(opportunities[:3], 1):
        print(f"{i}. {opp['market_title']} - {opp['action']} @ ${opp['yes_price']:.2f}")
        print(f"   Confidence: {opp['confidence']:.2f} | Volume: {opp['volume']}")
    
    return True

def test_trading_execution() -> bool:
    """
    Test if the bot can execute trades correctly
    
    Returns:
        True if test passes, False otherwise
    """
    print("Testing trade execution...")
    bot = TradingBot(initial_capital=100.0)
    
    # Execute some test trades
    trade1 = bot.execute_trade(
        market_ticker="TEST-MKT1",
        contract_ticker="TEST-MKT1-YES",
        action="BUY",
        price=0.50,
        quantity=20
    )
    
    if 'error' in trade1:
        print(f"⚠️ Trade execution failed: {trade1['error']}")
        return False
    
    print(f"✅ Successfully bought {trade1['quantity']} contracts @ ${trade1['price']:.2f}")
    
    # Test a profitable sell
    trade2 = bot.execute_trade(
        market_ticker="TEST-MKT1",
        contract_ticker="TEST-MKT1-YES",
        action="SELL",
        price=0.75,
        quantity=20
    )
    
    if 'error' in trade2:
        print(f"⚠️ Trade execution failed: {trade2['error']}")
        return False
    
    print(f"✅ Successfully sold with P&L: ${trade2['profit_loss']:.2f}")
    
    # Check portfolio summary
    summary = bot.get_portfolio_summary()
    print(f"Final capital: ${summary['current_capital']:.2f}")
    print(f"Return: {summary['return_pct']:.2f}%")
    
    return True

def main() -> None:
    """
    Main function that processes arguments and runs tests
    """
    parser = argparse.ArgumentParser(description='Trading Bot Test Module')
    parser.add_argument('--days', type=int, default=14,
                        help='Number of days to simulate (default: 14)')
    parser.add_argument('--trades-per-day', type=int, default=3,
                        help='Average trades per day (default: 3)')
    parser.add_argument('--risk-level', type=str, default='medium',
                        choices=['low', 'medium', 'high'],
                        help='Risk level for trading (default: medium)')
    parser.add_argument('--test', choices=['connectivity', 'opportunities', 
                                         'execution', 'all'],
                        help='Run specific test(s)')
    parser.add_argument('--verbose', '-v', action='store_true',
                        help='Enable verbose output')
    
    args = parser.parse_args()
    
    # Run specified tests
    if args.test:
        print(f"Running {args.test} test(s)...")
        
        if args.test in ['connectivity', 'all']:
            test_bot_connectivity()
            
        if args.test in ['opportunities', 'all']:
            test_opportunity_detection()
            
        if args.test in ['execution', 'all']:
            test_trading_execution()
    else:
        # Run simulation with specified parameters
        results = run_simulation(
            days=args.days,
            trades_per_day=args.trades_per_day,
            risk_level=args.risk_level
        )
        
        if args.verbose:
            print("\nDetailed Results:")
            for day_result in results['daily_results']:
                print(f"Day {day_result['day']}: ${day_result['ending_capital']:.2f} " +
                      f"({day_result['daily_return']:+.2f}%)")

if __name__ == "__main__":
    main()
