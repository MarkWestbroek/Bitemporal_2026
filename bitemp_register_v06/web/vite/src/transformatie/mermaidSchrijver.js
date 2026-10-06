// @ts-check
/**
 * mermaidSchrijver — **schrijver**: plan → Mermaid flowchart-tekst.
 *
 * Laatste stap van een export (docs/TRANSFORMATIES.md §3). De schrijver kent
 * alleen de syntax van Mermaid; wat een actor of een include wordt staat in de
 * regelset. Het plan gebruikt daarom Mermaid-eigen doeltypen:
 *
 *   element.type    "rechthoek" | "afgerond" | "stadion" | "cirkel" | "dubbele-cirkel" |
 *                   "ruit" | "zeshoek" | "subroutine" | "cilinder" | "subgraph"
 *   element.naam    de tekst in de vorm (of de titel van de subgraph)
 *   element.data    { klasse?: string,            // `class id klasse`
 *                     notitie?: string }          // aparte notitie-knoop aan een stippellijn,
 *                                                 // met de naam vet als kopregel (zoals de lezer
 *                                                 // hem weer leest)
 *   element.groep   sleutel van de omvattende subgraph
 *   connector.type  "doorgetrokken" | "gestippeld" | "dik"
 *   connector.data  { label?: string, pijl?: boolean }   // pijl: default true
 *
 * Spiegelbeeld van transformatie/mermaidFlowchart.js (de lezer); een
 * geschreven tekst leest die lezer zonder waarschuwingen terug. Deterministisch:
 * volgorde van het plan, geen tellers. Puur en store-loos.
 */

const INSPRINGING = "    ";
const VORM = {
  rechthoek: ["[", "]"],
  afgerond: ["(", ")"],
  stadion: ["([", "])"],
  cirkel: ["((", "))"],
  "dubbele-cirkel": ["(((", ")))"],
  ruit: ["{", "}"],
  zeshoek: ["{{", "}}"],
  subroutine: ["[[", "]]"],
  cilinder: ["[(", ")]"],
};
const LIJN = {
  doorgetrokken: { pijl: "-->", kaal: "---" },
  gestippeld: { pijl: "-.->", kaal: "-.-" },
  dik: { pijl: "==>", kaal: "===" },
};
const GERESERVEERD = new Set(["end", "graph", "flowchart", "subgraph", "style", "class", "classdef", "click", "linkstyle", "direction", "default"]);

/** Mermaid-knoop-id: alleen letters, cijfers en `_`; nooit een sleutelwoord. */
export function mermaidId(sleutel) {
  let id = String(sleutel || "").replace(/[^\p{L}\p{N}_]+/gu, "_").replace(/^_+|_+$/g, "");
  if (!id || /^\p{N}/u.test(id) || GERESERVEERD.has(id.toLowerCase())) id = `n_${id}`;
  return id;
}

/**
 * Mermaid-ontsnapping met numerieke entiteiten (`#35;` enz. — Mermaid kent
 * geen `&lt;` in knooptekst) en `<br/>` voor regeleinden.
 */
