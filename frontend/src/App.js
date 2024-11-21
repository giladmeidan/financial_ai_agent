import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Dashboard from "./components/Dashboard";
import Login from "./components/Login";
import Register from "./components/Register";
import StockPicker from "./components/StockPicker";
import Notifications from "./components/Notifications";
import StrategyRecommendations from "./components/StrategyRecommendations";

const App = () => {
  const isAuthenticated = !!localStorage.getItem("token");

  return (
    <Router>
      <Routes>
        {/* Redirect to dashboard if authenticated, otherwise to login */}
        <Route path="/" element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} />} />
        
        {/* Public routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Protected routes */}
        <Route path="/stock-picker" element={<StockPicker />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/recommendations" element={<StrategyRecommendations />} />
      </Routes>
    </Router>
  );
};

export default App;
