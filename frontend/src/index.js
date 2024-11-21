// /frontend/src/index.js
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/styles.css"; // Import your custom styles
import { PortfolioProvider } from "./components/PortfolioProvider";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <PortfolioProvider >
        <App />
    </PortfolioProvider>
  </React.StrictMode>
);
