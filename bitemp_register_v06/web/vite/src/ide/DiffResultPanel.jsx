/**
 * DiffResultPanel — Toont de resultaten van een delta-analyse in de ActionDialog.
 *
 * Props:
 *   - diffResult: het DiffResponse object van de API (of null)
 *   - loading: boolean, of de diff nog bezig is
 */
import { useState } from "react";

const ERNST_KLEUREN = {
  destructief: { bg: "#3a1a1a", border: "#a33", color: "#ff8888", icon: "🔴" },
  modificatie: { bg: "#3a2a0a", border: "#a93", color: "#ffcc44", icon: "🟠" },
  additief:    { bg: "#1a3a1a", border: "#3a7a4a", color: "#8dff8d", icon: "🟢" },
  informatief: { bg: "#1a2633", border: "#2a4a6a", color: "#8cb4ff", icon: "🔵" },
};

const S = {
  container: { display: "flex", flexDirection: "column", gap: 8 },
  summary: {
    padding: "8px 12px", borderRadius: 4, fontSize: 12, lineHeight: 1.5,
  },
  countsRow: {
    display: "flex", gap: 12, fontSize: 11, padding: "4px 0",
  },
  countBadge: (kleur) => ({
    padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 600,
    background: kleur.bg, color: kleur.color, border: `1px solid ${kleur.border}`,
  }),
  itemsList: {
    maxHeight: 240, overflowY: "auto", display: "flex", flexDirection: "column",
    gap: 2, padding: "4px 0",
  },
  item: (kleur) => ({
    display: "flex", flexDirection: "column", gap: 2,
    padding: "4px 8px", borderRadius: 3, fontSize: 11, lineHeight: 1.4,
    background: kleur.bg, border: `1px solid ${kleur.border}`, color: kleur.color,
  }),
  itemHeader: {
    display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 600,
  },
  itemPad: { fontSize: 10, opacity: 0.8 },
  itemValues: { fontSize: 10, opacity: 0.7, fontStyle: "italic" },
  loading: {
    padding: "12px", textAlign: "center", color: "#8cb4ff", fontSize: 12,
  },
  migratieToggle: {
    background: "none", border: "1px solid #555", borderRadius: 3,
    color: "#ccc", fontSize: 11, padding: "3px 8px", cursor: "pointer",
    marginTop: 4,
  },
  migratieBlock: {
    background: "#111", border: "1px solid #333", borderRadius: 4,
    padding: "8px 10px", fontSize: 11, fontFamily: "monospace",
    whiteSpace: "pre-wrap", maxHeight: 200, overflowY: "auto",
    color: "#aaa", marginTop: 4,
  },
};

export default function DiffResultPanel({ diffResult, loading }) {
  const [showMigratie, setShowMigratie] = useState(false);
  const [filterErnst, setFilterErnst] = useState(null); // null = alle

  if (loading) {
    return <div style={S.loading}>⏳ Delta-analyse bezig…</div>;
  }

  if (!diffResult) return null;

  if (diffResult.status === "fout") {
    return (
      <div style={{ ...S.summary, background: "#3a1a1a", border: "1px solid #a33", color: "#ff8888" }}>
        <strong>❌ Fout:</strong> {diffResult.error}
      </div>
    );
  }

  const items = diffResult.items || [];
  const filtered = filterErnst ? items.filter((i) => i.ernst === filterErnst) : items;

  return (
    <div style={S.container}>
      {/* Samenvatting */}
      <div style={{
        ...S.summary,
        background: diffResult.is_breaking ? "#3a2a0a" : "#1a3a1a",
        border: `1px solid ${diffResult.is_breaking ? "#a93" : "#3a7a4a"}`,
        color: diffResult.is_breaking ? "#ffcc44" : "#8dff8d",
      }}>
        <strong>{diffResult.is_breaking ? "⚠️ Breaking changes" : "✅ Geen breaking changes"}</strong>
        <div style={{ fontSize: 11, opacity: 0.85, marginTop: 2 }}>{diffResult.samenvatting}</div>
      </div>

      {/* Tellingen als klikbare badges */}
      {items.length > 0 && (
        <div style={S.countsRow}>
          <BadgeFilter label={`${diffResult.destructief} destructief`} ernst="destructief" active={filterErnst} onClick={setFilterErnst} count={diffResult.destructief} />
          <BadgeFilter label={`${diffResult.modificatie} modificatie`} ernst="modificatie" active={filterErnst} onClick={setFilterErnst} count={diffResult.modificatie} />
          <BadgeFilter label={`${diffResult.additief} additief`} ernst="additief" active={filterErnst} onClick={setFilterErnst} count={diffResult.additief} />
          <BadgeFilter label={`${diffResult.informatief} informatief`} ernst="informatief" active={filterErnst} onClick={setFilterErnst} count={diffResult.informatief} />
          {filterErnst && (
            <button onClick={() => setFilterErnst(null)} style={{ ...S.migratieToggle, padding: "1px 6px", fontSize: 10 }}>✕ reset</button>
          )}
        </div>
      )}

      {/* Items-lijst */}
      {filtered.length > 0 && (
        <div style={S.itemsList}>
          {filtered.map((item, idx) => {
            const kleur = ERNST_KLEUREN[item.ernst] || ERNST_KLEUREN.informatief;
            return (
              <div key={idx} style={S.item(kleur)}>
                <div style={S.itemHeader}>
                  <span>{kleur.icon}</span>
                  <span>{item.actie}</span>
                  <span style={{ opacity: 0.6 }}>({item.categorie})</span>
                </div>
                <div style={S.itemPad}>{item.pad}</div>
                <div>{item.omschrijving}</div>
                {(item.oude_waarde || item.nieuwe_waarde) && (
                  <div style={S.itemValues}>
                    {item.oude_waarde && <span>was: {item.oude_waarde}</span>}
                    {item.oude_waarde && item.nieuwe_waarde && <span> → </span>}
                    {item.nieuwe_waarde && <span>wordt: {item.nieuwe_waarde}</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {items.length === 0 && (
        <div style={{ ...S.summary, background: "#1a3a1a", border: "1px solid #3a7a4a", color: "#8dff8d" }}>
          Geen verschillen gevonden — het model is identiek aan de referentie.
        </div>
      )}

      {/* Migratie SQL */}
      {diffResult.migratie_sql && (
        <>
          <button style={S.migratieToggle} onClick={() => setShowMigratie(!showMigratie)}>
            {showMigratie ? "▼" : "▶"} Migratie-SQL ({diffResult.heeft_migratie ? "beschikbaar" : "niet nodig"})
          </button>
          {showMigratie && (
            <div style={S.migratieBlock}>{diffResult.migratie_sql}</div>
          )}
        </>
      )}
    </div>
  );
}

function BadgeFilter({ label, ernst, active, onClick, count }) {
  if (count === 0) return null;
  const kleur = ERNST_KLEUREN[ernst];
  const isActive = active === ernst;
  return (
    <button
      onClick={() => onClick(isActive ? null : ernst)}
      style={{
        ...S.countBadge(kleur),
        cursor: "pointer",
        opacity: active && !isActive ? 0.4 : 1,
        outline: isActive ? `2px solid ${kleur.color}` : "none",
      }}
    >
      {kleur.icon} {label}
    </button>
  );
}
