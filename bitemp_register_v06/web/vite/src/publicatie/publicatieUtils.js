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
 * Vergelijkt een waarde met de waarde uit een [veld=waarde]-filter. Exact gelijk, óf gelijk
 * na dezelfde omzetting als de GraphQL-enumnamen in de backend (dynql sanitizeEnumValue:
 * spatie en koppelteken → "_", overige tekens weg). Zo werken beide schrijfwijzen:
 * [rol=Maakt gebruik van] en [rol=Maakt_gebruik_van]. Die laatste staat in bestaande
 * detail-templates: tot 22-09-2026 gaf GraphQL enum-velden terug als enum-naam.
 */
export function filterWaardeGelijk(waarde, filterWaarde) {
  const a = String(waarde ?? "");
  if (a === filterWaarde) return true;
  return enumNaam(a) === enumNaam(filterWaarde);
}

function enumNaam(s) {
  return String(s ?? "")
    .replace(/[ -]/g, "_")
    .replace(/[^A-Za-z0-9_]/g, "");
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
      huidig = huidig.filter((item) => filterWaardeGelijk(item?.[filter.veld], filter.waarde));
    }
  }
  if (Array.isArray(huidig)) {
    return huidig.filter((v) => v != null).join(", ");
  }
  return huidig ?? null;
}

// ─── Links ───────────────────────────────────────────────────────────────────

/**
 * Maakt van een URL uit een template een bruikbare link, of null als hij niet veilig is.
 * http(s), mailto en paden vanaf "/" blijven zoals ze zijn. Een kaal domein zoals
 * "openwoo.app" of "www.signalen.org/over" (zo staat het vaak in de data) krijgt "https://";
 * zonder dat zou de browser het als pad binnen de publicatiepagina lezen.
 */
export function normaliseerLink(url) {
  const u = String(url ?? "").trim();
  if (/^(https?:|mailto:|\/)/i.test(u)) return u;
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+(:\d+)?([/?#]\S*)?$/i.test(u)) return `https://${u}`;
  return null;
}

// ─── Voorwaardelijke blokken ─────────────────────────────────────────────────

/**
 * Verwerkt voorwaardelijke blokken in een detail-template (vóór het invullen van {{veldpad}}):
 *
 *   {{#if veldpad}} … {{/if}}                 alleen tonen als veldpad een waarde heeft
 *   {{#if veldpad}} … {{else}} … {{/if}}      anders het tweede deel
 *   {{#unless veldpad}} … {{/unless}}         alleen tonen als veldpad leeg is
 *
 * Bedoeld om labels bij lege velden weg te laten, bijv.
 *   {{#if producten.git_repo}} - Git: {{producten.git_repo}}{{/if}}
 *
 * "Heeft een waarde": niet null/undefined, niet "" (na trim), geen lege lijst en niet false.
 * De voorwaarde is een veldpad met dezelfde syntax als {{…}}, inclusief [veld=waarde]-filters;
 * extractVeldpaden neemt hem mee in de GraphQL-query. Blokken mogen genest worden.
 */
export function verwerkVoorwaarden(template, ctx) {
  if (!template) return "";
  // Binnenste blok eerst: een blok zonder geneste #if/#unless erin.
  const re = /\{\{#(if|unless)\s+([^}]+?)\s*\}\}((?:(?!\{\{#(?:if|unless)\s)[\s\S])*?)\{\{\/\1\}\}/;
  let uit = template;
  let m;
  while ((m = re.exec(uit)) !== null) {
    const [geheel, soort, veldpad, inhoud] = m;
    const [dan, anders = ""] = inhoud.split("{{else}}");
    let waar = heeftWaarde(resolveVeldpadUitContext(ctx, veldpad.trim()));
    if (soort === "unless") waar = !waar;
    uit = uit.slice(0, m.index) + (waar ? dan : anders) + uit.slice(m.index + geheel.length);
  }
  return uit;
}

function heeftWaarde(w) {
  if (w == null || w === false) return false;
  if (Array.isArray(w)) return w.length > 0;
  return String(w).trim() !== "";
}

// ─── GraphQL query builder ───────────────────────────────────────────────────

/**
 * Extraheert alle unieke veldpaden uit een template: de {{veldpad}} placeholders én de
 * voorwaarden van {{#if veldpad}} / {{#unless veldpad}}. {{else}}, {{/if}} en {{/unless}}
 * zijn geen veldpaden.
 */
export function extractVeldpaden(template) {
  const paden = new Set();
  const re = /\{\{([^}]+)\}\}/g;
  let match;
  while ((match = re.exec(template)) !== null) {
    const inhoud = match[1].trim();
    if (inhoud === "else" || inhoud.startsWith("/")) continue;
    const voorwaarde = /^#(?:if|unless)\s+(.+)$/.exec(inhoud);
    const pad = voorwaarde ? voorwaarde[1].trim() : inhoud;
    if (pad.startsWith("__")) continue; // __onbekend: pad dat niet in het schema bestaat (graphqlPaden.js)
    paden.add(pad);
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
