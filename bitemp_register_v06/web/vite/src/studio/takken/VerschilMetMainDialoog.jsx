/**
 * VerschilMetMainDialoog — "Verschil met MAIN…" van een branch (afgeleid project; 09-11, branch
 * stap 1, werkplaats-plan §4B). Toont per status (conflict, nieuw, gewijzigd, weg, alleen op MAIN)
 * de elementen, diagrammen, mappen en koppelingen die verschillen, met de velden en of ze buiten de
 * afgesplitste map liggen.
 *
 * Samenvoegen naar MAIN (14-11, plan "Branch terugmergen"). Stap 2: kiezen in een boom
 * (keuzeBoom.js): map → submap → diagram of element → relatie, met per regel een schuifje met drie
 * standen: ↶ MAIN overnemen in de branch, – niets doen (blijft in de branch en komt bij de volgende
 * vergelijking terug), → naar MAIN (bij een conflict: MAIN overschrijven). Daarna haalt de branch
 * MAIN op (POST …/samenvoegen met `keuze`). Een keuze die een verwijzing stuk maakt (relatie zonder
 * haar bron, …) weigert de server met reden "samenhang".
 *
 * De API doet het werk (GET …/vergelijk → render-sidecar POST /vergelijk, verschilMetMain.js).
 * Een diagram opent met een klik; een element opent het eerste diagram waarop het staat.
 *
 * Eén instantie hangt in de Main van Modelleren; openen via
 *   useVerschilMetMainStore.getState().openen({ projectId, regel, teVerzenden })
 */
import React, { useEffect, useMemo, useState } from "react";
import { create } from "zustand";
import { vergelijkMetMain, samenvoegenMetMain } from "../activities/projectSync.js";
import { useSyncStore } from "../sync/verzender.js";
import { getProfieltype } from "../profieltypeRegistry";
import { openVerwijzing } from "../doorklik.js";
import { STATUS_LABEL, STATUS_UITLEG, SOORT_LABEL } from "./herkomst.js";
import { standaardKeuze, bouwKeuzeBoom, standVan, zetKnoop, keuzeTelling, schuifTeksten } from "./keuzeBoom.js";

/** Heeft de branch een afgesplitste map? (anders telt "buiten de map" niet) */
const heeftMapVan = (uitkomst) => (uitkomst?.scope || []).length > 0;

