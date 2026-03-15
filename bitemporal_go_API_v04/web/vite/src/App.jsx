import { useMemo } from "react";
import IndexSchemaPage from "./pages/IndexSchemaPage";
import TijdlijnSchemaPage from "./pages/TijdlijnSchemaPage";

function routeFromPath(pathname) {
  const path = String(pathname || "").toLowerCase();
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

  if (route === "tijdlijn") {
    return <TijdlijnSchemaPage />;
  }

  return <IndexSchemaPage />;
}
