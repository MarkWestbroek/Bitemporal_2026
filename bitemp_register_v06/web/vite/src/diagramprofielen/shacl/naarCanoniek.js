// @ts-check
/**
 * naarCanoniek — SHACL-shapes (M1 in het shacl-profiel) → het canonieke model (M1 in
 * canoniek-uml): de omgekeerde richting van vanCanoniek.js. Een M2→M2-afbeelding; doel is een
 * UML-weergave van een vocabulaire waarvoor alleen shapes bestaan (ODRL 2.2: W3C publiceert
 * geen XMI, alleen tekeningen). Elk gemaakt element krijgt een kruisverband "genereert" vanaf
 * de shape waar het uit komt.
 *
 *   doelklasse (sh:targetClass, of impliciet: shape a rdfs:Class) → entiteit; naam = lokale naam
 *   shape met meer doelklassen      → supertype + generalisaties. Heet een doelklasse zoals de
 *                                     shape (PolicyShape → odrl:Policy), dan is dat de ouder van
 *                                     de rest; anders komt er een ouder bij met de naam van de
 *                                     shape (RuleShape → Rule ▷ Permission, Prohibition, Duty)
 *   klasse uit sh:class             → entiteit (ook zonder eigen shape: odrl:LeftOperand)
 *   regel met sh:class              → relatie, doelKardinaliteit uit min/maxCount; `a | b`
 *                                     (sh:or van klassen) → één relatie per klasse (melding)
 *   regel met sh:node naar een shape zonder doel → gegevenselement met compositie
 *   regel met sh:in                 → enumeratie + veld van dat type
 *   overige regel, hooguit één      → veld; type uit sh:datatype (xsd → basistype), nodeKind
 *                                     IRI → URL, anders leeg; verplicht = minCount ≥ 1
 *   overige regel, meer dan één     → gegevenselement met één veld, compositie {meervoudig}
 *                                     (zoals de OAS-import een array van scalars leest)
 *   regels met hetzelfde pad        → samengevoegd (strengste grenzen; aantal en klasse staan in
 *                                     de kern vaak los, om eigen meldingen)
 *   alternatief pad a|b|c met min   → constraint "{minstens één van a, b, c}"
 *   sh:xone / sh:or / sh:sparql     → constraint; de paden in een xone/or worden ook velden
 *   rdfs:subClassOf (subklasse)     → generalisatie
 *   sh:message / sh:description     → beschrijving
 *
 * **Rondgang.** Elk gemaakt element onthoudt in `data.shacl` waar het uit komt (zie herkomst.js):
 * de oorspronkelijke property shapes, node shapes, klasse, constraint en de shapes graph, met een
 * afdruk van hoe het er in het canonieke model uitzag. canoniekNaarShacl schrijft wat niet is
 * gewijzigd letterlijk terug, dus SHACL → canoniek → SHACL geeft dezelfde graaf.
 *
 * Packages (domeinen) maakt de afbeelding niet: alles staat in één domein; namen zijn uniek.
 * Puur: getest in naarCanoniek.test.js met odrl22-kern.shacl.ttl.
 */

import { afdrukVeld, afdrukRelatie, afdrukCompositie, afdrukGeneralisatie, afdrukConstraint, afdrukEnumeratie, kopie } from "./herkomst.js";

const isConnector = (el) => Boolean(el?.source && el?.target);
const splits = (tekst) => String(tekst || "").split(/\s*[,|]\s*/).map((s) => s.trim()).filter(Boolean);

/** "odrl:Policy" / "<http://x/y#Policy>" → "Policy". */
export function lokaleNaam(iri) {
  const t = String(iri || "").trim().replace(/^<|>$/g, "");
  const na = t.includes("#") ? t.slice(t.lastIndexOf("#") + 1) : t.includes("/") ? t.slice(t.lastIndexOf("/") + 1) : t.includes(":") ? t.slice(t.indexOf(":") + 1) : t;
  return na || t;
}
const groot = (s) => String(s || "").replace(/^./, (c) => c.toUpperCase());
const veilig = (s) => String(s || "").replace(/[^A-Za-z0-9_-]+/g, "_");

