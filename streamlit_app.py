
import streamlit as st
import pandas as pd
import numpy as np
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import time
from datetime import datetime, timedelta
import alpaca_trade_api as tradeapi
import os
from dotenv import load_dotenv
import logging
import threading
import csv

# Import strategy modules
from sentiment import analyze_social_sentiment, get_social_volume, get_top_social_stocks
from breakout import detect_breakouts, calculate_rsi, scan_for_breakout_candidates
from mean_reversion import detect_mean_reversion_opportunities, scan_for_mean_reversion_candidates

# Load environment variables
load_dotenv()

# Alpaca API credentials
API_KEY = os.getenv("ALPACA_API_KEY", "YOUR_KEY")
API_SECRET = os.getenv("ALPACA_API_SECRET", "YOUR_SECRET")
BASE_URL = os.getenv("ALPACA_BASE_URL", "https://paper-api.alpaca.markets")

# Initialize Alpaca API
api = tradeapi.REST(API_KEY, API_SECRET, BASE_URL, api_version='v2')

# Trading parameters - same as in main.py
STARTING_CAPITAL = 100.0
MAX_RISK_PER_TRADE = 50.0
STOP_LOSS_PERCENT = 0.05
TRAILING_STOP_PERCENT = 0.10
MAX_DAILY_LOSS_PERCENT = 0.15

# Stock watchlist
WATCHLIST = {
    "TECH": ["AAPL", "NVDA", "AMD", "TSLA", "MSFT"],
    "CONSUMER": ["NKE", "SBUX", "AMZN", "WMT", "DIS"],
    "HEALTHCARE": ["JNJ", "PFE", "MRNA", "ABBV", "UNH"]
}

# Flatten watchlist
ALL_SYMBOLS = [symbol for sector in WATCHLIST.values() for symbol in sector]

# Global variables for trading bot state
trading_active = False
bot_thread = None

# Load trades from CSV
def load_trades():
    trades = []
    if os.path.exists("trades.csv"):
        with open("trades.csv", 'r') as file:
            reader = csv.DictReader(file)
            for row in reader:
                trades.append(row)
    return trades

# Calculate P&L from trades
def calculate_pnl(trades):
    if not trades:
        return 0
    
    daily_pnl = 0
    today = datetime.now().date()
    
    for trade in trades:
        trade_date = datetime.strptime(trade["timestamp"], "%Y-%m-%d %H:%M:%S").date()
        if trade_date == today and trade["action"].startswith("SELL"):
            daily_pnl += float(trade["pnl"])
    
    return daily_pnl

# Get latest account info
def get_account_info():
    try:
        account = api.get_account()
        return {
            "equity": float(account.equity),
            "cash": float(account.cash),
            "buying_power": float(account.buying_power),
            "pnl": float(account.equity) - STARTING_CAPITAL
        }
    except Exception as e:
        st.error(f"Error getting account info: {e}")
        return {
            "equity": 0,
            "cash": 0,
            "buying_power": 0,
            "pnl": 0
        }

# Get positions
def get_positions():
    try:
        positions = api.list_positions()
        return [{
            "symbol": position.symbol,
            "qty": float(position.qty),
            "entry_price": float(position.avg_entry_price),
            "current_price": float(position.current_price),
            "market_value": float(position.market_value),
            "unrealized_pnl": float(position.unrealized_pl),
            "unrealized_pnl_pct": float(position.unrealized_plpc) * 100
        } for position in positions]
    except Exception as e:
        st.error(f"Error getting positions: {e}")
        return []

# Get historical data for a symbol
def get_historical_data(symbol, timeframe='5Min', limit=100):
    try:
        bars = api.get_bars(symbol, timeframe, limit=limit).df
        return bars
    except Exception as e:
        st.error(f"Error getting historical data for {symbol}: {e}")
        return pd.DataFrame()

