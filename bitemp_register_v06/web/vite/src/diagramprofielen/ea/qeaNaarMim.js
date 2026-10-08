// @ts-check
/**
 * qeaNaarMim — lezer: EA-model met het MIM-profiel (MIM 1.x / MIG) → het
 * mim12-profiel. De regelset uit onderzoek §6.8: de lezer gooit niets weg;
 * de MIM-standaardmetagegevens (tagged values met spaties en hoofdletters,
 * zoals EA ze schrijft) worden de getypeerde properties van mim12, de rest
 * blijft in `data.tags`. Stereotypen `MIM::`, `MIG::` en kaal (`Objecttype`)
 * worden hetzelfde behandeld.
 */
import { kleurUitBgr, idUitGuid, kardinaliteitUitGrenzen, deelboomPakketten, EA_SCHAAL } from "./qeaHulp.js";
import { maakHulptabellen, maakVerslag, sla, extraData, maakConnectorElement, maakBevat, bouwDiagram } from "./qeaKern.js";

export const MIM_DIAGRAMTYPE = "mim12";

/** Stereotype (zonder profielvoorvoegsel, kleine letters) → mim12-elementtype. */
const STEREOTYPE_NAAR_TYPE = {
  objecttype: "objecttype",
  gegevensgroeptype: "gegevensgroeptype",
  enumeratie: "enumeratie",
  codelijst: "codelijst",
  referentielijst: "referentielijst",
  "primitief datatype": "primitiefDatatype",
  primitiefdatatype: "primitiefDatatype",
  "gestructureerd datatype": "gestructureerdDatatype",
  gestructureerddatatype: "gestructureerdDatatype",
  "complex datatype": "gestructureerdDatatype",
  keuze: "keuze",
  union: "keuze",
  constraint: "constraint",
};
/** Package-stereotypen → `data.soort`. */
const PACKAGE_SOORT = { domein: "domein", informatiemodel: "informatiemodel", extern: "extern", view: "view" };

/** EA-tagnaam (genormaliseerd) → mim12 property-key, voor elementen. */
const ELEMENT_TAGS = {
  alias: "alias",
  begrip: "begrip",
  definitie: "definitie",
  toelichting: "toelichting",
  herkomst: "herkomst",
  "datum opname": "datumOpname",
  "herkomst definitie": "herkomstDefinitie",
  "unieke aanduiding": "uniekeAanduiding",
  populatie: "populatie",
  kwaliteit: "kwaliteit",
  kwaliteitsbegrip: "kwaliteit",
  "indicatie abstract object": "indicatieAbstract",
  "indicatie abstract": "indicatieAbstract",
  "mim versie": "mimVersie",
  relatiemodelleringstype: "relatiemodelleringstype",
};
/** Idem voor attribuutsoorten (en relatiesoorten waar van toepassing). */
const ATTRIBUUT_TAGS = {
  definitie: "definitie",
  toelichting: "toelichting",
  herkomst: "herkomst",
  "datum opname": "datumOpname",
  "herkomst definitie": "herkomstDefinitie",
  "indicatie authentiek": "authentiek",
  authentiek: "authentiek",
  "indicatie materiele historie": "indicatieMaterieleHistorie",
  "indicatie formele historie": "indicatieFormeleHistorie",
  "mogelijk geen waarde": "mogelijkGeenWaarde",
  "indicatie afleidbaar": "indicatieAfleidbaar",
  "indicatie identificerend": "identificerend",
  identificerend: "identificerend",
  patroon: "patroon",
  "formeel patroon": "formeelPatroon",
  regels: "regels",
  lengte: "lengte",
};
const BOOLEAN_KEYS = new Set(["indicatieMaterieleHistorie", "indicatieFormeleHistorie", "mogelijkGeenWaarde", "indicatieAfleidbaar", "identificerend", "indicatieAbstract"]);

/**
 * @param {import("./qeaKern.js").QeaBron} bron
 * @param {{packageId:number, diagramTypeId?:string, schaal?:number}} opties
 */
