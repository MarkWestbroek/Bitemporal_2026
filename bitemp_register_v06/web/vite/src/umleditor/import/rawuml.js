/**
 * rawuml.js — RawUML: het neutrale tussenformaat voor UML-importers.
 *
 * # Wat is RawUML?
 *
 * RawUML (= "raw UML") is het syntactisch ruwe tussenformaat tussen de
 * tekstuele UML-bronnen (Mermaid, PlantUML) en de editor-shape die React Flow
 * gebruikt (`{nodes, edges}` met `metamodel`-edges en kleuren/posities).
 *
 * Het scheidt **parsen** (bron → RawUML) van **interpretatie** (RawUML →
 * editor). Daarmee bereiken we drie dingen:
 *
 *   1. **Eén interpretatie-laag** — alle stereotype-mapping, ID-generatie,
 *      kleurkeuze, edge-richting, generalisatie-omdraai en placeholder-logica
 *      leeft op één plek (`rawUMLNaarEditor`). Bug-fixes hoeven niet in drie
 *      parsers gereproduceerd te worden.
 *
 *   2. **Pure parsers** — `mermaidNaarRaw`/`plantumlNaarRaw` zijn klein en
 *      doen alleen wat hun bron uniek maakt: tokenisatie, comment-stripping,
 *      block-grenzen. Ze hoeven niets te weten over editor-conventies.
 *
 *   3. **Voorspelbare orphan-detectie** — alle drie de bronnen leveren ruwe
 *      "deze relatie heeft geen bron-entiteit"-situaties op die we *vóór* de
 *      conversie naar editor-shape willen oplossen. Door RawUML als
 *      tussenstap te hebben, kunnen we orphans neutraal beschrijven en de
 *      gebruiker keuzes laten maken zonder eerst placeholders te maken.
 *
 * # Filosofie: dichter bij de bron dan bij de editor
 *
 * RawUML is bewust een **dunne, name-gebaseerde** structuur:
 *
 *   - referenties tussen elementen gaan via `naam` (string), niet via ID,
 *     omdat Mermaid en PlantUML geen stabiele IDs kennen
 *   - `stereotypes[]` blijft een ruwe lijst lowercase-strings (zonder `<<>>`),
 *     het mappen naar een `metatype` is een interpretatie-stap
 *   - `kardinaliteit`/`rol` blijven losse strings ("0..*", "owner") die in
 *     de adapter genormaliseerd worden naar momentvoorkomen
 *   - posities zijn optioneel — alleen XMI/EA levert ze, Mermaid/PlantUML
 *     krijgen een gridpositie van de adapter
 *   - edges hebben een **soort** (associatie/compositie/aggregatie/
 *     generalisatie/dependency) die rechtstreeks uit de pijl-syntax komt;
 *     interpretatie naar editor-edges (compositie → metamodel-edge,
 *     generalisatie-richting omdraaien, ASOC-promotion overslaan) gebeurt
 *     in de adapter
 *
 * # Wat RawUML níet bevat
 *
 *   - geen editor-IDs (de adapter genereert die)
 *   - geen `data.kleur` / `data.metatype` (afgeleid in de adapter)
 *   - geen `associatieAnker`-nodes (puur editor-concept)
 *   - geen `isAssociation` / `isAssociationClassLink` edge-flags
 *   - geen V3-export-velden (`weergaveVeld`, `goType`, etc.)
 *
 * # Scope: waarom XMI niet via RawUML loopt
 *
 * XMI-bronnen (Enterprise Architect 1.1) zijn structureel rijker dan Mermaid/
 * PlantUML:
 *
 *   - elementen hebben **stabiele `xmi.id`s** waarmee de bron al een echte
 *     graaf vormt — RawUML's name-based referenties zouden informatie
 *     verliezen
 *   - EA's `AssociationClass`-patroon bestaat uit een `Class` + een
 *     `Association` met `conID`-tagged-value, wat een directe mapping naar
 *     het editor-anker-patroon is — een tussenstap zou dit alleen maar
 *     ingewikkelder maken
 *   - MIM-tagged-values (`Indicatie materiële historie`,
 *     `Heeft tijdlijn geldigheid`, etc.) hebben EA-specifieke namen die
 *     direct op editor-velden mappen
 *   - EA-extensie-elementen leveren posities die anders verloren zouden gaan
 *
 * Daarom houdt {@link file://./importXMI.js importXMI.js} z'n eigen pad. De
 * orphan-helpers ({@link detecteerOrphans}, {@link pasOrphanActiesToe})
 * werken wél op alle drie, omdat die op de editor-shape opereren — na
 * conversie.
 *
 * Zie ook: `bitemp_register_v06/docs/RAWUML.md` voor het uitgebreide
 * ontwerpdocument.
 *
 * @module import/rawuml
 */

