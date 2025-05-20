
import pandas as pd
import numpy as np
import pandas_ta as ta
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def calculate_bollinger_bands(df, window=20, num_std=2):
    """
    Calculate Bollinger Bands
    - window: lookback period
    - num_std: number of standard deviations for bands
    """
    try:
        # Calculate rolling mean and standard deviation
        df['middle_band'] = df['close'].rolling(window=window).mean()
        df['std'] = df['close'].rolling(window=window).std()
        
        # Calculate upper and lower bands
        df['upper_band'] = df['middle_band'] + (df['std'] * num_std)
        df['lower_band'] = df['middle_band'] - (df['std'] * num_std)
        
        return df
    except Exception as e:
        logger.error(f"Error calculating Bollinger Bands: {e}")
        return df

def calculate_mean_reversion_metrics(df):
    """Calculate metrics for mean reversion strategy"""
    try:
        # Calculate percentage deviation from 20-day mean
        df['pct_deviation'] = (df['close'] - df['middle_band']) / df['middle_band'] * 100
        
        # Calculate z-score (number of standard deviations from mean)
        df['z_score'] = df['pct_deviation'] / (df['std'] / df['middle_band'] * 100)
        
        # Calculate how many days we've been below/above the mean
        df['above_mean'] = (df['close'] > df['middle_band']).astype(int)
        df['below_mean'] = (df['close'] < df['middle_band']).astype(int)
        df['consec_above'] = df['above_mean'].groupby((df['above_mean'] != df['above_mean'].shift()).cumsum()).cumcount() + df['above_mean']
        df['consec_below'] = df['below_mean'].groupby((df['below_mean'] != df['below_mean'].shift()).cumsum()).cumcount() + df['below_mean']
        
        # RSI for oversold/overbought conditions
        df['rsi'] = ta.rsi(df['close'], length=14)
        
        return df
    except Exception as e:
        logger.error(f"Error calculating mean reversion metrics: {e}")
        return df

def detect_mean_reversion_opportunities(df, window=20, std_threshold=2.0):
    """
    Detect mean reversion opportunities
    - Price is below lower Bollinger Band (oversold)
    - RSI is below 30 (oversold)
    - Returns (opportunity, entry_price, target_price)
    """
    try:
        # Make sure we have enough data
        if len(df) < window:
            return False, None, None
            
        # Calculate Bollinger Bands
        df = calculate_bollinger_bands(df, window=window, num_std=std_threshold)
        
        # Calculate additional metrics
        df = calculate_mean_reversion_metrics(df)
        
        # Get latest values
        latest = df.iloc[-1]
        current_price = latest['close']
        lower_band = latest['lower_band']
        middle_band = latest['middle_band']
        rsi = latest['rsi'] if 'rsi' in latest else 50
        
        # Check for mean reversion opportunity
        if current_price <= lower_band and rsi <= 30:
            # Entry at current price, target at middle band
            return True, current_price, middle_band
            
        return False, None, None
        
    except Exception as e:
        logger.error(f"Error detecting mean reversion opportunities: {e}")
        return False, None, None

def detect_overbought_conditions(df, window=20, std_threshold=2.0):
    """
    Detect overbought conditions for potential short positions
    - Price is above upper Bollinger Band (overbought)
    - RSI is above 70 (overbought)
    - Returns (opportunity, entry_price, target_price)
    """
    try:
        # Make sure we have enough data
        if len(df) < window:
            return False, None, None
            
        # Calculate Bollinger Bands
        df = calculate_bollinger_bands(df, window=window, num_std=std_threshold)
        
        # Calculate additional metrics
        df = calculate_mean_reversion_metrics(df)
        
        # Get latest values
        latest = df.iloc[-1]
        current_price = latest['close']
        upper_band = latest['upper_band']
        middle_band = latest['middle_band']
        rsi = latest['rsi'] if 'rsi' in latest else 50
        
        # Check for overbought conditions
        if current_price >= upper_band and rsi >= 70:
            # Short entry at current price, target at middle band
            return True, current_price, middle_band
            
        return False, None, None
        
    except Exception as e:
        logger.error(f"Error detecting overbought conditions: {e}")
        return False, None, None

