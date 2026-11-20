// @ts-check
/**
 * ontwerptaal — de taal van het Profiel-ontwerp, **afgeleid uit het M3** (`types/m3.js`).
 *
 * Mark 19-11: "de ontwerptaal is het M3". Een profiel (M2) is een model in het M3, zoals een M1 een
 * model in een M2 is. De eigenschappen die de inspector van het Profiel-ontwerp toont, komen
 * daarom niet meer uit een handgeschreven lijst maar uit de metaklassen van het M3; een nieuwe
 * M3-eigenschap verschijnt vanzelf, of de dekkingstest (`ontwerptaal.test.js`) faalt.
 *
 * Per knoop- of lijnsoort van het ontwerp één metaklasse:
 *
 *   profiel           (het diagram)        DiagramType — gegevens op het ontwerp-diagram, geen knoop
 *   elementDef        «elementtype»        ElementType (geen connector)
 *   verbindingsregel  lijn                 ElementType (connector)
 *   compartimentDef   «compartimenttype»   CompartmentType
 *   fieldDef          «veldtype»           FieldType
 *   eigenschapDef     veld in het vak      PropertyType
 *   facetDef          «facet»              Facet
 *   layoutStijlDef    «layoutstijl»        LayoutStijl
 *
 * Wat elke eigenschap wordt, volgt uit de indeling van M3-MOF (`studio/metamodellen/indeling.js`)
 * plus een kleine overlay per "Metaklasse.eigenschap":
 *   - **tekening** (`structureel`): de naam van de knoop, een ◆-compositie, de erft-pijl, de
 *     lijnen zelf, een vak. Met de reden erbij;
 *   - **code** (een operatie, of een type uit het pakket Implementatie): niet tekenbaar, op id
 *     aangewezen. Hook-id's (tekst) zijn wel gegevens en reizen mee (`hooks`);
 *   - anders een **eigenschap** in de inspector, met de M3-naam achter het voorvoegsel `m3:`. Het
 *     voorvoegsel houdt de waarden van het profiel gescheiden van die van de ontwerp-knoop zelf
 *     (een «elementtype»-knoop heeft zijn eigen kleur en stereotype).
 *
 * De waarden blijven echte waarden (getal, lijst, object); samengestelde waarden bewerk je als
 * JSON (`m3-json`, zie m3Editors.jsx). Daardoor is de weg descriptor → ontwerp → descriptor voor
 * gegevens exact, en vergelijkt en voegt de projectsync per eigenschap samen.
 *
 * Puur en store-loos.
 */
import { M3_KLASSEN, M3_ENUMERATIES } from "../../diagramcore/types/m3.js";
import { indelingVan, typeSoortVan } from "../metamodellen/indeling.js";
import { codeIdVan, isEigenLayout } from "../../diagramcore/types/codeRegister.js";
import { hookIdVan } from "./profielGereedschap.js";

export const M3 = "m3:";
const M3_MODEL = { klassen: M3_KLASSEN, enumeraties: M3_ENUMERATIES };
const klasseVan = (naam) => M3_KLASSEN.find((k) => k.naam === naam);

/**
 * De knoop- en lijnsoorten van het ontwerp, elk met zijn metaklasse en wat hij in de tekening
 * draagt. `tekening`: eigenschap → hoe de tekening hem draagt (de reden staat in de dekkingstest).
 */
export const ONTWERP_SOORTEN = {
  profiel: {
    klasse: "DiagramType",
    tekening: {
      label: "de naam van het ontwerp-diagram (en wat je bij Activeer profiel invult)",
      elementTypes: "de «elementtype»-knopen en de verbindingsregel-lijnen",
      fieldTypes: "de «veldtype»-knopen",
      facetten: "de «facet»-knopen",
      layoutStijlen: "de «layoutstijl»-knopen",
      shapeSets: "Style-gegevens op het diagram (het shape-set-paneel)",
      typeWeergave: "Style-gegevens op het diagram (Beeld → Typering)",
    },
  },
  elementDef: {
    klasse: "ElementType",
    tekening: {
      label: "de naam van de knoop",
      erft: "de erft-pijl (▷) naar een ander «elementtype»",
      compartments: "◆-composities naar «compartimenttype»-knopen",
      properties: "het vak eigenschappen",
      isConnector: "een «elementtype»-knoop is nooit een connector; een connector is een lijn",
      bron: "alleen bij een connector (een lijn)",
      doel: "alleen bij een connector (een lijn)",
      verbindingsregels: "alleen bij een connector (een lijn)",
    },
  },
  verbindingsregel: {
    klasse: "ElementType",
    tekening: {
      label: "de naam van de lijn; lijnen met dezelfde naam zijn één connectortype",
      isConnector: "een lijn is altijd een connector",
      bron: "het begin van de lijnen (de getekende paren; zie bronDoelUitLijnen)",
      doel: "het eind van de lijnen",
      verbindingsregels: "de lijnen samen",
    },
  },
  compartimentDef: {
    klasse: "CompartmentType",
    tekening: { label: "de naam van de knoop", fieldType: "de ◆-compositie naar een «veldtype»-knoop" },
  },
  fieldDef: {
    klasse: "FieldType",
    tekening: { properties: "het vak eigenschappen" },
  },
  eigenschapDef: {
    klasse: "PropertyType",
    tekening: { label: "de naam van het veld" },
  },
  facetDef: {
    klasse: "Facet",
    tekening: { naam: "de naam van de knoop" },
  },
  layoutStijlDef: {
    klasse: "LayoutStijl",
    tekening: { label: "de naam van de knoop" },
  },
};