/** xsd-datatype (+ nodeKind) → typeLabel van het canonieke model (basistype of gegevenstype). */
export function typeVoorXsd(datatype, nodeKind) {
  const d = lokaleNaam(datatype || "");
  if (d) {
    if (["string", "normalizedString", "token", "language", "langString"].includes(d)) return "string";
    if (["integer", "int", "long", "short", "byte", "nonNegativeInteger", "positiveInteger", "negativeInteger", "nonPositiveInteger", "unsignedInt", "unsignedLong"].includes(d)) return "integer";
    if (["decimal", "double", "float"].includes(d)) return "number";
    if (d === "boolean") return "boolean";
    if (d === "date") return "date";
    if (d === "dateTime" || d === "dateTimeStamp") return "date-time";
    if (d === "duration") return "Duur";
    if (d === "anyURI") return "URL";
    return d;
  }
  if (nodeKind === "IRI") return "URL";
  return "";
}

const kardinaliteit = (min, max) => `${min || 0}..${max === null || max === undefined ? "*" : max}`;
const isEenvoudigPad = (pad) => /^[^\s|/^*+?()!]+$/.test(String(pad || ""));
const isAlternatief = (pad) => /^[^\s|/^*+?()!]+(\s*\|\s*[^\s|/^*+?()!]+)+$/.test(String(pad || ""));

/**
 * @param {{elements?: Record<string, any>}} shacl - het SHACL-model (of het deel uit een map)
 * @param {{titel?: string}} [opties]
 * @returns {{elements: Record<string, any>, diagrams: Record<string, any>, kruisverbanden: {shaclId: string, canoniekId: string}[], meldingen: {niveau: string, elementId?: string, bericht: string}[]}}
 */
