// @ts-check
/**
 * assistentKern — de AI-assistent in context (AI-2, 14-10-2026), zuiver deel.
 *
 * Vorm zoals de transformaties (lezer → regelset → toepasser, docs/TRANSFORMATIES.md): de AI is
 * de "lezer" van een opdracht in gewone taal en levert een **plan** (structured output); de
 * regelset is het profiel (M2: element- en connectortypen met hun verbindingsregels), dat hier
 * het plan controleert; de toepasser is `planNaarCoreModel` + `importeerModel` (één undo-stap,
 * gesynct). De gebruiker ziet het voorstel eerst; niets gebeurt zonder Toepassen.
 *
 * Twee soorten opdrachten:
 *  - **model**  (rechtsklik op een map): "maak een use case-model met actoren …" → nieuwe
 *    elementen, relaties en een diagram in die map;
 *  - **velden** (rechtsklik op een element): "voeg de attributen aap: string, noot: int toe" →
 *    nieuwe regels in een compartiment van dat element.
 */
import { verbindingsregelsVan } from "../../diagramcore/types/typeRegistry.js";

/** Wat het profiel toestaat, compact (voor de prompt én de controle). */
export function profielSamenvatting(descriptor) {
  const ets = descriptor?.elementTypes || [];
  const elementen = ets
    .filter((et) => !et.isConnector && !et.isAbstract && et.id !== "notitie")
    .map((et) => ({ id: et.id, label: et.label || et.id, ...(et.omschrijving ? { omschrijving: et.omschrijving } : {}) }));
  const connectoren = ets
    .filter((et) => et.isConnector && !et.isAbstract)
    .map((et) => ({ id: et.id, label: et.label || et.id, regels: verbindingsregelsVan(et).map((r) => ({ bron: r.bron, doel: r.doel })) }))
    .filter((c) => c.regels.length);
  return { naam: descriptor?.naam || descriptor?.label || descriptor?.id || "profiel", elementen, connectoren };
}

const SCHEMA_MODEL = {
  type: "object",
  additionalProperties: false,
  required: ["uitleg", "diagramNaam", "elementen", "connectoren"],
  properties: {
    uitleg: { type: "string", description: "kort, in het Nederlands: wat je maakt en welke keuzes je deed" },
    diagramNaam: { type: "string" },
    elementen: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["sleutel", "type", "naam"],
        properties: { sleutel: { type: "string" }, type: { type: "string" }, naam: { type: "string" } },
      },
    },
    connectoren: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["sleutel", "type", "bron", "doel"],
        properties: { sleutel: { type: "string" }, type: { type: "string" }, bron: { type: "string" }, doel: { type: "string" }, naam: { type: "string" } },
      },
    },
  },
};

const SCHEMA_VELDEN = {
  type: "object",
  additionalProperties: false,
  required: ["uitleg", "compartiment", "velden"],
  properties: {
    uitleg: { type: "string" },
    compartiment: { type: "string", description: "id van het compartiment waar de velden in komen" },
    velden: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["naam"],
        properties: { naam: { type: "string" }, type: { type: "string" }, verplicht: { type: "boolean" } },
      },
    },
  },
};

