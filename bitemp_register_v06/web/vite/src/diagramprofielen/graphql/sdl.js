// @ts-check
/**
 * sdl — GraphQL Schema Definition Language ↔ een plat schema-document.
 *
 * Bewust een eigen, kleine parser (zoals de Toegangsspraak-parser): alleen het
 * *typesysteem* (GraphQL-spec §3), geen query-documenten. Zo blijft het
 * profiel zonder dependency en in node testbaar. `extend …` wordt (nog) niet
 * ondersteund en geeft een heldere fout.
 *
 * Het schema-document is de tussenvorm tussen SDL en het diagram-model:
 *
 *   { beschrijving?, schema: { query?, mutation?, subscription?, directives? } | null,
 *     typen: [
 *       { soort: "scalar",   naam, beschrijving?, directives? },
 *       { soort: "object" | "interface", naam, implements: [], velden: [Veld], … },
 *       { soort: "union",    naam, leden: [], … },
 *       { soort: "enum",     naam, waarden: [{ naam, beschrijving?, directives? }], … },
 *       { soort: "input",    naam, velden: [Invoerveld], … },
 *       { soort: "directive", naam, argumenten: [Invoerveld], herhaalbaar, locaties: [] } ] }
 *
 *   Veld       = { naam, type, argumenten: [Invoerveld], beschrijving?, directives? }
 *   Invoerveld = { naam, type, standaard?, beschrijving?, directives? }
 *
 * `type` is een type-expressie als tekst (zie typeExpressie.js); `standaard` en
 * `directives` zijn de ruwe SDL-tekst (`[2024]`, `@deprecated(reason: "…")`):
 * het profiel hoeft waarden niet te begrijpen, alleen te bewaren.
 *
 * Wet (getest): parseSdl(naarSdl(parseSdl(t))) is gelijk aan parseSdl(t).
 */

export class SdlFout extends Error {
  /**
   * @param {string} bericht
   * @param {number} regel
   * @param {number} kolom
   */
  constructor(bericht, regel, kolom) {
    super(`${bericht} (regel ${regel}, kolom ${kolom})`);
    this.name = "SdlFout";
    this.bericht = bericht;
    this.regel = regel;
    this.kolom = kolom;
  }
}

const PUNCT = new Set(["!", "$", "&", "(", ")", ":", "=", "@", "[", "]", "{", "|", "}"]);
const NAAM_START = /[_A-Za-z]/;
const NAAM_DEEL = /[_0-9A-Za-z]/;

/** Positie → {regel, kolom} (1-gebaseerd). */
function plek(bron, index) {
  const voor = bron.slice(0, index);
  const regel = voor.split("\n").length;
  const kolom = index - voor.lastIndexOf("\n");
  return { regel, kolom };
}

function fout(bron, index, bericht) {
  const { regel, kolom } = plek(bron, index);
  return new SdlFout(bericht, regel, kolom);
}

/** Blokstring-waarde volgens de spec (BlockStringValue): gemene inspringing eraf. */
function blokWaarde(ruw) {
  const regels = ruw.split(/\r\n|\n|\r/);
  let gemeen = null;
  for (let i = 1; i < regels.length; i++) {
    const r = regels[i];
    const inspring = r.length - r.trimStart().length;
    if (inspring < r.length && (gemeen === null || inspring < gemeen)) gemeen = inspring;
  }
  if (gemeen) for (let i = 1; i < regels.length; i++) regels[i] = regels[i].slice(gemeen);
  while (regels.length && regels[0].trim() === "") regels.shift();
  while (regels.length && regels[regels.length - 1].trim() === "") regels.pop();
  return regels.join("\n");
}

/**
 * @param {string} bron
 * @returns {{soort: "naam"|"punct"|"getal"|"tekst"|"eof", waarde: string, start: number, eind: number}[]}
 */