export function shaclNaarCanoniek(shacl, opties = {}) {
  const bron = shacl?.elements || {};
  const alle = Object.values(bron);
  /** @type {{niveau: string, elementId?: string, bericht: string}[]} */
  const meldingen = [];
  /** @type {{shaclId: string, canoniekId: string}[]} */
  const kruisverbanden = [];
  /** @type {Record<string, any>} */
  const elements = {};
  const gebruikteNamen = new Set();
  const uniekeNaam = (naam) => {
    let n = naam || "Naamloos";
    for (let i = 2; gebruikteNamen.has(n); i++) n = `${naam}${i}`;
    gebruikteNamen.add(n);
    return n;
  };

  // ── Klassen → entiteiten ────────────────────────────────────────────────
  /** @type {Map<string, string>} klasse-IRI → entiteit-id */
  const entiteitVan = new Map();
  const klasse = (iri, beschrijving, naam) => {
    if (entiteitVan.has(iri)) return elements[entiteitVan.get(iri)];
    const id = `sc_${veilig(iri)}`;
    elements[id] = { id, naam: uniekeNaam(naam || lokaleNaam(iri)), elementType: "entiteit", compartimenten: [], data: { iri, ...(beschrijving ? { beschrijving } : {}) } };
    entiteitVan.set(iri, id);
    return elements[id];
  };
  /** @param {string|null} subId @param {string|null} superId @param {any} [subklasse] - de subklasse-connector, of niets (impliciet uit de doelklassen) */
  const generaliseer = (subId, superId, subklasse) => {
    if (!subId || !superId || subId === superId) return;
    const id = `gen_${subId}__${superId}`;
    elements[id] ??= { id, naam: "", elementType: "generalisatie", source: subId, target: superId, compartimenten: [], data: { shacl: { elementen: [] } } };
    const h = elements[id].data.shacl;
    if (subklasse) h.elementen.push(kopie(subklasse));
    else h.impliciet = true;
  };
  // Herkomst van een entiteit: de node shapes waarvan ze de regels draagt, het klasse-element.
  const herkomst = (el) => (el.data.shacl ??= { naam: el.naam, shapes: [] });
  const onthoudShape = (el, s) => {
    const h = herkomst(el);
    if (!h.shapes.some((x) => x.id === s.id)) h.shapes.push({ id: s.id, naam: s.naam, data: kopie(s.data || {}), compartimenten: kopie((s.compartimenten || []).filter((c) => c.compartmentType !== "eigenschappen")) });
  };
  const kruis = (shaclId, canoniekId) => {
    if (!kruisverbanden.some((k) => k.shaclId === shaclId && k.canoniekId === canoniekId)) kruisverbanden.push({ shaclId, canoniekId });
  };

  const shapes = alle.filter((el) => el.elementType === "nodeshape");
  const doelenVan = (s) => [...splits(s.data?.doelklassen), ...(s.data?.ookKlasse && s.data?.iri ? [s.data.iri] : [])];
  // Shapes waarnaar een sh:node wijst: zonder eigen doel worden ze een gegevenselement.
  const viaNode = new Set(shapes.flatMap((s) => (s.compartimenten || []).flatMap((c) => c.velden || []).map((v) => v.data?.node).filter(Boolean)));
  const shapeOpIri = new Map(shapes.filter((s) => s.data?.iri).map((s) => [s.data.iri, s]));

  /** @type {Map<string, string>} shape-id → id van de entiteit (of het GE) die zijn regels krijgt */
  const hoofdVan = new Map();
  for (const s of shapes) {
    const doelen = [...new Set(doelenVan(s))];
    const shapeNaam = String(s.naam || lokaleNaam(s.data?.iri)).replace(/Shape$/, "") || "Naamloos";
    const beschrijving = s.data?.beschrijving;
    if (!doelen.length) {
      if (viaNode.has(s.data?.iri)) {
        const id = `sg_${veilig(s.data?.iri || s.id)}`;
        elements[id] = { id, naam: uniekeNaam(shapeNaam), elementType: "gegevenselement", compartimenten: [], data: { iri: s.data?.iri, ...(beschrijving ? { beschrijving } : {}) } };
        onthoudShape(elements[id], s);
        hoofdVan.set(s.id, id);
        kruis(s.id, id);
        continue;
      }
      const doelSoort = s.data?.doelknopen ? "targetNode" : s.data?.doelSubjectenVan ? "targetSubjectsOf" : s.data?.doelObjectenVan ? "targetObjectsOf" : null;
      const el = klasse(`shape:${s.data?.iri || s.id}`, beschrijving, shapeNaam);
      onthoudShape(el, s);
      hoofdVan.set(s.id, el.id);
      kruis(s.id, el.id);
      meldingen.push({ niveau: "info", elementId: s.id, bericht: `${shapeNaam}: geen doelklasse${doelSoort ? ` (wel ${doelSoort})` : ""}; als entiteit met de naam van de shape opgenomen.` });
      continue;
    }
    if (doelen.length === 1) {
      const el = klasse(doelen[0], beschrijving);
      if (beschrijving && !el.data.beschrijving) el.data.beschrijving = beschrijving;
      onthoudShape(el, s);
      hoofdVan.set(s.id, el.id);
      kruis(s.id, el.id);
      continue;
    }
    // Meer doelklassen: één ervan (of een nieuwe) als ouder van de rest.
    const eigen = doelen.find((d) => lokaleNaam(d) === shapeNaam);
    const ouder = eigen ? klasse(eigen, beschrijving) : klasse(`shape:${s.data?.iri || s.id}`, beschrijving, shapeNaam);
    onthoudShape(ouder, s);
    hoofdVan.set(s.id, ouder.id);
    kruis(s.id, ouder.id);
    const kinderen = doelen.filter((d) => d !== eigen).map((d) => klasse(d));
    for (const k of kinderen) {
      generaliseer(k.id, ouder.id);
      kruis(s.id, k.id);
    }
    meldingen.push({
      niveau: "info",
      elementId: s.id,
      bericht: `${s.naam || shapeNaam} geldt voor ${doelen.map(lokaleNaam).join(", ")}: ${ouder.naam} ${eigen ? "is" : "is toegevoegd als"} supertype van ${kinderen.map((k) => k.naam).join(", ")}; de regels staan bij ${ouder.naam}.`,
    });
  }
  for (const el of alle.filter((e) => e.elementType === "klasse" && e.data?.iri)) {
    const ent = klasse(el.data.iri, el.data?.beschrijving);
    herkomst(ent).klasse = { id: el.id, naam: el.naam, data: kopie(el.data || {}) };
    kruis(el.id, ent.id);
  }

  // ── Regels per entiteit, samengevoegd per pad ──────────────────────────
  /** @type {Map<string, Map<string, any>>} hoofd-id → pad → samengevoegde regel */
  const regelsVan = new Map();
  const voegRegel = (hoofdId, pad, d, bron) => {
    if (!regelsVan.has(hoofdId)) regelsVan.set(hoofdId, new Map());
    const m = regelsVan.get(hoofdId);
    const oud = m.get(pad) || { pad, min: 0, max: null, beschrijvingen: [], bronnen: [] };
    if (bron) oud.bronnen.push(bron);
    if (d.minCount !== undefined && d.minCount !== "") oud.min = Math.max(oud.min, Number(d.minCount));
    if (d.maxCount !== undefined && d.maxCount !== "") oud.max = oud.max === null ? Number(d.maxCount) : Math.min(oud.max, Number(d.maxCount));
    for (const k of ["klasse", "datatype", "node", "nodeKind", "in", "order"]) if (d[k] && !oud[k]) oud[k] = d[k];
    for (const t of [d.beschrijving, d.message]) if (t && !oud.beschrijvingen.includes(t)) oud.beschrijvingen.push(t);
    m.set(pad, oud);
  };
  /** constraints per hoofd: {naam, expressie, shaclId} */
  const constraints = [];

  for (const s of shapes) {
    const hoofdId = hoofdVan.get(s.id);
    if (!hoofdId) continue;
    const eigen = (s.compartimenten || []).filter((c) => c.compartmentType === "eigenschappen").flatMap((c) => c.velden || []);
    eigen.forEach((v, nr) => {
      const pad = String(v.naam || "").trim();
      const d = v.data || {};
      const bron = { sleutel: `${s.id}#${nr}`, shape: s.id, nr, naam: v.naam, fieldType: v.fieldType, data: kopie(d), aantal: 0 };
      if (isEenvoudigPad(pad)) {
        voegRegel(hoofdId, pad, d, bron);
      } else if (isAlternatief(pad) && Number(d.minCount) >= 1) {
        const delen = pad.split(/\s*\|\s*/).map(lokaleNaam);
        constraints.push({ hoofdId, shaclId: s.id, naam: `{minstens ${Number(d.minCount) === 1 ? "één" : d.minCount} van ${delen.join(", ")}}`, expressie: `sh:path [ sh:alternativePath ( ${pad.split(/\s*\|\s*/).join(" ")} ) ] ; sh:minCount ${d.minCount}`, beschrijving: d.message || d.beschrijving, herkomst: { regels: [bron] } });
      } else {
        // Niet in het model, wel bewaard: gaat ongewijzigd terug naar SHACL.
        (herkomst(elements[hoofdId]).losseRegels ??= []).push(bron);
        meldingen.push({ niveau: "waarschuwing", elementId: s.id, bericht: `${s.naam}: pad "${pad}" is geen eenvoudige eigenschap en staat niet in het model (wel bewaard voor de terugweg).` });
      }
    });
  }
  // Constraints op shape-niveau (via de notitielijn aan hun shape).
  for (const c of alle.filter((e) => e.elementType === "constraint")) {
    const lijn = alle.find((e) => e.elementType === "notitielijn" && e.source === c.id);
    const shape = lijn ? bron[lijn.target] : null;
    const hoofdId = shape ? hoofdVan.get(shape.id) : null;
    if (!hoofdId) {
      meldingen.push({ niveau: "info", elementId: c.id, bericht: `Constraint ${c.naam} hangt aan geen shape en staat niet in het model.` });
      continue;
    }
    const d = c.data || {};
    const spec = String(d.specificatie || "");
    const soort = /^sh:(xone|or|and|not)\b/.exec(spec)?.[1] || (d.taal === "SPARQL" ? "sparql" : "");
    const paden = [...spec.matchAll(/sh:path\s+([^\s;\]]+)/g)].map((m) => m[1]);
    if (soort === "xone" || soort === "or") for (const p of paden) voegRegel(hoofdId, p, { maxCount: soort === "xone" ? 1 : undefined });
    const naam =
      soort === "xone" && paden.length ? `{precies één van ${paden.map(lokaleNaam).join(", ")}}`
      : soort === "or" && paden.length ? `{minstens één van ${paden.map(lokaleNaam).join(", ")}}`
      : d.message || shape.data?.message || c.naam || "constraint";
    constraints.push({ hoofdId, shaclId: c.id, naam, expressie: spec, beschrijving: d.message || shape.data?.message, herkomst: { element: kopie(c), lijn: kopie(lijn) } });
  }

  // ── Regels → velden, relaties, composities, enumeraties ────────────────
  let orRelaties = 0;
  for (const [hoofdId, regels] of regelsVan) {
    const hoofd = elements[hoofdId];
    const velden = [];
    const sorteer = [...regels.values()].sort((a, b) => (Number(a.order ?? 1e9) - Number(b.order ?? 1e9)) || 0);
    for (const r of sorteer) {
      const rol = lokaleNaam(r.pad);
      const beschrijving = r.beschrijvingen.join(" ") || undefined;
      const kard = kardinaliteit(r.min, r.max);
      const naarShape = r.node ? shapeOpIri.get(r.node) : null;
      const doelKlassen = r.klasse ? splits(r.klasse) : naarShape && hoofdVan.get(naarShape.id) && elements[hoofdVan.get(naarShape.id)].elementType === "entiteit" ? [elements[hoofdVan.get(naarShape.id)].data.iri] : [];
      if (doelKlassen.length && hoofd.elementType === "entiteit") {
        if (doelKlassen.length > 1) orRelaties += 1;
        for (const k of doelKlassen) {
          const doel = klasse(k);
          const id = `rel_${hoofdId}__${veilig(rol)}__${doel.id}`;
          elements[id] = {
            id,
            naam: uniekeNaam(`${hoofd.naam}${groot(rol)}${doelKlassen.length > 1 ? doel.naam : ""}`),
            elementType: "relatie",
            source: hoofdId,
            target: doel.id,
            compartimenten: [],
            data: { naamLabelHeen: rol, doelKardinaliteit: kard, directioneel: true, pad: r.pad, ...(beschrijving ? { beschrijving } : {}), shacl: { regels: r.bronnen } },
          };
        }
        continue;
      }
      if (naarShape && hoofdVan.get(naarShape.id) && hoofd.elementType === "entiteit") {
        const ge = elements[hoofdVan.get(naarShape.id)];
        const id = `comp_${hoofdId}__${veilig(rol)}__${ge.id}`;
        elements[id] = { id, naam: "", elementType: "compositie", source: hoofdId, target: ge.id, compartimenten: [], data: { rolnaam: rol, kardinaliteit: kard, momentvoorkomen: r.max === 1 ? "enkelvoudig" : "meervoudig", shacl: { regels: r.bronnen } } };
        continue;
      }
      let typeLabel = typeVoorXsd(r.datatype, r.nodeKind);
      if (r.in) {
        const termen = {};
        const waarden = [...String(r.in).replace(/^\(|\)$/g, "").matchAll(/"((?:[^"\\]|\\.)*)"|([^\s()]+)/g)]
          .map((m) => {
            const w = m[1] ?? lokaleNaam(m[2]);
            if (w) termen[w] = m[1] !== undefined ? JSON.stringify(m[1]) : m[2];
            return w;
          })
          .filter(Boolean);
        const id = `enum_${hoofdId}__${veilig(rol)}`;
        const naam = uniekeNaam(`${hoofd.naam}${groot(rol)}`);
        elements[id] = { id, naam, elementType: "enumeratie", compartimenten: [{ compartmentType: "waarden", velden: waarden.map((w) => ({ naam: w, fieldType: "waarde", data: {} })) }], data: { shacl: { termen } } };
        typeLabel = naam;
      }
      const veld = { naam: rol, fieldType: "attribuut", data: { typeLabel, ...(r.min >= 1 ? { verplicht: true } : {}), pad: r.pad, ...(beschrijving ? { beschrijving } : {}), shacl: { regels: r.bronnen } } };
      if (r.max === 1 || hoofd.elementType !== "entiteit") {
        velden.push(veld);
        continue;
      }
      // Meer dan één waarde: een gegevenselement met één veld, zoals een array van scalars.
      const geId = `sg_${hoofdId}__${veilig(rol)}`;
      const { shacl: veldHerkomst, ...veldData } = veld.data;
      elements[geId] = { id: geId, naam: uniekeNaam(`${hoofd.naam}${groot(rol)}`), elementType: "gegevenselement", compartimenten: [{ compartmentType: "velden", velden: [{ ...veld, data: { ...veldData, verplicht: true } }] }], data: { shacl: { meervoudig: true } } };
      const cId = `comp_${hoofdId}__${geId}`;
      elements[cId] = { id: cId, naam: "", elementType: "compositie", source: hoofdId, target: geId, compartimenten: [], data: { rolnaam: rol, kardinaliteit: kard, momentvoorkomen: "meervoudig", shacl: veldHerkomst } };
    }
    if (velden.length) hoofd.compartimenten = [...(hoofd.compartimenten || []).filter((c) => c.compartmentType !== "velden"), { compartmentType: "velden", velden }];
  }
  if (orRelaties) meldingen.push({ niveau: "info", bericht: `${orRelaties} regel(s) met sh:or van klassen (a | b): één relatie per klasse; "één van beide" staat niet in het diagram.` });

  constraints.forEach((c, i) => {
    const id = `con_${c.hoofdId}__${i + 1}`;
    // De SHACL zelf (geen OCL/CEL) in de beschrijving; de naam zegt het in woorden.
    const beschrijving = [c.beschrijving, c.expressie ? `SHACL: ${c.expressie}` : ""].filter(Boolean).join("\n\n");
    elements[id] = { id, naam: c.naam, elementType: "constraint", compartimenten: [], data: { expressie: "", ...(beschrijving ? { beschrijving } : {}), hoort: c.hoofdId, shacl: c.herkomst } };
    kruis(c.shaclId, id);
  });

  // ── Subklassen uit de shapes graph ─────────────────────────────────────
  const klasseVanShaclEl = (id) => {
    const el = bron[id];
    if (!el) return null;
    if (el.elementType === "nodeshape") return hoofdVan.get(el.id) || null;
    if (el.elementType === "klasse" && el.data?.iri) return entiteitVan.get(el.data.iri) || null;
    return null;
  };
  // Een losse hiërarchie-triple (`odrl:Set rdfs:subClassOf odrl:Policy`) draagt de klasse-IRI's zelf.
  for (const s of alle.filter((e) => e.elementType === "subklasse")) {
    if (s.data?.van && s.data?.naar) generaliseer(klasse(s.data.van).id, klasse(s.data.naar).id, s);
    else generaliseer(klasseVanShaclEl(s.source), klasseVanShaclEl(s.target), s);
  }
  vulHerkomst(elements, alle.find((e) => e.elementType === "shapesgraaf"));

  if (!entiteitVan.size) meldingen.push({ niveau: "waarschuwing", bericht: "Geen shapes met een doelklasse gevonden; er zijn geen entiteiten gemaakt." });

  // ── Diagram: supertypes boven, dan per verwijzingsstap een rij ─────────
  const knopen = Object.values(elements).filter((el) => !isConnector(el));
  const edges = [
    ...Object.values(elements).filter((el) => el.elementType === "generalisatie").map((g) => ({ source: g.target, target: g.source })),
    ...Object.values(elements).filter((el) => el.elementType === "relatie" || el.elementType === "compositie").map((r) => ({ source: r.source, target: r.target })),
    ...knopen.filter((el) => el.elementType === "constraint").map((c) => ({ source: c.data.hoort, target: c.id })),
    ...knopen.filter((el) => el.elementType === "enumeratie").flatMap((en) => [...regelsVan.keys()].filter((h) => (elements[h]?.compartimenten || []).some((c) => (c.velden || []).some((v) => v.data?.typeLabel === en.naam))).map((h) => ({ source: h, target: en.id }))),
  ];
  const posities = lagenPosities(knopen.map((el) => el.id), elements, edges);
  const titel = opties.titel || "Model uit SHACL";
  return {
    elements,
    diagrams: { uit_shacl: { id: "uit_shacl", naam: titel, nodes: knopen.map((el) => ({ elementId: el.id, position: posities[el.id] })), edges: [] } },
    kruisverbanden,
    meldingen,
  };
}