def get_mean_reversion_score(df, window=20):
    """
    Score potential mean reversion trades from 0-100
    Higher scores indicate better opportunities
    """
    try:
        # Make sure we have enough data
        if len(df) < window:
            return 0
            
        # Calculate Bollinger Bands and metrics
        df = calculate_bollinger_bands(df, window=window)
        df = calculate_mean_reversion_metrics(df)
        
        # Get latest values
        latest = df.iloc[-1]
        
        # Initialize score
        score = 0
        
        # 1. Deviation from mean (0-30 points)
        # More negative deviation = higher score
        pct_deviation = latest['pct_deviation']
        if pct_deviation <= -5:
            score += 30
        elif pct_deviation <= -4:
            score += 25
        elif pct_deviation <= -3:
            score += 20
        elif pct_deviation <= -2:
            score += 15
        elif pct_deviation <= -1:
            score += 10
        
        # 2. RSI condition (0-25 points)
        # Lower RSI = higher score
        rsi = latest['rsi'] if 'rsi' in latest else 50
        if rsi <= 20:
            score += 25
        elif rsi <= 25:
            score += 20
        elif rsi <= 30:
            score += 15
        elif rsi <= 35:
            score += 10
        elif rsi <= 40:
            score += 5
        
        # 3. Bouncing off support (0-15 points)
        # Check if price has bounced up from lower band
        if len(df) >= 3:
            prev1 = df.iloc[-2]
            prev2 = df.iloc[-3]
            if (prev2['close'] <= prev2['lower_band'] and 
                prev1['close'] > prev1['close'].shift(1) and 
                latest['close'] > prev1['close']):
                score += 15
            elif prev1['close'] <= prev1['lower_band'] and latest['close'] > prev1['close']:
                score += 10
        
        # 4. Volume confirmation (0-15 points)
        # Higher recent volume = better confirmation
        if 'volume' in df.columns:
            avg_vol = df['volume'].rolling(window=window).mean().iloc[-1]
            current_vol = latest['volume']
            
            vol_ratio = current_vol / avg_vol if avg_vol > 0 else 1
            
            if vol_ratio >= 2:
                score += 15
            elif vol_ratio >= 1.5:
                score += 10
            elif vol_ratio >= 1:
                score += 5
        
        # 5. Historical mean reversion success (0-15 points)
        # Check how often price returns to mean when this oversold
        z_score = latest['z_score']
        
        # Find historical instances with similar z-scores
        historical_instances = df[df['z_score'] <= z_score].index
        success_count = 0
        
        for idx in historical_instances:
            # Look forward up to 20 bars
            forward_window = min(20, len(df) - df.index.get_loc(idx) - 1)
            if forward_window <= 0:
                continue
                
            # Check if price returned to mean within forward window
            future_slice = df.loc[idx:].iloc[1:forward_window+1]
            if any(future_slice['close'] >= future_slice['middle_band']):
                success_count += 1
        
        # Calculate success rate
        success_rate = success_count / len(historical_instances) if len(historical_instances) > 0 else 0
        
        if success_rate >= 0.8:
            score += 15
        elif success_rate >= 0.6:
            score += 10
        elif success_rate >= 0.4:
            score += 5
        
        return min(score, 100)  # Cap at 100
        
    except Exception as e:
        logger.error(f"Error calculating mean reversion score: {e}")
        return 0

def scan_for_mean_reversion_candidates(symbols, api, window=20, std_threshold=2.0):
    """
    Scan a list of symbols for potential mean reversion candidates
    Returns sorted list of candidates with scores
    """
    candidates = []
    
    for symbol in symbols:
        try:
            # Get historical data (daily bars)
            bars = api.get_bars(symbol, '1D', limit=50).df
            
            if len(bars) < window + 5:
                continue
                
            # Calculate Bollinger Bands and metrics
            bars = calculate_bollinger_bands(bars, window=window, num_std=std_threshold)
            bars = calculate_mean_reversion_metrics(bars)
            
            # Get latest values
            latest = bars.iloc[-1]
            current_price = latest['close']
            lower_band = latest['lower_band']
            middle_band = latest['middle_band']
            pct_deviation = latest['pct_deviation']
            rsi = latest['rsi'] if 'rsi' in latest else 50
            
            # Check if potential candidate (price near or below lower band)
            if current_price <= lower_band * 1.02:
                # Calculate score
                score = get_mean_reversion_score(bars, window)
                
                # Calculate potential profit (%)
                profit_potential = (middle_band - current_price) / current_price * 100
                
                candidates.append({
                    'symbol': symbol,
                    'price': current_price,
                    'lower_band': lower_band,
                    'middle_band': middle_band,
                    'pct_deviation': pct_deviation,
                    'rsi': rsi,
                    'profit_potential': profit_potential,
                    'score': score
                })
                
        except Exception as e:
            logger.error(f"Error scanning {symbol} for mean reversion: {e}")
    
    # Sort by score (highest first)
    candidates.sort(key=lambda x: x['score'], reverse=True)
    
    return candidates

