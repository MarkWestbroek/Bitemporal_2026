// @ts-check
/**
 * afleiding — wat het SHACL-profiel uit de parameters van een property shape
 * afleidt, na elke wijziging (`hooks.migreerModel`), bij import en in de
 * tekenaar:
 *
 *   - de weergave van de regel (`data.typeLabel`): `type [kardinaliteit] {facetten}`;
 *   - de verwijzing-pijlen: een regel met sh:class of sh:node wijst naar de
 *     shape die die klasse controleert, anders naar het klasse-element.
 *
 * De parameters zijn de bron; weergave en pijlen volgen. Zo kunnen ze niet uit
 * elkaar lopen (zelfde idee als de veldlijnen van het GraphQL-profiel).
 *
 * Klasse → shape: de shape met die klasse in `doelklassen` (of de shape die zelf
 * de klasse is, `ookKlasse`). Richten meer shapes op dezelfde klasse (RuleShape
 * op Permission, Prohibition en Duty; PermissionShape alleen op Permission),
 * dan wint de meest specifieke: de minste doelklassen, dan het id.
 *
 * Puur en idempotent: null als er niets verandert.
 */

const SHAPES = ["nodeshape", "propertyshape"];
const isConnector = (el) => Boolean(el?.source && el?.target);

/** Komma- of |-gescheiden lijst → losse waarden. */
export const splits = (waarde, scheiding = /[|,]/) =>
  String(waarde ?? "")
    .split(scheiding)
    .map((x) => x.trim())
    .filter(Boolean);

const heeft = (v) => v !== undefined && v !== null && String(v).trim() !== "";

/**
 * Kardinaliteit uit minCount/maxCount. Ontbreken = 0 en *: SHACL zonder
 * maxCount is 0..*, niet de UML-standaard 1.
 */
export function kardinaliteit(min, max) {
  const lo = heeft(min) ? String(min).trim() : "0";
  const hi = heeft(max) ? String(max).trim() : "*";
  return lo === hi ? lo : `${lo}..${hi}`;
}

/** Het type van een regel: datatype, klasse, node of nodeKind. */
export function typeVan(d) {
  const delen = [];
  if (heeft(d.datatype)) delen.push(String(d.datatype).trim());
  if (heeft(d.klasse)) delen.push(String(d.klasse).trim());
  if (heeft(d.node)) delen.push(String(d.node).trim());
  if (!delen.length && heeft(d.nodeKind)) delen.push(String(d.nodeKind));
  return delen.join(" & ");
}

const kort = (tekst, max = 28) => {
  const t = String(tekst).replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
};

/** Facetten tussen {…}: alles wat een regel beperkt behalve type en kardinaliteit. */
export function facettenVan(d) {
  const f = [];
  if (heeft(d.nodeKind) && (heeft(d.datatype) || heeft(d.klasse) || heeft(d.node))) f.push(d.nodeKind);
  if (heeft(d.in)) f.push(`in ${kort(d.in)}`);
  if (heeft(d.hasValue)) f.push(`= ${kort(d.hasValue)}`);
  if (heeft(d.pattern)) f.push(`pattern ${kort(d.pattern, 30)}`);
  for (const k of ["minLength", "maxLength", "minInclusive", "maxInclusive", "minExclusive", "maxExclusive"]) {
    if (heeft(d[k])) f.push(`${k} ${d[k]}`);
  }
  if (heeft(d.languageIn)) f.push(`languageIn ${kort(d.languageIn)}`);
  if (d.uniqueLang === true) f.push("uniqueLang");
  for (const k of ["equals", "disjoint", "lessThan", "lessThanOrEquals"]) if (heeft(d[k])) f.push(`${k} ${d[k]}`);
  if (heeft(d.logica)) {
    const soorten = [...String(d.logica).matchAll(/sh:(or|xone|and|not)\b/g)].map((m) => m[1]);
    f.push(soorten.length ? [...new Set(soorten)].join(", ") : "logica");
  }
  if (heeft(d.severity) && d.severity !== "Violation") f.push(d.severity);
  if (d.gedeactiveerd === true) f.push("deactivated");
  return f;
}

/** De weergave rechts van het pad. */
export function regelWeergave(d) {
  const facetten = facettenVan(d);
  return [typeVan(d), `[${kardinaliteit(d.minCount, d.maxCount)}]`, facetten.length ? `{${facetten.join(", ")}}` : ""]
    .filter(Boolean)
    .join(" ");
}