export function qeaNaarMim(bron, { packageId, diagramTypeId = MIM_DIAGRAMTYPE, schaal = EA_SCHAAL , diagramFilter = null}) {
  const pakketIds = new Set(deelboomPakketten(bron.t_package || [], packageId));
  const verslag = maakVerslag();
  const h = maakHulptabellen(bron, schaal);

  /** @type {Record<string, any>} */
  const elements = {};
  const idVanObject = new Map();
  const idVanPakket = new Map();

  // Packages → mim12 `package` met soort uit het stereotype van het package-object.
  const pakketObjecten = new Map((bron.t_object || []).filter((o) => o.Object_Type === "Package").map((o) => [Number(o.PDATA1), o]));
  const pakketten = (bron.t_package || []).filter((p) => pakketIds.has(p.Package_ID));
  for (const p of pakketten) {
    const id = idUitGuid(p.ea_guid);
    idVanPakket.set(p.Package_ID, id);
    const obj = pakketObjecten.get(p.Package_ID);
    const st = obj ? (h.stereoPerGuid.get(obj.ea_guid) || []).map(kaalStereotype) : [];
    const soort = st.map((s) => PACKAGE_SOORT[s]).find(Boolean) || "domein";
    elements[id] = {
      id,
      naam: p.Name || "",
      elementType: "package",
      compartimenten: [],
      data: { eaGuid: p.ea_guid, soort, ...(p.Notes ? { definitie: p.Notes } : {}), ...(st.length ? { stereotypen: st } : {}) },
    };
    verslag.elementen += 1;
  }
  for (const p of pakketten) {
    const ouder = idVanPakket.get(p.Parent_ID);
    if (ouder) maakBevat(elements, ouder, idVanPakket.get(p.Package_ID));
  }
  // Een package staat ook op diagrammen — via zijn t_object (type Package,
  // PDATA1 = Package_ID). Koppel dat object aan het package-element.
  for (const o of bron.t_object || []) {
    if (o.Object_Type !== "Package") continue;
    const id = idVanPakket.get(Number(o.PDATA1));
    if (id) idVanObject.set(o.Object_ID, id);
  }

  // Elementen
  for (const o of bron.t_object || []) {
    if (o.Object_Type === "Package") continue;
    const stereotypen = (h.stereoPerGuid.get(o.ea_guid) || []).map(kaalStereotype);
    const elementType = elementTypeVoor(o, stereotypen);
    if (!elementType) {
      sla(verslag, o.Object_Type);
      continue;
    }
    const id = idUitGuid(o.ea_guid);
    idVanObject.set(o.Object_ID, id);
    const { eigenschappen, rest } = verdeelTags(h.tagsPerObject.get(o.Object_ID), ELEMENT_TAGS);
    const data = {
      ...extraData(h, o.ea_guid, o.Object_ID),
      eaPakket: o.Package_ID,
      ...(Object.keys(rest).length ? { tags: rest } : {}),
      ...(o.Alias ? { alias: o.Alias } : {}),
      ...(o.Note && elementType !== "notitie" ? { definitie: o.Note } : {}),
      ...eigenschappen,
      ...(String(o.Abstract) === "1" ? { indicatieAbstract: true } : {}),
    };
    if (!Object.keys(rest).length) delete data.tags;
    const kleur = kleurUitBgr(o.Backcolor);
    if (kleur) data.kleur = kleur;
    const element = { id, naam: elementType === "notitie" ? "" : o.Name || "", elementType, compartimenten: [], data };
    if (elementType === "notitie") element.data.tekst = o.Note || o.Name || "";
    else if (elementType === "constraint") element.data.specificatie = o.Note || "";
    else element.compartimenten = compartimentenVoor(o, elementType, h);
    elements[id] = element;
    verslag.elementen += 1;
    const pakket = idVanPakket.get(o.Package_ID);
    if (pakket) maakBevat(elements, pakket, id);
  }

  // Connectoren
  const idVanConnector = new Map();
  for (const c of bron.t_connector || []) {
    const bronId = idVanObject.get(c.Start_Object_ID);
    const doelId = idVanObject.get(c.End_Object_ID);
    if (!bronId || !doelId) {
      if (c.Connector_Type !== "NoteLink") sla(verslag, `connector buiten bereik (${c.Connector_Type})`);
      continue;
    }
    const vertaald = vertaalConnector(c, bronId, doelId, elements, h);
    if (!vertaald) {
      sla(verslag, `connector ${c.Connector_Type}`);
      continue;
    }
    const el = maakConnectorElement(h, c, vertaald);
    idVanConnector.set(c.Connector_ID, el.id);
    elements[el.id] = el;
    verslag.connectoren += 1;
  }

  /** @type {Record<string, any>} */
  const diagrams = {};
  // diagramFilter (optioneel): bv. de project-import houdt hier de
  // activity-/use case-diagrammen buiten, die hebben hun eigen lezer.
  for (const d of (bron.t_diagram || []).filter((d) => pakketIds.has(d.Package_ID) && (!diagramFilter || diagramFilter(d)))) {
    const diagram = bouwDiagram(h, d, { idVanObject, idVanConnector, diagramTypeId, elements });
    diagrams[diagram.id] = diagram;
    verslag.diagrammen += 1;
  }
  return { diagramTypeId, elements, diagrams, verslag };
}

