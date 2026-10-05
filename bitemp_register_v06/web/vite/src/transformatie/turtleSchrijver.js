// @ts-check
/**
 * turtleSchrijver — **schrijver**: plan → RDF-triples → Turtle.
 *
 * Laatste stap van een export (zie docs/TRANSFORMATIES.md §3). De toepasser
 * levert een plan van elementen en connectoren; de regelset heeft daarin de
 * doel-`type` gekozen. Voor RDF is die keuze letterlijk: het type van een
 * element is een klasse (`odrl:Permission`), het type van een connector een
 * predicaat (`odrl:target`), en de sleutels van `data` zijn predicaten.
 *
 * Twee stappen, zodat een andere serialisatie (JSON-LD) alleen de tweede
 * hoeft te vervangen:
 *
 *   planNaarTriples(plan, context)   → [{ s, p, o }]     (context-gedreven)
 *   triplesNaarTurtle(triples, …)    → tekst
 *
 * Wat de schrijver moet weten is de **vorm van een waarde**. Die staat in een
 * contexttabel — hetzelfde idee als een JSON-LD-`@context`:
 *
 *   { prefixes: { odrl: "http://www.w3.org/ns/odrl/2/", b: "https://…/" },
 *     basis: "b",                      // prefix voor elementen zonder eigen prefix
 *     taal: "nl",
 *     naam: { standaard: "rdfs:label", perType: { "odrl:Permission": "dct:title" } },
 *     predicaten: { "dct:description": { soort: "tekst" },
 *                   "odrl:operator":   { soort: "iri" },
 *                   "dct:issued":      { soort: "datum" },
 *                   "odrl:or":         { soort: "lijst" } },
 *     secties: [ { titel: "Regels", types: ["odrl:Permission", …], iri?: "^b:handeling-" } ] }
 *
 * Een kale string in `data` krijgt zijn vorm uit de context: `tekst` (met de
 * taal), `iri` (CURIE of <absoluut>; meer waarden met komma's), `datum`
 * (xsd:date) of, zonder vermelding, een kale string. Waar één predicaat per
 * keer een ander soort waarde draagt (odrl:rightOperand) levert de lezer een
 * **getypeerde waarde**: een getal, een boolean, of een object
 * `{ iri }`, `{ tekst, taal? }`, `{ letterlijk }`, `{ datum }`, `{ zelf: true }`
 * (de IRI van het element zelf) — of een lijst daarvan.
 *
 * `lijst` op een predicaat maakt van de connectoren van één bron één RDF-lijst,
 * in de volgorde van het plan (= de volgorde van de verbindingen in de graaf).
 *
 * Deterministisch: subjecten in planvolgorde binnen hun sectie, predicaten in
 * de volgorde type → naam → data → connectoren. Puur, zonder dependencies.
 */

const LOKAAL_ONGELDIG = /[^A-Za-z0-9_.\-]/g;

/**
 * @typedef {{soort: "iri", waarde: string}
 *         | {soort: "literal", waarde: string, taal?: string, datatype?: string}
 *         | {soort: "kaal", waarde: string}
 *         | {soort: "lijst", leden: string[]}} RdfObject
 * @typedef {{s: string, p: string, o: RdfObject}} Triple
 */

function maakNamen(context) {
  const prefixes = context.prefixes || {};
  const lokaal = (naam) => String(naam).replace(LOKAAL_ONGELDIG, "-").replace(/\.+$/, "");
  const heeftPrefix = (s) => {
    const i = s.indexOf(":");
    return i > 0 && Object.hasOwn(prefixes, s.slice(0, i));
  };
  /** Sleutel van een plan-element → CURIE. */
  const iriVan = (sleutel) => {
    const s = String(sleutel);
    if (heeftPrefix(s)) {
      const i = s.indexOf(":");
      return `${s.slice(0, i)}:${lokaal(s.slice(i + 1))}`;
    }
    return `${context.basis}:${lokaal(s)}`;
  };
  /** Verwijzing in een waarde: <absoluut> of een CURIE met een bekende prefix. */
  const verwijzing = (waarde) => {
    const s = String(waarde).trim();
    if (s.startsWith("<") && s.endsWith(">")) return s;
    return heeftPrefix(s) && !/\s/.test(s) ? iriVan(s) : null;
  };
  return { iriVan, verwijzing };
}

/**
 * Plan → triples.
 *
 * @param {{elementen: any[], connectoren: any[]}} plan
 * @param {any} context
 * @returns {{triples: Triple[], diagnostics: any[]}}
 */
