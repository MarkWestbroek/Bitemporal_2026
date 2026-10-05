// @ts-check
/**
 * mermaidFlowchart — **lezer**: Mermaid flowchart-tekst → brongraaf.
 *
 * Eerste stap van een transformatie (zie docs/TRANSFORMATIES.md): een lezer
 * kent alleen de syntax van de bron en levert een neutrale graaf van knopen,
 * groepen en verbindingen. Wat een cirkel of een stippellijn *betekent* in een
 * doelprofiel staat niet hier, maar in een regelset (regels.js).
 *
 * Ondersteunt de gangbare flowchart-syntax:
 *   - `flowchart LR` / `graph TD` (meerdere diagrammen per tekst, ook in
 *     markdown-```-blokken; een regel als `actor model:` of `# Titel` vlak
 *     vóór de kop wordt de titel);
 *   - knopen in alle vormen: `A["t"]`, `A(("t"))`, `A(["t"])`, `A{t}`, …,
 *     met `:::klasse`;
 *   - verbindingen: `-->`, `---`, `-.->`, `==>`, `<-->`, `--o`, `--x`, met
 *     label als `-->|label|` of `-- label -->`, kettingen en `A & B --> C`;
 *   - `subgraph id["titel"] … end` (genest);
 *   - `class A,B naam`; `classDef`, `style`, `linkStyle`, `click` en
 *     `direction` worden overgeslagen (opmaak is geen model).
 *
 * Puur en store-loos.
 */

/**
 * @typedef {Object} BronKnoop
 * @property {string} id
 * @property {string} tekst        - platte tekst, `<br/>` als regeleinde
 * @property {string|null} kop     - vetgedrukte eerste regel (`<b>…</b>`), anders null
 * @property {string} romp         - tekst zonder de kop
 * @property {string|null} vorm    - "rechthoek" | "afgerond" | "stadion" | "cirkel" | … | null (kale id)
 * @property {string[]} klassen
 * @property {string|null} groep   - id van de omvattende subgraph
 * @property {number} regel        - regelnummer in de bron (1-gebaseerd)
 */

/**
 * @typedef {Object} BronGroep
 * @property {string} id
 * @property {string} tekst
 * @property {string[]} klassen
 * @property {string|null} groep
 * @property {number} regel
 */

/**
 * @typedef {Object} BronVerbinding
 * @property {string} id
 * @property {string} bron
 * @property {string} doel
 * @property {"doorgetrokken"|"gestippeld"|"dik"|"onzichtbaar"} lijn
 * @property {boolean} pijl        - pijlpunt aan de doelkant
 * @property {string|null} kop     - ">" | "o" | "x" | null
 * @property {boolean} terug       - ook een pijlpunt aan de bronkant (`<-->`)
 * @property {string} label
 * @property {number} regel
 */

/**
 * @typedef {Object} BronGraaf
 * @property {"mermaid-flowchart"} soort
 * @property {string} titel
 * @property {string} richting
 * @property {BronKnoop[]} knopen
 * @property {BronGroep[]} groepen
 * @property {BronVerbinding[]} verbindingen
 * @property {{regel:number, tekst:string, melding:string}[]} waarschuwingen
 */

const KOP = /^\s*(?:flowchart|graph)\b\s*(TB|TD|BT|LR|RL)?\s*;?\s*$/i;
const ID = /^[\p{L}\p{N}_]+/u;
const OVERSLAAN = /^(classDef|style|linkStyle|click|direction|accTitle|accDescr)\b/;

// [opener, sluiters, vorm] — langste opener eerst.
const VORMEN = [
  ["(((", [")))"], "dubbele-cirkel"],
  ["((", ["))"], "cirkel"],
  ["([", ["])"], "stadion"],
  ["[[", ["]]"], "subroutine"],
  ["[(", [")]"], "cilinder"],
  ["[/", ["/]", "\\]"], "parallellogram"],
  ["[\\", ["\\]", "/]"], "parallellogram"],
  ["{{", ["}}"], "zeshoek"],
  ["(", [")"], "afgerond"],
  ["[", ["]"], "rechthoek"],
  ["{", ["}"], "ruit"],
  [">", ["]"], "vlag"],
];

const LIJN = { "-": "doorgetrokken", ".": "gestippeld", "=": "dik", "~": "onzichtbaar" };

