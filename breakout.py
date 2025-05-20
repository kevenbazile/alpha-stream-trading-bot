
import pandas as pd
import numpy as np
import pandas_ta as ta
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def calculate_rsi(df, period=14):
    """Calculate RSI for a dataframe of price data"""
    try:
        # Use pandas_ta for efficient RSI calculation
        df['rsi'] = ta.rsi(df['close'], length=period)
        
        # Return the latest RSI value
        return df['rsi'].iloc[-1]
    except Exception as e:
        logger.error(f"Error calculating RSI: {e}")
        return 50  # Return neutral RSI on error

def calculate_average_volume(df, period=20):
    """Calculate average volume over a period"""
    try:
        return df['volume'].rolling(window=period).mean().iloc[-1]
    except Exception as e:
        logger.error(f"Error calculating average volume: {e}")
        return df['volume'].mean()  # Fallback to simple mean

def calculate_volatility(df, period=20):
    """Calculate price volatility (standard deviation of returns)"""
    try:
        return df['close'].pct_change().rolling(window=period).std().iloc[-1] * 100  # Convert to percentage
    except Exception as e:
        logger.error(f"Error calculating volatility: {e}")
        return 0.01  # Default to 1% volatility on error

def detect_breakouts(df, period=20):
    """
    Detect price breakouts:
    - Price crosses above N-period high
    - Volume is above average
    - Returns True if breakout detected
    """
    try:
        # Make sure we have enough data
        if len(df) < period + 5:
            return False
            
        # Calculate N-period high (excluding the current bar)
        df['n_period_high'] = df['high'].rolling(window=period).max().shift(1)
        
        # Calculate average volume
        avg_volume = calculate_average_volume(df, period)
        
        # Current bar data
        current_price = df['close'].iloc[-1]
        current_high = df['high'].iloc[-1]
        previous_high = df['n_period_high'].iloc[-1]
        current_volume = df['volume'].iloc[-1]
        
        # Check for volume surge
        volume_surge = current_volume > (avg_volume * 2)
        
        # Check if we've crossed above the previous period high
        price_breakout = current_high > previous_high and current_price > previous_high
        
        # A breakout is confirmed when price breaks above period high with increased volume
        return price_breakout and volume_surge
        
    except Exception as e:
        logger.error(f"Error detecting breakout: {e}")
        return False

def detect_breakdown(df, period=20):
    """
    Detect price breakdowns (opposite of breakouts):
    - Price crosses below N-period low
    - Volume is above average
    - Returns True if breakdown detected
    """
    try:
        # Make sure we have enough data
        if len(df) < period + 5:
            return False
            
        # Calculate N-period low (excluding the current bar)
        df['n_period_low'] = df['low'].rolling(window=period).min().shift(1)
        
        # Calculate average volume
        avg_volume = calculate_average_volume(df, period)
        
        # Current bar data
        current_price = df['close'].iloc[-1]
        current_low = df['low'].iloc[-1]
        previous_low = df['n_period_low'].iloc[-1]
        current_volume = df['volume'].iloc[-1]
        
        # Check for volume surge
        volume_surge = current_volume > (avg_volume * 2)
        
        # Check if we've crossed below the previous period low
        price_breakdown = current_low < previous_low and current_price < previous_low
        
        # A breakdown is confirmed when price breaks below period low with increased volume
        return price_breakdown and volume_surge
        
    except Exception as e:
        logger.error(f"Error detecting breakdown: {e}")
        return False

