// Same-origin: leave VITE_API_BASE empty. Split deploy: e.g. VITE_API_BASE=https://api.example.com/api
const API_BASE = String(import.meta.env.VITE_API_BASE ?? "")
  .trim()
  .replace(/\/$/, "") || "/api";

// NOTE: Step 3 will replace this with real user auth (token/cookie).
// For now keep API key header to avoid breaking existing middleware auth.
const API_KEY =
  String(import.meta.env.VITE_API_KEY ?? "").trim() || "hshfd24d7998476hfbvvhfbh";

const TOKEN_KEY = "fleetvu_token";

export function getToken() {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

export function setToken(token) {
  try {
    if (!token) localStorage.removeItem(TOKEN_KEY);
    else localStorage.setItem(TOKEN_KEY, token);
  } catch {}
}

export function logout() {
  setToken(null);
}

export async function apiFetch(path, opts = {}) {
  const { method = "GET", body, headers: extraHeaders } = opts;
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), 20000);
  try {
    const token = getToken();
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      signal: controller.signal,
      headers: {
        // Send API key for legacy routes, and JWT for ERP2/auth routes.
        // This avoids "can't login" issues caused by stale tokens and keeps /fleet working.
        "x-api-key": API_KEY,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...extraHeaders,
      },
      ...(body ? { body: typeof body === "string" ? body : JSON.stringify(body) } : {}),
    });
    if (res.status === 401) {
      // Token is missing/invalid/expired. Clear and redirect to login for a clean re-auth.
      logout();
      try {
        if (typeof window !== "undefined" && window.location?.pathname !== "/login") {
          window.location.assign("/login");
        }
      } catch {}
    }
    const text = await res.text();
    const trimmed = text.trim();
    if (trimmed && (/^<!DOCTYPE/i.test(trimmed) || /^<html/i.test(trimmed))) {
      throw new Error(
        `The server returned HTML instead of JSON (HTTP ${res.status} on ${API_BASE}${path}). ` +
          "The API request likely did not reach the Node middleware (wrong host, missing /api proxy, or static hosting only).",
      );
    }
    let json = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      if (trimmed) {
        throw new Error(
          `Invalid JSON from API (HTTP ${res.status} on ${path}): ${text.slice(0, 160)}${text.length > 160 ? "…" : ""}`,
        );
      }
      json = {};
    }
    if (!res.ok || json.success === false) {
      if (res.status === 401) throw new Error(json.message || json.error || "Session expired. Please login again.");
      const msg =
        json.message ||
        json.error ||
        (res.status === 404 ? `Not found (${path}) — restart middleware after deploy` : null);
      throw new Error(msg || `HTTP ${res.status} on ${path}`);
    }
    return json.data ?? json;
  } finally {
    clearTimeout(tid);
  }
}

