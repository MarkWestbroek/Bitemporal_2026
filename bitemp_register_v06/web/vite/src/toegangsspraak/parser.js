/**
 * parser.js — tokenizer + recursive-descent parser voor Toegangsspraak.
 *
 * Toegangsspraak is een gecontroleerde natuurlijke taal (CNL): elke zin volgt
 * een vast patroon en beeldt 1-op-1 af op het ODRL-model. Grammatica: zie
 * docs/plans/"2026-07-22 Klare-taal Toegangsbeleid — Toegangsspraak (ontwerp).md".
 *
 * Verwijzingen naar gegevens gebruiken de van-vorm als canonieke leesvorm:
 *   "de achternaam van de naam van een natuurlijk persoon"
 * Het registerpad (NatuurlijkPersoon.Naam.achternaam) is de canonieke interne
 * vorm en wordt als technische shorthand ook geaccepteerd (handig bij drag &
 * drop uit de projectboom); de renderer schrijft altijd de van-vorm terug.
 *
 * Woordvolgorde in voorwaarden: beide volgordes worden geaccepteerd —
 *   stelling : "de taal van een trefwoord is niet "nl""
 *   bijzin   : "de taal van een trefwoord niet "nl" is"
 * De canonieke vorm is de stellingsvorm in opsommingen en de bijzinsvorm na
 * "als"/"waarvan" (zie renderer.js).
 *
 * Naast de AST levert de parser een platte lijst `spans` op: bronposities per
 * element-soort (subject, gegevens, handeling, operator, waarde, plicht,
 * modaliteit) voor zinsontleding-weergave in de editor.
 *
 * Handgeschreven parser (geen parser-generator), zelfde idioom als
 * shared/celEvaluator.js.
 */
import { geefOperatoren, vindActie, geefActies, vindPlicht, geefPlichten } from "./operatoren.js";
import { camelNaarWoorden, woordenNaarTypenaam, woordenNaarVeldnaam, lidwoordVoor, maakIsoDatum, isMaand } from "./woorden.js";

export const ANKERS = ["aanvrager", "gegevens", "betrokkene", "aanvraag"];
const LIDWOORDEN = ["de", "het", "een"];

// ── Tokenizer ────────────────────────────────────────────────────────────────

