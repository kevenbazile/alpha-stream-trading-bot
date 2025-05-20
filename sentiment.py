
import os
import time
from datetime import datetime, timedelta
import pandas as pd
import logging
import random
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
import tweepy
from dotenv import load_dotenv

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Twitter API credentials (placeholders - replace with your own or use .env file)
TWITTER_API_KEY = os.getenv("TWITTER_API_KEY", "YOUR_TWITTER_API_KEY")
TWITTER_API_SECRET = os.getenv("TWITTER_API_SECRET", "YOUR_TWITTER_API_SECRET")
TWITTER_ACCESS_TOKEN = os.getenv("TWITTER_ACCESS_TOKEN", "YOUR_TWITTER_ACCESS_TOKEN")
TWITTER_ACCESS_SECRET = os.getenv("TWITTER_ACCESS_SECRET", "YOUR_TWITTER_ACCESS_SECRET")
TWITTER_BEARER_TOKEN = os.getenv("TWITTER_BEARER_TOKEN", "YOUR_BEARER_TOKEN")

# Initialize sentiment analyzer
analyzer = SentimentIntensityAnalyzer()

# Cache for social sentiment data to limit API calls
sentiment_cache = {}
volume_cache = {}
CACHE_EXPIRY = 300  # 5 minutes

# Mock Twitter data for testing when API is not available
MOCK_TWEETS_ENABLED = True  # Set to False when using real Twitter API

# Sample stock-related tweets for testing
MOCK_TWEETS = [
    # Tesla tweets - mix of positive, negative and neutral
    "$TSLA breaking out! Incredible revenue growth and production numbers. Going to $300 soon! 🚀🚀🚀",
    "Just bought more $TSLA shares. Elon's vision for AI and robotics will change the world.",
    "Tesla $TSLA failing to meet delivery targets again. Bearish signal?",
    "$TSLA overvalued by every traditional metric. Bubble is going to burst soon.",
    "Tesla $TSLA holding steady despite market volatility. Strong support at current levels.",

    # NVIDIA tweets - mostly positive
    "$NVDA AI dominance is unmatched. Their GPU tech is years ahead of competition.",
    "NVIDIA $NVDA crushing earnings again! Record revenue in data center business. 🚀",
    "Buying more $NVDA before it jumps another 10%. AI boom just getting started.",
    "Some concerns about $NVDA valuation, but growth justifies the premium.",
    "NVIDIA $NVDA new chips are impressive but production bottlenecks are concerning.",

    # AMD tweets - mixed sentiment
    "$AMD new laptop processors are gaining market share from Intel. Bullish!",
    "AMD $AMD server chips showing weakness against Intel's latest generation.",
    "Holding $AMD long term. Lisa Su is the best CEO in tech right now.",
    "Dumped my $AMD shares today. Competition from NVIDIA in AI is too strong.",
    "AMD $AMD needs stronger AI strategy to compete with $NVDA in the long run.",

    # Apple tweets
    "$AAPL iPhone sales declining in China. Concerning trend for investors.",
    "Apple $AAPL sitting on massive cash reserves. Expect bigger dividends soon.",
    "New $AAPL AI features look promising for next iOS update.",
    "Apple $AAPL Vision Pro sales disappointing according to supply chain sources.",
    "$AAPL services business growing steadily. Recurring revenue is the future.",

    # Microsoft tweets
    "Microsoft $MSFT cloud business booming with Azure growth exceeding expectations.",
    "$MSFT AI integration into Office suite is game changing for productivity.",
    "Microsoft $MSFT valuation looking stretched after recent rally.",
    "Bought more $MSFT today. Best positioned tech company for enterprise AI.",
    "Microsoft $MSFT Teams losing market share to Slack and other competitors.",

    # Amazon tweets
    "$AMZN AWS margins compressing due to increased competition from Microsoft.",
    "Amazon $AMZN logistics network efficiency showing impressive improvements.",
    "$AMZN advertising business is a hidden gem in their financial reports.",
    "Amazon $AMZN stock split coming soon? Chart suggests accumulation pattern.",
    "$AMZN e-commerce market share declining as competitors catch up.",

    # Nike tweets
    "Nike $NKE new product line resonating with younger consumers. Sales up!",
    "$NKE struggling in China market. Losing ground to local brands.",
    "Nike $NKE direct to consumer strategy paying off with higher margins.",
    "$NKE inventory issues persisting according to retail channel checks.",
    "Just bought Nike $NKE shares on the dip. Strong brand always recovers.",

    # Starbucks tweets
    "$SBUX raising prices again. Will consumers keep paying premium for coffee?",
    "Starbucks $SBUX same-store sales declining in key urban markets.",
    "$SBUX mobile ordering increasing efficiency and customer satisfaction.",
    "Starbucks $SBUX loyalty program driving repeat business. Bullish signal.",
    "$SBUX expanding too fast in China. Saturation concerns are valid.",

    # Walmart tweets
    "Walmart $WMT e-commerce investments finally paying off. Growth accelerating.",
    "$WMT grocery business gaining market share from traditional supermarkets.",
    "Walmart $WMT raising wages will hurt margins in short term.",
    "$WMT automation initiatives reducing labor costs significantly.",
    "Walmart $WMT pharmacy services expanding. Healthcare pivot is smart strategy.",

    # Disney tweets
    "Disney $DIS streaming business still losing money. When will it be profitable?",
    "$DIS park attendance breaking records this summer. Tourism is back!",
    "Disney $DIS content creation costs spiraling out of control.",
    "$DIS franchise fatigue setting in for Marvel movies. Box office numbers declining.",
    "Disney $DIS strategic shift under new CEO looks promising. Long term hold.",

    # Johnson & Johnson tweets
    "$JNJ pharmaceutical pipeline looking strong with multiple late-stage trials.",
    "Johnson & Johnson $JNJ lawsuit settlements weighing on stock performance.",
    "$JNJ dividend aristocrat status makes it perfect for retirement portfolios.",
    "Johnson & Johnson $JNJ separation into two companies will unlock shareholder value.",
    "$JNJ medtech division growing faster than analysts expected.",

    # Pfizer tweets
    "Pfizer $PFE post-COVID revenue cliff is concerning. What's their next blockbuster?",
    "$PFE pipeline has several promising candidates that market is ignoring.",
    "Pfizer $PFE acquisition strategy seems desperate rather than strategic.",
    "$PFE dividend yield attractive for income investors at current price levels.",
    "Pfizer $PFE valuation at historic lows. Contrarian buying opportunity?",

    # Moderna tweets
    "$MRNA platform technology has applications beyond vaccines. Market underestimating potential.",
    "Moderna $MRNA cash burn rate unsustainable without new product approvals.",
    "$MRNA cancer vaccine trials showing early promise. Could be revolutionary.",
    "Moderna $MRNA too dependent on COVID boosters for revenue. Risky investment.",
    "$MRNA insiders selling shares. Red flag for investors.",

    # AbbVie tweets
    "AbbVie $ABBV Humira patent cliff not as bad as feared. New drugs filling the gap.",
    "$ABBV dividend growth makes it a standout in healthcare sector.",
    "AbbVie $ABBV acquisition strategy creating long-term value.",
    "$ABBV migraine treatments gaining significant market share.",
    "AbbVie $ABBV R&D productivity metrics best in class among large pharma.",

    # UnitedHealth tweets
    "UnitedHealth $UNH margins expanding despite regulatory pressures.",
    "$UNH technology investments creating sustainable competitive advantage.",
    "UnitedHealth $UNH Medicare Advantage enrollment growth exceeding expectations.",
    "$UNH vertical integration strategy paying dividends for shareholders.",
    "UnitedHealth $UNH valuation premium to sector justified by consistent execution."
]