import { generateId, defaultKleur } from "../metamodel/types.js";
import { mapStereotypesNaarMeta } from "./_helpers.js";

// ============================================================================
// Type-definities
// ============================================================================

/**
 * Eén "klasse" of vergelijkbaar element in de bron.
 *
 * @typedef {Object} RawUMLNode
 * @property {string}                naam        Gebruikte als referentie-key in edges.
 * @property {string[]}              stereotypes Lowercase, zonder `<<>>`. Bv. ["entiteit", "materieel"].
 * @property {Object<string,string>} [taggedValues] Generieke key/value-paren
 *                                               (bv. `{ "bitemp::metatype": "rel" }`).
 * @property {RawUMLVeld[]}          [velden]    Voor entiteit/GE/relatie/datatype.
 * @property {string[]}              [enumWaarden] Voor enumeraties.
 * @property {string}                [description]
 * @property {{x:number,y:number}}   [positie]   Optioneel; XMI/EA levert dit.
 * @property {string}                [bronId]    Originele ID uit bron (XMI xmi.id).
 *
 * @typedef {Object} RawUMLVeld
 * @property {string}  naam
 * @property {string}  [type]            Ruw type-token uit bron (bv. "int", "Datum", "string").
 * @property {string}  [format]          Optioneel format-hint (bv. "date").
 * @property {boolean} [isAfgeleid]
 * @property {string}  [defaultWaarde]
 * @property {boolean} [verplicht]       `true` voor `+` (public), anders `false`.
 *
 * @typedef {("associatie"|"compositie"|"aggregatie"|"generalisatie"|"dependency")} RawUMLEdgeSoort
 *
 * @typedef {Object} RawUMLEdge
 * @property {string}            bronNaam
 * @property {string}            doelNaam
 * @property {RawUMLEdgeSoort}   soort
 * @property {string}            [bronKardinaliteit]   "1", "0..*", etc.
 * @property {string}            [doelKardinaliteit]
 * @property {string}            [bronRol]
 * @property {string}            [doelRol]
 * @property {string}            [label]               Edge-label uit `: ...`.
 * @property {boolean}           [directioneel]
 *
 * @typedef {Object} RawUMLModel
 * @property {RawUMLNode[]}                       nodes
 * @property {RawUMLEdge[]}                       edges
 * @property {("mermaid"|"plantuml"|"xmi")}       bronFormaat
 * @property {string[]}                           [waarschuwingen]
 */

// ============================================================================
// Adapter: RawUML → editor-shape ({nodes, edges})
// ============================================================================

/**
 * Converteer een {@link RawUMLModel} naar de editor-shape die React Flow
 * verwacht: `{ nodes: [...], edges: [...] }`. Dit is de **enige** plek waar
 * editor-conventies (IDs, kleuren, kardinaliteit-normalisatie, generalisatie-
 * richting) worden toegepast.
 *
 * Wat de adapter doet, in volgorde:
 *
 *   1. **Stereotype-resolutie** per node via {@link mapStereotypesNaarMeta}.
 *      Onbekende stereotypes vallen terug op metatype `"entiteit"`. De
 *      `bitemp::metatype` taggedValue wordt mee-aangeboden aan de resolver.
 *
 *   2. **Node-type-keuze**: enumeratie / gegevenstype / referentielijst-
 *      instantie / entiteit / gegevenselement / relatie. De juiste velden
 *      voor het type worden samengesteld (waarden voor enums, basistype voor
 *      datatypes, velden-array voor de rest).
 *
 *   3. **ID-generatie + naam→id-map**. Edges in RawUML refereren via naam;
 *      hier worden ze omgezet naar editor-IDs.
 *
 *   4. **Auto-positie**: een gridpositie als de bron geen positie levert.
 *      Bron-posities (XMI/EA) worden gerespecteerd.
 *
 *   5. **Edge-conversie**:
 *        - generalisatie → `data.isGeneralization`, richting kind→ouder
 *        - dependency → `data.isDependency`
 *        - associatie/compositie/aggregatie → standaard metamodel-edge met
 *          rolnaam, kardinaliteit, momentvoorkomen
 *
 *   6. **Auto-aanmaken ontbrekende doel-nodes** als entiteit-placeholder
 *      (zoals een edge naar een naam die niet als node voorkomt).
 *
 * Bewust **niet** gedaan: ASOC-promotion van directe entiteit↔entiteit-edges.
 * Een veldloze associatieklasse mag in dit model één bubble blijven; pas als
 * de gebruiker er expliciet velden op zet, promoot de editor zelf.
 *
 * @param {RawUMLModel} ruw
 * @returns {{ nodes: Array, edges: Array }}
 */
