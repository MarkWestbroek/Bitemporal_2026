// @ts-check
/**
 * vanCanoniek — het canonieke model (M1 in canoniek-uml) → SHACL-shapes (M1 in het shacl-
 * profiel). Een M2→M2-afbeelding; fase 3 van het plan "Linked data als M2" §12. Elk gemaakt
 * element krijgt een kruisverband "genereert" naar het canonieke element waar het uit komt.
 *
 *   entiteit E             → node shape die zelf de klasse is: `dom:E a sh:NodeShape, rdfs:Class`
 *                            (impliciet klassedoel, SHACL §2.1.3.1); rdfs:comment = beschrijving
 *   veld v : T             → regel `dom:v` met het datatype van T (zie typeVoor), facetten uit de
 *                            validatie van het gegevenstype, minCount 1 als verplicht, maxCount 1
 *   veld v : Enumeratie    → `sh:in ( "w1" "w2" … )` met xsd:string
 *   veld v : ref.lijstitem → `sh:class dom:Item`
 *   E ◆ GE (compositie)    → regel `dom:<rolnaam>` met `sh:node` naar de shape van het GE; het GE
 *                            is een eigen node shape (geen doel: alleen via sh:node, zoals een
 *                            MIM-gegevensgroep een lege knoop is)
 *   relatie E → F          → regel `dom:<naam>` met `sh:class dom:F`
 *   generalisatie E ▷ S    → rdfs:subClassOf (subklasse-connector)
 *   afgeleid veld          → niet: wordt berekend (melding)
 *
 * **Tijd.** De shapes beschrijven het **momentbeeld**: de geldige stand op één moment, zoals een
 * API of een export die laat zien. Daarom: `momentvoorkomen: enkelvoudig` → maxCount 1, en de
 * ondergrens uit de kardinaliteit (1..* → minCount 1). De tijdlijn zelf (formeel/materieel,
 * aanvang/einde) staat niet in de shapes; een historie-beeld is een latere optie.
 *
 * **IRI's.** Per domein (package) een namespace `<basisIri><domein>#` met de domeinnaam als
 * prefix; zonder domein `mdl:`. Klasse = entiteitnaam, eigenschap = veld- of rolnaam met een
 * kleine eerste letter. Namen zijn uniek per domein (Mark 31-10), dus de IRI's ook.
 *
 * Puur: getest in vanCanoniek.test.js met het aanvraag-domein van de inrichting.
 */
import { leidAf } from "./afleiding.js";
import { shaclRijenPosities } from "./index.js";

const isConnector = (el) => Boolean(el?.source && el?.target);
const klein = (naam) => String(naam || "").replace(/^./, (c) => c.toLowerCase());
const lokaal = (naam) => String(naam || "").replace(/[^A-Za-z0-9_.-]+/g, "_").replace(/\.+$/, "") || "_";
const sleutel = (id) => `can_${String(id).replace(/[^A-Za-z0-9_-]+/g, "_")}`;

/** basistype (+ formaat) → xsd-datatype. */
export function xsdVoor(basistype, format = "") {
  const f = String(format || "").toLowerCase();
  if (basistype === "date" || f === "date") return "xsd:date";
  if (basistype === "date-time" || f === "date-time") return "xsd:dateTime";
  if (f === "duration") return "xsd:duration";
  if (f === "uri" || f === "uri-https") return "xsd:anyURI";
  if (basistype === "integer") return "xsd:integer";
  if (basistype === "number") return "xsd:decimal";
  if (basistype === "boolean") return "xsd:boolean";
  return "xsd:string";
}

/** Kardinaliteit "0..*" / "1..1" → {min, max}. */
function grenzen(kard) {
  const k = String(kard || "").trim();
  if (/^\d+$/.test(k)) return { min: Number(k), max: Number(k) }; // "1" = 1..1
  const m = /^(\d+)\.\.(\d+|\*)$/.exec(k);
  return m ? { min: Number(m[1]), max: m[2] === "*" ? null : Number(m[2]) } : { min: 0, max: null };
}

/**
 * @param {{elements?: Record<string, any>}} canoniek - het canonieke model (of het deel uit een map)
 * @param {{basisIri?: string, titel?: string, gegevenstypen?: any[]}} [opties]
 * @returns {{elements: Record<string, any>, diagrams: Record<string, any>, kruisverbanden: {shaclId: string, canoniekId: string}[], meldingen: {niveau: string, elementId?: string, bericht: string}[]}}
 */