def get_twitter_client():
    """Initialize and return Twitter API client"""
    try:
        client = tweepy.Client(
            bearer_token=TWITTER_BEARER_TOKEN,
            consumer_key=TWITTER_API_KEY,
            consumer_secret=TWITTER_API_SECRET,
            access_token=TWITTER_ACCESS_TOKEN,
            access_token_secret=TWITTER_ACCESS_SECRET
        )
        return client
    except Exception as e:
        logger.error(f"Failed to initialize Twitter client: {e}")
        return None

def get_tweets_for_symbol(symbol, count=100, hours=1):
    """Get recent tweets for a stock symbol"""
    if MOCK_TWEETS_ENABLED:
        return get_mock_tweets_for_symbol(symbol, count)
    
    client = get_twitter_client()
    if not client:
        logger.error("Twitter client not available, falling back to mock data")
        return get_mock_tweets_for_symbol(symbol, count)
    
    try:
        # Format query to search for cashtag
        query = f"${symbol} lang:en -is:retweet"
        
        # Set search parameters
        start_time = (datetime.utcnow() - timedelta(hours=hours)).strftime("%Y-%m-%dT%H:%M:%SZ")
        
        # Search tweets
        tweets = client.search_recent_tweets(
            query=query,
            max_results=count,
            start_time=start_time,
            tweet_fields=['created_at', 'public_metrics']
        )
        
        if tweets.data:
            return [tweet.text for tweet in tweets.data]
        else:
            logger.warning(f"No tweets found for {symbol}, falling back to mock data")
            return get_mock_tweets_for_symbol(symbol, count)
            
    except Exception as e:
        logger.error(f"Error fetching tweets for {symbol}: {e}")
        return get_mock_tweets_for_symbol(symbol, count)

def get_mock_tweets_for_symbol(symbol, count=10):
    """Get mock tweets for testing"""
    # Filter tweets related to the symbol
    symbol_tweets = [tweet for tweet in MOCK_TWEETS if f"${symbol}" in tweet.upper()]
    
    # If not enough symbol-specific tweets, add some random tweets
    if len(symbol_tweets) < count:
        additional_needed = count - len(symbol_tweets)
        random_tweets = random.sample(MOCK_TWEETS, min(additional_needed, len(MOCK_TWEETS)))
        symbol_tweets.extend(random_tweets)
    
    # Shuffle and limit to requested count
    random.shuffle(symbol_tweets)
    return symbol_tweets[:count]

