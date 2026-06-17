/**
 * ActivityBar — verticale iconenbalk links (VS Code-stijl).
 *
 * Leest uitsluitend uit het activityRegistry, dus volledig uitbreidbaar: een nieuwe
 * functie verschijnt automatisch zodra ze geregistreerd is. Optioneel gegroepeerd
 * via descriptor.groep (met een scheidingslijn tussen groepen).
 */
import React from "react";
import useStudioStore from "./useStudioStore";

export default function ActivityBar({ activiteiten }) {
  const activeId = useStudioStore((s) => s.activeId);
  const setActief = useStudioStore((s) => s.setActief);

  // Groepeer met behoud van volgorde.
  const rijen = [];
  let vorigeGroep;
  for (const a of activiteiten) {
    if (vorigeGroep !== undefined && a.groep !== vorigeGroep) {
      rijen.push({ scheiding: true, key: `sep-${a.id}` });
    }
    rijen.push({ activiteit: a, key: a.id });
    vorigeGroep = a.groep;
  }

  return (
    <nav className="studio-activitybar" aria-label="Hoofdfuncties">
      {rijen.map((r) =>
        r.scheiding ? (
          <div key={r.key} className="studio-activitybar__sep" />
        ) : (
          <button
            key={r.key}
            type="button"
            className={
              "studio-activitybar__btn" +
              (r.activiteit.id === activeId ? " is-actief" : "")
            }
            title={r.activiteit.label + (r.activiteit.status ? ` (${r.activiteit.status})` : "")}
            aria-pressed={r.activiteit.id === activeId}
            onClick={() => setActief(r.activiteit.id)}
          >
            <span className="studio-activitybar__icon">{r.activiteit.icon}</span>
            {r.activiteit.status === "concept" && (
              <span className="studio-activitybar__badge" aria-hidden>•</span>
            )}
          </button>
        )
      )}
    </nav>
  );
}