/** Een bediening die beter past dan de standaard bij het type. */
const BEDIENING = {
  "ElementType.shape": "shape-keuze",
  "ElementType.icoon": "icoon-keuze",
  "ElementType.kleur": "colour",
  "ElementType.omschrijving": "tekst",
};

/**
 * Code op id (codeRegister.js): deze eigenschappen zijn code, maar het ontwerp draagt een
 * **verwijzing** ernaar (een hook-id uit de catalogus of een code-id), zodat een profiel volledig uit
 * een model terug te bouwen is. De code zelf blijft in de tool.
 */
const CODE_OP_ID = {
  "DiagramType.hooks": (waarde) => alsMap(waarde, (fn, soort) => hookIdVan(soort, fn)),
  "ElementType.hooks": (waarde) => alsMap(waarde, (fn, soort) => hookIdVan(soort, fn)),
  "DiagramType.referenceResolvers": (waarde) => alsMap(waarde, (r) => (typeof r === "string" ? r : codeIdVan(r))),
  // Alleen eigen layouts; afgeleide (uit de layoutstijlen) maakt de registratie opnieuw.
  "DiagramType.layouts": (waarde) => {
    const ids = (Array.isArray(waarde) ? waarde : []).filter((l) => typeof l === "string" || isEigenLayout(l)).map((l) => (typeof l === "string" ? l : codeIdVan(l))).filter(Boolean);
    return ids.length ? ids : undefined;
  },
};
/** Een map met code → dezelfde map met id's; wat geen id heeft, valt weg. */
function alsMap(waarde, naarId) {
  const uit = {};
  for (const [k, w] of Object.entries(waarde || {})) {
    const id = naarId(w, k);
    if (id) uit[k] = id;
  }
  return Object.keys(uit).length ? uit : undefined;
}

/** Is deze eigenschap code (niet tekenbaar en geen verwijzing ernaar)? */
export function isCode(klasse, e) {
  if (`${klasse.naam}.${e.naam}` in CODE_OP_ID) return false;
  if (e.operatie) return true;
  const type = klasseVan(e.type);
  return !!type && type.pakket === "Implementatie" && type.soort === "klasse";
}

/**
 * De bediening van een eigenschap: het datatype van de PropertyType in de ontwerptaal.
 * @returns {{datatype: string, opties?: {waarde: string, label: string}[]}}
 */
function bedieningVan(klasse, e) {
  const vast = BEDIENING[`${klasse.naam}.${e.naam}`];
  if (vast) return { datatype: vast };
  const enkel = e.kard === "1" || e.kard === "0..1";
  if (enkel && !e.sleutel) {
    const soort = typeSoortVan(M3_MODEL, e.type);
    if (e.type === "boolean") return { datatype: "boolean" };
    if (e.type === "string") return { datatype: "string" };
    if (e.type === "number") return { datatype: "m3-getal" };
    if (soort === "enumeratie") {
      const en = M3_ENUMERATIES.find((x) => x.naam === e.type);
      return { datatype: "keuze", opties: [{ waarde: "", label: "(geen)" }, ...en.waarden.map((w) => ({ waarde: w, label: w }))] };
    }
    // Een verwijzing naar een metaklasse die niet als knoop getekend wordt (shape, style): een id.
    if (soort === "klasse" && indelingVan(M3_MODEL, klasse, e) === "associatie") return { datatype: "string" };
  }
  return { datatype: "m3-json" };
}

/** Een korte typenaam voor het label: `ElementType [*]`, `boolean`. */
const typeTekst = (e) => `${e.sleutel ? `${e.sleutel} → ` : ""}${e.type}${e.kard === "1" || e.kard === "0..1" ? "" : ` [${e.kard}]`}`;

/**
 * De eigenschappen die een ontwerpsoort als gegevens draagt: alles van zijn metaklasse behalve
 * wat de tekening draagt en wat code is.
 * @param {keyof typeof ONTWERP_SOORTEN} soort
 */