/** Systeemprompt + schema voor een nieuw model in een profiel. */
export function vraagVoorModel(descriptor, opdracht, { mapNaam = "" } = {}) {
  const p = profielSamenvatting(descriptor);
  const systeem = [
    `Je bent de modelleerassistent van Omnium Studio. Je maakt een model in de modelleertaal "${p.naam}".`,
    "Gebruik ALLEEN deze elementtypen (id: label):",
    ...p.elementen.map((e) => `- ${e.id}: ${e.label}${e.omschrijving ? ` — ${e.omschrijving}` : ""}`),
    "En ALLEEN deze relaties, alleen tussen de genoemde typen (bron → doel):",
    ...p.connectoren.map((c) => `- ${c.id}: ${c.label} — ${c.regels.map((r) => `${r.bron.join("|")} → ${r.doel.join("|")}`).join("; ")}`),
    "Regels: geef elk element een unieke korte `sleutel` (bv. a1, u1) en verwijs daarmee in `bron` en `doel`. " +
      "Namen in de taal van de opdracht, zoals een analist ze zou schrijven (bv. 'Maak feature request'). " +
      "Maak geen elementen die niet uit de opdracht volgen. Geef de richting van een relatie zoals de taal dat " +
      "voorschrijft (bv. bij 'extend' van de uitbreidende naar de uitgebreide use case). " +
      "Antwoord uitsluitend met JSON in deze vorm (geen tekst eromheen):",
    // De vorm ook in de prompt: Claude krijgt het schema (structured outputs), DeepSeek en de
    // proxy alleen "geef JSON".
    '{"uitleg": "…", "diagramNaam": "…", "elementen": [{"sleutel": "a1", "type": "<elementtype-id>", "naam": "…"}], ' +
      '"connectoren": [{"sleutel": "c1", "type": "<relatietype-id>", "bron": "a1", "doel": "u1"}]}',
  ].join("\n");
  const vraag = `${mapNaam ? `Het model komt in de map "${mapNaam}". ` : ""}Opdracht:\n${opdracht}`;
  return { systeem, vraag, jsonSchema: SCHEMA_MODEL };
}

/** Bewerkbare compartimenten van een elementtype met naam-type-velden. */
export function veldCompartimenten(descriptor, elementType) {
  const et = (descriptor?.elementTypes || []).find((t) => t.id === elementType);
  const fts = new Map((descriptor?.fieldTypes || []).map((f) => [f.id, f]));
  return (et?.compartments || [])
    .filter((c) => !c.alleenWeergave && fts.get(c.fieldType)?.viewer === "naam-type" && !fts.get(c.fieldType)?.afgeleid)
    .map((c) => ({ id: c.id, label: c.label || c.id, fieldType: c.fieldType }));
}

/** Systeemprompt + schema voor velden bij één element. */
export function vraagVoorVelden(descriptor, element, opdracht) {
  const comps = veldCompartimenten(descriptor, element.elementType);
  const bestaand = (element.compartimenten || []).flatMap((c) => (c.velden || []).map((v) => `${c.compartmentType}: ${v.naam}${v.data?.typeLabel ? ` : ${v.data.typeLabel}` : ""}`));
  const systeem = [
    "Je bent de modelleerassistent van Omnium Studio. Je voegt velden toe aan één element.",
    `Element: "${element.naam || element.id}" (type ${element.elementType}).`,
    `Compartimenten (id): ${comps.map((c) => c.id).join(", ") || "geen"}.`,
    bestaand.length ? `Het heeft al: ${bestaand.join("; ")}. Voeg die niet opnieuw toe.` : "Het heeft nog geen velden.",
    "Neem namen en typen over zoals de gebruiker ze geeft (bv. 'tekst', 'int', 'string', 'datum'); verzin geen extra velden. " +
      "Antwoord uitsluitend met JSON in deze vorm (geen tekst eromheen):",
    '{"uitleg": "…", "compartiment": "<compartiment-id>", "velden": [{"naam": "…", "type": "…", "verplicht": false}]}',
  ].join("\n");
  return { systeem, vraag: `Opdracht:\n${opdracht}`, jsonSchema: SCHEMA_VELDEN };
}

/** JSON uit een antwoord (ook als het model er tekst of ```json omheen zette). */
export function leesAntwoord(tekst) {
  const t = String(tekst || "").trim();
  try { return JSON.parse(t); } catch { /* verder zoeken */ }
  const blok = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (blok) { try { return JSON.parse(blok[1]); } catch { /* verder */ } }
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch { /* geen JSON */ } }
  return null;
}

/**
 * Controleer een modelantwoord tegen het profiel: onbekende typen en verwijzingen eruit,
 * relaties die de verbindingsregels niet toestaan eruit. → {plan, diagramNaam, uitleg, problemen}
 */