function tokeniseer(bron) {
  const tokens = [];
  let i = 0;
  const n = bron.length;
  while (i < n) {
    const c = bron[i];
    if (c === "\uFEFF" || c === " " || c === "\t" || c === "\n" || c === "\r" || c === ",") {
      i += 1;
      continue;
    }
    if (c === "#") {
      while (i < n && bron[i] !== "\n") i += 1;
      continue;
    }
    if (c === "." && bron.startsWith("...", i)) {
      tokens.push({ soort: "punct", waarde: "...", start: i, eind: i + 3 });
      i += 3;
      continue;
    }
    if (PUNCT.has(c)) {
      tokens.push({ soort: "punct", waarde: c, start: i, eind: i + 1 });
      i += 1;
      continue;
    }
    if (NAAM_START.test(c)) {
      let j = i + 1;
      while (j < n && NAAM_DEEL.test(bron[j])) j += 1;
      tokens.push({ soort: "naam", waarde: bron.slice(i, j), start: i, eind: j });
      i = j;
      continue;
    }
    if (c === "-" || (c >= "0" && c <= "9")) {
      const m = /^-?(0|[1-9][0-9]*)(\.[0-9]+)?([eE][+-]?[0-9]+)?/.exec(bron.slice(i));
      if (!m) throw fout(bron, i, "Ongeldig getal");
      tokens.push({ soort: "getal", waarde: m[0], start: i, eind: i + m[0].length });
      i += m[0].length;
      continue;
    }
    if (c === '"') {
      if (bron.startsWith('"""', i)) {
        let j = i + 3;
        let ruw = "";
        for (;;) {
          if (j >= n) throw fout(bron, i, 'Blokstring zonder afsluitende """');
          if (bron.startsWith('\\"""', j)) {
            ruw += '"""';
            j += 4;
          } else if (bron.startsWith('"""', j)) {
            break;
          } else {
            ruw += bron[j];
            j += 1;
          }
        }
        tokens.push({ soort: "tekst", waarde: blokWaarde(ruw), start: i, eind: j + 3 });
        i = j + 3;
        continue;
      }
      let j = i + 1;
      let waarde = "";
      for (;;) {
        if (j >= n || bron[j] === "\n") throw fout(bron, i, "String zonder afsluitend aanhalingsteken");
        const d = bron[j];
        if (d === '"') break;
        if (d === "\\") {
          const e = bron[j + 1];
          const vast = { '"': '"', "\\": "\\", "/": "/", b: "\b", f: "\f", n: "\n", r: "\r", t: "\t" };
          if (e === "u") {
            waarde += String.fromCharCode(parseInt(bron.slice(j + 2, j + 6), 16));
            j += 6;
          } else if (e in vast) {
            waarde += vast[e];
            j += 2;
          } else {
            throw fout(bron, j, "Onbekende escape in string");
          }
          continue;
        }
        waarde += d;
        j += 1;
      }
      tokens.push({ soort: "tekst", waarde, start: i, eind: j + 1 });
      i = j + 1;
      continue;
    }
    throw fout(bron, i, `Onverwacht teken "${c}"`);
  }
  tokens.push({ soort: "eof", waarde: "", start: n, eind: n });
  return tokens;
}

const DEFINITIES = ["schema", "scalar", "type", "interface", "union", "enum", "input", "directive"];

/**
 * SDL-tekst → schema-document.
 *
 * @param {string} tekst
 */
