import { useState, useEffect } from "react";
import { useSchema } from "../context/SchemaContext";
import { safeArray } from "../shared/schemaUtils";

/**
 * useFormulierDefinitie — haalt de actieve FormulierDefinitie op voor een gegeven doeltype.
 *
 * Laadt alle FormulierDefinities via de full-API, vindt degene met status "actief"
 * en is_standaard=true voor het doeltype. Retourneert de geparsede layout en metadata.
 *
 * @param {string} doeltype - Typenaam van de doelentiteit (bijv. "NatuurlijkPersoon")
 * @returns {{ formulierDefinitie, layout, loading, error }}
 */
export function useFormulierDefinitie(doeltype) {
  const { baseUrl } = useSchema();
  const [formulierDefinitie, setFormulierDefinitie] = useState(null);
  const [layout, setLayout] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!doeltype || !baseUrl) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    // Haal alle FormulierDefinities op via de standaard lijst-API.
    fetch(`${baseUrl}/formulier_definities`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(async (lijst) => {
        if (cancelled) return;

        const items = safeArray(lijst);
        if (items.length === 0) {
          setLoading(false);
          return;
        }

        // Haal per FormulierDefinitie de full data op om Meta en Layout te lezen.
        // In een productieomgeving zou je dit via een query-parameter doen.
        const fullPromises = items.map((item) =>
          fetch(`${baseUrl}/full/formulier_definities/${item.id}`)
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null)
        );
        const fullItems = await Promise.all(fullPromises);
        if (cancelled) return;

        // Zoek de actieve standaard-definitie voor dit doeltype.
        const match = fullItems.find((full) => {
          if (!full) return false;
          const metaData = vindActueleData(full, "formulier_definitie_metas");
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

        const metaData = vindActueleData(match, "formulier_definitie_metas");
        const layoutData = vindActueleData(match, "formulier_definitie_layouts");
        let parsedLayout = null;

        if (layoutData?.layout_json) {
          try {
            parsedLayout = JSON.parse(layoutData.layout_json);
          } catch {
            setError("Ongeldige layout JSON in FormulierDefinitie");
          }
        }

        setFormulierDefinitie({ id: match.id, meta: metaData, layoutRaw: layoutData });
        setLayout(parsedLayout);
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

  return { formulierDefinitie, layout, loading, error };
}

/**
 * Vindt de actuele (niet-afgevoerde) _Data record uit een genest GE in een full-entity response.
 * Verwacht de structuur: entity.{geNaam}[0].data[laatsteActuele].
 */
function vindActueleData(fullEntity, geJsonNaam) {
  const geItems = safeArray(fullEntity?.[geJsonNaam]);
  for (const hub of geItems) {
    const dataItems = safeArray(hub?.data);
    // Actueel = heeft opvoer, geen afvoer
    const actueel = dataItems.find((d) => d?.opvoer && !d?.afvoer);
    if (actueel) return actueel;
    // Fallback: laatste versie
    if (dataItems.length > 0) return dataItems[dataItems.length - 1];
  }
  return null;
}