// ── Hulpfuncties ────────────────────────────────────────────────────────

/** "MIM::Objecttype" → "objecttype"; "MIG::Referentie element" → "referentie element". */
function kaalStereotype(fq) {
  return String(fq || "").split("::").pop().trim().toLowerCase();
}

function elementTypeVoor(o, stereotypen) {
  for (const st of stereotypen) if (STEREOTYPE_NAAR_TYPE[st]) return STEREOTYPE_NAAR_TYPE[st];
  switch (o.Object_Type) {
    case "Class":
      return "objecttype"; // zonder MIM-stereotype: de veiligste aanname (vgl. XMI-adapter)
    case "Enumeration":
      return "enumeratie";
    case "DataType":
    case "PrimitiveType":
      return "primitiefDatatype";
    case "Note":
    case "Text":
      return "notitie";
    case "Boundary":
      return "boundary";
    case "Constraint":
      return "constraint";
    default:
      return null;
  }
}

/**
 * Tagged values splitsen in getypeerde properties (via de naamtabel) en de
 * rest. Tagnamen worden genormaliseerd (trim, kleine letters); EA's `<memo>`
 * is al door de hulptabellen vervangen door de NOTES-inhoud.
 */
/**
 * EA/MIM-tagnaam → sleutel in de naamtabel: kleine letters, dubbele spaties
 * weg, "materiële" = "materiele", en de metaklasse-suffix eraf die het oude
 * MIM-MDG eraan plakt ("Datum opname attribuutsoort", "Toelichting relatiesoort").
 */
const METAKLASSE_SUFFIX = /\s+(attribuutsoort|relatiesoort|objecttype|gegevensgroeptype|gegevensgroep|datatype|enumeratie|referentielijst|codelijst|waarde|element|relatierol)$/;
export function normaliseerTagnaam(naam) {
  return String(naam || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/ë/g, "e")
    .replace(METAKLASSE_SUFFIX, "");
}

function verdeelTags(tags, tabel) {
  const eigenschappen = {};
  const rest = {};
  /** Sleutels die door een MIM-tag mét metaklasse-suffix zijn gezet: die winnen van een kale naamgenoot (bv. GEMMA's "herkomst"). */
  const metSuffix = new Set();
  for (const [naam, waarde] of Object.entries(tags || {})) {
    const genorm = normaliseerTagnaam(naam);
    const sleutel = tabel[genorm];
    const w = Array.isArray(waarde) ? waarde[waarde.length - 1] : waarde;
    if (!sleutel) {
      rest[naam] = waarde;
      continue;
    }
    if (w == null || w === "") continue;
    const hadSuffix = METAKLASSE_SUFFIX.test(String(naam).trim().toLowerCase().replace(/\s+/g, " "));
    if (sleutel in eigenschappen && metSuffix.has(sleutel) && !hadSuffix) continue;
    eigenschappen[sleutel] = BOOLEAN_KEYS.has(sleutel) ? naarBoolean(w) : String(w);
    if (hadSuffix) metSuffix.add(sleutel);
  }
  return { eigenschappen, rest };
}

function naarBoolean(w) {
  const s = String(w).trim().toLowerCase();
  if (["ja", "j", "true", "1", "yes", "y"].includes(s)) return true;
  if (["nee", "n", "false", "0", "no"].includes(s)) return false;
  return String(w);
}

