import { useEffect, useState } from "react";
import { useSchema } from "../../context/SchemaContext";
import { bouwReflijstOptieLabel } from "../../shared/celEvaluator";

/**
 * useRefOpties — de KEUZEBRON voor vormen die alle opties tegelijk tonen (button-group,
 * image-map) op een referentielijst: haalt de items eenmalig op als [{ id, label }].
 * De vormen zelf halen niets op (draagbaar naar Imprint); dit is de Omnium-kant.
 * Bedoeld voor kleine lijsten (tot ~500 items); grote lijsten horen bij de combobox.
 */
export default function useRefOpties(refType, { actief = true } = {}) {
  const { baseUrl, typeMetaByTypenaam } = useSchema();
  const [opties, setOpties] = useState(null);

  useEffect(() => {
    if (!actief || !refType || baseUrl == null) return;
    let cancelled = false;
    const refMeta = typeMetaByTypenaam?.[refType];
    fetch(`${baseUrl}/api/viz/reflijst/${encodeURIComponent(refType)}/opties?size=500`)
      .then((r) => (r.ok ? r.json() : { opties: [] }))
      .then((data) => {
        if (cancelled) return;
        setOpties((data?.opties || []).map((o) => ({ id: o.id, label: bouwReflijstOptieLabel(o, refMeta, typeMetaByTypenaam) || String(o.id) })));
      })
      .catch(() => { if (!cancelled) setOpties([]); });
    return () => { cancelled = true; };
  }, [actief, refType, baseUrl, typeMetaByTypenaam]);

  return opties; // null = laden
}
