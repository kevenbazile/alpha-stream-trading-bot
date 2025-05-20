
import os
import time
from datetime import datetime, timedelta
import pandas as pd
import alpaca_trade_api as tradeapi
from dotenv import load_dotenv
import logging
import csv

# Import strategy modules
from sentiment import analyze_social_sentiment, get_social_volume
from breakout import detect_breakouts, calculate_rsi
from mean_reversion import detect_mean_reversion_opportunities

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Alpaca API credentials (placeholders - replace with your own or use .env file)
API_KEY = os.getenv("ALPACA_API_KEY", "YOUR_KEY")
API_SECRET = os.getenv("ALPACA_API_SECRET", "YOUR_SECRET")
BASE_URL = os.getenv("ALPACA_BASE_URL", "https://paper-api.alpaca.markets")  # Use paper trading by default

# Initialize Alpaca API
api = tradeapi.REST(API_KEY, API_SECRET, BASE_URL, api_version='v2')

# Trading parameters
STARTING_CAPITAL = 100.0
MAX_RISK_PER_TRADE = 50.0  # 50% of capital maximum
STOP_LOSS_PERCENT = 0.05  # 5% stop loss
TRAILING_STOP_PERCENT = 0.10  # 10% trailing stop
MAX_DAILY_LOSS_PERCENT = 0.15  # 15% max daily loss

# Stock watchlist - high volatility, social media presence, across different sectors
WATCHLIST = {
    "TECH": ["AAPL", "NVDA", "AMD", "TSLA", "MSFT"],
    "CONSUMER": ["NKE", "SBUX", "AMZN", "WMT", "DIS"],
    "HEALTHCARE": ["JNJ", "PFE", "MRNA", "ABBV", "UNH"]
}

# Trading strategies
STRATEGIES = {
    "sentiment": True,
    "breakout": True,
    "mean_reversion": False  # Initially disabled, enable after challenge period
}

