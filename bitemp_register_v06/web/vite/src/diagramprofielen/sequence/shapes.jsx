/**
 * Sequence-shapes (v0):
 *
 *   - **levenslijn**: de node zelf is bewust smal (14px breed) en hoog — de
 *     gestippelde lijn. De naam-kop rendert er via overflow bovenop (breder
 *     dan de node). Dáárdoor werkt het rand-primitief (§3.1) als
 *     sequence-mechaniek: punten/activaties klemmen op de node-omtrek
 *     = visueel óp de lijn, schuiven er verticaal langs en bewegen mee
 *     met de levenslijn;
 *   - **punt** (occurrence): klein bolletje op de lijn — het aanhechtpunt
 *     voor berichten (v0-benadering van het as-/volgorde-primitief:
 *     de y-positie ís de volgorde, door de gebruiker beheerd);
 *   - **activatie**: smalle balk op de lijn (execution specification),
 *     in hoogte resizebaar (minBreedte/minHoogte, core);
 *   - **fragment**: kader met soort-chip linksboven (alt/opt/loop/par).
 *
 * `children` bevat de React Flow-handles (+ resizer) — altijd renderen.
 */
import React from "react";
import { registreerShape, getShape } from "../../diagramcore/shapes/shapeRegistry.js";
import { getDiagramType } from "../../diagramcore/types/typeRegistry.js";
import { useStore } from "@xyflow/react";
import { resolveerElementRef } from "../../studio/elementVerwijzing.jsx";
import { getProfieltype } from "../../studio/profieltypeRegistry";
import { leidActivatiesAf } from "./activaties.js";
import { SEQUENCE_PROFIEL_ID, BERICHTEN } from "./labels.js";

// Lijn/vulling voor vormen die direct op het canvas staan (start/eind,
// balken, levenslijnen, randen): thema-variabele, in donker lichter
// (diagramcore.css --dc-lijn-slate-700; gemeld 2026-10-10).
const DONKER = "var(--dc-lijn-slate-700, #334155)";
const KOP_BREED = 148;

/** Levenslijn: smalle hoge node (de lijn), met de naam-kop erbovenop. */
function LevenslijnShape({ element, selected, children }) {
  const rand = selected ? "var(--dc-selectie, #2563eb)" : "#94a3b8";
  // Getypeerd object (instantie-van): kop toont "naam:Type" onderstreept —
  // de UML-objectnotatie. Onvindbaar type → naam + ⚠ (verwijderd/hernoemd).
  const ref = element?.data?.instantieVan;
  const type = ref ? resolveerElementRef(ref) : null;
  const kop = element?.naam || (type ? "" : "(levenslijn)");
  const naamTekst = ref ? (
    <span style={{ textDecoration: "underline" }}>
      {kop}
      {type ? `:${type.label}` : " ⚠"}
    </span>
  ) : (
    kop
  );
  // Rechthoek-kop: breder dan de node (overflow), gecentreerd bovenaan. De
  // kop hoort bij de node (kind-element) en sleept hem dus gewoon mee.
  const rechthoek = (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 7 - KOP_BREED / 2,
        width: KOP_BREED,
        padding: "6px 8px",
        boxSizing: "border-box",
        border: `1.6px solid ${rand}`,
        borderRadius: 4,
        background: element?.data?.kleur || "#f8fafc",
        fontSize: 12,
        fontWeight: 700,
        color: "#0f172a",
        textAlign: "center",
        // De kop heeft een vaste breedte (KOP_BREED); lange objectnamen
        // wrappen daarbinnen naar een tweede regel in plaats van afgekapt te
        // worden — de kop wordt dan hoger, de levenslijn schuift mee.
        lineHeight: 1.25,
        overflowWrap: "anywhere",
      }}
    >
      {naamTekst}
    </div>
  );
  // Volgorde: weergave van het type → gekozen icoon-kop → rechthoek.
  const metType = typeKop(element, type);
  let kopVorm = rechthoek;
  if (metType) {
    kopVorm = <TypeKop {...metType} naam={`${kop}:${type.label}`} selected={selected} reserve={rechthoek} />;
  } else if (ICONEN[element?.data?.kop]) {
    kopVorm = (
      <IcoonKop soort={element.data.kop} kleur={element?.data?.kleur} rand={selected ? rand : DONKER}>
        {naamTekst}
      </IcoonKop>
    );
  }
  return (
    <div style={{ width: 14, height: "100%", minHeight: 260, position: "relative" }}>
      {/* De gestippelde lijn zelf (gecentreerd in de smalle node). */}
      <svg width="14" height="100%" style={{ position: "absolute", inset: 0, pointerEvents: "none" }} preserveAspectRatio="none">
        <line x1="7" y1="30" x2="7" y2="100%" stroke={selected ? "var(--dc-selectie, #2563eb)" : DONKER} strokeWidth="1.4" strokeDasharray="6 4" />
      </svg>
      <AfgeleideActivaties lijnId={element?.id} selected={selected} />
      {kopVorm}
      {children}
    </div>
  );
}

