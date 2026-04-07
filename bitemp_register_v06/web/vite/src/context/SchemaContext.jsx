import { createContext, useContext, useState, useEffect, useMemo } from "react";
import { safeArray } from "../shared/schemaUtils";

const SchemaContext = createContext(null);

function bepaalWeergavenaam(meta) {
  return meta?.klassenaam || meta?.typenaam || meta?.veldnaam || meta?.padnaam || "Onbekend";
}

function normaliseerDomein(meta) {
  const raw = typeof meta?.domein === "string" ? meta.domein.trim() : "";
  return raw || "Zonder domein";
}

function vergelijkOpWeergavenaam(a, b) {
  return bepaalWeergavenaam(a).localeCompare(bepaalWeergavenaam(b), "nl", {
    sensitivity: "base",
    numeric: true,
  });
}

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

  // Inhoudstypen voor navigatie:
  // - reguliere entiteiten
  // - referentielijst-items
  // - referentielijst-definities zelf blijven verborgen in de inhoudseditor
  const inhoudTypes = useMemo(() => {
    return types.filter((t) => {
      if (t?.metatype !== "entiteit") return false;
      if (!(t?.padnaam || t?.meervoud || t?.veldnaam)) return false;
      const sub = t.entiteitSubtype || "";
      return sub !== "referentielijst";
    });
  }, [types]);

  const entiteitTypes = useMemo(() => {
    return inhoudTypes
      .filter((t) => (t.entiteitSubtype || "") !== "referentielijst_item")
      .slice()
      .sort(vergelijkOpWeergavenaam);
  }, [inhoudTypes]);

  const referentielijstItemTypes = useMemo(() => {
    return inhoudTypes
      .filter((t) => (t.entiteitSubtype || "") === "referentielijst_item")
      .slice()
      .sort(vergelijkOpWeergavenaam);
  }, [inhoudTypes]);

  const inhoudNavigatieGroepen = useMemo(() => {
    const groepen = new Map();

    inhoudTypes.forEach((meta) => {
      const domein = normaliseerDomein(meta);
      if (!groepen.has(domein)) {
        groepen.set(domein, { domein, entiteiten: [], referentielijstItems: [] });
      }

      const groep = groepen.get(domein);
      if ((meta.entiteitSubtype || "") === "referentielijst_item") {
        groep.referentielijstItems.push(meta);
      } else {
        groep.entiteiten.push(meta);
      }
    });

    return Array.from(groepen.values()).map((groep) => ({
      ...groep,
      entiteiten: groep.entiteiten.slice().sort(vergelijkOpWeergavenaam),
      referentielijstItems: groep.referentielijstItems.slice().sort(vergelijkOpWeergavenaam),
    }));
  }, [inhoudTypes]);

  const value = useMemo(
    () => ({
      loading,
      error,
      baseUrl,
      typeMetaByTypenaam,
      typeMetaByPadnaam,
      entiteitTypes,
      referentielijstItemTypes,
      inhoudNavigatieGroepen,
      allTypes: types,
      v3Model,
    }),
    [
      loading,
      error,
      baseUrl,
      typeMetaByTypenaam,
      typeMetaByPadnaam,
      entiteitTypes,
      referentielijstItemTypes,
      inhoudNavigatieGroepen,
      types,
      v3Model,
    ]
  );

  return <SchemaContext.Provider value={value}>{children}</SchemaContext.Provider>;
}

export function useSchema() {
  const ctx = useContext(SchemaContext);
  if (!ctx) throw new Error("useSchema moet binnen een <SchemaProvider> worden gebruikt.");
  return ctx;
}
