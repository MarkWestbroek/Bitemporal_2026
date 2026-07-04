/**
 * iconenVocabulaire — de integrale iconenset van de vormgevingssessie
 * (plan §8.6a, ontwerp 2026-07-04/05; zie docs/STUDIO-05-vormgeving-handover.md).
 *
 * Familieregels (besluiten B1/B2 van de sessie):
 *  - raster 14×14, stroke 1.2, currentColor — zelfde taal als de neutrale
 *    fallback-set in typeIconen.jsx en de uitlijn-iconen (15px, stroke 1.25);
 *  - per icoon precies één gevuld vlak (currentColor-fill) op het
 *    betekenisdragende kenmerk: kopbalk bij Klasse/Entiteit, veld-blokje bij
 *    Gegevenselement, opsommings-bolletjes bij Enumeratie, enzovoort;
 *  - UML-semantiek wint: open markers (aggregatie ◇, generalisatie ▷,
 *    realisatie) blijven óók in het icoon open — daar is de markervorm zelf
 *    het accent;
 *  - zelfde concept = zelfde id: Entiteit en Klasse delen `klasse`, de drie
 *    Enumeraties delen `enumeratie`. Profielen verwijzen per id
 *    (Definitie-domein, `ElementType.icoon`); de componenten hier zijn
 *    Implementatie-domein.
 *
 * 28 iconen dekken de elementtypen van canoniek-uml, puur-uml, oas31 en
 * profiel-ontwerp. Registratie is idempotent (veilig bij HMR).
 */
import { registreerTypeIcoon } from "./typeIconen.jsx";

const basis = (maat, kinderen) => (
  <svg
    width={maat}
    height={maat}
    viewBox="0 0 14 14"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ flexShrink: 0 }}
  >
    {kinderen}
  </svg>
);

/** Het ene gevulde accent per icoon. */
const vul = { fill: "currentColor", stroke: "none" };

