// @ts-check
/**
 * neutraalFormulier — **schrijver**: plan → neutrale formulierbeschrijving
 * (artefactsoort `formulier-neutraal`, formaat `omnium-formulier-json`,
 * contract 0.1; werkplaats-plan §4A/§5.8, Mark 09-11).
 *
 *   e-dienst + model ─ formulierGraaf ─▶ graaf ─ formulierRegels ─▶ plan ─┬─ openformsSchrijver ─▶ formio (Open Formulieren)
 *                                                                         └─ neutraalFormulier  ─▶ formulier-neutraal
 *
 * Eén beschrijving van stappen en vragen waaruit de voorbeeldweergave van de
 * werkplaats rendert, en later WordPress/OWC en Nextcloud Forms; niet
 * vastgepind op Open Formulieren. Wordt niet uitgerold (doelcomponent null).
 * Bij elk formulier van de e-dienst één, met dezelfde identifier; de e-dienst
 * hoeft hem niet te noemen.
 *
 * Contract: docs/TRANSFORMATIES.md §11.18. Optionele eigenschappen ontbreken,
 * nooit null; de volgorde van stappen en vragen is die van de inwoner. Een vorm
 * die het neutrale vocabulaire (nog) niet kent wordt {type: "anders", formio}.
 */
import { jcsHash } from "./jcs.js";
import { zetBronElementIds } from "./bronArtefacten.js";

export const SOORT_NEUTRAAL = "formulier-neutraal";
export const FORMAAT_NEUTRAAL = "omnium-formulier-json";
export const CONTRACT_NEUTRAAL = "0.1";
const SCHRIJVER_ID = "omnium-formulier-neutraal@0.1.0";

/** Form.io-type uit de regelset → neutraal type (+ keuzeWeergave, een ontwerpkeuze die elke renderer volgt). */
const TYPEN = {
  textfield: { type: "tekst" },
  textarea: { type: "tekstvak" },
  email: { type: "email" },
  phoneNumber: { type: "telefoon" },
  number: { type: "getal" },
  date: { type: "datum" },
  datetime: { type: "datumtijd" },
  checkbox: { type: "vinkje" },
  radio: { type: "keuze", keuzeWeergave: "rondjes" },
  select: { type: "keuze", keuzeWeergave: "lijst" },
  file: { type: "bestand" },
};

const leeg = (w) =>
  w === undefined || w === null || w === "" || (Array.isArray(w) && !w.length) || (typeof w === "object" && !Array.isArray(w) && !Object.keys(w).length);
const zonderLeeg = (o) => Object.fromEntries(Object.entries(o).filter(([, w]) => !leeg(w)));

/** Eén vraag uit een plan-component. */
function vraag(el) {
  const d = el.data || {};
  const soort = TYPEN[d.type] || { type: "anders", formio: d.type || "" };
  const tekstig = ["tekst", "tekstvak", "email", "telefoon"].includes(soort.type);
  const c = d.conditional && typeof d.conditional === "object" && d.conditional.when ? d.conditional : null;
  const b = d.bestand && typeof d.bestand === "object" ? d.bestand : null;
  return zonderLeeg({
    key: d.key || el.naam,
    label: d.label,
    hulptekst: d.hulptekst,
    ...soort,
    verplicht: d.verplicht === true,
    keuzes: soort.type === "keuze" ? (Array.isArray(d.waarden) ? d.waarden : []).map((w) => ({ waarde: w.value, label: w.label })) : undefined,
    // Voorwaarde: tonen als …; `toon: false` = verbergen als … (weggelaten als true).
    // gelijkAan houdt het type van de e-dienst: een vinkje vergelijkt met true, niet "true".
    voorwaarde: c ? { vraag: c.when, gelijkAan: c.eq, ...(c.show === false ? { toon: false } : {}) } : undefined,
    tekst: tekstig ? zonderLeeg({ maxLengte: typeof d.maxLength === "number" ? d.maxLength : undefined, patroon: d.pattern }) : undefined,
    getal: soort.type === "getal" && typeof d.decimalLimit === "number" ? { decimalen: d.decimalLimit } : undefined,
    bestand:
      soort.type === "bestand"
        ? zonderLeeg({
            typen: Array.isArray(b?.typen) ? b.typen : undefined,
            verkleinTot: b?.verkleinTot ? { breedte: b.verkleinTot.breedte, hoogte: b.verkleinTot.hoogte } : undefined,
            titel: b?.registratie?.titel || d.label,
          })
        : undefined,
    // Het naampad in het model; elementId volgt uit de traceregels (maakNeutraalFormulierArtefact).
    bron: el.sleutel ? { pad: el.sleutel } : undefined,
  });
}

/**
 * Plan → payload. Puur.
 * @param {{elementen: any[]}} plan
 * @param {any} [keuzes] - het formulier in de e-dienst (identifier, naam, inleiding, verzendtekst)
 * @returns {{payload: any, paden: Map<string, string>, diagnostics: any[]}}
 */
