// @ts-check
/**
 * regelsetModel — een regelset als **model** in het profiel Transformatie (TRANS-1,
 * docs/TRANSFORMATIES.md §9.8).
 *
 * Besluit Mark 18/19-11: transformaties worden modelelementen in het sidecar-project, naast de
 * profielen (M2) waartussen ze afbeelden; het metamodel van een transformatie is zelf een M2
 * (`diagramprofielen/transformatie/`), geen deel van het M3. Het JSON-bestand blijft de
 * uitwisselvorm; dit bestand is de afbeelding tussen die twee, heen en terug zonder verlies.
 *
 * Een regelset wordt:
 *
 *   element «transformatie»      naam = titel; data: code (= regelset-id), versie, richting, schrijver
 *     compartiment "regels"        één veld per regel, **in volgorde** (volgorde = prioriteit)
 *     compartiment "instellingen"  één veld per instelling: wat een schrijver leest (de stand)
 *   element «taal» of «formaat»  de bron en het doel; de naam is het id van het profiel of de
 *                                naam van het formaat. Gedeeld: twee regelsets met dezelfde bron
 *                                wijzen naar hetzelfde element.
 *   connector "van" en "naar"    bron → transformatie → doel
 *
 * Een regel is een veld en geen eigen element: hij betekent niets zonder zijn plaats in de
 * volgorde (§9.1). De voorwaarden (`als`) en de actie (`dan`) blijven JSON in een tekstveld,
 * dezelfde JSON als in het bestand, met dezelfde validator.
 *
 * Puur en store-loos.
 */
import {
  TRANSFORMATIE_TYPE,
  TAAL_TYPE,
  FORMAAT_TYPE,
  VAN_TYPE,
  NAAR_TYPE,
  REGEL_VELDTYPE,
  INSTELLING_VELDTYPE,
  COMP_REGELS,
  COMP_INSTELLINGEN,
} from "../diagramprofielen/transformatie/index.js";
import { normaliseerRichting } from "./regelsetCatalogus.js";

export { TRANSFORMATIE_TYPE };

const ACTIES = ["maak", "zet", "negeer"];
const REGEL_SLEUTELS = ["naam", "bij", "als", ...ACTIES, "meld"];
const KOP = ["id", "versie", "titel", "bron", "doel", "regels"];

const isObject = (w) => !!w && typeof w === "object" && !Array.isArray(w);
const json = (waarde) => JSON.stringify(waarde, null, 2);
const kort = (tekst, max = 60) => (tekst.length > max ? `${tekst.slice(0, max - 1)}…` : tekst);
const slug = (tekst) => String(tekst).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "x";

/** "knoop → actor", "verbinding → zet op doel", "groep → negeer". */
function regelSamenvatting(regel) {
  const actie = ACTIES.find((a) => regel?.[a]);
  const wat = actie === "maak" ? regel.maak.type || "?" : actie === "zet" ? `zet op ${regel.zet.op || "?"}` : actie || "?";
  return `${regel?.bij || "?"} → ${wat}`;
}

function waardeSamenvatting(waarde) {
  if (Array.isArray(waarde)) return `lijst (${waarde.length})`;
  if (isObject(waarde)) return `{${kort(Object.keys(waarde).join(", "), 50)}}`;
  return kort(String(waarde));
}

function regelNaarVeld(regel) {
  const actie = ACTIES.find((a) => regel?.[a]) || "";
  const overig = Object.fromEntries(Object.entries(regel || {}).filter(([sleutel]) => !REGEL_SLEUTELS.includes(sleutel)));
  return {
    naam: regel?.naam || "",
    fieldType: REGEL_VELDTYPE,
    data: {
      typeLabel: regelSamenvatting(regel),
      bij: regel?.bij || "",
      ...(regel?.als !== undefined ? { als: json(regel.als) } : {}),
      actie,
      // negeer: true heeft geen inhoud; maak en zet wel.
      ...(actie && isObject(regel[actie]) ? { dan: json(regel[actie]) } : {}),
      ...(regel?.meld !== undefined ? { meld: regel.meld } : {}),
      ...(Object.keys(overig).length ? { overig: json(overig) } : {}),
    },
  };
}

