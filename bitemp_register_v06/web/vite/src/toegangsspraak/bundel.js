/**
 * bundel.js — Beleid-AST (geresolved) → uitvoerbare beleidsbundel voor de PDP in de Go-API.
 *
 * Plan: docs/plans/"2026-10-12 Toegang op beleid — PAP, PDP en PEP (plan).md" §5 (B4).
 * De Studio is de PAP: zij parseert en resolveert het beleid (parser.js + metamodel.js) en
 * publiceert deze bundel. De Go-PDP (package toegang) evalueert alleen data; er komt geen
 * tweede parser in Go. ODRL (odrl.js, odrlExport.js) blijft het uitwisselformaat.
 *
 * Vorm (formaat "omnium-toegangsbundel/1"):
 *   {
 *     formaat, beleid: { naam, geldigVanaf, geldigTot, grondslag, doel },
 *     standaard: "weigeren",            // deny-by-default
 *     conflict: "verbod-wint",          // ODRL conflict: prohibit
 *     regels: [{
 *       id, naam, effect: "toestaan"|"verbieden", handeling: "bekijken"|…,
 *       subject: null | { kenmerken: [{ kenmerk, waarde }] },   // null = iedereen (ook anoniem)
 *       gegevens: [{ pad }],            // registerpad; dekt het pad zelf en alles eronder
 *       voorwaarden: null | Voorwaarde, // zie hieronder
 *       plichten: ["nlgov:log", …]
 *     }]
 *   }
 *   Voorwaarde = { en: [Voorwaarde] } | { of: [Voorwaarde] } | { xof: [Voorwaarde] }
 *              | { links: Term, op, rechts?: Term, rechts2?: Term, lijst?: [Term] }
 *              | { bestaat: { omschrijving, ontkenning, voor?: Term } }
 *   Term       = { waarde, type }                       // literal: tekst|getal|datum
 *              | { pad }                                // veldwaarde via registerpad
 *              | { anker: "aanvrager"|"aanvraag"|"betrokkene"|"gegevens", pad }   // pad relatief
 *
 * Een wat-begrip met "waarvan" wordt een extra voorwaarde (EN) op de regel. Een niet
 * gedefinieerd wie-begrip is, net als in odrl.js, een impliciete rol met dezelfde naam.
 */
import { verwijzingNaarPad, verwijzingNaarGroepPad } from "./parser.js";
import { vindOperator } from "./operatoren.js";
import { resolveerVerwijzing } from "./metamodel.js";
import { camelNaarWoorden, slug, woordenNaarVeldnaam } from "./woorden.js";

export const BUNDEL_FORMAAT = "omnium-toegangsbundel/1";

/** Keten (buiten-naar-binnen) → relatief subpad "woonlocatie.wijk". */
function ketenNaarSubpad(keten) {
  return keten.slice().reverse().map((groep) => woordenNaarVeldnaam(groep.woorden)).join(".");
}

/**
 * ctx = { index?, entiteit? }: met een veldindex en de entiteit van de regel wordt een
 * verwijzing naar de betrokkene/het gegeven ("de wijk van de woonlocatie van de betrokkene")
 * opgelost tot het volledige registerpad binnen die entiteit, met keten-verkorting zoals
 * metamodel.js. Zonder index blijft het pad relatief.
 */
function term(t, ctx = {}) {
  if (!t) return undefined;
  if (t.soort === "literal") return { waarde: t.waarde, type: t.type };
  if (t.soort !== "verwijzing") return undefined;
  if (t.basis.soort === "type") return { pad: t.pad || verwijzingNaarPad(t) };
  const anker = t.basis.anker;
  if ((anker === "betrokkene" || anker === "gegevens") && ctx.index && ctx.entiteit && t.keten.length) {
    const res = resolveerVerwijzing({ basis: { soort: "type", woorden: camelNaarWoorden(ctx.entiteit) }, keten: t.keten }, ctx.index);
    if (res.pad) return { anker, pad: res.pad };
  }
  return { anker, pad: ketenNaarSubpad(t.keten) };
}

function voorwaarde(v, ctx = {}) {
  if (!v) return null;
  if (v.soort === "en" || v.soort === "of" || v.soort === "xof") {
    return { [v.soort]: v.items.map((item) => voorwaarde(item, ctx)) };
  }
  if (v.operator === "bestaat") {
    const e = v.existentie;
    const uit = { bestaat: { omschrijving: woordenNaarVeldnaam(e.woorden), ontkenning: !!e.ontkenning } };
    if (e.voor) uit.bestaat.voor = term(e.voor, ctx);
    return uit;
  }
  const uit = { links: term(v.links, ctx), op: v.operator };
  const op = vindOperator(v.operator);
  if (op?.unair) return uit;
  if (op?.lijst) uit.lijst = (v.lijst || []).map((t) => term(t, ctx));
  else if (op?.tussen) { uit.rechts = term(v.rechts, ctx); uit.rechts2 = term(v.rechts2, ctx); }
  else uit.rechts = term(v.rechts, ctx);
  return uit;
}

