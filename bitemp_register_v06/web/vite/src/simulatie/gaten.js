// @ts-check
/**
 * gaten — het gat als enig mechanisme voor invoer (ontwerp §2.1).
 *
 * Een gat is een punt waar de simulatie een waarde nodig heeft die zij niet
 * zelf kan afleiden. Soorten (`aard` van het gat):
 *   taak       een user task: wat de behandelaar invult
 *   partner    een bericht of taak naar een pool zonder proces (ketenpartner, inwoner)
 *   dienst     een servicetaak die iets buiten het cm doet (ZGW-actie): de stub
 *   expressie  een conditie, expressie of beslistabel die niet te lezen is
 *
 * Een gat heeft een `verwacht`: de velden met hun type. Bij een user task met
 * een formulier zijn dat de invulbare velden van dat formulier in het
 * e-dienstmodel (ontwerp §8 vraag 9).
 *
 * Vulwijzen: `hand`, `willekeurig` (naar type, met een zaadje) en `fixture`
 * (een antwoord uit het scenario). De wijze is per run in te stellen, met een
 * uitzondering per soort en per gat.
 *
 * Puur.
 */

/**
 * @typedef {{naam: string, type?: string, label?: string, verplicht?: boolean, keuzes?: any[]}} Veld
 */

/**
 * De invulbare velden van een taakformulier (dossierformulier in het e-dienstmodel).
 * @param {any} edienst
 * @param {string} identifier
 * @returns {{velden: Veld[], gevonden: boolean}}
 */
export function verwachtVoorFormulier(edienst, identifier) {
  const formulier = (edienst?.artefacten || []).find((a) => a.identifier === identifier && a.soort === "dossierformulier");
  if (!formulier) return { velden: [], gevonden: false };
  const schema = (edienst.artefacten || []).find((a) => a.soort === "dossierschema" && a.identifier === formulier.dossierschema);
  const velden = [];
  for (const paneel of formulier.panelen || []) {
    if (paneel.alleenLezen !== false) continue;
    for (const v of paneel.velden || []) {
      const key = typeof v === "string" ? v : v.key;
      if (!key) continue;
      const s = schema?.behandelvelden?.[key] || {};
      const keuzes = typeof v === "object" && v.opties ? Object.keys(v.opties) : s.enum;
      velden.push({
        naam: key,
        type: s.type || "string",
        ...(typeof v === "object" && v.label ? { label: v.label } : {}),
        ...(typeof v === "object" && v.verplicht ? { verplicht: true } : {}),
        ...(keuzes ? { keuzes } : {}),
      });
    }
  }
  return { velden, gevonden: true };
}

/** Een getal in [0, 1) uit een tekst: hetzelfde zaadje geeft dezelfde waarde. */
function toeval(zaad) {
  let h = 1779033703 ^ zaad.length;
  for (let i = 0; i < zaad.length; i++) {
    h = Math.imul(h ^ zaad.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * Een willekeurige waarde die bij de verwachte velden past. Herhaalbaar: het
 * zaadje van de run plus de plek en het bezoek van het gat bepalen de waarde.
 * @param {Veld[]} velden
 * @param {string} zaad
 */
export function willekeurig(velden, zaad) {
  const uit = {};
  for (const v of velden) {
    const r = toeval(`${zaad}/${v.naam}`);
    if (v.keuzes?.length) uit[v.naam] = v.keuzes[Math.floor(r * v.keuzes.length)];
    else if (v.type === "boolean") uit[v.naam] = r < 0.5;
    else if (v.type === "number" || v.type === "integer") uit[v.naam] = Math.floor(r * 100);
    else if (v.type === "url") uit[v.naam] = `https://stub.example/${Math.floor(r * 0xffffff).toString(16).padStart(6, "0")}`;
    else uit[v.naam] = `willekeurig-${Math.floor(r * 10000)}`;
  }
  return uit;
}

/**
 * De vulwijze van een gat: per gat (op plek), anders per soort, anders die van de run.
 * @param {any} vulwijze - {standaard, perSoort?, perGat?}
 * @param {{aard: string, sleutels: string[]}} gat
 * @returns {"hand"|"willekeurig"|"fixture"}
 */
export function kiesWijze(vulwijze, gat) {
  for (const s of gat.sleutels) if (vulwijze?.perGat?.[s]) return vulwijze.perGat[s];
  return vulwijze?.perSoort?.[gat.aard] || vulwijze?.standaard || "hand";
}

/**
 * Het antwoord uit het scenario voor dit gat: op de plek van het gat (bpmnId,
 * element-id of naam) en het volgnummer van het bezoek. Geen antwoord = undefined.
 */
export function antwoordUitFixture(antwoorden, gat) {
  for (const s of gat.sleutels) {
    const a = antwoorden?.[s];
    if (a === undefined) continue;
    const lijst = Array.isArray(a) ? a : [a];
    return lijst[gat.bezoek - 1];
  }
  return undefined;
}

/** Past de waarde bij wat het gat verwacht? Geeft de bezwaren. */
export function toets(velden, waarde) {
  const bezwaren = [];
  for (const v of velden) {
    const w = waarde?.[v.naam];
    const leeg = w === undefined || w === null || w === "";
    if (v.verplicht && leeg) bezwaren.push(`"${v.naam}" is verplicht`);
    if (!leeg && v.keuzes?.length && !v.keuzes.includes(w)) bezwaren.push(`"${v.naam}" moet een van ${v.keuzes.join(", ")} zijn`);
  }
  return bezwaren;
}
