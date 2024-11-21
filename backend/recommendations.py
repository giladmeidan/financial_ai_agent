import yfinance as yf

def generate_growth_recommendations(portfolio):
    """
    Suggest growth-oriented stocks.
    """
    # Fetch growth stock candidates
    growth_stocks = ['AAPL', 'TSLA', 'NVDA', 'MSFT', 'GOOG']  # Example growth stocks
    recommendations = []

    for stock in growth_stocks:
        if stock not in [s['ticker'] for s in portfolio]:
            try:
                stock_data = yf.Ticker(stock)
                price = stock_data.history(period='1d')['Close'].iloc[-1]
                recommendations.append({
                    'ticker': stock,
                    'reason': 'High growth potential.',
                    'current_price': round(price, 2),
                })
            except Exception as e:
                print(f"Error fetching data for {stock}: {e}")

    return recommendations

def generate_dividend_recommendations(portfolio):
    """
    Suggest dividend-oriented stocks.
    """
    # Example dividend-paying stocks
    dividend_stocks = ['JNJ', 'PG', 'KO', 'PEP', 'T']
    recommendations = []

    for stock in dividend_stocks:
        if stock not in [s['ticker'] for s in portfolio]:
            try:
                stock_data = yf.Ticker(stock)
                price = stock_data.history(period='1d')['Close'].iloc[-1]
                dividend_yield = stock_data.info.get('dividendYield', 0)
                recommendations.append({
                    'ticker': stock,
                    'reason': f'Attractive dividend yield of {dividend_yield * 100:.2f}%.',
                    'current_price': round(price, 2),
                })
            except Exception as e:
                print(f"Error fetching data for {stock}: {e}")

    return recommendations


def generate_risk_minimization_recommendations(portfolio):
    """
    Suggest low-risk stocks or diversification strategies.
    """
    safe_stocks = ['BRK-B', 'VTI', 'BND', 'TLT', 'GLD']  # Example low-risk assets
    recommendations = []

    for stock in safe_stocks:
        if stock not in [s['ticker'] for s in portfolio]:
            try:
                stock_data = yf.Ticker(stock)
                price = stock_data.history(period='1d')['Close'].iloc[-1]
                recommendations.append({
                    'ticker': stock,
                    'reason': 'Low volatility and stable returns.',
                    'current_price': round(price, 2),
                })
            except Exception as e:
                print(f"Error fetching data for {stock}: {e}")

    return recommendations