/**
 * Herkomst afmaken: afdrukken, het aantal canonieke onderdelen per property shape, de shapes
 * graph bij elke entiteit; en alles los kopiëren (geen gedeelde objecten tussen elementen).
 * @param {Record<string, any>} elements @param {any} graaf
 */
function vulHerkomst(elements, graaf) {
  const alle = Object.values(elements);
  const onderdelen = [];
  for (const el of alle) {
    const h = el.data?.shacl;
    if (el.elementType === "entiteit" || el.elementType === "gegevenselement") {
      for (const v of (el.compartimenten || []).flatMap((c) => c.velden || [])) if (v.data?.shacl) onderdelen.push([v.data.shacl, afdrukVeld(v), v.data.beschrijving]);
      if (h && graaf && !h.meervoudig) h.graaf = { id: graaf.id, naam: graaf.naam, data: kopie(graaf.data || {}) };
      continue;
    }
    if (!h) continue;
    if (el.elementType === "relatie") onderdelen.push([h, afdrukRelatie(el, elements), el.data.beschrijving]);
    else if (el.elementType === "compositie") onderdelen.push([h, afdrukCompositie(el, elements)]);
    else if (el.elementType === "generalisatie") h.afdruk = afdrukGeneralisatie(el, elements);
    else if (el.elementType === "constraint") onderdelen.push([h, afdrukConstraint(el)]);
    else if (el.elementType === "enumeratie") h.afdruk = afdrukEnumeratie(el);
  }
  const aantal = new Map();
  for (const [h] of onderdelen) for (const r of h.regels || []) aantal.set(r.sleutel, (aantal.get(r.sleutel) || 0) + 1);
  for (const [h, afdruk, beschrijving] of onderdelen) {
    h.afdruk = afdruk;
    if (beschrijving) h.beschrijving = beschrijving;
    for (const r of h.regels || []) r.aantal = aantal.get(r.sleutel) || 0;
  }
  for (const el of alle) {
    if (el.data?.shacl) el.data.shacl = kopie(el.data.shacl);
    for (const v of (el.compartimenten || []).flatMap((c) => c.velden || [])) if (v.data?.shacl) v.data.shacl = kopie(v.data.shacl);
  }
}

