// @ts-check
/**
 * odrlNaarBeleid — **bouwer**: het plan van de regelset "ODRL → Toegangsspraak"
 * als beleid (de AST van de parser), klaar voor `renderBeleid`.
 *
 * De andere imports eindigen bij een toepasser die het plan in een model zet.
 * Hier is het doel geen graaf maar een boom: een beleid met regels, en per
 * regel één zin. De bouwer zet de knopen en verbindingen van het plan
 * (aarden zoals in `graaf.js`) terug in die boom. Hij is het omgekeerde van
 * het graafbeeld en kent dus de keuzes van `graaf.js`:
 *
 *   - de kenmerken van een groep (rol, afdeling) staan ook als verfijning op de
 *     handeling — die horen bij "wie", niet bij "als";
 *   - de doelbinding van het beleid staat op elke toestemming — die hoort bij
 *     de kopregel "Doel:", niet bij de regel;
 *   - wat over het verzoek gaat hangt aan de handeling, wat over de gegevens
 *     gaat aan de regel: samen zijn dat de voorwaarden van de regel.
 *
 * **Structuur is leidend, tekst geeft de woorden.** De ODRL draagt op veel
 * plekken de zinsnede uit de klare taal (het label van een voorwaarde, van een
 * operand, van een registerdeel; de omschrijving van een begrip). De bouwer
 * leest zo'n zinsnede met de parser van de taal en neemt haar over als ze
 * hetzelfde zegt als de structuur (zelfde anker, pad, vergelijking, waarde).
 * Anders bouwt hij de woorden zelf uit de structuur — de lidwoorden komen dan
 * uit `lidwoordVoor`, en dat is een benadering.
 *
 * Wat de structuur niet draagt en dus alleen via de tekst terugkomt:
 * de volgorde van voorwaarden over verzoek en gegevens door elkaar, `waarvan`
 * bij een begrip, "voor …" bij een bestaansvraag, een verwijzing als
 * rechterterm, begrippen die geen regel gebruikt, `Standaard:` en
 * `Bij conflict:`. Zie `odrlImport.js` voor de weg via de brontekst.
 *
 * **ODRL van anderen.** Wat een ander schrijft past niet altijd in de taal. De
 * bouwer leest wat kan en houdt één regel aan: **het beleid in klare taal wordt
 * nooit ongemerkt ruimer dan de ODRL.**
 *
 *   - Een toestemming met iets dat niet te vertalen is (een vergelijking die de
 *     taal niet kent, een plicht, een kenmerk van de groep) wordt weggelaten:
 *     het beleid wordt strenger, en dat staat in de meldingen. Met
 *     `bijOnvertaalbaar: "ruimer"` blijft de regel staan zonder dat onderdeel,
 *     met een waarschuwing — handig om een concept na te lopen.
 *   - Een verbod verliest alleen de onvertaalbare voorwaarde: het geldt dan
 *     vaker (strenger). Kan het verbod zelf niet worden gelezen (de handeling,
 *     de gegevens), dan valt het weg met de waarschuwing dat het beleid
 *     daardoor ruimer is.
 *   - Een plicht op het beleid en overerving van een ander beleid kent de taal
 *     niet: gemeld als ruimer. Zo ook een aanbod of verzoek (geen geldend
 *     beleid) en de conflictregel `odrl:invalid`.
 *   - Een verbod op elk gebruik (`odrl:use`) wordt uitgeschreven voor elke
 *     handeling van de taal.
 *
 * Wat op het beleid staat geldt voor elke regel zonder eigen (ODRL 2.2 §2.7.1):
 * partij, gegevens en handeling. De plek van een voorwaarde zegt waar ze over
 * gaat: een verfijning op de groep over de aanvrager, een verfijning op de
 * gegevens over de gegevens (de populatie), de rest over de aanvraag.
 *
 * Interpretaties (meldingen ODRL-INTERPRETATIE): een operand uit een ander
 * vocabulaire is een kenmerk van de **aanvrager** als hij een groep bepaalt,
 * van de **gegevens** als hij de gegevens afbakent en anders van de **aanvraag**; een benoemde partij wordt een begrip met het
 * kenmerk `organisatie`; een asset zonder pad in een register wordt gelezen
 * naar zijn naam en zijn `odrl:partOf`-keten.
 *
 * Puur; geen store, geen React.
 */
import { parseBeleid, padNaarVerwijzing, verwijzingNaarPad, verwijzingNaarGroepPad, ANKERS } from "./parser.js";
import { beleidNaarGraaf } from "./graaf.js";
import { vindOperator, vindActie, geefActies, geefPlichten, vindPlicht } from "./operatoren.js";
import { camelNaarWoorden, lidwoordVoor, woordenNaarVeldnaam } from "./woorden.js";
import { woordVoorHandeling } from "./odrlNaarToegangsspraakRegels.js";

// ── Zinsneden lezen met de parser van de taal ───────────────────────────────

const eenRegel = (tekst) => String(tekst ?? "").replace(/\s+/g, " ").trim();

/** Een voorwaarde in stellingvorm ("het doel van de aanvraag is "x"") → AST, of null. */
export function leesVoorwaardeZin(tekst) {
  const zin = eenRegel(tekst).replace(/[.;]$/, "");
  if (!zin) return null;
  const r = parseBeleid(
    `Beleid "x".\n\n  Regel "r".\n    Iedereen mag alle gegevens van een x bekijken\n    als aan alle volgende voorwaarden is voldaan:\n      - ${zin}.\n`,
  );
  const blok = r.beleid?.regels?.[0]?.voorwaarden;
  return r.beleid?.regels.length === 1 && blok?.soort === "en" && blok.items.length === 1 && blok.items[0].soort === "voorwaarde" ? blok.items[0] : null;
}

