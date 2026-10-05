// @ts-check
/**
 * adapter — schema-document (zie sdl.js) ↔ diagramcore-model voor het
 * graphql-profiel, plus de afgeleide connectoren en de schema-validatie.
 *
 *   typen       → elementen (id = typenaam bij import), velden als regels;
 *   implements  → implements-connector, union-leden → lid-connector;
 *   schema      → één «schema»-element met root-connectoren (rol op de lijn);
 *                 ontbreekt de schema-definitie, dan volgt het element uit de
 *                 standaardnamen Query / Mutation / Subscription.
 *   velden die naar een type wijzen → veldtype-connector (rolnaam = veldnaam),
 *   argumenten die naar een input wijzen → argumenttype-connector. Die twee
 *   zijn AFGELEID: `leidVeldConnectorenAf` berekent ze opnieuw uit de velden,
 *   zodat lijnen en SDL niet uit elkaar kunnen lopen.
 *
 * De terugreis leest alleen velden, implements/lid/root-connectoren en
 * element-data; afgeleide connectoren doen er dan niet toe.
 *
 * Puur (geen React, geen fetch), getest in graphql.test.js.
 */
import { AFGELEIDE_CONNECTOREN, ROOT_ROLLEN, TYPE_ELEMENTEN, gqlRijenPosities } from "./index.js";
import { INGEBOUWDE_SCALARS, basisNaam, normaliseerTypeExpressie, parseTypeExpressie } from "./typeExpressie.js";
import { formatteerArgumenten, naarSdl, parseArgumenten, parseSdl, schemaIsImpliciet } from "./sdl.js";

export const SCHEMA_ID = "__schema__";
const STANDAARD_ROOTS = { query: "Query", mutation: "Mutation", subscription: "Subscription" };
const NAAM = /^[_A-Za-z][_0-9A-Za-z]*$/;

const isConnector = (el) => Boolean(el?.source && el?.target);
const schoon = (obj) => {
  for (const k of Object.keys(obj)) if (obj[k] === undefined || obj[k] === "") delete obj[k];
  return obj;
};

function connector(id, soort, source, target, data = {}) {
  return { id, naam: "", elementType: soort, source, target, compartimenten: [], data };
}

/** Naam → element-id voor alle type-elementen (de eerste wint bij dubbelen). */
function idPerNaam(elements) {
  const uit = new Map();
  for (const el of Object.values(elements || {})) {
    if (isConnector(el) || !TYPE_ELEMENTEN.includes(el.elementType)) continue;
    if (el.naam && !uit.has(el.naam)) uit.set(el.naam, el.id);
  }
  return uit;
}

function veldenVan(el, compartiment = "velden") {
  return (el?.compartimenten || []).filter((c) => c.compartmentType === compartiment).flatMap((c) => c.velden || []);
}

/** Argumenten van een veld; een onleesbare lijst telt als geen argumenten. */
function argumentenVan(veld) {
  try {
    return parseArgumenten(veld?.data?.argumenten);
  } catch {
    return [];
  }
}

/**
 * Bereken de veldtype- en argumenttype-connectoren opnieuw uit de velden.
 * Bestaande afgeleide connectoren verdwijnen; de ids zijn stabiel
 * (`veldtype__<bron>__<veld>`), zodat een herberekening niets verschuift.
 *
 * @param {Record<string, any>} elements
 * @returns {Record<string, any>} nieuwe elements-map
 */
export function leidVeldConnectorenAf(elements) {
  const uit = {};
  for (const [id, el] of Object.entries(elements || {})) {
    if (isConnector(el) && AFGELEIDE_CONNECTOREN.includes(el.elementType)) continue;
    uit[id] = el;
  }
  const ids = idPerNaam(uit);
  const soortVan = (id) => uit[id]?.elementType;
  for (const el of Object.values(elements || {})) {
    if (isConnector(el)) continue;
    if (el.elementType === "object" || el.elementType === "interface") {
      for (const v of veldenVan(el)) {
        const doel = ids.get(basisNaam(v.data?.typeLabel) || "");
        if (doel && ["object", "interface", "union"].includes(soortVan(doel))) {
          const cid = `veldtype__${el.id}__${v.naam}`;
          uit[cid] = connector(cid, "veldtype", el.id, doel, {
            rolnaam: v.naam,
            typeLabel: normaliseerTypeExpressie(v.data?.typeLabel),
          });
        }
        for (const a of argumentenVan(v)) {
          const adoel = ids.get(basisNaam(a.type) || "");
          if (adoel && soortVan(adoel) === "input") {
            const cid = `argumenttype__${el.id}__${v.naam}__${a.naam}`;
            uit[cid] = connector(cid, "argumenttype", el.id, adoel, { rolnaam: `${v.naam}(${a.naam})` });
          }
        }
      }
    }
    if (el.elementType === "directive") {
      for (const a of veldenVan(el, "argumenten")) {
        const adoel = ids.get(basisNaam(a.data?.typeLabel) || "");
        if (adoel && soortVan(adoel) === "input") {
          const cid = `argumenttype__${el.id}__${a.naam}`;
          uit[cid] = connector(cid, "argumenttype", el.id, adoel, { rolnaam: `@${el.naam}(${a.naam})` });
        }
      }
    }
  }
  return uit;
}

