import logging
import sqlite3
import jwt
from datetime import datetime, timedelta
from flask import Flask, jsonify, request
from werkzeug.security import generate_password_hash, check_password_hash
from flask_cors import CORS
from functools import wraps, lru_cache
import yfinance as yf
from recommendations import *
from yfinance_utils import (
    get_stock_price,
    get_historical_stock_data,
    fetch_historical_data_for_tickers,
    fetch_stock_prices_for_tickers,
)
from flask_caching import Cache
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
import time


cache = Cache(config={'CACHE_TYPE': 'simple'})
# Initialize the scheduler
scheduler = BackgroundScheduler()
def update_stock_prices():
    """
    Periodically fetch and update stock prices in the database.
    """
    conn = get_db_connection()
    try:
        # Fetch all distinct tickers from the portfolio
        stocks = conn.execute('SELECT DISTINCT stock_ticker FROM portfolios').fetchall()
        tickers = [stock['stock_ticker'] for stock in stocks]
        
        # Fetch current prices for all tickers in batch
        data = yf.download(tickers, period='1d', group_by='ticker')
        
        for ticker in tickers:
            try:
                # Get the last closing price
                current_price = data[ticker]['Close'].iloc[-1]
                # Update the price in the database
                conn.execute(
                    'UPDATE portfolios SET price = ? WHERE stock_ticker = ?',
                    (current_price, ticker)
                )
            except Exception as e:
                logging.error(f"Failed to update price for {ticker}: {e}")
        
        conn.commit()
        logging.info("Stock prices updated successfully.")
    except Exception as e:
        logging.error(f"Error updating stock prices: {e}")
    finally:
        conn.close()


# Schedule the stock update job
scheduler.add_job(
    update_stock_prices, 
    trigger=IntervalTrigger(hours=1),  # Run every 1 hour
    id='update_stock_prices',          # Unique job ID
    replace_existing=True              # Replace the job if it already exists
)


app = Flask(__name__)
app.config['SECRET_KEY'] = 'your_secret_key'
CORS(app)
cache.init_app(app)



# Configure logging to include a log file
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("app.log"),  # Log to a file
        logging.StreamHandler()          # Log to console
    ]
)

# Suppress yfinance logs
logging.getLogger("yfinance").setLevel(logging.CRITICAL)

# Suppress urllib3 logs (used internally by yfinance for HTTP requests)
logging.getLogger("urllib3").setLevel(logging.CRITICAL)



# Database connection helper
def get_db_connection():
    try:
        logging.debug("Connecting to the database...")
        conn = sqlite3.connect('financial_ai_agent.db')
        conn.row_factory = sqlite3.Row
        return conn
    except sqlite3.Error as e:
        logging.error(f"Database connection error: {e}")
        raise

# JWT Token Decorator
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization')
        if not token:
            logging.warning("Authorization token is missing.")
            return jsonify({'message': 'Token is missing!'}), 401

        try:
            if token.startswith("Bearer "):
                token = token.split(" ")[1]
            #logging.debug(f"Received token: {token}")
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            current_user = data['user_id']
            logging.info(f"Token decoded successfully for user ID: {current_user}")
        except jwt.ExpiredSignatureError:
            logging.warning("Token has expired.")
            return jsonify({'message': 'Token has expired!'}), 401
        except jwt.InvalidTokenError:
            logging.error("Invalid token received.")
            return jsonify({'message': 'Token is invalid!'}), 401

        return f(current_user, *args, **kwargs)
    return decorated



@app.route('/api/portfolio/add', methods=['POST'])
@token_required
def add_stock_to_portfolio(current_user):
    data = request.json
    ticker = data.get('ticker')
    shares = data.get('shares')
    price = data.get('price')

    if not ticker or not shares or not price:
        return jsonify({'message': 'Ticker, shares, and price are required.'}), 400

    try:
        conn = get_db_connection()
        conn.execute(
            '''
            INSERT INTO portfolios (user_id, stock_ticker, shares, price)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(user_id, stock_ticker)
            DO UPDATE SET shares = shares + excluded.shares
            ''',
            (current_user, ticker, shares, price)
        )
        conn.commit()
        conn.close()

        return jsonify({'message': f'{shares} shares of {ticker} added to portfolio at price {price}.'}), 200
    except Exception as e:
        logging.error(f"Error adding stock to portfolio: {e}")
        return jsonify({'message': 'Error adding stock to portfolio.', 'error': str(e)}), 500