/** Een van-vorm ("de achternaam van de naam van de betrokkene") → verwijzing, of null. */
export function leesVerwijzing(tekst) {
  const v = leesVoorwaardeZin(`${eenRegel(tekst)} is bekend`);
  return v?.operator === "isBekend" && v.links?.soort === "verwijzing" ? v.links : null;
}

/** Een begripsregel ("Inkomensgegevens zijn: alle gegevens van …") → AST, of null. */
export function leesBegripZin(tekst) {
  const zin = eenRegel(tekst);
  if (!zin) return null;
  const r = parseBeleid(`Beleid "x".\n\n  Begrippen.\n    ${zin.replace(/\.$/, "")}.\n`);
  return r.beleid && r.beleid.begrippen.length === 1 && !r.beleid.regels.length ? r.beleid.begrippen[0] : null;
}

// ── Vergelijken: zegt een gelezen voorwaarde hetzelfde als de structuur? ────

/** Een waarde in één vorm: tekst is { letterlijk }, de rest blijft. */
const eenWaarde = (w) => (typeof w === "string" ? { letterlijk: w } : w);
const waardeSleutel = (w) => JSON.stringify(Array.isArray(w) ? w.map(eenWaarde) : eenWaarde(w));

/**
 * Wat een voorwaarde (AST) in het graafbeeld van de export is: anker, subpad,
 * operator en waarde. Via `beleidNaarGraaf` zelf, zodat de export de enige
 * plek blijft die weet hoe een zin een knoop wordt.
 */
function kenmerkVanVoorwaarde(v, opties = {}) {
  const beleid = {
    naam: "x",
    geldigVanaf: null,
    geldigTot: null,
    grondslag: null,
    doel: null,
    begrippen: [],
    regels: [{ naam: "r", wie: { soort: "iedereen" }, verbod: true, wat: { soort: "alle", verwijzing: padNaarVerwijzing("X") }, actie: "bekijken", voorwaarden: v, plichten: [] }],
  };
  try {
    const graaf = beleidNaarGraaf(beleid, { resolveerPad: opties.resolveerPad });
    const als = graaf.verbindingen.find((x) => x.aard === "als");
    const knoop = als && graaf.knopen.find((k) => k.id === als.doel);
    if (!knoop || knoop.aard !== "voorwaarde") return null;
    const doel = graaf.verbindingen.find((x) => x.aard === "waarde" && x.bron === knoop.id);
    const waarde = doel ? { letterlijk: graaf.knopen.find((k) => k.id === doel.doel)?.tekst } : knoop.waarde;
    return [knoop.anker, knoop.subpad, knoop.operator, waardeSleutel(waarde)].join("|");
  } catch {
    return null;
  }
}

// ── Woorden uit een naam van elders ─────────────────────────────────────────