const invoerRegel = (a) => ({
  naam: a.naam,
  fieldType: "inputveld",
  data: schoon({ typeLabel: a.type, standaard: a.standaard, beschrijving: a.beschrijving, directives: a.directives }),
});

/**
 * Schema-document → diagramcore-model.
 *
 * @param {ReturnType<typeof parseSdl>} doc
 * @returns {{elements: Record<string, any>, diagrams: Record<string, any>, meta: Record<string, any>}}
 */
export function vanSchemaDocument(doc) {
  let elements = {};
  const typen = doc?.typen || [];
  for (const t of typen) {
    const id = t.soort === "directive" ? `@${t.naam}` : t.naam;
    if (elements[id]) throw new Error(`De naam "${t.naam}" komt meer dan één keer voor in het schema.`);
    const data = schoon({ beschrijving: t.beschrijving, directives: t.directives });
    const el = { id, naam: t.naam, elementType: t.soort, compartimenten: [], data };
    if (t.soort === "object" || t.soort === "interface") {
      el.compartimenten = [
        {
          compartmentType: "velden",
          velden: (t.velden || []).map((v) => ({
            naam: v.naam,
            fieldType: "veld",
            data: schoon({
              typeLabel: v.type,
              argumenten: formatteerArgumenten(v.argumenten),
              beschrijving: v.beschrijving,
              directives: v.directives,
            }),
          })),
        },
      ];
    } else if (t.soort === "input") {
      el.compartimenten = [{ compartmentType: "velden", velden: (t.velden || []).map(invoerRegel) }];
    } else if (t.soort === "enum") {
      el.compartimenten = [
        {
          compartmentType: "waarden",
          velden: (t.waarden || []).map((w) => ({
            naam: w.naam,
            fieldType: "literal",
            data: schoon({ beschrijving: w.beschrijving, directives: w.directives }),
          })),
        },
      ];
    } else if (t.soort === "directive") {
      el.data = schoon({
        beschrijving: t.beschrijving,
        locaties: (t.locaties || []).join(" | "),
        herhaalbaar: t.herhaalbaar || undefined,
      });
      el.compartimenten = [{ compartmentType: "argumenten", velden: (t.argumenten || []).map(invoerRegel) }];
    }
    elements[id] = el;
  }

  // implements + union-leden: alleen als het doel getekend is (de validatie
  // meldt wat ontbreekt).
  for (const t of typen) {
    for (const i of t.implements || []) {
      if (elements[i]) elements[`implements__${t.naam}__${i}`] = connector(`implements__${t.naam}__${i}`, "implements", t.naam, i);
    }
    for (const l of t.leden || []) {
      if (elements[l]) elements[`lid__${t.naam}__${l}`] = connector(`lid__${t.naam}__${l}`, "lid", t.naam, l);
    }
  }

  // schema-element + roots: expliciet uit de definitie, anders de standaardnamen.
  const roots = doc?.schema
    ? doc.schema
    : Object.fromEntries(ROOT_ROLLEN.filter((r) => elements[STANDAARD_ROOTS[r]]).map((r) => [r, STANDAARD_ROOTS[r]]));
  if (doc?.schema || ROOT_ROLLEN.some((r) => roots[r])) {
    elements[SCHEMA_ID] = {
      id: SCHEMA_ID,
      naam: "schema",
      elementType: "schema",
      compartimenten: [],
      data: schoon({ beschrijving: doc?.beschrijving, directives: doc?.schema?.directives }),
    };
    for (const rol of ROOT_ROLLEN) {
      if (roots[rol] && elements[roots[rol]]) {
        elements[`root__${rol}`] = connector(`root__${rol}`, "root", SCHEMA_ID, roots[rol], { rol });
      }
    }
  }

  elements = leidVeldConnectorenAf(elements);

  const knopen = Object.values(elements).filter((el) => !isConnector(el));
  const edges = Object.values(elements)
    .filter(isConnector)
    .map((el) => ({ source: el.source, target: el.target }));
  const posities = gqlRijenPosities({ ids: knopen.map((el) => el.id), elements, edges });
  return {
    elements,
    diagrams: {
      schema: {
        id: "schema",
        naam: "Schema",
        nodes: knopen.map((el) => ({ elementId: el.id, position: posities[el.id] })),
        edges: [],
      },
    },
    meta: { gqlSchemaExpliciet: Boolean(doc?.schema) },
  };
}