export function canoniekNaarShacl(canoniek, opties = {}) {
  const bron = canoniek?.elements || {};
  const alle = Object.values(bron);
  const basisIri = opties.basisIri || "https://omnium.example/model/";
  /** @type {{niveau: string, elementId?: string, bericht: string}[]} */
  const meldingen = [];
  const kruisverbanden = [];

  // ── Domeinen en prefixen ────────────────────────────────────────────────
  const domeinVan = (el) => {
    if (el?.data?.domein) return el.data.domein;
    const pkg = alle.find((c) => c.elementType === "bevat" && c.target === el.id);
    return pkg ? bron[pkg.source]?.naam : "";
  };
  /** @type {Record<string, string>} */
  const prefixen = {
    sh: "http://www.w3.org/ns/shacl#",
    rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
    rdfs: "http://www.w3.org/2000/01/rdf-schema#",
    xsd: "http://www.w3.org/2001/XMLSchema#",
    owl: "http://www.w3.org/2002/07/owl#",
    dct: "http://purl.org/dc/terms/",
  };
  const prefixVan = (domein) => {
    const p = /^[A-Za-z_][\w-]*$/.test(domein || "") && !(domein in prefixen && prefixen[domein] !== `${basisIri}${domein}#`) ? domein : domein ? `d_${lokaal(domein)}` : "mdl";
    prefixen[p] ??= `${basisIri}${domein ? `${encodeURIComponent(domein)}#` : "#"}`;
    return p;
  };
  const iri = (el, naam = el.naam) => `${prefixVan(domeinVan(el))}:${lokaal(naam)}`;

  // ── Typen ───────────────────────────────────────────────────────────────
  const perNaam = (soort) => new Map(alle.filter((el) => el.elementType === soort && el.naam).map((el) => [el.naam, el]));
  const enums = perNaam("enumeratie");
  const eigenTypen = perNaam("gegevenstype");
  // De gedeelde catalogus (transformatie/gegevenstypen.snapshot.json) geeft de aanroeper mee,
  // zoals bij de inrichtingsexport; een eigen gegevenstype in het model gaat voor.
  const catalogus = new Map((opties.gegevenstypen || []).map((t) => [t.naam, t]));
  const refItems = new Map(alle.filter((el) => el.elementType === "entiteit" && el.data?.entiteitSubtype === "referentielijst_item" && el.naam).map((el) => [el.naam, el]));
  const onbekend = new Set();

  /** Het type van een veld → regelparameters (datatype, facetten, sh:in of sh:class). */
  const typeVoor = (typeLabel, plek, elementId) => {
    const t = String(typeLabel || "").trim();
    if (!t) return { datatype: "xsd:string" };
    if (["string", "integer", "number", "boolean", "date", "date-time"].includes(t)) return { datatype: xsdVoor(t) };
    const en = enums.get(t);
    if (en) {
      const waarden = (en.compartimenten || []).flatMap((c) => c.velden || []).map((v) => v.naam).filter(Boolean);
      return { datatype: "xsd:string", in: `( ${waarden.map((w) => JSON.stringify(String(w))).join(" ")} )` };
    }
    const ref = refItems.get(t);
    if (ref) return { klasse: iri(ref) };
    const eigen = eigenTypen.get(t);
    const def = eigen
      ? {
          basistype: (eigen.compartimenten || []).flatMap((c) => c.velden || []).find((v) => v.naam === "basistype")?.data?.typeLabel || eigen.data?.bron?.basistype,
          format: eigen.data?.bron?.format,
          validatie: eigen.data?.validatie || eigen.data?.bron?.validatie || {},
        }
      : catalogus.get(t);
    if (!def) {
      if (!onbekend.has(t)) meldingen.push({ niveau: "waarschuwing", elementId, bericht: `${plek}: type "${t}" is onbekend (geen gegevenstype, enumeratie of ref.lijstitem); xsd:string gebruikt.` });
      onbekend.add(t);
      return { datatype: "xsd:string" };
    }
    const v = def.validatie || {};
    const uit = { datatype: xsdVoor(def.basistype, def.format) };
    if (v.pattern) uit.pattern = v.pattern;
    if (v.minLength !== undefined) uit.minLength = v.minLength;
    if (v.maxLength !== undefined) uit.maxLength = v.maxLength;
    if (v.minimum !== undefined) uit.minInclusive = String(v.minimum);
    if (v.maximum !== undefined) uit.maxInclusive = String(v.maximum);
    return uit;
  };

  // ── Elementen ───────────────────────────────────────────────────────────
  /** @type {Record<string, any>} */
  const elements = {};
  const shapeVan = new Map(); // canoniek id → shacl id
  const velden = (el, soort = "velden") => (el.compartimenten || []).filter((c) => c.compartmentType === soort).flatMap((c) => c.velden || []);
  let afgeleid = 0;
  let uniek = 0;

  const veldRegel = (el, v) => {
    const d = v.data || {};
    const plek = `${el.naam}.${v.naam}`;
    if (d.uniek) uniek += 1;
    return {
      naam: `${prefixVan(domeinVan(el))}:${lokaal(klein(v.naam))}`,
      fieldType: "eigenschap",
      data: {
        ...typeVoor(d.typeLabel, plek, sleutel(el.id)),
        ...(d.verplicht ? { minCount: 1 } : {}),
        maxCount: 1,
        ...(d.beschrijving ? { beschrijving: d.beschrijving } : {}),
        label: v.naam,
      },
    };
  };
  const afgeleideVelden = (el) => {
    const n = velden(el, "afgeleid").length;
    afgeleid += n;
  };

  const maakShape = (el, { klasse }) => {
    const id = sleutel(el.id);
    shapeVan.set(el.id, id);
    const data = { iri: iri(el, klasse ? el.naam : el.data?.typenaam || el.naam), getypeerd: true, naamLabel: true };
    if (klasse) Object.assign(data, { ookKlasse: true, klasseType: "rdfs:Class" });
    if (el.data?.beschrijving || el.data?.bron?.description) data.beschrijving = el.data.beschrijving || el.data.bron.description;
    elements[id] = { id, naam: el.naam, elementType: "nodeshape", compartimenten: [], data };
    kruisverbanden.push({ shaclId: id, canoniekId: el.id });
    return elements[id];
  };

  // Entiteiten en gegevenselementen eerst, zodat de verwijzingen een doel hebben.
  for (const el of alle) {
    if (isConnector(el)) continue;
    if (el.elementType === "entiteit") maakShape(el, { klasse: true });
    else if (el.elementType === "gegevenselement") maakShape(el, { klasse: false });
  }
  for (const el of alle) {
    if (isConnector(el) || !shapeVan.has(el.id)) continue;
    const shape = elements[shapeVan.get(el.id)];
    const regels = velden(el).filter((v) => v.naam).map((v) => veldRegel(el, v));
    afgeleideVelden(el);
    // Composities: het GE als sh:node.
    for (const c of alle.filter((c) => c.elementType === "compositie" && c.source === el.id)) {
      const ge = bron[c.target];
      if (!ge || !shapeVan.has(ge.id)) continue;
      const d = c.data || {};
      const { min } = grenzen(d.kardinaliteit);
      const rol = d.rolnaam || ge.naam;
      regels.push({
        naam: `${prefixVan(domeinVan(el))}:${lokaal(klein(rol))}`,
        fieldType: "eigenschap",
        data: {
          node: elements[shapeVan.get(ge.id)].data.iri,
          ...(min > 0 ? { minCount: min } : {}),
          ...(d.momentvoorkomen === "enkelvoudig" ? { maxCount: 1 } : {}),
          label: rol,
        },
      });
    }
    // Relaties: sh:class naar de doel-entiteit.
    for (const r of alle.filter((c) => c.elementType === "relatie" && c.source === el.id)) {
      const doel = bron[r.target];
      if (!doel || !shapeVan.has(doel.id)) continue;
      const d = r.data || {};
      const { min, max } = grenzen(d.doelKardinaliteit);
      const naam = d.naamLabelHeen && /^[\wÀ-ɏ ]+$/.test(d.naamLabelHeen) ? d.naamLabelHeen.replace(/ (.)/g, (_, c) => c.toUpperCase()) : r.naam;
      regels.push({
        naam: `${prefixVan(domeinVan(el))}:${lokaal(klein(naam))}`,
        fieldType: "eigenschap",
        data: {
          klasse: elements[shapeVan.get(doel.id)].data.iri,
          ...(min > 0 ? { minCount: min } : {}),
          ...(max !== null ? { maxCount: max } : {}),
          ...(d.beschrijving || d.bron?.description ? { beschrijving: d.beschrijving || d.bron.description } : {}),
          label: r.naam,
        },
      });
      kruisverbanden.push({ shaclId: shape.id, canoniekId: r.id });
      if (velden(r).length) {
        meldingen.push({ niveau: "info", elementId: shape.id, bericht: `Relatie ${r.naam}: de velden van de relatie (associatieklasse) staan niet in de shapes; alleen de verwijzing.` });
      }
    }
    if (regels.length) shape.compartimenten = [{ compartmentType: "eigenschappen", velden: regels }];
  }
  // Generalisaties.
  for (const g of alle.filter((c) => c.elementType === "generalisatie")) {
    const van = shapeVan.get(g.source);
    const naar = shapeVan.get(g.target);
    if (!van || !naar) continue;
    const id = `subklasse__${van}__${naar}`;
    elements[id] = { id, naam: "", elementType: "subklasse", source: van, target: naar, compartimenten: [], data: {} };
  }
  if (afgeleid) meldingen.push({ niveau: "info", bericht: `${afgeleid} afgeleid(e) veld(en) niet opgenomen: die worden berekend, niet vastgelegd.` });
  if (uniek) meldingen.push({ niveau: "info", bericht: `${uniek} veld(en) met {uniek}: SHACL core heeft geen uniciteit over knopen; niet opgenomen (kan later als sh:sparql).` });
  if (!shapeVan.size) meldingen.push({ niveau: "waarschuwing", bericht: "Geen entiteiten of gegevenselementen gevonden; er zijn geen shapes gemaakt." });

  // Shapes graph: titel en prefixen (alleen de gebruikte domeinen).
  const gebruikt = new Set(Object.values(elements).flatMap((el) => [el.data?.iri, ...(el.compartimenten || []).flatMap((c) => c.velden.map((v) => v.naam))]).filter(Boolean).map((x) => String(x).split(":")[0]));
  const graafPrefix = [...gebruikt].find((p) => !(p in { sh: 1, rdf: 1, rdfs: 1, xsd: 1, owl: 1, dct: 1 })) || "mdl";
  prefixen[graafPrefix] ??= `${basisIri}#`;
  elements.shapesgraaf = {
    id: "shapesgraaf",
    naam: opties.titel || "Shapes uit het canonieke model",
    elementType: "shapesgraaf",
    compartimenten: [],
    data: {
      iri: `${graafPrefix}:`,
      titel: opties.titel || "Shapes uit het canonieke model",
      titelPredicaat: "dct:title",
      beschrijving: "Gegenereerd uit het canonieke model door Omnium Studio (canoniek → SHACL). Momentbeeld: de geldige stand op één moment.",
      beschrijvingPredicaat: "dct:description",
      prefixen: Object.entries(prefixen)
        .map(([p, ns]) => `${p}: <${ns}>`)
        .join("\n"),
    },
  };

  const afgeleidModel = leidAf(elements) || elements;
  const knopen = Object.values(afgeleidModel).filter((el) => !isConnector(el));
  const edges = Object.values(afgeleidModel).filter(isConnector).map((el) => ({ source: el.source, target: el.target }));
  const posities = shaclRijenPosities({ ids: knopen.map((el) => el.id), elements: afgeleidModel, edges });
  return {
    elements: afgeleidModel,
    diagrams: {
      uit_canoniek: { id: "uit_canoniek", naam: opties.titel || "Shapes uit het canonieke model", nodes: knopen.map((el) => ({ elementId: el.id, position: posities[el.id] })), edges: [] },
    },
    kruisverbanden,
    meldingen,
  };
}

