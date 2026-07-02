import React from "react";
import { createRoot } from "react-dom/client";
import { AuthProvider } from "./context/AuthContext";
import App from "./App";

if (import.meta.hot) {
  let volledigeReloadAangevraagd = false;
  import.meta.hot.on("vite:beforeUpdate", (payload) => {
    if (volledigeReloadAangevraagd) return;
    const heeftDomIntensieveWijziging = Array.isArray(payload?.updates)
      && payload.updates.some((update) => {
        const pad = String(update?.path || "");
        // CSS- en asset-wijzigingen zijn veilig voor HMR en mogen partieel worden
        // bijgewerkt. Alles wat React-componentbomen of Zustand-stores raakt, kan
        // echter React Flow's interne DOM-staat (portals, observers) corrumperen als
        // het via een partiële HMR-update binnenkomt — vandaar de brede matchlijst.
        if (pad.endsWith(".css") || pad.endsWith(".svg") || pad.endsWith(".png")
          || pad.endsWith(".jpg") || pad.endsWith(".jpeg") || pad.endsWith(".gif")
          || pad.endsWith(".webp") || pad.endsWith(".woff") || pad.endsWith(".woff2")) {
          return false; // CSS/assets: altijd veilig als HMR
        }
        // LET OP: update.path is een URL relatief aan de Vite-root, dus
        // "/src/…" — NIET het bestandspad "/web/vite/src/…". De oude
        // matchlijst gebruikte dat laatste en matchte daardoor nooit
        // (de guard was dode code; partiële HMR-updates kwamen altijd door).
        return (
          pad.includes("/src/umleditor/")   // editor-v2 module
          || pad.includes("/src/ide/")      // IDE-laag (DiagramCanvas etc.)
          || pad.includes("/src/studio/")   // Studio-werkbank (shell + activiteiten)
          || pad.includes("/src/pages/")    // alle pagina's (IdePage, EditorV2Page…)
          || pad.includes("/src/store/")    // Zustand stores
          || pad.includes("/src/context/")  // React context
          || pad.includes("/src/diagramcore/")      // generieke diagram-motor (0.5)
          || pad.includes("/src/diagramprofielen/") // diagramprofielen (0.5)
          || pad.endsWith("/src/App.jsx")
          || pad.endsWith("/src/main.jsx")
          || pad.endsWith("/src/v3ModelNaarEditor.js")
          || pad.endsWith("/src/demoV3Model.js")
        );
      });

    if (heeftDomIntensieveWijziging) {
      volledigeReloadAangevraagd = true;
      // Expliciete page-reload — NIET import.meta.hot.invalidate().
      // invalidate() markeert main.jsx servergraph-breed als "gewijzigd";
      // omdat de Fast Refresh-footer van @vitejs/plugin-react deze module
      // self-accepting maakt, her-executeerde Vite main.jsx dan in-place
      // (tweede createRoot op #root → "removeChild"-crash) en bleef de
      // ?t-timestamp in de module graph staan, waardoor de footer-self-import
      // (main.jsx?t=…) bij élke volgende page-load een tweede module-instantie
      // laadde. location.reload() forceert dezelfde volledige herlaad zonder
      // de module graph te vervuilen.
      window.location.reload();
    }
  });
}

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
//
// Idempotente root als vangnet: mocht deze module ooit tóch dubbel uitgevoerd
// worden (bv. een tweede instantie via een ?t-self-import van de Fast
// Refresh-footer, zie de toelichting in de HMR-guard hierboven), dan mag er
// nooit een tweede createRoot op dezelfde container komen — dat geeft
// "removeChild"-crashes zodra beide roots dezelfde DOM muteren. De root wordt
// daarom op de container zelf bewaard (overleeft dubbele module-instanties).
const container = document.getElementById("root");
if (!container.__omniumRoot) {
  container.__omniumRoot = createRoot(container);
  container.__omniumRoot.render(
    <RootErrorBoundary>
      <AuthProvider>
        <App />
      </AuthProvider>
    </RootErrorBoundary>
  );
}
