// @ts-check
/**
 * scenarioModel — een scenario als model (M1 in het profiel `simulatie`,
 * diagramprofielen/simulatie/descriptor.js) en als het json-scenario dat de interpreter leest
 * (simulatie.js). Twee richtingen:
 *
 *   scenarioUitModel   model → json: de run leest een scenario uit het project
 *   scenarioNaarModel  json → wijziging op het model: een scenario in het project bewaren
 *
 * De interpreter verandert er niet door: hij krijgt hetzelfde json-scenario als altijd
 * (`{naam, beschrijving, start, vulwijze, antwoorden, zaadje, verwacht}`).
 *
 * Verwijzingen naar andere talen (`{profielId, elementId}`: het type van een instantie, de taak
 * van een stub, het startevent) lossen de aanroepers op met de functies in `zoek`; dit bestand
 * kent geen stores. Zonder verwijzing blijft de tekst staan (`typeLabel`, `plek`, `startProces`).
 *
 * Puur.
 */
import { GATSOORTEN } from "../diagramprofielen/simulatie/descriptor.js";

const lijst = (elements) => Object.values(elements || {});
const json = (w) => JSON.stringify(w, null, 2);

/** Json uit een tekstveld; leeg = `leeg`. Een fout noemt het element. */
function lees(tekst, leeg, waar) {
  const t = String(tekst ?? "").trim();
  if (!t) return leeg;
  try {
    return JSON.parse(t);
  } catch (e) {
    throw new Error(`${waar}: geen geldige json (${e.message})`);
  }
}

/** De doelen van de lijnen van `type` die bij `bronId` vertrekken, in de volgorde van het model. */
const doelen = (elements, bronId, type) =>
  lijst(elements)
    .filter((c) => c.elementType === type && c.source === bronId)
    .map((c) => elements[c.target])
    .filter(Boolean);

const velden = (element, vak) => (element.compartimenten || []).find((c) => (c.compartmentType || c.id) === vak)?.velden || [];

/**
 * De simulaties in het model, met hun subjecten en scenario's. Een scenario zonder simulatie
 * komt onder `los`.
 * @param {Record<string, any>} elements
 */
export function simulatiesIn(elements) {
  const els = elements || {};
  const onder = new Set();
  const simulaties = lijst(els)
    .filter((e) => e.elementType === "simulatie")
    .map((simulatie) => {
      const kinderen = doelen(els, simulatie.id, "heeft");
      const scenarios = kinderen.filter((k) => k.elementType === "scenario");
      scenarios.forEach((s) => onder.add(s.id));
      return { simulatie, subjecten: kinderen.filter((k) => k.elementType === "subject"), scenarios };
    });
  const los = lijst(els).filter((e) => e.elementType === "scenario" && !onder.has(e.id));
  return { simulaties, los };
}

/**
 * Het json-scenario van een scenario-element.
 * @param {Record<string, any>} elements - de elementen van het simulatiemodel
 * @param {string} scenarioId
 * @param {Object} [zoek]
 * @param {(ref: any) => string|null} [zoek.naamVan] - de naam van een element in een andere taal
 * @param {(ref: any) => string|null} [zoek.procesVan] - de proces-id van het proces met dit startevent
 * @param {(ref: any) => string|null} [zoek.plekVan] - de leesbare sleutel van het element van een stub
 *   (het bpmn-id), zodat het json-scenario na een rondgang dezelfde sleutels heeft; anders het element-id
 */
