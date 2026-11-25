// @ts-check
/**
 * naarToegangsspraak — Cedar-model → Toegangsspraak (fase 2 van "2026-11-25 Cedar als M2";
 * TRANSFORMATIES.md §8.3).
 *
 *   lezer       cedarGraaf.js          de policies (EST) als brongraaf
 *   regelset    toegangsspraakRegels.js  CEDAR_NAAR_TOEGANGSSPRAAK
 *   toepasser   transformatie/regels.js
 *   bouwer      hier                   plan → beleid (de AST van de parser) → renderBeleid
 *
 * Een Toegangsspraak-regel heeft één handeling en één soort gegevens: een policy met meer acties
 * (of, bij `resource` zonder type, meer resourcetypen) wordt meer regels. De regel heet naar de
 * policy, met het woord van de handeling erachter als het er meer zijn ("<policy> <woord>"); de
 * terugweg groepeert op die naam (vanToegangsspraak.js).
 *
 * Nooit ongemerkt ruimer: een permit met iets wat de taal niet kan zeggen valt weg (het beleid wordt
 * strenger), een forbid verliest alleen dat stuk (het verbod geldt vaker, ook strenger). Beide met
 * een melding. Een policy die nooit geldt (`when { false }`) valt weg zonder dat de betekenis
 * verandert.
 */
import { pasRegelsToe } from "../../transformatie/regels.js";
import { renderBeleid } from "../../toegangsspraak/renderer.js";
import { parseBeleid, padNaarVerwijzing, verwijzingNaarGroepPad } from "../../toegangsspraak/parser.js";
import { registreerActies } from "../../toegangsspraak/operatoren.js";
import { camelNaarWoorden, lidwoordVoor } from "../../toegangsspraak/woorden.js";
import { leidAf } from "./index.js";
import { cedarNaarGraaf, lokaalWoorden } from "./cedarGraaf.js";
import { cedarWoordenschat, standaardWoord } from "./woordenschat.js";
import { CEDAR_NAAR_TOEGANGSSPRAAK, ANKER_VOOR_VAR } from "./toegangsspraakRegels.js";

/** @typedef {{niveau: "fout"|"waarschuwing"|"info", bericht: string, elementId?: string}} Melding */

/**
 * De handelingen van het model als woorden van Toegangsspraak. Het register van de taal is
 * gedeeld en alleen uitbreidbaar (registreerActies is idempotent op het woord).
 * @param {ReturnType<typeof cedarWoordenschat>} woordenschat
 */
export function registreerHandelingen(woordenschat) {
  registreerActies(woordenschat.acties.map((a) => ({ woord: a.woord, nlgov: `cedar:${a.naam}` })));
}

/** Een verwijzing naar een kenmerk: anker + attribuutpad, met de woorden van het eerste deel. */
export function verwijzing(anker, attr, woorden) {
  const groepen = String(attr).split(".").map((s, i) => (i === 0 && woorden?.length ? woorden : camelNaarWoorden(s)));
  return {
    soort: "verwijzing",
    keten: groepen.slice().reverse().map((w) => ({ lidwoord: lidwoordVoor(w[w.length - 1]), woorden: w })),
    basis: { soort: "anker", lidwoord: "de", anker },
  };
}

const literal = (w) =>
  typeof w === "number" ? { soort: "literal", type: "getal", waarde: w } : { soort: "literal", type: "tekst", waarde: typeof w === "boolean" ? String(w) : String(w?.letterlijk ?? "") };
const kanTekst = (w) => !(w && typeof w === "object" && "letterlijk" in w && String(w.letterlijk).includes('"'));

/**
 * @param {{elements?: Record<string, any>}} staat   het Cedar-model
 * @param {{naam?: string}} [opties]                  de naam van het beleid
 * @returns {{tekst: string, beleid: any, meldingen: Melding[], trace: any[], vertaald: string[], regelsPerPolicy: Record<string, string[]>}}
 */
