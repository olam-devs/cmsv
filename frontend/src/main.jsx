import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import FleetDashboard from "./FleetDashboard.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <FleetDashboard />
  </StrictMode>
);
