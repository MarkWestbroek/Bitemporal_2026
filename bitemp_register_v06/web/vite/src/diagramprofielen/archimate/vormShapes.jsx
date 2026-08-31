/**
 * ArchiMate-vormshapes — de **tweede officiële notatie**: niet een box met een
 * hoek-icoon, maar het symbool *zélf* als vorm (actor = poppetje, component =
 * blok met uitsteeksels, node = 3D-doos, …). Geactiveerd via de shape-set
 * "Iconen als vorm" (`vormSet.js`, menu **Beeld → Shape-set**); de Definitie
 * blijft gelijk, alleen de gedaante wisselt.
 *
 * **Naam ín de node.** `naamLabel: "buiten"` (het motor-primitief dat de naam
 * ónder een kleine vaste vorm zet) is Definitie-niveau en wisselt dus níet
 * mee met een shape-set. Elke vormshape draagt zijn naam daarom zelf, onder
 * het symbool en binnen de node — patroon `DataObjectShape` in
 * `diagramprofielen/bpmn/shapes.jsx`.
 *
 * **Maatvoering (bewuste keuze).** `resizebaar` en de minima staan óók op
 * descriptor-niveau: de ArchiMate-elementtypen zijn resizebaar en een node kan
 * al een handmatige maat (`Position.elementSize`) hebben uit de box-gedaante.
 * Een vaste BPMN-achtige maat zou dan een klein symbooltje in een grote lege
 * node geven. Daarom **schaalt** het symbool mee: de vormlaag is een
 * `flex`-vlak met een `viewBox`-SVG op `preserveAspectRatio="xMidYMid meet"`,
 * met bescheiden minima (92×84) voor niet-geresizede nodes. Zo werkt dezelfde
 * shape voor een verse node én voor een node die in de box-gedaante is
 * opgerekt, en blijft terugwisselen naar de box verliesvrij. De minima van de
 * *resizer* (180×56) blijven descriptor-niveau en gelden dus ook hier — een
 * vormnode is met de muis niet kleiner te trekken dan de box.
 *
 * Kleur: de laagkleur van het elementtype (of `data.kleur`) vult het symbool;
 * lijnen en tekst komen uit de thema-tokens (`--dc-lijn`, `--dc-selectie`,
 * `--s-fg`, en `--dc-marker-vulling` voor vlakken die *open* moeten ogen) —
 * zie de tokentoelichting bovenin `diagramcore/styles/diagramcore.css`.
 *
 * `children` bevat de React Flow-handles (+ resizer/badge) — altijd renderen.
 */
import React from "react";
import { registreerShape } from "../../diagramcore/shapes/shapeRegistry.js";
import { VORM_SHAPE_IDS } from "./vormSet.js";

const LIJN = "var(--dc-lijn, #334155)";
const OPEN = "var(--dc-marker-vulling, #ffffff)";
const TEKST = "var(--s-fg, #0f172a)";

/** Minimum-maat van een niet-geresizede vormnode (symboolvlak + naamregel). */
const MIN_BREEDTE = 92;
const MIN_HOOGTE = 84;
const MIN_SYMBOOL = 52;

/**
 * Frame om elke vormshape: symboolvlak (schaalt) + de naam eronder, binnen de
 * node. `teken({ vulling, kleur, sw })` levert de SVG-inhoud in `viewBox`.
 */
