/**
 * publicatieUtils.js — geëxporteerde hulpfuncties voor PublicatieDetail.
 *
 * Afzonderlijk bestand zodat deze functies unit-testbaar zijn via node:test
 * zonder React-context of bundler nodig te hebben.
 */

// ─── Veldpad-navigatie ───────────────────────────────────────────────────────

/**
 * Parseert een veldpad-segment en extraheert optionele [key=value] filter.
 * Bijv. "initiatief_gemeenten[rol=Maakt gebruik van]" →
 *   { key: "initiatief_gemeenten", filter: { veld: "rol", waarde: "Maakt gebruik van" } }
 */
export function parseSegment(s) {
  const bracketIdx = s.indexOf("[");
  if (bracketIdx === -1) return { key: s, filter: null };
  const key = s.substring(0, bracketIdx);
  const closeIdx = s.indexOf("]", bracketIdx);
  if (closeIdx === -1) return { key: s, filter: null };
  const expr = s.substring(bracketIdx + 1, closeIdx);
  const eqIdx = expr.indexOf("=");
  if (eqIdx === -1) return { key, filter: null };
  return {
    key,
    filter: { veld: expr.substring(0, eqIdx), waarde: expr.substring(eqIdx + 1) },
  };
}

/** Reconstrueert een segment (incl. filter) naar string-vorm. */
export function segmentNaarString(seg) {
  if (!seg.filter) return seg.key;
  return `${seg.key}[${seg.filter.veld}=${seg.filter.waarde}]`;
}

/**
 * Resolvet een veldpad (bijv. "Naam.roepnaam") naar een waarde uit een context-object.
 * Ondersteunt:
 * - Arrays: meervoudige GE's/relaties worden gejoind met ", "
 * - [key=value] filter: filtert arrays voor verdere navigatie
 * - data-skip: "producten.data.naam" werkt ook als GraphQL de data al flatteent
 */
export function resolveVeldpadUitContext(ctx, veldpad) {
  if (!ctx || !veldpad) return null;
  const segmenten = veldpad.split(".").map(parseSegment);
  let huidig = ctx;
  for (let i = 0; i < segmenten.length; i++) {
    if (huidig == null) return null;
    if (Array.isArray(huidig)) {
      const restPad = segmenten.slice(i).map(segmentNaarString).join(".");
      const waarden = huidig
        .map((item) => resolveVeldpadUitContext(item, restPad))
        .filter((v) => v != null && v !== "");
      return waarden.length > 0 ? waarden.join(", ") : null;
    }
    if (typeof huidig !== "object") return null;
    const { key, filter } = segmenten[i];
    // Skip 'data' segmenten: GraphQL flatteent hub→data, maar templates
    // kunnen nog steeds "producten.data.type" gebruiken.
    if (key === "data" && huidig[key] === undefined) {
      continue;
    }
    huidig = huidig[key];
    if (filter && Array.isArray(huidig)) {
      huidig = huidig.filter(
        (item) => String(item?.[filter.veld] ?? "") === filter.waarde
      );
    }
  }
  if (Array.isArray(huidig)) {
    return huidig.filter((v) => v != null).join(", ");
  }
  return huidig ?? null;
}

// ─── GraphQL query builder ───────────────────────────────────────────────────

/** Extraheert alle unieke {{veldpad}} placeholders uit een template. */
export function extractVeldpaden(template) {
  const paden = new Set();
  const re = /\{\{([^}]+)\}\}/g;
  let match;
  while ((match = re.exec(template)) !== null) {
    paden.add(match[1].trim());
  }
  return [...paden];
}

/**
 * Bouwt een geneste selectie-boom uit een lijst veldpaden.
 * Skipt 'data' segmenten (GraphQL flatteent hub→data).
 * Includeert filtervelden voor [key=value] syntax.
 */
export function buildSelectieTree(veldpaden) {
  const tree = {};
  for (const veldpad of veldpaden) {
    const segmenten = veldpad.split(".").map(parseSegment);
    let node = tree;
    for (const seg of segmenten) {
      const key = seg.key;
      if (key === "data") continue;
      if (!node[key]) node[key] = {};
      node = node[key];
      if (seg.filter && !node[seg.filter.veld]) {
        node[seg.filter.veld] = {};
      }
    }
  }
  return tree;
}

/** Converteert een selectie-boom naar een GraphQL selectie-string. */
export function treeNaarGql(tree, indent = "    ") {
  const delen = [];
  for (const [key, subtree] of Object.entries(tree)) {
    if (Object.keys(subtree).length === 0) {
      delen.push(`${indent}${key}`);
    } else {
      delen.push(
        `${indent}${key} {\n${treeNaarGql(subtree, indent + "  ")}\n${indent}}`
      );
    }
  }
  return delen.join("\n");
}

/**
 * Bouwt een GraphQL query voor een full-entity ophaalverzoek op basis van
 * de template veldpaden. Gebruikt full_<padnaam> query met alle benodigde velden.
 */
export function buildGraphQLQuery(template, padnaam, entityId) {
  const veldpaden = extractVeldpaden(template);
  const tree = buildSelectieTree(veldpaden);
  if (!tree.id) tree.id = {};
  const selectie = treeNaarGql(tree);
  return `{\n  full_${padnaam}(id: ${Number(entityId)}) {\n${selectie}\n  }\n}`;
}