export function controleerModel(antwoord, descriptor) {
  const p = profielSamenvatting(descriptor);
  const problemen = [];
  const typen = new Set(p.elementen.map((e) => e.id));
  const elementen = [];
  const typeVan = new Map();
  for (const e of Array.isArray(antwoord?.elementen) ? antwoord.elementen : []) {
    const sleutel = String(e?.sleutel || "").trim();
    if (!sleutel || typeVan.has(sleutel)) { problemen.push(`Element zonder of met dubbele sleutel overgeslagen (${e?.naam || "?"}).`); continue; }
    if (!typen.has(e.type)) { problemen.push(`Type "${e.type}" bestaat niet in ${p.naam}; "${e.naam}" overgeslagen.`); continue; }
    typeVan.set(sleutel, e.type);
    elementen.push({ sleutel, type: e.type, naam: String(e.naam || "").trim(), data: {} });
  }
  const connectoren = [];
  const conType = new Map(p.connectoren.map((c) => [c.id, c]));
  for (const c of Array.isArray(antwoord?.connectoren) ? antwoord.connectoren : []) {
    const ct = conType.get(c?.type);
    if (!ct) { problemen.push(`Relatietype "${c?.type}" bestaat niet in ${p.naam}; overgeslagen.`); continue; }
    const bt = typeVan.get(c.bron), dt = typeVan.get(c.doel);
    if (!bt || !dt) { problemen.push(`${ct.label} tussen onbekende elementen (${c.bron} → ${c.doel}) overgeslagen.`); continue; }
    if (!ct.regels.some((r) => r.bron.includes(bt) && r.doel.includes(dt))) {
      problemen.push(`${ct.label} van ${bt} naar ${dt} mag niet in ${p.naam}; overgeslagen.`);
      continue;
    }
    connectoren.push({ sleutel: String(c.sleutel || `${c.type}_${c.bron}_${c.doel}`), type: c.type, bron: c.bron, doel: c.doel, naam: String(c.naam || ""), data: {} });
  }
  return {
    plan: { elementen, connectoren },
    diagramNaam: String(antwoord?.diagramNaam || "").trim() || "Nieuw diagram",
    uitleg: String(antwoord?.uitleg || "").trim(),
    problemen,
  };
}

/** Velden-antwoord → nieuwe compartimenten voor het element (bestaande namen worden niet verdubbeld). */
export function veldenToepassing(antwoord, descriptor, element) {
  const comps = veldCompartimenten(descriptor, element.elementType);
  const problemen = [];
  if (!comps.length) return { compartimenten: null, nieuw: [], problemen: ["Dit element heeft geen compartiment voor velden."], uitleg: "" };
  const doel = comps.find((c) => c.id === antwoord?.compartiment) || comps[0];
  if (antwoord?.compartiment && antwoord.compartiment !== doel.id) problemen.push(`Compartiment "${antwoord.compartiment}" bestaat niet; ${doel.id} gebruikt.`);
  const oud = (element.compartimenten || []).find((c) => c.compartmentType === doel.id);
  const namen = new Set((oud?.velden || []).map((v) => String(v.naam).toLowerCase()));
  const nieuw = [];
  for (const v of Array.isArray(antwoord?.velden) ? antwoord.velden : []) {
    const naam = String(v?.naam || "").trim();
    if (!naam) continue;
    if (namen.has(naam.toLowerCase())) { problemen.push(`"${naam}" bestaat al; overgeslagen.`); continue; }
    namen.add(naam.toLowerCase());
    nieuw.push({ naam, fieldType: doel.fieldType, data: { ...(v.type ? { typeLabel: String(v.type).trim() } : {}), ...(v.verplicht ? { verplicht: true } : {}) } });
  }
  const compartimenten = (element.compartimenten || []).some((c) => c.compartmentType === doel.id)
    ? element.compartimenten.map((c) => (c.compartmentType === doel.id ? { ...c, velden: [...(c.velden || []), ...nieuw] } : c))
    : [...(element.compartimenten || []), { compartmentType: doel.id, velden: nieuw }];
  return { compartimenten, nieuw, compartiment: doel.id, problemen, uitleg: String(antwoord?.uitleg || "").trim() };
}
