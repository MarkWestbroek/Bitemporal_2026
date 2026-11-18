// @ts-check
/**
 * regelsetModel — een regelset als **modelelement** (TRANS-1, docs/TRANSFORMATIES.md §9.8).
 *
 * Besluit Mark 18-11: transformaties worden modelelementen in het profielenproject, naast de
 * profielen (M2) waartussen ze afbeelden. Dan komen opslag op de server, samenwerken, historie
 * en branches vanzelf mee, net als bij een profiel (PROF-1). Het JSON-bestand blijft de
 * uitwisselvorm; dit bestand is de afbeelding tussen die twee, heen en terug zonder verlies.
 *
 * Eén element per regelset, van het type «transformatie» (`transformatieDef`) in het
 * profiel-ontwerp:
 *
 *   data                         de kop: code (= regelset-id), versie, bron, doel, richting, schrijver
 *   compartiment "regels"        één veld per regel, **in volgorde** (volgorde = prioriteit)
 *   compartiment "instellingen"  één veld per instelling: wat een schrijver leest (de stand)
 *
 * Een regel is een veld en geen eigen element: hij betekent niets zonder zijn plaats in de
 * volgorde (§9.1). De voorwaarden (`als`) en de actie (`dan`) blijven JSON in een tekstveld,
 * dezelfde JSON als in het bestand, met dezelfde validator.
 *
 * Lezers, schrijvers en de toepasser blijven code; het element wijst de schrijver aan op naam.
 *
 * Puur en store-loos.
 */

export const TRANSFORMATIE_TYPE = "transformatieDef";
export const REGEL_VELDTYPE = "regelDef";
export const INSTELLING_VELDTYPE = "instellingDef";
const COMP_REGELS = "regels";
const COMP_INSTELLINGEN = "instellingen";

const ACTIES = ["maak", "zet", "negeer"];
const REGEL_SLEUTELS = ["naam", "bij", "als", ...ACTIES, "meld"];
const KOP = ["id", "versie", "titel", "bron", "doel", "regels"];

/** De veldtypen die het profiel-ontwerp erbij krijgt. */
export const TRANSFORMATIE_FIELDTYPES = [
  {
    id: REGEL_VELDTYPE,
    viewer: "naam-type",
    properties: [
      { key: "naam", datatype: "string", verplicht: true },
      // Alleen weergave ("knoop → actor"); afgeleid uit bij en dan, telt niet mee bij het teruglezen.
      { key: "typeLabel", label: "samenvatting (afgeleid)", datatype: "string" },
      { key: "bij", label: "bij (knoop/groep/verbinding)", datatype: "string" },
      { key: "als", label: "als: voorwaarden (JSON)", datatype: "tekst" },
      { key: "actie", label: "actie (maak/zet/negeer)", datatype: "string" },
      { key: "dan", label: "dan: wat de actie maakt of zet (JSON)", datatype: "tekst" },
      { key: "meld", label: "interpretatie melden", datatype: "boolean" },
      { key: "overig", label: "overige sleutels van de regel (JSON)", datatype: "tekst" },
    ],
  },
  {
    id: INSTELLING_VELDTYPE,
    viewer: "naam-type",
    properties: [
      { key: "naam", label: "sleutel", datatype: "string", verplicht: true },
      { key: "typeLabel", label: "samenvatting (afgeleid)", datatype: "string" },
      { key: "waarde", label: "waarde (JSON)", datatype: "tekst" },
    ],
  },
];

/** Het elementtype «transformatie» voor het profiel-ontwerp. */
export const TRANSFORMATIE_ELEMENTTYPE = {
  id: TRANSFORMATIE_TYPE,
  label: "Transformatie",
  omschrijving: "Een regelset: de afbeelding tussen twee talen, of tussen een taal en een extern formaat. De regels staan in volgorde; de eerste die past wint.",
  kort: "TR",
  stereotype: "«transformatie»",
  shape: "class-box",
  kleur: "#fecdd3",
  icoon: "elementtype",
  properties: [
    { key: "code", label: "code (id van de regelset)", datatype: "string" },
    { key: "versie", label: "versie", datatype: "string" },
    { key: "versieIsGetal", label: "versie is een getal (1, 2, …) en geen tekst (0.8.1)", datatype: "boolean" },
    { key: "richting", label: "richting (import/export/inrichting)", datatype: "string" },
    { key: "bron", label: "bron (profiel of formaat)", datatype: "string" },
    { key: "doel", label: "doel (profiel of formaat)", datatype: "string" },
    { key: "schrijver", label: "schrijver (de motor waarvan de instellingen de stand zijn)", datatype: "string" },
  ],
  compartments: [
    { id: COMP_REGELS, label: "regels", fieldType: REGEL_VELDTYPE },
    { id: COMP_INSTELLINGEN, label: "instellingen", fieldType: INSTELLING_VELDTYPE },
  ],
};

