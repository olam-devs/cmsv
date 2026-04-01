import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import ErpShell from "./erp/ErpShell.jsx";
import FleetShell from "./fleet/FleetShell.jsx";
import FleetDashboard from "./FleetDashboard.jsx";
import Login from "./auth/Login.jsx";
import { getToken } from "./api.js";
import UsersPage from "./admin/UsersPage.jsx";
import ErrorBoundary from "./ErrorBoundary.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/erp" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/erp" element={getToken() ? <ErrorBoundary><ErpShell /></ErrorBoundary> : <Navigate to="/login" replace />} />
        <Route path="/users" element={getToken() ? <ErrorBoundary><UsersPage /></ErrorBoundary> : <Navigate to="/login" replace />} />
        <Route path="/fleet" element={getToken() ? <ErrorBoundary><FleetShell /></ErrorBoundary> : <Navigate to="/login" replace />} />
        <Route path="/fleet-legacy" element={<FleetDashboard />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
);
