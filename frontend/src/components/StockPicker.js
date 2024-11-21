import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { usePortfolio } from "./PortfolioProvider";
import { Line } from "react-chartjs-2";
import { Chart as ChartJS, LineElement, CategoryScale, LinearScale, PointElement, Tooltip, Legend } from "chart.js";

// Register Chart.js components
ChartJS.register(LineElement, CategoryScale, LinearScale, PointElement, Tooltip, Legend);

const StockPicker = () => {
  const [ticker, setTicker] = useState("");
  const [stockDetails, setStockDetails] = useState(null);
  const [shares, setShares] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [totalCost, setTotalCost] = useState(0);
  const [loading, setLoading] = useState(false);
  const [priceHistory, setPriceHistory] = useState(null); // For price history chart
  const [showConfirm, setShowConfirm] = useState(false); // For confirmation dialog

  const { refreshPortfolio } = usePortfolio();
  const navigate = useNavigate();

  const API_KEY = "A2XELEM8W6WSTE3W";
  const API_BASE_URL = "https://www.alphavantage.co/query";

  const isValidTicker = (ticker) => /^[A-Z]{1,5}$/.test(ticker);
  const isValidShares = (shares) => /^\d+$/.test(shares) && parseInt(shares, 10) > 0;

  const searchStock = async () => {
    if (!isValidTicker(ticker)) {
      setErrorMessage("Please enter a valid stock ticker (1–5 uppercase letters).");
      return;
    }

    try {
      setLoading(true);
      const response = await axios.get(API_BASE_URL, {
        params: {
          function: "SYMBOL_SEARCH",
          keywords: ticker,
          apikey: API_KEY,
        },
      });
      const bestMatch = response.data.bestMatches?.[0];
      if (bestMatch) {
        const symbol = bestMatch["1. symbol"];
        const price = await fetchStockPrice(symbol);

        setStockDetails({
          symbol,
          name: bestMatch["2. name"],
          region: bestMatch["4. region"],
          currency: bestMatch["8. currency"],
          price: price || "N/A",
        });
        fetchPriceHistory(symbol); // Fetch historical data for chart
        setErrorMessage("");
      } else {
        setStockDetails(null);
        setErrorMessage("Stock not found. Please check the ticker.");
      }
    } catch (error) {
      setStockDetails(null);
      setErrorMessage("Error fetching stock data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const fetchStockPrice = async (symbol) => {
    try {
      const response = await axios.get(API_BASE_URL, {
        params: {
          function: "GLOBAL_QUOTE",
          symbol,
          apikey: API_KEY,
        },
      });
      return parseFloat(response.data["Global Quote"]["05. price"]).toFixed(2);
    } catch (error) {
      console.error("Error fetching stock price:", error);
      return null;
    }
  };

  const fetchPriceHistory = async (symbol) => {
    try {
      const response = await axios.get(API_BASE_URL, {
        params: {
          function: "TIME_SERIES_DAILY",
          symbol,
          apikey: API_KEY,
        },
      });
      const data = response.data["Time Series (Daily)"];
      if (data) {
        const dates = Object.keys(data).slice(0, 7).reverse(); // Last 7 days
        const prices = dates.map((date) => parseFloat(data[date]["4. close"]));
        setPriceHistory({ dates, prices });
      }
    } catch (error) {
      console.error("Error fetching price history:", error);
    }
  };

  const addToPortfolio = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(
        "http://127.0.0.1:5000/api/portfolio/add",
        { ticker: stockDetails.symbol, shares: parseInt(shares, 10) },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.status === 200) {
        setSuccessMessage(response.data.message);
        refreshPortfolio();
        setShares("");
        setShowConfirm(false);
      } else {
        throw new Error(response.data.message || "Unexpected error occurred.");
      }
    } catch (error) {
      setSuccessMessage("");
      setErrorMessage("Error adding stock to portfolio.");
      console.error("Error adding stock to portfolio:", error);
    }
  };

  useEffect(() => {
    if (stockDetails?.price && shares) {
      setTotalCost((parseFloat(stockDetails.price) * parseInt(shares, 10)).toFixed(2));
    } else {
      setTotalCost(0);
    }
  }, [stockDetails, shares]);

  return (
    <div style={styles.container}>
      <h2 style={styles.heading}>Add a Stock to Your Portfolio</h2>
      <div style={styles.inputGroup}>
        <input
          type="text"
          placeholder="Enter Stock Ticker (e.g., AAPL)"
          value={ticker}
          onChange={(e) => setTicker(e.target.value.toUpperCase())}
          style={styles.input}
        />
        <button onClick={searchStock} style={styles.button} disabled={loading}>
          {loading ? "Searching..." : "Search"}
        </button>
      </div>

      {errorMessage && <p style={styles.error}>{errorMessage}</p>}

      {stockDetails && (
        <div style={styles.stockDetails}>
          <h4>Stock Details:</h4>
          <p><strong>Symbol:</strong> {stockDetails.symbol}</p>
          <p><strong>Company:</strong> {stockDetails.name}</p>
          <p><strong>Current Price:</strong> ${stockDetails.price}</p>
          <input
            type="number"
            placeholder="Enter Number of Shares"
            value={shares}
            onChange={(e) => setShares(e.target.value)}
            style={styles.input}
          />
          <p><strong>Total Cost:</strong> ${totalCost || 0}</p>
          <button onClick={() => setShowConfirm(true)} style={styles.button}>
            Add to Portfolio
          </button>
        </div>
      )}

      {priceHistory && (
        <div style={styles.chartContainer}>
          <h4>Price History (Last 7 Days)</h4>
          <Line
            data={{
              labels: priceHistory.dates,
              datasets: [
                {
                  label: `${stockDetails.symbol} Price`,
                  data: priceHistory.prices,
                  borderColor: "#007BFF",
                  tension: 0.2,
                  fill: false,
                },
              ],
            }}
            options={{ responsive: true }}
          />
        </div>
      )}

      {showConfirm && (
        <div style={styles.confirmDialog}>
          <h4>Confirm Your Action</h4>
          <p>Are you sure you want to add {shares} shares of {stockDetails.symbol} to your portfolio for a total cost of ${totalCost}?</p>
          <button onClick={addToPortfolio} style={styles.button}>
            Confirm
          </button>
          <button onClick={() => setShowConfirm(false)} style={{ ...styles.button, background: "gray" }}>
            Cancel
          </button>
        </div>
      )}

      {successMessage && <p style={styles.success}>{successMessage}</p>}

      <button onClick={() => navigate("/dashboard")} style={{ ...styles.button, background: "#6c757d" }}>
        Go Back to Dashboard
      </button>
    </div>
  );
};

const styles = {
  container: { padding: "20px", fontFamily: "Arial, sans-serif", maxWidth: "600px", margin: "auto" },
  heading: { fontSize: "24px", marginBottom: "20px" },
  inputGroup: { marginBottom: "20px" },
  input: { padding: "10px", marginRight: "10px", width: "300px" },
  button: { padding: "10px 20px", background: "#007BFF", color: "white", border: "none", cursor: "pointer" },
  error: { color: "red" },
  success: { color: "green" },
  stockDetails: { marginBottom: "20px" },
  chartContainer: { marginBottom: "20px" },
  confirmDialog: { padding: "20px", background: "#f9f9f9", border: "1px solid #ddd", borderRadius: "5px" },
};

export default StockPicker;
