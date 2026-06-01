import { useEffect, useState } from "react";
import { apiFetch, getToken } from "./api.js";
import Login from "./Login.jsx";
import DailyReport from "./DailyReport.jsx";
import { Spinner } from "./ui/primitives.jsx";

export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const path =
    typeof window !== "undefined" ? window.location.pathname.replace(/\/$/, "") : "";
  const isLogin = path === "/login" || path.endsWith("/login");

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setChecking(false);
      if (!isLogin) window.location.replace("/login");
      return;
    }
    apiFetch("/auth/me")
      .then((u) => setUser(u))
      .catch(() => {
        if (!isLogin) window.location.replace("/login");
      })
      .finally(() => setChecking(false));
  }, [isLogin]);

  if (isLogin) return <Login />;
  if (checking) return <Spinner label="Loading…" />;
  if (!user) return null;

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", padding: "16px 20px 40px" }}>
      <DailyReport username={user.username} />
    </div>
  );
}