export function rawUMLNaarEditor(ruw) {
  const ruwNodes = ruw?.nodes || [];
  const ruwEdges = ruw?.edges || [];

  const nodes = [];
  const naamNaarId = new Map();

  // --- 1+2+3+4: nodes converteren ---
  ruwNodes.forEach((rn, idx) => {
    const node = rawNodeNaarEditor(rn, idx);
    nodes.push(node);
    naamNaarId.set(rn.naam, node.id);
  });

  // --- 5+6: edges converteren ---
  const edges = [];
  for (const re of ruwEdges) {
    // Auto-aanmaken van ontbrekende endpoints
    ensureEntiteitNode(re.bronNaam, nodes, naamNaarId);
    ensureEntiteitNode(re.doelNaam, nodes, naamNaarId);
    edges.push(rawEdgeNaarEditor(re, naamNaarId));
  }

  return { nodes, edges };
}

/**
 * Bouw één editor-node uit één {@link RawUMLNode}.
 *
 * @param {RawUMLNode} rn
 * @param {number} idx Voor auto-positie (grid-fallback).
 * @returns {Object} React Flow node
 */
function rawNodeNaarEditor(rn, idx) {
  const taggedValues = rn.taggedValues || {};
  const bitempMeta = String(taggedValues["bitemp::metatype"] || "").trim();
  const meta = mapStereotypesNaarMeta(
    [...(rn.stereotypes || []), bitempMeta].filter(Boolean)
  );
  const {
    metatype,
    entiteitSubtype,
    relatieSubtype,
    isMaterieel,
    isDatatype,
    isEnum,
    isRefInstantie,
  } = meta;

  const positie = rn.positie || autoPositie(idx);

  // Enumeratie
  if (isEnum) {
    const id = generateId("enum");
    return {
      id,
      type: "enumeratie",
      position: positie,
      data: {
        naam: rn.naam,
        waarden: rn.enumWaarden && rn.enumWaarden.length > 0
          ? rn.enumWaarden
          : (rn.velden || []).map((v) => v.naam).filter(Boolean),
      },
    };
  }

  // Gegevenstype (custom datatype)
  if (isDatatype) {
    const id = generateId("datatype");
    const basistypeVeld = (rn.velden || []).find((v) => v.naam === "basistype");
    const formatVeld = (rn.velden || []).find((v) => v.naam === "format");
    return {
      id,
      type: "gegevenstype",
      position: positie,
      data: {
        id,
        naam: rn.naam,
        description: rn.description || taggedValues.documentation || "",
        basistype: basistypeVeld?.type || basistypeVeld?.defaultWaarde || "string",
        format: formatVeld?.type || formatVeld?.defaultWaarde || "",
        validatie: {},
        normalisatie: "",
        weergave: {},
      },
    };
  }

  // Referentielijst-instantie
  if (isRefInstantie) {
    const id = generateId("refinstantie");
    return {
      id,
      type: "referentielijstInstantie",
      position: positie,
      data: { systeemnaam: rn.naam, naam: rn.naam, omschrijving: rn.description || "" },
    };
  }

  // entiteit / gegevenselement / relatie
  const id = generateId(metatype);
  const velden = (rn.velden || []).map((v) => normaliseerVeld(v));
  return {
    id,
    type: metatype,
    position: positie,
    data: {
      id,
      typenaam: rn.naam,
      description: rn.description || taggedValues.documentation || "",
      metatype,
      isMaterieel: !!isMaterieel,
      kleur: defaultKleur(metatype, entiteitSubtype || relatieSubtype || ""),
      velden,
      ...(entiteitSubtype ? { entiteitSubtype } : {}),
      ...(relatieSubtype ? { relatieSubtype } : {}),
    },
  };
}