/** Verwijzing-pijlen opnieuw uit de regels. @param {Record<string, any>} elements */
function pijlen(elements) {
  const shapes = Object.values(elements).filter((el) => !isConnector(el) && SHAPES.includes(el.elementType));
  const klassen = Object.values(elements).filter((el) => !isConnector(el) && el.elementType === "klasse");
  /** klasse → [shape, aantal doelklassen] */
  const perKlasse = new Map();
  const zet = (klasse, shape, n) => {
    const huidig = perKlasse.get(klasse);
    if (!huidig || n < huidig[1] || (n === huidig[1] && shape.id < huidig[0].id)) perKlasse.set(klasse, [shape, n]);
  };
  for (const sh of shapes) {
    const doelen = splits(sh.data?.doelklassen, /,/);
    const n = doelen.length + (sh.data?.ookKlasse ? 1 : 0);
    for (const k of doelen) zet(k, sh, n);
    if (sh.data?.ookKlasse && sh.data?.iri) zet(sh.data.iri, sh, n);
  }
  const shapeVan = (ref) => shapes.find((s) => s.data?.iri === ref) || shapes.find((s) => s.naam === ref);
  const klasseVan = (ref) => klassen.find((k) => (k.data?.iri || k.naam) === ref);

  const uit = {};
  for (const sh of shapes) {
    const regels = (sh.compartimenten || []).filter((c) => c.compartmentType === "eigenschappen").flatMap((c) => c.velden || []);
    regels.forEach((v, n) => {
      const d = v.data || {};
      const doelen = [];
      const klasseRefs = splits(d.klasse, /\|/);
      for (const k of klasseRefs) {
        const doel = perKlasse.get(k)?.[0] || klasseVan(k);
        if (doel) doelen.push({ doel, soort: "klasse" });
      }
      for (const nd of splits(d.node, /\|/)) {
        const doel = shapeVan(nd);
        if (doel) doelen.push({ doel, soort: "node" });
      }
      doelen.forEach(({ doel, soort }, j) => {
        const id = `verw__${sh.id}__${n}__${j}`;
        uit[id] = {
          id,
          naam: "",
          elementType: "verwijzing",
          source: sh.id,
          target: doel.id,
          compartimenten: [],
          data: {
            rolnaam: v.naam || "",
            kardinaliteit: kardinaliteit(d.minCount, d.maxCount),
            soort,
            ...(soort === "klasse" && klasseRefs.length > 1 ? { of: true } : {}),
          },
        };
      });
    });
  }
  return uit;
}

const gelijk = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Weergave en pijlen bijwerken.
 * @param {Record<string, any>|undefined} elements
 * @returns {Record<string, any>|null} nieuwe elements, of null als er niets verandert
 */
export function leidAf(elements) {
  if (!elements) return null;
  let veranderd = false;
  const uit = {};
  for (const [id, el] of Object.entries(elements)) {
    if (isConnector(el) && el.elementType === "verwijzing") continue;
    if (!isConnector(el) && SHAPES.includes(el.elementType)) {
      let elVeranderd = false;
      const compartimenten = (el.compartimenten || []).map((c) => {
        if (c.compartmentType !== "eigenschappen") return c;
        const velden = (c.velden || []).map((v) => {
          const typeLabel = regelWeergave(v.data || {});
          if (v.data?.typeLabel === typeLabel) return v;
          elVeranderd = true;
          return { ...v, data: { ...(v.data || {}), typeLabel } };
        });
        return elVeranderd ? { ...c, velden } : c;
      });
      uit[id] = elVeranderd ? { ...el, compartimenten } : el;
      if (elVeranderd) veranderd = true;
    } else uit[id] = el;
  }
  const nieuw = pijlen(uit);
  const oud = Object.fromEntries(Object.entries(elements).filter(([, el]) => isConnector(el) && el.elementType === "verwijzing"));
  if (!gelijk(Object.keys(nieuw).sort(), Object.keys(oud).sort())) veranderd = true;
  else {
    for (const [id, c] of Object.entries(nieuw)) {
      const o = oud[id];
      if (o.source !== c.source || o.target !== c.target || !gelijk(o.data, c.data)) {
        veranderd = true;
        break;
      }
    }
  }
  if (!veranderd) return null;
  // Bestaande pijlen houden hun object (en dus hun eventuele presentatie), alleen bijgewerkt.
  for (const [id, c] of Object.entries(nieuw)) uit[id] = oud[id] ? { ...oud[id], source: c.source, target: c.target, data: c.data } : c;
  return uit;
}
