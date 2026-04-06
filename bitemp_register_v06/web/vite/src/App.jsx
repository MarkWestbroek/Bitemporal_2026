import { useMemo, lazy, Suspense } from "react";
import IndexSchemaPage from "./pages/IndexSchemaPage";
import TijdlijnSchemaPage from "./pages/TijdlijnSchemaPage";
import RegistratieReplayPage from "./pages/RegistratieReplayPage";

// Lazy-load de editors zodat @xyflow/react niet in elke pagina-bundle zit
const EditorPage = lazy(() => import("./pages/EditorPage"));
const EditorV2Page = lazy(() => import("./pages/EditorV2Page"));
const IdePage = lazy(() => import("./pages/IdePage"));

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
    path.endsWith("/editor-v2") ||
    path.endsWith("/editor-v2/") ||
    path.endsWith("/editor-v2.html")
  ) {
    return "editor-v2";
  }
  if (
    path.endsWith("/ide") ||
    path.endsWith("/ide/") ||
    path.endsWith("/ide.html")
  ) {
    return "ide";
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

  if (route === "editor-v2") {
    return (
      <Suspense fallback={<div style={{ padding: 32 }}>Editor v2 laden…</div>}>
        <EditorV2Page />
      </Suspense>
    );
  }

  if (route === "ide") {
    return (
      <Suspense fallback={<div style={{ padding: 32 }}>IDE laden…</div>}>
        <IdePage />
      </Suspense>
    );
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