function VormNode({ element, elementType, selected, children, viewBox, teken }) {
  const vulling = element?.data?.kleur || elementType?.kleur || OPEN;
  const kleur = selected ? "var(--dc-selectie, #4f46e5)" : LIJN;
  const sw = selected ? 2.8 : 1.8;
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        minWidth: MIN_BREEDTE,
        minHeight: MIN_HOOGTE,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-start",
        gap: 3,
        padding: 2,
        position: "relative",
      }}
    >
      {/* Symboolvlak: absoluut gepositioneerde SVG in een relatief vlak, zodat
          de hoogte deterministisch is (flex-item met minHoogte) en de SVG
          precies dat vlak vult — "meet" houdt de verhouding. */}
      <div style={{ position: "relative", width: "100%", flex: "1 1 auto", minHeight: MIN_SYMBOOL }}>
        <svg
          viewBox={viewBox}
          preserveAspectRatio="xMidYMid meet"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block", pointerEvents: "none" }}
        >
          {teken({ vulling, kleur, sw })}
        </svg>
      </div>
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: TEKST,
          textAlign: "center",
          maxWidth: "100%",
          lineHeight: 1.2,
          overflowWrap: "anywhere",
          pointerEvents: "none",
        }}
      >
        {element?.naam || `(${elementType?.label || "?"})`}
      </div>
      {children}
    </div>
  );
}

/** Fabriek: van een viewBox + tekenfunctie naar een shape-component. */
const maakVorm = (viewBox, teken) => {
  const Shape = (props) => <VormNode {...props} viewBox={viewBox} teken={teken} />;
  return Shape;
};

// ── De vormen (spec-symbolen als vorm) ────────────────────────────────────

/** Business actor: het poppetje. */
const ActorVorm = maakVorm("0 0 48 60", ({ vulling, kleur, sw }) => (
  <g stroke={kleur} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" fill="none">
    <circle cx="24" cy="12" r="9" fill={vulling} />
    <path d="M24 21 V38 M9 27 H39 M24 38 L12 56 M24 38 L36 56" />
  </g>
));

/**
 * Business rol: de liggende cilinder. De omtrek heeft twee bogen in dezélfde
 * richting (de linker is de achterkant); de **naad** aan de rechterkant is de
 * andere helft van de voorste ellips en buigt dus tegengesteld — zonder die
 * naad oogt de vorm als een gewone afgeronde rechthoek (en dus als een
 * service).
 */
const RolVorm = maakVorm("0 0 72 44", ({ vulling, kleur, sw }) => (
  <g stroke={kleur} strokeWidth={sw} strokeLinejoin="round" fill="none">
    <path d="M18 6 H50 a11 16 0 0 1 0 32 H18 a11 16 0 0 1 0 -32 Z" fill={vulling} />
    <path d="M50 6 a11 16 0 0 0 0 32" />
  </g>
));

/** Business proces: de pijl. */
const ProcesVorm = maakVorm("0 0 96 48", ({ vulling, kleur, sw }) => (
  <path
    d="M4 14 H60 V4 L92 24 L60 44 V34 H4 Z"
    fill={vulling}
    stroke={kleur}
    strokeWidth={sw}
    strokeLinejoin="round"
  />
));

/** Functie (business/applicatie): de chevron met de punt naar boven. */
const FunctieVorm = maakVorm("0 0 60 60", ({ vulling, kleur, sw }) => (
  <path
    d="M30 4 L56 26 V56 L30 38 L4 56 V26 Z"
    fill={vulling}
    stroke={kleur}
    strokeWidth={sw}
    strokeLinejoin="round"
  />
));

/** Service (business/applicatie/technology): het afgeronde blok. */
const ServiceVorm = maakVorm("0 0 96 44", ({ vulling, kleur, sw }) => (
  <rect x="4" y="6" width="88" height="32" rx="16" fill={vulling} stroke={kleur} strokeWidth={sw} />
));

/** Business event: de pijl met de inkeping aan de achterkant. */
const EventVorm = maakVorm("0 0 92 44", ({ vulling, kleur, sw }) => (
  <path
    d="M6 6 H62 L86 22 L62 38 H6 L24 22 Z"
    fill={vulling}
    stroke={kleur}
    strokeWidth={sw}
    strokeLinejoin="round"
  />
));

