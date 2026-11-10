import { useState, useEffect } from "react";
import { useSchema } from "../context/SchemaContext";
import { safeArray } from "../shared/schemaUtils";
import { actueleData as vindActueleData } from "../shared/actueleData";
import { losInvoegingenOp } from "../shared/formulierInvoegen";

/**
 * Opzoekfunctie code → layout over alle (niet-afgevoerde) definities, voor `invoegen`
 * (10-11, shared/formulierInvoegen.js). Een actieve definitie wint van een concept.
 */
function sjabloonZoeker(items) {
  const perCode = new Map();
  for (const full of items) {
    if (!full || full.afvoer) continue;
    const meta = vindActueleData(full, "formulier_definitie_metas");
    const code = meta?.code;
    if (!code) continue;
    if (perCode.has(code) && meta?.status !== "actief") continue;
    const ld = vindActueleData(full, "formulier_definitie_layouts");
    try {
      if (ld?.layout_json) perCode.set(code, JSON.parse(ld.layout_json));
    } catch {
      /* ongeldige layout: niet als sjabloon bruikbaar */
    }
  }
  return (code) => perCode.get(code) || null;
}

/** Layout met `invoegen` opgelost; bij een fout (cyclus, onbekende code) de fout als tekst. */
function metInvoegingen(layout, zoek, code) {
  if (!layout) return { layout, fout: null };
  try {
    return { layout: losInvoegingenOp(layout, zoek, { code }), fout: null };
  } catch (e) {
    return { layout, fout: e?.message || String(e) };
  }
}

/**
 * useFormulierDefinitie — haalt de actieve FormulierDefinitie op voor een gegeven doeltype.
 *
 * Laadt alle FormulierDefinities via de full-lijst-API, vindt degene met status "actief"
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

    // Gebruik de full-lijst-API direct. Voor FormulierDefinitie is de full-detailroute
    // niet overal beschikbaar, maar de full-lijstroute levert wel de geneste Meta/Layout.
    fetch(`${baseUrl}/full/formulier_definities?size=1000`) // standaard is een pagina van 20
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((lijst) => {
        if (cancelled) return;

        const items = safeArray(lijst?.["formulier definities"]);
        if (items.length === 0) {
          setLoading(false);
          return;
        }

        // Zoek de actieve standaard-definitie voor dit doeltype.
        const match = items.find((full) => {
          if (!full || full.afvoer) return false; // afgevoerde definitie telt niet mee
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
        const opgelost = metInvoegingen(parsedLayout, sjabloonZoeker(items), metaData?.code);
        parsedLayout = opgelost.layout;
        if (opgelost.fout) setError(opgelost.fout);

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
 * useFormulierDefinities — alle actieve FormulierDefinities voor een doeltype, met geparsede
 * layout. Voor de nieuw-modus (een formulier kiezen op de "+ Nieuw"-pagina); de standaard
 * (is_standaard) staat voorop.
 *
 * `doeltype = "*"` levert de actieve definities van alle doeltypen (voor subformulieren).
 *
 * @returns {{ definities: Array<{id, meta, layout}>, loading, error }}
 */
export function useFormulierDefinities(doeltype) {
  const { baseUrl } = useSchema();
  const [definities, setDefinities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!doeltype || !baseUrl) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`${baseUrl}/full/formulier_definities?size=1000`) // standaard is een pagina van 20
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((lijst) => {
        if (cancelled) return;
        const uit = [];
        const alle = safeArray(lijst?.["formulier definities"]);
        const zoek = sjabloonZoeker(alle);
        for (const full of alle) {
          if (!full || full.afvoer) continue;
          const meta = vindActueleData(full, "formulier_definitie_metas");
          if ((doeltype !== "*" && meta?.doeltype !== doeltype) || meta?.status !== "actief") continue;
          const layoutData = vindActueleData(full, "formulier_definitie_layouts");
          let layout = null;
          try {
            layout = layoutData?.layout_json ? JSON.parse(layoutData.layout_json) : null;
          } catch {
            layout = null;
          }
          if (!layout) continue;
          // Een fout bij invoegen (cyclus, onbekende code) laat het `invoegen`-element staan; de
          // renderer zegt dan dat het formulier daar niet is ingevoegd.
          layout = metInvoegingen(layout, zoek, meta?.code).layout;
          uit.push({ id: full.id, meta, layout, isStandaard: meta.is_standaard === true || meta.is_standaard === "true" });
        }
        uit.sort((a, b) => Number(b.isStandaard) - Number(a.isStandaard) || String(a.meta?.naam || "").localeCompare(String(b.meta?.naam || "")));
        setDefinities(uit);
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

  return { definities, loading, error };
}

