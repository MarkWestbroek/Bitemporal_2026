/**
 * koppelingenActivity — "Koppelingen": kruisverbanden tussen profieltypen
 * (consolidatieplan fase 4).
 *
 * Een kruisverband is een trace-link tussen twee elementen uit (meestal)
 * verschillende werelden: UML `Taak` ↔ MIM `«Objecttype» Taak`, entiteit ↔
 * proces, schema ↔ canoniek element. Beperkt tot twee profieltypen laat
 * zich dat als **matrix** tonen: kies bron- (rijen) en doelprofiel
 * (kolommen), en leg per cel een trace-relatie met een **soort** en
 * **richting**.
 *
 * Richting-principe (sessiebesluit 2026-07-13): de **kolom is bovenliggend**,
 * de **rij onderliggend**. Default staat een relatie dus rij→kolom
 * (rij realiseert/komt voort uit/heeft te maken met kolom); alleen
 * *genereert* staat default andersom (kolom genereert rij). Per cel is de
 * richting om te draaien.
 *
 * Links persisteren in localStorage en reizen mee in het project-werkbestand.
 * Grafisch (cross-profiel-diagram) en het superprofiel volgen later;
 * klassieke editors (bpmn.io/dmn-js) doen nog niet mee — hun elementen leven
 * buiten de profiel-stores.
 */
import React, { useSyncExternalStore } from "react";
import { create } from "zustand";
import {
  getProfieltypen,
  getProfieltype,
  abonneerOpProfieltypen,
  profieltypenVersie,
  effectieveStijl,
} from "../profieltypeRegistry";
import ProfielIcoon from "../ProfielIcoon.jsx";
import { IconKoppeling } from "../icons";
// Circulaire import (grafisch ↔ activity): veilig omdat het pas bij render
// gebruikt wordt, niet tijdens module-evaluatie.
import KoppelingenGrafisch from "./koppelingenGrafisch.jsx";

// ── Trace-typen: soort + symbool + default-richting ─────────────────
// `stijl` stuurt het symbool (UML-achtig): realisatie = gestippeld + holle
// driehoek, afhankelijkheid = gestippeld + open pijl, generatie = vol +
// gevulde pijl, associatie = doorgetrokken lijn zonder kop.
export const TRACE_TYPEN = [
  { soort: "komt voort uit", stijl: "afhankelijk", defaultOmgekeerd: false },
  { soort: "heeft te maken met", stijl: "associatie", defaultOmgekeerd: false },
  { soort: "genereert", stijl: "generatie", defaultOmgekeerd: true },
  { soort: "realiseert", stijl: "realisatie", defaultOmgekeerd: false },
];
export const TRACE_SOORTEN = TRACE_TYPEN.map((t) => t.soort);
const TRACE_BY_SOORT = Object.fromEntries(TRACE_TYPEN.map((t) => [t.soort, t]));

/**
 * Klein UML-achtig relatiesymbool met een **hoekje** (orthogonale elleboog,
 * zoals een matrix-verbinding rij→kolom loopt: eerst opzij, dan omhoog).
 * De pijlkop zit aan de *naar*-zijde: standaard bovenaan (rij→kolom),
 * omgekeerd links (kolom→rij). Kopstijl per soort: realisatie = holle
 * driehoek, afhankelijk = open pijl, generatie = gevulde pijl, associatie =
 * geen kop.
 */
