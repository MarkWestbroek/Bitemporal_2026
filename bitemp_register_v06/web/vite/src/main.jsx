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

  handleReset = () => {
    // Verwijder mogelijk corrupte layout state, behoud model data
    localStorage.removeItem("ide-layout");
    window.location.reload();
  };

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
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button onClick={this.handleReset} style={{ padding: "6px 16px", background: "#1d4ed8", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}>
              Reset layout en herlaad
            </button>
            <button onClick={() => window.location.reload()} style={{ padding: "6px 16px" }}>
              Herlaad pagina
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// NB: Geen React.StrictMode — flexlayout-react, react-arborist en @xyflow/react
// manipuleren de DOM direct. StrictMode's dubbele mount/unmount veroorzaakt
// "removeChild" fouten met deze libraries.
createRoot(document.getElementById("root")).render(
  <RootErrorBoundary>
    <App />
  </RootErrorBoundary>
);