# Register a new user with validation
@app.route('/api/register', methods=['POST'])
def register_user():
    data = request.json
    username = data.get('username')
    email = data.get('email')
    password = data.get('password')

    if not username or not email or not password:
        logging.warning("Registration failed: Missing fields.")
        return jsonify({'status': 'error', 'message': 'All fields are required.'}), 400

    password_hash = generate_password_hash(password)

    logging.info(f"Attempting to register user: {username}")
    conn = get_db_connection()
    try:
        conn.execute(
            'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
            (username, email, password_hash)
        )
        conn.commit()
        logging.info(f"User {username} registered successfully.")
        return jsonify({'status': 'success', 'message': 'User registered successfully!'}), 201
    except sqlite3.IntegrityError as e:
        logging.error(f"User registration failed: {e}")
        return jsonify({'status': 'error', 'message': 'Username or email already exists.'}), 400
    except sqlite3.Error as e:
        logging.error(f"Unexpected database error during registration: {e}")
        return jsonify({'status': 'error', 'message': 'Internal server error.'}), 500
    finally:
        conn.close()

# User Login with validation
@app.route('/api/login', methods=['POST'])
def login_user():
    data = request.json
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        logging.warning("Login failed: Missing fields.")
        return jsonify({'message': 'Username and password are required.'}), 400

    logging.info(f"Attempting login for user: {username}")
    conn = get_db_connection()
    try:
        user = conn.execute(
            'SELECT * FROM users WHERE username = ?',
            (username,)
        ).fetchone()
        if user and check_password_hash(user['password_hash'], password):
            token = jwt.encode(
                {'user_id': user['id'], 'exp': datetime.utcnow() + timedelta(hours=1)},
                app.config['SECRET_KEY'], algorithm="HS256"
            )
            logging.info(f"Login successful for user: {username}. Token issued.")
            return jsonify({'token': token}), 200
        else:
            logging.warning(f"Login failed for user: {username}. Invalid credentials.")
            return jsonify({'message': 'Invalid credentials.'}), 401
    except sqlite3.Error as e:
        logging.error(f"Database error during login: {e}")
        return jsonify({'message': 'Internal server error.'}), 500
    finally:
        conn.close()


@app.route('/api/portfolio/value', methods=['GET'])
@cache.cached(timeout=300)
@token_required
def get_portfolio_value(current_user):
    conn = get_db_connection()
    portfolio = conn.execute(
        'SELECT stock_ticker AS ticker, shares FROM portfolios WHERE user_id = ?',
        (current_user,)
    ).fetchall()

    portfolio_data = [dict(row) for row in portfolio]
    portfolio_result = []
    total_value = 0

    tickers = [stock["ticker"] for stock in portfolio_data]
    prices = fetch_stock_prices_for_tickers(tickers)  # Fetch prices in batch

    for stock in portfolio_data:
        ticker = stock["ticker"]
        shares = stock["shares"]
        current_price = prices.get(ticker, 0)

        try:
            previous_close = get_historical_stock_data(ticker)[-2]['Close']
        except IndexError:
            previous_close = current_price

        daily_change = current_price - previous_close
        daily_change_percentage = (daily_change / previous_close) * 100 if previous_close else 0
        stock_value = current_price * shares
        total_value += stock_value

        portfolio_result.append({
            "ticker": ticker,
            "shares": shares,
            "current_price": round(current_price, 2),
            "previous_close": round(previous_close, 2),
            "daily_change": round(daily_change, 2),
            "daily_change_percentage": round(daily_change_percentage, 2),
            "value": round(stock_value, 2),
        })

    conn.close()

    return jsonify({
        "portfolio": portfolio_result,
        "total_value": round(total_value, 2),
    })


