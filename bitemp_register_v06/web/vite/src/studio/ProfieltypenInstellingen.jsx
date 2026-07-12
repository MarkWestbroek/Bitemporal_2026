/**
 * ProfieltypenInstellingen — instellingen-sectie "Profieltypen": de visuele
 * identiteit van elk modelleerprofiel, bewerkbaar. Kleur en embleem zijn
 * *defaults in code* (descriptor / icons.jsx); wat je hier zet is een
 * gebruikers-override in localStorage (zie profieltypeRegistry:
 * zetStijlOverride / effectieveStijl) en werkt meteen door in de
 * projectbrowser en de diagram-tabs van Modelleren.
 */
import React, { useSyncExternalStore } from "react";
import {
  getProfieltypen,
  abonneerOpProfieltypen,
  profieltypenVersie,
  getStijlOverrides,
  zetStijlOverride,
  effectieveStijl,
} from "./profieltypeRegistry";
import ProfielIcoon from "./ProfielIcoon.jsx";

const rij = {
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  gap: 10,
  padding: "4px 6px",
  fontSize: 13,
};

const NEUTRAAL = "#94a3b8";

export default function ProfieltypenInstellingen() {
  useSyncExternalStore(abonneerOpProfieltypen, profieltypenVersie);
  const profielen = getProfieltypen();
  const overrides = getStijlOverrides();

  return (
    <div>
      <p style={{ margin: "0 0 8px", fontSize: 12, color: "var(--s-fg-muted, #64748b)" }}>
        Kleur en embleem per modelleerprofiel — zichtbaar in de projectbrowser en op de
        diagram-tabs van <strong>Modelleren</strong>. Leeg embleem = het ingebouwde icoon;
        <em> herstel</em> zet de code-default terug.
      </p>
      {profielen.map((p) => {
        const o = overrides[p.id] || {};
        const stijl = effectieveStijl(p);
        const isOverride = !!(o.kleur || o.embleem);
        return (
          <div key={p.id} style={rij}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 22,
                color: "var(--s-fg)",
              }}
            >
              <ProfielIcoon profiel={p} />
            </span>
            <span style={{ flex: "0 0 140px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {p.label}
            </span>
            <input
              type="color"
              value={stijl.kleur || NEUTRAAL}
              title="Accentkleur"
              onChange={(e) => zetStijlOverride(p.id, { kleur: e.target.value, embleem: o.embleem })}
              style={{ width: 34, height: 24, padding: 0, border: "1px solid var(--s-border, #cbd5e1)", borderRadius: 5, background: "transparent", cursor: "pointer" }}
            />
            <input
              type="text"
              value={o.embleem || ""}
              placeholder="embleem"
              maxLength={3}
              title="1–3 tekens; vervangt het icoon (leeg = ingebouwd icoon)"
              onChange={(e) => zetStijlOverride(p.id, { kleur: o.kleur, embleem: e.target.value })}
              style={{
                width: 72,
                font: "inherit",
                fontSize: 12,
                padding: "3px 6px",
                border: "1px solid var(--s-border, #cbd5e1)",
                borderRadius: 5,
                background: "transparent",
                color: "var(--s-fg)",
              }}
            />
            {isOverride && (
              <button
                type="button"
                onClick={() => zetStijlOverride(p.id, {})}
                title="Terug naar de code-default"
                style={{
                  font: "inherit",
                  fontSize: 12,
                  padding: "2px 8px",
                  border: "1px solid var(--s-border, #cbd5e1)",
                  borderRadius: 5,
                  background: "transparent",
                  color: "var(--s-fg-muted, #64748b)",
                  cursor: "pointer",
                }}
              >
                herstel
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