# Create candlestick chart with indicators
def create_candlestick_chart(df, symbol, indicators=None, trades=None):
    if df.empty:
        return go.Figure()
    
    # Create figure with secondary y-axis for volume
    fig = make_subplots(
        rows=2, cols=1, 
        shared_xaxes=True,
        vertical_spacing=0.03,
        row_heights=[0.7, 0.3],
        subplot_titles=(f"{symbol} Price", "Volume & RSI")
    )
    
    # Add candlestick trace
    fig.add_trace(
        go.Candlestick(
            x=df.index,
            open=df['open'],
            high=df['high'],
            low=df['low'],
            close=df['close'],
            name="Price",
            increasing_line_color='#26A69A',
            decreasing_line_color='#EF5350'
        ),
        row=1, col=1
    )
    
    # Add volume trace
    fig.add_trace(
        go.Bar(
            x=df.index,
            y=df['volume'],
            name="Volume",
            marker_color='rgba(100,100,255,0.5)'
        ),
        row=2, col=1
    )
    
    # Add indicators if available
    if indicators:
        # Add 20-period high if available
        if 'n_period_high' in indicators:
            fig.add_trace(
                go.Scatter(
                    x=df.index,
                    y=indicators['n_period_high'],
                    name="20-Period High",
                    line=dict(color='rgba(255,165,0,0.7)', width=1, dash='dash')
                ),
                row=1, col=1
            )
        
        # Add RSI if available
        if 'rsi' in indicators:
            fig.add_trace(
                go.Scatter(
                    x=df.index,
                    y=indicators['rsi'],
                    name="RSI",
                    line=dict(color='purple', width=1)
                ),
                row=2, col=1
            )
            
            # Add RSI overbought/oversold lines
            fig.add_shape(
                type="line",
                x0=df.index[0],
                y0=70,
                x1=df.index[-1],
                y1=70,
                line=dict(color="red", width=1, dash="dash"),
                row=2, col=1
            )
            
            fig.add_shape(
                type="line",
                x0=df.index[0],
                y0=30,
                x1=df.index[-1],
                y1=30,
                line=dict(color="green", width=1, dash="dash"),
                row=2, col=1
            )
            
        # Add Bollinger Bands if available
        if all(band in indicators for band in ['upper_band', 'middle_band', 'lower_band']):
            fig.add_trace(
                go.Scatter(
                    x=df.index,
                    y=indicators['upper_band'],
                    name="Upper BB",
                    line=dict(color='rgba(173,216,230,0.7)')
                ),
                row=1, col=1
            )
            
            fig.add_trace(
                go.Scatter(
                    x=df.index,
                    y=indicators['middle_band'],
                    name="Middle BB",
                    line=dict(color='rgba(173,216,230,1)')
                ),
                row=1, col=1
            )
            
            fig.add_trace(
                go.Scatter(
                    x=df.index,
                    y=indicators['lower_band'],
                    name="Lower BB",
                    line=dict(color='rgba(173,216,230,0.7)')
                ),
                row=1, col=1
            )
    
    # Add trade markers if available
    if trades and not df.empty:
        buy_times = []
        buy_prices = []
        sell_times = []
        sell_prices = []
        
        for trade in trades:
            trade_time = datetime.strptime(trade['timestamp'], '%Y-%m-%d %H:%M:%S')
            trade_price = float(trade['price'])
            trade_symbol = trade['symbol']
            
            # Only show trades for this symbol
            if trade_symbol == symbol:
                if trade['action'].startswith('BUY'):
                    buy_times.append(trade_time)
                    buy_prices.append(trade_price)
                elif trade['action'].startswith('SELL'):
                    sell_times.append(trade_time)
                    sell_prices.append(trade_price)
        
        # Add buy markers
        if buy_times:
            fig.add_trace(
                go.Scatter(
                    x=buy_times,
                    y=buy_prices,
                    mode='markers',
                    name='Buy',
                    marker=dict(
                        color='green',
                        size=10,
                        symbol='triangle-up',
                        line=dict(color='black', width=1)
                    )
                ),
                row=1, col=1
            )
        
        # Add sell markers
        if sell_times:
            fig.add_trace(
                go.Scatter(
                    x=sell_times,
                    y=sell_prices,
                    mode='markers',
                    name='Sell',
                    marker=dict(
                        color='red',
                        size=10,
                        symbol='triangle-down',
                        line=dict(color='black', width=1)
                    )
                ),
                row=1, col=1
            )
    
    # Update layout
    fig.update_layout(
        title=f"{symbol} - Stock Price",
        xaxis_title="Date",
        yaxis_title="Price ($)",
        height=600,
        xaxis_rangeslider_visible=False,
        legend=dict(
            orientation="h",
            yanchor="bottom",
            y=1.02,
            xanchor="right",
            x=1
        )
    )
    
    # Hide dates with no data
    fig.update_xaxes(
        rangebreaks=[
            dict(bounds=["sat", "mon"]),  # hide weekends
            dict(bounds=[16, 9.5], pattern="hour")  # hide non-trading hours
        ]
    )
    
    return fig