// Label in de lijn zelf: `-- tekst -->`, `-. tekst .->`, `== tekst ==>`.
const LINK_MET_TEKST = [
  { re: /^\s*(<)?--(?!-)\s+(?![>|-])(.+?)\s*--+(>|[ox](?=\s))?/, lijn: "doorgetrokken" },
  { re: /^\s*(<)?-\.(?![.-])\s*(.+?)\s*\.+-(>|[ox](?=\s))?/, lijn: "gestippeld" },
  { re: /^\s*(<)?==(?!=)\s+(?![>|=])(.+?)\s*==+(>|[ox](?=\s))?/, lijn: "dik" },
];
const LINK_KAAL = /^\s*(<)?(--+|-\.+-|==+|~~~+)(>|[ox](?=\s))?\s*(?:\|([^|]*)\|)?/;

const ENTITEITEN = { lt: "<", gt: ">", amp: "&", quot: '"', apos: "'", nbsp: " ", laquo: "«", raquo: "»" };

/** HTML-/Mermaid-entiteiten (`&lt;`, `&#8364;`, `#quot;`, `#35;`) naar tekens. */
function decodeer(tekst) {
  return tekst
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&?#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/[&#]([a-z]+);/gi, (heel, naam) => ENTITEITEN[naam.toLowerCase()] ?? heel);
}

/**
 * Labeltekst opschonen: aanhalingstekens eraf, `<br/>` wordt een regeleinde,
 * overige opmaak-tags vervallen, entiteiten worden tekens. Een vetgedrukte
 * eerste regel komt apart terug als `kop` (gangbaar bij notities).
 *
 * @param {string} ruw
 * @returns {{tekst: string, kop: string|null, romp: string}}
 */
export function schoonTekst(ruw) {
  let s = String(ruw ?? "").trim();
  if (/^"[\s\S]*"$/.test(s) || /^'[\s\S]*'$/.test(s)) s = s.slice(1, -1);
  if (/^`[\s\S]*`$/.test(s)) s = s.slice(1, -1);
  s = s.replace(/<br\s*\/?>/gi, "\n");
  const vet = s.match(/^\s*<(b|strong)>([\s\S]*?)<\/\1>\s*/i);
  const plat = (deel) =>
    decodeer(deel.replace(/<\/?[a-z][^>]*>/gi, ""))
      .split("\n")
      .map((regel) => regel.replace(/[ \t ]+/g, " ").trim())
      .join("\n")
      .trim();
  const tekst = plat(s);
  if (!vet) return { tekst, kop: null, romp: tekst };
  return { tekst, kop: plat(vet[2]), romp: plat(s.slice(vet[0].length)) };
}

/** Lees één knoop (`id`, optioneel vorm+tekst en `:::klasse`) vanaf `pos`. */
function leesKnoop(s, pos) {
  let i = pos;
  while (s[i] === " " || s[i] === "\t") i += 1;
  const m = s.slice(i).match(ID);
  if (!m) return null;
  const knoop = { id: m[0], ruw: null, vorm: null, klassen: [], eind: i + m[0].length };
  i = knoop.eind;

  for (const [opener, sluiters, vorm] of VORMEN) {
    if (!s.startsWith(opener, i)) continue;
    let j = i + opener.length;
    while (s[j] === " ") j += 1;
    let tekstEind;
    if (s[j] === '"') {
      // Aangehaalde tekst mag elk teken bevatten, ook de sluiter.
      const dicht = s.indexOf('"', j + 1);
      if (dicht < 0) return null;
      tekstEind = dicht + 1;
    } else {
      const kandidaten = sluiters.map((sl) => s.indexOf(sl, j)).filter((k) => k >= 0);
      if (!kandidaten.length) return null;
      tekstEind = Math.min(...kandidaten);
    }
    let k = tekstEind;
    while (s[k] === " ") k += 1;
    const sluiter = sluiters.find((sl) => s.startsWith(sl, k));
    if (!sluiter) return null;
    knoop.ruw = s.slice(j, tekstEind);
    knoop.vorm = vorm;
    knoop.eind = k + sluiter.length;
    break;
  }

  const klasse = s.slice(knoop.eind).match(/^:::([\p{L}\p{N}_-]+)/u);
  if (klasse) {
    knoop.klassen.push(klasse[1]);
    knoop.eind += klasse[0].length;
  }
  return knoop;
}

/** Eén of meer knopen, gescheiden door `&`. */
function leesKnoopGroep(s, pos) {
  const knopen = [];
  let i = pos;
  for (;;) {
    const knoop = leesKnoop(s, i);
    if (!knoop) return null;
    knopen.push(knoop);
    i = knoop.eind;
    const en = s.slice(i).match(/^\s*&\s*/);
    if (!en) return { knopen, eind: i };
    i += en[0].length;
  }
}