/** @type {Record<string, JSX.Element>} icoon-id → 14×14-tekening */
const VOCABULAIRE = {
  // ── Boxtypen ────────────────────────────────────────────────────────────
  /** Klasse / Entiteit: het accent is de kopbalk (naam-compartiment). */
  klasse: (
    <>
      <rect x="1.5" y="2" width="11" height="10" rx="1" />
      <path d="M1.5 5.5V3a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v2.5Z" {...vul} />
      <line x1="3.5" y1="8" x2="10.5" y2="8" />
      <line x1="3.5" y1="10" x2="8.5" y2="10" />
    </>
  ),
  /** Gegevenselement: één veldregel met gevuld veld-blokje. */
  veld: (
    <>
      <rect x="1.5" y="2" width="11" height="10" rx="1" />
      <line x1="1.5" y1="5.5" x2="12.5" y2="5.5" />
      <rect x="3.3" y="7.4" width="2.2" height="2.2" rx="0.5" {...vul} />
      <line x1="6.8" y1="8.5" x2="10.6" y2="8.5" />
    </>
  ),
  /** Enumeratie / Enum: opsomming met gevulde bolletjes. */
  enumeratie: (
    <>
      <rect x="1.5" y="2" width="11" height="10" rx="1" />
      <line x1="1.5" y1="5" x2="12.5" y2="5" />
      <circle cx="4" cy="7.4" r="0.85" {...vul} />
      <line x1="5.8" y1="7.4" x2="10.5" y2="7.4" />
      <circle cx="4" cy="10" r="0.85" {...vul} />
      <line x1="5.8" y1="10" x2="10.5" y2="10" />
    </>
  ),
  /** Gegevenstype / Datatype: ‹type›-chevrons met gevulde kern. */
  datatype: (
    <>
      <path d="M4.2 4.2 1.9 7l2.3 2.8" />
      <path d="M9.8 4.2 12.1 7l-2.3 2.8" />
      <circle cx="7" cy="7" r="1.15" {...vul} />
    </>
  ),
  /** Referentielijst-instantie: lijst met gevuld (gemarkeerd) eerste item. */
  lijst: (
    <>
      <rect x="2.2" y="2.4" width="9.6" height="2.4" rx="0.7" {...vul} />
      <rect x="2.2" y="5.9" width="9.6" height="2.4" rx="0.7" />
      <rect x="2.2" y="9.4" width="9.6" height="2.4" rx="0.7" />
    </>
  ),
  /** Notitie: memo met gevuld ezelsoor. */
  notitie: (
    <>
      <path d="M2 2h7.5L12 4.5V12H2Z" />
      <path d="M9.5 2v2.5H12Z" {...vul} />
    </>
  ),
  /** Constraint: accolades met gevulde kern ({…}). */
  constraint: (
    <>
      <path d="M5.4 2.3C3.9 2.3 4.7 5.6 3.1 7c1.6 1.4 0.8 4.7 2.3 4.7" />
      <path d="M8.6 2.3c1.5 0 0.7 3.3 2.3 4.7-1.6 1.4-0.8 4.7-2.3 4.7" />
      <circle cx="7" cy="7" r="1" {...vul} />
    </>
  ),
  /** Kader: stippellijn-rand met gevulde naam-tab linksboven. */
  kader: (
    <>
      <rect x="1.5" y="2.5" width="11" height="9.5" rx="1" strokeDasharray="2.4 1.8" />
      <path d="M1.5 5.2V3.5a1 1 0 0 1 1-1h3.2v2.7Z" {...vul} />
    </>
  ),
  /** Interface: lollipop met gevulde voet. */
  interface: (
    <>
      <circle cx="7" cy="4.3" r="2.6" />
      <line x1="7" y1="6.9" x2="7" y2="11" />
      <rect x="4.6" y="10.9" width="4.8" height="1.6" rx="0.8" {...vul} />
    </>
  ),
  /** Schema (OAS-object): accolade met property-regels, gevulde keys. */
  schema: (
    <>
      <path d="M5.6 2.3C4.1 2.3 4.9 5.6 3.3 7c1.6 1.4 0.8 4.7 2.3 4.7" />
      <circle cx="7.4" cy="5.3" r="0.85" {...vul} />
      <line x1="9.1" y1="5.3" x2="11.7" y2="5.3" />
      <circle cx="7.4" cy="8.7" r="0.85" {...vul} />
      <line x1="9.1" y1="8.7" x2="11.7" y2="8.7" />
    </>
  ),
  /** Operatie: request/response-pijlpaar, gevulde heenpijl. */
  operatie: (
    <>
      <path d="M2.2 4.6H9" />
      <path d="M8.2 2.7 10.9 4.6 8.2 6.5Z" {...vul} />
      <path d="M11.8 9.4H5" />
      <path d="M6.4 7.5 3.7 9.4l2.7 1.9" />
    </>
  ),
  /** Elementtype (profiel-ontwerp): stencil — box met gevuld sjabloonblok. */
  elementtype: (
    <>
      <rect x="1.5" y="2" width="11" height="10" rx="1" />
      <rect x="3.3" y="3.8" width="4.2" height="3" rx="0.6" {...vul} />
      <line x1="3.3" y1="9.6" x2="10.6" y2="9.6" />
    </>
  ),
  /** Compartimenttype: box met gevulde middenband (het compartiment). */
  compartimenttype: (
    <>
      <rect x="1.5" y="2" width="11" height="10" rx="1" />
      <rect x="1.5" y="5.4" width="11" height="3.2" {...vul} />
    </>
  ),
  /** Veldtype: losse veldregel met gevuld blokje. */
  veldtype: (
    <>
      <rect x="2" y="5.6" width="2.7" height="2.8" rx="0.6" {...vul} />
      <line x1="6.2" y1="6.4" x2="12" y2="6.4" />
      <line x1="6.2" y1="8.4" x2="9.8" y2="8.4" />
    </>
  ),

  // ── OAS-combinatoren (systematisch trio + reeks + verwijzing, B5) ──────
  /** allOf: Venn-diagram met gevulde doorsnede. */
  samenvoeging: (
    <>
      <circle cx="5.1" cy="7" r="3.1" />
      <circle cx="8.9" cy="7" r="3.1" />
      <path d="M7 4.6A3.1 3.1 0 0 1 7 9.4 3.1 3.1 0 0 1 7 4.6Z" {...vul} />
    </>
  ),
  /** oneOf: precies één van drie gevuld. */
  "keuze-een": (
    <>
      <circle cx="3.2" cy="7" r="1.5" {...vul} />
      <circle cx="7" cy="7" r="1.5" />
      <circle cx="10.8" cy="7" r="1.5" />
    </>
  ),
  /** anyOf: één of meer gevuld. */
  "keuze-elk": (
    <>
      <circle cx="3.2" cy="7" r="1.5" {...vul} />
      <circle cx="7" cy="7" r="1.5" {...vul} />
      <circle cx="10.8" cy="7" r="1.5" />
    </>
  ),
  /** items (array): blokhaken met gevulde elementen. */
  reeks: (
    <>
      <path d="M4.6 2.5H2.7v9h1.9" />
      <path d="M9.4 2.5h1.9v9H9.4" />
      <circle cx="5.5" cy="7" r="0.8" {...vul} />
      <circle cx="7" cy="7" r="0.8" {...vul} />
      <circle cx="8.5" cy="7" r="0.8" {...vul} />
    </>
  ),
  /** $ref: gebogen pijl naar het gevulde doel. */
  verwijzing: (
    <>
      <rect x="7.8" y="8" width="4.7" height="4" rx="0.9" {...vul} />
      <path d="M2.2 2.8c4.4 0 3.4 3.2 5.4 5.4" />
      <path d="M7.9 5.7 7.7 8.3 5.1 8.1" />
    </>
  ),

  // ── Connectoren ─────────────────────────────────────────────────────────
  /** Associatie: kale lijn met open pijl. */
  associatie: (
    <>
      <line x1="1.5" y1="7" x2="12.1" y2="7" />
      <path d="M9.5 4.7 12.1 7 9.5 9.3" />
    </>
  ),
  /** Compositie: gevulde ruit ◆ (het accent ís de marker). */
  compositie: (
    <>
      <line x1="1.5" y1="7" x2="8.8" y2="7" />
      <path d="M8.8 7 10.65 5.4 12.5 7 10.65 8.6Z" {...vul} />
    </>
  ),
  /** Aggregatie: open ruit ◇ — blijft open, conform UML (B2). */
  aggregatie: (
    <>
      <line x1="1.5" y1="7" x2="8.8" y2="7" />
      <path d="M8.8 7 10.65 5.4 12.5 7 10.65 8.6Z" />
    </>
  ),
  /** Generalisatie: open driehoek ▷ — blijft open, conform UML (B2). */
  generalisatie: (
    <>
      <line x1="1.5" y1="7" x2="9" y2="7" />
      <path d="M9 4.7 12.5 7 9 9.3Z" />
    </>
  ),
  /** Realisatie: gestreepte lijn + open driehoek. */
  realisatie: (
    <>
      <line x1="1.5" y1="7" x2="8.6" y2="7" strokeDasharray="2.2 1.8" />
      <path d="M9 4.7 12.5 7 9 9.3Z" />
    </>
  ),
  /** Dependency: gestreepte lijn + open pijl. */
  dependency: (
    <>
      <line x1="1.5" y1="7" x2="11.7" y2="7" strokeDasharray="2.2 1.8" />
      <path d="M9.5 4.7 12.1 7 9.5 9.3" />
    </>
  ),
  /** Gebruik: dependency met gevulde «use»-badge. */
  gebruik: (
    <>
      <line x1="1.5" y1="8.8" x2="11.7" y2="8.8" strokeDasharray="2.2 1.8" />
      <path d="M9.5 6.5 12.1 8.8 9.5 11.1" />
      <rect x="4" y="2.2" width="6" height="2.7" rx="1.35" {...vul} />
    </>
  ),
  /** Relatie (canoniek): connector mét gevulde relatie-box in het midden. */
  "relatie-box": (
    <>
      <line x1="1" y1="7" x2="4.5" y2="7" />
      <line x1="9.5" y1="7" x2="13" y2="7" />
      <rect x="4.5" y="4.5" width="5" height="5" rx="1" {...vul} />
    </>
  ),
  /** Verbindingsregel (profiel-ontwerp): gevulde bron, open doel. */
  verbindingsregel: (
    <>
      <rect x="1.5" y="5.4" width="3.2" height="3.2" rx="0.6" {...vul} />
      <line x1="4.7" y1="7" x2="9.3" y2="7" />
      <rect x="9.3" y="5.4" width="3.2" height="3.2" rx="0.6" />
    </>
  ),
};

let _geregistreerd = false;

/** Registreer de hele set (eenmalig; aangeroepen door maakDiagramActiviteit). */
export function registreerIconenVocabulaire() {
  if (_geregistreerd) return;
  _geregistreerd = true;
  for (const [id, kinderen] of Object.entries(VOCABULAIRE)) {
    registreerTypeIcoon(id, ({ maat = 14 }) => basis(maat, kinderen));
  }
}