class TradingBot:
    def __init__(self):
        self.cash = STARTING_CAPITAL
        self.positions = {}
        self.trades_log = "trades.csv"
        self.daily_pl = 0
        self.starting_day_value = STARTING_CAPITAL
        self.trailing_stops = {}  # To track trailing stops for positions
        
        # Initialize trades log if it doesn't exist
        if not os.path.exists(self.trades_log):
            with open(self.trades_log, 'w', newline='') as file:
                writer = csv.writer(file)
                writer.writerow(["timestamp", "symbol", "action", "price", "shares", "pnl", "strategy", "cash_remaining"])
    
    def log_trade(self, symbol, action, price, shares, pnl, strategy):
        """Log trade to CSV file"""
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        with open(self.trades_log, 'a', newline='') as file:
            writer = csv.writer(file)
            writer.writerow([timestamp, symbol, action, price, shares, pnl, strategy, self.cash])
        logger.info(f"TRADE: {action} {shares} shares of {symbol} at ${price:.2f} - {strategy} strategy")
    
    def get_account_value(self):
        """Calculate total account value including positions"""
        positions_value = 0
        for symbol, position in self.positions.items():
            current_price = self.get_current_price(symbol)
            positions_value += position['shares'] * current_price
        
        return self.cash + positions_value
    
    def get_current_price(self, symbol):
        """Get the current price of a symbol"""
        try:
            ticker = api.get_latest_trade(symbol)
            return float(ticker.price)
        except Exception as e:
            logger.error(f"Error getting price for {symbol}: {e}")
            # Fallback to latest quote
            try:
                quote = api.get_latest_quote(symbol)
                return (float(quote.bidprice) + float(quote.askprice)) / 2
            except:
                logger.error(f"Failed to get quote for {symbol}")
                return None
    
    def can_make_trade(self, risk_amount):
        """Check if we can make a trade based on risk parameters"""
        if risk_amount > MAX_RISK_PER_TRADE:
            logger.info(f"Risk amount ${risk_amount:.2f} exceeds maximum ${MAX_RISK_PER_TRADE:.2f}")
            return False
        
        if self.daily_pl <= -MAX_DAILY_LOSS_PERCENT * self.starting_day_value:
            logger.info(f"Daily loss limit reached. Current P&L: ${self.daily_pl:.2f}")
            return False
        
        return True
    
    def execute_buy(self, symbol, price, amount, strategy):
        """Execute a buy order"""
        if not self.can_make_trade(amount):
            return False
        
        # Calculate shares (fractional allowed in Alpaca)
        shares = amount / price
        
        # Check if we have enough cash
        if amount > self.cash:
            logger.info(f"Insufficient funds to buy {symbol}. Need ${amount:.2f}, have ${self.cash:.2f}")
            return False
            
        try:
            # Submit order to Alpaca
            order = api.submit_order(
                symbol=symbol,
                qty=shares,
                side='buy',
                type='market',
                time_in_force='day'
            )
            
            # Update our tracking
            self.cash -= amount
            
            if symbol not in self.positions:
                self.positions[symbol] = {'shares': shares, 'entry_price': price, 'strategy': strategy}
            else:
                # Average down/up if we already have a position
                current_shares = self.positions[symbol]['shares']
                current_price = self.positions[symbol]['entry_price']
                total_shares = current_shares + shares
                avg_price = (current_shares * current_price + shares * price) / total_shares
                self.positions[symbol] = {'shares': total_shares, 'entry_price': avg_price, 'strategy': strategy}
            
            # Set trailing stop
            if strategy == "breakout":
                self.trailing_stops[symbol] = price * (1 - TRAILING_STOP_PERCENT)
            
            # Log the trade
            self.log_trade(symbol, "BUY", price, shares, 0, strategy)
            return True
            
        except Exception as e:
            logger.error(f"Error placing buy order for {symbol}: {e}")
            return False
    
    def execute_sell(self, symbol, price, shares, strategy, reason="target_reached"):
        """Execute a sell order"""
        try:
            # Submit order to Alpaca
            order = api.submit_order(
                symbol=symbol,
                qty=shares,
                side='sell',
                type='market',
                time_in_force='day'
            )
            
            # Calculate P&L
            if symbol in self.positions:
                entry_price = self.positions[symbol]['entry_price']
                pnl = (price - entry_price) * shares
                self.daily_pl += pnl
                
                # Update cash
                self.cash += shares * price
                
                # Update or remove position
                if self.positions[symbol]['shares'] <= shares:
                    del self.positions[symbol]
                    if symbol in self.trailing_stops:
                        del self.trailing_stops[symbol]
                else:
                    self.positions[symbol]['shares'] -= shares
                
                # Log the trade
                self.log_trade(symbol, f"SELL ({reason})", price, shares, pnl, strategy)
                return True
            else:
                logger.error(f"Attempted to sell {symbol} but no position found")
                return False
                
        except Exception as e:
            logger.error(f"Error placing sell order for {symbol}: {e}")
            return False
    
    def check_stop_losses(self):
        """Check if any positions hit stop losses"""
        for symbol, position in list(self.positions.items()):
            current_price = self.get_current_price(symbol)
            if not current_price:
                continue
                
            entry_price = position['entry_price']
            strategy = position['strategy']
            
            # Check regular stop loss
            if current_price <= entry_price * (1 - STOP_LOSS_PERCENT):
                logger.info(f"Stop loss triggered for {symbol} at ${current_price:.2f}")
                self.execute_sell(symbol, current_price, position['shares'], strategy, "stop_loss")
            
            # Check trailing stop for breakout strategy
            elif strategy == "breakout" and symbol in self.trailing_stops:
                if current_price <= self.trailing_stops[symbol]:
                    logger.info(f"Trailing stop triggered for {symbol} at ${current_price:.2f}")
                    self.execute_sell(symbol, current_price, position['shares'], strategy, "trailing_stop")
                elif current_price > self.trailing_stops[symbol] / (1 - TRAILING_STOP_PERCENT):
                    # Update trailing stop if price moves up
                    self.trailing_stops[symbol] = current_price * (1 - TRAILING_STOP_PERCENT)
                    logger.info(f"Updated trailing stop for {symbol} to ${self.trailing_stops[symbol]:.2f}")
    
    def check_take_profits(self):
        """Check if any positions reached profit targets"""
        for symbol, position in list(self.positions.items()):
            current_price = self.get_current_price(symbol)
            if not current_price:
                continue
                
            entry_price = position['entry_price']
            strategy = position['strategy']
            
            # Take profit levels depend on strategy
            if strategy == "sentiment" and current_price >= entry_price * 1.5:  # 50% gain
                logger.info(f"Take profit triggered for {symbol} at ${current_price:.2f} (sentiment strategy)")
                self.execute_sell(symbol, current_price, position['shares'], strategy, "take_profit")
            
            elif strategy == "breakout" and current_price >= entry_price * 1.3:  # 30% gain
                logger.info(f"Take profit triggered for {symbol} at ${current_price:.2f} (breakout strategy)")
                self.execute_sell(symbol, current_price, position['shares'], strategy, "take_profit")
            
            elif strategy == "mean_reversion" and current_price >= entry_price * 1.1:  # 10% gain
                logger.info(f"Take profit triggered for {symbol} at ${current_price:.2f} (mean reversion strategy)")
                self.execute_sell(symbol, current_price, position['shares'], strategy, "take_profit")
    
    def run_sentiment_strategy(self):
        """Run the sentiment-based trading strategy"""
        if not STRATEGIES["sentiment"]:
            return
            
        logger.info("Running sentiment strategy...")
        for sector, stocks in WATCHLIST.items():
            for symbol in stocks:
                # Get sentiment and volume
                sentiment_score = analyze_social_sentiment(symbol)
                post_volume = get_social_volume(symbol)
                
                logger.info(f"{symbol} sentiment: {sentiment_score:.2f}, post volume: {post_volume}")
                
                # Trading logic
                if sentiment_score > 0.5 and post_volume > 100:
                    current_price = self.get_current_price(symbol)
                    if current_price:
                        # Risk between $20-50 per trade
                        risk_amount = min(max(20, self.cash * 0.2), min(50, self.cash * 0.5))
                        self.execute_buy(symbol, current_price, risk_amount, "sentiment")
    
    def run_breakout_strategy(self):
        """Run the breakout trading strategy"""
        if not STRATEGIES["breakout"]:
            return
            
        logger.info("Running breakout strategy...")
        for sector, stocks in WATCHLIST.items():
            for symbol in stocks:
                # Get 5-minute candles
                end_dt = datetime.now()
                start_dt = end_dt - timedelta(days=1)  # Get 1 day of 5-min data
                
                try:
                    bars = api.get_bars(symbol, '5Min', start=start_dt.isoformat(), end=end_dt.isoformat()).df
                    
                    if len(bars) > 20:  # Need at least 20 periods
                        # Check for breakout
                        is_breakout = detect_breakouts(bars)
                        rsi = calculate_rsi(bars)
                        
                        logger.info(f"{symbol} breakout: {is_breakout}, RSI: {rsi}")
                        
                        if is_breakout and rsi > 60:
                            current_price = self.get_current_price(symbol)
                            if current_price:
                                # Risk between $20-50 per trade
                                risk_amount = min(max(20, self.cash * 0.2), min(50, self.cash * 0.5))
                                self.execute_buy(symbol, current_price, risk_amount, "breakout")
                                
                except Exception as e:
                    logger.error(f"Error processing breakout for {symbol}: {e}")
    
    def run_mean_reversion_strategy(self):
        """Run the mean reversion trading strategy"""
        if not STRATEGIES["mean_reversion"]:
            return
            
        logger.info("Running mean reversion strategy...")
        for sector, stocks in WATCHLIST.items():
            for symbol in stocks:
                # Get daily candles
                end_dt = datetime.now()
                start_dt = end_dt - timedelta(days=30)  # Get 30 days of data
                
                try:
                    bars = api.get_bars(symbol, '1D', start=start_dt.isoformat(), end=end_dt.isoformat()).df
                    
                    if len(bars) >= 20:  # Need at least 20 days for mean reversion
                        # Check for mean reversion opportunity
                        is_opportunity, entry_price, target_price = detect_mean_reversion_opportunities(bars)
                        
                        if is_opportunity:
                            current_price = self.get_current_price(symbol)
                            if current_price and abs(current_price - entry_price) / entry_price < 0.01:  # Within 1% of the signal
                                # Use more capital for mean reversion (post-challenge)
                                risk_amount = min(max(100, self.cash * 0.2), min(500, self.cash * 0.5))
                                self.execute_buy(symbol, current_price, risk_amount, "mean_reversion")
                                
                except Exception as e:
                    logger.error(f"Error processing mean reversion for {symbol}: {e}")
    
    def close_all_positions_at_market_close(self):
        """Close all positions at market close"""
        logger.info("Market closing - liquidating all positions")
        for symbol, position in list(self.positions.items()):
            current_price = self.get_current_price(symbol)
            if current_price:
                self.execute_sell(symbol, current_price, position['shares'], position['strategy'], "market_close")
    
    def reset_daily_stats(self):
        """Reset daily statistics"""
        self.daily_pl = 0
        self.starting_day_value = self.get_account_value()
        logger.info(f"Daily stats reset. Starting value: ${self.starting_day_value:.2f}")
    
    def premarket_scan(self):
        """Scan for potential candidates before market open"""
        logger.info("Running premarket scan...")
        premarket_candidates = []
        
        for sector, stocks in WATCHLIST.items():
            for symbol in stocks:
                try:
                    # Get premarket data if available
                    current_price = self.get_current_price(symbol)
                    bars = api.get_bars(symbol, '1D', limit=2).df
                    
                    if len(bars) >= 2:
                        prev_close = bars.iloc[-2]['close']
                        gap_percent = (current_price - prev_close) / prev_close * 100
                        
                        # Look for significant gaps
                        if abs(gap_percent) > 2:
                            direction = "up" if gap_percent > 0 else "down"
                            premarket_candidates.append({
                                "symbol": symbol,
                                "gap_percent": gap_percent,
                                "direction": direction,
                                "sector": sector
                            })
                            logger.info(f"Premarket gap detected: {symbol} {direction} {gap_percent:.2f}%")
                
                except Exception as e:
                    logger.error(f"Error in premarket scan for {symbol}: {e}")
        
        return premarket_candidates
    
    def run_trading_day(self):
        """Run a complete trading day"""
        # Check if market is open
        clock = api.get_clock()
        
        if clock.is_open:
            logger.info("Market is open. Starting trading operations.")
            
            # Reset daily stats at market open
            if datetime.now().hour == 9 and datetime.now().minute < 35:
                self.reset_daily_stats()
                premarket_candidates = self.premarket_scan()
                logger.info(f"Premarket candidates: {premarket_candidates}")
                
            # Run strategies
            self.run_sentiment_strategy()
            self.run_breakout_strategy()
            if STRATEGIES["mean_reversion"]:
                self.run_mean_reversion_strategy()
                
            # Check stops and profit targets
            self.check_stop_losses()
            self.check_take_profits()
            
            # Check for market close
            if datetime.now().hour == 15 and datetime.now().minute >= 55:
                self.close_all_positions_at_market_close()
                
            # Log current status
            account_value = self.get_account_value()
            logger.info(f"Current account value: ${account_value:.2f}, Cash: ${self.cash:.2f}")
            logger.info(f"Daily P&L: ${self.daily_pl:.2f} ({self.daily_pl/self.starting_day_value*100:.2f}%)")
            logger.info(f"Open positions: {self.positions}")
        else:
            next_open = clock.next_open.strftime("%Y-%m-%d %H:%M:%S")
            logger.info(f"Market is closed. Next open: {next_open}")
            
    def update_strategy_settings(self, strategies):
        """Update strategy settings based on community poll"""
        global STRATEGIES
        STRATEGIES = strategies
        logger.info(f"Updated strategy settings: {STRATEGIES}")

# Main function to run the trading bot
def main():
    bot = TradingBot()
    logger.info(f"Trading bot initialized with ${STARTING_CAPITAL:.2f}")
    
    try:
        while True:
            bot.run_trading_day()
            time.sleep(60)  # Check every minute
    
    except KeyboardInterrupt:
        logger.info("Trading bot stopped by user")
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        
if __name__ == "__main__":
    main()