/** Het id van het element «transformatie» voor een regelset. */
export const transformatieId = (regelsetId) => `tr_${slug(regelsetId)}`;
const eindpuntId = (naam) => `tre_${slug(naam)}`;

/**
 * Regelset → het element «transformatie» (zonder bron en doel; die zijn eigen elementen, zie
 * `regelsetsNaarModel`). `opties` zijn de gegevens die de catalogus naast de regelset bijhoudt.
 *
 * @param {any} regelset
 * @param {{id?: string, richting?: string, schrijver?: string|null}} [opties]
 */
export function regelsetNaarElement(regelset, { id, richting, schrijver } = {}) {
  const instellingen = Object.entries(regelset || {}).filter(([sleutel]) => !KOP.includes(sleutel));
  return {
    id: id || transformatieId(regelset.id),
    naam: regelset.titel || regelset.id,
    elementType: TRANSFORMATIE_TYPE,
    compartimenten: [
      ...(Array.isArray(regelset.regels) ? [{ compartmentType: COMP_REGELS, velden: regelset.regels.map(regelNaarVeld) }] : []),
      ...(instellingen.length
        ? [{ compartmentType: COMP_INSTELLINGEN, velden: instellingen.map(([sleutel, waarde]) => ({ naam: sleutel, fieldType: INSTELLING_VELDTYPE, data: { typeLabel: waardeSamenvatting(waarde), waarde: json(waarde) } })) }]
        : []),
    ],
    data: {
      code: regelset.id,
      versie: String(regelset.versie ?? ""),
      // Een versie die een getal was, komt als getal terug (zie modelNaarRegelset).
      ...(typeof regelset.versie === "number" ? { versieIsGetal: true } : {}),
      ...(richting ? { richting } : {}),
      ...(schrijver ? { schrijver } : {}),
    },
  };
}

/** Geschatte hoogte van het element op het canvas: kop plus een regel per veld. */
const hoogteVan = (element) => 90 + 22 * element.compartimenten.reduce((n, c) => n + 1 + c.velden.length, 0);

/**
 * Een rij vermeldingen uit de catalogus als model: `{ elements, nodes }`.
 *
 * Elke bron en elk doel wordt één element: «taal» als de naam een profiel is (`isProfiel`),
 * anders «formaat». Op het diagram staat per richting een rij transformaties, met de bronnen
 * links en de doelen rechts van het geheel.
 *
 * @param {{regelset: any, richting?: string, schrijver?: string|null}[]} vermeldingen
 * @param {{isProfiel?: (naam: string) => boolean, achtervoegsel?: string}} [opties] -
 *   `achtervoegsel` maakt de id's uniek als hetzelfde model vaker naast elkaar geladen wordt
 */
