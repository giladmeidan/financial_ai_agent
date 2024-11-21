# /yfinance_utils.py

import logging
import yfinance as yf
from functools import lru_cache

# Suppress yfinance and urllib3 logs
logging.getLogger("yfinance").setLevel(logging.CRITICAL)
logging.getLogger("urllib3").setLevel(logging.CRITICAL)

@lru_cache(maxsize=100)
def get_stock_price(ticker):
    """
    Fetch the current stock price from yfinance with caching.
    Cached data expires every 600 seconds (10 minutes).
    """
    logging.info(f"Fetching stock price for: {ticker}")
    data = yf.Ticker(ticker).history(period="1d")
    if data.empty:
        raise ValueError(f"No data found for ticker: {ticker}")
    price = data['Close'].iloc[-1]
    logging.info(f"Stock price for {ticker}: {price}")
    return round(price, 2)


@lru_cache(maxsize=100)
def get_historical_stock_data(ticker):
    """
    Fetch historical stock data from yfinance with caching.
    Cached data expires every 600 seconds (10 minutes).
    """
    logging.info(f"Fetching historical data for: {ticker}")
    data = yf.Ticker(ticker).history(period="6mo")
    if data.empty:
        raise ValueError(f"No historical data found for ticker: {ticker}")
    historical_data = data[['Close']].reset_index()
    historical_data['Date'] = historical_data['Date'].astype(str)  # Convert dates to strings
    return historical_data.to_dict(orient='records')


def fetch_historical_data_for_tickers(tickers):
    """
    Fetch historical stock data for multiple tickers.
    """
    logging.info(f"Fetching historical data for tickers: {tickers}")
    result = {}
    for ticker in tickers:
        try:
            result[ticker] = get_historical_stock_data(ticker)
        except Exception as e:
            logging.error(f"Error fetching historical data for {ticker}: {e}")
            result[ticker] = []
    return result


def fetch_stock_prices_for_tickers(tickers):
    """
    Fetch stock prices for multiple tickers.
    """
    logging.info(f"Fetching stock prices for tickers: {tickers}")
    result = {}
    for ticker in tickers:
        try:
            result[ticker] = get_stock_price(ticker)
        except Exception as e:
            logging.error(f"Error fetching stock price for {ticker}: {e}")
            result[ticker] = 0
    return result