def find_support_resistance(df, window=20):
    """
    Find support and resistance levels:
    - Support: Areas where price has bounced up multiple times
    - Resistance: Areas where price has been rejected down multiple times
    """
    support_levels = []
    resistance_levels = []
    
    try:
        # Make sure we have enough data
        if len(df) < window * 2:
            return [], []
            
        # Calculate local minimums and maximums
        for i in range(window, len(df) - window):
            # Check if this is a local minimum (potential support)
            if all(df['low'].iloc[i] <= df['low'].iloc[i-window:i]) and all(df['low'].iloc[i] <= df['low'].iloc[i+1:i+window+1]):
                support_levels.append(df['low'].iloc[i])
                
            # Check if this is a local maximum (potential resistance)
            if all(df['high'].iloc[i] >= df['high'].iloc[i-window:i]) and all(df['high'].iloc[i] >= df['high'].iloc[i+1:i+window+1]):
                resistance_levels.append(df['high'].iloc[i])
        
        # Group similar levels (within 1% of each other)
        support_levels = group_similar_levels(support_levels)
        resistance_levels = group_similar_levels(resistance_levels)
        
        return support_levels, resistance_levels
        
    except Exception as e:
        logger.error(f"Error finding support/resistance levels: {e}")
        return [], []

def group_similar_levels(levels, threshold=0.01):
    """Group price levels that are within threshold% of each other"""
    if not levels:
        return []
        
    # Sort levels
    sorted_levels = sorted(levels)
    
    # Group similar levels
    grouped_levels = []
    current_group = [sorted_levels[0]]
    
    for i in range(1, len(sorted_levels)):
        current_level = sorted_levels[i]
        prev_level = current_group[-1]
        
        # If this level is within threshold% of the previous level, add to current group
        if abs(current_level - prev_level) / prev_level <= threshold:
            current_group.append(current_level)
        else:
            # This level is not similar to previous, so start a new group
            grouped_levels.append(sum(current_group) / len(current_group))
            current_group = [current_level]
    
    # Add the last group
    if current_group:
        grouped_levels.append(sum(current_group) / len(current_group))
    
    return grouped_levels

def is_price_near_level(price, levels, threshold=0.02):
    """Check if price is near any support/resistance level (within threshold%)"""
    for level in levels:
        if abs(price - level) / level <= threshold:
            return True
    return False

def calculate_atr(df, period=14):
    """Calculate Average True Range (ATR) - measure of volatility"""
    try:
        # Use pandas_ta for efficient ATR calculation
        df['atr'] = ta.atr(df['high'], df['low'], df['close'], length=period)
        return df['atr'].iloc[-1]
    except Exception as e:
        logger.error(f"Error calculating ATR: {e}")
        # Estimate ATR by average of high-low range
        return (df['high'] - df['low']).tail(period).mean()

def calculate_risk_to_reward(entry, stop_loss, target):
    """Calculate risk-to-reward ratio"""
    if entry == stop_loss:  # Avoid division by zero
        return 0
    
    risk = abs(entry - stop_loss)
    reward = abs(target - entry)
    
    return reward / risk if risk > 0 else 0

def analyze_breakout_quality(df, rsi, volatility):
    """
    Score the quality of a breakout from 0-100
    Higher scores indicate better quality breakouts
    """
    score = 0
    
    try:
        # 1. RSI momentum (0-25 points)
        # Best between 60-80, not overbought
        if 60 <= rsi <= 80:
            score += 25
        elif rsi > 80:
            score += 10  # Overbought, less ideal
        elif rsi >= 50:
            score += 15
        
        # 2. Volume confirmation (0-25 points)
        avg_volume = calculate_average_volume(df)
        latest_volume = df['volume'].iloc[-1]
        volume_ratio = latest_volume / avg_volume
        
        if volume_ratio >= 3:
            score += 25
        elif volume_ratio >= 2:
            score += 20
        elif volume_ratio >= 1.5:
            score += 15
        elif volume_ratio >= 1:
            score += 10
        
        # 3. Price action (0-25 points)
        # Bullish candle with close near high
        latest_close = df['close'].iloc[-1]
        latest_open = df['open'].iloc[-1]
        latest_high = df['high'].iloc[-1]
        latest_low = df['low'].iloc[-1]
        
        candle_range = latest_high - latest_low
        if candle_range == 0:  # Avoid division by zero
            upper_wick_ratio = 0
        else:
            upper_wick_ratio = (latest_high - max(latest_open, latest_close)) / candle_range
        
        # Strong bullish close with small upper wick is ideal
        if latest_close > latest_open and upper_wick_ratio < 0.2:
            score += 25
        elif latest_close > latest_open:
            score += 15
        elif latest_close == latest_open:
            score += 5
        
        # 4. Volatility boost (0-15 points)
        # Some volatility is good, but not too much
        if 0.5 <= volatility <= 2:
            score += 15
        elif 2 < volatility <= 4:
            score += 10
        elif volatility > 4:
            score += 5
        
        # 5. Previous attempts (0-10 points)
        # Check if price has tested this level before
        if 'n_period_high' in df.columns:
            period_high = df['n_period_high'].iloc[-1]
            previous_tests = sum((df['high'].shift(1) > period_high * 0.98) & (df['high'].shift(1) < period_high * 1.02))
            
            if previous_tests >= 3:
                score += 10
            elif previous_tests >= 1:
                score += 5
        
    except Exception as e:
        logger.error(f"Error analyzing breakout quality: {e}")
    
    return min(score, 100)  # Cap at 100

