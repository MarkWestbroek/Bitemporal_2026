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
 * **Rondgang.** Komt het model uit SHACL (naarCanoniek), dan draagt elk onderdeel zijn herkomst
 * (`data.shacl`, zie herkomst.js). Wat in het canonieke model niet is gewijzigd, gaat letterlijk
 * terug: dezelfde node shapes (met sh:targetClass), property shapes, klassen, constraints en
 * shapes graph, dus SHACL → canoniek → SHACL geeft dezelfde graaf. Wat wel is gewijzigd of nieuw
 * is, wordt opnieuw afgeleid, in de namespace van de entiteit (odrl:) en naar de klasse-IRI.
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
import { lokaleNaam } from "./naarCanoniek.js";
import { leesPrefixen } from "./schrijver.js";
import { afdrukVeld, afdrukRelatie, afdrukCompositie, afdrukGeneralisatie, afdrukConstraint, afdrukEnumeratie, kopie } from "./herkomst.js";

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
  const H = (x) => x?.data?.shacl;
  // Uit SHACL: de shapes graph van toen; nieuwe elementen krijgen zijn namespace (ok:).
  const graafH = alle.map((el) => (el.elementType === "entiteit" || el.elementType === "gegevenselement" ? H(el)?.graaf : null)).find(Boolean);
  const graafPrefixen = graafH ? leesPrefixen(graafH.data?.prefixen) : {};
  const standaardPrefix = graafH && !opties.basisIri ? /^([A-Za-z_][\w.-]*)?:$/.exec(graafH.data?.iri || "")?.[1] || null : null;

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
  if (standaardPrefix && graafPrefixen[standaardPrefix]) prefixen[standaardPrefix] = graafPrefixen[standaardPrefix];
  const prefixVan = (domein) => {
    if (!domein && standaardPrefix && prefixen[standaardPrefix]) return standaardPrefix;
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
    if (t === "URL" && !eigenTypen.has(t) && !catalogus.has(t)) return { nodeKind: "IRI" };
    const en = enums.get(t);
    if (en) {
      const waarden = (en.compartimenten || []).flatMap((c) => c.velden || []).map((v) => v.naam).filter(Boolean);
      // Uit SHACL kan een waarde een IRI zijn (odrl:perm): de oorspronkelijke term.
      const termen = H(en)?.termen || {};
      const lijst = waarden.map((w) => termen[w] || JSON.stringify(String(w)));
      return { ...(lijst.every((x) => x.startsWith('"')) ? { datatype: "xsd:string" } : {}), in: `( ${lijst.join(" ")} )` };
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
  const shapeVan = new Map(); // canoniek id → shacl id van de knoop (shape of klasse)
  const eigenShapeVan = new Map(); // canoniek id → shacl id van de shape die nieuwe regels krijgt
  const velden = (el, soort = "velden") => (el?.compartimenten || []).filter((c) => c.compartmentType === soort).flatMap((c) => c.velden || []);
  let afgeleid = 0;
  let uniek = 0;
  /** shacl-shape-id → [{nr, regel}]: de regels per shape, in de oorspronkelijke volgorde */
  const regelsVoor = new Map();
  let volgNieuw = 1e6;
  const zetRegel = (shapeId, nr, regel) => {
    if (!regelsVoor.has(shapeId)) regelsVoor.set(shapeId, []);
    regelsVoor.get(shapeId).push({ nr, regel });
  };

  // Prefix voor paden van een entiteit: die van haar IRI als ze uit SHACL komt (odrl:), anders het domein.
  const eigenPrefix = (el) => {
    const p = H(el) ? /^([A-Za-z_][\w.-]*):/.exec(String(el.data?.iri || ""))?.[1] : null;
    return p && p !== "shape" ? p : prefixVan(domeinVan(el));
  };
  /** De klasse-IRI van een entiteit (odrl:Constraint), anders die van haar shape (shape = klasse). */
  const klasseIri = (el) => (H(el) && el.data?.iri && !String(el.data.iri).startsWith("shape:") ? el.data.iri : elements[shapeVan.get(el?.id)]?.data?.iri);
  /** Het pad van een veld of rol: het oorspronkelijke als de naam nog klopt, anders een nieuw, in
   * de eigen namespace (ok:, niet odrl:: een nieuwe term hoort niet in een vreemde vocabulaire). */
  const padVoor = (el, naam, oud) => (oud && lokaleNaam(oud) === naam ? oud : `${standaardPrefix || eigenPrefix(el)}:${lokaal(klein(naam))}`);
  /** Bij opnieuw afleiden: wat het CM niet uitdrukt, blijft (volgorde, ernst, uitgeschakeld). */
  const behoud = (h) => {
    const d = h?.regels?.[0]?.data || {};
    return Object.fromEntries(["order", "severity", "gedeactiveerd"].filter((k) => d[k] !== undefined).map((k) => [k, d[k]]));
  };
  /** De beschrijving, tenzij het de oude sh:message is (die past niet meer bij een gewijzigde regel). */
  const eigenBeschrijving = (d, h) => (h && d?.beschrijving === h.beschrijving ? undefined : d?.beschrijving);
  const enumGewijzigd = (typeLabel) => {
    const en = enums.get(String(typeLabel || "").trim());
    return Boolean(en && H(en)?.afdruk && H(en).afdruk !== afdrukEnumeratie(en));
  };

  const veldRegel = (el, v) => {
    const d = v.data || {};
    const besch = eigenBeschrijving(d, d.shacl);
    const plek = `${el.naam}.${v.naam}`;
    if (d.uniek) uniek += 1;
    return {
      naam: padVoor(el, v.naam, d.pad),
      fieldType: "eigenschap",
      data: {
        ...typeVoor(d.typeLabel, plek, sleutel(el.id)),
        ...(d.verplicht ? { minCount: 1 } : {}),
        maxCount: 1,
        ...(besch ? { beschrijving: besch } : {}),
        ...behoud(d.shacl),
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
    eigenShapeVan.set(el.id, id);
    const data = { iri: iri(el, klasse ? el.naam : el.data?.typenaam || el.naam), getypeerd: true, naamLabel: true };
    if (klasse) Object.assign(data, { ookKlasse: true, klasseType: "rdfs:Class" });
    if (el.data?.beschrijving || el.data?.bron?.description) data.beschrijving = el.data.beschrijving || el.data.bron.description;
    elements[id] = { id, naam: el.naam, elementType: "nodeshape", compartimenten: [], data };
    kruisverbanden.push({ shaclId: id, canoniekId: el.id });
    return elements[id];
  };
  /** Knopen voor een entiteit of GE: de oorspronkelijke shapes en klasse, of een nieuwe shape. */
  const maakKnopen = (el) => {
    const h = H(el);
    if (!h?.shapes?.length && !h?.klasse) return maakShape(el, { klasse: el.elementType === "entiteit" });
    for (const s of h.shapes || []) {
      elements[s.id] = { id: s.id, naam: s.naam, elementType: "nodeshape", compartimenten: kopie(s.compartimenten || []), data: kopie(s.data || {}) };
      kruisverbanden.push({ shaclId: s.id, canoniekId: el.id });
    }
    if (h.klasse) {
      elements[h.klasse.id] = { id: h.klasse.id, naam: h.klasse.naam, elementType: "klasse", compartimenten: [], data: kopie(h.klasse.data || {}) };
      kruisverbanden.push({ shaclId: h.klasse.id, canoniekId: el.id });
    }
    shapeVan.set(el.id, h.shapes?.[0]?.id || h.klasse.id);
    if (h.shapes?.[0]) eigenShapeVan.set(el.id, h.shapes[0].id);
    if (h.naam && h.naam !== el.naam) meldingen.push({ niveau: "info", elementId: shapeVan.get(el.id), bericht: `${h.naam} heet in het canonieke model ${el.naam}; de IRI blijft ${el.data?.iri}.` });
    for (const r of h.losseRegels || []) zetRegel(r.shape, r.nr, { naam: r.naam, fieldType: r.fieldType, data: kopie(r.data) });
    return elements[shapeVan.get(el.id)];
  };
  /** De shape die nieuwe regels van een entiteit krijgt; een klasse zonder shape krijgt er een. */
  const eigenShape = (el) => {
    if (eigenShapeVan.has(el.id)) return eigenShapeVan.get(el.id);
    const id = sleutel(el.id);
    const p = standaardPrefix || eigenPrefix(el);
    elements[id] = { id, naam: el.naam, elementType: "nodeshape", compartimenten: [], data: { iri: `${p}:${lokaal(el.naam)}Shape`, getypeerd: true, doelklassen: klasseIri(el) } };
    kruisverbanden.push({ shaclId: id, canoniekId: el.id });
    eigenShapeVan.set(el.id, id);
    return id;
  };

  // Entiteiten en gegevenselementen eerst, zodat de verwijzingen een doel hebben. Een GE dat
  // alleen een veld met meer waarden draagt (uit SHACL), is geen eigen shape.
  for (const el of alle) {
    if (isConnector(el)) continue;
    if (el.elementType === "gegevenselement" && H(el)?.meervoudig) continue;
    if (el.elementType === "entiteit" || el.elementType === "gegevenselement") maakKnopen(el);
  }

  // Wat elke entiteit aan regels heeft: velden, composities, relaties.
  const kandidaten = [];
  for (const el of alle) {
    if (isConnector(el) || !shapeVan.has(el.id)) continue;
    afgeleideVelden(el);
    for (const v of velden(el).filter((v) => v.naam)) kandidaten.push({ soort: "veld", el, item: v, h: H(v), ongewijzigd: Boolean(H(v)) && H(v).afdruk === afdrukVeld(v) && !enumGewijzigd(v.data?.typeLabel) });
    for (const c of alle.filter((c) => c.elementType === "compositie" && c.source === el.id)) {
      const ge = bron[c.target];
      if (!ge || !(shapeVan.has(ge.id) || H(ge)?.meervoudig)) continue;
      kandidaten.push({ soort: "compositie", el, item: c, h: H(c), ongewijzigd: Boolean(H(c)) && H(c).afdruk === afdrukCompositie(c, bron) && !velden(ge).some((v) => enumGewijzigd(v.data?.typeLabel)) });
    }
    for (const r of alle.filter((c) => c.elementType === "relatie" && c.source === el.id)) {
      if (!bron[r.target] || !shapeVan.has(r.target)) continue;
      kandidaten.push({ soort: "relatie", el, item: r, h: H(r), ongewijzigd: Boolean(H(r)) && H(r).afdruk === afdrukRelatie(r, bron) });
    }
  }
  for (const c of alle.filter((c) => c.elementType === "constraint")) {
    if (H(c)) kandidaten.push({ soort: "constraint", el: bron[c.data?.hoort], item: c, h: H(c), ongewijzigd: H(c).afdruk === afdrukConstraint(c) });
    else meldingen.push({ niveau: "info", elementId: sleutel(c.id), bericht: `Constraint ${c.naam || ""}: een eigen constraint uit het canonieke model staat (nog) niet in de shapes.` });
  }
  // Een oorspronkelijke regel gaat letterlijk terug als alles wat eruit kwam ongewijzigd is.
  const ongewijzigdPer = new Map();
  for (const k of kandidaten) if (k.ongewijzigd) for (const r of k.h.regels || []) ongewijzigdPer.set(r.sleutel, (ongewijzigdPer.get(r.sleutel) || 0) + 1);
  const letterlijk = (k) => k.ongewijzigd && (k.h.regels || []).every((r) => ongewijzigdPer.get(r.sleutel) === r.aantal);
  const geplaatst = new Set();
  let opnieuw = 0;

  for (const k of kandidaten) {
    const { el, item } = k;
    if (k.h && (k.soort === "constraint" || letterlijk(k))) {
      for (const r of k.h.regels || []) {
        if (geplaatst.has(r.sleutel)) continue;
        geplaatst.add(r.sleutel);
        zetRegel(elements[r.shape] ? r.shape : eigenShape(el), r.nr, { naam: r.naam, fieldType: r.fieldType, data: kopie(r.data) });
      }
      if (k.soort === "constraint") {
        if (k.h.element) elements[k.h.element.id] = kopie(k.h.element);
        if (k.h.lijn && elements[k.h.lijn.target]) elements[k.h.lijn.id] = kopie(k.h.lijn);
        if (!k.ongewijzigd) meldingen.push({ niveau: "waarschuwing", elementId: k.h.element?.id, bericht: `Constraint ${item.naam}: in het canonieke model gewijzigd; de SHACL-vorm is daar niet uit af te leiden, de oorspronkelijke blijft staan.` });
      }
      if (k.soort === "relatie") kruisverbanden.push({ shaclId: k.h.regels?.[0]?.shape || eigenShape(el), canoniekId: item.id });
      continue;
    }
    if (k.h) opnieuw += 1;
    if (k.soort === "veld") zetRegel(eigenShape(el), volgNieuw++, veldRegel(el, item));
    else if (k.soort === "compositie") {
      const ge = bron[item.target];
      const d = item.data || {};
      const { min, max } = grenzen(d.kardinaliteit);
      const rol = d.rolnaam || ge.naam;
      if (H(ge)?.meervoudig) {
        // Een veld met meer waarden: één regel met het type van het veld, zonder maxCount.
        const v = velden(ge)[0];
        zetRegel(eigenShape(el), volgNieuw++, { naam: padVoor(el, rol, v?.data?.pad), fieldType: "eigenschap", data: { ...typeVoor(v?.data?.typeLabel, `${el.naam}.${rol}`, sleutel(el.id)), ...(min > 0 ? { minCount: min } : {}), ...(max !== null ? { maxCount: max } : {}), ...behoud(k.h), label: rol } });
        continue;
      }
      zetRegel(eigenShape(el), volgNieuw++, {
        naam: padVoor(el, klein(rol), null),
        fieldType: "eigenschap",
        data: {
          node: elements[shapeVan.get(ge.id)].data.iri,
          ...(min > 0 ? { minCount: min } : {}),
          ...(d.momentvoorkomen === "enkelvoudig" ? { maxCount: 1 } : {}),
          ...behoud(k.h),
          label: rol,
        },
      });
    } else if (k.soort === "relatie") {
      const doel = bron[item.target];
      const d = item.data || {};
      const { min, max } = grenzen(d.doelKardinaliteit);
      const naam = d.naamLabelHeen && /^[\wÀ-ɏ ]+$/.test(d.naamLabelHeen) ? d.naamLabelHeen.replace(/ (.)/g, (_, c) => c.toUpperCase()) : item.naam;
      const shapeId = eigenShape(el);
      zetRegel(shapeId, volgNieuw++, {
        naam: padVoor(el, klein(naam), d.pad),
        fieldType: "eigenschap",
        data: {
          klasse: klasseIri(doel),
          ...(min > 0 ? { minCount: min } : {}),
          ...(max !== null ? { maxCount: max } : {}),
          ...(eigenBeschrijving(d, k.h) || (!k.h && d.bron?.description) ? { beschrijving: eigenBeschrijving(d, k.h) || d.bron.description } : {}),
          ...behoud(k.h),
          label: item.naam,
        },
      });
      kruisverbanden.push({ shaclId: shapeId, canoniekId: item.id });
      if (velden(item).length) {
        meldingen.push({ niveau: "info", elementId: shapeId, bericht: `Relatie ${item.naam}: de velden van de relatie (associatieklasse) staan niet in de shapes; alleen de verwijzing.` });
      }
    }
  }
  if (opnieuw) meldingen.push({ niveau: "info", bericht: `${opnieuw} onderdeel/onderdelen uit SHACL zijn in het canonieke model gewijzigd en opnieuw afgeleid; de rest gaat ongewijzigd terug.` });

  // Regels in de shapes zetten: eerst de oorspronkelijke (op volgorde), dan de nieuwe.
  for (const [shapeId, lijst] of regelsVoor) {
    const s = elements[shapeId];
    if (!s) continue;
    lijst.sort((a, b) => a.nr - b.nr);
    s.compartimenten = [...(s.compartimenten || []).filter((c) => c.compartmentType !== "eigenschappen"), { compartmentType: "eigenschappen", velden: lijst.map((x) => x.regel) }];
  }

  // Generalisaties: de oorspronkelijke subklasse-connectoren, of opnieuw (rdfs:subClassOf).
  for (const g of alle.filter((c) => c.elementType === "generalisatie")) {
    const h = H(g);
    if (h && h.afdruk === afdrukGeneralisatie(g, bron) && (h.elementen || []).every((e) => elements[e.source] && elements[e.target])) {
      for (const e of h.elementen || []) elements[e.id] = kopie(e);
      continue; // impliciet: volgt al uit de doelklassen van een shape
    }
    const van = shapeVan.get(g.source);
    const naar = shapeVan.get(g.target);
    if (!van || !naar) continue;
    const id = `subklasse__${van}__${naar}`;
    const sub = bron[g.source];
    const sup = bron[g.target];
    const data = H(sub) || H(sup) ? { van: klasseIri(sub), naar: klasseIri(sup) } : {};
    elements[id] = { id, naam: "", elementType: "subklasse", source: van, target: naar, compartimenten: [], data };
  }
  if (afgeleid) meldingen.push({ niveau: "info", bericht: `${afgeleid} afgeleid(e) veld(en) niet opgenomen: die worden berekend, niet vastgelegd.` });
  if (uniek) meldingen.push({ niveau: "info", bericht: `${uniek} veld(en) met {uniek}: SHACL core heeft geen uniciteit over knopen; niet opgenomen (kan later als sh:sparql).` });
  if (!shapeVan.size) meldingen.push({ niveau: "waarschuwing", bericht: "Geen entiteiten of gegevenselementen gevonden; er zijn geen shapes gemaakt." });

  // Shapes graph: de oorspronkelijke (met nieuwe prefixen erbij), anders titel en prefixen.
  const gebruikt = new Set(
    Object.values(elements)
      .flatMap((el) => [el.data?.iri, el.data?.van, el.data?.naar, el.data?.klasse, el.data?.doelklassen, ...(el.compartimenten || []).flatMap((c) => (c.velden || []).flatMap((v) => [v.naam, v.data?.klasse, v.data?.node]))])
      .filter(Boolean)
      .flatMap((x) => String(x).split(/[\s,|]+/))
      .map((x) => /^([A-Za-z_][\w.-]*):/.exec(x)?.[1])
      .filter(Boolean),
  );
  if (graafH) {
    const data = kopie(graafH.data || {});
    const bestaand = leesPrefixen(data.prefixen);
    const erbij = Object.entries(prefixen).filter(([p]) => gebruikt.has(p) && !(p in bestaand));
    if (erbij.length) data.prefixen = [data.prefixen, ...erbij.map(([p, ns]) => `${p}: <${ns}>`)].filter(Boolean).join("\n");
    elements[graafH.id] = { id: graafH.id, naam: graafH.naam, elementType: "shapesgraaf", compartimenten: [], data };
  } else {
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
  }

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
