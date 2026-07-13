/**
 * koppelingenActivity — "Koppelingen": kruisverbanden tussen profieltypen
 * (consolidatieplan fase 4, v0).
 *
 * Een kruisverband is een trace-link tussen twee elementen uit (meestal)
 * verschillende werelden: UML `Taak` ↔ MIM `«Objecttype» Taak`, entiteit ↔
 * proces, schema ↔ canoniek element. Beperkt tot twee profieltypen laat
 * zich dat als **matrix** tonen — deze v0: kies bron- en doelprofiel, vink
 * cellen aan. Links persisteren in localStorage en reizen mee in het
 * project-werkbestand. Grafisch (cross-profiel-diagram) en het superprofiel
 * volgen later; klassieke editors (bpmn.io/dmn-js) doen nog niet mee — hun
 * elementen leven buiten de profiel-stores.
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
      JSON.stringify({ links: state.links, bronId: state.bronId, doelId: state.doelId, soort: state.soort })
    );
  } catch { /* ignore */ }
}

/** Soorten tracering (sessie 2026-07-13); nieuwe links krijgen de gekozen soort. */
export const TRACE_SOORTEN = [
  "komt voort uit",
  "heeft te maken met",
  "genereert",
  "realiseert",
];

const linkKey = (van, naar) =>
  `${van.profielId}::${van.elementId}>>${naar.profielId}::${naar.elementId}`;

const opgeslagen = leesOpslag();

export const useKruisStore = create((set) => ({
  /** @type {{id:string, van:{profielId,elementId}, naar:{profielId,elementId}, soort:string}[]} */
  links: opgeslagen.links || [],
  bronId: opgeslagen.bronId || null,
  doelId: opgeslagen.doelId || null,
  soort: opgeslagen.soort || "heeft te maken met",

  zetKeuze: (patch) =>
    set((s) => {
      const next = { ...s, ...patch };
      bewaar(next);
      return patch;
    }),

  toggleLink: (van, naar) =>
    set((s) => {
      const id = linkKey(van, naar);
      const bestaand = s.links.some((l) => l.id === id);
      const links = bestaand
        ? s.links.filter((l) => l.id !== id)
        : [...s.links, { id, van, naar, soort: s.soort }];
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

  /** Project-werkbestand-import: vervang alle links. */
  laadLinks: (links) =>
    set((s) => {
      const next = { ...s, links: links || [] };
      bewaar(next);
      return { links: next.links };
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

/** Naam van een element in een profiel (voor de linklijst). */
function naamVan(ref) {
  const p = getProfieltype(ref.profielId);
  const el = p?.useStore.getState().elements[ref.elementId];
  return { profiel: p, naam: el?.naam || ref.elementId, bestaat: !!el };
}

// ── Sidebar: bron/doel-keuze ────────────────────────────────────────
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
        Trace-links tussen twee werelden. Kies een bron- en doelprofiel; vink in de
        matrix de kruisverbanden aan.
      </p>
      <Keuze label="Bron (rijen)" waarde={bronId} andere={doelId} onChange={(v) => zetKeuze({ bronId: v })} />
      <Keuze label="Doel (kolommen)" waarde={doelId} andere={bronId} onChange={(v) => zetKeuze({ doelId: v })} />
      <label style={{ display: "block", padding: "6px 10px", fontSize: 12 }}>
        <span style={{ display: "block", color: "var(--s-fg-muted)", marginBottom: 3 }}>
          Soort tracering (voor nieuwe verbanden)
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
  const [zoekRij, setZoekRij] = React.useState("");
  const [zoekKolom, setZoekKolom] = React.useState("");

  const rijen = elementenVan(bron, bronElems).filter(
    (el) => !zoekRij || (el.naam || el.id).toLowerCase().includes(zoekRij.toLowerCase())
  );
  const kolommen = elementenVan(doel, doelElems).filter(
    (el) => !zoekKolom || (el.naam || el.id).toLowerCase().includes(zoekKolom.toLowerCase())
  );
  const linkSet = new Set(links.map((l) => l.id));
  const key = (r, k) =>
    linkKey({ profielId: bron.id, elementId: r.id }, { profielId: doel.id, elementId: k.id });

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
                const aan = linkSet.has(key(r, k));
                return (
                  <td key={k.id} style={{ borderBottom: "1px solid var(--s-border)", borderRight: "1px solid var(--s-border)", padding: 0, textAlign: "center" }}>
                    <button
                      type="button"
                      onClick={() =>
                        toggleLink(
                          { profielId: bron.id, elementId: r.id },
                          { profielId: doel.id, elementId: k.id }
                        )
                      }
                      title={aan ? "Kruisverband verwijderen" : "Kruisverband leggen"}
                      style={{ width: "100%", minWidth: 34, height: 26, border: "none", cursor: "pointer", background: aan ? "var(--s-accent, #4f46e5)" : "transparent", color: "#fff", fontSize: 12 }}
                    >
                      {aan ? "●" : ""}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Main() {
  useSyncExternalStore(abonneerOpProfieltypen, profieltypenVersie);
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

// ── Inspector: alle links, met verwijderen ──────────────────────────
function Inspector() {
  const links = useKruisStore((s) => s.links);
  const verwijderLink = useKruisStore((s) => s.verwijderLink);
  if (!links.length) {
    return <div style={{ padding: 12, fontSize: 12, color: "var(--s-fg-muted)" }}>Nog geen kruisverbanden.</div>;
  }
  return (
    <div style={{ padding: 8, fontSize: 12 }}>
      {links.map((l) => {
        const van = naamVan(l.van);
        const naar = naamVan(l.naar);
        return (
          <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 4px", borderRadius: 5, opacity: van.bestaat && naar.bestaat ? 1 : 0.5 }}>
            {van.profiel && (
              <span style={{ color: effectieveStijl(van.profiel).kleur || "inherit", display: "inline-flex" }}>
                <ProfielIcoon profiel={van.profiel} />
              </span>
            )}
            <span
              style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
              title={`${van.naam} ${l.soort || "→"} ${naar.naam}`}
            >
              {van.naam}{" "}
              <span style={{ color: "var(--s-fg-muted)", fontStyle: "italic" }}>
                {l.soort ? `${l.soort} ` : ""}→
              </span>{" "}
              {naar.naam}
            </span>
            {naar.profiel && (
              <span style={{ color: effectieveStijl(naar.profiel).kleur || "inherit", display: "inline-flex" }}>
                <ProfielIcoon profiel={naar.profiel} />
              </span>
            )}
            <button
              type="button"
              onClick={() => verwijderLink(l.id)}
              title="Verwijderen"
              style={{ border: "none", background: "transparent", color: "var(--s-fg-muted)", cursor: "pointer" }}
            >
              ×
            </button>
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