export function planNaarTriples(plan, context) {
  const { iriVan, verwijzing } = maakNamen(context);
  const taal = context.taal || "nl";
  const predicaten = context.predicaten || {};
  const bekend = new Set((plan.elementen || []).map((el) => el.sleutel));
  /** @type {Triple[]} */
  const triples = [];
  const diagnostics = [];

  /** Eén waarde → RdfObject, of null als er niets te schrijven valt. */
  const object = (el, predicaat, waarde) => {
    if (waarde === undefined || waarde === null || waarde === "") return null;
    if (typeof waarde === "number" || typeof waarde === "boolean") return { soort: "kaal", waarde: String(waarde) };
    if (typeof waarde === "object") {
      if (waarde.zelf) return { soort: "iri", waarde: iriVan(el.sleutel) };
      if ("iri" in waarde) return waarde.iri ? { soort: "iri", waarde: verwijzing(waarde.iri) ?? iriVan(waarde.iri) } : null;
      if ("tekst" in waarde) return waarde.tekst === "" ? null : { soort: "literal", waarde: String(waarde.tekst), taal: waarde.taal || taal };
      if ("letterlijk" in waarde) return { soort: "literal", waarde: String(waarde.letterlijk) };
      if ("datum" in waarde) return waarde.datum ? { soort: "literal", waarde: String(waarde.datum), datatype: "xsd:date" } : null;
      diagnostics.push({ severity: "warning", code: "TTL-WAARDE", message: `Onbekende getypeerde waarde bij ${predicaat}: ${JSON.stringify(waarde)}`, sourceId: el.sleutel, path: null });
      return null;
    }
    const soort = predicaten[predicaat]?.soort;
    if (soort === "tekst") return { soort: "literal", waarde, taal };
    if (soort === "datum") return { soort: "literal", waarde: waarde.trim(), datatype: "xsd:date" };
    if (soort === "iri") return { soort: "iri", waarde: verwijzing(waarde) ?? iriVan(waarde.trim()) };
    return { soort: "literal", waarde };
  };

  // Connectoren per bron en predicaat, in planvolgorde.
  const uitgaand = new Map();
  for (const c of plan.connectoren || []) {
    if (!bekend.has(c.bron) || !bekend.has(c.doel)) continue;
    if (!uitgaand.has(c.bron)) uitgaand.set(c.bron, new Map());
    const perPredicaat = uitgaand.get(c.bron);
    if (!perPredicaat.has(c.type)) perPredicaat.set(c.type, []);
    perPredicaat.get(c.type).push(iriVan(c.doel));
  }

  for (const el of plan.elementen || []) {
    const s = iriVan(el.sleutel);
    triples.push({ s, p: "a", o: { soort: "iri", waarde: el.type } });
    if (el.naam) {
      const p = context.naam?.perType?.[el.type] || context.naam?.standaard || "rdfs:label";
      triples.push({ s, p, o: { soort: "literal", waarde: el.naam, taal } });
    }
    for (const [sleutel, ruw] of Object.entries(el.data || {})) {
      const predicaat = sleutel === "rdf:type" ? "a" : sleutel; // extra klassen horen bij het type
      // Een iri-string mag meer waarden dragen, gescheiden door komma's.
      const waarden = Array.isArray(ruw)
        ? ruw
        : typeof ruw === "string" && predicaten[predicaat]?.soort === "iri"
          ? ruw.split(",").map((deel) => deel.trim())
          : [ruw];
      for (const waarde of waarden) {
        const o = object(el, predicaat, waarde);
        if (o) triples.push({ s, p: predicaat, o });
      }
    }
    for (const [sleutel, doelen] of uitgaand.get(el.sleutel) || []) {
      const predicaat = sleutel === "rdf:type" ? "a" : sleutel;
      if (predicaten[predicaat]?.soort === "lijst") triples.push({ s, p: predicaat, o: { soort: "lijst", leden: doelen } });
      else for (const doel of doelen) triples.push({ s, p: predicaat, o: { soort: "iri", waarde: doel } });
    }
  }
  return { triples, diagnostics };
}

/** RdfObject → Turtle. */
function objectTekst(o) {
  if (o.soort === "iri" || o.soort === "kaal") return o.waarde;
  if (o.soort === "lijst") return `( ${o.leden.join(" ")} )`;
  const tekst = JSON.stringify(o.waarde);
  if (o.taal) return `${tekst}@${o.taal}`;
  return o.datatype ? `${tekst}^^${o.datatype}` : tekst;
}

/**
 * Triples → Turtle: per subject één blok, gelijke predicaten samengenomen.
 *
 * @param {Triple[]} triples
 * @param {any} context
 * @param {{kop?: string}} [opties]
 */
export function triplesNaarTurtle(triples, context, opties = {}) {
  const perSubject = new Map();
  for (const t of triples) {
    if (!perSubject.has(t.s)) perSubject.set(t.s, new Map());
    const perPredicaat = perSubject.get(t.s);
    if (!perPredicaat.has(t.p)) perPredicaat.set(t.p, []);
    perPredicaat.get(t.p).push(objectTekst(t.o));
  }
  const secties = context.secties || [];
  const perSectie = Array.from({ length: secties.length + 1 }, () => []);
  for (const [s, perPredicaat] of perSubject) {
    // De sectie volgt het eerste type van het subject (dat uit de regelset), of
    // een patroon op de IRI — zo staat een hulpknoop bij het ding waar hij bij hoort.
    const type = (perPredicaat.get("a") || [])[0];
    const i = secties.findIndex((sectie) => (sectie.types || []).includes(type) || (sectie.iri && new RegExp(sectie.iri).test(s)));
    const regels = [...perPredicaat].map(([p, objecten]) => `${p} ${objecten.join(" , ")}`);
    perSectie[i < 0 ? secties.length : i].push(`${s} ${regels.join(" ;\n    ")} .`);
  }
  const prefixen = Object.entries(context.prefixes || {})
    .map(([p, iri]) => `@prefix ${`${p}:`.padEnd(8)}<${iri}> .`)
    .join("\n");
  const delen = [];
  perSectie.forEach((blokken, i) => {
    if (!blokken.length) return;
    const titel = secties[i]?.titel;
    delen.push((titel ? `# ── ${titel} ${"─".repeat(Math.max(3, 74 - titel.length))}\n\n` : "") + blokken.join("\n\n"));
  });
  return [opties.kop, prefixen, ...delen].filter(Boolean).join("\n\n") + "\n";
}

/**
 * Plan → Turtle in één keer.
 *
 * @param {{elementen: any[], connectoren: any[]}} plan
 * @param {any} context
 * @param {{kop?: string}} [opties]
 * @returns {{tekst: string, triples: Triple[], diagnostics: any[]}}
 */
export function schrijfTurtle(plan, context, opties = {}) {
  const { triples, diagnostics } = planNaarTriples(plan, context);
  return { tekst: triplesNaarTurtle(triples, context, opties), triples, diagnostics };
}