const PUNT = 12;
const BALK_BREED = 14;
const useLeeg = () => null;

/**
 * Activaties afgeleid uit de berichten (activaties.js): de levenslijn leest de
 * punten (kind-nodes) en levenslijnen uit het canvas en de berichten uit de
 * profielstore, en tekent haar eigen balken. Niets wordt opgeslagen: de balken
 * volgen de berichten, ook na verschuiven. Geneste activaties (zelf-aanroep)
 * schuiven per niveau 5px naar rechts, zoals EA.
 */
function AfgeleideActivaties({ lijnId, selected }) {
  const nodes = useStore((s) => s.nodes);
  const useProfielStore = getProfieltype(SEQUENCE_PROFIEL_ID)?.useStore || useLeeg;
  const elements = useProfielStore((st) => st?.elements) || null;
  const balken = React.useMemo(() => {
    if (!elements || !lijnId) return [];
    const perId = new Map(nodes.map((n) => [n.id, n]));
    const lijnY = new Map();
    for (const n of nodes) if (n.data?.element?.elementType === "levenslijn") lijnY.set(n.id, n.position?.y ?? 0);
    /** punt-node → { lijn, y (absoluut, midden van het punt) } */
    const punten = new Map();
    for (const n of nodes) {
      if (n.data?.element?.elementType !== "punt" || !n.parentId || !lijnY.has(n.parentId)) continue;
      punten.set(n.id, { lijn: perId.get(n.parentId)?.data?.element?.id || n.parentId, y: lijnY.get(n.parentId) + (n.position?.y ?? 0) + PUNT / 2 });
    }
    const berichten = [];
    for (const c of Object.values(elements)) {
      if (!BERICHTEN.includes(c?.elementType)) continue;
      const a = punten.get(c.source), b = punten.get(c.target);
      if (!a || !b) continue;
      berichten.push({ id: c.id, bron: a.lijn, doel: b.lijn, y: a.y, yEind: b.y, soort: c.elementType });
    }
    const mijnY = [...lijnY.entries()].find(([id]) => perId.get(id)?.data?.element?.id === lijnId)?.[1] ?? 0;
    return leidActivatiesAf(berichten)
      .filter((a) => a.lijn === lijnId)
      .map((a) => ({ top: a.van - mijnY, hoogte: a.tot - a.van, diepte: a.diepte }));
  }, [nodes, elements, lijnId]);
  if (!balken.length) return null;
  const rand = selected ? "var(--dc-selectie, #2563eb)" : DONKER;
  return (
    <>
      {balken.map((b, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            top: b.top,
            left: b.diepte * 5,
            width: BALK_BREED,
            height: b.hoogte,
            background: "#e2e8f0",
            border: `1.5px solid ${rand}`,
            borderRadius: 2,
            boxSizing: "border-box",
            pointerEvents: "none",
          }}
        />
      ))}
    </>
  );
}

/** Vormen die als kop niets toevoegen of niet passen: de UML-objectrechthoek
 * (class-box) blijft de gewone kop met naam:Type onderstreept. */