export function scenarioUitModel(elements, scenarioId, { naamVan = () => null, procesVan = () => null, plekVan = () => null } = {}) {
  const el = elements?.[scenarioId];
  if (!el || el.elementType !== "scenario") throw new Error(`Scenario "${scenarioId}" staat niet in het simulatiemodel`);
  const d = el.data || {};
  const waar = `Scenario "${el.naam}"`;

  // De startgegevens: de instantie aan de lijn «start met».
  const instantie = doelen(elements, el.id, "start-met").find((i) => i.elementType === "instantie");
  const variabelen = {};
  for (const v of velden(el, "variabelen")) if (v.naam) variabelen[v.naam] = lees(v.data?.typeLabel, null, `${waar}, startvariabele ${v.naam}`);
  const proces = procesVan(d.startBij) || d.startProces || null;
  const start = {
    ...(proces ? { proces } : {}),
    type: (instantie && (naamVan(instantie.data?.instantieVan) || instantie.data?.typeLabel)) || "Object",
    id: instantie?.data?.sleutel || "startobject",
    object: instantie ? lees(instantie.data?.json, {}, `Instantie "${instantie.naam}"`) : {},
    variabelen,
  };

  // De vulwijze: de standaard, per soort gat, en per gat (een stub met een eigen wijze).
  const perSoort = {};
  for (const s of GATSOORTEN) if (d[`vulwijze_${s.key}`]) perSoort[s.key] = d[`vulwijze_${s.key}`];
  const perGat = {};
  const antwoorden = {};
  const kinderen = doelen(elements, el.id, "heeft");
  for (const stub of kinderen.filter((k) => k.elementType === "stub")) {
    const sd = stub.data || {};
    const plek = plekVan(sd.bij) || sd.bij?.elementId || sd.plek;
    if (!plek) continue;
    if (sd.wijze) {
      perGat[plek] = sd.wijze;
      continue;
    }
    const viaLijn = doelen(elements, stub.id, "waarde").find((i) => i.elementType === "instantie");
    const waarde = viaLijn ? lees(viaLijn.data?.json, {}, `Instantie "${viaLijn.naam}"`) : lees(sd.json, {}, `Stub "${stub.naam}"`);
    const bezoek = Math.max(1, Number(sd.bezoek) || 1);
    (antwoorden[plek] ||= [])[bezoek - 1] = waarde;
  }
  // Eén bezoek = de waarde zelf, zoals in de bestaande scenario's; meer = een lijst per bezoek.
  for (const [plek, per] of Object.entries(antwoorden)) if (per.length === 1) antwoorden[plek] = per[0];

  const verwachting = kinderen.find((k) => k.elementType === "verwachting");
  const vd = verwachting?.data || {};
  const stopt = verwachting ? naamVan(vd.bij) || vd.plek || null : null;
  const verwacht = verwachting
    ? { ...(stopt ? { [vd.soort === "gat" ? "gat" : "einde"]: stopt } : {}), ...(vd.via ? { via: vd.via } : {}), ...(vd.reden ? { reden: vd.reden } : {}), ...lees(vd.waarden, {}, `Verwachting "${verwachting.naam}"`) }
    : null;

  return {
    versie: "0.1",
    naam: el.naam || "",
    beschrijving: d.beschrijving || "",
    start,
    vulwijze: { standaard: d.vulwijze || "hand", ...(Object.keys(perSoort).length ? { perSoort } : {}), ...(Object.keys(perGat).length ? { perGat } : {}) },
    antwoorden,
    zaadje: Number(d.toevalsgetal) || 1,
    ...(verwacht ? { verwacht } : {}),
  };
}

/**
 * De wijziging op het simulatiemodel die een json-scenario bewaart. Bestaat er in de simulatie al
 * een scenario met die naam, dan wordt het bijgewerkt: de instantie, de verwachting en de stubs
 * (op plek en bezoek) blijven dezelfde elementen, zodat hun plek op het diagram blijft; wat niet
 * meer voorkomt gaat weg.
 *
 * @param {any} scenario - het json-scenario
 * @param {Object} opts
 * @param {Record<string, any>} [opts.elements] - het simulatiemodel nu
 * @param {string|null} [opts.simulatieId] - de simulatie waar het bij hoort; anders de eerste, anders een nieuwe
 * @param {string} [opts.simulatieNaam]
 * @param {() => string} opts.nieuwId
 * @param {{naam: string, ref: any}[]} [opts.subjecten] - de processen van de run; alleen bij een nieuwe simulatie
 * @param {Object} [opts.zoek]
 * @param {(naam: string) => any} [opts.zoek.type] - het element met aard gegevens bij een typenaam → ref
 * @param {(sleutel: string) => {ref: any, naam: string}|null} [opts.zoek.plek] - het element bij een antwoordsleutel
 * @param {(procesId: string) => any} [opts.zoek.start] - het startevent van een proces → ref
 * @param {(naam: string) => any} [opts.zoek.einde] - het element bij de naam van een einde of gat → ref
 * @returns {{toevoegen: any[], bijwerken: Record<string, any>, verwijderen: string[], scenarioId: string, simulatieId: string, nieuw: {simulatie: boolean, scenario: boolean}, kinderen: string[]}}
 */