export function TraceGlyph({ soort, omgekeerd = false, size = 24 }) {
  const t = TRACE_BY_SOORT[soort] || {};
  const w = size;
  const h = Math.round(size * 0.82);
  const sx = w / 24;
  const sy = h / 20;
  const P = (x, y) => `${(x * sx).toFixed(1)} ${(y * sy).toFixed(1)}`;
  const gestippeld = t.stijl === "realisatie" || t.stijl === "afhankelijk";
  // Elleboog: L(3,15) → hoek(15,15) → T(15,4).
  const lijn = `M ${P(3, 15)} L ${P(15, 15)} L ${P(15, 4)}`;
  let head = null;
  if (t.stijl !== "associatie") {
    if (!omgekeerd) {
      // kop bovenaan (T), wijst omhoog
      head =
        t.stijl === "afhankelijk" ? (
          <path d={`M ${P(11.5, 9)} L ${P(15, 4)} L ${P(18.5, 9)}`} fill="none" />
        ) : (
          <path d={`M ${P(15, 4)} L ${P(11.5, 10)} L ${P(18.5, 10)} Z`} fill={t.stijl === "generatie" ? "currentColor" : "none"} />
        );
    } else {
      // kop links (L), wijst naar links (naar de rij)
      head =
        t.stijl === "afhankelijk" ? (
          <path d={`M ${P(8, 11)} L ${P(3, 15)} L ${P(8, 19)}`} fill="none" />
        ) : (
          <path d={`M ${P(3, 15)} L ${P(9, 11.5)} L ${P(9, 18.5)} Z`} fill={t.stijl === "generatie" ? "currentColor" : "none"} />
        );
    }
  }
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block" }} aria-hidden>
      <g fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d={lijn} strokeDasharray={gestippeld ? "3 2" : undefined} />
        {head}
      </g>
    </svg>
  );
}

// ── Store ───────────────────────────────────────────────────────────
const LS_KEY = "studio-kruisverbanden";

function leesOpslag() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return {};
}

function bewaar(state) {
  try {
    localStorage.setItem(
      LS_KEY,
      JSON.stringify({
        links: state.links,
        bronId: state.bronId,
        doelId: state.doelId,
        soort: state.soort,
        weergave: state.weergave,
        posities: state.posities,
        losseNodes: state.losseNodes,
      })
    );
  } catch { /* ignore */ }
}

export const refKey = (r) => `${r.profielId}::${r.elementId}`;
/** Ref uit een refKey. */
export const refUit = (key) => {
  const i = key.indexOf("::");
  return { profielId: key.slice(0, i), elementId: key.slice(i + 2) };
};
/** Cel-id (richting-onafhankelijk): altijd rij##kolom. */
const cellKey = (rij, kolom) => `${refKey(rij)}##${refKey(kolom)}`;

/** Zet een link om naar het huidige formaat (migreert het oude {van,naar}). */
function normaliseerLink(l) {
  if (!l) return null;
  if (l.rij && l.kolom) {
    return { id: l.id || cellKey(l.rij, l.kolom), rij: l.rij, kolom: l.kolom, soort: l.soort || "heeft te maken met", omgekeerd: !!l.omgekeerd };
  }
  if (l.van && l.naar) {
    return { id: cellKey(l.van, l.naar), rij: l.van, kolom: l.naar, soort: l.soort || "heeft te maken met", omgekeerd: false };
  }
  return null;
}

/** Gerichte uiteinden van een link (kolom is bovenliggend). */
export function vanNaar(l) {
  return l.omgekeerd ? { van: l.kolom, naar: l.rij } : { van: l.rij, naar: l.kolom };
}

const opgeslagen = leesOpslag();

