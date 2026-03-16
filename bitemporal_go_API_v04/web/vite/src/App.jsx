import { useMemo } from "react";
import IndexSchemaPage from "./pages/IndexSchemaPage";
import TijdlijnSchemaPage from "./pages/TijdlijnSchemaPage";
import RegistratieReplayPage from "./pages/RegistratieReplayPage";

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

  return <IndexSchemaPage />;
}
