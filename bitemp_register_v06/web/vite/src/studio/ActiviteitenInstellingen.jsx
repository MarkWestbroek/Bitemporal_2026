/**
 * ActiviteitenInstellingen — instellingen-sectie "Activiteiten" (consolidatie-
 * plan fase 1, "configureerbare complexiteit"): per gebruiker bepalen wat de
 * activity bar toont. Alles blijft altijd bereikbaar via menu Ga naar en het
 * opdrachtenpalet (Ctrl+K) — deze instellingen dunnen alleen de balk uit.
 *
 *  - ★ favoriet: gepind bovenin de balk (pinvolgorde), wint van Labs-uit.
 *  - ☑ in balk: door de gebruiker aan/uit; concepten en descriptor-verborgen
 *    activiteiten (verborgenInBalk) kunnen niet aan — die zijn per definitie
 *    alleen via Ga naar bereikbaar.
 *  - Labs: uit → preview-activiteiten (in aanbouw) verdwijnen uit de balk.
 *
 * Persist in useStudioStore (localStorage), per browser/gebruiker.
 */
import React, { useSyncExternalStore } from "react";
import useStudioStore from "./useStudioStore";
import {
  getActiviteiten,
  abonneerOpActiviteiten,
  activiteitenVersie,
  groepLabel,
} from "./activityRegistry";

// N.B. flexDirection en button-maten expliciet: elders in de bundel leeft een
// globale `label { flex-direction: column }` + button-padding (schema-viz.css)
// die hier anders doorheen lekt.
const rijStijl = {
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  gap: 10,
  padding: "4px 6px",
  borderRadius: 6,
  fontSize: 13,
};

const sterStijl = {
  width: 26,
  height: 24,
  padding: 0,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "transparent",
  border: "none",
  borderRadius: 6,
  fontSize: 15,
  lineHeight: 1,
  cursor: "pointer",
};

function StatusChip({ status }) {
  if (!status) return null;
  return (
    <span
      style={{
        fontSize: 9,
        textTransform: "uppercase",
        letterSpacing: ".04em",
        color: "#f59e0b",
        border: "1px solid #f59e0b55",
        borderRadius: 4,
        padding: "0 4px",
      }}
    >
      {status}
    </span>
  );
}

export default function ActiviteitenInstellingen() {
  useSyncExternalStore(abonneerOpActiviteiten, activiteitenVersie);
  const activiteiten = getActiviteiten();
  const balkVerborgen = useStudioStore((s) => s.balkVerborgen);
  const labsAan = useStudioStore((s) => s.labsAan);
  const favorieten = useStudioStore((s) => s.favorieten);
  const toggleBalkZichtbaar = useStudioStore((s) => s.toggleBalkZichtbaar);
  const toggleLabs = useStudioStore((s) => s.toggleLabs);
  const toggleFavoriet = useStudioStore((s) => s.toggleFavoriet);

  // Groepeer op descriptor.groep met behoud van registervolgorde.
  const groepen = [];
  for (const a of activiteiten) {
    const laatste = groepen[groepen.length - 1];
    if (laatste && laatste.groep === a.groep) laatste.items.push(a);
    else groepen.push({ groep: a.groep, items: [a] });
  }

  return (
    <div>
      <label style={{ ...rijStijl, cursor: "pointer", fontWeight: 600 }}>
        <input type="checkbox" style={{ margin: 0 }} checked={labsAan} onChange={toggleLabs} />
        Labs — toon activiteiten in aanbouw (preview) in de balk
      </label>
      <p style={{ margin: "2px 0 10px 30px", fontSize: 12, color: "var(--s-fg-muted, #64748b)" }}>
        Alles blijft bereikbaar via menu <strong>Ga naar</strong> en het opdrachtenpalet
        (<kbd>Ctrl</kbd>+<kbd>K</kbd>); deze instellingen bepalen alleen wat de iconenbalk toont.
        ★ pint een favoriet bovenin de balk.
      </p>

      {groepen.map((g) => (
        <div key={g.groep || "overig"} style={{ marginBottom: 8 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: ".06em",
              color: "var(--s-fg-muted, #64748b)",
              padding: "4px 6px 2px",
            }}
          >
            {groepLabel(g.groep)}
          </div>
          {g.items.map((a) => {
            const nietInstelbaar = a.status === "concept" || a.verborgenInBalk;
            const favoriet = favorieten.includes(a.id);
            const zichtbaarUit = !!balkVerborgen[a.id];
            return (
              <div key={a.id} style={rijStijl}>
                <button
                  type="button"
                  disabled={nietInstelbaar}
                  onClick={() => toggleFavoriet(a.id)}
                  title={
                    nietInstelbaar
                      ? "Alleen via Ga naar bereikbaar"
                      : favoriet
                        ? "Favoriet losmaken"
                        : "Pin bovenin de balk"
                  }
                  style={{
                    ...sterStijl,
                    color: favoriet ? "#f59e0b" : "var(--s-fg-muted, #64748b)",
                    opacity: nietInstelbaar ? 0.35 : 1,
                    cursor: nietInstelbaar ? "default" : "pointer",
                  }}
                >
                  {favoriet ? "★" : "☆"}
                </button>
                <label
                  style={{
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    cursor: nietInstelbaar ? "default" : "pointer",
                    opacity: nietInstelbaar || (zichtbaarUit && !favoriet) ? 0.55 : 1,
                  }}
                  title={nietInstelbaar ? "Alleen via menu Ga naar bereikbaar" : "Tonen in de activity bar"}
                >
                  <input
                    type="checkbox"
                    style={{ margin: 0 }}
                    disabled={nietInstelbaar}
                    checked={!nietInstelbaar && !zichtbaarUit}
                    onChange={() => toggleBalkZichtbaar(a.id)}
                  />
                  <span style={{ display: "inline-flex", width: 18, justifyContent: "center" }}>{a.icon}</span>
                  {a.label}
                </label>
                <StatusChip status={a.status} />
                {nietInstelbaar && (
                  <span style={{ fontSize: 11, color: "var(--s-fg-muted, #64748b)" }}>
                    alleen via Ga naar
                  </span>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