export const useKruisStore = create((set) => ({
  /** @type {{id, rij:{profielId,elementId}, kolom:{profielId,elementId}, soort, omgekeerd}[]} */
  links: (opgeslagen.links || []).map(normaliseerLink).filter(Boolean),
  bronId: opgeslagen.bronId || null,
  doelId: opgeslagen.doelId || null,
  soort: opgeslagen.soort || "heeft te maken met",
  /** "matrix" | "grafisch" */
  weergave: opgeslagen.weergave || "matrix",
  /** { [refKey]: {x,y} } — knooppositie in de grafische view */
  posities: opgeslagen.posities || {},
  /** refKeys die zonder link op het grafische canvas staan */
  losseNodes: opgeslagen.losseNodes || [],

  zetKeuze: (patch) =>
    set((s) => {
      const next = { ...s, ...patch };
      bewaar(next);
      return patch;
    }),

  /** Cel aan/uit met de huidige soort (linkerklik). */
  toggleLink: (rij, kolom) =>
    set((s) => {
      const id = cellKey(rij, kolom);
      let links;
      if (s.links.some((l) => l.id === id)) {
        links = s.links.filter((l) => l.id !== id);
      } else {
        const t = TRACE_BY_SOORT[s.soort] || {};
        links = [...s.links, { id, rij, kolom, soort: s.soort, omgekeerd: !!t.defaultOmgekeerd }];
      }
      const next = { ...s, links };
      bewaar(next);
      return { links };
    }),

  /** Zet/wijzig de soort van een cel (maakt aan met default-richting). */
  zetSoort: (rij, kolom, soort) =>
    set((s) => {
      const id = cellKey(rij, kolom);
      const bestaand = s.links.find((l) => l.id === id);
      let links;
      if (bestaand) {
        links = s.links.map((l) => (l.id === id ? { ...l, soort } : l));
      } else {
        const t = TRACE_BY_SOORT[soort] || {};
        links = [...s.links, { id, rij, kolom, soort, omgekeerd: !!t.defaultOmgekeerd }];
      }
      const next = { ...s, links };
      bewaar(next);
      return { links };
    }),

  draaiOm: (id) =>
    set((s) => {
      const links = s.links.map((l) => (l.id === id ? { ...l, omgekeerd: !l.omgekeerd } : l));
      const next = { ...s, links };
      bewaar(next);
      return { links };
    }),

  verwijderLink: (id) =>
    set((s) => {
      const links = s.links.filter((l) => l.id !== id);
      const next = { ...s, links };
      bewaar(next);
      return { links };
    }),

  /** Project-werkbestand-import: vervang alle links (migreert oud formaat). */
  laadLinks: (links) =>
    set((s) => {
      const genormaliseerd = (links || []).map(normaliseerLink).filter(Boolean);
      const next = { ...s, links: genormaliseerd };
      bewaar(next);
      return { links: genormaliseerd };
    }),

  // ── Grafische view ────────────────────────────────────────────────
  zetWeergave: (weergave) =>
    set((s) => {
      const next = { ...s, weergave };
      bewaar(next);
      return { weergave };
    }),

  /**
   * Leg (grafisch) een gerichte link van → naar met een soort. Anders dan de
   * matrix is de richting hier expliciet: van = rij, naar = kolom, omgekeerd
   * blijft false (de getekende pijl is de bedoelde richting).
   */
  legLink: (van, naar, soort) =>
    set((s) => {
      if (refKey(van) === refKey(naar)) return {};
      const id = cellKey(van, naar);
      let links;
      if (s.links.some((l) => l.id === id)) {
        links = s.links.map((l) => (l.id === id ? { ...l, soort } : l));
      } else {
        links = [...s.links, { id, rij: van, kolom: naar, soort, omgekeerd: false }];
      }
      const next = { ...s, links };
      bewaar(next);
      return { links };
    }),

  /** Voeg een element als los knooppunt aan het grafische canvas toe. */
  voegNodeToe: (ref, positie) =>
    set((s) => {
      const key = refKey(ref);
      const losseNodes = s.losseNodes.includes(key) ? s.losseNodes : [...s.losseNodes, key];
      const posities = positie ? { ...s.posities, [key]: positie } : s.posities;
      const next = { ...s, losseNodes, posities };
      bewaar(next);
      return { losseNodes, posities };
    }),

  /** Verwijder een knoop van het canvas (én de losse-node-registratie). */
  verwijderNode: (key) =>
    set((s) => {
      const losseNodes = s.losseNodes.filter((k) => k !== key);
      const { [key]: _weg, ...posities } = s.posities;
      const next = { ...s, losseNodes, posities };
      bewaar(next);
      return { losseNodes, posities };
    }),

  zetPositie: (key, positie) =>
    set((s) => {
      const posities = { ...s.posities, [key]: positie };
      const next = { ...s, posities };
      bewaar(next);
      return { posities };
    }),
}));

