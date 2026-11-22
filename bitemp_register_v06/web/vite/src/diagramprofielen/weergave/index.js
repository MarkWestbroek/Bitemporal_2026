// @ts-check
/**
 * weergave — het profiel (M2) waarin de **weergaven** van de tool staan: iconen en vormen als
 * modelelementen (plan docs/plans/2026-11-21 Sidecar-project — weergaven en starten uit het
 * project, §2–§3; besluiten Mark 21-11).
 *
 * Inhoud en vorm zijn gescheiden: een profiel zegt *wat* er is, het weergaveproject zegt *hoe*
 * het eruitziet. Dit profiel is de taal van dat project. Het is een gewoon M2 op de motor, dus een
 * weergave reist mee met sync, historie, branches en samenvoegen per veld, zonder eigen spoor.
 *
 *   - **icoon** — een icoon als SVG-tekst (`svg`, gegevenstype *svg*: een eigen editor met
 *     voorbeeld). Monochroom volgt de tekstkleur.
 *   - **vorm** — een ShapeType: de renderer op id (`renderer`), zijn `parameters`, de `minMaat`
 *     en de `ankers`. De renderer zelf blijft code (zoals de graaf-bol, die de velden van een
 *     element als satellieten tekent); het project wijst hem alleen aan, zoals bij code op id.
 *   - **koppeling** (0.2.0, plan §7 stap 3) — hoe de elementtypen van één profiel getekend worden:
 *     per elementtype de vorm, het icoon, de kleur en `achtergrond`, per relatie de lijn
 *     (`edgePresentatie`), en de `typeWeergave` van het profiel. `set` leeg is de standaard; een
 *     shape-set (een andere gedaante, zoals ArchiMate "Iconen als vorm") is een koppeling met een
 *     set-id. In het M2 blijven deze waarden staan als standaard; de koppeling overschrijft ze.
 *
 * De naam van het element is de id van de weergave (bv. `bpmn-taak`). Op het canvas tekent een
 * weergave zichzelf (`vormen.js`): een icoon als tegel, een vorm in zijn eigen gedaante.
 *
 * De ontwerper wijzigt weergaven, de modelleur niet (§6). Een nieuw profiel begint bij 0.1.0.
 */
import { registreerDiagramType, getDiagramType } from "../../diagramcore/types/typeRegistry.js";
import { ICOON_VORM, VORM_VORM, KOPPELING_VORM } from "./vormen.js"; // registreert ook de ShapeTypes: canvas, documenten en render-svc

export const WEERGAVE_PROFIEL_ID = "weergave";
export const ICOON_TYPE = "icoon";
export const VORM_TYPE = "vorm";
export const KOPPELING_TYPE = "koppeling";
/** Het gegevenstype van de regels van een koppeling; de editor staat in weergaveEditors.jsx. */
export const KOPPELING_REGELS_DATATYPE = "weergave-koppeling";
/** Het gegevenstype van SVG-tekst; de editor staat in studio/activities/weergaveEditors.jsx. */
export const SVG_DATATYPE = "svg";
/** Samengestelde waarden (parameters, minMaat) als JSON, met de editor van de ontwerptaal. */
const JSON_DATATYPE = "m3-json";

/** @type {import("../../diagramcore/types/schema.js").ElementType[]} */
const elementTypes = [
  {
    id: ICOON_TYPE,
    label: "Icoon",
    lidwoord: "het",
    omschrijving: "Een icoon als SVG-tekst. De naam is de id waarmee een elementtype het icoon aanwijst.",
    kort: "IC",
    shape: ICOON_VORM,
    icoon: "box",
    properties: [
      { key: "label", label: "label (leesbare naam)", datatype: "string" },
      { key: "svg", label: "SVG", datatype: SVG_DATATYPE },
      { key: "monochroom", label: "monochroom (volgt de tekstkleur)", datatype: "boolean" },
    ],
  },
  {
    id: VORM_TYPE,
    label: "Vorm",
    lidwoord: "de",
    omschrijving: "Een vorm (ShapeType): een renderer uit de code, aangewezen op id, met parameters. De naam is de id waarmee een elementtype de vorm aanwijst.",
    kort: "VM",
    shape: VORM_VORM,
    icoon: "rounded",
    properties: [
      { key: "renderer", label: "renderer (id in de code)", datatype: "string" },
      { key: "parameters", label: "parameters (JSON)", datatype: JSON_DATATYPE },
      { key: "minMaat", label: "kleinste maat {w, h} (JSON)", datatype: JSON_DATATYPE },
      {
        key: "ankers",
        label: "ankers",
        datatype: "keuze",
        opties: [
          { waarde: "rechthoek", label: "rechthoek" },
          { waarde: "rand", label: "rand (volgt de vorm)" },
        ],
      },
      { key: "overig", label: "overige sleutels van de vorm (JSON)", datatype: JSON_DATATYPE },
    ],
  },
  {
    id: KOPPELING_TYPE,
    label: "Koppeling",
    lidwoord: "de",
    omschrijving:
      "Hoe de elementtypen van één profiel getekend worden: per elementtype de vorm en het icoon (op id, uit dit project of de code), de kleur en of het een achtergrond is; per relatie de lijn. Zonder set is het de standaard, met een set een andere gedaante.",
    kort: "KP",
    shape: KOPPELING_VORM,
    icoon: "class-box",
    properties: [
      { key: "profiel", label: "profiel (id)", datatype: "string" },
      { key: "set", label: "set (leeg = standaard)", datatype: "string" },
      { key: "setLabel", label: "naam van de set", datatype: "string" },
      {
        key: "typeWeergave",
        label: "type tonen",
        datatype: "keuze",
        opties: [
          { waarde: "", label: "(zoals de tool)" },
          { waarde: "geen", label: "geen" },
          { waarde: "icoon", label: "icoon" },
          { waarde: "tekst", label: "tekst" },
        ],
      },
      { key: "regels", label: "per elementtype", datatype: KOPPELING_REGELS_DATATYPE },
    ],
  },
];

export const weergaveDiagramType = {
  id: WEERGAVE_PROFIEL_ID,
  label: "Weergave",
  versie: "0.2.0", // 0.2.0 (22-11): koppeling
  style: "uml-klassiek",
  fieldTypes: [],
  elementTypes,
  taakbalken: [{ id: "maken", label: "Maken", acties: "elementTypes" }],
  layouts: [],
};

let _teller = 0;

/** Nieuw element van het gegeven type. */
export function maakElement(elementTypeId) {
  const et = elementTypes.find((t) => t.id === elementTypeId);
  if (!et) return null;
  _teller += 1;
  return { id: `wg_${Date.now()}_${_teller}`, naam: et.label, elementType: et.id, compartimenten: [], data: {} };
}

/** Idempotente registratie (veilig bij HMR/dubbele import). */
export function registreerWeergaveProfiel() {
  if (!getDiagramType(WEERGAVE_PROFIEL_ID)) registreerDiagramType(weergaveDiagramType);
}