const isObject = (w) => !!w && typeof w === "object" && !Array.isArray(w);
const json = (waarde) => JSON.stringify(waarde, null, 2);
const kort = (tekst, max = 60) => (tekst.length > max ? `${tekst.slice(0, max - 1)}…` : tekst);

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

/**
 * Regelset → element. `opties` zijn de gegevens die de catalogus naast de regelset bijhoudt.
 *
 * @param {any} regelset
 * @param {{id?: string, richting?: string, schrijver?: string|null}} [opties]
 */
export function regelsetNaarElement(regelset, { id, richting, schrijver } = {}) {
  const instellingen = Object.entries(regelset || {}).filter(([sleutel]) => !KOP.includes(sleutel));
  return {
    id: id || `tr_${regelset.id}`,
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
      // Een versie die een getal was, komt als getal terug (zie elementNaarRegelset).
      ...(typeof regelset.versie === "number" ? { versieIsGetal: true } : {}),
      ...(richting ? { richting } : {}),
      ...(regelset.bron !== undefined ? { bron: regelset.bron } : {}),
      ...(regelset.doel !== undefined ? { doel: regelset.doel } : {}),
      ...(schrijver ? { schrijver } : {}),
    },
  };
}

/**
 * Element → regelset. Wat niet te lezen is (kapotte JSON, een regel zonder actie) komt als
 * melding terug en wordt nooit stil weggelaten; `regelset` is dan `null`.
 *
 * @returns {{regelset: any|null, richting: string|null, schrijver: string|null, fouten: string[]}}
 */
export function elementNaarRegelset(element) {
  const fouten = [];
  const data = element?.data || {};
  if (element?.elementType !== TRANSFORMATIE_TYPE) fouten.push(`"${element?.naam || element?.id}" is geen transformatie.`);
  if (!data.code) fouten.push(`Transformatie "${element?.naam || ""}": code (het id van de regelset) ontbreekt.`);

  const leesJson = (tekst, waar) => {
    try {
      return JSON.parse(tekst);
    } catch (fout) {
      fouten.push(`${waar}: geen geldige JSON (${fout.message}).`);
      return undefined;
    }
  };
  const comp = (soort) => (element?.compartimenten || []).find((c) => c.compartmentType === soort);

  const regelset = { id: data.code };
  if (data.versie !== undefined && data.versie !== "") regelset.versie = data.versieIsGetal ? Number(data.versie) : data.versie;
  regelset.titel = element?.naam;
  if (data.bron !== undefined) regelset.bron = data.bron;
  if (data.doel !== undefined) regelset.doel = data.doel;

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

  return { regelset: fouten.length ? null : regelset, richting: data.richting || null, schrijver: data.schrijver || null, fouten };
}

/** Geschatte hoogte van het element op het canvas: kop plus een regel per veld. */
const hoogteVan = (element) => 90 + 22 * element.compartimenten.reduce((n, c) => n + 1 + c.velden.length, 0);

/**
 * Een rij vermeldingen uit de catalogus als ontwerp: `{ elements, nodes }`, per richting een rij.
 * Een rij is zo hoog als zijn langste regelset, zodat de rijen elkaar niet overlappen.
 *
 * @param {{regelset: any, richting?: string, schrijver?: string|null}[]} vermeldingen
 */
export function ontwerpUitRegelsets(vermeldingen) {
  const elements = {};
  const nodes = [];
  /** @type {Map<string|undefined, any[]>} */
  const rijen = new Map();
  for (const v of vermeldingen || []) {
    const element = regelsetNaarElement(v.regelset, { richting: v.richting, schrijver: v.schrijver });
    elements[element.id] = element;
    rijen.set(v.richting, [...(rijen.get(v.richting) || []), element]);
  }
  let y = 60;
  for (const rij of rijen.values()) {
    rij.forEach((element, kolom) => nodes.push({ elementId: element.id, position: { x: 60 + kolom * 380, y } }));
    y += Math.max(...rij.map(hoogteVan)) + 80;
  }
  return { elements, nodes };
}
