import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  Chart as ChartJS,
  ArcElement,
  LineElement,
  CategoryScale,
  LinearScale,
  TimeScale,
  PointElement,
  Legend,
  Tooltip,
} from "chart.js";
import { Pie, Line } from "react-chartjs-2";
import { useNavigate } from "react-router-dom";

// Register Chart.js components
ChartJS.register(
  ArcElement,
  LineElement,
  CategoryScale,
  LinearScale,
  TimeScale,
  PointElement,
  Legend,
  Tooltip
);

const Dashboard = () => {
  const [portfolio, setPortfolio] = useState([]);
  const [totalValue, setTotalValue] = useState(0);
  const [historicalData, setHistoricalData] = useState({});
  const navigate = useNavigate();

  const fetchPortfolio = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get("http://127.0.0.1:5000/api/portfolio/value", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const portfolioData = Array.isArray(response.data.portfolio) ? response.data.portfolio : [];
      setPortfolio(portfolioData);
      setTotalValue(response.data.total_value || 0);

      // Fetch historical data for all stocks
      portfolioData.forEach((stock) => fetchHistoricalData(stock.ticker));
    } catch (error) {
      console.error("Error fetching portfolio:", error.message);
    }
  };

  const fetchHistoricalData = async (ticker) => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`http://127.0.0.1:5000/api/stock/history/${ticker}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setHistoricalData((prev) => ({
        ...prev,
        [ticker]: response.data,
      }));
    } catch (error) {
      console.error(`Error fetching historical data for ${ticker}:`, error.message);
    }
  };

  useEffect(() => {
    fetchPortfolio();
  }, []);

  return (
    <div style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      <h2>Your Portfolio</h2>
      <button
        onClick={() => navigate("/stock-picker")}
        style={{ padding: "10px 20px", marginBottom: "20px" }}
      >
        Add Stocks
      </button>
      <p><strong>Total Portfolio Value:</strong> ${totalValue.toLocaleString()}</p>
      <button
          onClick={() => navigate("/notifications")}
          style={{ padding: "10px 20px", marginBottom: "20px" }}
        >
          View Notifications
      </button>
      <button
          onClick={() => navigate("/recommendations")}
          style={{ padding: "10px 20px", marginBottom: "20px" }}
        >
          Strategy Recommendations
      </button>

      <div style={{ marginBottom: "40px", textAlign: "center" }}>
        <h3>Portfolio Distribution</h3>
        {portfolio.length > 0 && (
          <div style={{ width: "400px", height: "400px", margin: "0 auto" }}>
            <Pie
              data={{
                labels: portfolio.map((stock) => stock.ticker),
                datasets: [
                  {
                    data: portfolio.map((stock) => stock.value || 0), // Fallback to 0
                    backgroundColor: [
                      "rgba(75,192,192,0.6)",
                      "rgba(255,99,132,0.6)",
                      "rgba(54,162,235,0.6)",
                      "rgba(255,206,86,0.6)",
                      "rgba(153,102,255,0.6)",
                    ],
                  },
                ],
              }}
            />
          </div>
        )}
      </div>

      <h3>Portfolio Details</h3>
      {portfolio.length > 0 ? (
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "40px" }}>
          <thead>
            <tr style={{ backgroundColor: "#f4f4f4" }}>
              <th style={{ padding: "10px", border: "1px solid #ddd" }}>Ticker</th>
              <th style={{ padding: "10px", border: "1px solid #ddd" }}>Shares</th>
              <th style={{ padding: "10px", border: "1px solid #ddd" }}>Current Price</th>
              <th style={{ padding: "10px", border: "1px solid #ddd" }}>Previous Close</th>
              <th style={{ padding: "10px", border: "1px solid #ddd" }}>Daily Change</th>
              <th style={{ padding: "10px", border: "1px solid #ddd" }}>Daily Change (%)</th>
              <th style={{ padding: "10px", border: "1px solid #ddd" }}>Total Value</th>
            </tr>
          </thead>
          <tbody>
            {portfolio.map((stock) => (
              <tr key={stock.ticker}>
                <td style={{ padding: "10px", border: "1px solid #ddd" }}>{stock.ticker}</td>
                <td style={{ padding: "10px", border: "1px solid #ddd" }}>{stock.shares}</td>
                <td style={{ padding: "10px", border: "1px solid #ddd" }}>${(stock.current_price || 0).toFixed(2)}</td>
                <td style={{ padding: "10px", border: "1px solid #ddd" }}>${(stock.previous_close || 0).toFixed(2)}</td>
                <td
                  style={{
                    padding: "10px",
                    border: "1px solid #ddd",
                    color: stock.daily_change > 0 ? "green" : stock.daily_change < 0 ? "red" : "black",
                  }}
                >
                  ${(stock.daily_change || 0).toFixed(2)}
                </td>
                <td
                  style={{
                    padding: "10px",
                    border: "1px solid #ddd",
                    color:
                      stock.daily_change_percentage > 0
                        ? "green"
                        : stock.daily_change_percentage < 0
                        ? "red"
                        : "black",
                  }}
                >
                  {(stock.daily_change_percentage || 0).toFixed(2)}%
                </td>
                <td style={{ padding: "10px", border: "1px solid #ddd" }}>${(stock.value || 0).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>No portfolio data available.</p>
      )}
    </div>
  );
};

export default Dashboard;
