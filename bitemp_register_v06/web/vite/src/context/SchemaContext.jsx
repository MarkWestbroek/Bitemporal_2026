import { createContext, useContext, useState, useEffect, useMemo } from "react";
import { safeArray } from "../shared/schemaUtils";

const SchemaContext = createContext(null);

/**
 * SchemaProvider — haalt het schema eenmaal op via /api/schema/model/code
 * en maakt het beschikbaar aan alle editor-componenten via React Context.
 *
 * De response bevat:
 * - types: platte lijst van alle MetaRegistry-entries (met velden incl. ref, datatype)
 * - model: hiërarchisch V3 model (beschikbaar voor toekomstig gebruik)
 */
export function SchemaProvider({ baseUrl, children }) {
  const [types, setTypes] = useState([]);
  const [v3Model, setV3Model] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`${baseUrl}/api/schema/model/code`)
      .then((res) => {
        if (!res.ok) throw new Error(`Schema HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!cancelled) {
          setTypes(safeArray(data?.types));
          setV3Model(data?.model || null);
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

  // Lookup: typenaam → typeMeta
  const typeMetaByTypenaam = useMemo(() => {
    const result = {};
    types.forEach((item) => {
      if (item?.typenaam) result[item.typenaam] = item;
    });
    return result;
  }, [types]);

  // Lookup: padnaam / meervoud / veldnaam → typeMeta
  const typeMetaByPadnaam = useMemo(() => {
    const result = {};
    types.forEach((item) => {
      if (item?.padnaam) result[item.padnaam] = item;
      if (item?.meervoud) result[item.meervoud] = item;
      if (item?.veldnaam) result[item.veldnaam] = item;
    });
    return result;
  }, [types]);

  // Entiteiten voor navigatie (exclusief referentielijsten en referentielijst-items)
  const entiteitTypes = useMemo(() => {
    return types.filter((t) => {
      if (t?.metatype !== "entiteit") return false;
      const sub = t.entiteitSubtype || "";
      return sub !== "referentielijst" && sub !== "referentielijst_item";
    });
  }, [types]);

  const value = useMemo(
    () => ({
      loading,
      error,
      baseUrl,
      typeMetaByTypenaam,
      typeMetaByPadnaam,
      entiteitTypes,
      allTypes: types,
      v3Model,
    }),
    [loading, error, baseUrl, typeMetaByTypenaam, typeMetaByPadnaam, entiteitTypes, types, v3Model]
  );

  return <SchemaContext.Provider value={value}>{children}</SchemaContext.Provider>;
}

export function useSchema() {
  const ctx = useContext(SchemaContext);
  if (!ctx) throw new Error("useSchema moet binnen een <SchemaProvider> worden gebruikt.");
  return ctx;
}