/**
 * Normaliseer een ruw veld-token naar de editor-veld-shape.
 *
 * @param {RawUMLVeld} v
 * @returns {Object}
 */
function normaliseerVeld(v) {
  const ruwType = String(v.type || "").trim();
  return {
    naam: v.naam,
    type: mapVeldType(ruwType),
    format: mapVeldFormat(ruwType, v.format),
    enum: null,
    verplicht: v.verplicht !== false,
    autoIncrement: false,
    description: "",
    afgeleid: !!v.isAfgeleid,
    afleidingsregelTaal: v.isAfgeleid ? "cel" : undefined,
    afleidingsregel: v.isAfgeleid ? (v.defaultWaarde || "") : undefined,
  };
}

/**
 * Bouw één editor-edge uit één {@link RawUMLEdge}.
 *
 * Generalisatie-edges worden omgedraaid zodat `source = kind`, `target = ouder`
 * (de editor-conventie). De label gaat naar `naamLabelHeen`.
 *
 * @param {RawUMLEdge}     re
 * @param {Map<string,string>} naamNaarId
 * @returns {Object} React Flow edge
 */
function rawEdgeNaarEditor(re, naamNaarId) {
  const bronId = naamNaarId.get(re.bronNaam);
  const doelId = naamNaarId.get(re.doelNaam);

  if (re.soort === "generalisatie") {
    return {
      id: generateId("edge"),
      source: bronId,
      target: doelId,
      type: "metamodel",
      data: {
        isGeneralization: true,
        naamLabelHeen: re.label || "",
        naamLabelTerug: "",
      },
    };
  }

  if (re.soort === "dependency") {
    return {
      id: generateId("edge"),
      source: bronId,
      target: doelId,
      type: "metamodel",
      data: {
        isDependency: true,
        rolnaam: re.label || "",
        jsonRolnaam: "",
        momentvoorkomen: "",
        kardinaliteit: "",
      },
    };
  }

  // associatie / compositie / aggregatie
  const kard = re.doelKardinaliteit || re.bronKardinaliteit || "0..*";
  return {
    id: generateId("edge"),
    source: bronId,
    target: doelId,
    type: "metamodel",
    data: {
      rolnaam: re.doelRol || re.label || "",
      jsonRolnaam: "",
      momentvoorkomen: kardinaliteitNaarMomentvoorkomen(kard),
      kardinaliteit: kard,
      ...(re.soort === "compositie" ? { isCompositie: true } : {}),
      ...(re.soort === "aggregatie" ? { isAggregatie: true } : {}),
    },
  };
}

/**
 * Maak een fallback-entiteit-node aan als een edge refereert aan een naam
 * die niet als top-level RawUMLNode is gedeclareerd.
 *
 * @param {string} naam
 * @param {Array} nodes
 * @param {Map<string,string>} naamNaarId
 */
function ensureEntiteitNode(naam, nodes, naamNaarId) {
  if (!naam || naamNaarId.has(naam)) return;
  const id = generateId("entiteit");
  naamNaarId.set(naam, id);
  nodes.push({
    id,
    type: "entiteit",
    position: autoPositie(nodes.length),
    data: {
      id,
      typenaam: naam,
      description: "",
      metatype: "entiteit",
      isMaterieel: false,
      kleur: defaultKleur("entiteit"),
      velden: [],
    },
  });
}

// ============================================================================
// Veld-type normalisatie (gedeeld door alle parsers)
// ============================================================================

/**
 * Map een ruw type-token uit de bron naar een editor-veldtype.
 *
 * @param {string} typeStr
 * @returns {("string"|"integer"|"number"|"boolean")}
 */
function mapVeldType(typeStr) {
  const t = String(typeStr || "").toLowerCase();
  if (t === "int" || t === "integer") return "integer";
  if (t === "float64" || t === "number" || t === "float" || t === "double") return "number";
  if (t === "bool" || t === "boolean") return "boolean";
  return "string";
}

