import { useEffect, useState } from "react";
import { useSchema } from "../../context/SchemaContext";
import { bouwReflijstOptieLabel } from "../../shared/celEvaluator";
import RefCombobox from "./RefCombobox";

/**
 * RefMeerkeuze — meervoudige keuze uit een referentielijst als chips + één zoekveld
 * (lijst.widget = "meerkeuze" op een relatie naar een referentielijst-item, bv.
 * InitiatiefAPIStandaard → ApiStandaard, InitiatiefDomein → Domein, InitiatiefGemeente → Gemeente).
 * Compacter en sneller dan een rij per item: typen, kiezen, chip; ✕ haalt hem weg.
 *
 * Labels komen mee met de keuze; voor al aanwezige id's (bewerk-modus) worden ze eenmalig
 * uit /api/viz/reflijst/:type/opties geladen.
 *
 * Props: refType, ids (array), onAdd(id), onRemove(id), readOnly
 */
export default function RefMeerkeuze({ refType, ids, onAdd, onRemove, readOnly }) {
  const { baseUrl, typeMetaByTypenaam } = useSchema();
  const refMeta = typeMetaByTypenaam?.[refType];
  const [labels, setLabels] = useState({});
  const gekozen = (ids || []).map(String);
  const onbekend = gekozen.filter((id) => !labels[id]);

  useEffect(() => {
    if (onbekend.length === 0 || !baseUrl || !refType) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${baseUrl}/api/viz/reflijst/${encodeURIComponent(refType)}/opties?size=500`);
        if (!res.ok) return;
        const data = await res.json();
        const uit = {};
        for (const o of data?.opties || []) uit[String(o.id)] = bouwReflijstOptieLabel(o, refMeta, typeMetaByTypenaam) || String(o.id);
        if (!cancelled) setLabels((prev) => ({ ...uit, ...prev }));
      } catch {
        // labels blijven id's
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onbekend.join(","), baseUrl, refType]);

  return (
    <div>
      {gekozen.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem", marginBottom: "0.5rem" }}>
          {gekozen.map((id) => (
            <span key={id} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "0.2rem 0.6rem", borderRadius: 999, background: "var(--cg-lichtgrijs, #e2e8f0)", fontSize: "0.875rem" }}>
              {labels[id] || `#${id}`}
              {!readOnly && (
                <button type="button" onClick={() => onRemove(id)} aria-label={`Verwijder ${labels[id] || id}`} style={{ border: "none", background: "none", cursor: "pointer", padding: 0, lineHeight: 1, color: "var(--cg-fout, #dc2626)" }}>✕</button>
              )}
            </span>
          ))}
        </div>
      )}
      {!readOnly && (
        <RefCombobox
          refType={refType}
          value=""
          onChange={() => {}}
          placeholder={`Zoek en voeg ${(refMeta?.klassenaam || refType).toLowerCase()} toe…`}
          onSelect={(item, label) => {
            const id = String(item.id);
            setLabels((prev) => ({ ...prev, [id]: label || id }));
            if (!gekozen.includes(id)) onAdd(id);
          }}
        />
      )}
    </div>
  );
}