export function parseSdl(tekst) {
  const bron = String(tekst ?? "");
  const tokens = tokeniseer(bron);
  let p = 0;

  const kijk = () => tokens[p];
  const is = (soort, waarde) => kijk().soort === soort && (waarde === undefined || kijk().waarde === waarde);
  const pak = () => tokens[p++];
  const verwacht = (soort, waarde, wat) => {
    if (!is(soort, waarde)) {
      const t = kijk();
      const gevonden = t.soort === "eof" ? "einde van de tekst" : `"${t.waarde}"`;
      throw fout(bron, t.start, `Hier hoort ${wat || `"${waarde}"`} (gevonden: ${gevonden})`);
    }
    return pak();
  };
  const naam = (wat = "een naam") => verwacht("naam", undefined, wat).waarde;
  const beschrijving = () => (is("tekst") ? pak().waarde : undefined);

  /** Type-expressie → canonieke tekst. */
  const type = () => {
    let uit;
    if (is("punct", "[")) {
      pak();
      uit = `[${type()}]`;
      verwacht("punct", "]");
    } else {
      uit = naam("een typenaam");
    }
    if (is("punct", "!")) {
      pak();
      uit += "!";
    }
    return uit;
  };

  /** Sla één (const-)waarde over en geef de ruwe brontekst terug. */
  const waarde = () => {
    const start = kijk().start;
    const sla = () => {
      const t = kijk();
      if (t.soort === "punct" && t.waarde === "[") {
        pak();
        while (!is("punct", "]")) sla();
        pak();
      } else if (t.soort === "punct" && t.waarde === "{") {
        pak();
        while (!is("punct", "}")) {
          naam("een veldnaam");
          verwacht("punct", ":");
          sla();
        }
        pak();
      } else if (t.soort === "punct" && t.waarde === "$") {
        pak();
        naam("een variabelenaam");
      } else if (t.soort === "naam" || t.soort === "getal" || t.soort === "tekst") {
        pak();
      } else {
        throw fout(bron, t.start, "Hier hoort een waarde");
      }
    };
    sla();
    return bron.slice(start, tokens[p - 1].eind).replace(/\s*\n\s*/g, " ");
  };

  /** Toegepaste directives als ruwe tekst (`@a @b(x: 1)`), of undefined. */
  const directives = () => {
    if (!is("punct", "@")) return undefined;
    const start = kijk().start;
    while (is("punct", "@")) {
      pak();
      naam("een directive-naam");
      if (is("punct", "(")) {
        pak();
        while (!is("punct", ")")) {
          naam("een argumentnaam");
          verwacht("punct", ":");
          waarde();
        }
        pak();
      }
    }
    return bron.slice(start, tokens[p - 1].eind).replace(/\s*\n\s*/g, " ");
  };

  const schoon = (obj) => {
    for (const k of Object.keys(obj)) if (obj[k] === undefined) delete obj[k];
    return obj;
  };

  /** InputValueDefinition: argument of invoerveld. */
  const invoerveld = () => {
    const b = beschrijving();
    const n = naam("een argument- of veldnaam");
    verwacht("punct", ":");
    const t = type();
    let standaard;
    if (is("punct", "=")) {
      pak();
      standaard = waarde();
    }
    return schoon({ naam: n, type: t, standaard, beschrijving: b, directives: directives() });
  };

  const argumenten = () => {
    const uit = [];
    if (!is("punct", "(")) return uit;
    pak();
    while (!is("punct", ")")) uit.push(invoerveld());
    pak();
    return uit;
  };

  const veld = () => {
    const b = beschrijving();
    const n = naam("een veldnaam");
    const args = argumenten();
    verwacht("punct", ":");
    const t = type();
    return schoon({ naam: n, type: t, argumenten: args, beschrijving: b, directives: directives() });
  };

  const blok = (regel) => {
    const uit = [];
    if (!is("punct", "{")) return uit;
    pak();
    while (!is("punct", "}")) uit.push(regel());
    pak();
    return uit;
  };

  const namenLijst = (scheider) => {
    const uit = [];
    if (is("punct", scheider)) pak();
    uit.push(naam("een typenaam"));
    while (is("punct", scheider)) {
      pak();
      uit.push(naam("een typenaam"));
    }
    return uit;
  };

  const doc = { schema: null, typen: [] };
  while (!is("eof")) {
    const b = beschrijving();
    const t = kijk();
    if (t.soort !== "naam" || (!DEFINITIES.includes(t.waarde) && t.waarde !== "extend")) {
      throw fout(bron, t.start, `Hier hoort een definitie (${DEFINITIES.join(", ")})`);
    }
    pak();
    switch (t.waarde) {
      case "extend":
        throw fout(bron, t.start, "extend wordt nog niet ondersteund; voeg de uitbreiding samen met de definitie");
      case "schema": {
        if (doc.schema) throw fout(bron, t.start, "Er mag maar één schema-definitie zijn");
        const dirs = directives();
        const s = schoon({ directives: dirs });
        verwacht("punct", "{");
        while (!is("punct", "}")) {
          const op = naam("query, mutation of subscription");
          if (!["query", "mutation", "subscription"].includes(op)) {
            throw fout(bron, tokens[p - 1].start, "Hier hoort query, mutation of subscription");
          }
          verwacht("punct", ":");
          s[op] = naam("een typenaam");
        }
        pak();
        doc.schema = s;
        if (b !== undefined) doc.beschrijving = b;
        break;
      }
      case "scalar":
        doc.typen.push(schoon({ soort: "scalar", naam: naam(), beschrijving: b, directives: directives() }));
        break;
      case "type":
      case "interface": {
        const n = naam();
        let impl = [];
        if (is("naam", "implements")) {
          pak();
          impl = namenLijst("&");
        }
        const dirs = directives();
        doc.typen.push(
          schoon({
            soort: t.waarde === "type" ? "object" : "interface",
            naam: n,
            implements: impl,
            velden: blok(veld),
            beschrijving: b,
            directives: dirs,
          })
        );
        break;
      }
      case "union": {
        const n = naam();
        const dirs = directives();
        let leden = [];
        if (is("punct", "=")) {
          pak();
          leden = namenLijst("|");
        }
        doc.typen.push(schoon({ soort: "union", naam: n, leden, beschrijving: b, directives: dirs }));
        break;
      }
      case "enum": {
        const n = naam();
        const dirs = directives();
        const waarden = blok(() => {
          const wb = beschrijving();
          return schoon({ naam: naam("een enum-waarde"), beschrijving: wb, directives: directives() });
        });
        doc.typen.push(schoon({ soort: "enum", naam: n, waarden, beschrijving: b, directives: dirs }));
        break;
      }
      case "input": {
        const n = naam();
        const dirs = directives();
        doc.typen.push(schoon({ soort: "input", naam: n, velden: blok(invoerveld), beschrijving: b, directives: dirs }));
        break;
      }
      case "directive": {
        verwacht("punct", "@");
        const n = naam();
        const args = argumenten();
        let herhaalbaar = false;
        if (is("naam", "repeatable")) {
          pak();
          herhaalbaar = true;
        }
        verwacht("naam", "on", '"on"');
        doc.typen.push(
          schoon({ soort: "directive", naam: n, argumenten: args, herhaalbaar, locaties: namenLijst("|"), beschrijving: b })
        );
        break;
      }
      default:
        break;
    }
  }
  return doc;
}