def scan_for_breakout_candidates(symbols, api, lookback_days=5):
    """
    Scan a list of symbols for potential breakout candidates
    Returns sorted list of candidates with scores
    """
    candidates = []
    
    for symbol in symbols:
        try:
            # Get historical data
            bars = api.get_bars(symbol, '5Min', limit=100).df
            
            if len(bars) < 30:
                continue
                
            rsi = calculate_rsi(bars)
            volatility = calculate_volatility(bars)
            
            # Check if close to breaking out (within 1% of period high)
            period_high = bars['high'].tail(lookback_days * 78).max()  # 5 days, 78 5-min bars per day
            current_price = bars['close'].iloc[-1]
            
            # If within 2% of period high, consider it a candidate
            distance_to_high = (period_high - current_price) / current_price
            
            if distance_to_high <= 0.02 and distance_to_high >= 0:
                # Actual breakout already detected
                is_breakout = detect_breakouts(bars)
                
                # Calculate quality score
                score = analyze_breakout_quality(bars, rsi, volatility)
                
                candidates.append({
                    'symbol': symbol,
                    'price': current_price,
                    'period_high': period_high,
                    'distance_to_high': distance_to_high * 100,  # Convert to percentage
                    'rsi': rsi,
                    'volatility': volatility,
                    'breakout_detected': is_breakout,
                    'quality_score': score
                })
                
        except Exception as e:
            logger.error(f"Error scanning {symbol} for breakouts: {e}")
    
    # Sort by quality score (highest first)
    candidates.sort(key=lambda x: x['quality_score'], reverse=True)
    
    return candidates

# For testing
if __name__ == "__main__":
    # Generate sample data
    dates = pd.date_range(start='2023-01-01', periods=100, freq='5min')
    data = {
        'open': np.random.normal(100, 2, 100),
        'high': np.random.normal(102, 2, 100),
        'low': np.random.normal(98, 2, 100),
        'close': np.random.normal(101, 2, 100),
        'volume': np.random.normal(1000, 200, 100)
    }
    
    # Make sure high is highest, low is lowest
    for i in range(len(data['open'])):
        values = [data['open'][i], data['close'][i]]
        data['high'][i] = max(values) + abs(np.random.normal(0, 0.5))
        data['low'][i] = min(values) - abs(np.random.normal(0, 0.5))
    
    # Create a breakout pattern at the end
    for i in range(90, 100):
        data['close'][i] = 105 + (i - 90)
        data['high'][i] = data['close'][i] + 1
        data['low'][i] = data['close'][i] - 0.5
        data['open'][i] = data['close'][i] - 1
        data['volume'][i] = 2000 + (i - 90) * 200
    
    df = pd.DataFrame(data, index=dates)
    
    # Test breakout detection
    is_breakout = detect_breakouts(df)
    rsi = calculate_rsi(df)
    volatility = calculate_volatility(df)
    
    print(f"Breakout detected: {is_breakout}")
    print(f"RSI: {rsi}")
    print(f"Volatility: {volatility}%")
    
    # Test support/resistance finder
    support, resistance = find_support_resistance(df)
    print(f"Support levels: {support}")
    print(f"Resistance levels: {resistance}")