@app.route('/api/stock/history/<ticker>', methods=['GET'])
@token_required
def get_stock_history(current_user, ticker):
    logging.info(f"Fetching historical data for ticker: {ticker}")
    try:
        historical_data = get_historical_stock_data(ticker)
        return jsonify(historical_data), 200
    except Exception as e:
        logging.error(f"Failed to fetch historical data for {ticker}: {e}")
        return jsonify({'error': f'Failed to fetch historical data for {ticker}: {str(e)}'}), 500


# Fetch notifications for a user
@app.route('/api/notifications', methods=['GET'])
@token_required
def get_notifications(current_user):
    conn = get_db_connection()
    notifications = conn.execute(
        'SELECT * FROM notifications WHERE user_id = ? ORDER BY timestamp DESC',
        (current_user,)
    ).fetchall()
    conn.close()
    return jsonify([dict(row) for row in notifications])

# Generate notifications for portfolio stocks
@app.route('/api/notifications/generate', methods=['POST'])
@token_required
def generate_notifications(current_user):
    conn = get_db_connection()
    portfolio = conn.execute(
        'SELECT stock_ticker AS ticker FROM portfolios WHERE user_id = ?',
        (current_user,)
    ).fetchall()
    conn.close()

    portfolio = [row['ticker'] for row in portfolio]
    notifications = []

    for ticker in portfolio:
        try:
            # Fetch stock data
            stock_data = yf.Ticker(ticker)
            historical_data = stock_data.history(period="2d")  # Last two days
            earnings_date = stock_data.info.get('earningsDate')

            if not historical_data.empty:
                current_price = historical_data['Close'].iloc[-1]
                previous_close = historical_data['Close'].iloc[-2]
                price_change_percentage = ((current_price - previous_close) / previous_close) * 100

                # Add notification for significant price drop
                if price_change_percentage <= -5:  # Threshold: 5% drop
                    notifications.append({
                        "ticker": ticker,
                        "message": f"{ticker} dropped by {abs(price_change_percentage):.2f}% today.",
                        "timestamp": datetime.now()
                    })

                # Add notification for upcoming earnings
                if earnings_date and earnings_date <= datetime.now() + timedelta(days=7):
                    notifications.append({
                        "ticker": ticker,
                        "message": f"{ticker} has an earnings report on {earnings_date.strftime('%Y-%m-%d')}.",
                        "timestamp": datetime.now()
                    })

        except Exception as e:
            print(f"Error processing notifications for {ticker}: {e}")

    # Save notifications to database
    conn = get_db_connection()
    for notification in notifications:
        conn.execute(
            'INSERT INTO notifications (user_id, ticker, message, timestamp) VALUES (?, ?, ?, ?)',
            (current_user, notification['ticker'], notification['message'], notification['timestamp'])
        )
    conn.commit()
    conn.close()

    return jsonify({"status": "success", "message": "Notifications generated."})


@app.route('/api/strategy/recommendations', methods=['POST'])
@token_required
def get_recommendations(current_user):
    """
    Generate investment strategy recommendations based on the user's portfolio.
    """
    data = request.json
    strategy = data.get('strategy', 'growth')  # Default strategy is 'growth'
    conn = get_db_connection()

    # Fetch user's portfolio
    portfolio = conn.execute(
        'SELECT stock_ticker AS ticker, shares FROM portfolios WHERE user_id = ?',
        (current_user,)
    ).fetchall()
    portfolio = [dict(row) for row in portfolio]
    conn.close()

    try:
        if strategy == 'growth':
            recommendations = generate_growth_recommendations(portfolio)
        elif strategy == 'dividend':
            recommendations = generate_dividend_recommendations(portfolio)
        elif strategy == 'risk_minimization':
            recommendations = generate_risk_minimization_recommendations(portfolio)
        else:
            return jsonify({'error': 'Invalid strategy'}), 400

        return jsonify({'strategy': strategy, 'recommendations': recommendations}), 200

    except Exception as e:
        logging.error(f"Error generating recommendations: {e}")
        return jsonify({'error': 'Failed to generate recommendations'}), 500

if __name__ == "__main__":
    scheduler.start()  # Start the scheduler
    try:
        app.run(debug=True)
    except (KeyboardInterrupt, SystemExit):
        scheduler.shutdown()  # Ensure a clean shutdown on exit