/**
 * Lagen-layout: wat nergens een binnenkomende lijn heeft bovenaan (supertypes, de wortel van de
 * verwijzingen), daaronder per stap een rij, gesorteerd op het zwaartepunt van de ouders. De
 * rijhoogte volgt de hoogste doos. Zelfde opzet als shaclRijenPosities, voor UML-dozen.
 */
function lagenPosities(ids, elements, edges, perRij = 6) {
  const idSet = new Set(ids);
  const uit = new Map();
  const inn = new Map();
  for (const e of edges) {
    if (!idSet.has(e.source) || !idSet.has(e.target) || e.source === e.target) continue;
    if (!uit.has(e.source)) uit.set(e.source, []);
    uit.get(e.source).push(e.target);
    if (!inn.has(e.target)) inn.set(e.target, []);
    inn.get(e.target).push(e.source);
  }
  const laag = new Map();
  let rand = ids.filter((id) => !(inn.get(id) || []).length && (uit.get(id) || []).length);
  if (!rand.length && ids.length) rand = [ids[0]];
  rand.forEach((id) => laag.set(id, 0));
  for (let d = 1; rand.length; d++) {
    const volgende = [];
    for (const van of rand) for (const naar of uit.get(van) || []) if (!laag.has(naar)) (laag.set(naar, d), volgende.push(naar));
    rand = volgende;
    if (!rand.length) {
      // Een kring zonder ingang: begin opnieuw bij het eerste ongeplaatste element met lijnen.
      const los = ids.find((id) => !laag.has(id) && ((uit.get(id) || []).length || (inn.get(id) || []).length));
      if (los) (laag.set(los, d), rand.push(los));
    }
  }
  const max = Math.max(0, ...laag.values());
  for (const id of ids) if (!laag.has(id)) laag.set(id, max + 1);
  const hoogte = (id) => 56 + 20 * (elements[id]?.compartimenten || []).reduce((n, c) => n + (c.velden || []).length, 0);
  const posities = {};
  let y = 40;
  for (const l of [...new Set(laag.values())].sort((a, b) => a - b)) {
    const groep = ids.filter((id) => laag.get(id) === l);
    const zwaartepunt = (id) => {
      const xs = (inn.get(id) || []).map((o) => posities[o]?.x).filter((x) => x !== undefined);
      return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : Infinity;
    };
    groep.sort((a, b) => zwaartepunt(a) - zwaartepunt(b) || String(elements[a]?.naam).localeCompare(String(elements[b]?.naam)));
    for (let start = 0; start < groep.length; start += perRij) {
      const rij = groep.slice(start, start + perRij);
      rij.forEach((id, i) => (posities[id] = { x: 40 + i * 320, y }));
      y += Math.max(...rij.map(hoogte)) + 90;
    }
  }
  return posities;
}