/**
 * Argumentenlijst als tekst (`jaren: [Int!] = [2024], taal: String`) → lijst
 * invoervelden. Lege tekst → []. Gooit SdlFout bij een ongeldige lijst.
 */
export function parseArgumenten(tekst) {
  const s = String(tekst ?? "").trim();
  if (!s) return [];
  const doc = parseSdl(`type _ { _(${s}): _ }`);
  return doc.typen[0].velden[0].argumenten;
}

/** Lijst invoervelden → één regel SDL (zonder haken). */
export function formatteerArgumenten(args) {
  return (args || []).map(invoerveldTekst).join(", ");
}

function invoerveldTekst(a) {
  return (
    `${a.naam}: ${a.type}` + (a.standaard !== undefined ? ` = ${a.standaard}` : "") + (a.directives ? ` ${a.directives}` : "")
  );
}

/** Beschrijving als SDL-string: kort op één regel, anders een blokstring. */
function beschrijvingTekst(b, inspring) {
  if (b === undefined || b === null || b === "") return "";
  const tekst = String(b);
  if (!/[\n"\\]/.test(tekst)) return `${inspring}"${tekst}"\n`;
  const regels = tekst.replace(/"""/g, '\\"""').split("\n");
  return `${inspring}"""\n${regels.map((r) => (r ? inspring + r : r)).join("\n")}\n${inspring}"""\n`;
}

const STANDAARD_ROOTS = { query: "Query", mutation: "Mutation", subscription: "Subscription" };

/**
 * Mag de schema-definitie weggelaten worden? Ja als alle root-typen hun
 * standaardnaam dragen en er geen beschrijving of directives op staan
 * (GraphQL-spec §3.3.1: "default root operation type names").
 */
export function schemaIsImpliciet(doc) {
  const s = doc?.schema;
  if (!s) return true;
  if (doc.beschrijving || s.directives) return false;
  if (!s.query) return false;
  return ["query", "mutation", "subscription"].every((op) => !s[op] || s[op] === STANDAARD_ROOTS[op]);
}

/**
 * Schema-document → SDL-tekst. Deterministisch: definities in de volgorde van
 * `typen`, velden in hun volgorde, twee spaties inspringing, lege regel tussen
 * definities. Daarmee is de uitvoer geschikt als basis voor een digest.
 *
 * @param {ReturnType<typeof parseSdl>} doc
 * @param {{altijdSchema?: boolean}} [opties]
 */
export function naarSdl(doc, opties = {}) {
  const delen = [];
  const dirs = (d) => (d ? ` ${d}` : "");

  if (doc?.schema && (opties.altijdSchema || !schemaIsImpliciet(doc))) {
    const s = doc.schema;
    const regels = ["query", "mutation", "subscription"].filter((op) => s[op]).map((op) => `  ${op}: ${s[op]}`);
    delen.push(`${beschrijvingTekst(doc.beschrijving, "")}schema${dirs(s.directives)} {\n${regels.join("\n")}\n}`);
  }

  for (const t of doc?.typen || []) {
    const kop = beschrijvingTekst(t.beschrijving, "");
    if (t.soort === "scalar") {
      delen.push(`${kop}scalar ${t.naam}${dirs(t.directives)}`);
    } else if (t.soort === "object" || t.soort === "interface") {
      const impl = t.implements?.length ? ` implements ${t.implements.join(" & ")}` : "";
      const velden = (t.velden || []).map((v) => {
        const args = v.argumenten?.length ? `(${formatteerArgumenten(v.argumenten)})` : "";
        return `${beschrijvingTekst(v.beschrijving, "  ")}  ${v.naam}${args}: ${v.type}${dirs(v.directives)}`;
      });
      const lichaam = velden.length ? ` {\n${velden.join("\n")}\n}` : "";
      delen.push(`${kop}${t.soort === "object" ? "type" : "interface"} ${t.naam}${impl}${dirs(t.directives)}${lichaam}`);
    } else if (t.soort === "union") {
      const leden = t.leden?.length ? ` = ${t.leden.join(" | ")}` : "";
      delen.push(`${kop}union ${t.naam}${dirs(t.directives)}${leden}`);
    } else if (t.soort === "enum") {
      const waarden = (t.waarden || []).map(
        (w) => `${beschrijvingTekst(w.beschrijving, "  ")}  ${w.naam}${dirs(w.directives)}`
      );
      const lichaam = waarden.length ? ` {\n${waarden.join("\n")}\n}` : "";
      delen.push(`${kop}enum ${t.naam}${dirs(t.directives)}${lichaam}`);
    } else if (t.soort === "input") {
      const velden = (t.velden || []).map((v) => `${beschrijvingTekst(v.beschrijving, "  ")}  ${invoerveldTekst(v)}`);
      const lichaam = velden.length ? ` {\n${velden.join("\n")}\n}` : "";
      delen.push(`${kop}input ${t.naam}${dirs(t.directives)}${lichaam}`);
    } else if (t.soort === "directive") {
      const args = t.argumenten?.length ? `(${formatteerArgumenten(t.argumenten)})` : "";
      const herhaalbaar = t.herhaalbaar ? " repeatable" : "";
      delen.push(`${kop}directive @${t.naam}${args}${herhaalbaar} on ${(t.locaties || []).join(" | ")}`);
    }
  }
  return delen.join("\n\n") + (delen.length ? "\n" : "");
}