const datum = (w) => (w && typeof w === "object" ? w.datum || null : typeof w === "string" && w ? w : null);
const veilig = (tekst) => String(tekst).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const lokaleNaam = (sleutel) => String(sleutel || "").replace(/^<|>$/g, "").replace(/^.*[:/#]/, "");
const isWoord = (w) => /^[\p{L}_][\p{L}\p{N}_'-]*$/u.test(w);

/** Woorden die in een naam de zin zouden breken: de parser leest ze als structuur. */
const STRUCTUUR = new Set(["van", "voor", "is", "zijn", "mag", "niet", "als", "waarbij", "en", "of", "met", "er", "geen", "alle", "de", "het", "een", "iedereen", "iemand"]);

/**
 * Een naam als woorden die de parser als naam leest: leestekens weg, en
 * (`streng`) de structuurwoorden van de taal weg. Leeg als er niets overblijft.
 */
function naamWoorden(naam, { streng = false, klein = false } = {}) {
  return String(naam || "")
    .split(/[\s/]+/)
    .map((w) => w.replace(/^[^\p{L}_]+|[^\p{L}\p{N}_'-]+/gu, ""))
    .filter((w) => isWoord(w) && !(streng ? STRUCTUUR.has(w.toLowerCase()) : ["mag", "is", "zijn"].includes(w.toLowerCase())))
    .map((w) => (klein ? w.toLowerCase() : w));
}

/** Het lidwoord dat de zin van een regel vóór een naam zet ("Een schuldhulpverlener mag …"). */
function lidwoordIn(zin, naam) {
  const m = new RegExp(`(?:^|\\s)(de|het|een)\\s+${veilig(naam)}(?=\\s|$)`, "i").exec(String(zin || ""));
  return m ? m[1].toLowerCase() : null;
}

// ── De bouwer ───────────────────────────────────────────────────────────────

/**
 * Plan → beleid.
 *
 * @param {{elementen: any[], connectoren: any[]}} plan  uit `pasRegelsToe(graaf, ODRL_AP_NL_NAAR_TOEGANGSSPRAAK)`
 * @param {Object} [opties]
 * @param {(pad: string) => string} [opties.resolveerPad]
 * @param {string} [opties.beleid]                         sleutel van het beleid, als de ODRL er meer bevat
 * @param {"weglaten"|"ruimer"} [opties.bijOnvertaalbaar]  een toestemming met iets onvertaalbaars: weglaten (standaard) of ruimer overnemen
 * @returns {{beleid: any|null, beleiden: {sleutel: string, naam: string, regels: number}[], gekozen: string|null,
 *            telling: {regels: number, overgenomen: number, weggelaten: number}, diagnostics: any[]}}
 */
export function planNaarBeleid(plan, opties = {}) {
  const diagnostics = [];
  const meld = (severity, code, message, sourceId = null) => diagnostics.push({ severity, code, message, sourceId, path: null });
  const el = new Map(plan.elementen.map((e) => [e.sleutel, e]));
  /** De connectoren van één soort die bij een element vertrekken, met hun doel-element. */
  const uit = (bron, type) =>
    plan.connectoren
      .filter((c) => c.bron === bron && c.type === type)
      .map((c) => ({ ...c, el: el.get(c.doel) }))
      .filter((c) => c.el);
  const naamVan = (e) => e.naam || lokaleNaam(e.sleutel);

  // ── welk beleid ──────────────────────────────────────────────────────────
  const beleidEls = plan.elementen.filter((e) => e.type === "beleid");
  const beleiden = beleidEls.map((e) => ({ sleutel: e.sleutel, naam: naamVan(e), regels: uit(e.sleutel, "regel").length }));
  const telling = { regels: 0, overgenomen: 0, weggelaten: 0 };
  if (!beleidEls.length) {
    meld("error", "ODRL-GEEN-BELEID", "De ODRL bevat geen beleid (odrl:Set, odrl:Policy, odrl:Agreement of odrl:Offer).");
    return { beleid: null, beleiden, gekozen: null, telling, diagnostics };
  }
  // Zonder keuze: het eerste beleid dat regels heeft (een beleid met alleen plichten geeft geen tekst).
  const beleidEl = (opties.beleid && beleidEls.find((e) => e.sleutel === opties.beleid)) || beleidEls.find((e) => uit(e.sleutel, "regel").length) || beleidEls[0];
  if (opties.beleid && beleidEl.sleutel !== opties.beleid) meld("warning", "ODRL-BELEID-ONBEKEND", `Het gevraagde beleid "${opties.beleid}" staat niet in de ODRL; "${naamVan(beleidEl)}" is gelezen.`);
  if (beleidEls.length > 1) {
    meld("info", "ODRL-MEER-BELEID", `De ODRL bevat ${beleidEls.length} beleiden; "${naamVan(beleidEl)}" is gelezen. De andere: ${beleiden.filter((b) => b.sleutel !== beleidEl.sleutel).map((b) => `"${b.naam}"`).join(", ")}.`, beleidEl.sleutel);
  }
  const doelEl = uit(beleidEl.sleutel, "doel")[0]?.el || null;
  // Eigen ODRL: geschreven door de export van Toegangsspraak (ze noemt haar woordenschat als profiel).
  const eigen = [beleidEl.data.profiel].flat().includes("ts:profiel");

  // Per regel: wat niet te vertalen was. `fataal` = de regel zelf is niet te lezen.
  let nu = { gemist: [], smaller: [], fataal: [], namen: [] };
  const mis = (tekst) => nu.gemist.push(tekst);
  const interpretaties = new Set();
  const interpreteer = (tekst) => interpretaties.add(tekst);

  // ── voorwaarden ──────────────────────────────────────────────────────────
  /**
   * Anker, subpad, operator en waarde van een voorwaarde-element.
   * @param {any} e
   * @param {"partij"|"gegevens"|"regel"} plek  de plek van de voorwaarde in de ODRL zegt waar ze over gaat:
   *        verfijning op de groep = de aanvrager, verfijning op de gegevens = de gegevens, de rest = de aanvraag
   */
  function structuur(e, plek) {
    let { anker, subpad } = e.data;
    if (!anker && e.data.operand) {
      const i = e.data.operand.indexOf(".");
      anker = i < 0 ? e.data.operand : e.data.operand.slice(0, i);
      subpad = i < 0 ? "" : e.data.operand.slice(i + 1);
    }
    if (!anker && e.data.vreemd) {
      // Een operand uit een ander vocabulaire: kenmerk van de aanvrager (bij een groep) of van de aanvraag.
      const woorden = naamWoorden(camelNaarWoorden(e.data.vreemd).join(" "), { streng: true, klein: true });
      if (woorden.length) {
        anker = plek === "partij" ? "aanvrager" : plek === "gegevens" ? "gegevens" : "aanvraag";
        subpad = woordenNaarVeldnaam(woorden);
        interpreteer(`De operand "${el.get(e.data.vreemdIri)?.naam || e.data.vreemd}" komt uit een ander vocabulaire; hij is gelezen als "${lidwoordVoor(woorden[woorden.length - 1])} ${woorden.join(" ")} van de ${anker}".`);
      }
    }
    // Is de waarde een begrip (de doelbinding, een afdeling, een partij), dan is ze een verbinding — of een lijst ervan.
    const begrippen = uit(e.sleutel, "waarde").sort((a, b) => (Number(a.data.positie) || 0) - (Number(b.data.positie) || 0));
    const waarde = begrippen.length > 1 ? begrippen.map((c) => ({ letterlijk: naamVan(c.el) })) : begrippen.length ? { letterlijk: naamVan(begrippen[0].el) } : e.data.waarde;
    // Buiten de eigen export is zo'n begrip een IRI of code; in de tekst staat zijn naam.
    if (begrippen.length && !eigen) nu.namen.push(...begrippen.map((c) => naamVan(c.el)));
    // Alleen een vergelijking van ODRL, van de eigen woordenschat (ts:) of van het NLGov-profiel
    // (nlgov:, de JSON-LD-export) is dezelfde als die van de taal.
    const bekend = !e.data.operatorIri || /^(odrl|ts|nlgov):/.test(e.data.operatorIri);
    return { anker: anker || "", subpad: subpad || "", operator: bekend ? e.data.operator || "" : "", operatorNaam: el.get(e.data.operatorIri)?.naam || e.data.operator || "", waarde };
  }
  const sleutelVan = (s) => [s.anker, s.subpad, s.operator, waardeSleutel(s.waarde)].join("|");

  const literal = (w) => {
    const v = eenWaarde(w);
    if (typeof v === "number") return { soort: "literal", type: "getal", waarde: v };
    if (v && typeof v === "object" && "datum" in v) return { soort: "literal", type: "datum", waarde: v.datum };
    // Tekst staat in de taal tussen rechte aanhalingstekens; die kan er zelf dus niet in.
    return { soort: "literal", type: "tekst", waarde: String(v && typeof v === "object" ? v.letterlijk ?? "" : v ?? "").replace(/["“”]/g, "'") };
  };

  /** De linkerterm uit anker en subpad; de woorden uit het label van de operand als dat klopt. */
  function linkerterm(s, operandId) {
    let gebouwd;
    if (ANKERS.includes(s.anker)) {
      const keten = s.subpad
        ? s.subpad.split(".").reverse().map((segment) => {
            const woorden = camelNaarWoorden(segment);
            return { lidwoord: lidwoordVoor(woorden[woorden.length - 1]), woorden };
          })
        : [];
      gebouwd = { soort: "verwijzing", keten, basis: { soort: "anker", lidwoord: "de", anker: s.anker } };
    } else {
      gebouwd = { soort: "verwijzing", ...padNaarVerwijzing(s.subpad) };
      if (verwijzingNaarPad(gebouwd) !== s.subpad) gebouwd.pad = s.subpad;
    }
    const label = el.get(operandId)?.naam;
    const gelezen = label ? leesVerwijzing(label) : null;
    if (gelezen) {
      const alsVoorwaarde = (links) => kenmerkVanVoorwaarde({ soort: "voorwaarde", links, operator: "isBekend", rechts: null, rechts2: null, lijst: null }, opties);
      if (alsVoorwaarde(gelezen) === alsVoorwaarde(gebouwd)) return gelezen;
      // De woorden uit de tekst, het pad uit het model (de export had een resolver).
      if (s.anker === "veldwaarde" && gelezen.basis.soort === "type") return { ...gelezen, pad: s.subpad };
    }
    return gebouwd;
  }

  /** Voorwaarde-element → AST, of null (en dan staat in `nu.gemist` waarom). */
  function voorwaarde(e, plek = "regel") {
    const s = structuur(e, plek);
    // Een voorwaarde zonder naam (een lege knoop) heet naar wat ze vergelijkt.
    const naam = e.naam || (/^_:/.test(e.sleutel) ? [e.data.vreemd || e.data.operand || s.subpad, s.operatorNaam].filter(Boolean).join(" ") : lokaleNaam(e.sleutel));
    // De zinsnede uit de klare taal, als ze hetzelfde zegt als de structuur.
    const gelezen = e.naam ? leesVoorwaardeZin(e.naam) : null;
    if (gelezen && kenmerkVanVoorwaarde(gelezen, opties) === sleutelVan(s)) return gelezen;

    if (s.operator === "bestaat" || s.anker === "bestaat") {
      // "voor …" staat alleen in het label van de operand ("toestemming voor de betrokkene").
      const operand = el.get(`ts:bestaat.${s.subpad}`)?.naam;
      const viaOperand = operand ? leesVoorwaardeZin(`er is ${s.waarde === false ? "geen" : "een"} ${operand}`) : null;
      if (viaOperand && kenmerkVanVoorwaarde(viaOperand, opties) === sleutelVan(s)) return viaOperand;
      return {
        soort: "voorwaarde",
        operator: "bestaat",
        existentie: { ontkenning: s.waarde === false, lidwoord: s.waarde === false ? null : "een", woorden: camelNaarWoorden(s.subpad), voor: null },
        links: null,
        rechts: null,
        rechts2: null,
        lijst: null,
      };
    }
    const op = vindOperator(s.operator);
    if (!op) {
      mis(`de voorwaarde "${naam}" gebruikt de vergelijking "${s.operatorNaam}", die Toegangsspraak niet kent`);
      return null;
    }
    if (!s.anker || (!ANKERS.includes(s.anker) && s.anker !== "veldwaarde")) {
      mis(`de voorwaarde "${naam}" gaat over "${e.data.operand || e.data.vreemd || s.anker}", en dat is geen gegeven dat Toegangsspraak kent`);
      return null;
    }
    const v = { soort: "voorwaarde", links: linkerterm(s, `ts:${s.anker}${s.subpad ? `.${s.subpad}` : ""}`), operator: op.canoniek, rechts: null, rechts2: null, lijst: null };
    const waarden = Array.isArray(s.waarde) ? s.waarde : [s.waarde];
    if (op.unair) return v;
    if (waarden.some((w) => typeof w === "boolean")) interpreteer(`De voorwaarde "${naam}" vergelijkt met waar/onwaar; Toegangsspraak schrijft dat als tekst ("true" of "false").`);
    if (!op.lijst && !op.tussen && waarden.length > 1) {
      mis(`de voorwaarde "${naam}" heeft meer waarden dan de vergelijking "${op.zin}" toelaat`);
      return null;
    }
    if (op.lijst) v.lijst = waarden.map(literal);
    else if (op.tussen) [v.rechts, v.rechts2] = [literal(waarden[0]), literal(waarden[1])];
    else v.rechts = literal(waarden[0]);
    return v;
  }

  /**
   * Voorwaardegroep-element → blok { soort: en|of|xof, items }. Mist er een lid,
   * dan blijft een en-groep staan zonder dat lid en valt een of-groep als geheel
   * weg: zo wordt een verbod nooit ruimer (een toestemming is dan al gemeld).
   */
  function groep(e, pad = new Set()) {
    if (pad.has(e.sleutel)) return null;
    const leden = uit(e.sleutel, "lid").sort((a, b) => (Number(a.data.positie) || 0) - (Number(b.data.positie) || 0));
    if (!leden.length) return null;
    const soort = leden[0].data.logica || "en";
    const items = leden.map((lid) => item(lid.el, new Set(pad).add(e.sleutel)));
    if (items.some((x) => !x) && soort !== "en") return null;
    const over = items.filter(Boolean);
    return over.length ? { soort, items: over } : null;
  }
  const item = (e, pad, plek = "regel") => {
    if (e.type === "voorwaardegroep") return groep(e, pad);
    if (e.type === "voorwaarde") return voorwaarde(e, plek);
    mis(`"${naamVan(e)}" is geen voorwaarde die Toegangsspraak kent`);
    return null;
  };

  // ── wie ──────────────────────────────────────────────────────────────────
  /** @type {Map<string, any>} naam (klein) → begrip */
  const begrippen = new Map();
  const begrip = (b) => {
    if (!begrippen.has(b.naam.toLowerCase())) begrippen.set(b.naam.toLowerCase(), b);
  };

  function wie(regelEl) {
    // De partij van de regel, anders die van het beleid (ODRL 2.2: wat op het beleid staat geldt voor elke regel).
    const partij = (uit(regelEl.sleutel, "wie")[0] || uit(beleidEl.sleutel, "wie")[0])?.el;
    // Zonder assignee geldt de regel voor iedereen.
    if (!partij) return { wie: { soort: "iedereen" }, kenmerkIds: new Set() };
    if (partij.type !== "partij") {
      nu.fataal.push(`"${naamVan(partij)}" is geen partij of groep die Toegangsspraak kent`);
      return { wie: { soort: "iedereen" }, kenmerkIds: new Set() };
    }
    const kenmerkEls = uit(partij.sleutel, "kenmerk").map((c) => c.el);
    const kenmerkIds = new Set(kenmerkEls.map((k) => k.sleutel));
    const kenmerken = [];
    for (const k of kenmerkEls) {
      const s = structuur(k, "partij");
      if (k.type !== "voorwaarde" || s.anker !== "aanvrager" || s.operator !== "eq" || Array.isArray(s.waarde)) {
        mis(`het kenmerk "${naamVan(k)}" van de groep "${naamVan(partij)}" is geen "kenmerk is waarde" van de aanvrager`);
        continue;
      }
      kenmerken.push({ kenmerk: camelNaarWoorden(s.subpad).join(" "), waarde: literal(s.waarde).waarde });
    }
    const label = naamVan(partij);
    // Eén benoemde partij (een organisatie): een begrip met het kenmerk organisatie.
    if (partij.data.benoemd && !kenmerken.length) {
      const naam = naamWoorden(label).join(" ") || "partij";
      begrip({ soort: "wie", lidwoord: "de", naam, kenmerken: [{ kenmerk: "organisatie", waarde: literal(label).waarde }] });
      interpreteer(`De partij "${label}" is gelezen als een begrip: iemand met organisatie "${label}".`);
      return { wie: { soort: "begrip", lidwoord: "de", naam }, kenmerkIds };
    }
    if (!kenmerken.length) {
      // Een groep zonder kenmerken: iedereen (zo schrijft de export het), of een groep die de taal niet kan bepalen.
      if (label.toLowerCase() !== "iedereen" && !kenmerkEls.length) mis(`de groep "${label}" heeft geen kenmerken waaraan Toegangsspraak haar kan herkennen`);
      return { wie: { soort: "iedereen" }, kenmerkIds };
    }
    // Zonder eigen naam ("rol beheerder") stond de groep in de regel zelf: iemand met rol "beheerder".
    if (label === kenmerken.map((k) => `${k.kenmerk} ${k.waarde}`).join(", ")) return { wie: { soort: "iemand", kenmerken }, kenmerkIds };
    const naam = naamWoorden(label).join(" ") || "groep";
    begrip({ soort: "wie", lidwoord: "een", naam, kenmerken });
    return { wie: { soort: "begrip", lidwoord: lidwoordIn(regelEl.data.zin, naam) || "een", naam }, kenmerkIds };
  }

  // ── wat ──────────────────────────────────────────────────────────────────
  /** Registerdeel → wat: "alle gegevens van …" voor een entiteit of gegevenselement, anders het veld. */
  function watUitRegisterdeel(deel) {
    const pad = String(deel.data.pad || "");
    const gelezen = deel.naam ? leesVerwijzing(deel.naam) : null;
    if (gelezen?.basis.soort === "type") {
      if (verwijzingNaarGroepPad(gelezen) === pad) return { soort: "alle", verwijzing: { keten: gelezen.keten, basis: gelezen.basis } };
      if (verwijzingNaarPad(gelezen) === pad) return { soort: "verwijzing", keten: gelezen.keten, basis: gelezen.basis };
      // De woorden uit de tekst, het pad uit het model (de export had een resolver).
      return { soort: "verwijzing", keten: gelezen.keten, basis: gelezen.basis, pad };
    }
    const segmenten = pad.split(".");
    const laatste = segmenten[segmenten.length - 1];
    const v = padNaarVerwijzing(pad);
    if (segmenten.length === 1 || /^\p{Lu}/u.test(laatste)) return { soort: "alle", verwijzing: verwijzingNaarGroepPad(v) === pad ? v : { ...v, pad } };
    return verwijzingNaarPad(v) === pad ? { soort: "verwijzing", ...v } : { soort: "verwijzing", ...v, pad };
  }
  const padVanWat = (w) => {
    const v = w.soort === "alle" ? w.verwijzing : w;
    return v.pad || (w.soort === "alle" ? verwijzingNaarGroepPad(v) : verwijzingNaarPad(v));
  };

  /** De woorden van een gegeven van elders: het label als dat een naam kan zijn, anders de naam uit de IRI. */
  const gegevenWoorden = (e) => {
    const uitLabel = naamWoorden(e.naam, { streng: true, klein: true });
    const woorden = uitLabel.length && uitLabel.length <= 6 ? uitLabel : naamWoorden(camelNaarWoorden(lokaleNaam(e.sleutel)).join(" "), { streng: true, klein: true });
    return woorden.length ? woorden : ["gegeven"];
  };
  const isLosGegeven = (e) => e?.type === "gegeven" || e?.type === "gegevensbegrip";
  const heeftDelen = (e) => plan.connectoren.some((c) => c.type === "onderdeel-van" && c.doel === e.sleutel && isLosGegeven(el.get(c.bron)));

  /**
   * Een asset zonder pad in een register → wat, naar zijn naam en zijn
   * partOf-keten: de bovenste is het type, wat eronder hangt de keten.
   */
  function watUitGegeven(e) {
    const keten = [e];
    const gezien = new Set([e.sleutel]);
    for (let ouder = uit(e.sleutel, "onderdeel-van").map((c) => c.el).find(isLosGegeven); ouder && !gezien.has(ouder.sleutel) && keten.length < 6; ouder = uit(ouder.sleutel, "onderdeel-van").map((c) => c.el).find(isLosGegeven)) {
      gezien.add(ouder.sleutel);
      keten.push(ouder);
    }
    const top = keten[keten.length - 1];
    let typeWoorden = gegevenWoorden(top);
    // Eén woord dat een anker van de taal is ("gegevens") zou als anker gelezen worden.
    if (typeWoorden.length === 1 && ANKERS.includes(typeWoorden[0])) typeWoorden = ["register", typeWoorden[0]];
    const verwijzing = {
      keten: keten.slice(0, -1).map((k) => {
        const woorden = gegevenWoorden(k);
        return { lidwoord: lidwoordVoor(woorden[woorden.length - 1]), woorden };
      }),
      basis: { soort: "type", lidwoord: "een", woorden: typeWoorden },
    };
    const w = keten.length === 1 || heeftDelen(e) ? { soort: "alle", verwijzing } : { soort: "verwijzing", ...verwijzing };
    interpreteer(`De gegevens "${naamVan(e)}" hebben geen pad in een register; ze zijn gelezen naar hun naam${keten.length > 1 ? " en de verzameling waar ze onder vallen" : ""}.`);
    return w;
  }

  function wat(regelEl) {
    // De gegevens van de regel, anders die van het beleid (ODRL 2.2 §2.7.1).
    const doel = (uit(regelEl.sleutel, "wat")[0] || uit(beleidEl.sleutel, "wat")[0])?.el;
    if (!doel) {
      nu.fataal.push("er staan geen gegevens bij (odrl:target), of het zijn geen gegevens die Toegangsspraak kan lezen");
      return null;
    }
    if (doel.type === "registerdeel") return watUitRegisterdeel(doel);
    if (doel.type === "gegeven") return watUitGegeven(doel);
    if (doel.type !== "gegevensbegrip") {
      nu.fataal.push(`de gegevens "${naamVan(doel)}" zijn geen begrip of deel van een register`);
      return null;
    }
    const deel = plan.connectoren.filter((c) => c.type === "onderdeel-van" && c.doel === doel.sleutel).map((c) => el.get(c.bron)).find((d) => d?.type === "registerdeel");
    // Een verzameling van elders, zonder deel van een register eronder: lezen naar haar naam.
    if (!deel) return watUitGegeven(doel);
    const naam = naamVan(doel);
    if (!begrippen.has(naam.toLowerCase())) {
      // De kop van het begrip ("Het dossier is", "Inkomensgegevens zijn") staat niet in de ODRL.
      // Benadering: een meervoud zonder lidwoord met "zijn", een enkelvoud met het lidwoord uit de regel en "is".
      const meervoud = /(en|s)$/i.test(naam);
      const kop = meervoud ? { lidwoord: null, werkwoord: "zijn" } : { lidwoord: lidwoordIn(regelEl.data.zin, naam) || lidwoordVoor(naam.split(" ").pop()), werkwoord: "is" };
      const gebouwd = { soort: "wat", ...kop, naam, wat: watUitRegisterdeel(deel), waarvan: null };
      // De omschrijving in klare taal draagt ook `waarvan`; ze telt als ze hetzelfde deel aanwijst.
      const resolveer = opties.resolveerPad || ((p) => p);
      const gelezen = doel.data.definitie ? leesBegripZin(`${naam} zijn: ${doel.data.definitie}`) : null;
      const klopt = gelezen?.soort === "wat" && resolveer(padVanWat(gelezen.wat) || "") === deel.data.pad;
      begrip(klopt ? { ...gelezen, ...kop, naam } : gebouwd);
    }
    return { soort: "begrip", lidwoord: lidwoordIn(regelEl.data.zin, naam) || "de", naam };
  }

  // ── handeling ────────────────────────────────────────────────────────────
  /**
   * Eén handeling (IRI, compact) → het woord van de taal. Een handeling uit een
   * ander vocabulaire telt als ze zegt onder welke ODRL-handeling ze valt
   * (`odrl:includedIn`): dan is ze een bijzondere vorm van dat woord (`smaller`).
   * @returns {{woord: string, exact?: boolean, ruim?: boolean, smaller?: boolean, naam: string}|null}
   */
  function woordVan(iri, diepte = 0) {
    const bekend = woordVoorHandeling(iri);
    if (bekend) return { ...bekend, naam: String(iri) };
    const term = el.get(iri);
    if (!term || term.type !== "term" || diepte > 5) return null;
    for (const breder of [term.data.breder].flat().filter(Boolean)) {
      const boven = woordVan(breder, diepte + 1);
      if (boven) return { woord: boven.woord, ruim: boven.ruim, smaller: true, naam: naamVan(term), boven: boven.naam };
    }
    return null;
  }

  /**
   * De handelingen van een regel als woorden van de taal (elk woord één keer),
   * met de knopen waar verfijningen aan hangen. Wat niet te lezen is staat in
   * `nu`: een bijzondere vorm die een breder woord krijgt is `gemist` (de regel
   * zegt dan meer dan de ODRL), een woord dat minder omvat dan de ODRL-handeling
   * of een handeling die wegvalt is `smaller`.
   */
  function handelingenVan(regelEl, verbod) {
    const eigenKnopen = uit(regelEl.sleutel, "doet").map((c) => c.el);
    // Zonder eigen knoop staat de handeling als IRI op de regel (odrl:action odrl:read) — of een lijst ervan.
    const eigenIris = [regelEl.data.handeling].flat().filter((x) => typeof x === "string" && x && !el.has(x));
    // Zonder eigen handeling geldt die van het beleid (ODRL 2.2 §2.7.1).
    const vanBeleid = !eigenKnopen.length && !eigenIris.length;
    const knopen = vanBeleid ? uit(beleidEl.sleutel, "doet").map((c) => c.el) : eigenKnopen;
    const iris = vanBeleid ? [beleidEl.data.handeling].flat().filter((x) => typeof x === "string" && x && !el.has(x)) : eigenIris;
    const bronnen = [...knopen.map((k) => ({ knoop: k, iri: k.type === "handeling" ? k.data.bron || "" : k.sleutel, woord: k.type === "handeling" && k.data.actie ? k.data.actie : "" })), ...iris.map((iri) => ({ knoop: null, iri, woord: "" }))];
    const woorden = [];
    const onbekend = [];
    for (const b of bronnen) {
      const gevonden = b.woord ? { ...(woordVoorHandeling(b.iri) || { exact: true }), woord: b.woord, naam: b.iri } : woordVan(b.iri);
      if (!gevonden || !vindActie(gevonden.woord)) {
        onbekend.push(el.get(b.iri)?.naam || b.iri || "zonder naam");
        continue;
      }
      if (gevonden.smaller) mis(`de handeling "${gevonden.naam}" is een bijzondere vorm van ${gevonden.boven}; Toegangsspraak kent daarvoor alleen het bredere "${gevonden.woord}"`);
      else if (gevonden.ruim && verbod) {
        // Een verbod op elk gebruik: uitgeschreven voor elke handeling die de taal kent, zodat het niet ruimer wordt.
        interpreteer(`De handeling ${gevonden.naam} omvat elk gebruik; het verbod is uitgeschreven voor elke handeling die Toegangsspraak kent.`);
        for (const a of geefActies()) if (!woorden.includes(a.woord)) woorden.push(a.woord);
        continue;
      } else if (gevonden.ruim) nu.smaller.push(`de handeling ${gevonden.naam} omvat meer dan "${gevonden.woord}"`);
      else if (!gevonden.exact) interpreteer(`De handeling ${gevonden.naam} is gelezen als "${gevonden.woord}".`);
      if (!woorden.includes(gevonden.woord)) woorden.push(gevonden.woord);
    }
    if (!bronnen.length) nu.fataal.push("er staat geen handeling bij (odrl:action)");
    else if (!woorden.length) nu.fataal.push(`de handeling ${onbekend.map((x) => `"${x}"`).join(", ")} kent Toegangsspraak niet`);
    else if (onbekend.length) nu.smaller.push(`de handeling ${onbekend.map((x) => `"${x}"`).join(", ")} kent Toegangsspraak niet en is weggelaten`);
    return { woorden, knopen: knopen.filter((k) => k.type === "handeling") };
  }

  // ── regels ───────────────────────────────────────────────────────────────
  const regelEls = uit(beleidEl.sleutel, "regel")
    .map((c, i) => ({ el: c.el, i, nr: Number(c.el.data.volgorde) || Infinity }))
    .sort((a, b) => a.nr - b.nr || a.i - b.i)
    .map((x) => x.el);

  const regels = [];
  let ruimer = false;
  regelEls.forEach((regelEl, index) => {
    telling.regels += 1;
    nu = { gemist: [], smaller: [], fataal: [], namen: [] };
    const verbod = regelEl.data.modaliteit === "mag-niet";
    // Een naam staat tussen aanhalingstekens; een regel zonder naam (een lege knoop) krijgt zijn nummer.
    const naam = (regelEl.naam || (/^_:/.test(regelEl.sleutel) ? `regel ${index + 1}` : lokaleNaam(regelEl.sleutel))).replace(/["“”]/g, "'");
    const { woorden, knopen: handelingen } = handelingenVan(regelEl, verbod);
    const w = wie(regelEl);
    const gegevens = wat(regelEl);

    // Verfijningen op de handeling, zonder wat bij "wie" hoort en zonder de doelbinding van het beleid.
    const isBeleidsdoel = (e) => !verbod && doelEl && e.type === "voorwaarde" && e.data.anker === "aanvraag" && e.data.subpad === "doel" && e.data.operator === "eq" && uit(e.sleutel, "waarde")[0]?.el === doelEl;
    const opVerzoek = handelingen.flatMap((h) => uit(h.sleutel, "als").map((c) => c.el)).filter((e, i, alle) => alle.indexOf(e) === i && !w.kenmerkIds.has(e.sleutel) && !isBeleidsdoel(e));
    const opGegevens = uit(regelEl.sleutel, "als").map((c) => c.el);
    // Een verfijning op de gegevens zelf bakent de populatie af ("alle gegevens van … waarvan …").
    // In de regel is dat een voorwaarde over de gegevens.
    const doelwit = (uit(regelEl.sleutel, "wat")[0] || uit(beleidEl.sleutel, "wat")[0])?.el;
    const afbakening = doelwit ? uit(doelwit.sleutel, "als").map((c) => c.el) : [];
    const items = [...[...opVerzoek, ...opGegevens].map((e) => item(e, new Set())), ...afbakening.map((e) => item(e, new Set(), "gegevens"))].filter(Boolean);
    const voorwaarden = !items.length ? null : items.length === 1 ? items[0] : { soort: "en", items };

    const plichten = [];
    for (const c of uit(regelEl.sleutel, "waarbij")) {
      const bekend = (/^ts:/.test(c.el.data.handeling || "") && geefPlichten().find((p) => p.nlgov.split(":").pop() === c.el.data.plicht)) || vindPlicht(c.el.naam || "");
      if (bekend) plichten.push({ zin: bekend.zin, nlgov: bekend.nlgov });
      else mis(`de plicht "${c.el.naam || c.el.data.plicht}" kent Toegangsspraak niet`);
    }

    // Wat de regel ruimer zou maken dan de ODRL, en wat hem strenger maakt: bij een verbod is dat omgekeerd.
    const [verruimt, verstrengt] = verbod ? [nu.smaller, nu.gemist] : [nu.gemist, nu.smaller];
    const soort = verbod ? "Het verbod" : "De toestemming";
    if (nu.fataal.length || !woorden.length || !gegevens) {
      telling.weggelaten += 1;
      if (verbod) ruimer = true;
      meld("warning", verbod ? "ODRL-VERBOD-WEG" : "ODRL-REGEL-WEG", `${soort} "${naam}" is niet overgenomen: ${nu.fataal.join("; ") || "de regel is niet te lezen"}.${verbod ? " Het beleid in klare taal is daardoor ruimer dan de ODRL." : ""}`, regelEl.sleutel);
      return;
    }
    if (verruimt.length && !verbod && opties.bijOnvertaalbaar !== "ruimer") {
      telling.weggelaten += 1;
      meld("warning", "ODRL-REGEL-WEG", `${soort} "${naam}" is niet overgenomen: ${verruimt.join("; ")}. Zonder dat onderdeel zou de toestemming ruimer zijn dan in de ODRL.`, regelEl.sleutel);
      return;
    }
    if (verruimt.length) {
      ruimer = true;
      meld("warning", "ODRL-RUIMER", `${soort} "${naam}" is ruimer dan in de ODRL: ${verruimt.join("; ")}.`, regelEl.sleutel);
    }
    // Een begrip als waarde staat er met zijn naam. Vergelijkt de uitvoering op een code of IRI, dan
    // slaat de voorwaarde nooit aan: bij een toestemming strenger, bij een verbod ruimer.
    if (nu.namen.length) {
      const namen = [...new Set(nu.namen)].map((n) => `"${n}"`).join(", ");
      if (verbod) ruimer = true;
      meld(
        verbod ? "warning" : "info",
        "ODRL-WAARDE-NAAM",
        `${soort} "${naam}" vergelijkt met ${namen}: in de ODRL een begrip (een IRI), hier zijn naam. Vergelijkt de uitvoering op een code of IRI, zet die dan in de tekst${verbod ? "; anders slaat het verbod niet aan" : ""}.`,
        regelEl.sleutel,
      );
    }
    if (verstrengt.length) meld("info", "ODRL-STRENGER", `${soort} "${naam}" is strenger dan in de ODRL: ${verstrengt.join("; ")}.`, regelEl.sleutel);
    telling.overgenomen += 1;
    // Meer handelingen op één regel: per woord van de taal een regel.
    for (const actie of woorden) regels.push({ naam: woorden.length > 1 ? `${naam} (${actie})` : naam, wie: w.wie, verbod, wat: gegevens, actie, voorwaarden, plichten });
  });

  // ── wat de taal op het beleid niet kent ──────────────────────────────────
  if (beleidEl.data.status) {
    ruimer = true;
    meld("warning", "ODRL-GEEN-OVEREENKOMST", `"${naamVan(beleidEl)}" is een ${beleidEl.data.status} (odrl:${beleidEl.data.status === "aanbod" ? "Offer" : "Request"}), geen geldend beleid: het geldt pas als overeenkomst. De regels zijn wel gelezen.`, beleidEl.sleutel);
  }
  // De conflictregel van ODRL (§2.9). De eigen export schrijft altijd odrl:prohibit; daar zegt het dus niets.
  let conflict = null;
  if (!eigen && beleidEl.data.conflict === "perm") conflict = "toestemming-wint";
  if (!eigen && beleidEl.data.conflict === "invalid") {
    ruimer = true;
    meld("warning", "ODRL-CONFLICT", "De ODRL verklaart het hele beleid ongeldig zodra twee regels elkaar tegenspreken (odrl:invalid). Toegangsspraak kent dat niet: hier gaat bij een conflict het verbod voor.", beleidEl.sleutel);
  }
  for (const c of uit(beleidEl.sleutel, "plicht-van-beleid")) {
    ruimer = true;
    meld("warning", "ODRL-PLICHT-BELEID", `Het beleid legt de plicht "${naamVan(c.el)}" op. Toegangsspraak kent alleen plichten bij een regel; deze is niet overgenomen.`, c.el.sleutel);
  }
  for (const c of uit(beleidEl.sleutel, "erft")) {
    ruimer = true;
    meld("warning", "ODRL-ERFT", `Het beleid neemt de regels van "${naamVan(c.el)}" over (odrl:inheritFrom). Toegangsspraak kent dat niet; wat daar staat is niet meegenomen.`, c.el.sleutel);
  }
  for (const tekst of interpretaties) meld("info", "ODRL-INTERPRETATIE", tekst);
  if (ruimer) meld("warning", "ODRL-RUIMER-DAN-BRON", "Let op: het beleid in klare taal is op de gemelde punten ruimer dan de ODRL. Loop het na voordat je het gebruikt.");

  const lijst = [...begrippen.values()];
  const beleid = {
    naam: naamVan(beleidEl).replace(/["“”]/g, "'"),
    geldigVanaf: datum(beleidEl.data.geldigVanaf),
    geldigTot: datum(beleidEl.data.geldigTot),
    grondslag: uit(beleidEl.sleutel, "grondslag")[0]?.el.naam || null,
    doel: doelEl?.naam || null,
    // Eerst wie, dan wat — de gebruikelijke volgorde onder "Begrippen.".
    begrippen: [...lijst.filter((b) => b.soort === "wie"), ...lijst.filter((b) => b.soort === "wat")],
    regels,
    ...(conflict ? { conflict } : {}),
  };
  return { beleid, beleiden, gekozen: beleidEl.sleutel, telling, diagnostics };
}