const GEEN_TYPEKOP = new Set(["class-box", "edge", "seq-levenslijn", "note"]);

/**
 * Kop in de weergave van het type (2026-10-14, Mark): is de levenslijn een
 * instantie van een element uit een ander profiel — bv. een ArchiMate
 * applicatiecomponent — en is er geen kop gekozen, dan tekent de kop dat
 * element zoals zijn eigen profiel het doet (vorm, laagkleur, hoek-icoon).
 * Een gekozen kop (object/actor/boundary/…) wint.
 * @returns {{Shape: Function, elementType: any, typeElement: any}|null}
 */
function typeKop(element, type) {
  if (!type || element?.data?.kop) return null;
  const descriptor = type.profiel?.descriptor;
  const dt = (descriptor?.id && getDiagramType(descriptor.id)) || descriptor;
  const elementType = dt?.elementTypes?.find((t) => t.id === type.element.elementType);
  if (!elementType || elementType.isConnector || GEEN_TYPEKOP.has(elementType.shape)) return null;
  const Shape = getShape(elementType.shape);
  return Shape ? { Shape, elementType, typeElement: type.element } : null;
}

/** Valt een vreemde vorm buiten zijn eigen profiel om, dan de gewone kop. */
class KopGrens extends React.Component {
  constructor(props) {
    super(props);
    this.state = { fout: false };
  }
  static getDerivedStateFromError() {
    return { fout: true };
  }
  render() {
    return this.state.fout ? this.props.reserve : this.props.children;
  }
}

/** De vorm van het type als kop: zonder compartimenten, met naam:Type. */
function TypeKop({ Shape, elementType, typeElement, naam, selected, reserve }) {
  const nep = { ...typeElement, naam, compartimenten: [] };
  return (
    <KopGrens reserve={reserve}>
      <div style={{ position: "absolute", top: 0, left: 7 - KOP_BREED / 2, width: KOP_BREED, height: 52 }}>
        <Shape element={nep} elementType={elementType} selected={selected}>
          {null}
        </Shape>
      </div>
    </KopGrens>
  );
}

/**
 * Icoon-koppen (2026-10-14): actor (poppetje) en de robustness-stereotypes
 * van Jacobson — boundary (cirkel met staander links), control (cirkel met
 * pijlpunt bovenop) en entity (cirkel op een streep). Viewbox 48×40; het
 * icoon staat gecentreerd boven de naam, de lijn loopt eronder door.
 */
const ICONEN = {
  actor: (s, f) => (
    <g stroke={s} strokeWidth="1.6" fill="none" strokeLinecap="round">
      <circle cx="24" cy="7" r="5.5" fill={f} />
      <line x1="24" y1="12.5" x2="24" y2="26" />
      <line x1="14" y1="17" x2="34" y2="17" />
      <line x1="24" y1="26" x2="16" y2="38" />
      <line x1="24" y1="26" x2="32" y2="38" />
    </g>
  ),
  boundary: (s, f) => (
    <g stroke={s} strokeWidth="1.6">
      <line x1="7" y1="8" x2="7" y2="32" />
      <line x1="7" y1="20" x2="15" y2="20" />
      <circle cx="28" cy="20" r="13" fill={f} />
    </g>
  ),
  control: (s, f) => (
    <g stroke={s} strokeWidth="1.6">
      <circle cx="24" cy="22" r="13" fill={f} />
      <polyline points="28,4 23,9 28,14" fill="none" strokeLinejoin="round" />
    </g>
  ),
  entity: (s, f) => (
    <g stroke={s} strokeWidth="1.6">
      <circle cx="24" cy="18" r="13" fill={f} />
      <line x1="11" y1="35" x2="37" y2="35" />
    </g>
  ),
};