function en(a, b) {
  if (!a) return b;
  if (!b) return a;
  return { en: [a, b] };
}

/**
 * @param beleid  een (bij voorkeur met resolveerBeleid geresolved) beleid uit parseBeleid
 * @param opties  { index? } — veldindex (maakVeldIndex) om betrokkene-paden volledig op te lossen
 * @returns {{ bundel: object, meldingen: string[] }}
 */
export function compileerBundel(beleid, { index = null } = {}) {
  const meldingen = [];
  const wieBegrippen = new Map();
  const watBegrippen = new Map();
  for (const b of beleid.begrippen || []) {
    (b.soort === "wie" ? wieBegrippen : watBegrippen).set(b.naam.toLowerCase(), b);
  }

  const subjectVan = (wie, regelNaam) => {
    if (wie.soort === "iedereen") return null;
    if (wie.soort === "iemand") return { kenmerken: wie.kenmerken.map(({ kenmerk, waarde }) => ({ kenmerk, waarde })) };
    const begrip = wieBegrippen.get(wie.naam.toLowerCase());
    if (begrip) return { kenmerken: begrip.kenmerken.map(({ kenmerk, waarde }) => ({ kenmerk, waarde })) };
    meldingen.push(`Regel "${regelNaam}": "${wie.naam}" is geen begrip; opgevat als rol "${wie.naam}".`);
    return { kenmerken: [{ kenmerk: "rol", waarde: wie.naam }] };
  };

  /** wat → { paden, extraVoorwaarde } */
  const gegevensVan = (wat, regelNaam, diepte = 0) => {
    if (wat.soort === "begrip") {
      const begrip = watBegrippen.get(wat.naam.toLowerCase());
      if (!begrip || diepte > 8) {
        meldingen.push(`Regel "${regelNaam}": gegevensbegrip "${wat.naam}" is niet gedefinieerd; de regel dekt niets.`);
        return { paden: [], extra: null };
      }
      const binnen = gegevensVan(begrip.wat, regelNaam, diepte + 1);
      const ent = binnen.paden[0]?.pad?.split(".")[0];
      return { paden: binnen.paden, extra: en(binnen.extra, voorwaarde(begrip.waarvan, { index, entiteit: ent !== "*" ? ent : null })) };
    }
    if (wat.soort === "alle") {
      const v = wat.verwijzing;
      if (v.basis.soort !== "type") {
        // "alle gegevens van de betrokkene": het record dat gelezen wordt — elk pad.
        return { paden: [{ pad: "*" }], extra: null };
      }
      return { paden: [{ pad: v.pad || verwijzingNaarGroepPad(v) }], extra: null };
    }
    if (wat.soort === "verwijzing") return { paden: [{ pad: wat.pad || verwijzingNaarPad(wat) }], extra: null };
    meldingen.push(`Regel "${regelNaam}": onbekende gegevensvorm "${wat.soort}".`);
    return { paden: [], extra: null };
  };

  const gebruikteIds = new Set();
  const regels = (beleid.regels || []).map((regel) => {
    let id = slug(regel.naam) || "regel";
    for (let n = 2; gebruikteIds.has(id); n += 1) id = `${slug(regel.naam)}-${n}`;
    gebruikteIds.add(id);
    const g = gegevensVan(regel.wat, regel.naam);
    // De entiteit waarover de regel gaat (voor betrokkene-paden); alleen als die eenduidig is.
    const entiteiten = [...new Set(g.paden.map((p) => p.pad.split(".")[0]).filter((e) => e !== "*"))];
    const ctx = { index, entiteit: entiteiten.length === 1 ? entiteiten[0] : null };
    return {
      id,
      naam: regel.naam,
      effect: regel.verbod ? "verbieden" : "toestaan",
      handeling: regel.actie,
      subject: subjectVan(regel.wie, regel.naam),
      gegevens: g.paden,
      voorwaarden: en(voorwaarde(regel.voorwaarden, ctx), g.extra),
      plichten: (regel.plichten || []).map((p) => p.nlgov || p.zin),
    };
  });

  return {
    bundel: {
      formaat: BUNDEL_FORMAAT,
      beleid: {
        naam: beleid.naam,
        geldigVanaf: beleid.geldigVanaf || null,
        geldigTot: beleid.geldigTot || null,
        grondslag: beleid.grondslag || null,
        doel: beleid.doel || null,
      },
      standaard: "weigeren",
      conflict: "verbod-wint",
      regels,
    },
    meldingen,
  };
}