/**
 * Het resultaat van shaclNaarCanoniek in de canonieke store zetten (bijwerken als het er al
 * is): ids per bronmap (`vs_<map>_…`), `data.uitShacl` = de bronmap; opnieuw uitvoeren vervangt
 * de vorige uitkomst en laat de posities op het diagram staan. Puur.
 *
 * @param {{elements: Record<string, any>, diagrams: Record<string, any>}} staat - canonieke store
 * @param {ReturnType<typeof shaclNaarCanoniek>} uit
 * @param {string} mapId - de bronmap
 */
export function voegCanoniekIn(staat, uit, mapId) {
  const voor = `vs_${veilig(mapId)}_`;
  const her = (id) => `${voor}${id}`;
  const nieuw = {};
  for (const [id, el] of Object.entries(uit.elements)) {
    const data = { ...(el.data || {}), uitShacl: mapId };
    if (data.hoort) data.hoort = her(data.hoort);
    const kopie = { ...el, id: her(id), data };
    if (el.source) Object.assign(kopie, { source: her(el.source), target: her(el.target) });
    nieuw[kopie.id] = kopie;
  }
  const oud = Object.values(staat.elements || {}).filter((el) => el.data?.uitShacl === mapId).map((el) => el.id);
  const elements = Object.fromEntries(Object.entries(staat.elements || {}).filter(([, el]) => el.data?.uitShacl !== mapId));
  Object.assign(elements, nieuw);

  const diagramId = `${voor}diagram`;
  const bestaand = staat.diagrams?.[diagramId];
  const bronDiagram = Object.values(uit.diagrams)[0];
  const posities = new Map((bestaand?.nodes || []).map((n) => [n.elementId, n]));
  const nodes = (bronDiagram?.nodes || []).map((n) => posities.get(her(n.elementId)) || { ...n, elementId: her(n.elementId) });
  const diagrams = { ...(staat.diagrams || {}), [diagramId]: { ...(bestaand || {}), id: diagramId, naam: bronDiagram?.naam || "Model uit SHACL", nodes, edges: bestaand?.edges || [] } };
  const weg = oud.filter((id) => !elements[id]);
  return { elements, diagrams, diagramId, weg, her };
}