// ── Helpers ─────────────────────────────────────────────────────────
/** Traceerbare profieltypen: eigen store met echte elementen. */
const traceerbaar = () => getProfieltypen().filter((p) => !p.klassiek);

/** Niet-connector-elementen van een profiel, gesorteerd op naam. */
function elementenVan(profiel, elements) {
  const perType = Object.fromEntries((profiel.descriptor.elementTypes || []).map((t) => [t.id, t]));
  return Object.values(elements)
    .filter((el) => !perType[el.elementType]?.isConnector)
    .sort((a, b) => (a.naam || a.id).localeCompare(b.naam || b.id));
}

/** Naam + profiel van een element-ref (voor de linklijst). */
function naamVan(ref) {
  const p = getProfieltype(ref.profielId);
  const el = p?.useStore.getState().elements[ref.elementId];
  return { profiel: p, naam: el?.naam || ref.elementId, bestaat: !!el };
}

// ── Context-menu (rechtsklik op een cel) ────────────────────────────
function CelMenu({ menu, sluit }) {
  React.useEffect(() => {
    if (!menu) return;
    const onDown = () => sluit();
    const onKey = (e) => e.key === "Escape" && sluit();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu, sluit]);
  if (!menu) return null;
  return (
    <div className="studio-ctxmenu" style={{ left: menu.x, top: menu.y }} onMouseDown={(e) => e.stopPropagation()}>
      {menu.items.map((it, i) =>
        it.sep ? (
          <div key={`s${i}`} className="studio-ctxmenu__sep" />
        ) : it.kop ? (
          <div key={`k${i}`} style={{ padding: "4px 10px 2px", fontSize: 10, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--s-fg-muted)" }}>{it.kop}</div>
        ) : (
          <button
            key={it.label + i}
            type="button"
            className="studio-ctxmenu__item"
            onClick={() => { sluit(); it.onClick(); }}
            style={{ display: "flex", alignItems: "center", gap: 8 }}
          >
            {it.glyph && <span style={{ color: "var(--s-fg)" }}>{it.glyph}</span>}
            <span style={{ flex: 1 }}>{it.label}</span>
            {it.actief && <span style={{ color: "var(--s-accent, #4f46e5)" }}>✓</span>}
          </button>
        )
      )}
    </div>
  );
}

// ── Sidebar: bron/doel-keuze + soort + legenda ──────────────────────
function Keuze({ label, waarde, onChange, andere }) {
  useSyncExternalStore(abonneerOpProfieltypen, profieltypenVersie);
  const opties = traceerbaar();
  return (
    <label style={{ display: "block", padding: "6px 10px", fontSize: 12 }}>
      <span style={{ display: "block", color: "var(--s-fg-muted)", marginBottom: 3 }}>{label}</span>
      <select
        value={waarde || ""}
        onChange={(e) => onChange(e.target.value || null)}
        style={{ width: "100%", font: "inherit", fontSize: 13, padding: "4px 6px", borderRadius: 6, border: "1px solid var(--s-border)", background: "var(--s-panel)", color: "var(--s-fg)" }}
      >
        <option value="">— kies profieltype —</option>
        {opties.map((p) => (
          <option key={p.id} value={p.id} disabled={p.id === andere}>
            {p.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Sidebar() {
  const bronId = useKruisStore((s) => s.bronId);
  const doelId = useKruisStore((s) => s.doelId);
  const soort = useKruisStore((s) => s.soort);
  const links = useKruisStore((s) => s.links);
  const zetKeuze = useKruisStore((s) => s.zetKeuze);
  return (
    <div style={{ fontSize: 13 }}>
      <p style={{ margin: 0, padding: "8px 10px", fontSize: 12, color: "var(--s-fg-muted)" }}>
        Trace-links tussen twee werelden. Kies een bron- (rijen) en doelprofiel
        (kolommen); klik in de matrix om een verband te leggen, rechtsklik om soort of
        richting te wijzigen. <em>De kolom is bovenliggend.</em>
      </p>
      <Keuze label="Bron (rijen)" waarde={bronId} andere={doelId} onChange={(v) => zetKeuze({ bronId: v })} />
      <Keuze label="Doel (kolommen)" waarde={doelId} andere={bronId} onChange={(v) => zetKeuze({ doelId: v })} />
      <label style={{ display: "block", padding: "6px 10px", fontSize: 12 }}>
        <span style={{ display: "block", color: "var(--s-fg-muted)", marginBottom: 3 }}>
          Soort tracering (linkerklik)
        </span>
        <select
          value={soort}
          onChange={(e) => zetKeuze({ soort: e.target.value })}
          style={{ width: "100%", font: "inherit", fontSize: 13, padding: "4px 6px", borderRadius: 6, border: "1px solid var(--s-border)", background: "var(--s-panel)", color: "var(--s-fg)" }}
        >
          {TRACE_SOORTEN.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </label>
      <div style={{ padding: "4px 12px 8px" }}>
        {TRACE_TYPEN.map((t) => (
          <div key={t.soort} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "var(--s-fg-muted)", padding: "1px 0" }}>
            <span style={{ color: "var(--s-fg)" }}><TraceGlyph soort={t.soort} /></span>
            {t.soort}{t.defaultOmgekeerd ? " (kolom→rij)" : ""}
          </div>
        ))}
      </div>
      <p style={{ margin: 0, padding: "8px 10px", fontSize: 12, color: "var(--s-fg-muted)" }}>
        {links.length} kruisverband{links.length === 1 ? "" : "en"} in totaal (alle
        profielparen; zie de inspector).
      </p>
    </div>
  );
}

// ── Main: de matrix ─────────────────────────────────────────────────
function MatrixInhoud({ bron, doel }) {
  const bronElems = bron.useStore((s) => s.elements);
  const doelElems = doel.useStore((s) => s.elements);
  const links = useKruisStore((s) => s.links);
  const toggleLink = useKruisStore((s) => s.toggleLink);
  const zetSoort = useKruisStore((s) => s.zetSoort);
  const draaiOm = useKruisStore((s) => s.draaiOm);
  const verwijderLink = useKruisStore((s) => s.verwijderLink);
  const [zoekRij, setZoekRij] = React.useState("");
  const [zoekKolom, setZoekKolom] = React.useState("");
  const [menu, setMenu] = React.useState(null);

  const rijen = elementenVan(bron, bronElems).filter(
    (el) => !zoekRij || (el.naam || el.id).toLowerCase().includes(zoekRij.toLowerCase())
  );
  const kolommen = elementenVan(doel, doelElems).filter(
    (el) => !zoekKolom || (el.naam || el.id).toLowerCase().includes(zoekKolom.toLowerCase())
  );
  const linkById = new Map(links.map((l) => [l.id, l]));
  const ref = (el, kant) => ({ profielId: (kant === "rij" ? bron : doel).id, elementId: el.id });

  const openMenu = (e, r, k) => {
    e.preventDefault();
    const rij = ref(r, "rij");
    const kolom = ref(k, "kolom");
    const id = cellKey(rij, kolom);
    const link = linkById.get(id);
    const items = [
      { kop: `${r.naam || r.id} × ${k.naam || k.id}` },
      ...TRACE_TYPEN.map((t) => ({
        label: t.soort,
        glyph: <TraceGlyph soort={t.soort} />,
        actief: link?.soort === t.soort,
        onClick: () => zetSoort(rij, kolom, t.soort),
      })),
    ];
    if (link) {
      const { van, naar } = vanNaar(link);
      const vanNaam = getProfieltype(van.profielId)?.useStore.getState().elements[van.elementId]?.naam || "?";
      const naarNaam = getProfieltype(naar.profielId)?.useStore.getState().elements[naar.elementId]?.naam || "?";
      items.push(
        { sep: true },
        { label: `Richting omdraaien (nu: ${vanNaam} → ${naarNaam})`, onClick: () => draaiOm(link.id) },
        { label: "Verwijderen", onClick: () => verwijderLink(link.id) }
      );
    }
    setMenu({ x: e.clientX, y: e.clientY, items });
  };

  const kop = { position: "sticky", top: 0, background: "var(--s-panel-head)", zIndex: 2, padding: "4px 6px", fontSize: 11, fontWeight: 600, borderBottom: "1px solid var(--s-border)", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
  const rijkop = { position: "sticky", left: 0, background: "var(--s-panel-head)", zIndex: 1, padding: "3px 8px", fontSize: 12, textAlign: "left", borderRight: "1px solid var(--s-border)", whiteSpace: "nowrap" };

  if (!rijen.length || !kolommen.length) {
    return (
      <div style={{ padding: 24, color: "var(--s-fg-muted)" }}>
        {rijen.length ? "Het doelprofiel heeft (nog) geen elementen." : "Het bronprofiel heeft (nog) geen elementen."}
      </div>
    );
  }

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "auto", padding: 0 }}>
      <div style={{ display: "flex", gap: 8, padding: 8, position: "sticky", left: 0 }}>
        <input value={zoekRij} onChange={(e) => setZoekRij(e.target.value)} placeholder={`zoek in ${bron.label}…`} style={{ font: "inherit", fontSize: 12, padding: "3px 8px", borderRadius: 6, border: "1px solid var(--s-border)", background: "var(--s-panel)", color: "var(--s-fg)" }} />
        <input value={zoekKolom} onChange={(e) => setZoekKolom(e.target.value)} placeholder={`zoek in ${doel.label}…`} style={{ font: "inherit", fontSize: 12, padding: "3px 8px", borderRadius: 6, border: "1px solid var(--s-border)", background: "var(--s-panel)", color: "var(--s-fg)" }} />
      </div>
      <table style={{ borderCollapse: "collapse", margin: "0 8px 8px" }}>
        <thead>
          <tr>
            <th style={{ ...kop, ...rijkop, zIndex: 3 }}>
              {bron.label} ↓ / {doel.label} →
            </th>
            {kolommen.map((k) => (
              <th key={k.id} style={kop} title={k.naam || k.id}>
                {k.naam || k.id}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rijen.map((r) => (
            <tr key={r.id}>
              <th style={rijkop} title={r.naam || r.id}>{r.naam || r.id}</th>
              {kolommen.map((k) => {
                const rij = ref(r, "rij");
                const kolom = ref(k, "kolom");
                const link = linkById.get(cellKey(rij, kolom));
                return (
                  <td key={k.id} style={{ borderBottom: "1px solid var(--s-border)", borderRight: "1px solid var(--s-border)", padding: 0, textAlign: "center" }}>
                    <button
                      type="button"
                      onClick={() => toggleLink(rij, kolom)}
                      onContextMenu={(e) => openMenu(e, r, k)}
                      title={link ? `${r.naam} — ${link.soort} — ${k.naam} (rechtsklik voor soort/richting)` : "Klik = verband leggen, rechtsklik = soort kiezen"}
                      style={{ width: "100%", minWidth: 40, height: 28, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", background: link ? "rgba(99,102,241,0.14)" : "transparent", color: "var(--s-fg)" }}
                    >
                      {link ? <TraceGlyph soort={link.soort} omgekeerd={link.omgekeerd} /> : ""}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <CelMenu menu={menu} sluit={() => setMenu(null)} />
    </div>
  );
}

function WeergaveToggle() {
  const weergave = useKruisStore((s) => s.weergave);
  const zetWeergave = useKruisStore((s) => s.zetWeergave);
  const knop = (id, label) => (
    <button
      type="button"
      onClick={() => zetWeergave(id)}
      style={{
        font: "inherit", fontSize: 12, padding: "3px 12px", cursor: "pointer",
        border: "1px solid var(--s-border)", color: "var(--s-fg)",
        background: weergave === id ? "var(--s-hover)" : "transparent",
        fontWeight: weergave === id ? 700 : 400,
        borderColor: weergave === id ? "var(--s-accent, #4f46e5)" : "var(--s-border)",
      }}
    >
      {label}
    </button>
  );
  return (
    <div style={{ display: "flex", gap: 0, padding: 8, borderBottom: "1px solid var(--s-border)" }}>
      {knop("matrix", "Matrix")}
      {knop("grafisch", "Grafisch")}
    </div>
  );
}

function MatrixWeergave() {
  const bronId = useKruisStore((s) => s.bronId);
  const doelId = useKruisStore((s) => s.doelId);
  const bron = bronId ? getProfieltype(bronId) : null;
  const doel = doelId ? getProfieltype(doelId) : null;
  if (!bron || !doel) {
    return (
      <div style={{ padding: 24, color: "var(--s-fg-muted)", maxWidth: 520 }}>
        <p>
          Kies links een <strong>bron-</strong> en <strong>doelprofiel</strong> om de
          kruisverbanden-matrix te zien — bv. Canoniek model × OAS, of UML × MIM.
        </p>
      </div>
    );
  }
  return <MatrixInhoud key={`${bron.id}::${doel.id}`} bron={bron} doel={doel} />;
}

function Main() {
  useSyncExternalStore(abonneerOpProfieltypen, profieltypenVersie);
  const weergave = useKruisStore((s) => s.weergave);
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column" }}>
      <WeergaveToggle />
      <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
        {weergave === "grafisch" ? <KoppelingenGrafisch /> : <MatrixWeergave />}
      </div>
    </div>
  );
}

// ── Inspector: alle links, met richting + verwijderen ───────────────
function Inspector() {
  const links = useKruisStore((s) => s.links);
  const verwijderLink = useKruisStore((s) => s.verwijderLink);
  const draaiOm = useKruisStore((s) => s.draaiOm);
  if (!links.length) {
    return <div style={{ padding: 12, fontSize: 12, color: "var(--s-fg-muted)" }}>Nog geen kruisverbanden.</div>;
  }
  return (
    <div style={{ padding: 8, fontSize: 12 }}>
      {links.map((l) => {
        const { van, naar } = vanNaar(l);
        const v = naamVan(van);
        const n = naamVan(naar);
        return (
          <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 4px", borderRadius: 5, opacity: v.bestaat && n.bestaat ? 1 : 0.5 }}>
            {v.profiel && (
              <span style={{ color: effectieveStijl(v.profiel).kleur || "inherit", display: "inline-flex" }}>
                <ProfielIcoon profiel={v.profiel} />
              </span>
            )}
            <span
              style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
              title={`${v.naam} ${l.soort} ${n.naam}`}
            >
              {v.naam}{" "}
              <span style={{ color: "var(--s-fg)", verticalAlign: "middle", margin: "0 2px", display: "inline-block" }}>
                <TraceGlyph soort={l.soort} />
              </span>{" "}
              {n.naam}
            </span>
            <button type="button" onClick={() => draaiOm(l.id)} title="Richting omdraaien" style={{ border: "none", background: "transparent", color: "var(--s-fg-muted)", cursor: "pointer" }}>⇄</button>
            <button type="button" onClick={() => verwijderLink(l.id)} title="Verwijderen" style={{ border: "none", background: "transparent", color: "var(--s-fg-muted)", cursor: "pointer" }}>×</button>
          </div>
        );
      })}
    </div>
  );
}

export default {
  id: "koppelingen",
  label: "Koppelingen",
  icon: <IconKoppeling />,
  groep: "modelleren",
  status: "preview",
  Sidebar,
  Main,
  Inspector,
  sidebarLabel: "Kruisverbanden",
  inspectorLabel: "Alle kruisverbanden",
};
