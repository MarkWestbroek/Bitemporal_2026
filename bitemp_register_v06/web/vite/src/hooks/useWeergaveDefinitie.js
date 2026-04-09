import { useState, useEffect } from "react";
import { useSchema } from "../context/SchemaContext";
import { safeArray } from "../shared/schemaUtils";

/**
 * useWeergaveDefinitie — haalt de actieve WeergaveDefinitie op voor een gegeven doeltype.
 *
 * Laadt alle WeergaveDefinities via de full-lijst-API, vindt degene met status "actief"
 * en is_standaard=true voor het doeltype. Retourneert de geparsede tabelConfig,
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

  useEffect(() => {
    if (!doeltype || !baseUrl) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`${baseUrl}/full/weergave_definities`)
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

        // Zoek de actieve standaard-definitie voor dit doeltype.
        const match = items.find((full) => {
          if (!full) return false;
          const metaData = vindActueleData(full, "weergave_definitie_metas");
          return (
            metaData?.doeltype === doeltype &&
            metaData?.status === "actief" &&
            (metaData?.is_standaard === true || metaData?.is_standaard === "true")
          );
        });

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

  return { weergaveDefinitie, tabelConfig, detailTemplate, loading, error };
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