export function regelsetsNaarModel(vermeldingen, { isProfiel = () => false, achtervoegsel = "" } = {}) {
  /** @type {Record<string, any>} */
  const elements = {};
  const nodes = [];
  /** @type {Map<string|undefined, any[]>} */
  const rijen = new Map();
  const eindpunt = (naam) => {
    const id = `${eindpuntId(naam)}${achtervoegsel}`;
    if (!elements[id]) elements[id] = { id, naam, elementType: isProfiel(naam) ? TAAL_TYPE : FORMAAT_TYPE, compartimenten: [], data: {} };
    return id;
  };
  const bronnen = [];
  const doelen = [];
  for (const v of vermeldingen || []) {
    const r = v.regelset;
    const element = regelsetNaarElement(r, { id: `${transformatieId(r.id)}${achtervoegsel}`, richting: v.richting, schrijver: v.schrijver });
    elements[element.id] = element;
    rijen.set(v.richting, [...(rijen.get(v.richting) || []), element]);
    if (r.bron !== undefined) {
      const bron = eindpunt(r.bron);
      if (!bronnen.includes(bron)) bronnen.push(bron);
      elements[`${element.id}__van`] = { id: `${element.id}__van`, naam: "", elementType: VAN_TYPE, source: bron, target: element.id, compartimenten: [], data: {} };
    }
    if (r.doel !== undefined) {
      const doel = eindpunt(r.doel);
      if (!doelen.includes(doel)) doelen.push(doel);
      elements[`${element.id}__naar`] = { id: `${element.id}__naar`, naam: "", elementType: NAAR_TYPE, source: element.id, target: doel, compartimenten: [], data: {} };
    }
  }
  const X0 = 360;
  let y = 60;
  let breedst = 0;
  for (const rij of rijen.values()) {
    rij.forEach((element, kolom) => nodes.push({ elementId: element.id, position: { x: X0 + kolom * 380, y } }));
    breedst = Math.max(breedst, rij.length);
    y += Math.max(...rij.map(hoogteVan)) + 80;
  }
  // Een eindpunt dat zowel bron als doel is, staat links.
  bronnen.forEach((id, i) => nodes.push({ elementId: id, position: { x: 40, y: 60 + i * 90 } }));
  doelen.filter((id) => !bronnen.includes(id)).forEach((id, i) => nodes.push({ elementId: id, position: { x: X0 + breedst * 380 + 40, y: 60 + i * 90 } }));
  return { elements, nodes };
}

/**
 * Eén regelset als **uitwerking** (Mark 23-11: een transformatie is een container): het element
 * «transformatie» met een **eigen** bron en doel (niet gedeeld met andere regelsets) en een diagram
 * bron → transformatie → doel. In de boom hangen bron, doel en diagram onder de transformatie; wie
 * een taal bedoelt, ziet dat aan de naam (het id van het profiel).
 *
 * @param {{regelset: any, richting?: string, schrijver?: string|null}} vermelding
 * @param {{isProfiel?: (naam: string) => boolean}} [opties]
 * @returns {{element: any, elements: Record<string, any>, leden: string[], nodes: any[]}}
 *   `elements` met de transformatie, `leden` de id's van bron en doel (voor de boom)
 */
export function regelsetAlsUitwerking(vermelding, { isProfiel = () => false } = {}) {
  const r = vermelding.regelset;
  const element = regelsetNaarElement(r, { id: transformatieId(r.id), richting: normaliseerRichting(vermelding.richting) || vermelding.richting, schrijver: vermelding.schrijver });
  const elements = { [element.id]: element };
  const leden = [];
  const nodes = [{ elementId: element.id, position: { x: 340, y: 40 } }];
  const eind = (naam, rol, x) => {
    const id = `${element.id}__${rol}`;
    elements[id] = { id, naam, elementType: isProfiel(naam) ? TAAL_TYPE : FORMAAT_TYPE, compartimenten: [], data: {} };
    leden.push(id);
    nodes.push({ elementId: id, position: { x, y: 40 } });
    return id;
  };
  if (r.bron !== undefined) {
    const bron = eind(r.bron, "bron", 40);
    elements[`${element.id}__van`] = { id: `${element.id}__van`, naam: "", elementType: VAN_TYPE, source: bron, target: element.id, compartimenten: [], data: {} };
  }
  if (r.doel !== undefined) {
    const doel = eind(r.doel, "doel", 720);
    elements[`${element.id}__naar`] = { id: `${element.id}__naar`, naam: "", elementType: NAAR_TYPE, source: element.id, target: doel, compartimenten: [], data: {} };
  }
  return { element, elements, leden, nodes };
}

