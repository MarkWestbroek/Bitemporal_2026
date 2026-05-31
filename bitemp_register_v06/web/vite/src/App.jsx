import { useMemo, lazy, Suspense } from "react";
import { useAuth } from "./context/AuthContext";
import AuthBeschermd from "./components/AuthBeschermd";
import IndexSchemaPage from "./pages/IndexSchemaPage";
import TijdlijnSchemaPage from "./pages/TijdlijnSchemaPage";
import RegistratieReplayPage from "./pages/RegistratieReplayPage";

// Lazy-load de editors zodat @xyflow/react niet in elke pagina-bundle zit
const EditorPage = lazy(() => import("./pages/EditorPage"));
const EditorV2Page = lazy(() => import("./pages/EditorV2Page"));
const IdePage = lazy(() => import("./pages/IdePage"));
const UniversumPage = lazy(() => import("./universum/UniversumPage"));
const ModelPickerDemoPage = lazy(() => import("./pages/ModelPickerDemoPage"));
const DmnEditorDemoPage = lazy(() => import("./pages/DmnEditorDemoPage"));
const BerichtEditorDemoPage = lazy(() => import("./pages/BerichtEditorDemoPage"));

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
    path.endsWith("/universum") ||
    path.endsWith("/universum/") ||
    path.endsWith("/universum.html")
  ) {
    return "universum";
  }
  if (
    path.endsWith("/modelpicker") ||
    path.endsWith("/modelpicker/") ||
    path.endsWith("/modelpicker.html")
  ) {
    return "modelpicker";
  }
  if (
    path.endsWith("/dmn-demo") ||
    path.endsWith("/dmn-demo/") ||
    path.endsWith("/dmn-demo.html")
  ) {
    return "dmn-demo";
  }
  if (
    path.endsWith("/bericht-demo") ||
    path.endsWith("/bericht-demo/") ||
    path.endsWith("/bericht-demo.html")
  ) {
    return "bericht-demo";
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
      <AuthBeschermd vereistRol="editor">
        <Suspense fallback={<div style={{ padding: 32 }}>Editor v2 laden…</div>}>
          <EditorV2Page />
        </Suspense>
      </AuthBeschermd>
    );
  }

  if (route === "universum") {
    return (
      <Suspense fallback={<div style={{ padding: 32 }}>Universum laden…</div>}>
        <UniversumPage />
      </Suspense>
    );
  }

  if (route === "modelpicker") {
    return (
      <Suspense fallback={<div style={{ padding: 32 }}>ModelPicker laden…</div>}>
        <ModelPickerDemoPage />
      </Suspense>
    );
  }

  if (route === "dmn-demo") {
    return (
      <Suspense fallback={<div style={{ padding: 32 }}>DMN-editor laden…</div>}>
        <DmnEditorDemoPage />
      </Suspense>
    );
  }

  if (route === "bericht-demo") {
    return (
      <Suspense fallback={<div style={{ padding: 32 }}>Berichttype-editor laden…</div>}>
        <BerichtEditorDemoPage />
      </Suspense>
    );
  }

  if (route === "ide") {
    return (
      <AuthBeschermd vereistRol="editor">
        <Suspense fallback={<div style={{ padding: 32 }}>IDE laden…</div>}>
          <IdePage />
        </Suspense>
      </AuthBeschermd>
    );
  }

  if (route === "editor") {
    return (
      <AuthBeschermd vereistRol="editor">
        <Suspense fallback={<div style={{ padding: 32 }}>Editor laden…</div>}>
          <EditorPage />
        </Suspense>
      </AuthBeschermd>
    );
  }

  return <IndexSchemaPage />;
}