export const useVerschilMetMainStore = create((set, get) => ({
  open: false,
  laden: false,
  fout: null,
  uitkomst: null,
  projectId: null,
  regel: "",
  teVerzenden: 0,
  /** Keuze per eenheid (sleutel → aan/uit), na elke vergelijking opnieuw de standaard. */
  keuze: {},
  zetKeuze: (keuze) => set({ keuze }),
  /** Samenvoegen naar MAIN: bezig, en de uitkomst (melding) van de laatste poging. */
  samenvoegBezig: false,
  samenvoegMelding: null,
  openen: ({ projectId, regel = "", teVerzenden = 0 }) => {
    set({ open: true, projectId, regel, teVerzenden, uitkomst: null, fout: null, samenvoegMelding: null });
    get().ververs();
  },
  sluiten: () => set({ open: false }),
  ververs: async () => {
    const { projectId } = get();
    set({ laden: true, fout: null });
    try {
      const uitkomst = await vergelijkMetMain(projectId);
      set({ uitkomst, laden: false, keuze: standaardKeuze(uitkomst?.verschillen || [], { heeftMap: heeftMapVan(uitkomst) }) });
    } catch (e) {
      const fout =
        e?.status === 404
          ? "Dit project is geen branch, of de server kent \"verschil met MAIN\" nog niet."
          : e?.status === 502
            ? "De render-sidecar is niet bereikbaar, of te oud (zonder /vergelijk)."
            : e?.message || String(e);
      set({ fout, laden: false, uitkomst: null });
    }
  },
  /**
   * Het gekozene naar MAIN; daarna haalt de branch MAIN op. `ookBuitenMap` = de gebruiker heeft
   * bevestigd dat gekozen wijzigingen buiten de map mee mogen.
   */
  samenvoegen: async ({ ookBuitenMap = false } = {}) => {
    const { projectId, keuze } = get();
    set({ samenvoegBezig: true, samenvoegMelding: null });
    try {
      const r = await samenvoegenMetMain(projectId, { ookBuitenMap, keuze });
      const naarMain = r?.main?.ops?.aantal || 0, naarTak = r?.tak?.ops?.aantal || 0;
      set({
        samenvoegBezig: false,
        samenvoegMelding: {
          soort: "ok",
          tekst: naarMain || naarTak
            ? `Samengevoegd: ${naarMain} wijziging(en) naar MAIN, ${naarTak} naar deze branch. Wat je niet koos, staat hieronder nog open.`
            : "Er was niets samen te voegen.",
        },
      });
    } catch (e) {
      const tekst =
        e?.reden === "conflicten"
          ? `Niet samengevoegd: ${e.conflicten.length} conflict(en). Los die eerst op in de branch (of op MAIN).`
          : e?.reden === "samenhang"
            ? `Niet samengevoegd: deze keuze laat ${e.samenhang.length} verwijzing(en) naar iets wat er niet is achter. Kies wat erbij hoort mee, of laat het samen weg. ${e.samenhang.slice(0, 3).map((s) => `(${s.kant === "main" ? "MAIN" : "branch"}) ${s.fout}`).join("; ")}`
          : e?.reden === "buiten_map"
            ? "Niet samengevoegd: de branch wijzigt ook iets buiten zijn map."
            : e?.reden === "volgnummer_verschoven"
              ? "Niet samengevoegd: er is intussen verder gewerkt. Bekijk het verschil opnieuw en probeer het nog eens."
              : e?.status === 502
                ? "Niet samengevoegd: de render-sidecar is niet bereikbaar, of te oud (zonder /samenvoegen)."
                : e?.status === 404
                  ? "Niet samengevoegd: de server kent samenvoegen nog niet, of dit project is geen branch."
                  : `Niet samengevoegd: ${e?.message || e}`;
      set({ samenvoegBezig: false, samenvoegMelding: { soort: "fout", tekst } });
    }
    await get().ververs();
  },
}));

const STATUSSEN = ["conflict", "nieuw", "gewijzigd", "weg", "main"];
const KLEUR = { conflict: "#dc2626", nieuw: "#16a34a", gewijzigd: "#2563eb", weg: "#9333ea", main: "#64748b" };

/** Profielnaam voor de lijst (val terug op het id). */
const profielNaam = (pid) => (pid ? getProfieltype(pid)?.label || getProfieltype(pid)?.naam || pid : "");

/**
 * Naam van de soort in de boom: bij een element het type uit het profiel (M2: "entiteit",
 * "gegevenselement", "domein", in een andere taal de eigen namen; Mark 14-11), anders de soort.
 */
function soortLabel(knoop) {
  const v = knoop.verschil;
  const typeVan = (profielId, elementType) => {
    if (!elementType) return null;
    const types = getProfieltype(profielId)?.descriptor?.elementTypes || [];
    return types.find((t) => t.id === elementType)?.label || elementType;
  };
  if (knoop.soort === "eenheid") return (v.soort === "element" && typeVan(v.profielId, v.elementType)) || SOORT_LABEL[v.soort] || v.soort;
  if (knoop.context) return typeVan(knoop.context.profielId, knoop.context.elementType) || "element";
  return knoop.soort === "map" ? "map" : "";
}

