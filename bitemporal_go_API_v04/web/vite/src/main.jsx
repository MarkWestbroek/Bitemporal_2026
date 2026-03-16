import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

class RootErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMessage: "" };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      errorMessage: String(error?.message || error || "Onbekende runtime-fout"),
    };
  }

  componentDidCatch(error, errorInfo) {
    console.error("[React RootErrorBoundary]", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ margin: "24px auto", maxWidth: 820, padding: 16, fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif" }}>
          <h2 style={{ margin: "0 0 10px", color: "#991b1b" }}>Runtime-fout in de pagina</h2>
          <p style={{ margin: "0 0 8px", color: "#334155" }}>
            De React-app is gecrasht tijdens renderen. Details:
          </p>
          <pre style={{ margin: 0, padding: "10px 12px", borderRadius: 8, background: "#f8fafc", border: "1px solid #e2e8f0", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
            {this.state.errorMessage}
          </pre>
          <button onClick={() => window.location.reload()} style={{ marginTop: 12 }}>
            Herlaad pagina
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </React.StrictMode>
);