export function scenarioNaarModel(scenario, { elements = {}, simulatieId = null, simulatieNaam = "Simulatie", nieuwId, subjecten = [], zoek = {} }) {
  const sc = scenario || {};
  const toevoegen = [];
  const bijwerken = {};
  const verwijderen = [];
  const maak = (elementType, naam, data = {}, extra = {}) => {
    const e = { id: nieuwId(), naam, elementType, compartimenten: [], data, ...extra };
    toevoegen.push(e);
    return e;
  };
  const lijn = (elementType, source, target) => maak(elementType, "", {}, { source, target });
  const lijnenVan = (id) => lijst(elements).filter((c) => c.source === id || c.target === id).filter((c) => c.source && c.target);
  const weg = (id) => {
    verwijderen.push(id, ...lijnenVan(id).map((c) => c.id));
  };

  // De simulatie.
  const { simulaties } = simulatiesIn(elements);
  const bestaandeSim = (simulatieId && simulaties.find((s) => s.simulatie.id === simulatieId)) || simulaties[0] || null;
  const simId = bestaandeSim?.simulatie.id || maak("simulatie", simulatieNaam).id;
  if (!bestaandeSim) {
    for (const s of subjecten) lijn("heeft", simId, maak("subject", s.naam, { verwijstNaar: s.ref }).id);
  }

  // Het scenario.
  const start = sc.start || {};
  const startRef = start.proces && zoek.start ? zoek.start(start.proces) : null;
  const data = {
    beschrijving: sc.beschrijving || "",
    startBij: startRef || null,
    startProces: start.proces || "",
    vulwijze: sc.vulwijze?.standaard || "hand",
    toevalsgetal: String(sc.zaadje ?? 1),
  };
  for (const s of GATSOORTEN) data[`vulwijze_${s.key}`] = sc.vulwijze?.perSoort?.[s.key] || "";
  const compartimenten = [
    {
      compartmentType: "variabelen",
      velden: Object.entries(start.variabelen || {}).map(([naam, waarde]) => ({ id: nieuwId(), naam, fieldType: "variabele", data: { typeLabel: JSON.stringify(waarde) } })),
    },
  ];
  const bestaand = bestaandeSim?.scenarios.find((s) => s.naam === sc.naam) || null;
  let scenarioId;
  if (bestaand) {
    scenarioId = bestaand.id;
    bijwerken[scenarioId] = { data, compartimenten };
  } else {
    scenarioId = maak("scenario", sc.naam || "Scenario", data, { compartimenten }).id;
    lijn("heeft", simId, scenarioId);
  }
  const kinderen = [];

  // De startgegevens als instantie.
  const typeRef = start.type && zoek.type ? zoek.type(start.type) : null;
  const instantieData = { instantieVan: typeRef || null, typeLabel: start.type || "", sleutel: start.id || "", json: json(start.object || {}) };
  const oudeInstantie = bestaand ? doelen(elements, bestaand.id, "start-met").find((i) => i.elementType === "instantie") : null;
  if (oudeInstantie) {
    bijwerken[oudeInstantie.id] = { data: instantieData };
    kinderen.push(oudeInstantie.id);
  } else {
    const i = maak("instantie", start.id || "startobject", instantieData);
    lijn("start-met", scenarioId, i.id);
    kinderen.push(i.id);
  }

  // De stubs: per plek en bezoek; een gat dat je zelf vult is een stub met een wijze.
  const gewenst = [];
  for (const [plek, a] of Object.entries(sc.antwoorden || {})) {
    (Array.isArray(a) ? a : [a]).forEach((waarde, i) => {
      if (waarde !== undefined) gewenst.push({ plek, bezoek: i + 1, wijze: "", json: json(waarde) });
    });
  }
  for (const [plek, wijze] of Object.entries(sc.vulwijze?.perGat || {})) gewenst.push({ plek, bezoek: 1, wijze, json: "" });
  const oudeKinderen = bestaand ? doelen(elements, bestaand.id, "heeft") : [];
  const oudeStubs = new Map(oudeKinderen.filter((k) => k.elementType === "stub").map((s) => [`${s.data?.bij?.elementId || s.data?.plek}#${Math.max(1, Number(s.data?.bezoek) || 1)}#${s.data?.wijze ? "w" : ""}`, s]));
  for (const g of gewenst) {
    const gevonden = zoek.plek ? zoek.plek(g.plek) : null;
    const stubData = { bij: gevonden?.ref || null, plek: g.plek, bezoek: String(g.bezoek), wijze: g.wijze, json: g.json };
    const sleutels = [`${gevonden?.ref?.elementId}#${g.bezoek}#${g.wijze ? "w" : ""}`, `${g.plek}#${g.bezoek}#${g.wijze ? "w" : ""}`];
    const sleutel = sleutels.find((s) => oudeStubs.has(s));
    if (sleutel) {
      const oud = oudeStubs.get(sleutel);
      oudeStubs.delete(sleutel);
      bijwerken[oud.id] = { data: stubData };
      kinderen.push(oud.id);
    } else {
      const naam = `${gevonden?.naam || g.plek}${g.bezoek > 1 ? ` (${g.bezoek})` : ""}`;
      const s = maak("stub", naam, stubData);
      lijn("heeft", scenarioId, s.id);
      kinderen.push(s.id);
    }
  }
  for (const oud of oudeStubs.values()) weg(oud.id);

  // De verwachting.
  const oudeVerwachting = oudeKinderen.find((k) => k.elementType === "verwachting") || null;
  if (sc.verwacht && Object.keys(sc.verwacht).length) {
    const { einde, gat, via, reden, ...waarden } = sc.verwacht;
    const plek = gat || einde || "";
    const vData = { soort: gat ? "gat" : "einde", bij: (plek && zoek.einde ? zoek.einde(plek) : null) || null, plek, via: via || "", reden: reden || "", waarden: Object.keys(waarden).length ? json(waarden) : "" };
    if (oudeVerwachting) {
      bijwerken[oudeVerwachting.id] = { data: vData };
      kinderen.push(oudeVerwachting.id);
    } else {
      const v = maak("verwachting", plek || "Verwachting", vData);
      lijn("heeft", scenarioId, v.id);
      kinderen.push(v.id);
    }
  } else if (oudeVerwachting) weg(oudeVerwachting.id);

  return { toevoegen, bijwerken, verwijderen: [...new Set(verwijderen)], scenarioId, simulatieId: simId, nieuw: { simulatie: !bestaandeSim, scenario: !bestaand }, kinderen };
}