/** Open het diagram, of bij een element het eerste diagram waarop het in deze branch staat. */
function openRegel(v) {
  if (!v.profielId) return false;
  if (v.soort === "diagram") return openVerwijzing({ profielId: v.profielId, diagramId: v.id });
  if (v.soort !== "element") return false;
  const st = getProfieltype(v.profielId)?.useStore?.getState?.();
  const d = Object.values(st?.diagrams || {}).find((dg) => (dg.nodes || []).some((n) => n.elementId === v.id) || (dg.edges || []).some((e) => e.id === v.id || e.elementId === v.id));
  return d ? openVerwijzing({ profielId: v.profielId, diagramId: d.id }) : false;
}

const knop = { font: "inherit", fontSize: 12, padding: "3px 10px", border: "1px solid var(--s-border, #cbd5e1)", borderRadius: 6, background: "transparent", color: "var(--s-fg)", cursor: "pointer" };

/** Kleur van de actieve stand: links = MAIN (paars), midden = neutraal, rechts = naar MAIN (groen; rood bij overschrijven). */
const STAND_KLEUR = { links: "#9333ea", midden: "#64748b", rechts: "#16a34a" };

/**
 * Schuifje met drie standen (Mark 14-11): ↶ links = MAIN overnemen in de branch, – midden = niets
 * doen, → rechts = naar MAIN. "gemengd" (op een ouder): geen stand actief.
 */
function Schuif({ stand, teksten, onKies, testId }) {
  const deel = (s, teken) => {
    const actief = stand === s;
    const kleur = s === "rechts" && teksten.rechtsWaarschuwing ? "#dc2626" : STAND_KLEUR[s];
    return (
      <button
        type="button"
        onClick={() => onKies(s)}
        aria-pressed={actief}
        data-testid={`${testId}-${s}`}
        title={teksten[s]}
        style={{
          font: "inherit", fontSize: 11, lineHeight: "16px", width: 24, padding: 0, cursor: "pointer",
          border: "1px solid var(--s-border, #cbd5e1)", borderLeftWidth: s === "links" ? 1 : 0,
          borderRadius: s === "links" ? "8px 0 0 8px" : s === "rechts" ? "0 8px 8px 0" : 0,
          background: actief ? kleur : "transparent", color: actief ? "#fff" : "var(--s-fg)", opacity: actief ? 1 : 0.7,
        }}
      >
        {teken}
      </button>
    );
  };
  return (
    <span role="group" aria-label="Keuze" data-testid={testId} data-stand={stand} style={{ display: "inline-flex", flex: "none" }}>
      {deel("links", "↶")}
      {deel("midden", "–")}
      {deel("rechts", "→")}
    </span>
  );
}