export function planNaarNeutraal(plan, keuzes = {}) {
  const diagnostics = [];
  const paden = new Map();
  const formulier = plan.elementen.find((el) => el.type === "formulier");
  if (!formulier) {
    diagnostics.push({ severity: "error", code: "NFS-GEEN-FORMULIER", message: "Het plan heeft geen formulier", sourceId: null, path: null });
    return { payload: null, paden, diagnostics };
  }
  paden.set(formulier.sleutel, "/formulier");
  const inloggen = Array.isArray(formulier.data?.inloggen) ? formulier.data.inloggen : [];
  const keys = new Set();
  const stappen = plan.elementen
    .filter((el) => el.type === "stap" && el.groep === formulier.sleutel)
    .map((stap, i) => {
      paden.set(stap.sleutel, `/stappen/${i}`);
      const vragen = [];
      for (const el of plan.elementen.filter((e) => e.type === "component" && e.groep === stap.sleutel)) {
        const v = vraag(el);
        if (keys.has(v.key)) {
          diagnostics.push({ severity: "error", code: "NFS-DUBBEL", message: `Vraag "${v.key}" komt twee keer voor in het formulier`, sourceId: el.sleutel, path: null });
          continue;
        }
        keys.add(v.key);
        if (v.type === "anders") diagnostics.push({ severity: "warning", code: "NFS-VORM", message: `Vorm "${v.formio}" heeft geen neutraal type (wordt "anders")`, sourceId: el.sleutel, path: null });
        paden.set(el.sleutel, `/stappen/${i}/vragen/${vragen.length}`);
        vragen.push(v);
      }
      return { key: stap.data?.slug || stap.naam, titel: stap.naam, vragen };
    });
  const payload = {
    versie: CONTRACT_NEUTRAAL,
    formulier: zonderLeeg({
      key: formulier.data?.slug || keuzes.identifier,
      naam: keuzes.naam || formulier.naam,
      inloggen,
      inleiding: keuzes.inleiding,
      verzendtekst: keuzes.verzendtekst,
    }),
    stappen,
  };
  return { payload, paden, diagnostics };
}

/**
 * Het artefact formulier-neutraal bij een gemaakt formulier: dezelfde
 * identifier, traceregels uit hetzelfde plan (doelPad = pointer in deze
 * payload), `bron.elementId` per vraag = `bronElementId` van zijn traceregel.
 * @param {Object} invoer
 * @param {any} invoer.keuzes           - het formulier in de e-dienst
 * @param {any} invoer.edienst
 * @param {any} invoer.plan             - het plan van maakFormulierArtefact
 * @param {any} invoer.formulier        - het formulier-artefact (versienummer en herkomst)
 * @param {Map<string, string>} [invoer.uuids]
 * @param {Map<string, string>} [invoer.studioIds]
 * @param {(tekst: string) => string | Promise<string>} invoer.sha256Hex
 */
export async function maakNeutraalFormulierArtefact({ keuzes, edienst, plan, formulier, uuids = new Map(), studioIds = new Map(), sha256Hex }) {
  const { payload, paden, diagnostics } = planNaarNeutraal(plan, keuzes);
  if (!payload) throw Object.assign(new Error("Geen neutrale formulierbeschrijving geschreven."), { diagnostics });
  const traceregels = plan.trace
    .filter((spoor) => spoor.doel && paden.has(spoor.doel))
    .map((spoor) => ({ bronGE: spoor.bronId, regel: spoor.regel, doelPad: paden.get(spoor.doel), actie: "aangemaakt" }));
  const artefact = {
    artefactIdentificatie: {
      soort: SOORT_NEUTRAAL,
      identifier: keuzes.identifier,
      naam: `${keuzes.naam || keuzes.identifier} (neutraal)`,
      versienummer: formulier.artefactIdentificatie.versienummer,
      // Geen doelcomponent: het bereik is dat van het contract dat een lezer moet kennen.
      doelVersieRange: `^${CONTRACT_NEUTRAAL}`,
    },
    artefactInhoud: { formaat: FORMAAT_NEUTRAAL, payload, payloadHash: "" },
    artefactHerkomst: { ...formulier.artefactHerkomst, schrijverId: SCHRIJVER_ID },
    traceregels,
    edienstversie: { edienst: edienst?.edienst?.naam, versienummer: edienst?.edienst?.versienummer },
    doelcomponent: null,
    afhankelijkheden: [],
  };
  zetBronElementIds(artefact, { uuids, studioIds });
  // Payload en traceregels zeggen hetzelfde: elementId uit de traceregel van de vraag.
  const perPad = new Map(artefact.traceregels.filter((t) => t.bronElementId).map((t) => [t.doelPad, t.bronElementId]));
  payload.stappen.forEach((s, i) =>
    s.vragen.forEach((v, j) => {
      const id = perPad.get(`/stappen/${i}/vragen/${j}`);
      if (id && v.bron) v.bron.elementId = id;
    }),
  );
  artefact.artefactInhoud.payloadHash = await jcsHash(payload, sha256Hex);
  return { artefact, diagnostics };
}