function invoerveldUit(regel, plek) {
  const type = normaliseerTypeExpressie(regel.data?.typeLabel);
  if (!regel.naam) throw new Error(`${plek}: een regel heeft geen naam.`);
  if (!parseTypeExpressie(type)) throw new Error(`${plek}.${regel.naam} heeft geen geldig type ("${type}").`);
  return schoon({
    naam: regel.naam,
    type,
    standaard: regel.data?.standaard,
    beschrijving: regel.data?.beschrijving,
    directives: regel.data?.directives,
  });
}

/**
 * Diagramcore-model → schema-document. Streng: een veld zonder naam of met
 * een ongeldig type geeft een fout met de plek, want daar valt geen geldige
 * SDL van te maken.
 *
 * @param {{elements?: Record<string, any>, meta?: Record<string, any>}} state
 */
export function naarSchemaDocument(state) {
  const elements = state?.elements || {};
  const alle = Object.values(elements);
  const naamVan = (id) => elements[id]?.naam || id;
  const connsVan = (id, soort) => alle.filter((el) => isConnector(el) && el.elementType === soort && el.source === id);

  const doc = { schema: null, typen: [] };
  for (const el of alle) {
    if (isConnector(el)) continue;
    const basis = { soort: el.elementType, naam: el.naam };
    const staart = { beschrijving: el.data?.beschrijving, directives: el.data?.directives };
    if (el.elementType === "object" || el.elementType === "interface") {
      doc.typen.push(
        schoon({
          ...basis,
          implements: connsVan(el.id, "implements").map((c) => naamVan(c.target)),
          velden: veldenVan(el).map((v) => {
            const type = normaliseerTypeExpressie(v.data?.typeLabel);
            if (!v.naam) throw new Error(`${el.naam}: een veld heeft geen naam.`);
            if (!parseTypeExpressie(type)) throw new Error(`${el.naam}.${v.naam} heeft geen geldig type ("${type}").`);
            let argumenten;
            try {
              argumenten = parseArgumenten(v.data?.argumenten);
            } catch (e) {
              throw new Error(`${el.naam}.${v.naam}: de argumenten zijn geen geldige SDL — ${e.bericht || e.message}`);
            }
            return schoon({
              naam: v.naam,
              type,
              argumenten,
              beschrijving: v.data?.beschrijving,
              directives: v.data?.directives,
            });
          }),
          ...staart,
        })
      );
    } else if (el.elementType === "union") {
      doc.typen.push(schoon({ ...basis, leden: connsVan(el.id, "lid").map((c) => naamVan(c.target)), ...staart }));
    } else if (el.elementType === "enum") {
      doc.typen.push(
        schoon({
          ...basis,
          waarden: veldenVan(el, "waarden").map((w) =>
            schoon({ naam: w.naam, beschrijving: w.data?.beschrijving, directives: w.data?.directives })
          ),
          ...staart,
        })
      );
    } else if (el.elementType === "input") {
      doc.typen.push(schoon({ ...basis, velden: veldenVan(el).map((v) => invoerveldUit(v, el.naam)), ...staart }));
    } else if (el.elementType === "scalar") {
      doc.typen.push(schoon({ ...basis, ...staart }));
    } else if (el.elementType === "directive") {
      doc.typen.push(
        schoon({
          ...basis,
          argumenten: veldenVan(el, "argumenten").map((v) => invoerveldUit(v, `@${el.naam}`)),
          herhaalbaar: Boolean(el.data?.herhaalbaar),
          locaties: String(el.data?.locaties || "")
            .split(/[|,\s]+/)
            .filter(Boolean),
          beschrijving: el.data?.beschrijving,
        })
      );
    } else if (el.elementType === "schema") {
      const s = schoon({ directives: el.data?.directives });
      for (const c of connsVan(el.id, "root")) s[c.data?.rol || "query"] = naamVan(c.target);
      doc.schema = s;
      if (el.data?.beschrijving) doc.beschrijving = el.data.beschrijving;
    }
  }
  // De definitie valt weg als ze niets toevoegt aan de standaardnamen — tenzij
  // de bron haar expliciet had (dan blijft ze, voor een stabiele terugreis).
  if (doc.schema && !state?.meta?.gqlSchemaExpliciet && schemaIsImpliciet(doc)) doc.schema = null;
  return doc;
}

