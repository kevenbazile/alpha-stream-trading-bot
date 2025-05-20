
# AlgoTrader Bot - High-Risk Momentum Trading

A Python-based algorithmic stock trading bot designed to maximize short-term gains with high-risk momentum-based and breakout trading strategies. The bot utilizes sentiment analysis from social media and technical indicators to make trading decisions.

## Key Features

- **Trading Strategies**:
  - **Sentiment-Based Trading**: Analyzes X (Twitter) posts to detect sentiment on high-volatility stocks.
  - **Breakout Trading**: Identifies price breakouts with volume confirmation and RSI confirmation.
  - **Mean Reversion Strategy**: (Post-challenge) For more stable returns after the initial growth phase.

- **Streaming-Friendly UI**:
  - Live P&L display
  - Real-time sentiment and technical analysis
  - Interactive charts with trade entry/exit points
  - Community polls for strategy selection

- **Risk Management**:
  - Configurable stop-losses
  - Trailing stops for breakout trades
  - Maximum daily loss limits
  - Comprehensive trade logging

## Setup Instructions

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Configure Alpaca API

Create a `.env` file in the project root directory with your Alpaca API credentials:

```
ALPACA_API_KEY=YOUR_API_KEY
ALPACA_API_SECRET=YOUR_API_SECRET
ALPACA_BASE_URL=https://paper-api.alpaca.markets
```

For Twitter API access (optional):

```
TWITTER_API_KEY=YOUR_TWITTER_API_KEY
TWITTER_API_SECRET=YOUR_TWITTER_API_SECRET
TWITTER_ACCESS_TOKEN=YOUR_TWITTER_ACCESS_TOKEN
TWITTER_ACCESS_SECRET=YOUR_TWITTER_ACCESS_SECRET
TWITTER_BEARER_TOKEN=YOUR_TWITTER_BEARER_TOKEN
```

### 3. Run the Bot

To run the trading bot in the background:

```bash
python main.py
```

To launch the Streamlit dashboard:

```bash
streamlit run streamlit_app.py
```

## Project Structure

- `main.py`: Core bot logic with Alpaca trading integration
- `sentiment.py`: Social media sentiment analysis
- `breakout.py`: Technical analysis for breakout detection
- `mean_reversion.py`: Mean reversion strategy implementation
- `streamlit_app.py`: Interactive web dashboard
- `trades.csv`: Log of all executed trades
- `requirements.txt`: Required Python packages

## Trading Parameters

- Starting capital: $100
- Risk per trade: $20-50
- Stop-loss: 5%
- Trailing stop: 10% (for breakout trades)
- Maximum daily loss: 15%
- Target returns: 50-200% in 14-21 days

## Usage Notes

- The bot runs in paper trading mode by default
- For live trading, change the `ALPACA_BASE_URL` to `https://api.alpaca.markets`
- Adjust risk parameters in `main.py` based on your risk tolerance
- Monitor the Streamlit dashboard for real-time performance metrics

## Disclaimer

This trading bot involves high-risk strategies designed for educational and entertainment purposes. It is not financial advice. Trading algorithms can lose money, especially with the aggressive strategies implemented here. Use at your own risk and only with capital you can afford to lose.