# Create pie chart for portfolio allocation
def create_portfolio_chart(positions):
    if not positions:
        return go.Figure()
    
    labels = [position['symbol'] for position in positions]
    values = [position['market_value'] for position in positions]
    
    fig = go.Figure(data=[go.Pie(
        labels=labels,
        values=values,
        hole=.3,
        textinfo='label+percent',
        marker=dict(colors=px.colors.qualitative.Pastel)
    )])
    
    fig.update_layout(
        title="Portfolio Allocation",
        height=400
    )
    
    return fig

# Create P&L chart
def create_pnl_chart(trades):
    if not trades:
        return go.Figure()
    
    # Convert trades to DataFrame for easier processing
    df = pd.DataFrame(trades)
    df['timestamp'] = pd.to_datetime(df['timestamp'])
    df['pnl'] = pd.to_numeric(df['pnl'])
    
    # Group by date and aggregate PnL
    daily_pnl = df.groupby(df['timestamp'].dt.date)['pnl'].sum().reset_index()
    daily_pnl['cumulative_pnl'] = daily_pnl['pnl'].cumsum()
    
    # Create figure
    fig = go.Figure()
    
    # Add daily P&L bars
    fig.add_trace(go.Bar(
        x=daily_pnl['timestamp'],
        y=daily_pnl['pnl'],
        name='Daily P&L',
        marker_color=['green' if x >= 0 else 'red' for x in daily_pnl['pnl']]
    ))
    
    # Add cumulative P&L line
    fig.add_trace(go.Scatter(
        x=daily_pnl['timestamp'],
        y=daily_pnl['cumulative_pnl'],
        name='Cumulative P&L',
        line=dict(color='blue', width=2)
    ))
    
    # Update layout
    fig.update_layout(
        title="Trading Performance",
        xaxis_title="Date",
        yaxis_title="P&L ($)",
        height=400,
        legend=dict(
            orientation="h",
            yanchor="bottom",
            y=1.02,
            xanchor="right",
            x=1
        )
    )
    
    return fig

# Add community poll for strategy selection
def create_strategy_poll():
    st.sidebar.header("Community Poll: Strategy Selection")
    
    sentiment_strategy = st.sidebar.checkbox("Enable Sentiment Strategy", value=True)
    breakout_strategy = st.sidebar.checkbox("Enable Breakout Strategy", value=True)
    mean_reversion_strategy = st.sidebar.checkbox("Enable Mean Reversion Strategy", value=False)
    
    if st.sidebar.button("Update Strategy Settings"):
        strategies = {
            "sentiment": sentiment_strategy,
            "breakout": breakout_strategy,
            "mean_reversion": mean_reversion_strategy
        }
        
        # Update strategies in session state
        st.session_state.strategies = strategies
        st.sidebar.success("Strategy settings updated! 🎉")
    
    st.sidebar.markdown("---")
    
    return {
        "sentiment": sentiment_strategy,
        "breakout": breakout_strategy,
        "mean_reversion": mean_reversion_strategy
    }