def analyze_tweet_sentiment(tweet_text):
    """Analyze sentiment of a tweet using VADER"""
    sentiment = analyzer.polarity_scores(tweet_text)
    return sentiment['compound']  # Returns score between -1 (negative) and 1 (positive)

def analyze_social_sentiment(symbol):
    """Analyze social media sentiment for a stock"""
    # Check cache first
    current_time = time.time()
    if symbol in sentiment_cache and current_time - sentiment_cache[symbol]['timestamp'] < CACHE_EXPIRY:
        return sentiment_cache[symbol]['score']
    
    try:
        # Get tweets for the symbol
        tweets = get_tweets_for_symbol(symbol, count=100, hours=1)
        
        if not tweets:
            logger.warning(f"No tweets found for {symbol}")
            return 0.5  # Neutral sentiment if no tweets
        
        # Calculate average sentiment
        sentiment_scores = [analyze_tweet_sentiment(tweet) for tweet in tweets]
        avg_sentiment = sum(sentiment_scores) / len(sentiment_scores)
        
        # Normalize from [-1, 1] to [0, 1] range
        normalized_sentiment = (avg_sentiment + 1) / 2
        
        # Cache the result
        sentiment_cache[symbol] = {
            'score': normalized_sentiment,
            'timestamp': current_time
        }
        
        return normalized_sentiment
        
    except Exception as e:
        logger.error(f"Error analyzing sentiment for {symbol}: {e}")
        return 0.5  # Return neutral sentiment on error

def get_social_volume(symbol):
    """Get social media volume (number of posts) for a stock"""
    # Check cache first
    current_time = time.time()
    if symbol in volume_cache and current_time - volume_cache[symbol]['timestamp'] < CACHE_EXPIRY:
        return volume_cache[symbol]['volume']
    
    try:
        if MOCK_TWEETS_ENABLED:
            # Generate random volume between 50 and 500 posts
            # With some stocks getting higher volume based on popularity
            popular_stocks = ['TSLA', 'AAPL', 'NVDA', 'AMD', 'AMZN']
            if symbol in popular_stocks:
                volume = random.randint(150, 500)
            else:
                volume = random.randint(50, 200)
        else:
            # Count actual tweets in the last hour
            client = get_twitter_client()
            if not client:
                # Fall back to mock volume
                volume = random.randint(50, 300)
            else:
                query = f"${symbol} lang:en -is:retweet"
                start_time = (datetime.utcnow() - timedelta(hours=1)).strftime("%Y-%m-%dT%H:%M:%SZ")
                
                # Use counts endpoint if available or count results
                tweets = client.search_recent_tweets(
                    query=query,
                    max_results=100,
                    start_time=start_time
                )
                
                volume = len(tweets.data) if tweets.data else 0
                
                # Extrapolate if we hit the max results
                if volume == 100:
                    volume = volume * 3  # Rough estimate of actual volume
        
        # Cache the result
        volume_cache[symbol] = {
            'volume': volume,
            'timestamp': current_time
        }
        
        return volume
        
    except Exception as e:
        logger.error(f"Error getting social volume for {symbol}: {e}")
        return 0  # Return 0 volume on error

def get_top_social_stocks(watchlist, top_n=5):
    """Get top stocks by social media activity from watchlist"""
    results = []
    
    for sector, symbols in watchlist.items():
        for symbol in symbols:
            sentiment = analyze_social_sentiment(symbol)
            volume = get_social_volume(symbol)
            
            results.append({
                'symbol': symbol,
                'sector': sector,
                'sentiment': sentiment,
                'volume': volume,
                'score': sentiment * volume  # Combined metric
            })
    
    # Sort by score (sentiment * volume)
    results.sort(key=lambda x: x['score'], reverse=True)
    
    return results[:top_n]

# For testing
if __name__ == "__main__":
    # Test watchlist
    test_watchlist = {
        "TECH": ["AAPL", "NVDA", "AMD", "TSLA", "MSFT"],
        "CONSUMER": ["NKE", "SBUX", "AMZN", "WMT", "DIS"],
        "HEALTHCARE": ["JNJ", "PFE", "MRNA", "ABBV", "UNH"]
    }
    
    print("Testing social sentiment analysis...")
    
    for sector, symbols in test_watchlist.items():
        for symbol in symbols:
            sentiment = analyze_social_sentiment(symbol)
            volume = get_social_volume(symbol)
            print(f"{symbol}: Sentiment={sentiment:.2f}, Volume={volume}")
    
    print("\nTop social stocks:")
    top_stocks = get_top_social_stocks(test_watchlist)
    for idx, stock in enumerate(top_stocks, 1):
        print(f"{idx}. {stock['symbol']} (Sentiment: {stock['sentiment']:.2f}, Volume: {stock['volume']})")
