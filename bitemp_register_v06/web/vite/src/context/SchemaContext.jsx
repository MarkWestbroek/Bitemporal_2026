import { createContext, useContext, useState, useEffect, useMemo } from "react";
import { safeArray } from "../shared/schemaUtils";

const SchemaContext = createContext(null);

/**
 * SchemaProvider — haalt het vizSchema eenmaal op en maakt het beschikbaar
 * aan alle editor-componenten via React Context.
 */
export function SchemaProvider({ baseUrl, children }) {
  const [vizSchema, setVizSchema] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`${baseUrl}/api/viz/schema`)
      .then((res) => {
        if (!res.ok) throw new Error(`Schema HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!cancelled) {
          setVizSchema(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [baseUrl]);

  // Lookup maps
  const typeMetaByTypenaam = useMemo(() => {
    const result = {};
    safeArray(vizSchema?.types).forEach((item) => {
      if (item?.typenaam) result[item.typenaam] = item;
    });
    return result;
  }, [vizSchema]);

  const typeMetaByPadnaam = useMemo(() => {
    const result = {};
    safeArray(vizSchema?.types).forEach((item) => {
      // meervoud = Go Padnaam (URL-pad), veldnaam = JSON field name
      if (item?.meervoud) result[item.meervoud] = item;
      if (item?.veldnaam) result[item.veldnaam] = item;
    });
    return result;
  }, [vizSchema]);

  const entiteitTypes = useMemo(() => {
    return safeArray(vizSchema?.types).filter(
      (t) => t?.metatype === "entiteit" && t?.entiteitSubtype !== "referentielijst" && t?.entiteitSubtype !== "referentielijst_item"
    );
  }, [vizSchema]);

  const value = useMemo(
    () => ({
      vizSchema,
      loading,
      error,
      baseUrl,
      typeMetaByTypenaam,
      typeMetaByPadnaam,
      entiteitTypes,
      allTypes: safeArray(vizSchema?.types),
    }),
    [vizSchema, loading, error, baseUrl, typeMetaByTypenaam, typeMetaByPadnaam, entiteitTypes]
  );

  return <SchemaContext.Provider value={value}>{children}</SchemaContext.Provider>;
}

export function useSchema() {
  const ctx = useContext(SchemaContext);
  if (!ctx) throw new Error("useSchema moet binnen een <SchemaProvider> worden gebruikt.");
  return ctx;
}
