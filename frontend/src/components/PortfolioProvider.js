import React, { createContext, useContext, useState } from "react";
import axios from "axios";

const PortfolioContext = createContext();

export const PortfolioProvider = ({ children }) => {
  const [portfolio, setPortfolio] = useState([]);

  const refreshPortfolio = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get("http://127.0.0.1:5000/api/portfolio", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setPortfolio(response.data);
    } catch (error) {
      console.error("Error fetching portfolio:", error);
    }
  };

  return (
    <PortfolioContext.Provider value={{ portfolio, refreshPortfolio }}>
      {children}
    </PortfolioContext.Provider>
  );
};

export const usePortfolio = () => useContext(PortfolioContext);