/** Eén knoop van de keuzeboom, met zijn kinderen. */
function KnoopRij({ knoop, diepte, keuze, zetKeuze, heeftMap, dicht, wisselDicht, sluiten }) {
  const v = knoop.verschil;
  // Een map met een eigen wijziging maar ook kinderen: het schuifje werkt op alles; de teksten zijn algemeen.
  const eigen = knoop.soort === "eenheid" ? v : null;
  const stand = standVan(knoop, keuze);
  const teksten = schuifTeksten(eigen);
  const isDicht = dicht.has(knoop.knoopId);
  const heeftKinderen = knoop.kinderen.length > 0;
  const keuzeTekst = stand === "gemengd" ? "gemengd" : teksten[stand];
  const keuzeKleur = stand === "gemengd" ? "inherit" : stand === "rechts" && teksten.rechtsWaarschuwing ? "#dc2626" : STAND_KLEUR[stand];
  return (
    <>
      <div
        data-knoop={knoop.knoopId}
        data-verschil-id={v?.id}
        style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 4px", paddingLeft: 4 + diepte * 18, borderTop: "1px solid var(--s-border, #e2e8f0)", fontSize: 12 }}
      >
        <button
          type="button"
          onClick={() => heeftKinderen && wisselDicht(knoop.knoopId)}
          aria-label={isDicht ? "Openklappen" : "Dichtklappen"}
          style={{ ...knop, border: 0, padding: 0, width: 14, visibility: heeftKinderen ? "visible" : "hidden" }}
        >
          {isDicht ? "▸" : "▾"}
        </button>
        <Schuif stand={stand} teksten={teksten} onKies={(s) => zetKeuze(zetKnoop(knoop, keuze, s))} testId={`schuif-${knoop.knoopId}`} />
        {v && <span title={STATUS_UITLEG[v.status]} style={{ display: "inline-block", width: 8, height: 8, borderRadius: 4, background: KLEUR[v.status], flex: "none" }} />}
        <span style={{ opacity: 0.6, width: 110, flex: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={soortLabel(knoop)} data-testid={`soort-${knoop.knoopId}`}>{soortLabel(knoop)}</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          {knoop.soort === "eenheid" && (v.soort === "element" || v.soort === "diagram") ? (
            <button type="button" onClick={() => openRegel(v) && sluiten()} title="Openen" style={{ ...knop, border: 0, padding: 0, textDecoration: "underline" }}>
              {knoop.label}
            </button>
          ) : (
            <strong style={{ fontWeight: knoop.soort === "eenheid" ? 400 : 600 }}>{knoop.label}</strong>
          )}
          {v && <span style={{ marginLeft: 6, color: KLEUR[v.status] }}>{STATUS_LABEL[v.status].toLowerCase()}</span>}
          <span style={{ marginLeft: 6, fontSize: 10, color: keuzeKleur }} data-testid={`keuze-tekst-${knoop.knoopId}`}>→ {keuzeTekst}</span>
          {v && heeftMap && !v.inScope && (
            <span style={{ marginLeft: 6, fontSize: 10, color: "var(--s-warn, #b45309)" }} title="Ligt niet in de afgesplitste map">buiten de map</span>
          )}
        </span>
        {v && <span style={{ opacity: 0.6, flex: "none" }}>{profielNaam(v.profielId)}</span>}
        {v && <span style={{ opacity: 0.8, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: "none" }} title={(v.velden || []).join(", ")}>{(v.velden || []).join(", ")}</span>}
      </div>
      {!isDicht && knoop.kinderen.map((k) => (
        <KnoopRij key={k.knoopId} knoop={k} diepte={diepte + 1} keuze={keuze} zetKeuze={zetKeuze} heeftMap={heeftMap} dicht={dicht} wisselDicht={wisselDicht} sluiten={sluiten} />
      ))}
    </>
  );
}

export default function VerschilMetMainDialoog() {
  const { open, laden, fout, uitkomst, regel, sluiten, ververs, samenvoegen, samenvoegBezig, samenvoegMelding, keuze, zetKeuze } = useVerschilMetMainStore();
  // Live (niet de stand bij het openen): na verzenden mag samenvoegen alsnog.
  const teVerzenden = useSyncStore((s) => s.teVerzenden || 0);
  const [dicht, setDicht] = useState(() => new Set());
  const wisselDicht = (id) => setDicht((d) => {
    const n = new Set(d);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && sluiten();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, sluiten]);

  const verschillen = uitkomst?.verschillen || [];
  const boom = useMemo(() => bouwKeuzeBoom(uitkomst?.verschillen || [], uitkomst?.mappen || {}, uitkomst?.context || {}), [uitkomst]);
  const vanMain = useMemo(() => (uitkomst?.verschillen || []).filter((v) => v.status === "main"), [uitkomst]);

  if (!open) return null;
  const t = uitkomst?.telling || {};
  const heeftMap = heeftMapVan(uitkomst);
  const k = keuzeTelling(verschillen, keuze, { heeftMap });
  const iets = k.gekozen + k.terug + k.vanMain > 0;
  const kanSamenvoegen = !!uitkomst && !laden && !samenvoegBezig && teVerzenden === 0 && iets;
  const waaromNiet = !uitkomst || laden ? "" : teVerzenden > 0 ? "Eerst je eigen wijzigingen verzenden." : !iets ? "Er is niets gekozen en niets op te halen." : "";
  const vraagSamenvoegen = () => {
    const regels = [
      k.gekozen || !k.terug ? `${k.gekozen} gekozen wijziging(en) gaan naar MAIN.` : null,
      k.terug ? `${k.terug} wijziging(en) in deze branch worden teruggezet naar de versie van MAIN.` : null,
      k.conflictTak ? `Bij ${k.conflictTak} conflict(en) wint de versie van deze branch.` : null,
      k.conflictMain ? `Bij ${k.conflictMain} conflict(en) houdt MAIN de zijne.` : null,
      k.nietGekozen ? `${k.nietGekozen} niet gekozen wijziging(en) blijven alleen in deze branch.` : null,
      k.vanMain ? `${k.vanMain} wijziging(en) die alleen op MAIN zijn gedaan, komen daarna in deze branch.` : null,
      k.buitenGekozen ? `Let op: ${k.buitenGekozen} gekozen wijziging(en) liggen buiten de afgesplitste map.` : null,
      "Doorgaan?",
    ].filter(Boolean);
    if (window.confirm(regels.join("\n\n"))) samenvoegen({ ookBuitenMap: k.buitenGekozen > 0 });
  };
  const alles = (aan) => zetKeuze(Object.fromEntries(Object.keys(keuze).map((s) => [s, aan])));

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 260, background: "rgba(0,0,0,0.35)", display: "flex", justifyContent: "center", alignItems: "flex-start", paddingTop: "8vh" }}
      onMouseDown={(e) => e.target === e.currentTarget && sluiten()}
    >
      <div
        role="dialog"
        aria-label="Verschil met MAIN"
        data-testid="verschil-met-main"
        style={{ width: "min(860px, 94vw)", maxHeight: "82vh", overflow: "auto", background: "var(--s-panel)", color: "var(--s-fg)", border: "1px solid var(--s-border)", borderRadius: 10, boxShadow: "0 16px 48px rgba(0,0,0,0.4)", padding: 16 }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>Verschil met MAIN</h2>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              type="button"
              onClick={vraagSamenvoegen}
              disabled={!kanSamenvoegen}
              title={waaromNiet || "Het gekozene naar MAIN; daarna haalt de branch MAIN op."}
              data-testid="samenvoegen-naar-main"
              style={{ ...knop, opacity: kanSamenvoegen ? 1 : 0.5, cursor: kanSamenvoegen ? "pointer" : "default" }}
            >
              {samenvoegBezig ? "Samenvoegen…" : `Samenvoegen naar MAIN${uitkomst ? ` (${k.gekozen}${k.terug ? `, ${k.terug} terug` : ""})` : ""}`}
            </button>
            <button type="button" onClick={ververs} style={knop} disabled={laden}>Ververs</button>
            <button type="button" onClick={sluiten} style={{ ...knop, padding: "2px 8px" }} aria-label="Sluiten">×</button>
          </div>
        </div>
        {regel && <p style={{ margin: "0 0 6px", fontSize: 12, opacity: 0.8 }}>{regel}</p>}
        <p style={{ margin: "0 0 10px", fontSize: 12, opacity: 0.8 }}>
          Vergeleken met de stand bij het afsplitsen of de laatste samenvoeging. Per regel: <strong>↶</strong> MAIN
          overnemen in deze branch, <strong>–</strong> niets doen (blijft in de branch), <strong>→</strong> naar MAIN (bij
          een conflict: MAIN overschrijven). Op een map geldt het schuifje voor alles eronder.
          {uitkomst?.main?.laatsteVolgnummer != null && <> MAIN staat op #{uitkomst.main.laatsteVolgnummer}.</>}
        </p>
        {teVerzenden > 0 && (
          <div style={{ fontSize: 12, marginBottom: 8, color: "var(--s-warn, #b45309)" }}>
            Nog {teVerzenden} wijziging(en) van jou niet op de server; die tellen pas mee na verzenden.
          </div>
        )}
        {samenvoegMelding && (
          <div
            data-testid="samenvoeg-melding"
            style={{ fontSize: 13, marginBottom: 8, color: samenvoegMelding.soort === "ok" ? "var(--s-ok, #16a34a)" : "var(--s-danger, #dc2626)" }}
          >
            {samenvoegMelding.tekst}
          </div>
        )}
        {fout && <div style={{ color: "var(--s-danger, #dc2626)", fontSize: 13, marginBottom: 8 }}>{fout}</div>}
        {laden && <div style={{ fontSize: 13, opacity: 0.7 }}>Vergelijken…</div>}
        {uitkomst && !laden && (
          <>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", fontSize: 12, marginBottom: 8 }}>
              {STATUSSEN.map((s) => (
                <span key={s} title={STATUS_UITLEG[s]} data-status={s}>
                  <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 4, background: KLEUR[s], marginRight: 4 }} />
                  {STATUS_LABEL[s]}: <strong>{t[s] || 0}</strong>
                </span>
              ))}
              <span style={{ flex: 1 }} />
              {boom.length > 0 && (
                <>
                  <button type="button" style={knop} onClick={() => alles(true)} data-testid="keuze-alles-aan">Alles naar MAIN</button>
                  <button type="button" style={knop} onClick={() => alles(false)} data-testid="keuze-alles-uit">Alles in de branch</button>
                </>
              )}
            </div>
            {k.buitenGekozen > 0 && (
              <div style={{ fontSize: 12, marginBottom: 8, color: "var(--s-warn, #b45309)" }}>
                {k.buitenGekozen} gekozen wijziging(en) liggen buiten de afgesplitste map. Dat mag nu nog; bij samenvoegen
                vraagt de Studio of die mee mogen.
              </div>
            )}
            {(uitkomst.meldingen || []).length > 0 && (
              <details style={{ fontSize: 12, marginBottom: 8 }}>
                <summary>{uitkomst.meldingen.length} melding(en) bij het naspelen</summary>
                <ul style={{ margin: "4px 0 0 16px" }}>{uitkomst.meldingen.map((m, i) => <li key={i}>{m.kant}: {m.bericht}</li>)}</ul>
              </details>
            )}
            {boom.length === 0 && vanMain.length === 0 && <div style={{ fontSize: 13, opacity: 0.7 }}>Geen verschil.</div>}
            {boom.length > 0 && (
              <div data-testid="keuze-boom" style={{ borderBottom: "1px solid var(--s-border, #e2e8f0)", marginBottom: 10 }}>
                {boom.map((knoop) => (
                  <KnoopRij key={knoop.knoopId} knoop={knoop} diepte={0} keuze={keuze} zetKeuze={zetKeuze} heeftMap={heeftMap} dicht={dicht} wisselDicht={wisselDicht} sluiten={sluiten} />
                ))}
              </div>
            )}
            {vanMain.length > 0 && (
              <details style={{ fontSize: 12 }} data-testid="van-main">
                <summary title={STATUS_UITLEG.main}>{STATUS_LABEL.main} ({vanMain.length}): komt bij samenvoegen in deze branch</summary>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginTop: 4 }}>
                  <tbody>
                    {vanMain.map((v) => (
                      <tr key={v.sleutel} style={{ borderTop: "1px solid var(--s-border, #e2e8f0)" }} data-verschil-id={v.id}>
                        <td style={{ padding: "4px 6px", width: 80, opacity: 0.7 }}>{SOORT_LABEL[v.soort] || v.soort}</td>
                        <td style={{ padding: "4px 6px" }}><strong>{v.naam || v.id}</strong></td>
                        <td style={{ padding: "4px 6px", opacity: 0.7 }}>{profielNaam(v.profielId)}</td>
                        <td style={{ padding: "4px 6px", opacity: 0.8 }}>{(v.velden || []).join(", ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            )}
          </>
        )}
      </div>
    </div>
  );
}