def calculate_reversal_probability(df):
    """
    Calculate probability of price reverting to mean
    based on historical data patterns
    """
    try:
        if len(df) < 100:  # Need sufficient history
            return 0.5  # Default to 50% probability
            
        # Calculate mean reversion metrics if not already done
        if 'z_score' not in df.columns:
            df = calculate_bollinger_bands(df)
            df = calculate_mean_reversion_metrics(df)
            
        latest_z = df['z_score'].iloc[-1]
        
        # Find historical instances with similar z-scores
        similar_instances = df[(df['z_score'] <= latest_z * 1.1) & 
                              (df['z_score'] >= latest_z * 0.9)].index
        
        if len(similar_instances) < 5:
            return 0.5  # Not enough similar instances
            
        success_count = 0
        
        for idx in similar_instances[:-1]:  # Exclude current instance
            idx_loc = df.index.get_loc(idx)
            
            # Look forward up to 20 bars
            forward_window = min(20, len(df) - idx_loc - 1)
            if forward_window <= 0:
                continue
                
            # Check if price returned to mean within forward window
            future_slice = df.iloc[idx_loc+1:idx_loc+1+forward_window]
            if any(future_slice['close'] >= future_slice['middle_band']):
                success_count += 1
        
        probability = success_count / len(similar_instances)
        return probability
        
    except Exception as e:
        logger.error(f"Error calculating reversal probability: {e}")
        return 0.5  # Default to 50% on error

# For testing
if __name__ == "__main__":
    # Generate sample data
    dates = pd.date_range(start='2023-01-01', periods=100, freq='1D')
    
    # Create mean-reverting price series with some noise
    price = 100
    prices = []
    for i in range(100):
        # Mean reversion factor - pull toward 100
        mean_reversion = (100 - price) * 0.1
        # Random noise
        noise = np.random.normal(0, 1)
        # Update price with mean reversion and noise
        price = price + mean_reversion + noise
        prices.append(price)
    
    # Create dataframe
    data = {
        'open': prices,
        'high': [p + abs(np.random.normal(0, 0.5)) for p in prices],
        'low': [p - abs(np.random.normal(0, 0.5)) for p in prices],
        'close': prices,
        'volume': np.random.normal(1000, 200, 100)
    }
    
    df = pd.DataFrame(data, index=dates)
    
    # Set up oversold condition at the end
    for i in range(90, 100):
        df.loc[dates[i], 'close'] = 95 - (i - 90) * 0.5
        df.loc[dates[i], 'low'] = df.loc[dates[i], 'close'] - 0.2
        df.loc[dates[i], 'high'] = df.loc[dates[i], 'close'] + 0.2
        df.loc[dates[i], 'open'] = df.loc[dates[i], 'close'] + 0.1
    
    # Test mean reversion detection
    df_bbands = calculate_bollinger_bands(df)
    df_metrics = calculate_mean_reversion_metrics(df_bbands)
    
    is_opportunity, entry, target = detect_mean_reversion_opportunities(df)
    score = get_mean_reversion_score(df)
    prob = calculate_reversal_probability(df_metrics)
    
    print(f"Mean reversion opportunity: {is_opportunity}")
    if is_opportunity:
        print(f"Entry price: ${entry:.2f}")
        print(f"Target price: ${target:.2f}")
        print(f"Profit potential: {(target - entry) / entry * 100:.2f}%")
    
    print(f"Mean reversion score (0-100): {score}")
    print(f"Probability of reversion to mean: {prob:.2f} ({prob*100:.0f}%)")
    
    # Print latest metrics
    latest = df_metrics.iloc[-1]
    print("\nLatest metrics:")
    print(f"Price: ${latest['close']:.2f}")
    print(f"Lower BB: ${latest['lower_band']:.2f}")
    print(f"Middle BB: ${latest['middle_band']:.2f}")
    print(f"Upper BB: ${latest['upper_band']:.2f}")
    print(f"Deviation from mean: {latest['pct_deviation']:.2f}%")
    print(f"Z-score: {latest['z_score']:.2f}")
    if 'rsi' in latest:
        print(f"RSI: {latest['rsi']:.2f}")