/**
 * Het element «transformatie» → regelset. `elements` is het model eromheen: de bron en het doel
 * komen uit de connectoren "van" en "naar". Wat niet te lezen is (kapotte JSON, een regel zonder
 * actie, twee bronnen) komt als melding terug en wordt nooit stil weggelaten; `regelset` is dan
 * `null`.
 *
 * @param {any} element
 * @param {Record<string, any>} [elements]
 * @returns {{regelset: any|null, richting: string|null, schrijver: string|null, fouten: string[]}}
 */
export function modelNaarRegelset(element, elements = {}) {
  const fouten = [];
  const data = element?.data || {};
  const wie = `Transformatie "${element?.naam || element?.id || ""}"`;
  if (element?.elementType !== TRANSFORMATIE_TYPE) fouten.push(`"${element?.naam || element?.id}" is geen transformatie.`);
  if (!data.code) fouten.push(`${wie}: code (het id van de regelset) ontbreekt.`);

  const leesJson = (tekst, waar) => {
    try {
      return JSON.parse(tekst);
    } catch (fout) {
      fouten.push(`${waar}: geen geldige JSON (${fout.message}).`);
      return undefined;
    }
  };
  const comp = (soort) => (element?.compartimenten || []).find((c) => c.compartmentType === soort);
  const eindpunt = (type, eigen, ander, woord) => {
    const lijnen = Object.values(elements).filter((c) => c.elementType === type && c[eigen] === element?.id);
    if (lijnen.length > 1) fouten.push(`${wie}: meer dan één ${woord}.`);
    const el = lijnen.length ? elements[lijnen[0][ander]] : null;
    if (lijnen.length && !el) fouten.push(`${wie}: de ${woord} bestaat niet meer.`);
    return el ? el.naam : undefined;
  };

  const regelset = { id: data.code };
  if (data.versie !== undefined && data.versie !== "") regelset.versie = data.versieIsGetal ? Number(data.versie) : data.versie;
  regelset.titel = element?.naam;
  const bron = eindpunt(VAN_TYPE, "target", "source", "bron");
  const doel = eindpunt(NAAR_TYPE, "source", "target", "doel");
  if (bron !== undefined) regelset.bron = bron;
  if (doel !== undefined) regelset.doel = doel;

  for (const veld of comp(COMP_INSTELLINGEN)?.velden || []) {
    const waar = `Instelling "${veld.naam}"`;
    if (!veld.naam) fouten.push("Een instelling zonder sleutel.");
    else if (KOP.includes(veld.naam) || veld.naam in regelset) fouten.push(`${waar}: de sleutel is al in gebruik.`);
    else if (veld.data?.waarde === undefined) fouten.push(`${waar}: waarde ontbreekt.`);
    else regelset[veld.naam] = leesJson(veld.data.waarde, waar);
  }

  const regels = comp(COMP_REGELS);
  if (regels) {
    regelset.regels = (regels.velden || []).map((veld, index) => {
      const d = veld.data || {};
      const waar = `Regel ${index + 1}${veld.naam ? ` "${veld.naam}"` : ""}`;
      const regel = { naam: veld.naam, bij: d.bij };
      if (d.als !== undefined && d.als !== "") regel.als = leesJson(d.als, `${waar}, als`);
      if (!ACTIES.includes(d.actie)) fouten.push(`${waar}: actie moet maak, zet of negeer zijn.`);
      else if (d.actie === "negeer") regel.negeer = true;
      else if (d.dan === undefined || d.dan === "") fouten.push(`${waar}: dan ontbreekt bij ${d.actie}.`);
      else regel[d.actie] = leesJson(d.dan, `${waar}, dan`);
      if (d.meld !== undefined) regel.meld = d.meld;
      if (d.overig) Object.assign(regel, leesJson(d.overig, `${waar}, overig`) || {});
      return regel;
    });
  }

  // Een oude richting (import/export/inrichting, tot 23-11) leest als de nieuwe (in/tussen/uit).
  return { regelset: fouten.length ? null : regelset, richting: normaliseerRichting(data.richting) || null, schrijver: data.schrijver || null, fouten };
}
