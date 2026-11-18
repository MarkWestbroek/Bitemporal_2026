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
 * Puur; geen store, geen React.
 */
import { parseBeleid, padNaarVerwijzing, verwijzingNaarPad, verwijzingNaarGroepPad, ANKERS } from "./parser.js";
import { beleidNaarGraaf } from "./graaf.js";
import { vindOperator, vindActie, geefPlichten, vindPlicht } from "./operatoren.js";
import { camelNaarWoorden, lidwoordVoor } from "./woorden.js";

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

// ── De bouwer ───────────────────────────────────────────────────────────────

const datum = (w) => (w && typeof w === "object" ? w.datum || null : typeof w === "string" && w ? w : null);
const veilig = (tekst) => String(tekst).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Het lidwoord dat de zin van een regel vóór een naam zet ("Een schuldhulpverlener mag …"). */
function lidwoordIn(zin, naam) {
  const m = new RegExp(`(?:^|\\s)(de|het|een)\\s+${veilig(naam)}(?=\\s|$)`, "i").exec(String(zin || ""));
  return m ? m[1].toLowerCase() : null;
}

/**
 * Plan → beleid.
 *
 * @param {{elementen: any[], connectoren: any[]}} plan  uit `pasRegelsToe(graaf, ODRL_AP_NL_NAAR_TOEGANGSSPRAAK)`
 * @param {{resolveerPad?: (pad: string) => string}} [opties]
 * @returns {{beleid: any|null, diagnostics: any[]}}
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

  const beleiden = plan.elementen.filter((e) => e.type === "beleid");
  if (!beleiden.length) {
    meld("error", "ODRL-GEEN-BELEID", "De ODRL bevat geen beleid (odrl:Set of odrl:Policy).");
    return { beleid: null, diagnostics };
  }
  const beleidEl = beleiden[0];
  if (beleiden.length > 1) meld("warning", "ODRL-MEER-BELEID", `De ODRL bevat ${beleiden.length} beleiden; alleen "${beleidEl.naam}" is gelezen.`, beleidEl.sleutel);
  const doelEl = uit(beleidEl.sleutel, "doel")[0]?.el || null;

  // ── voorwaarden ──────────────────────────────────────────────────────────
  /** Anker, subpad, operator en waarde van een voorwaarde-element. */
  function structuur(e) {
    let { anker, subpad } = e.data;
    if (!anker && e.data.operand) {
      const i = e.data.operand.indexOf(".");
      anker = i < 0 ? e.data.operand : e.data.operand.slice(0, i);
      subpad = i < 0 ? "" : e.data.operand.slice(i + 1);
    }
    // Is de waarde een begrip uit het beleid (de doelbinding), dan is ze een verbinding.
    const begrip = uit(e.sleutel, "waarde")[0];
    const waarde = begrip ? { letterlijk: begrip.el.naam } : e.data.waarde;
    return { anker: anker || "", subpad: subpad || "", operator: e.data.operator || "", waarde };
  }
  const sleutelVan = (s) => [s.anker, s.subpad, s.operator, waardeSleutel(s.waarde)].join("|");

  const literal = (w) => {
    const v = eenWaarde(w);
    if (typeof v === "number") return { soort: "literal", type: "getal", waarde: v };
    if (v && typeof v === "object" && "datum" in v) return { soort: "literal", type: "datum", waarde: v.datum };
    return { soort: "literal", type: "tekst", waarde: String(v && typeof v === "object" ? v.letterlijk ?? "" : v ?? "") };
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
      const zelfde = (a, b) => kenmerkVanVoorwaarde({ soort: "voorwaarde", links: a, operator: "isBekend", rechts: null, rechts2: null, lijst: null }, opties) === kenmerkVanVoorwaarde({ soort: "voorwaarde", links: b, operator: "isBekend", rechts: null, rechts2: null, lijst: null }, opties);
      if (zelfde(gelezen, gebouwd)) return gelezen;
      // De woorden uit de tekst, het pad uit het model (de export had een resolver).
      if (s.anker === "veldwaarde" && gelezen.basis.soort === "type") return { ...gelezen, pad: s.subpad };
    }
    return gebouwd;
  }

  /** Voorwaarde-element → AST. */
  function voorwaarde(e) {
    const s = structuur(e);
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
      meld("warning", "ODRL-VERGELIJKING", `Voorwaarde "${e.naam || e.sleutel}": de vergelijking "${s.operator}" kent Toegangsspraak niet; de voorwaarde is weggelaten.`, e.sleutel);
      return null;
    }
    if (!s.anker || (!ANKERS.includes(s.anker) && s.anker !== "veldwaarde")) {
      meld("warning", "ODRL-OPERAND", `Voorwaarde "${e.naam || e.sleutel}": de linkerterm "${e.data.operand || s.anker}" is geen gegeven dat Toegangsspraak kent; de voorwaarde is weggelaten.`, e.sleutel);
      return null;
    }
    const v = { soort: "voorwaarde", links: linkerterm(s, `ts:${s.anker}${s.subpad ? `.${s.subpad}` : ""}`), operator: op.canoniek, rechts: null, rechts2: null, lijst: null };
    const waarden = Array.isArray(s.waarde) ? s.waarde : [s.waarde];
    if (op.unair) return v;
    if (op.lijst) v.lijst = waarden.map(literal);
    else if (op.tussen) [v.rechts, v.rechts2] = [literal(waarden[0]), literal(waarden[1])];
    else v.rechts = literal(waarden[0]);
    return v;
  }

  /** Voorwaardegroep-element → blok { soort: en|of|xof, items }. */
  function groep(e, pad = new Set()) {
    if (pad.has(e.sleutel)) return null;
    const leden = uit(e.sleutel, "lid").sort((a, b) => (Number(a.data.positie) || 0) - (Number(b.data.positie) || 0));
    const items = leden.map((lid) => item(lid.el, new Set(pad).add(e.sleutel))).filter(Boolean);
    if (!items.length) return null;
    return { soort: leden[0].data.logica || "en", items };
  }
  const item = (e, pad) => (e.type === "voorwaardegroep" ? groep(e, pad) : e.type === "voorwaarde" ? voorwaarde(e) : null);

  // ── wie en wat ───────────────────────────────────────────────────────────
  /** @type {Map<string, any>} naam (klein) → begrip */
  const begrippen = new Map();
  const begrip = (b) => {
    if (!begrippen.has(b.naam.toLowerCase())) begrippen.set(b.naam.toLowerCase(), b);
  };

  function wie(regelEl) {
    const partij = uit(regelEl.sleutel, "wie")[0]?.el;
    // Een regel zonder assignee geldt voor iedereen.
    if (!partij) return { wie: { soort: "iedereen" }, kenmerkIds: new Set() };
    const kenmerkEls = uit(partij.sleutel, "kenmerk").map((c) => c.el);
    const kenmerken = [];
    for (const k of kenmerkEls) {
      const s = structuur(k);
      if (s.anker !== "aanvrager" || s.operator !== "eq" || Array.isArray(s.waarde)) {
        meld("warning", "ODRL-KENMERK", `Groep "${partij.naam}": het kenmerk "${k.naam || k.sleutel}" is geen "kenmerk is waarde" van de aanvrager; het is weggelaten.`, k.sleutel);
        continue;
      }
      kenmerken.push({ kenmerk: camelNaarWoorden(s.subpad).join(" "), waarde: literal(s.waarde).waarde });
    }
    const kenmerkIds = new Set(kenmerkEls.map((k) => k.sleutel));
    if (!kenmerken.length) return { wie: { soort: "iedereen" }, kenmerkIds };
    const naam = partij.naam || kenmerken.map((k) => k.waarde).join(" ");
    // Zonder eigen naam ("rol beheerder") stond de groep in de regel zelf: iemand met rol "beheerder".
    if (naam === kenmerken.map((k) => `${k.kenmerk} ${k.waarde}`).join(", ")) return { wie: { soort: "iemand", kenmerken }, kenmerkIds };
    begrip({ soort: "wie", lidwoord: "een", naam, kenmerken });
    return { wie: { soort: "begrip", lidwoord: lidwoordIn(regelEl.data.zin, naam) || "een", naam }, kenmerkIds };
  }

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

  function wat(regelEl) {
    const doel = uit(regelEl.sleutel, "wat")[0]?.el;
    if (!doel) {
      meld("warning", "ODRL-GEEN-GEGEVENS", `Regel "${regelEl.naam}": geen gegevens (odrl:target); de regel is weggelaten.`, regelEl.sleutel);
      return null;
    }
    if (doel.type === "registerdeel") return watUitRegisterdeel(doel);
    if (doel.type !== "gegevensbegrip") {
      meld("warning", "ODRL-GEGEVENS", `Regel "${regelEl.naam}": de gegevens "${doel.naam || doel.sleutel}" zijn geen begrip of registerdeel; de regel is weggelaten.`, regelEl.sleutel);
      return null;
    }
    const naam = doel.naam || doel.sleutel;
    if (!begrippen.has(naam.toLowerCase())) {
      const deel = plan.connectoren.filter((c) => c.type === "onderdeel-van" && c.doel === doel.sleutel).map((c) => el.get(c.bron)).find((d) => d?.type === "registerdeel");
      if (!deel) {
        meld("warning", "ODRL-BEGRIP", `Regel "${regelEl.naam}": het begrip "${naam}" wijst geen deel van het register aan; de regel is weggelaten.`, doel.sleutel);
        return null;
      }
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

  // ── regels ───────────────────────────────────────────────────────────────
  const regelEls = uit(beleidEl.sleutel, "regel")
    .map((c, i) => ({ el: c.el, i, nr: Number(c.el.data.volgorde) || Infinity }))
    .sort((a, b) => a.nr - b.nr || a.i - b.i)
    .map((x) => x.el);

  const regels = [];
  for (const regelEl of regelEls) {
    const verbod = regelEl.data.modaliteit === "mag-niet";
    const handeling = uit(regelEl.sleutel, "doet")[0]?.el;
    const actie = handeling?.data.actie || "";
    if (!vindActie(actie)) {
      meld("warning", "ODRL-HANDELING", `Regel "${regelEl.naam}": ${actie ? `de handeling "${actie}" kent Toegangsspraak niet` : "geen handeling (odrl:action) die Toegangsspraak kent"}; de regel is weggelaten.`, regelEl.sleutel);
      continue;
    }
    const w = wie(regelEl);
    const gegevens = wat(regelEl);
    if (!gegevens) continue;

    // Verfijningen op de handeling, zonder wat bij "wie" hoort en zonder de doelbinding van het beleid.
    const isBeleidsdoel = (e) => !verbod && doelEl && e.type === "voorwaarde" && e.data.anker === "aanvraag" && e.data.subpad === "doel" && e.data.operator === "eq" && uit(e.sleutel, "waarde")[0]?.el === doelEl;
    const opVerzoek = handeling ? uit(handeling.sleutel, "als").map((c) => c.el).filter((e) => !w.kenmerkIds.has(e.sleutel) && !isBeleidsdoel(e)) : [];
    const opGegevens = uit(regelEl.sleutel, "als").map((c) => c.el);
    const items = [...opVerzoek, ...opGegevens].map((e) => item(e, new Set())).filter(Boolean);
    const voorwaarden = !items.length ? null : items.length === 1 ? items[0] : { soort: "en", items };

    const plichten = [];
    for (const c of uit(regelEl.sleutel, "waarbij")) {
      const bekend = geefPlichten().find((p) => p.nlgov.split(":").pop() === c.el.data.plicht) || vindPlicht(c.el.naam || "");
      if (bekend) plichten.push({ zin: bekend.zin, nlgov: bekend.nlgov });
      else meld("warning", "ODRL-PLICHT", `Regel "${regelEl.naam}": de plicht "${c.el.naam || c.el.data.plicht}" kent Toegangsspraak niet; ze is weggelaten.`, c.el.sleutel);
    }
    regels.push({ naam: regelEl.naam, wie: w.wie, verbod, wat: gegevens, actie, voorwaarden, plichten });
  }

  const lijst = [...begrippen.values()];
  const beleid = {
    naam: beleidEl.naam,
    geldigVanaf: datum(beleidEl.data.geldigVanaf),
    geldigTot: datum(beleidEl.data.geldigTot),
    grondslag: uit(beleidEl.sleutel, "grondslag")[0]?.el.naam || null,
    doel: doelEl?.naam || null,
    // Eerst wie, dan wat — de gebruikelijke volgorde onder "Begrippen.".
    begrippen: [...lijst.filter((b) => b.soort === "wie"), ...lijst.filter((b) => b.soort === "wat")],
    regels,
  };
  return { beleid, diagnostics };
}