const RE_PAD = /^[\p{L}_][\p{L}\p{N}_-]*(?:\.[\p{L}_][\p{L}\p{N}_-]*)+/u;
const RE_WOORD = /^[\p{L}_][\p{L}\p{N}_'-]*/u;
const RE_GETAL = /^\d+(?:\.\d+)?/;

export class ParseFout extends Error {
  constructor(bericht, regel, kolom) {
    super(bericht);
    this.regel = regel;
    this.kolom = kolom;
  }
}

function tokeniseer(tekst) {
  const tokens = [];
  const bron = String(tekst);
  const lijnen = bron.split(/\r\n?|\n/);
  const delims = bron.match(/\r\n?|\n/g) || [];
  let lijnStart = 0;
  for (let r = 0; r < lijnen.length; r++) {
    const lijn = lijnen[r];
    const duw = (soort, waarde, kolom, lengte) => {
      const van = lijnStart + kolom - 1;
      tokens.push({ soort, waarde, regel: r + 1, kolom, van, tot: van + lengte });
    };
    let i = /^[ \t]*/.exec(lijn)[0].length;
    // Opsommingsstreepje aan het begin van de regel draagt zijn insprong mee —
    // daarmee wordt nesting van voorwaardeblokken bepaald.
    if (lijn[i] === "-" && (i + 1 >= lijn.length || lijn[i + 1] === " ")) {
      duw("bullet", "-", i + 1, 1);
      tokens[tokens.length - 1].indent = i;
      i += 1;
    }
    while (i < lijn.length) {
      const ch = lijn[i];
      if (ch === " " || ch === "\t") { i += 1; continue; }
      const kolom = i + 1;
      if (ch === '"' || ch === "“" || ch === "”") {
        let j = i + 1;
        let buf = "";
        while (j < lijn.length && !['"', "“", "”"].includes(lijn[j])) { buf += lijn[j]; j += 1; }
        if (j >= lijn.length) throw new ParseFout("Tekst tussen aanhalingstekens is niet afgesloten.", r + 1, kolom);
        duw("string", buf, kolom, buf.length + 2);
        i = j + 1;
        continue;
      }
      let m;
      if ((m = RE_GETAL.exec(lijn.slice(i)))) {
        duw("getal", m[0], kolom, m[0].length);
        i += m[0].length;
        continue;
      }
      if ((m = RE_PAD.exec(lijn.slice(i)))) {
        duw("pad", m[0], kolom, m[0].length);
        i += m[0].length;
        continue;
      }
      if ((m = RE_WOORD.exec(lijn.slice(i)))) {
        duw("woord", m[0], kolom, m[0].length);
        i += m[0].length;
        continue;
      }
      if (".:;(),".includes(ch)) {
        duw("leesteken", ch, kolom, 1);
        i += 1;
        continue;
      }
      throw new ParseFout(`Onverwacht teken "${ch}".`, r + 1, kolom);
    }
    lijnStart += lijn.length + (delims[r]?.length || 0);
  }
  return tokens;
}

// ── Kwantoren (opsommingskoppen) ─────────────────────────────────────────────

const KWANTOREN = [
  { soort: "en", woorden: ["aan", "alle", "volgende", "voorwaarden", "is", "voldaan"] },
  { soort: "of", woorden: ["aan", "ten", "minste", "één", "van", "de", "volgende", "voorwaarden", "is", "voldaan"] },
  { soort: "xof", woorden: ["aan", "precies", "één", "van", "de", "volgende", "voorwaarden", "is", "voldaan"] },
];

// ── Parser ───────────────────────────────────────────────────────────────────

class Parser {
  constructor(tokens) {
    this.ts = tokens;
    this.i = 0;
    // Bronposities per element-soort, voor zinsontleding in de editor.
    this.spans = [];
  }

  kijk(n = 0) { return this.ts[this.i + n] || null; }
  pak() { return this.ts[this.i++] || null; }

  isWoord(t, ...opties) {
    return !!t && t.soort === "woord" && opties.includes(t.waarde.toLowerCase());
  }
  isTeken(t, w) { return !!t && t.soort === "leesteken" && t.waarde === w; }

  fout(bericht, token) {
    const t = token || this.kijk() || this.ts[this.ts.length - 1];
    throw new ParseFout(bericht, t ? t.regel : 1, t ? t.kolom : 1);
  }

  /** Registreer een bronbereik van token `vanTok` t/m `totTok` (inclusief). */
  markeer(soort, vanTok, totTok, extra) {
    if (!vanTok || !totTok) return;
    this.spans.push({ soort, van: vanTok.van, tot: totTok.tot, ...(extra || {}) });
  }

  pakWoord(bericht, ...opties) {
    const t = this.kijk();
    if (opties.length ? this.isWoord(t, ...opties) : t && t.soort === "woord") return this.pak().waarde;
    this.fout(bericht + (t ? ` (gevonden: "${t.waarde}")` : " (einde van de tekst)"));
  }

  pakTeken(w, bericht) {
    const t = this.kijk();
    if (this.isTeken(t, w)) return this.pak();
    this.fout(bericht + (t ? ` (gevonden: "${t.waarde}")` : " (einde van de tekst)"));
  }

  /** Probeer een woordreeks (case-insensitief); consumeert alleen bij succes. */
  matchWoorden(woorden, enDanTeken) {
    for (let n = 0; n < woorden.length; n++) {
      const t = this.kijk(n);
      const doel = woorden[n];
      const ok = doel === "één"
        ? this.isWoord(t, "één", "een")
        : this.isWoord(t, doel);
      if (!ok) return false;
    }
    if (enDanTeken && !this.isTeken(this.kijk(woorden.length), enDanTeken)) return false;
    this.i += woorden.length + (enDanTeken ? 1 : 0);
    return true;
  }

  /**
   * Is dit woord het eerste rest-woord van een operator-zin (het deel na het
   * werkwoord)? In de bijzinsvolgorde staat dat deel direct na de linksterm
   * ("… niet "nl" is", "… kleiner dan 18 is") — de verwijzing moet daar dus
   * stoppen. Afgeleid uit het register, zodat domeinprofielen meedoen.
   */
  bijzinsGrens(t) {
    if (!t || t.soort !== "woord") return false;
    const w = t.waarde.toLowerCase();
    for (const op of geefOperatoren()) {
      const woorden = op.zin.split(" ");
      if (woorden.length > 1 && woorden[1] === w) return true;
    }
    return false;
  }

  /** Kijkt of er op de huidige positie een operator-zin begint (zonder consumeren). */
  operatorOpKomst() {
    for (const op of geefOperatoren()) {
      const woorden = op.zin.split(" ");
      let ok = true;
      for (let n = 0; n < woorden.length; n++) {
        if (!this.isWoord(this.kijk(n), woorden[n])) { ok = false; break; }
      }
      if (ok) return op;
    }
    return null;
  }

  // ── Document ──

  parseBeleid() {
    const beleid = {
      naam: "", geldigVanaf: null, geldigTot: null, grondslag: null, doel: null,
      begrippen: [], regels: [],
    };
    this.pakWoord('Een beleidstekst begint met: Beleid "<naam>".', "beleid");
    beleid.naam = this.pakString("Na Beleid hoort de naam tussen aanhalingstekens.");
    this.pakTeken(".", "De beleidsregel eindigt met een punt.");

    // Kopregels in willekeurige volgorde
    for (;;) {
      const t = this.kijk();
      if (this.isWoord(t, "geldig")) {
        this.pak();
        this.pakWoord('Na "Geldig" hoort "vanaf".', "vanaf");
        beleid.geldigVanaf = this.parseDatum();
        if (this.isWoord(this.kijk(), "tot")) {
          this.pak();
          beleid.geldigTot = this.parseDatum();
        }
        this.pakTeken(".", "De geldigheidsregel eindigt met een punt.");
      } else if (this.isWoord(t, "grondslag")) {
        this.pak();
        this.pakTeken(":", 'Na "Grondslag" hoort een dubbele punt.');
        beleid.grondslag = this.pakTekstTotPunt();
      } else if (this.isWoord(t, "doel")) {
        this.pak();
        this.pakTeken(":", 'Na "Doel" hoort een dubbele punt.');
        beleid.doel = this.pakString("Het doel staat tussen aanhalingstekens.");
        this.pakTeken(".", "De doelregel eindigt met een punt.");
      } else {
        break;
      }
    }

    if (this.isWoord(this.kijk(), "begrippen")) {
      this.pak();
      this.pakTeken(".", 'Na "Begrippen" hoort een punt.');
      while (this.kijk() && !this.isWoord(this.kijk(), "regel")) {
        beleid.begrippen.push(this.parseBegrip());
      }
    }

    while (this.isWoord(this.kijk(), "regel")) {
      beleid.regels.push(this.parseRegel());
    }

    const rest = this.kijk();
    if (rest) this.fout(`Onverwachte tekst na de laatste regel: "${rest.waarde}".`);
    return beleid;
  }

  pakString(bericht) {
    const t = this.kijk();
    if (t && t.soort === "string") return this.pak().waarde;
    this.fout(bericht);
  }

  pakTekstTotPunt() {
    const delen = [];
    while (this.kijk() && !this.isTeken(this.kijk(), ".")) {
      const t = this.pak();
      delen.push(t.soort === "string" ? `"${t.waarde}"` : t.waarde);
    }
    this.pakTeken(".", "Deze regel eindigt met een punt.");
    if (!delen.length) this.fout("Hier hoort nog tekst te staan.");
    return delen.join(" ");
  }

  parseDatum() {
    const dag = this.kijk();
    const maand = this.kijk(1);
    const jaar = this.kijk(2);
    if (dag?.soort === "getal" && maand?.soort === "woord" && isMaand(maand.waarde) && jaar?.soort === "getal") {
      this.i += 3;
      const iso = maakIsoDatum(dag.waarde, maand.waarde, jaar.waarde);
      if (!iso) this.fout(`"${dag.waarde} ${maand.waarde} ${jaar.waarde}" is geen geldige datum.`, dag);
      return iso;
    }
    this.fout('Hier hoort een datum, bijvoorbeeld "1 mei 2026".');
  }

  // ── Begrippen ──

  parseBegrip() {
    // Het lidwoord is optioneel: onbepaalde termen zijn in definities gangbaar
    // ("Mail is …", "Inkomensgegevens zijn …", zoals water of lucht). De naam
    // eindigt bij het eerste "is"/"zijn"; een naam kan die woorden dus zelf
    // niet bevatten. De dubbele punt is bij het parsen optioneel, de canonieke
    // vorm heeft hem wél (herformatteren vult hem aan).
    let lidwoord = null;
    if (this.isWoord(this.kijk(), ...LIDWOORDEN)) lidwoord = this.pak().waarde.toLowerCase();
    const naamWoorden = [];
    while (this.kijk() && !this.isWoord(this.kijk(), "is", "zijn")) {
      naamWoorden.push(this.pakWoord("De naam van het begrip bestaat uit woorden."));
    }
    if (!naamWoorden.length) this.fout("Het begrip heeft nog geen naam.");
    const werkwoord = this.pakWoord('Na de naam hoort "is:" of "zijn:".', "is", "zijn").toLowerCase();
    if (this.isTeken(this.kijk(), ":")) this.pak();

    if (this.isWoord(this.kijk(), "iemand")) {
      this.pak();
      const kenmerken = this.parseKenmerken();
      this.pakTeken(".", "Een begrip eindigt met een punt.");
      return { soort: "wie", lidwoord, naam: naamWoorden.join(" "), kenmerken };
    }

    const wat = this.parseWat(() => this.isWoord(this.kijk(), "waarvan") || this.isTeken(this.kijk(), "."));
    let waarvan = null;
    if (this.isWoord(this.kijk(), "waarvan")) {
      this.pak();
      waarvan = this.parseVoorwaarde(() => this.isTeken(this.kijk(), "."));
    }
    this.pakTeken(".", "Een begrip eindigt met een punt.");
    return { soort: "wat", lidwoord, werkwoord, naam: naamWoorden.join(" "), wat, waarvan };
  }

  parseKenmerken() {
    this.pakWoord('Na "iemand" hoort "met", gevolgd door kenmerken.', "met");
    const kenmerken = [];
    for (;;) {
      const woorden = [];
      while (this.kijk() && this.kijk().soort === "woord" && !this.isWoord(this.kijk(), "en")) {
        woorden.push(this.pak().waarde);
      }
      if (!woorden.length) this.fout("Hier hoort een kenmerk, bijvoorbeeld: rol.");
      const waarde = this.pakString(`Na het kenmerk "${woorden.join(" ")}" hoort de waarde tussen aanhalingstekens.`);
      // Woordvorm bewaren voor de round-trip; de veldnaam-vorm ontstaat pas
      // bij de ODRL-mapping.
      kenmerken.push({ kenmerk: woorden.join(" "), waarde });
      if (this.isWoord(this.kijk(), "en")) { this.pak(); continue; }
      break;
    }
    return kenmerken;
  }

  // ── Regels ──

  parseRegel() {
    this.pakWoord("", "regel");
    const naam = this.pakString('Na "Regel" hoort de naam tussen aanhalingstekens.');
    this.pakTeken(".", "De regelkop eindigt met een punt.");

    const wieStart = this.kijk();
    const wie = this.parseWie();
    this.markeer("subject", wieStart, this.ts[this.i - 1]);
    const magTok = this.kijk();
    this.pakWoord('Na het subject hoort "mag" (of "mag … niet").', "mag");
    this.markeer("modaliteit", magTok, magTok);

    // Verzamel de tokens tot "als", "waarbij" of "." — het laatste woord is de
    // handeling, met daarvoor eventueel "niet".
    const watTokens = [];
    for (;;) {
      const t = this.kijk();
      if (!t) this.fout("De regel is nog niet af: er hoort minstens een handeling en een punt.");
      if (this.isWoord(t, "als", "waarbij") || this.isTeken(t, ".")) break;
      watTokens.push(this.pak());
    }
    if (!watTokens.length) this.fout('Na "mag" horen de gegevens en een handeling, bijvoorbeeld: "de inkomensgegevens bekijken".');
    const actieToken = watTokens[watTokens.length - 1];
    if (actieToken.soort !== "woord") this.fout("De zin eindigt met de handeling (bijvoorbeeld: bekijken).", actieToken);
    const actie = actieToken.waarde.toLowerCase();
    if (!vindActie(actie)) {
      const bekend = geefActies().map((a) => a.woord).join(", ");
      this.fout(`Onbekende handeling "${actie}". Bekende handelingen: ${bekend}.`, actieToken);
    }
    this.markeer("actie", actieToken, actieToken);
    let verbod = false;
    let watEinde = watTokens.length - 1;
    if (watEinde > 0 && watTokens[watEinde - 1].soort === "woord" && watTokens[watEinde - 1].waarde.toLowerCase() === "niet") {
      verbod = true;
      watEinde -= 1;
      this.markeer("modaliteit", watTokens[watEinde], watTokens[watEinde]);
    }
    const sub = new Parser(watTokens.slice(0, watEinde));
    const wat = sub.parseWatVolledig();
    this.spans.push(...sub.spans);

    let voorwaarden = null;
    if (this.isWoord(this.kijk(), "als")) {
      this.pak();
      voorwaarden = this.parseVoorwaardeblok();
    }

    const plichten = [];
    if (this.isWoord(this.kijk(), "waarbij")) {
      this.pak();
      this.pakTeken(":", 'Na "waarbij" hoort een dubbele punt.');
      for (;;) {
        plichten.push(this.parsePlicht());
        if (this.isTeken(this.kijk(), ";")) { this.pak(); continue; }
        break;
      }
    }
    this.pakTeken(".", "Een regel eindigt met een punt.");
    return { naam, wie, verbod, wat, actie, voorwaarden, plichten };
  }

  parseWie() {
    if (this.isWoord(this.kijk(), "iemand")) {
      this.pak();
      return { soort: "iemand", kenmerken: this.parseKenmerken() };
    }
    const lidwoord = this.pakWoord("Het subject begint met Een, De, Het of Iemand.", ...LIDWOORDEN).toLowerCase();
    const woorden = [];
    while (this.kijk() && this.kijk().soort === "woord" && !this.isWoord(this.kijk(), "mag")) {
      woorden.push(this.pak().waarde);
    }
    if (!woorden.length) this.fout("Het subject heeft nog geen naam.");
    return { soort: "begrip", lidwoord, naam: woorden.join(" ") };
  }

  /** Wat-slot op een afgebakende tokenlijst (alles is al afgebakend). */
  parseWatVolledig() {
    const wat = this.parseWat(() => !this.kijk());
    const rest = this.kijk();
    if (rest) this.fout(`Onverwachte tekst in de gegevens-omschrijving: "${rest.waarde}".`, rest);
    return wat;
  }

  parseWat(stop) {
    const t = this.kijk();
    if (!t) this.fout("Hier hoort een gegevens-omschrijving.");
    // "alle gegevens van <verwijzing>" — de verwijzing mag een volledige
    // van-keten zijn ("alle gegevens van het inkomen van een natuurlijk
    // persoon"), zodat definities congruent blijven (meervoud = meervoud).
    if (this.matchWoorden(["alle", "gegevens", "van"])) {
      const verwijzing = this.parseVerwijzing(stop);
      return { soort: "alle", verwijzing };
    }
    // technisch pad als shorthand
    if (t.soort === "pad") {
      this.pak();
      const verwijzing = { soort: "verwijzing", ...padNaarVerwijzing(t.waarde) };
      this.markeer("gegevens", t, t, { verwijzing });
      return verwijzing;
    }
    // "de gegevens NatuurlijkPersoon.Inkomen" (technische tussenvorm)
    if (this.isWoord(t, "de") && this.isWoord(this.kijk(1), "gegevens") && this.kijk(2)?.soort === "pad") {
      this.i += 2;
      const padTok = this.pak();
      const verwijzing = { soort: "verwijzing", ...padNaarVerwijzing(padTok.waarde) };
      this.markeer("gegevens", t, padTok, { verwijzing });
      return verwijzing;
    }
    // van-vorm of begripsnaam
    const heeftVan = this.bevatVanVoorStop(stop);
    if (heeftVan) {
      const verwijzing = this.parseVerwijzing(stop);
      return { soort: "verwijzing", keten: verwijzing.keten, basis: verwijzing.basis };
    }
    // Begripsverwijzing — het lidwoord is ook hier optioneel ("mag mail bekijken").
    const startTok = this.kijk();
    let lidwoord = null;
    if (this.isWoord(this.kijk(), ...LIDWOORDEN)) lidwoord = this.pak().waarde.toLowerCase();
    const woorden = [];
    while (this.kijk() && this.kijk().soort === "woord" && !stop()) {
      woorden.push(this.pak().waarde);
    }
    if (!woorden.length) this.fout("De gegevens-omschrijving heeft nog geen naam.");
    this.markeer("gegevens", startTok, this.ts[this.i - 1], { begrip: woorden.join(" ") });
    return { soort: "begrip", lidwoord, naam: woorden.join(" ") };
  }

  /** Kijkt vooruit of er vóór het stop-punt nog een los "van" staat. */
  bevatVanVoorStop(stop) {
    const start = this.i;
    let gezien = false;
    while (this.kijk() && !stop()) {
      if (this.isWoord(this.kijk(), "van")) { gezien = true; break; }
      if (this.kijk().soort !== "woord") break;
      this.i += 1;
    }
    this.i = start;
    return gezien;
  }

  // ── Voorwaarden ──

  parseVoorwaardeblok() {
    for (const kw of KWANTOREN) {
      const start = this.i;
      if (this.matchWoorden(kw.woorden, ":")) {
        return this.parseOpsomming(kw.soort);
      }
      this.i = start;
    }
    return this.parseVoorwaarde(() =>
      this.isWoord(this.kijk(), "waarbij") || this.isTeken(this.kijk(), ".")
    );
  }

  parseOpsomming(soort, minIndent = -1) {
    const eerste = this.kijk();
    if (!eerste || eerste.soort !== "bullet") {
      this.fout("Na de opsommingskop horen voorwaarden met een streepje (-) te volgen.");
    }
    const blokIndent = eerste.indent;
    if (blokIndent <= minIndent) {
      this.fout("Een geneste opsomming springt verder in dan de opsomming erboven.", eerste);
    }
    const items = [];
    while (this.kijk() && this.kijk().soort === "bullet" && this.kijk().indent === blokIndent) {
      this.pak(); // bullet
      // Genest blok?
      let genest = null;
      for (const kw of KWANTOREN) {
        const start = this.i;
        if (this.matchWoorden(kw.woorden, ":")) { genest = kw.soort; break; }
        this.i = start;
      }
      if (genest) {
        const sub = this.parseOpsomming(genest, blokIndent);
        items.push(sub);
      } else {
        items.push(this.parseVoorwaarde(() =>
          this.isTeken(this.kijk(), ";") || this.kijk()?.soort === "bullet" ||
          this.isWoord(this.kijk(), "waarbij") || this.isTeken(this.kijk(), ".")
        ));
      }
      if (this.isTeken(this.kijk(), ";")) this.pak();
    }
    if (!items.length) this.fout("De opsomming bevat nog geen voorwaarden.");
    return { soort, items };
  }

  /**
   * Eén voorwaarde, in beide woordvolgordes:
   *   stelling : links OPERATOR rechts        ("… is niet "nl"")
   *   bijzin   : links rest rechts WERKWOORD  ("… niet "nl" is")
   * De bijzinsvorm wordt herkend door het werkwoord aan het einde naar voren
   * te halen en de stellingsvorm opnieuw te parsen.
   */
  parseVoorwaarde(stop) {
    const links = this.parseTerm(stop);
    if (this.operatorOpKomst()) {
      return this.parseOperatorEnRechts(links, stop);
    }
    // Bijzinsvolgorde: verzamel tot het stop-punt; het laatste woord is het
    // werkwoord ("is", "begint", "ligt", "valt", …).
    const rest = [];
    while (this.kijk() && !stop()) rest.push(this.pak());
    const laatste = rest[rest.length - 1];
    if (!rest.length || laatste.soort !== "woord") {
      const bekend = geefOperatoren().slice(0, 5).map((o) => `"${o.zin}"`).join(", ");
      this.fout(`Hier hoort een vergelijking, bijvoorbeeld ${bekend}, …`);
    }
    const sub = new Parser([laatste, ...rest.slice(0, -1)]);
    let voorwaarde;
    try {
      voorwaarde = sub.parseOperatorEnRechts(links, () => !sub.kijk());
    } catch {
      const bekend = geefOperatoren().slice(0, 5).map((o) => `"${o.zin}"`).join(", ");
      this.fout(`Hier hoort een vergelijking (in stelling- of bijzinsvolgorde), bijvoorbeeld ${bekend}, …`, rest[0]);
    }
    if (sub.kijk()) {
      this.fout(`Onverwachte tekst in de voorwaarde: "${sub.kijk().waarde}".`, sub.kijk());
    }
    this.spans.push(...sub.spans);
    return voorwaarde;
  }

  parseOperatorEnRechts(links, stop) {
    const op = this.operatorOpKomst();
    if (!op) {
      const bekend = geefOperatoren().slice(0, 5).map((o) => `"${o.zin}"`).join(", ");
      this.fout(`Hier hoort een vergelijking, bijvoorbeeld ${bekend}, …`);
    }
    const opLengte = op.zin.split(" ").length;
    for (let n = 0; n < opLengte; n++) {
      this.markeer("operator", this.kijk(n), this.kijk(n));
    }
    this.i += opLengte;
    const voorwaarde = { soort: "voorwaarde", links, operator: op.canoniek, rechts: null, rechts2: null, lijst: null };
    if (op.unair) return voorwaarde;
    if (op.lijst) {
      this.pakTeken("(", `Na "${op.zin}" hoort een lijst tussen haakjes.`);
      voorwaarde.lijst = [];
      for (;;) {
        voorwaarde.lijst.push(this.parseTerm(() => this.isTeken(this.kijk(), ",") || this.isTeken(this.kijk(), ")")));
        if (this.isTeken(this.kijk(), ",")) { this.pak(); continue; }
        break;
      }
      this.pakTeken(")", "De lijst eindigt met een sluithaakje.");
      return voorwaarde;
    }
    if (op.tussen) {
      voorwaarde.rechts = this.parseTerm(() => this.isWoord(this.kijk(), "en"));
      this.pakWoord('Bij "ligt tussen" horen twee waarden, gescheiden door "en".', "en");
      voorwaarde.rechts2 = this.parseTerm(stop);
      return voorwaarde;
    }
    voorwaarde.rechts = this.parseTerm(stop);
    return voorwaarde;
  }

  parseTerm(stop) {
    const t = this.kijk();
    if (!t) this.fout("Hier hoort een waarde of een verwijzing naar gegevens.");
    if (t.soort === "string") {
      this.pak();
      this.markeer("waarde", t, t);
      return { soort: "literal", type: "tekst", waarde: t.waarde };
    }
    if (t.soort === "getal") {
      const maand = this.kijk(1);
      const jaar = this.kijk(2);
      if (maand?.soort === "woord" && isMaand(maand.waarde) && jaar?.soort === "getal") {
        const iso = this.parseDatum();
        this.markeer("waarde", t, jaar);
        return { soort: "literal", type: "datum", waarde: iso };
      }
      this.pak();
      this.markeer("waarde", t, t);
      return { soort: "literal", type: "getal", waarde: Number(t.waarde) };
    }
    if (t.soort === "pad") {
      this.pak();
      const verwijzing = { soort: "verwijzing", ...padNaarVerwijzing(t.waarde) };
      this.markeer("gegevens", t, t, { verwijzing });
      return verwijzing;
    }
    return { soort: "verwijzing", ...this.parseVerwijzing(stop) };
  }

  /**
   * Van-keten: "de achternaam van de naam van een natuurlijk persoon".
   * De laatste groep is de basis (anker of type); de groepen ervoor zijn de
   * kenmerkketen, van buiten naar binnen.
   */
  parseVerwijzing(stop) {
    const startTok = this.kijk();
    const groepen = [];
    for (;;) {
      const groep = this.parseBasisGroep(stop);
      groepen.push(groep);
      if (this.isWoord(this.kijk(), "van")) { this.pak(); continue; }
      break;
    }
    const laatste = groepen.pop();
    let basis;
    if (laatste.woorden.length === 1 && ANKERS.includes(laatste.woorden[0].toLowerCase())) {
      basis = { soort: "anker", lidwoord: laatste.lidwoord, anker: laatste.woorden[0].toLowerCase() };
    } else {
      basis = { soort: "type", lidwoord: laatste.lidwoord, woorden: laatste.woorden.map((w) => w.toLowerCase()) };
    }
    const verwijzing = { keten: groepen, basis };
    this.markeer("gegevens", startTok, this.ts[this.i - 1], { verwijzing });
    return verwijzing;
  }

  parseBasisGroep(stop) {
    const lidwoord = this.pakWoord("Een verwijzing begint met De, Het of Een.", ...LIDWOORDEN).toLowerCase();
    const woorden = [];
    while (
      this.kijk() && this.kijk().soort === "woord" &&
      !this.isWoord(this.kijk(), "van") &&
      !this.operatorOpKomst() &&
      !this.bijzinsGrens(this.kijk()) &&
      !(stop && stop())
    ) {
      woorden.push(this.pak().waarde);
    }
    if (!woorden.length) this.fout("Hier hoort de naam van een gegeven of type.");
    return { lidwoord, woorden };
  }

  // ── Plichten ──

  parsePlicht() {
    const woorden = [];
    const eerste = this.kijk();
    while (this.kijk() && this.kijk().soort === "woord") {
      woorden.push(this.pak().waarde);
    }
    const zin = woorden.join(" ");
    const plicht = vindPlicht(zin);
    if (!plicht) {
      const bekend = geefPlichten().map((p) => `"${p.zin}"`).join("; ");
      this.fout(`Onbekende verplichting "${zin}". Bekende verplichtingen: ${bekend}.`, eerste);
    }
    this.markeer("plicht", eerste, this.ts[this.i - 1]);
    return { zin: plicht.zin, nlgov: plicht.nlgov };
  }
}

// ── Pad ↔ verwijzing ─────────────────────────────────────────────────────────

/** "NatuurlijkPersoon.Naam.achternaam" → verwijzing-AST (van-vorm). */
export function padNaarVerwijzing(pad) {
  const segmenten = String(pad).split(".");
  const [typeSegment, ...rest] = segmenten;
  const basis = { soort: "type", lidwoord: "een", woorden: camelNaarWoorden(typeSegment) };
  // Ketengroepen van buiten (blad) naar binnen.
  const keten = rest
    .slice()
    .reverse()
    .map((segment) => {
      const woorden = camelNaarWoorden(segment);
      return { lidwoord: lidwoordVoor(woorden[0]), woorden };
    });
  return { keten, basis };
}

/**
 * Verwijzing-AST → registerpad, alleen voor type-gebaseerde verwijzingen.
 * Tussenliggende segmenten krijgen een hoofdletter (GE-rol), het blad lowerCamel.
 * Een latere metamodel-resolutie kan dit vervangen door echte typenamen/labels.
 */
export function verwijzingNaarPad(verwijzing) {
  if (verwijzing.basis.soort !== "type") return null;
  const binnenNaarBuiten = verwijzing.keten.slice().reverse();
  const segmenten = binnenNaarBuiten.map((groep, i) =>
    i === binnenNaarBuiten.length - 1
      ? woordenNaarVeldnaam(groep.woorden)
      : woordenNaarTypenaam(groep.woorden)
  );
  return [woordenNaarTypenaam(verwijzing.basis.woorden), ...segmenten].join(".");
}

/**
 * Verwijzing → registerpad voor een gegevensgroep ("alle gegevens van …"):
 * alle segmenten zijn dan entiteit/GE-rollen en krijgen een hoofdletter
 * (NatuurlijkPersoon.Inkomen), er is geen veld-blad.
 */
export function verwijzingNaarGroepPad(verwijzing) {
  if (verwijzing.basis.soort !== "type") return null;
  const binnenNaarBuiten = verwijzing.keten.slice().reverse();
  return [
    woordenNaarTypenaam(verwijzing.basis.woorden),
    ...binnenNaarBuiten.map((groep) => woordenNaarTypenaam(groep.woorden)),
  ].join(".");
}

// ── Publieke ingang ──────────────────────────────────────────────────────────

/**
 * Parseer een Toegangsspraak-tekst.
 * @returns {{ ok, beleid, fouten, spans }} — `spans` zijn bronposities per
 * element-soort (subject, gegevens, actie, operator, waarde, plicht,
 * modaliteit) voor zinsontleding-weergave; los van de AST zodat de AST
 * positie-onafhankelijk blijft (round-trip-vergelijkbaar).
 */
export function parseBeleid(tekst) {
  let tokens;
  try {
    tokens = tokeniseer(tekst);
  } catch (e) {
    if (e instanceof ParseFout) return { ok: false, beleid: null, fouten: [naarFout(e)], spans: [] };
    throw e;
  }
  const parser = new Parser(tokens);
  let beleid;
  try {
    beleid = parser.parseBeleid();
  } catch (e) {
    if (e instanceof ParseFout) return { ok: false, beleid: null, fouten: [naarFout(e)], spans: [] };
    throw e;
  }
  const fouten = valideerBeleid(beleid);
  const spans = parser.spans.sort((a, b) => a.van - b.van);
  return { ok: fouten.length === 0, beleid, fouten, spans };
}

function naarFout(e) {
  return { bericht: e.message, regel: e.regel, kolom: e.kolom };
}

/**
 * Semantische controle na het parsen. Onbekende wat-begrippen zijn fout (we
 * kunnen niet raden om welke gegevens het gaat); onbekende wie-begrippen zijn
 * toegestaan en gelden als impliciete rol (zie odrl.js).
 */
export function valideerBeleid(beleid) {
  const fouten = [];
  const watBegrippen = new Set(
    beleid.begrippen.filter((b) => b.soort === "wat").map((b) => b.naam.toLowerCase())
  );
  for (const regel of beleid.regels) {
    if (regel.wat.soort === "begrip" && !watBegrippen.has(regel.wat.naam.toLowerCase())) {
      fouten.push({
        bericht:
          `Regel "${regel.naam}": het begrip "${regel.wat.naam}" is niet gedefinieerd onder Begrippen. ` +
          `Voeg toe: De ${regel.wat.naam} zijn: … — of gebruik de van-vorm ("… van een …").`,
        regel: null,
        kolom: null,
      });
    }
  }
  return fouten;
}