function compartimentenVoor(o, elementType, h) {
  const attrs = h.attrsPerObject.get(o.Object_ID) || [];
  if (!attrs.length) return [];
  if (elementType === "enumeratie" || elementType === "codelijst") {
    return [{
      compartmentType: "waarden",
      velden: attrs.map((a) => ({
        naam: a.Name || "",
        fieldType: "waarde",
        data: { ...(a.Default ? { typeLabel: String(a.Default) } : {}), ...(a.Notes ? { definitie: a.Notes } : {}), eaGuid: a.ea_guid },
      })),
    }];
  }
  if (elementType === "referentielijst") {
    return [{
      compartmentType: "elementen",
      velden: attrs.map((a) => ({ naam: a.Name || "", fieldType: "referentieElement", data: { ...(a.Type ? { typeLabel: a.Type } : {}), eaGuid: a.ea_guid } })),
    }];
  }
  const compartmentType = elementType === "gestructureerdDatatype" ? "dataElementen" : "attribuutsoorten";
  const fieldType = elementType === "gestructureerdDatatype" ? "dataElement" : "attribuutsoort";
  return [{
    compartmentType,
    velden: attrs.map((a) => {
      const { eigenschappen, rest } = verdeelTags(h.tagsPerAttribuut.get(a.ID), ATTRIBUUT_TAGS);
      const kard = kardinaliteitUitGrenzen(a.LowerBound, a.UpperBound);
      return {
        naam: a.Name || "",
        fieldType,
        data: {
          eaGuid: a.ea_guid,
          ...(a.Type ? { typeLabel: a.Type } : {}),
          ...(kard ? { kardinaliteit: kard } : {}),
          ...(a.Notes ? { definitie: a.Notes } : {}),
          ...eigenschappen,
          ...(a.Stereotype && !/^attribuutsoort$/i.test(a.Stereotype) ? { stereotypen: [a.Stereotype] } : {}),
          ...(Object.keys(rest).length ? { tags: rest } : {}),
        },
      };
    }),
  }];
}

function vertaalConnector(c, bronId, doelId, elements, h) {
  const bron = elements[bronId]?.elementType, doel = elements[doelId]?.elementType;
  const stereotypen = (h.stereoPerGuid.get(c.ea_guid) || []).map(kaalStereotype);
  const st = stereotypen[0] || kaalStereotype(c.Stereotype);
  const { eigenschappen, rest } = verdeelTags(h.tagsPerConnector.get(c.Connector_ID), ATTRIBUUT_TAGS);
  const extra = { ...eigenschappen, ...(Object.keys(rest).length ? { tags: rest } : {}) };
  switch (c.Connector_Type) {
    case "Association":
    case "Aggregation": {
      if (st === "gegevensgroep" || doel === "gegevensgroeptype") {
        return { elementType: "gegevensgroep", naam: c.Name || c.DestRole || "", source: bronId, target: doelId, data: { ...(c.DestCard ? { kardinaliteit: c.DestCard } : {}), ...extra } };
      }
      if (st === "externe koppeling") {
        return { elementType: "externeKoppeling", naam: c.Name || "", source: bronId, target: doelId, data: extra };
      }
      if (bron !== "objecttype" || doel !== "objecttype") return null;
      return {
        elementType: "relatiesoort",
        naam: c.Name || "",
        source: bronId,
        target: doelId,
        data: {
          ...(c.SourceRole ? { bronRolNaam: c.SourceRole } : {}),
          ...(c.DestRole ? { doelRolNaam: c.DestRole } : {}),
          ...(c.SourceCard ? { bronKardinaliteit: c.SourceCard } : {}),
          ...(c.DestCard ? { doelKardinaliteit: c.DestCard } : {}),
          ...(c.Direction === "Source -> Destination" ? { unidirectioneel: true } : {}),
          ...(c.Connector_Type === "Aggregation" ? { eaConnectorType: "Aggregation" } : {}),
          ...extra,
        },
      };
    }
    case "Generalization":
      return { elementType: "generalisatie", naam: "", source: bronId, target: doelId, data: extra };
    case "Dependency":
      if (st === "externe koppeling") return { elementType: "externeKoppeling", naam: c.Name || "", source: bronId, target: doelId, data: extra };
      return null;
    case "NoteLink": {
      const bronIsNotitie = bron === "notitie";
      if (bronIsNotitie === (doel === "notitie")) return null;
      return { elementType: "notitielijn", naam: "", source: bronIsNotitie ? bronId : doelId, target: bronIsNotitie ? doelId : bronId, data: {}, omgedraaid: !bronIsNotitie };
    }
    default:
      return null;
  }
}
