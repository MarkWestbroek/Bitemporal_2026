import { useMemo, lazy, Suspense } from "react";
import IndexSchemaPage from "./pages/IndexSchemaPage";
import TijdlijnSchemaPage from "./pages/TijdlijnSchemaPage";
import RegistratieReplayPage from "./pages/RegistratieReplayPage";

// Lazy-load de editor zodat @xyflow/react niet in elke pagina-bundle zit
const EditorPage = lazy(() => import("./pages/EditorPage"));

function routeFromPath(pathname) {
  const path = String(pathname || "").toLowerCase();
  if (
    path.endsWith("/registraties") ||
    path.endsWith("/registraties/") ||
    path.endsWith("/registraties.html") ||
    path.endsWith("/replay") ||
    path.endsWith("/replay/") ||
    path.endsWith("/replay.html")
  ) {
    return "registraties";
  }
  if (
    path.endsWith("/tijdlijn") ||
    path.endsWith("/tijdlijn/") ||
    path.endsWith("/tijdlijn.html")
  ) {
    return "tijdlijn";
  }
  if (
    path.endsWith("/editor") ||
    path.endsWith("/editor/") ||
    path.endsWith("/editor.html")
  ) {
    return "editor";
  }
  return "index";
}

export default function App() {
  const route = useMemo(() => routeFromPath(window.location.pathname), []);

  if (route === "registraties") {
    return <RegistratieReplayPage />;
  }

  if (route === "tijdlijn") {
    return <TijdlijnSchemaPage />;
  }

  if (route === "editor") {
    return (
      <Suspense fallback={<div style={{ padding: 32 }}>Editor laden…</div>}>
        <EditorPage />
      </Suspense>
    );
  }

  return <IndexSchemaPage />;
}