/** Lees een verbinding (pijl) vanaf `pos`; null als er geen staat. */
function leesLink(s, pos) {
  const rest = s.slice(pos);
  for (const { re, lijn } of LINK_MET_TEKST) {
    const m = rest.match(re);
    if (m) return { lijn, terug: !!m[1], kop: m[3] || null, label: schoonTekst(m[2]).tekst, eind: pos + m[0].length };
  }
  const m = rest.match(LINK_KAAL);
  if (!m) return null;
  return {
    lijn: LIJN[m[2][1] === "." ? "." : m[2][0]],
    terug: !!m[1],
    kop: m[3] || null,
    label: m[4] != null ? schoonTekst(m[4]).tekst : "",
    eind: pos + m[0].length,
  };
}

/** Verdeel de tekst in diagrammen: per `flowchart`-kop een titel en de regels. */
function splitsDiagrammen(tekst) {
  const regels = String(tekst || "").split(/\r?\n/);
  const heeftBlokken = regels.some((r) => /^\s*```/.test(r));
  /** @type {{titel: string, richting: string, regels: {nr:number, tekst:string}[]}[]} */
  const diagrammen = [];
  let huidig = null;
  let inBlok = false;
  let titel = "";

  // `# Titel`, `title: Titel` of `Titel:`; niet-streng telt elke regel.
  const titelUit = (kaal, streng) => {
    const kop = kaal.match(/^#+\s+(.+)$/) || kaal.match(/^title\s*:\s*(.+)$/i) || kaal.match(/^(.+?)\s*:$/);
    if (!kop && streng) return "";
    return (kop ? kop[1] : kaal).trim().replace(/^["']|["']$/g, "");
  };

  // Staat er na regel i (lege regels en commentaar daargelaten) een kop?
  const kopVolgt = new Array(regels.length).fill(false);
  let volgendeIsKop = false;
  for (let i = regels.length - 1; i >= 0; i -= 1) {
    kopVolgt[i] = volgendeIsKop;
    const kaal = regels[i].trim();
    if (kaal && !kaal.startsWith("%%") && kaal !== "---") volgendeIsKop = KOP.test(kaal);
  }

  regels.forEach((regel, index) => {
    const kaal = regel.trim();
    if (/^```/.test(kaal)) {
      inBlok = !inBlok;
      if (!inBlok) huidig = null;
      return;
    }
    if (heeftBlokken && !inBlok) {
      // Lopende tekst rond de blokken: alleen een herkenbare kopregel telt.
      if (kaal) titel = titelUit(kaal, true);
      return;
    }
    const kop = kaal.match(KOP);
    if (kop) {
      huidig = { titel, richting: (kop[1] || "TB").toUpperCase(), regels: [] };
      diagrammen.push(huidig);
      titel = "";
      return;
    }
    // Een regel direct vóór de volgende kop is de titel van dát diagram.
    if (kaal && !kaal.startsWith("%%") && kaal !== "---" && kopVolgt[index]) {
      titel = titelUit(kaal, false);
      return;
    }
    if (huidig) huidig.regels.push({ nr: index + 1, tekst: regel });
  });
  return diagrammen;
}

/**
 * Lees alle flowcharts uit een tekst.
 *
 * @param {string} tekst
 * @returns {BronGraaf[]}
 */
export function leesMermaidFlowcharts(tekst) {
  return splitsDiagrammen(tekst).map(leesDiagram);
}

/** Herkenning voor de bestandskiezer. */
export function lijktOpMermaidFlowchart({ naam, tekst }) {
  const heeftKop = /^\s*(flowchart|graph)\s+(TB|TD|BT|LR|RL)\b/im.test(String(tekst || "").slice(0, 20000));
  if (!heeftKop) return 0;
  return /\.(mmd|mermaid)$/i.test(String(naam || "")) ? 1 : 0.8;
}

function leesDiagram({ titel, richting, regels }) {
  /** @type {Map<string, BronKnoop>} */
  const knopen = new Map();
  /** @type {Map<string, BronGroep>} */
  const groepen = new Map();
  /** @type {BronVerbinding[]} */
  const verbindingen = [];
  const waarschuwingen = [];
  const stapel = [];
  let naamloos = 0;

  const huidigeGroep = () => (stapel.length ? stapel[stapel.length - 1] : null);

  const registreer = (gelezen, nr) => {
    if (groepen.has(gelezen.id) && gelezen.vorm == null) {
      groepen.get(gelezen.id).klassen.push(...gelezen.klassen);
      return;
    }
    let knoop = knopen.get(gelezen.id);
    if (!knoop) {
      knoop = { id: gelezen.id, tekst: gelezen.id, kop: null, romp: gelezen.id, vorm: null, klassen: [], groep: null, regel: nr };
      knopen.set(gelezen.id, knoop);
    }
    if (gelezen.vorm != null) Object.assign(knoop, schoonTekst(gelezen.ruw), { vorm: gelezen.vorm });
    for (const klasse of gelezen.klassen) if (!knoop.klassen.includes(klasse)) knoop.klassen.push(klasse);
    // Mermaid: een knoop hoort bij de subgraph waarin hij (voor het eerst) staat.
    if (knoop.groep == null && huidigeGroep()) knoop.groep = huidigeGroep();
  };

  const leesKetting = (s, nr) => {
    let pos = 0;
    while (pos < s.length) {
      const wit = s.slice(pos).match(/^[\s;]*/);
      pos += wit[0].length;
      if (pos >= s.length) return;
      let groep = leesKnoopGroep(s, pos);
      if (!groep) {
        waarschuwingen.push({ regel: nr, tekst: s.trim(), melding: "Regel niet begrepen" });
        return;
      }
      groep.knopen.forEach((k) => registreer(k, nr));
      pos = groep.eind;
      for (;;) {
        const link = leesLink(s, pos);
        if (!link) break;
        const volgende = leesKnoopGroep(s, link.eind);
        if (!volgende) {
          waarschuwingen.push({ regel: nr, tekst: s.trim(), melding: "Verbinding zonder doel" });
          return;
        }
        volgende.knopen.forEach((k) => registreer(k, nr));
        for (const bron of groep.knopen) {
          for (const doel of volgende.knopen) {
            verbindingen.push({
              id: `v${verbindingen.length + 1}`,
              bron: bron.id,
              doel: doel.id,
              lijn: link.lijn,
              pijl: link.kop === ">",
              kop: link.kop,
              terug: link.terug,
              label: link.label,
              regel: nr,
            });
          }
        }
        groep = volgende;
        pos = volgende.eind;
      }
      const rest = s.slice(pos).trim();
      if (rest && !rest.startsWith(";")) {
        waarschuwingen.push({ regel: nr, tekst: s.trim(), melding: `Rest van de regel niet begrepen: ${rest}` });
        return;
      }
    }
  };

  for (const { nr, tekst } of regels) {
    if (tekst.trim().startsWith("%%")) continue;
    const s = tekst.trim().replace(/\s+%%.*$/, "");
    if (!s || s === "---") continue;
    if (OVERSLAAN.test(s)) continue;

    const sub = s.match(/^subgraph\b\s*(.*)$/);
    if (sub) {
      const rest = sub[1].trim().replace(/;$/, "");
      const metTitel = rest.match(/^([\p{L}\p{N}_-]+)\s*\[([\s\S]*)\]$/u);
      naamloos += 1;
      const id = metTitel ? metTitel[1] : /^[\p{L}\p{N}_-]+$/u.test(rest) ? rest : `groep_${naamloos}`;
      const groepTekst = schoonTekst(metTitel ? metTitel[2] : rest).tekst || id;
      // Een eerder kaal genoemde knoop met dit id blijkt een groep te zijn.
      if (knopen.get(id)?.vorm == null) knopen.delete(id);
      groepen.set(id, { id, tekst: groepTekst, klassen: [], groep: huidigeGroep(), regel: nr });
      stapel.push(id);
      continue;
    }
    if (/^end\s*;?$/.test(s)) {
      if (stapel.length) stapel.pop();
      else waarschuwingen.push({ regel: nr, tekst: s, melding: "`end` zonder subgraph" });
      continue;
    }
    const klasse = s.match(/^class\s+(.+?)\s+([\p{L}\p{N}_-]+)\s*;?$/u);
    if (klasse) {
      for (const id of klasse[1].split(",").map((deel) => deel.trim()).filter(Boolean)) {
        const doel = knopen.get(id) || groepen.get(id);
        if (doel && !doel.klassen.includes(klasse[2])) doel.klassen.push(klasse[2]);
        else if (!doel) waarschuwingen.push({ regel: nr, tekst: s, melding: `Klasse voor onbekende knoop ${id}` });
      }
      continue;
    }
    leesKetting(s, nr);
  }
  if (stapel.length) waarschuwingen.push({ regel: 0, tekst: "", melding: `Subgraph ${stapel[stapel.length - 1]} is niet afgesloten met end` });

  return {
    soort: "mermaid-flowchart",
    titel,
    richting,
    knopen: [...knopen.values()],
    groepen: [...groepen.values()],
    verbindingen,
    waarschuwingen,
  };
}
