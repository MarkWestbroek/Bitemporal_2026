import { Component } from "react";

/**
 * ErrorBoundary — Vangt React-render-fouten op en toont de foutmelding.
 * 
 * Gebruik: <ErrorBoundary label="DiagramCanvas"><DiagramCanvas /></ErrorBoundary>
 * Toont de werkelijke fout in plaats van FlexLayout's generieke "Error rendering component".
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error(`[ErrorBoundary:${this.props.label || "?"}]`, error, errorInfo);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 16, color: "#ff6b6b", fontSize: 13, overflow: "auto", height: "100%" }}>
          <h4 style={{ margin: "0 0 8px", color: "#ff4444" }}>
            ❌ Fout in {this.props.label || "component"}
          </h4>
          <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", margin: "0 0 12px", color: "#ffaaaa" }}>
            {this.state.error?.toString()}
          </pre>
          {this.state.errorInfo?.componentStack && (
            <details>
              <summary style={{ cursor: "pointer", color: "#888" }}>Component stack</summary>
              <pre style={{ fontSize: 11, color: "#888", whiteSpace: "pre-wrap" }}>
                {this.state.errorInfo.componentStack}
              </pre>
            </details>
          )}
          <button
            onClick={() => this.setState({ error: null, errorInfo: null })}
            style={{
              marginTop: 12,
              padding: "4px 12px",
              background: "#444",
              color: "#ccc",
              border: "1px solid #666",
              borderRadius: 3,
              cursor: "pointer",
            }}
          >
            🔄 Opnieuw proberen
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
