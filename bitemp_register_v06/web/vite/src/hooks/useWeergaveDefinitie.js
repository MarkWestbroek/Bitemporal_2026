import { useState, useEffect } from "react";
import { useSchema } from "../context/SchemaContext";
import { safeArray } from "../shared/schemaUtils";

/**
 * useWeergaveDefinitie — haalt de actieve WeergaveDefinitie op voor een gegeven doeltype.
 *
 * Laadt alle WeergaveDefinities via de full-lijst-API, vindt degene met status "actief"
 * en is_standaard=true voor het doeltype. Met `?weergave=<id>` in de URL (querystring vóór de
 * `#`, zoals `embed=1`) wordt DIE definitie gebruikt, als hij actief is en bij het doeltype hoort:
 * zo kan een tweede weergave (bv. met weergavevormen) naast de standaard bestaan zonder de
 * standaard, en dus de embed op commonground.nl, te raken. Retourneert de geparsede tabelConfig,
 * het detailTemplate en de metadata.
 *
 * @param {string} doeltype - Typenaam van de doelentiteit (bijv. "NatuurlijkPersoon")
 * @returns {{ weergaveDefinitie, tabelConfig, detailTemplate, loading, error }}
 */
export function useWeergaveDefinitie(doeltype) {
  const { baseUrl } = useSchema();
  const [weergaveDefinitie, setWeergaveDefinitie] = useState(null);
  const [tabelConfig, setTabelConfig] = useState(null);
  const [detailTemplate, setDetailTemplate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // Alle actieve definities voor het type (voor de keuzelijst "Weergave", WeergaveKiezer).
  const [alternatieven, setAlternatieven] = useState([]);

  useEffect(() => {
    if (!doeltype || !baseUrl) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`${baseUrl}/full/weergave_definities?size=1000`) // standaard is een pagina van 20
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((lijst) => {
        if (cancelled) return;

        const items = safeArray(lijst?.["weergave definities"]);
        if (items.length === 0) {
          setLoading(false);
          return;
        }

        // ?weergave=<id> kiest een bepaalde actieve definitie voor dit doeltype; anders de standaard.
        const gekozen = gekozenWeergaveId();
        const actiefVoorType = (full) => {
          const metaData = full && vindActueleData(full, "weergave_definitie_metas");
          return metaData?.doeltype === doeltype && metaData?.status === "actief" ? metaData : null;
        };
        const match = (gekozen && items.find((full) => String(full?.id) === gekozen && actiefVoorType(full)))
          || items.find((full) => {
            const metaData = actiefVoorType(full);
            return metaData && (metaData.is_standaard === true || metaData.is_standaard === "true");
          });

        setAlternatieven(items.map((full) => {
          const m = actiefVoorType(full);
          return m ? { id: full.id, naam: m.naam || `Weergave ${full.id}`, isStandaard: m.is_standaard === true || m.is_standaard === "true" } : null;
        }).filter(Boolean).sort((a, b) => Number(b.isStandaard) - Number(a.isStandaard) || a.naam.localeCompare(b.naam, "nl")));

        if (!match) {
          setLoading(false);
          return;
        }

        const metaData = vindActueleData(match, "weergave_definitie_metas");
        const tabelData = vindActueleData(match, "weergave_definitie_tabel_configs");
        const templateData = vindActueleData(match, "weergave_definitie_detail_templates");

        let parsedTabelConfig = null;
        if (tabelData?.tabel_config_json) {
          try {
            parsedTabelConfig = JSON.parse(tabelData.tabel_config_json);
          } catch {
            setError("Ongeldige tabel_config_json in WeergaveDefinitie");
          }
        }

        setWeergaveDefinitie({ id: match.id, meta: metaData });
        setTabelConfig(parsedTabelConfig);
        setDetailTemplate(templateData?.template_tekst || null);
        setLoading(false);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [doeltype, baseUrl]);

  return { weergaveDefinitie, tabelConfig, detailTemplate, alternatieven, loading, error };
}

/** `?weergave=<id>` uit de URL (vóór de #), of null. */
function gekozenWeergaveId() {
  try {
    return new URLSearchParams(window.location.search).get("weergave") || null;
  } catch {
    return null;
  }
}

/**
 * Vindt de actuele (niet-afgevoerde) _Data record uit een genest GE in een full-entity response.
 */
function vindActueleData(fullEntity, geJsonNaam) {
  const geItems = safeArray(fullEntity?.[geJsonNaam]);
  for (const hub of geItems) {
    const dataItems = safeArray(hub?.data);
    const actueel = dataItems.find((d) => d?.opvoer && !d?.afvoer);
    if (actueel) return actueel;
    if (dataItems.length > 0) return dataItems[dataItems.length - 1];
  }
  return null;
}