/**
 * Map een ruw type-token (eventueel met `format`-hint) naar een
 * format-string voor de editor.
 *
 * @param {string} typeStr
 * @param {string} [formatHint]
 * @returns {string}
 */
function mapVeldFormat(typeStr, formatHint) {
  if (formatHint) return formatHint;
  const t = String(typeStr || "").toLowerCase();
  if (t === "date" || t === "datum") return "date";
  if (t === "datetime") return "date-time";
  if (t === "float64") return "float64";
  return "";
}

/**
 * Klein gridje voor nodes zonder bron-positie.
 *
 * @param {number} index
 * @returns {{x:number, y:number}}
 */
function autoPositie(index) {
  const col = index % 4;
  const row = Math.floor(index / 4);
  return { x: 50 + col * 300, y: 50 + row * 250 };
}

/**
 * Vertaal een kardinaliteits-string naar het momentvoorkomen-enum.
 *
 * @param {string} kard
 * @returns {("enkelvoudig"|"meervoudig")}
 */
function kardinaliteitNaarMomentvoorkomen(kard) {
  const k = String(kard || "").trim();
  if (k === "0..*" || k === "1..*" || k === "*" || k.endsWith("..*")) return "meervoudig";
  return "enkelvoudig";
}

// ============================================================================
// Orphan-detectie (werkt op de editor-shape, ná conversie)
// ============================================================================

/**
 * Vind GE- en relatie-nodes die geen geldige parent-entiteit hebben binnen
 * de geïmporteerde graaf. Veelvoorkomend importprobleem: een Mermaid- of
 * PlantUML-bron noemt een `<<ge>>` of `<<rel>>` zonder dat er een entiteit
 * is om hem aan te koppelen.
 *
 *   - Een GE-node is een orphan als geen edge hem als compositie-target
 *     vanuit een entiteit-node noemt.
 *   - Een relatie-node is een orphan als hij geen edge heeft naar een
 *     entiteit of associatieAnker.
 *
 * @param {{nodes: Array, edges: Array}} graaf
 * @returns {Array<{nodeId:string, type:"gegevenselement"|"relatie", naam:string, reden:string}>}
 */
export function detecteerOrphans(graaf) {
  const nodes = graaf?.nodes || [];
  const edges = graaf?.edges || [];
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const orphans = [];

  for (const n of nodes) {
    if (n.type === "gegevenselement") {
      const heeftParent = edges.some((e) => {
        if (e.target !== n.id) return false;
        const bron = nodeById.get(e.source);
        if (!bron || bron.type !== "entiteit") return false;
        if (e.data?.isDependency) return false;
        if (e.data?.isGeneralization) return false;
        return true;
      });
      if (!heeftParent) {
        orphans.push({
          nodeId: n.id,
          type: "gegevenselement",
          naam: n.data?.typenaam || n.data?.klassenaam || n.data?.naam || n.id,
          reden: "Geen compositie-edge vanuit een entiteit gevonden.",
        });
      }
    } else if (n.type === "relatie") {
      const heeftKoppeling = edges.some((e) => {
        if (e.source !== n.id && e.target !== n.id) return false;
        const ander = nodeById.get(e.source === n.id ? e.target : e.source);
        if (!ander) return false;
        if (ander.type === "entiteit") return true;
        if (ander.type === "associatieAnker") return true;
        return false;
      });
      if (!heeftKoppeling) {
        orphans.push({
          nodeId: n.id,
          type: "relatie",
          naam: n.data?.typenaam || n.data?.klassenaam || n.data?.naam || n.id,
          reden: "Geen koppeling naar een entiteit of associatieAnker gevonden.",
        });
      }
    }
  }

  return orphans;
}

// ============================================================================
// Orphan-acties toepassen
// ============================================================================

/**
 * @typedef {("placeholder"|"overslaan"|"abort")} OrphanActie
 * @typedef {Object<string, OrphanActie>} OrphanActieKeuzes
 *   Map van `nodeId` → gekozen actie.
 */