export function cedarNaarToegangsspraak(staat, { naam = "Cedar" } = {}) {
  /** @type {Melding[]} */
  const meldingen = [];
  const elements = leidAf(staat?.elements) || staat?.elements || {};
  const ws = cedarWoordenschat(elements);
  meldingen.push(...ws.meldingen);
  const policyEls = Object.values(elements).filter((el) => el.elementType === "policy");
  const goed = policyEls.filter((el) => {
    if (el.data?.cedar && !el.data?.fout) return true;
    meldingen.push({ niveau: "fout", elementId: el.id, bericht: `${el.naam}: leesfout, niet vertaald (${el.data?.fout || "geen EST"}).` });
    return false;
  });
  const elementId = new Map(goed.map((el) => [el.naam, el.id]));

  const graaf = cedarNaarGraaf(goed, ws, { naam });
  const plan = pasRegelsToe(graaf, CEDAR_NAAR_TOEGANGSSPRAAK);
  for (const d of plan.diagnostics.filter((x) => x.severity !== "info")) meldingen.push({ niveau: "waarschuwing", bericht: d.message });
  const el = new Map(plan.elementen.map((e) => [e.sleutel, e]));
  const uit = (bron, type) => plan.connectoren.filter((c) => c.bron === bron && c.type === type).map((c) => el.get(c.doel)).filter(Boolean);
  /** Wat de graaf verbindt maar het plan niet heeft (geen regel): telt als onvertaalbaar, nooit stil weg. */
  const ontbreekt = (bron, aard) => graaf.verbindingen.filter((v) => v.bron === bron && v.aard === aard && !el.has(v.doel)).map((v) => graaf.knopen.find((k) => k.id === v.doel)?.tekst || v.doel);

  /** @type {any[]} */
  const regels = [];
  /** @type {Record<string, string[]>} */
  const regelsPerPolicy = {};
  const nieuweWoorden = [];

  for (const pe of uit("beleid", "policy")) {
    const pnaam = pe.naam;
    const eid = elementId.get(pnaam);
    if (pe.type === "vervalt") {
      meldingen.push({ niveau: "info", elementId: eid, bericht: `${pnaam}: ${pe.data.reden}; niet in de Toegangsspraak.` });
      continue;
    }
    const verbod = pe.data.modaliteit === "mag-niet";
    /** Wat niet te zeggen is: bij een permit valt de policy weg, bij een forbid alleen dat stuk. */
    const problemen = [];
    const zwakker = [];
    const onvertaalbaar = (e) => (verbod ? zwakker : problemen).push(`${e.data.reden}${e.data.tekst && !e.data.reden.includes(e.data.tekst) ? ` (${e.data.tekst})` : ""}`);

    // ── wie ───────────────────────────────────────────────────────────────
    const kenmerken = [];
    let principalType = "";
    const pr = uit(pe.sleutel, "principal")[0];
    if (pr?.type === "onvertaalbaar") onvertaalbaar(pr);
    else if (pr?.type === "kenmerk") kenmerken.push({ kenmerk: pr.data.kenmerk, waarde: pr.data.waarde });
    else if (pr?.type === "wie" && pr.data.soort === "type") principalType = pr.data.type;

    // ── handelingen ───────────────────────────────────────────────────────
    const woorden = [];
    const acties = [];
    for (const h of uit(pe.sleutel, "actie")) {
      if (h.data.alle) {
        acties.push(...ws.acties);
        if (!ws.acties.length) problemen.push("action zonder beperking, en het model kent geen acties");
        else meldingen.push({ niveau: "info", elementId: eid, bericht: `${pnaam}: geldt voor elke actie; uitgeschreven voor de ${ws.acties.length} acties van het model.` });
      } else if (h.data.groep) {
        const leden = ws.acties.filter((a) => a.groepen.includes(h.data.groep.id));
        if (leden.length) acties.push(...leden);
        else (verbod ? zwakker : problemen).push(`actiegroep ${h.data.groep.id} zonder bekende leden`);
      } else if (h.data.bekend) acties.push(ws.actieVoorUid(h.data.uid));
      else {
        const woord = standaardWoord(h.data.uid.id);
        woorden.push(woord);
        nieuweWoorden.push({ woord, nlgov: `cedar:${h.data.uid.id}` });
        meldingen.push({ niveau: "waarschuwing", elementId: eid, bericht: `${pnaam}: actie ${h.data.uid.type}::"${h.data.uid.id}" staat niet in de actielijst; als "${woord}" geschreven.` });
      }
    }
    for (const a of acties) if (a && !woorden.includes(a.woord)) woorden.push(a.woord);

    // ── wat ───────────────────────────────────────────────────────────────
    /** @type {{wat: any, label: string}[]} */
    const wats = [];
    const voorwaarden = [];
    const alleVan = (woordenType) => ({ soort: "alle", verwijzing: { keten: [], basis: { soort: "type", lidwoord: "een", woorden: woordenType } } });
    const rs = uit(pe.sleutel, "resource")[0];
    const alleTypen = () => {
      const typen = ws.resourceTypen(acties.filter(Boolean));
      return typen.length ? typen : ws.typen.map((t) => t.naam);
    };
    if (rs?.type === "onvertaalbaar") {
      onvertaalbaar(rs);
      if (verbod) for (const t of alleTypen()) wats.push({ wat: alleVan(lokaalWoorden(t)), label: lokaalWoorden(t).join(" ") });
    } else if (rs?.data.soort === "pad") {
      const v = padNaarVerwijzing(rs.data.pad);
      wats.push({ wat: { soort: "alle", verwijzing: verwijzingNaarGroepPad(v) === rs.data.pad ? v : { ...v, pad: rs.data.pad } }, label: rs.data.pad });
    } else if (rs?.data.soort === "alle-typen") {
      const typen = alleTypen();
      if (!typen.length) problemen.push("resource zonder type, en het model kent geen entiteittypen");
      else if (typen.length > 1 || !verbod) meldingen.push({ niveau: "info", elementId: eid, bericht: `${pnaam}: geldt voor elke resource; uitgeschreven voor ${typen.join(", ")}.` });
      for (const t of typen) wats.push({ wat: alleVan(lokaalWoorden(t)), label: lokaalWoorden(t).join(" ") });
    } else if (rs) {
      wats.push({ wat: alleVan(rs.data.woorden), label: rs.data.woorden.join(" ") });
      if (rs.data.soort === "entiteit") voorwaarden.push({ soort: "voorwaarde", links: verwijzing("gegevens", "id", ["id"]), operator: "eq", rechts: literal({ letterlijk: rs.data.id }), rechts2: null, lijst: null });
    }

    // ── condities ─────────────────────────────────────────────────────────
    /** Een voorwaarde-element → AST, of null. */
    const voorwaarde = (e) => {
      const d = e.data;
      const anker = ANKER_VOOR_VAR[d.var];
      const woordenAttr = Array.isArray(d.woorden) && d.woorden.length ? d.woorden : null;
      const links = verwijzing(anker, d.attr, woordenAttr);
      const v = { soort: "voorwaarde", links, operator: d.operator, rechts: null, rechts2: null, lijst: null };
      if (d.operator === "isBekend" || d.operator === "isOnbekend") return v;
      if (d.rechts && typeof d.rechts === "object") {
        v.rechts = verwijzing(ANKER_VOOR_VAR[d.rechts.var], d.rechts.attr, d.rechts.woorden);
        return v;
      }
      const waarden = Array.isArray(d.waarde) ? d.waarde : [d.waarde];
      if (!waarden.every(kanTekst)) return onvertaalbaar({ data: { reden: "een waarde met een aanhalingsteken", tekst: e.data.tekst || "" } }), null;
      if (waarden.some((w) => typeof w === "boolean")) meldingen.push({ niveau: "info", elementId: eid, bericht: `${pnaam}: waar/onwaar is in Toegangsspraak tekst ("true"/"false").` });
      if (d.operator === "isAnyOf") v.lijst = waarden.map(literal);
      else v.rechts = literal(waarden[0]);
      return v;
    };
    /** Een element onder `als` of in een groep → AST, of null als het niet te zeggen is. */
    const item = (e, inGroep = false) => {
      if (e.type === "kenmerk") {
        if (!inGroep) {
          kenmerken.push({ kenmerk: e.data.kenmerk, waarde: e.data.waarde });
          return undefined; // hoort bij wie
        }
        return { soort: "voorwaarde", links: verwijzing("aanvrager", e.data.attr, e.data.kenmerk.split(" ")), operator: "eq", rechts: literal({ letterlijk: e.data.waarde }), rechts2: null, lijst: null };
      }
      if (e.type === "voorwaarde") return voorwaarde(e);
      if (e.type === "voorwaardegroep") {
        const mist = ontbreekt(e.sleutel, "lid");
        if (mist.length) return onvertaalbaar({ data: { reden: "een conditie zonder vertaling", tekst: mist.join("; ") } }), null;
        const items = uit(e.sleutel, "lid").map((x) => item(x, true));
        if (items.some((x) => !x)) return null;
        return { soort: e.data.logica === "of" ? "of" : "en", items };
      }
      onvertaalbaar(e);
      return null;
    };
    for (const e of uit(pe.sleutel, "als")) {
      const v = item(e);
      if (v) voorwaarden.push(v);
    }
    for (const tekst of [...ontbreekt(pe.sleutel, "als"), ...ontbreekt(pe.sleutel, "actie"), ...ontbreekt(pe.sleutel, "principal"), ...ontbreekt(pe.sleutel, "resource")]) {
      onvertaalbaar({ data: { reden: "een onderdeel zonder vertaling", tekst } });
    }

    if (problemen.length) {
      meldingen.push({ niveau: "waarschuwing", elementId: eid, bericht: `${pnaam}: niet vertaald, het beleid wordt strenger: ${problemen.join("; ")}.` });
      continue;
    }
    if (zwakker.length) meldingen.push({ niveau: "waarschuwing", elementId: eid, bericht: `${pnaam}: het verbod geldt in de Toegangsspraak vaker, zonder: ${zwakker.join("; ")}.` });

    // Het type van de principal staat alleen in de zin als het model er meer kent.
    if (principalType && ws.principalTypen(acties.filter(Boolean)).some((t) => t !== principalType)) kenmerken.unshift({ kenmerk: "type", waarde: principalType });
    const wie = kenmerken.length ? { soort: "iemand", kenmerken } : { soort: "iedereen" };
    const blok = !voorwaarden.length ? null : voorwaarden.length === 1 && voorwaarden[0].soort === "voorwaarde" ? voorwaarden[0] : voorwaarden.length === 1 ? voorwaarden[0] : { soort: "en", items: voorwaarden };

    regelsPerPolicy[pnaam] = [];
    for (const { wat, label } of wats) {
      for (const woord of woorden) {
        const rnaam = [pnaam, woorden.length > 1 ? woord : "", wats.length > 1 ? label : ""].filter(Boolean).join(" ");
        regelsPerPolicy[pnaam].push(rnaam);
        regels.push({ naam: rnaam, wie, verbod, wat, actie: woord, voorwaarden: blok, plichten: [] });
      }
    }
  }

  registreerHandelingen(ws);
  registreerActies(nieuweWoorden);
  const beleid = { naam, geldigVanaf: null, geldigTot: null, grondslag: null, doel: null, standaard: "weigeren", conflict: null, begrippen: [], regels };
  const tekst = renderBeleid(beleid);
  const terug = parseBeleid(tekst);
  if (!terug.ok) for (const f of terug.fouten) meldingen.push({ niveau: "fout", bericht: `De gemaakte Toegangsspraak leest niet terug: regel ${f.regel}, kolom ${f.kolom}: ${f.bericht}` });
  return { tekst, beleid, meldingen, trace: plan.trace, vertaald: Object.keys(regelsPerPolicy), regelsPerPolicy };
}