const veilig = (s) => String(s || "").replace(/[^A-Za-z0-9_-]+/g, "_");

/**
 * Het resultaat van canoniekNaarShacl in de SHACL-store zetten (bijwerken als het er al is).
 * Puur genoeg om te testen met een nep-store: krijgt de huidige staat, geeft de nieuwe.
 *
 * @param {{elements: Record<string, any>, diagrams: Record<string, any>}} staat - SHACL-store
 * @param {ReturnType<typeof canoniekNaarShacl>} uit
 * @param {string} mapId - de bronmap
 */
export function voegShapesIn(staat, uit, mapId) {
  const voor = `cs_${veilig(mapId)}_`;
  const her = (id) => `${voor}${id}`;
  const nieuw = {};
  for (const [id, el] of Object.entries(uit.elements)) {
    if (el.elementType === "verwijzing") continue; // afgeleid; leidAf hieronder
    const kopie = { ...el, id: her(id), data: { ...(el.data || {}), uitCanoniek: mapId } };
    if (el.source) Object.assign(kopie, { source: her(el.source), target: her(el.target) });
    nieuw[kopie.id] = kopie;
  }
  const oud = Object.values(staat.elements || {}).filter((el) => el.data?.uitCanoniek === mapId).map((el) => el.id);
  const elements = Object.fromEntries(Object.entries(staat.elements || {}).filter(([id, el]) => !(el.data?.uitCanoniek === mapId) && !(el.elementType === "verwijzing" && oud.some((o) => el.source === o))));
  Object.assign(elements, nieuw);
  const afgeleid = leidAf(elements) || elements;

  const diagramId = `${voor}diagram`;
  const bestaand = staat.diagrams?.[diagramId];
  const bron = Object.values(uit.diagrams)[0];
  const posities = new Map((bestaand?.nodes || []).map((n) => [n.elementId, n]));
  const nodes = (bron?.nodes || []).map((n) => posities.get(her(n.elementId)) || { ...n, elementId: her(n.elementId) });
  const diagrams = { ...(staat.diagrams || {}), [diagramId]: { ...(bestaand || {}), id: diagramId, naam: bron?.naam || "Shapes uit het canonieke model", nodes, edges: bestaand?.edges || [] } };
  const weg = oud.filter((id) => !afgeleid[id]);
  return { elements: afgeleid, diagrams, diagramId, weg, her };
}