/**
 * Klopt de afloop van een run met de verwachting van het scenario? Getoetst wordt waar de run
 * stopt (het einde of het gat, op naam), of hij langs een stap kwam (`via`) en de verwachte
 * waarden: een naam (of pad met punten) in de procesvariabelen, anders op het startobject, anders
 * één niveau diep in een variabele (`leges` vindt `tarief.leges`). De `reden` is uitleg en
 * wordt niet getoetst.
 * @param {any} verwacht - `scenario.verwacht`
 * @param {{stand: any, variabelen?: Record<string, any>, object?: Record<string, any>, log?: any[]}} afloop
 * @returns {{klopt: boolean, punten: {wat: string, verwacht: any, gevonden: any, klopt: boolean}[]}|null} null = geen verwachting
 */
export function toetsVerwachting(verwacht, { stand, variabelen = {}, object = {}, log = [] }) {
  if (!verwacht || !Object.keys(verwacht).length) return null;
  const { einde, gat, via, reden, ...waarden } = verwacht;
  const punten = [];
  if (einde !== undefined) {
    const eindes = stand?.soort === "uitkomst" ? stand.eindes.map((e) => e.einde) : stand?.soort === "uitzondering" ? stand.bij : [];
    punten.push({ wat: "einde", verwacht: einde, gevonden: eindes.join(", ") || `(${stand?.soort || "geen"})`, klopt: eindes.includes(einde) });
  }
  if (gat !== undefined) {
    const gaten = stand?.soort === "gat" ? stand.gaten.map((g) => g.naam || g.plek) : [];
    punten.push({ wat: "gat", verwacht: gat, gevonden: gaten.join(", ") || `(${stand?.soort || "geen"})`, klopt: gaten.includes(gat) });
  }
  if (via !== undefined) {
    const langs = log.some((r) => r.wat === via);
    punten.push({ wat: "via", verwacht: via, gevonden: langs ? via : "(niet langsgekomen)", klopt: langs });
  }
  for (const [naam, waarde] of Object.entries(waarden)) {
    const pad = naam.split(".");
    const uit = (bron) => pad.reduce((o, k) => (o == null ? undefined : o[k]), bron);
    const genest = () => Object.values(variabelen).map((v) => (v && typeof v === "object" ? uit(v) : undefined)).find((v) => v !== undefined);
    const gevonden = uit(variabelen) !== undefined ? uit(variabelen) : uit(object) !== undefined ? uit(object) : genest();
    punten.push({ wat: naam, verwacht: waarde, gevonden: gevonden === undefined ? "(geen waarde)" : gevonden, klopt: JSON.stringify(gevonden) === JSON.stringify(waarde) });
  }
  return { klopt: punten.every((p) => p.klopt), punten };
}