# Display trades table
def display_trades_table(trades):
    if not trades:
        st.info("No trades have been executed yet.")
        return
    
    # Convert to DataFrame for easier display
    df = pd.DataFrame(trades)
    df['timestamp'] = pd.to_datetime(df['timestamp'])
    
    # Reorder and format columns
    columns = ['timestamp', 'symbol', 'action', 'price', 'shares', 'pnl', 'strategy']
    df = df[columns]
    
    # Format timestamp
    df['timestamp'] = df['timestamp'].dt.strftime('%Y-%m-%d %H:%M:%S')
    
    # Format numeric columns
    df['price'] = df['price'].astype(float).round(2)
    df['shares'] = df['shares'].astype(float).round(4)
    df['pnl'] = df['pnl'].astype(float).round(2)
    
    # Style the DataFrame
    styled_df = df.style.format({
        'price': '${:.2f}',
        'shares': '{:.4f}',
        'pnl': '${:.2f}'
    })
    
    # Apply color to P&L
    styled_df = styled_df.applymap(
        lambda x: 'color: green' if isinstance(x, (int, float)) and x > 0 else 'color: red' if isinstance(x, (int, float)) and x < 0 else '',
        subset=['pnl']
    )
    
    # Display with title
    st.subheader("Recent Trades")
    st.dataframe(styled_df, use_container_width=True)