/** SDL-tekst → diagramcore-model (gooit SdlFout met regel en kolom). */
export function vanSdl(tekst) {
  return vanSchemaDocument(parseSdl(tekst));
}

/** Diagramcore-model → SDL-tekst. */
export function naarSdlTekst(state) {
  return naarSdl(naarSchemaDocument(state), { altijdSchema: Boolean(state?.meta?.gqlSchemaExpliciet) });
}

/**
 * Schema-validatie op profielniveau (voorstel §8). Niet-blokkerend: een lijst
 * meldingen met de plek, zodat een inspector erheen kan springen.
 *
 * @param {{elements?: Record<string, any>}} state
 * @returns {{niveau: "fout"|"waarschuwing", elementId: string, veld?: string, bericht: string}[]}
 */
export function valideerSchema(state) {
  const elements = state?.elements || {};
  const alle = Object.values(elements);
  const knopen = alle.filter((el) => !isConnector(el));
  const meldingen = [];
  const meld = (elementId, bericht, veld, niveau = "fout") =>
    meldingen.push(schoon({ niveau, elementId, veld, bericht }));

  // Namen: geldig, niet gereserveerd, uniek over alle typen.
  const gezien = new Map();
  for (const el of knopen) {
    if (!TYPE_ELEMENTEN.includes(el.elementType) && el.elementType !== "directive") continue;
    if (!NAAM.test(el.naam || "")) meld(el.id, `"${el.naam}" is geen geldige GraphQL-naam.`);
    else if (el.naam.startsWith("__")) meld(el.id, `Namen die met "__" beginnen zijn gereserveerd voor introspectie.`);
    if (el.elementType === "directive") continue;
    if (INGEBOUWDE_SCALARS.includes(el.naam)) meld(el.id, `"${el.naam}" is een ingebouwde scalar en mag niet opnieuw gedefinieerd worden.`);
    if (gezien.has(el.naam)) meld(el.id, `De typenaam "${el.naam}" komt meer dan één keer voor.`);
    gezien.set(el.naam, el);
  }
  const soortVanNaam = (naam) => (INGEBOUWDE_SCALARS.includes(naam) ? "scalar" : gezien.get(naam)?.elementType);
  const UITVOER = ["scalar", "enum", "object", "interface", "union"];
  const INVOER = ["scalar", "enum", "input"];

  const controleerType = (el, veldNaam, expressie, toegestaan, wat) => {
    const basis = basisNaam(expressie);
    if (!basis) return meld(el.id, `${wat} heeft geen geldig type ("${expressie || ""}").`, veldNaam);
    const soort = soortVanNaam(basis);
    if (!soort) return meld(el.id, `${wat} verwijst naar het onbekende type "${basis}".`, veldNaam);
    if (!toegestaan.includes(soort)) {
      meld(el.id, `${wat} gebruikt "${basis}" («${soort}»); hier mag alleen ${toegestaan.join(", ")}.`, veldNaam);
    }
    return undefined;
  };
  const controleerUniek = (el, regels, wat) => {
    const namen = new Set();
    for (const r of regels) {
      if (!NAAM.test(r.naam || "")) meld(el.id, `${wat} "${r.naam}" is geen geldige GraphQL-naam.`, r.naam);
      if (namen.has(r.naam)) meld(el.id, `${wat} "${r.naam}" komt meer dan één keer voor.`, r.naam);
      namen.add(r.naam);
    }
  };

  for (const el of knopen) {
    if (el.elementType === "object" || el.elementType === "interface") {
      const velden = veldenVan(el);
      if (!velden.length) meld(el.id, `${el.naam} heeft geen velden; een ${el.elementType === "object" ? "type" : "interface"} moet er minstens één hebben.`);
      controleerUniek(el, velden, "Veld");
      for (const v of velden) {
        controleerType(el, v.naam, v.data?.typeLabel, UITVOER, `Veld ${el.naam}.${v.naam}`);
        let args = [];
        try {
          args = parseArgumenten(v.data?.argumenten);
        } catch (e) {
          meld(el.id, `De argumenten van ${el.naam}.${v.naam} zijn geen geldige SDL: ${e.bericht || e.message}`, v.naam);
        }
        for (const a of args) controleerType(el, v.naam, a.type, INVOER, `Argument ${el.naam}.${v.naam}(${a.naam})`);
      }
    } else if (el.elementType === "input") {
      const velden = veldenVan(el);
      if (!velden.length) meld(el.id, `${el.naam} heeft geen velden; een input moet er minstens één hebben.`);
      controleerUniek(el, velden, "Veld");
      for (const v of velden) controleerType(el, v.naam, v.data?.typeLabel, INVOER, `Invoerveld ${el.naam}.${v.naam}`);
    } else if (el.elementType === "enum") {
      const waarden = veldenVan(el, "waarden");
      if (!waarden.length) meld(el.id, `${el.naam} heeft geen waarden.`);
      controleerUniek(el, waarden, "Waarde");
    } else if (el.elementType === "union") {
      if (!alle.some((c) => isConnector(c) && c.elementType === "lid" && c.source === el.id)) {
        meld(el.id, `${el.naam} heeft geen leden; een union moet minstens één object-type bevatten.`);
      }
    } else if (el.elementType === "directive") {
      for (const a of veldenVan(el, "argumenten")) {
        controleerType(el, a.naam, a.data?.typeLabel, INVOER, `Argument @${el.naam}(${a.naam})`);
      }
      if (!String(el.data?.locaties || "").trim()) meld(el.id, `@${el.naam} heeft geen locaties (on …).`);
    }
  }

  // implements: het type moet elk veld van de interface hebben, met hetzelfde type.
  for (const c of alle) {
    if (!isConnector(c) || c.elementType !== "implements") continue;
    const type = elements[c.source];
    const iface = elements[c.target];
    if (!type || !iface) continue;
    const eigen = new Map(veldenVan(type).map((v) => [v.naam, v]));
    for (const iv of veldenVan(iface)) {
      const v = eigen.get(iv.naam);
      if (!v) {
        meld(type.id, `${type.naam} implementeert ${iface.naam} maar mist het veld "${iv.naam}".`, iv.naam);
      } else if (normaliseerTypeExpressie(v.data?.typeLabel) !== normaliseerTypeExpressie(iv.data?.typeLabel)) {
        meld(
          type.id,
          `${type.naam}.${iv.naam} heeft type ${v.data?.typeLabel}, de interface ${iface.naam} vraagt ${iv.data?.typeLabel}.`,
          iv.naam,
          "waarschuwing"
        );
      }
    }
  }

  // schema: precies één, met een query-root; elke rol hooguit één keer.
  const schemas = knopen.filter((el) => el.elementType === "schema");
  if (schemas.length > 1) schemas.slice(1).forEach((s) => meld(s.id, "Er mag maar één schema-element zijn."));
  const typeElementen = knopen.some((el) => TYPE_ELEMENTEN.includes(el.elementType));
  if (schemas.length) {
    const rollen = alle.filter((c) => isConnector(c) && c.elementType === "root" && c.source === schemas[0].id);
    const perRol = new Map();
    for (const r of rollen) {
      const rol = r.data?.rol || "query";
      if (perRol.has(rol)) meld(schemas[0].id, `Het schema heeft meer dan één ${rol}-root.`);
      perRol.set(rol, r);
    }
    if (!perRol.has("query")) meld(schemas[0].id, "Het schema heeft geen query-root (verbind het schema met een type en kies rol query).");
  } else if (typeElementen && soortVanNaam("Query") !== "object") {
    meld(knopen[0].id, 'Geen schema-element en geen type "Query": het schema heeft geen query-root.', undefined, "waarschuwing");
  }
  return meldingen;
}