function ontsnap(tekst) {
  return String(tekst ?? "")
    .replace(/#/g, "#35;")
    .replace(/"/g, "#quot;")
    .replace(/</g, "#60;")
    .replace(/>/g, "#62;")
    .replace(/\r?\n/g, "<br/>");
}

/** Tekst in een vorm: aangehaald en ontsnapt. */
export function mermaidTekst(tekst) {
  return `"${ontsnap(tekst)}"`;
}

/** Label op een lijn (`|label|`): geen `|`, hoekhaken als entiteit. */
function mermaidLabel(label) {
  return String(label ?? "")
    .replace(/#/g, "#35;")
    .replace(/\|/g, "#124;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\s*\r?\n\s*/g, " ")
    .trim();
}

/**
 * @param {{elementen: any[], connectoren: any[]}} plan
 * @param {Object} [opties]
 * @param {string} [opties.titel]        - regel `titel:` boven de kop (de lezer maakt er de diagramnaam van)
 * @param {string} [opties.richting]     - LR (default) | TB | …
 * @param {Record<string,string>} [opties.klasseStijlen] - `classDef` per klasse, bv. { note: "fill:#fffde7,…" }
 * @returns {string}
 */
export function planNaarMermaid(plan, { titel = "", richting = "LR", klasseStijlen = {} } = {}) {
  const regels = [];
  const schrijf = (diepte, tekst) => regels.push(INSPRINGING.repeat(diepte) + tekst);

  // Unieke Mermaid-id per plan-element.
  const idVan = new Map();
  const bezet = new Set();
  for (const el of plan.elementen) {
    let id = mermaidId(el.sleutel);
    for (let n = 2; bezet.has(id); n += 1) id = `${mermaidId(el.sleutel)}_${n}`;
    bezet.add(id);
    idVan.set(el.sleutel, id);
  }
  const notitieId = (id) => {
    let n = `N_${id}`;
    for (let k = 2; bezet.has(n); k += 1) n = `N_${id}_${k}`;
    bezet.add(n);
    return n;
  };

  const bekend = new Set(plan.elementen.map((el) => el.sleutel));
  const kinderenVan = (ouder) => plan.elementen.filter((el) => (bekend.has(el.groep) ? el.groep : null) === ouder);
  const klassen = new Map(); // klasse → [ids]
  const notities = []; // { id, naam, tekst }
  const zetKlasse = (klasse, id) => {
    if (!klasse) return;
    if (!klassen.has(klasse)) klassen.set(klasse, []);
    klassen.get(klasse).push(id);
  };

  const schrijfElement = (el, diepte) => {
    const id = idVan.get(el.sleutel);
    if (el.type === "subgraph") {
      schrijf(diepte, `subgraph ${id}[${mermaidTekst(el.naam)}]`);
      for (const kind of kinderenVan(el.sleutel)) schrijfElement(kind, diepte + 1);
      schrijf(diepte, "end");
    } else {
      const [open, dicht] = VORM[el.type] || VORM.rechthoek;
      schrijf(diepte, `${id}${open}${mermaidTekst(el.naam)}${dicht}`);
    }
    zetKlasse(el.data?.klasse, id);
    const notitie = String(el.data?.notitie ?? "").trim();
    if (notitie) notities.push({ id, naam: el.naam, tekst: notitie });
  };

  if (titel) regels.push(`${titel}:`);
  regels.push(`flowchart ${richting}`);
  regels.push("");
  for (const el of kinderenVan(null)) schrijfElement(el, 1);

  if (notities.length) {
    regels.push("");
    schrijf(1, "%% Notities");
    for (const n of notities) {
      n.knoop = notitieId(n.id);
      schrijf(1, `${n.knoop}["<b>${ontsnap(n.naam)}</b><br/>${ontsnap(n.tekst)}"]`);
      zetKlasse("note", n.knoop);
    }
    for (const n of notities) schrijf(1, `${n.id} -.-> ${n.knoop}`);
  }

  if (plan.connectoren.length) {
    regels.push("");
    for (const c of plan.connectoren) {
      const van = idVan.get(c.bron);
      const naar = idVan.get(c.doel);
      if (!van || !naar) continue;
      const lijn = LIJN[c.type] || LIJN.doorgetrokken;
      const pijl = c.data?.pijl === false ? lijn.kaal : lijn.pijl;
      const label = mermaidLabel(c.data?.label);
      schrijf(1, `${van} ${pijl}${label ? `|${label}|` : ""} ${naar}`);
    }
  }

  if (klassen.size) {
    regels.push("");
    for (const [klasse, stijl] of Object.entries(klasseStijlen)) {
      if (klassen.has(klasse)) schrijf(1, `classDef ${klasse} ${stijl};`);
    }
    for (const [klasse, ids] of klassen) schrijf(1, `class ${ids.join(",")} ${klasse};`);
  }
  return regels.join("\n") + "\n";
}