# Main app
def main():
    # Set page configuration
    st.set_page_config(
        page_title="AlgoTrader Bot",
        page_icon="📈",
        layout="wide",
        initial_sidebar_state="expanded"
    )
    
    # Initialize session state for strategies
    if 'strategies' not in st.session_state:
        st.session_state.strategies = {
            "sentiment": True,
            "breakout": True,
            "mean_reversion": False
        }
    
    # Add sidebar with strategy poll
    strategies = create_strategy_poll()
    
    # Title and description
    st.title("📈 AlgoTrader Bot")
    st.markdown("""
    High-risk momentum and breakout trading strategies with sentiment analysis.
    Starting with $100 capital, aiming for 50-200% returns in 14-21 days.
    """)
    
    # Load trades data
    trades = load_trades()
    
    # Performance Metrics Row
    col1, col2, col3, col4 = st.columns(4)
    
    # Calculate metrics
    daily_pnl = calculate_pnl(trades)
    account_info = get_account_info()
    positions = get_positions()
    
    with col1:
        current_value = account_info["equity"]
        pnl_pct = ((current_value - STARTING_CAPITAL) / STARTING_CAPITAL) * 100
        pnl_color = "green" if pnl_pct >= 0 else "red"
        
        st.metric(
            label="Account Value",
            value=f"${current_value:.2f}",
            delta=f"{pnl_pct:.1f}% from start"
        )
    
    with col2:
        daily_pnl_color = "green" if daily_pnl >= 0 else "red"
        st.metric(
            label="Today's P&L",
            value=f"${daily_pnl:.2f}",
            delta=f"{daily_pnl:.2f}"
        )
    
    with col3:
        positions_count = len(positions)
        active_capital = sum(float(p['market_value']) for p in positions)
        st.metric(
            label="Active Positions",
            value=positions_count,
            delta=f"${active_capital:.2f} deployed"
        )
    
    with col4:
        available_cash = account_info["cash"]
        st.metric(
            label="Available Cash",
            value=f"${available_cash:.2f}",
            delta=f"{available_cash/current_value*100:.1f}% of account"
        )
    
    # Tabs for different sections
    tab1, tab2, tab3, tab4 = st.tabs(["Dashboard", "Sentiment Analysis", "Technical Signals", "Trade History"])
    
    with tab1:
        # Main dashboard view
        col1, col2 = st.columns([2, 1])
        
        with col1:
            # Chart for selected stock
            st.subheader("Live Chart")
            selected_symbol = st.selectbox("Select Symbol", ALL_SYMBOLS, index=0)
            chart_timeframe = st.radio("Timeframe", ["5Min", "15Min", "1Hour", "1Day"], horizontal=True)
            
            # Get data and create chart
            df = get_historical_data(selected_symbol, chart_timeframe)
            
            # Prepare indicators
            indicators = {}
            
            if not df.empty:
                # For breakout strategy
                df['n_period_high'] = df['high'].rolling(window=20).max().shift(1)
                indicators['n_period_high'] = df['n_period_high']
                
                # Calculate RSI
                df['rsi'] = ta.rsi(df['close'], length=14)
                indicators['rsi'] = df['rsi']
                
                # For mean reversion
                if chart_timeframe == "1Day":
                    df['middle_band'] = df['close'].rolling(window=20).mean()
                    df['std'] = df['close'].rolling(window=20).std()
                    df['upper_band'] = df['middle_band'] + (df['std'] * 2)
                    df['lower_band'] = df['middle_band'] - (df['std'] * 2)
                    
                    indicators['upper_band'] = df['upper_band']
                    indicators['middle_band'] = df['middle_band']
                    indicators['lower_band'] = df['lower_band']
            
            fig = create_candlestick_chart(df, selected_symbol, indicators, trades)
            st.plotly_chart(fig, use_container_width=True)
        
        with col2:
            # Portfolio positions
            st.subheader("Current Positions")
            
            if positions:
                for position in positions:
                    symbol = position["symbol"]
                    qty = position["qty"]
                    entry_price = position["entry_price"]
                    current_price = position["current_price"]
                    unrealized_pnl = position["unrealized_pnl"]
                    unrealized_pnl_pct = position["unrealized_pnl_pct"]
                    
                    pnl_color = "green" if unrealized_pnl >= 0 else "red"
                    
                    position_col1, position_col2 = st.columns([3, 2])
                    
                    with position_col1:
                        st.markdown(f"**{symbol}** - {qty:.4f} shares")
                        st.caption(f"Entry: ${entry_price:.2f} | Current: ${current_price:.2f}")
                    
                    with position_col2:
                        st.markdown(f"<span style='color:{pnl_color}; font-weight:bold;'>${unrealized_pnl:.2f} ({unrealized_pnl_pct:.2f}%)</span>", unsafe_allow_html=True)
                    
                    st.divider()
            else:
                st.info("No active positions")
                
            # Recent trades
            st.subheader("Recent Trades")
            if trades:
                recent_trades = trades[-5:]  # Show 5 most recent trades
                for trade in reversed(recent_trades):
                    trade_col1, trade_col2 = st.columns([3, 2])
                    
                    symbol = trade["symbol"]
                    action = trade["action"]
                    price = float(trade["price"])
                    shares = float(trade["shares"])
                    pnl = float(trade["pnl"]) if "pnl" in trade else 0
                    
                    action_color = "green" if action.startswith("BUY") else "red"
                    pnl_color = "green" if pnl > 0 else "red" if pnl < 0 else "gray"
                    
                    with trade_col1:
                        st.markdown(f"<span style='color:{action_color};'>{action}</span> {symbol} - {shares:.4f} @ ${price:.2f}", unsafe_allow_html=True)
                        timestamp = datetime.strptime(trade["timestamp"], "%Y-%m-%d %H:%M:%S")
                        st.caption(f"{timestamp.strftime('%m/%d %H:%M')} - {trade['strategy']} strategy")
                    
                    with trade_col2:
                        if action.startswith("SELL"):
                            st.markdown(f"<span style='color:{pnl_color};'>${pnl:.2f}</span>", unsafe_allow_html=True)
                
                st.divider()
            else:
                st.info("No recent trades")
    
    with tab2:
        # Sentiment Analysis Section
        st.subheader("Social Media Sentiment Analysis")
        
        sentiment_col1, sentiment_col2 = st.columns([2, 1])
        
        with sentiment_col1:
            st.markdown("### Top Stocks by Social Sentiment")
            
            # Create a table of sentiment data
            sentiment_data = []
            for symbol in ALL_SYMBOLS[:10]:  # Limit to 10 symbols for performance
                sentiment_score = analyze_social_sentiment(symbol)
                post_volume = get_social_volume(symbol)
                
                sentiment_label = "Bullish" if sentiment_score > 0.6 else "Neutral" if sentiment_score > 0.4 else "Bearish"
                sentiment_color = "green" if sentiment_score > 0.6 else "gray" if sentiment_score > 0.4 else "red"
                
                sentiment_data.append({
                    "Symbol": symbol,
                    "Sentiment": sentiment_score,
                    "Label": sentiment_label,
                    "Color": sentiment_color,
                    "Post Volume": post_volume,
                    "Score": sentiment_score * post_volume  # Combined score
                })
            
            # Sort by combined score (sentiment * volume)
            sentiment_data = sorted(sentiment_data, key=lambda x: x["Score"], reverse=True)
            
            # Display as a formatted table
            for item in sentiment_data:
                col1, col2, col3 = st.columns([1, 2, 1])
                
                with col1:
                    st.markdown(f"**{item['Symbol']}**")
                
                with col2:
                    # Create a sentiment meter
                    sentiment_value = item["Sentiment"]
                    st.markdown(
                        f"<div style='background-color: #f0f0f0; border-radius: 10px; height: 10px; width: 100%;'>"
                        f"<div style='background-color: {item['Color']}; border-radius: 10px; height: 10px; width: {sentiment_value*100}%;'></div>"
                        f"</div>",
                        unsafe_allow_html=True
                    )
                    st.caption(f"{item['Label']} ({sentiment_value:.2f})")
                
                with col3:
                    st.markdown(f"**{item['Post Volume']}** posts")
                
                st.divider()
        
        with sentiment_col2:
            st.markdown("### Sentiment Alert Setup")
            
            # Sliders to configure sentiment strategy
            sentiment_threshold = st.slider("Sentiment Threshold", 0.0, 1.0, 0.5, 0.05)
            volume_threshold = st.slider("Minimum Post Volume", 10, 500, 100, 10)
            
            st.markdown(f"""
            **Current Settings:**
            - Buy when sentiment > {sentiment_threshold} 
            - AND post volume > {volume_threshold}
            - Risk $20-$50 per trade
            - 5% stop-loss
            - Sell on 50-100% gain or market close
            """)
            
            # Show recent sentiment-based trades
            sentiment_trades = [t for t in trades if t["strategy"] == "sentiment"]
            if sentiment_trades:
                st.markdown("### Recent Sentiment Trades")
                for trade in sentiment_trades[-3:]:  # Show 3 most recent
                    st.markdown(f"**{trade['action']}** {trade['symbol']} @ ${float(trade['price']):.2f}")
                    st.caption(f"{trade['timestamp']}")
            else:
                st.info("No sentiment-based trades yet")
    
    with tab3:
        # Technical Analysis Section
        st.subheader("Technical Trading Signals")
        
        tech_col1, tech_col2 = st.columns([3, 2])
        
        with tech_col1:
            st.markdown("### Breakout Scanner")
            
            # Show breakout candidates
            st.markdown("Scanning for breakout candidates...")
            
            # Create mock breakout candidates for display
            breakout_data = []
            for symbol in ALL_SYMBOLS[:5]:  # Limit to 5 symbols for performance
                df = get_historical_data(symbol, '5Min')
                
                if not df.empty:
                    # Calculate metrics
                    df['n_period_high'] = df['high'].rolling(window=20).max().shift(1)
                    
                    if len(df) > 20:
                        rsi = calculate_rsi(df)
                        current_price = df['close'].iloc[-1]
                        n_period_high = df['n_period_high'].iloc[-1]
                        
                        # Distance to breakout
                        distance_pct = (n_period_high - current_price) / current_price * 100
                        
                        # Check if already broken out
                        is_breakout = current_price > n_period_high
                        
                        # For demo, generate random quality score
                        quality_score = np.random.randint(60, 95) if is_breakout or distance_pct < 2 else np.random.randint(30, 70)
                        
                        breakout_data.append({
                            "Symbol": symbol,
                            "Price": current_price,
                            "Period High": n_period_high,
                            "Distance": distance_pct,
                            "RSI": rsi,
                            "Breakout": is_breakout,
                            "Score": quality_score
                        })
            
            # Sort by score
            breakout_data = sorted(breakout_data, key=lambda x: x["Score"], reverse=True)
            
            # Display as cards
            for item in breakout_data:
                col1, col2, col3 = st.columns([1, 1, 1])
                
                status_color = "green" if item["Breakout"] else "orange" if item["Distance"] < 2 else "gray"
                status_text = "BREAKOUT" if item["Breakout"] else f"{item['Distance']:.2f}% below high"
                
                with col1:
                    st.markdown(f"**{item['Symbol']}** - ${item['Price']:.2f}")
                
                with col2:
                    st.markdown(f"<span style='color:{status_color};'>{status_text}</span>", unsafe_allow_html=True)
                    st.caption(f"RSI: {item['RSI']:.1f}")
                
                with col3:
                    # Display quality score as a gauge
                    st.markdown(f"Score: **{item['Score']}/100**")
                    st.progress(item["Score"]/100)
                
                st.divider()
        
        with tech_col2:
            st.markdown("### Mean Reversion Scanner")
            
            # Only show if mean reversion strategy is enabled
            if strategies["mean_reversion"]:
                # Create mock mean reversion candidates for display
                mr_data = []
                for symbol in ALL_SYMBOLS[:3]:  # Limit to 3 symbols for performance
                    df = get_historical_data(symbol, '1Day')
                    
                    if not df.empty and len(df) > 20:
                        # Calculate Bollinger Bands
                        df['middle_band'] = df['close'].rolling(window=20).mean()
                        df['std'] = df['close'].rolling(window=20).std()
                        df['lower_band'] = df['middle_band'] - (df['std'] * 2)
                        
                        current_price = df['close'].iloc[-1]
                        lower_band = df['lower_band'].iloc[-1]
                        middle_band = df['middle_band'].iloc[-1]
                        
                        # Check if price near or below lower band
                        near_band = current_price <= lower_band * 1.05
                        
                        if near_band:
                            # Calculate potential return
                            potential_return = (middle_band - current_price) / current_price * 100
                            
                            mr_data.append({
                                "Symbol": symbol,
                                "Price": current_price,
                                "Lower Band": lower_band,
                                "Target": middle_band,
                                "Return": potential_return
                            })
                
                if mr_data:
                    # Sort by potential return
                    mr_data = sorted(mr_data, key=lambda x: x["Return"], reverse=True)
                    
                    for item in mr_data:
                        st.markdown(f"**{item['Symbol']}** - ${item['Price']:.2f}")
                        st.caption(f"Lower band: ${item['Lower Band']:.2f}")
                        st.markdown(f"Potential return: **{item['Return']:.2f}%** to mean")
                        st.divider()
                else:
                    st.info("No mean reversion opportunities found")
            else:
                st.info("Mean Reversion strategy is currently disabled")
    
    with tab4:
        # Trade History
        display_trades_table(trades)
        
        # P&L chart
        if trades:
            pnl_fig = create_pnl_chart(trades)
            st.plotly_chart(pnl_fig, use_container_width=True)

# Run the Streamlit app
if __name__ == "__main__":
    main()
