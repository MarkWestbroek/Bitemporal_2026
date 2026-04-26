/**
 * OrphanDialog — modal die per orphan (GE/relatie zonder parent-entiteit) een
 * keuze vraagt: placeholder-entiteit aanmaken, overslaan, of de hele import
 * afbreken.
 *
 * Wordt aangeroepen door {@link MetamodelEditor} na een Mermaid/PlantUML/XMI
 * import wanneer {@link detecteerOrphans} treffers heeft.
 *
 * @module umleditor/components/OrphanDialog
 */
import { useState, useEffect } from "react";

const KLEUREN = {
  backdrop: "rgba(0,0,0,0.55)",
  bg: "#1f2937",
  border: "#374151",
  tekst: "#e5e7eb",
  zacht: "#9ca3af",
  accent: "#fde68a",
  warn: "#fca5a5",
};

const STIJL = {
  backdrop: {
    position: "fixed",
    inset: 0,
    background: KLEUREN.backdrop,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10000,
  },
  dialog: {
    background: KLEUREN.bg,
    border: `1px solid ${KLEUREN.border}`,
    borderRadius: 8,
    boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
    color: KLEUREN.tekst,
    minWidth: 520,
    maxWidth: 720,
    maxHeight: "80vh",
    display: "flex",
    flexDirection: "column",
    fontSize: 13,
  },
  header: {
    padding: "12px 18px",
    borderBottom: `1px solid ${KLEUREN.border}`,
  },
  title: { margin: 0, fontSize: 15, color: KLEUREN.accent },
  intro: {
    margin: "6px 0 0 0",
    fontSize: 12,
    color: KLEUREN.zacht,
    lineHeight: 1.5,
  },
  body: {
    padding: "12px 18px",
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  rij: {
    border: `1px solid ${KLEUREN.border}`,
    borderRadius: 5,
    padding: "8px 10px",
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  rijTitel: {
    display: "flex",
    gap: 8,
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  rijNaam: { fontWeight: 600, color: KLEUREN.accent },
  rijType: {
    fontSize: 11,
    color: KLEUREN.zacht,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  rijReden: { fontSize: 11, color: KLEUREN.warn },
  acties: { display: "flex", gap: 12 },
  actieLabel: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    fontSize: 12,
    cursor: "pointer",
  },
  voet: {
    padding: "10px 18px",
    borderTop: `1px solid ${KLEUREN.border}`,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  bulkSelect: {
    background: "#111827",
    color: KLEUREN.tekst,
    border: `1px solid ${KLEUREN.border}`,
    borderRadius: 3,
    padding: "4px 8px",
    fontSize: 12,
  },
  knoppen: { display: "flex", gap: 8 },
  btnAnnuleer: {
    background: "#374151",
    color: KLEUREN.tekst,
    border: `1px solid ${KLEUREN.border}`,
    borderRadius: 3,
    padding: "5px 14px",
    cursor: "pointer",
    fontSize: 12,
  },
  btnOk: {
    background: "#1a4a2e",
    color: "#8dff8d",
    border: "1px solid #3a7a4a",
    borderRadius: 3,
    padding: "5px 18px",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 600,
  },
};

const ACTIES = [
  { waarde: "placeholder", label: "Placeholder-entiteit aanmaken" },
  { waarde: "overslaan", label: "Overslaan (verwijderen)" },
  { waarde: "abort", label: "Hele import afbreken" },
];

/**
 * @param {Object} props
 * @param {Array<{nodeId:string,type:string,naam:string,reden:string}>} props.orphans
 * @param {(keuzes: Object<string,string>) => void} props.onBevestig
 *   Aangeroepen met de map nodeId → actie.
 * @param {() => void} props.onAnnuleer
 */
export default function OrphanDialog({ orphans, onBevestig, onAnnuleer }) {
  const [keuzes, setKeuzes] = useState(() => {
    const init = {};
    for (const o of orphans) init[o.nodeId] = "placeholder";
    return init;
  });

  // Schaal mee als de orphans-lijst verandert (defensief).
  useEffect(() => {
    setKeuzes((huidige) => {
      const nieuw = { ...huidige };
      for (const o of orphans) {
        if (!(o.nodeId in nieuw)) nieuw[o.nodeId] = "placeholder";
      }
      return nieuw;
    });
  }, [orphans]);

  const zetActie = (nodeId, actie) =>
    setKeuzes((k) => ({ ...k, [nodeId]: actie }));

  const zetAlles = (actie) => {
    const n = {};
    for (const o of orphans) n[o.nodeId] = actie;
    setKeuzes(n);
  };

  return (
    <div style={STIJL.backdrop} role="dialog" aria-modal="true">
      <div style={STIJL.dialog}>
        <div style={STIJL.header}>
          <h3 style={STIJL.title}>
            ⚠️ Import: {orphans.length} losliggend{orphans.length === 1 ? "" : "e"} element
            {orphans.length === 1 ? "" : "en"} gevonden
          </h3>
          <p style={STIJL.intro}>
            De geïmporteerde bron bevat gegevenselementen of relaties die niet
            aan een entiteit gekoppeld zijn. Kies per regel wat er moet
            gebeuren. <em>Placeholder</em> maakt een tijdelijke entiteit aan
            zodat het diagram klopt; je kunt die later hernoemen of vervangen.
          </p>
        </div>

        <div style={STIJL.body}>
          {orphans.map((o) => (
            <div key={o.nodeId} style={STIJL.rij}>
              <div style={STIJL.rijTitel}>
                <span style={STIJL.rijNaam}>{o.naam}</span>
                <span style={STIJL.rijType}>{o.type}</span>
              </div>
              <div style={STIJL.rijReden}>{o.reden}</div>
              <div style={STIJL.acties}>
                {ACTIES.map((a) => (
                  <label key={a.waarde} style={STIJL.actieLabel}>
                    <input
                      type="radio"
                      name={`actie-${o.nodeId}`}
                      value={a.waarde}
                      checked={keuzes[o.nodeId] === a.waarde}
                      onChange={() => zetActie(o.nodeId, a.waarde)}
                    />
                    {a.label}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div style={STIJL.voet}>
          <div>
            <label style={{ ...STIJL.actieLabel, color: KLEUREN.zacht }}>
              Bulk:
              <select
                style={STIJL.bulkSelect}
                value=""
                onChange={(e) => {
                  if (e.target.value) zetAlles(e.target.value);
                }}
              >
                <option value="">— alles op …</option>
                {ACTIES.map((a) => (
                  <option key={a.waarde} value={a.waarde}>
                    {a.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div style={STIJL.knoppen}>
            <button style={STIJL.btnAnnuleer} onClick={onAnnuleer}>
              Annuleer import
            </button>
            <button style={STIJL.btnOk} onClick={() => onBevestig(keuzes)}>
              Toepassen en importeren
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
