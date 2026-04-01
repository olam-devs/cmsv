import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error: error || new Error("Unknown error") };
  }

  componentDidCatch(error, info) {
    try {
      // Keep this as console output for debugging blank screens.
      // eslint-disable-next-line no-console
      console.error("[UI Crash]", error, info);
    } catch {}
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div
        style={{
          minHeight: "100vh",
          padding: 18,
          background: "#0b1437",
          color: "#fff",
          fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
        }}
      >
        <div style={{ maxWidth: 920, margin: "0 auto", background: "#111c44", border: "1px solid #1b2a5e", borderRadius: 14, padding: 14 }}>
          <div style={{ fontWeight: 900, fontSize: 16 }}>Something crashed in the UI</div>
          <div style={{ marginTop: 8, fontSize: 12, color: "rgba(255,255,255,0.72)" }}>
            Copy the message below and send it to support (or me) to fix.
          </div>
          <pre style={{ marginTop: 12, whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 12, lineHeight: 1.35, background: "#0b1437", border: "1px solid #243d7a", borderRadius: 12, padding: 12 }}>
            {String(error?.stack || error?.message || error)}
          </pre>
          <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
            <button
              onClick={() => window.location.reload()}
              style={{ background: "#4318d1", border: 0, color: "#fff", padding: "10px 12px", borderRadius: 12, cursor: "pointer", fontWeight: 900 }}
            >
              Reload
            </button>
            <button
              onClick={() => (window.location.href = "/login")}
              style={{ background: "transparent", border: "1px solid #243d7a", color: "#fff", padding: "10px 12px", borderRadius: 12, cursor: "pointer", fontWeight: 900 }}
            >
              Go to Login
            </button>
          </div>
        </div>
      </div>
    );
  }
}