export function m3Eigenschappen(soort) {
  const { klasse: naam, tekening } = ONTWERP_SOORTEN[soort];
  const klasse = klasseVan(naam);
  if (!klasse) throw new Error(`Ontwerptaal: metaklasse ${naam} staat niet in het M3.`);
  return klasse.eigenschappen.filter((e) => !(e.naam in tekening) && !isCode(klasse, e)).map((e) => ({ klasse, e }));
}

/**
 * De PropertyTypes voor de inspector van een ontwerpsoort, met de M3-naam als sleutel.
 * @param {keyof typeof ONTWERP_SOORTEN} soort
 */
export function m3PropertyTypes(soort) {
  return m3Eigenschappen(soort).map(({ klasse, e }) => ({
    key: `${M3}${e.naam}`,
    label: `${e.naam} (${typeTekst(e)})`,
    ...bedieningVan(klasse, e),
  }));
}

const isFunctie = (w) => typeof w === "function";
/** Een kopie zonder functies (code); een object met alleen functies vervalt. */
function zonderCode(waarde) {
  if (isFunctie(waarde)) return undefined;
  if (Array.isArray(waarde)) return waarde.map(zonderCode).filter((w) => w !== undefined);
  if (waarde && typeof waarde === "object") {
    const uit = {};
    for (const [k, w] of Object.entries(waarde)) {
      if (k.startsWith("_")) continue;
      const kopie = zonderCode(w);
      if (kopie !== undefined) uit[k] = kopie;
    }
    return Object.keys(uit).length || !Object.keys(waarde).length ? uit : undefined;
  }
  return waarde;
}

/**
 * Een object van de metaklasse → de gegevens van een ontwerp-knoop (`m3:<eigenschap>`).
 * Afgeleide sleutels (`_…`) en code vallen weg. `behalve`: eigenschappen die niet mee moeten
 * (bv. wat een kind van zijn ouder erfde).
 * @param {keyof typeof ONTWERP_SOORTEN} soort
 * @param {Record<string, any>} obj
 */
export function naarData(soort, obj, behalve = new Set()) {
  const data = {};
  for (const { klasse, e } of m3Eigenschappen(soort)) {
    if (obj?.[e.naam] === undefined || behalve.has(e.naam)) continue;
    const opId = CODE_OP_ID[`${klasse.naam}.${e.naam}`];
    const waarde = opId ? opId(obj[e.naam]) : zonderCode(obj[e.naam]);
    if (waarde !== undefined) data[`${M3}${e.naam}`] = waarde;
  }
  return data;
}

/**
 * De gegevens van een ontwerp-knoop → de eigenschappen van de metaklasse. Een lege tekst of een
 * lege keuze telt als "niet gezet"; `null` blijft staan (het blokkeert erven).
 * @param {keyof typeof ONTWERP_SOORTEN} soort
 * @param {Record<string, any>} data
 */
export function uitData(soort, data) {
  const uit = {};
  for (const { e } of m3Eigenschappen(soort)) {
    const waarde = data?.[`${M3}${e.naam}`];
    if (waarde === undefined || waarde === "") continue;
    // `null` is een waarde: "niet erven" (Relatie zet `opname: null` tegenover zijn ouder).
    if (waarde === null) {
      uit[e.naam] = null;
      continue;
    }
    // Een keuze buiten de enumeratie (met de hand of uit een ouder ontwerp) telt niet.
    const en = typeSoortVan(M3_MODEL, e.type) === "enumeratie" && !e.sleutel && (e.kard === "1" || e.kard === "0..1") ? M3_ENUMERATIES.find((x) => x.naam === e.type) : null;
    if (en && !en.waarden.includes(waarde)) continue;
    uit[e.naam] = waarde;
  }
  return uit;
}

/**
 * De naam van een knoop draagt een eigenschap (meestal `label`). Om die exact terug te geven als
 * hij ontbrak of geen tekst was (een compartiment met `label: null`), onthoudt de knoop wat er
 * stond en welke naam daaruit volgde. Verandert iemand de naam, dan wint de nieuwe naam.
 */
export function naamNaarData(waarde, naam) {
  return typeof waarde === "string" && waarde === naam ? {} : { [`${M3}_naam`]: { was: naam, ...(waarde === undefined ? {} : { waarde }) } };
}

/** @returns {{gezet: boolean, waarde?: any}} */
export function naamUitData(knoop) {
  const onthouden = knoop?.data?.[`${M3}_naam`];
  if (onthouden && onthouden.was === knoop.naam) return "waarde" in onthouden ? { gezet: true, waarde: onthouden.waarde } : { gezet: false };
  return { gezet: true, waarde: knoop?.naam };
}
