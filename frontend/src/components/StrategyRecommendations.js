import React, { useState } from "react";
import axios from "axios";

const StrategyRecommendations = () => {
  const [strategy, setStrategy] = useState("growth");
  const [recommendations, setRecommendations] = useState([]);
  const [error, setError] = useState("");
  const [selectedStocks, setSelectedStocks] = useState({});
  const [totalCost, setTotalCost] = useState(0);

  // Fetch strategy recommendations
  const fetchRecommendations = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(
        "http://127.0.0.1:5000/api/strategy/recommendations",
        { strategy },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setRecommendations(response.data.recommendations);
      setSelectedStocks({});
      setTotalCost(0);
      setError("");
    } catch (err) {
      setError("Failed to fetch recommendations. Please try again.");
    }
  };

  // Handle share input changes
  const handleShareChange = (ticker, shares) => {
    const updatedShares = { ...selectedStocks, [ticker]: parseInt(shares, 10) || 0 };
    setSelectedStocks(updatedShares);

    // Recalculate total cost
    const total = recommendations.reduce((acc, stock) => {
      if (updatedShares[stock.ticker]) {
        return acc + stock.current_price * updatedShares[stock.ticker];
      }
      return acc;
    }, 0);
    setTotalCost(total.toFixed(2));
  };

  // Save selected stocks to portfolio
  const addToPortfolio = async () => {
    try {
      const token = localStorage.getItem("token");
      const promises = Object.keys(selectedStocks).map((ticker) => {
        if (selectedStocks[ticker] > 0) {
          return axios.post(
            "http://127.0.0.1:5000/api/portfolio/add",
            { ticker, shares: selectedStocks[ticker], price: totalCost },
            { headers: { Authorization: `Bearer ${token}` } }
          );
        }
        return null;
      });

      await Promise.all(promises);
      alert("Selected stocks added to your portfolio!");
      setSelectedStocks({});
      setTotalCost(0);
    } catch (err) {
      setError("Failed to add stocks to portfolio. Please try again.");
    }
  };

  return (
    <div style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      <h2>Investment Strategy Recommendations</h2>
      <label>
        Select Strategy:
        <select
          value={strategy}
          onChange={(e) => setStrategy(e.target.value)}
          style={{ margin: "10px", padding: "5px" }}
        >
          <option value="growth">Growth</option>
          <option value="dividend">Dividend</option>
          <option value="risk_minimization">Risk Minimization</option>
        </select>
      </label>
      <button onClick={fetchRecommendations} style={{ padding: "10px", marginLeft: "10px" }}>
        Get Recommendations
      </button>

      {error && <p style={{ color: "red" }}>{error}</p>}

      <div style={{ marginTop: "20px" }}>
        {recommendations.length > 0 ? (
          <>
            <h3>Recommendations</h3>
            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "20px" }}>
              <thead>
                <tr style={{ backgroundColor: "#f4f4f4" }}>
                  <th style={{ padding: "10px", border: "1px solid #ddd" }}>Ticker</th>
                  <th style={{ padding: "10px", border: "1px solid #ddd" }}>Reason</th>
                  <th style={{ padding: "10px", border: "1px solid #ddd" }}>Current Price</th>
                  <th style={{ padding: "10px", border: "1px solid #ddd" }}>Shares</th>
                  <th style={{ padding: "10px", border: "1px solid #ddd" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {recommendations.map((stock) => (
                  <tr key={stock.ticker}>
                    <td style={{ padding: "10px", border: "1px solid #ddd" }}>{stock.ticker}</td>
                    <td style={{ padding: "10px", border: "1px solid #ddd" }}>{stock.reason}</td>
                    <td style={{ padding: "10px", border: "1px solid #ddd" }}>${stock.current_price.toFixed(2)}</td>
                    <td style={{ padding: "10px", border: "1px solid #ddd" }}>
                      <input
                        type="number"
                        value={selectedStocks[stock.ticker] || ""}
                        onChange={(e) => handleShareChange(stock.ticker, e.target.value)}
                        style={{ padding: "5px", width: "60px" }}
                      />
                    </td>
                    <td style={{ padding: "10px", border: "1px solid #ddd" }}>
                      <button
                        onClick={() => handleShareChange(stock.ticker, 1)}
                        style={{ padding: "5px 10px" }}
                      >
                        Add 1 Share
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ marginTop: "20px" }}>
              <p><strong>Total Investment Cost:</strong> ${totalCost}</p>
              <button
                onClick={addToPortfolio}
                style={{ padding: "10px 20px", backgroundColor: "#4caf50", color: "white", border: "none" }}
              >
                Add Selected Stocks to Portfolio
              </button>
            </div>
          </>
        ) : (
          <p>No recommendations yet. Select a strategy to get started.</p>
        )}
      </div>
    </div>
  );
};

export default StrategyRecommendations;