/**
 * Pas de gekozen acties toe op de geïmporteerde graaf.
 *
 *   - `placeholder`: een gele entiteit-node `Placeholder_<naam>` wordt
 *     aangemaakt en — voor GE — gekoppeld via een compositie-edge; voor
 *     relaties wordt zowel een bron- als een doel-placeholder gemaakt.
 *   - `overslaan`: de orphan-node + alle aangrenzende edges worden verwijderd.
 *   - `abort`: gooit een Error op (`code: "ORPHAN_ABORT"`); de aanroepende
 *     code moet dan de hele import afbreken.
 *
 * @param {{nodes: Array, edges: Array}} graaf
 * @param {Array<{nodeId:string, type:string, naam:string, reden:string}>} orphans
 * @param {OrphanActieKeuzes} keuzes
 * @returns {{nodes: Array, edges: Array, samenvatting: string[]}}
 */
export function pasOrphanActiesToe(graaf, orphans, keuzes) {
  const nodes = [...(graaf?.nodes || [])];
  const edges = [...(graaf?.edges || [])];
  const samenvatting = [];

  // Eerst: abort detecteren — voorkomt half-toegepaste mutaties.
  for (const o of orphans) {
    if (keuzes[o.nodeId] === "abort") {
      const err = new Error(
        `Import afgebroken op orphan ${o.type} "${o.naam}": ${o.reden}`
      );
      err.code = "ORPHAN_ABORT";
      throw err;
    }
  }

  const teVerwijderenNodeIds = new Set();
  for (const o of orphans) {
    const actie = keuzes[o.nodeId] || "placeholder";
    if (actie === "overslaan") {
      teVerwijderenNodeIds.add(o.nodeId);
      samenvatting.push(`Overgeslagen: ${o.type} "${o.naam}"`);
      continue;
    }
    if (actie === "placeholder") {
      if (o.type === "gegevenselement") {
        const placeholder = maakPlaceholderEntiteit(`Placeholder_${o.naam}`);
        nodes.push(placeholder);
        edges.push({
          id: generateId("edge"),
          source: placeholder.id,
          target: o.nodeId,
          type: "metamodel",
          data: { rolnaam: "", momentvoorkomen: "meervoudig", kardinaliteit: "0..*" },
        });
        samenvatting.push(
          `Placeholder-entiteit "${placeholder.data.typenaam}" gekoppeld aan GE "${o.naam}"`
        );
      } else if (o.type === "relatie") {
        const bronPh = maakPlaceholderEntiteit(`Placeholder_${o.naam}_bron`);
        const doelPh = maakPlaceholderEntiteit(`Placeholder_${o.naam}_doel`);
        nodes.push(bronPh, doelPh);
        edges.push({
          id: generateId("edge"),
          source: bronPh.id,
          target: o.nodeId,
          type: "metamodel",
          data: { rolnaam: "", momentvoorkomen: "enkelvoudig" },
        });
        edges.push({
          id: generateId("edge"),
          source: o.nodeId,
          target: doelPh.id,
          type: "metamodel",
          data: { rolnaam: "", momentvoorkomen: "enkelvoudig" },
        });
        samenvatting.push(
          `Placeholder-bron en -doel gekoppeld aan relatie "${o.naam}"`
        );
      }
    }
  }

  let nieuweNodes = nodes;
  let nieuweEdges = edges;
  if (teVerwijderenNodeIds.size > 0) {
    nieuweNodes = nodes.filter((n) => !teVerwijderenNodeIds.has(n.id));
    nieuweEdges = edges.filter(
      (e) => !teVerwijderenNodeIds.has(e.source) && !teVerwijderenNodeIds.has(e.target)
    );
  }

  return { nodes: nieuweNodes, edges: nieuweEdges, samenvatting };
}

/**
 * Maak een placeholder-entiteit-node met opvallende kleur en beschrijving.
 *
 * @param {string} naam
 * @returns {Object}
 */
function maakPlaceholderEntiteit(naam) {
  const id = generateId("entiteit");
  return {
    id,
    type: "entiteit",
    position: { x: 0, y: 0 },
    data: {
      id,
      typenaam: naam,
      description:
        "Placeholder — automatisch aangemaakt bij import omdat de oorspronkelijke parent-entiteit ontbrak. Hernoem of vervang.",
      metatype: "entiteit",
      isMaterieel: false,
      kleur: "#fde68a", // amber-200 — "let op"
      velden: [],
      isPlaceholder: true,
    },
  };
}