// Business-varianten: hetzelfde icoon met een schuine streep door de cirkel.
const STREEP = { "business-boundary": [20, 31, 36, 9], "business-control": [16, 33, 32, 11], "business-entity": [16, 29, 32, 7] };
for (const [soort, [x1, y1, x2, y2]] of Object.entries(STREEP)) {
  const basis = ICONEN[soort.replace("business-", "")];
  ICONEN[soort] = (s, f) => (
    <g>
      {basis(s, f)}
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={s} strokeWidth="1.6" />
    </g>
  );
}

function IcoonKop({ soort, kleur, rand, children }) {
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 7 - KOP_BREED / 2,
        width: KOP_BREED,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <svg width="48" height="40" viewBox="0 0 48 40" style={{ overflow: "visible" }}>
        {ICONEN[soort](rand, kleur || "#e0f2fe")}
      </svg>
      <div
        style={{
          marginTop: 2,
          padding: "1px 4px",
          maxWidth: KOP_BREED,
          // Zelfde vlak als de rechthoek-kop: de lijn loopt niet door de naam.
          background: "#f8fafc",
          borderRadius: 3,
          fontSize: 12,
          fontWeight: 700,
          color: "#0f172a",
          textAlign: "center",
          lineHeight: 1.25,
          overflowWrap: "anywhere",
        }}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Punt (occurrence): aanhechtpunt voor berichten. In UML tekent men het niet
 * (plan §2.1; Mark, 14-10: "helemaal weg, zoals in class"): onzichtbaar, en
 * een ring zodra de muis erop staat of hij geselecteerd is — zodat je hem
 * nog kunt pakken om een bericht te trekken of te verslepen.
 */
function PuntShape({ selected, children }) {
  const [hover, setHover] = React.useState(false);
  const rand = selected ? "var(--dc-selectie, #2563eb)" : DONKER;
  return (
    <div
      className="dc-seq-punt"
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      style={{
        width: 12,
        height: 12,
        borderRadius: "50%",
        background: "transparent",
        border: `1.6px solid ${rand}`,
        opacity: selected || hover ? 1 : 0,
        transition: "opacity 0.15s",
        boxSizing: "border-box",
        position: "relative",
      }}
    >
      {children}
    </div>
  );
}

/** Activatie: smalle staande balk (execution specification) op de lijn. */
function ActivatieShape({ selected, children }) {
  const rand = selected ? "var(--dc-selectie, #2563eb)" : DONKER;
  return (
    <div
      className="dc-punt-node"
      style={{
        width: 14,
        height: "100%",
        minHeight: 44,
        background: "#e2e8f0",
        border: `1.5px solid ${rand}`,
        borderRadius: 2,
        boxSizing: "border-box",
        position: "relative",
      }}
    >
      {children}
    </div>
  );
}

/** Fragment: kader met de soort (alt/opt/loop/par) als chip linksboven. */
function FragmentShape({ element, selected, children }) {
  const rand = selected ? "var(--dc-selectie, #2563eb)" : "#94a3b8";
  const soort = element?.data?.soort || "alt";
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        minWidth: 260,
        minHeight: 160,
        border: `1.6px solid ${rand}`,
        borderRadius: 3,
        background: "rgba(148, 163, 184, 0.06)",
        boxSizing: "border-box",
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          padding: "2px 14px 2px 8px",
          background: "var(--s-panel, #fff)",
          border: `1.6px solid ${rand}`,
          borderTop: "none",
          borderLeft: "none",
          // Het klassieke "afgeknipte hoek"-pentagoontje.
          clipPath: "polygon(0 0, 100% 0, 100% 55%, 85% 100%, 0 100%)",
          fontSize: 11,
          fontWeight: 700,
          color: "#0f172a",
        }}
      >
        {soort}
        {element?.naam ? ` — ${element.naam}` : ""}
      </div>
      {children}
    </div>
  );
}

let _geregistreerd = false;
export function registreerSequenceShapes() {
  if (_geregistreerd) return;
  registreerShape("seq-levenslijn", LevenslijnShape);
  registreerShape("seq-punt", PuntShape);
  registreerShape("seq-activatie", ActivatieShape);
  registreerShape("seq-fragment", FragmentShape);
  _geregistreerd = true;
}
