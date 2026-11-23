/**
 * VersieGraafDialoog — *Project → Versiegraaf…* (plan "Sidecar-project" §10, stap 10): per soort
 * de uitgebrachte versies als graaf. Kolom = volgorde van uitbrengen, rij = lijn (bovenaan de
 * hoofdlijn, daaronder de onderhoudslijnen); een lijn per ouder, gestippeld bij een merge (de
 * tweede ouder). Per versie: wat deze Studio vastpint en op hoeveel klantaanpassingen ze de basis
 * is. Per oudere lijn een knop *Onderhoudslijn starten*.
 *
 * De indeling is puur (`../versieGraaf.js`); openen gaat via de store:
 *   useVersieGraafStore.getState().openen({versies, pins, aanpassingen, startOnderhoud})
 */
import React from "react";
import { create } from "zustand";
import { graafIndeling, onderhoudStartpunten } from "../versieGraaf.js";

export const useVersieGraafStore = create((set) => ({
  open: false,
  versies: [],
  pins: {},
  aanpassingen: [],
  startOnderhoud: null,
  openen: ({ versies = [], pins = {}, aanpassingen = [], startOnderhoud = null }) => set({ open: true, versies, pins, aanpassingen, startOnderhoud }),
  sluiten: () => set({ open: false, startOnderhoud: null }),
}));

const KOLOM = 96;
const RIJ = 64;
const MARGE = { links: 90, boven: 28 };

function Graaf({ soort, versies, pin, aanpassingen }) {
  const { knopen, lijnen, rijen } = graafIndeling(versies);
  const plek = new Map(knopen.map((k) => [k.versie, { x: MARGE.links + k.kolom * KOLOM, y: MARGE.boven + k.rij * RIJ }]));
  const breedte = MARGE.links + Math.max(1, knopen.length) * KOLOM + 20;
  const hoogte = MARGE.boven + rijen.length * RIJ + 10;
  const klanten = (versie) => aanpassingen.filter((a) => a.soort === soort && a.basisVersie === versie).length;
  return (
    <svg width={breedte} height={hoogte} role="img" aria-label={`Versiegraaf ${soort}`} data-testid={`versiegraaf-${soort}`} style={{ display: "block", overflow: "visible" }}>
      {rijen.map((r, i) => (
        <text key={r} x={8} y={MARGE.boven + i * RIJ + 4} fontSize={11} fill="var(--s-fg-muted, #64748b)">
          {r === "hoofd" ? "hoofdlijn" : `${r}.x`}
        </text>
      ))}
      {lijnen.map((l) => {
        const a = plek.get(l.van);
        const b = plek.get(l.naar);
        if (!a || !b) return null;
        return (
          <path
            key={`${l.van}>${l.naar}`}
            d={`M ${a.x} ${a.y} C ${(a.x + b.x) / 2} ${a.y}, ${(a.x + b.x) / 2} ${b.y}, ${b.x} ${b.y}`}
            fill="none"
            stroke="var(--s-fg-muted, #94a3b8)"
            strokeWidth={1.5}
            strokeDasharray={l.merge ? "4 3" : undefined}
            data-lijn={`${l.van}>${l.naar}`}
          />
        );
      })}
      {knopen.map((k) => {
        const p = plek.get(k.versie);
        const n = klanten(k.versie);
        const isPin = pin === k.versie;
        return (
          <g key={k.versie} data-versie={k.versie} data-lijn={k.lijn}>
            <title>{[`${soort} ${k.versie}`, k.u.uitgebracht ? String(k.u.uitgebracht).slice(0, 10) : "", k.u.uitgebrachtDoor || "", k.u.notitie || ""].filter(Boolean).join(" · ")}</title>
            <circle cx={p.x} cy={p.y} r={7} fill={k.lijn === "hoofd" ? "#6366f1" : "#22d3ee"} stroke={isPin ? "#f59e0b" : "var(--s-panel, #fff)"} strokeWidth={isPin ? 3 : 2} />
            <text x={p.x} y={p.y - 12} fontSize={12} textAnchor="middle" fill="var(--s-fg, #0f172a)">
              {k.versie}
            </text>
            {(isPin || n > 0) && (
              <text x={p.x} y={p.y + 22} fontSize={10} textAnchor="middle" fill="var(--s-fg-muted, #64748b)">
                {[isPin ? "vastgepind" : "", n ? `${n} klant${n > 1 ? "en" : ""}` : ""].filter(Boolean).join(" · ")}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export default function VersieGraafDialoog() {
  const { open, versies, pins, aanpassingen, startOnderhoud, sluiten } = useVersieGraafStore();
  if (!open) return null;
  const soorten = [...new Set(versies.map((u) => u.soort))].sort();
  const knop = { font: "inherit", fontSize: 12, padding: "3px 10px", border: "1px solid var(--s-border, #cbd5e1)", borderRadius: 6, background: "transparent", color: "var(--s-fg)", cursor: "pointer" };
  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 260, background: "rgba(0,0,0,0.35)", display: "flex", justifyContent: "center", alignItems: "flex-start", paddingTop: "8vh" }}
      onMouseDown={(e) => e.target === e.currentTarget && sluiten()}
    >
      <div
        role="dialog"
        aria-label="Versiegraaf"
        data-testid="versiegraaf"
        style={{ width: "min(900px, 94vw)", maxHeight: "82vh", overflow: "auto", background: "var(--s-panel)", color: "var(--s-fg)", border: "1px solid var(--s-border)", borderRadius: 10, boxShadow: "0 16px 48px rgba(0,0,0,0.4)", padding: 16 }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>Versiegraaf</h2>
          <button type="button" onClick={sluiten} style={{ ...knop, padding: "2px 8px" }} aria-label="Sluiten">
            ×
          </button>
        </div>
        <p style={{ margin: "0 0 12px", fontSize: 12, opacity: 0.8 }}>
          Bovenaan de hoofdlijn, daaronder de onderhoudslijnen. Een gestippelde lijn is een merge (de tweede ouder). Oranje omrand: de versie
          waarmee deze Studio start.
        </p>
        {!soorten.length && <div style={{ fontSize: 13, opacity: 0.7 }}>Er is nog geen versie uitgebracht.</div>}
        {soorten.map((soort) => {
          const eigen = versies.filter((u) => u.soort === soort);
          const starten = onderhoudStartpunten(eigen);
          return (
            <section key={soort} style={{ marginBottom: 18 }}>
              <h3 style={{ margin: "0 0 6px", fontSize: 13, textTransform: "capitalize" }}>{soort}</h3>
              <div style={{ overflowX: "auto" }}>
                <Graaf soort={soort} versies={eigen} pin={pins[soort] || null} aanpassingen={aanpassingen} />
              </div>
              {startOnderhoud && starten.length > 0 && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                  {starten.map((s) => (
                    <button
                      key={s.lijn}
                      type="button"
                      style={knop}
                      data-onderhoud={`${soort}@${s.lijn}`}
                      title={`Een project op de server vanaf ${s.vanaf}; de volgende versie wordt ${s.volgende}.`}
                      onClick={() => {
                        const cb = startOnderhoud;
                        sluiten();
                        cb?.(soort, s.vanaf);
                      }}
                    >
                      Onderhoudslijn {s.lijn}.x starten (vanaf {s.vanaf})
                    </button>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