/** Object (business/data): de rechthoek met de kopstreep. */
const ObjectVorm = maakVorm("0 0 96 56", ({ vulling, kleur, sw }) => (
  <g stroke={kleur} strokeWidth={sw} strokeLinejoin="round">
    <rect x="4" y="6" width="88" height="44" fill={vulling} />
    <line x1="4" y1="18" x2="92" y2="18" />
  </g>
));

/** Applicatiecomponent: het blok met de twee uitsteeksels. */
const ComponentVorm = maakVorm("0 0 84 60", ({ vulling, kleur, sw }) => (
  <g stroke={kleur} strokeWidth={sw} strokeLinejoin="round">
    <rect x="18" y="4" width="62" height="52" fill={vulling} />
    <rect x="4" y="14" width="28" height="12" fill={vulling} />
    <rect x="4" y="34" width="28" height="12" fill={vulling} />
  </g>
));

/** Node: de 3D-doos (voorvlak + bovenvlak + zijvlak). */
const NodeVorm = maakVorm("0 0 84 64", ({ vulling, kleur, sw }) => (
  <g stroke={kleur} strokeWidth={sw} strokeLinejoin="round">
    {/* Boven- en zijvlak iets doorschijnend: diepte zonder een tweede,
        thema-onvriendelijke vaste kleur. */}
    <path d="M4 18 L20 4 H80 L64 18 Z" fill={vulling} fillOpacity="0.65" />
    <path d="M64 18 L80 4 V46 L64 60 Z" fill={vulling} fillOpacity="0.65" />
    <rect x="4" y="18" width="60" height="42" fill={vulling} />
  </g>
));

/** Device: de afgeronde doos op een voet. */
const DeviceVorm = maakVorm("0 0 88 64", ({ vulling, kleur, sw }) => (
  <g stroke={kleur} strokeWidth={sw} strokeLinejoin="round">
    <rect x="10" y="4" width="68" height="40" rx="7" fill={vulling} />
    <path d="M2 58 L16 44 H72 L86 58 Z" fill={vulling} />
  </g>
));

/** Systeemsoftware: de bol met de arc van de "onderliggende" bol erachter. */
const SoftwareVorm = maakVorm("0 0 72 68", ({ vulling, kleur, sw }) => (
  <g stroke={kleur} strokeWidth={sw} strokeLinecap="round" fill="none">
    <path d="M12 30 A24 24 0 0 1 48 8" />
    <circle cx="42" cy="40" r="24" fill={vulling} />
  </g>
));

/** Artifact: het dokje met de omgevouwen hoek. */
const ArtifactVorm = maakVorm("0 0 64 76", ({ vulling, kleur, sw }) => (
  <g stroke={kleur} strokeWidth={sw} strokeLinejoin="round">
    <path d="M6 4 H40 L58 22 V72 H6 Z" fill={vulling} />
    {/* De omgevouwen hoek blijft *onvuld*: het hoekvlak ligt buiten de omtrek,
        dus een vaste vulling zou in het donkere thema als vlek oplichten. */}
    <path d="M40 4 V22 H58" fill="none" />
  </g>
));

const VORMEN = {
  "am-vorm-actor": ActorVorm,
  "am-vorm-rol": RolVorm,
  "am-vorm-proces": ProcesVorm,
  "am-vorm-functie": FunctieVorm,
  "am-vorm-service": ServiceVorm,
  "am-vorm-event": EventVorm,
  "am-vorm-object": ObjectVorm,
  "am-vorm-component": ComponentVorm,
  "am-vorm-node": NodeVorm,
  "am-vorm-device": DeviceVorm,
  "am-vorm-software": SoftwareVorm,
  "am-vorm-artifact": ArtifactVorm,
};

let _geregistreerd = false;
/** Idempotente registratie (veilig bij HMR/dubbele import). */
export function registreerArchimateVormShapes() {
  if (_geregistreerd) return;
  for (const id of VORM_SHAPE_IDS) {
    const Shape = VORMEN[id];
    if (Shape) registreerShape(id, Shape);
  }
  _geregistreerd = true;
}
