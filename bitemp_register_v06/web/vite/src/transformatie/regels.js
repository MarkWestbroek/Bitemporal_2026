// @ts-check
/**
 * regels — **toepasser**: brongraaf + regelset → plan voor een doelmodel.
 *
 * Tweede stap van een transformatie (zie docs/TRANSFORMATIES.md). Een regelset
 * is **data, geen code**: een geordende lijst `als … maak …`-regels, leesbaar
 * en per bron/doel-paar te vervangen of aan te vullen. De toepasser kent geen
 * enkele bron- of doeltaal; die kennis zit volledig in de regelset.
 *
 * Regel:
 *   { naam, bij: "knoop" | "groep" | "verbinding",
 *     als?:  { <eigenschap>: <toets>, bron?: {…}, doel?: {…} },
 *     maak?: { type, naam?, data?, omgekeerd? }      // element of connector
 *     zet?:  { op: "bron"|"doel", data, vervalt? }   // eigenschap op een uiteinde
 *     negeer?: true,                                 // bewust niets doen
 *     meld?: true }                                  // interpretatie melden
 *
 * Per bron-item wint de **eerste** regel die past (zoals `xsl:template match`
 * met volgorde als prioriteit). Past er geen, dan volgt een waarschuwing —
 * nooit een stille gok.
 *
 * Toets: een waarde (gelijk, hoofdletterongevoelig), een lijst (één van),
 * `true`/`false`, `{patroon: "regex"}`, `{leeg: true|false}` of `{niet: toets}`.
 * Sjabloon: `"{tekst}"`, `"{doel.romp}"`, met filter `"{tekst|eenregel}"`.
 * Eén kale placeholder geeft een getypeerde waarde (getal, boolean, object)
 * ongemoeid door; zie `vul`.
 *
 * Volgorde van uitvoering: eerst knopen en groepen (die krijgen daarmee een
 * doel-`type`), dan verbindingen — zodat een verbindingsregel kan toetsen op
 * het type van zijn uiteinden (`bron: { type: "actor" }`).
 *
 * Puur en store-loos.
 */

/**
 * @typedef {Object} Diagnostic
 * @property {"info"|"warning"|"error"} severity
 * @property {string} code
 * @property {string} message
 * @property {string|null} [sourceId]
 * @property {string|null} [path]
 */

/**
 * @typedef {Object} PlanElement
 * @property {string} sleutel       - id van het bron-item
 * @property {"knoop"|"groep"} bronSoort
 * @property {string} type          - ElementType-id in het doelprofiel
 * @property {string} naam
 * @property {Record<string, any>} data
 * @property {string|null} groep    - sleutel van het omvattende plan-element
 * @property {string} regel         - naam van de toegepaste regel
 */

/**
 * @typedef {Object} PlanConnector
 * @property {string} sleutel
 * @property {string} type
 * @property {string} bron          - sleutel van het bron-element
 * @property {string} doel
 * @property {string} naam
 * @property {Record<string, any>} data
 * @property {string} regel
 */

/**
 * @typedef {Object} Spoor  - traceerbaarheid: wat is er met elk bron-item gebeurd
 * @property {"knoop"|"groep"|"verbinding"} soort
 * @property {string} bronId
 * @property {string|null} regel
 * @property {"gemaakt"|"gezet"|"opgegaan"|"genegeerd"|"geen-regel"|"overgeslagen"} actie
 * @property {string|null} doel     - sleutel van het plan-element/-connector
 */

const SOORTEN = ["knoop", "groep", "verbinding"];
const FILTERS = {
  eenregel: (waarde) => String(waarde ?? "").replace(/\s+/g, " ").trim(),
};

const lijst = (waarde) => (Array.isArray(waarde) ? waarde : [waarde]);
const norm = (waarde) => String(waarde ?? "").trim().toLowerCase();
const isObject = (waarde) => !!waarde && typeof waarde === "object" && !Array.isArray(waarde);
const lees = (bron, pad) => pad.split(".").reduce((o, sleutel) => (o == null ? undefined : o[sleutel]), bron);

/** Voldoet een waarde (of één uit een lijst waarden) aan de toets? */
export function voldoet(waarde, toets) {
  if (isObject(toets)) {
    if ("niet" in toets) return !voldoet(waarde, toets.niet);
    if ("leeg" in toets) return lijst(waarde).every((w) => norm(w) === "") === !!toets.leeg;
    if ("patroon" in toets) {
      const re = new RegExp(toets.patroon, toets.vlaggen ?? "i");
      return lijst(waarde).some((w) => re.test(String(w ?? "").trim()));
    }
    return false;
  }
  if (Array.isArray(toets)) return toets.some((deel) => voldoet(waarde, deel));
  if (typeof toets === "boolean") return !!waarde === toets;
  return lijst(waarde).some((w) => norm(w) === norm(toets));
}

/** Past een bron-item (als "view") op alle voorwaarden van een regel? */
export function past(view, als) {
  for (const [eigenschap, toets] of Object.entries(als || {})) {
    if (eigenschap === "bron" || eigenschap === "doel") {
      if (!view?.[eigenschap] || !past(view[eigenschap], toets)) return false;
    } else if (!voldoet(view?.[eigenschap], toets)) return false;
  }
  return true;
}

/**
 * Vul een sjabloon; niet-teksten (getal, boolean, object) gaan ongewijzigd door.
 * Bestaat het sjabloon uit precies één placeholder zonder filter (`"{waarde}"`)
 * en is die waarde een getal, boolean of object, dan komt de ruwe waarde terug —
 * zo kan een lezer een getypeerde waarde aanleveren en een schrijver hem lezen.
 * Strings en ontbrekende waarden blijven tekst (ontbreekt → "").
 */
export function vul(sjabloon, view) {
  if (typeof sjabloon !== "string") return sjabloon;
  const enkel = /^\{([\w.]+)\}$/.exec(sjabloon);
  if (enkel) {
    const ruw = lees(view, enkel[1]);
    if (typeof ruw === "number" || typeof ruw === "boolean" || (ruw !== null && typeof ruw === "object")) return ruw;
  }
  return sjabloon.replace(/\{([\w.]+)(?:\|(\w+))?\}/g, (_, pad, filter) => {
    const waarde = lees(view, pad);
    const tekst = Array.isArray(waarde) ? waarde.join(", ") : String(waarde ?? "");
    return filter && FILTERS[filter] ? FILTERS[filter](tekst) : tekst;
  });
}

const vulData = (data, view) => Object.fromEntries(Object.entries(data || {}).map(([k, v]) => [k, vul(v, view)]));

/**
 * Controleer een regelset vóór gebruik — bedoeld voor regelsets die straks
 * uit een bestand of de Studio komen in plaats van uit de broncode.
 *
 * @returns {string[]} foutmeldingen (leeg = geldig)
 */
export function valideerRegelset(regelset) {
  const fouten = [];
  if (!regelset?.id) fouten.push("Regelset: id ontbreekt.");
  if (!Array.isArray(regelset?.regels) || !regelset.regels.length) {
    fouten.push("Regelset: regels ontbreekt of is leeg.");
    return fouten;
  }
  const toetsFouten = (toets, waar) => {
    if (Array.isArray(toets)) return toets.flatMap((deel) => toetsFouten(deel, waar));
    if (!isObject(toets)) return [];
    if ("niet" in toets) return toetsFouten(toets.niet, waar);
    if ("leeg" in toets) return [];
    if ("patroon" in toets) {
      try {
        new RegExp(toets.patroon, toets.vlaggen ?? "i");
        return [];
      } catch (fout) {
        return [`${waar}: ongeldig patroon "${toets.patroon}" (${fout.message}).`];
      }
    }
    return [`${waar}: onbekende toets ${JSON.stringify(toets)}.`];
  };
  const alsFouten = (als, waar) =>
    Object.entries(als || {}).flatMap(([eigenschap, toets]) =>
      eigenschap === "bron" || eigenschap === "doel"
        ? isObject(toets) ? alsFouten(toets, `${waar}.${eigenschap}`) : [`${waar}.${eigenschap}: verwacht voorwaarden.`]
        : toetsFouten(toets, `${waar}.${eigenschap}`)
    );

  regelset.regels.forEach((regel, index) => {
    const waar = `Regel ${index + 1}${regel?.naam ? ` "${regel.naam}"` : ""}`;
    if (!regel?.naam) fouten.push(`${waar}: naam ontbreekt.`);
    if (!SOORTEN.includes(regel?.bij)) fouten.push(`${waar}: bij moet knoop, groep of verbinding zijn.`);
    const acties = ["maak", "zet", "negeer"].filter((actie) => regel?.[actie]);
    if (acties.length !== 1) fouten.push(`${waar}: precies één van maak, zet of negeer vereist.`);
    if (regel?.maak && !regel.maak.type) fouten.push(`${waar}: maak.type ontbreekt.`);
    if (regel?.zet) {
      if (regel.bij !== "verbinding") fouten.push(`${waar}: zet kan alleen bij een verbinding.`);
      if (!["bron", "doel"].includes(regel.zet.op)) fouten.push(`${waar}: zet.op moet bron of doel zijn.`);
      if (regel.zet.vervalt && !["bron", "doel"].includes(regel.zet.vervalt)) fouten.push(`${waar}: zet.vervalt moet bron of doel zijn.`);
    }
    fouten.push(...alsFouten(regel?.als, `${waar}, als`));
  });
  return fouten;
}

/**
 * Pas een regelset toe op een brongraaf.
 *
 * @param {{knopen: any[], groepen: any[], verbindingen: any[]}} graaf
 * @param {{id: string, regels: any[]}} regelset
 * @returns {{elementen: PlanElement[], connectoren: PlanConnector[], trace: Spoor[], diagnostics: Diagnostic[]}}
 */
export function pasRegelsToe(graaf, regelset) {
  const fouten = valideerRegelset(regelset);
  if (fouten.length) throw new Error(`Ongeldige regelset:\n- ${fouten.join("\n- ")}`);

  /** @type {Diagnostic[]} */
  const diagnostics = [];
  /** @type {Spoor[]} */
  const trace = [];
  /** @type {Map<string, PlanElement>} */
  const elementen = new Map();
  /** @type {PlanConnector[]} */
  const connectoren = [];
  const views = new Map();
  const vervallen = new Map(); // sleutel → sleutel van het element waarin het opging

  const regelVoor = (soort, view) => regelset.regels.find((regel) => regel.bij === soort && past(view, regel.als)) || null;
  const waar = (item) => (item.regel ? `regel ${item.regel}` : null);
  const meldInterpretatie = (regel, item, tekst) => {
    if (!regel.meld) return;
    diagnostics.push({ severity: "info", code: "TRF-INTERPRETATIE", message: `Regel "${regel.naam}" toegepast: ${tekst}`, sourceId: item.id, path: waar(item) });
  };

  // 1. Knopen en groepen → elementen (en daarmee een doel-type per bron-item).
  const items = [
    ...(graaf.groepen || []).map((groep) => ["groep", groep]),
    ...(graaf.knopen || []).map((knoop) => ["knoop", knoop]),
  ];
  for (const [soort, item] of items) {
    const view = { ...item, soort, romp: item.romp ?? item.tekst, klasse: item.klassen || [], inGroep: item.groep != null, type: null };
    views.set(item.id, view);
    const regel = regelVoor(soort, view);
    if (!regel) {
      trace.push({ soort, bronId: item.id, regel: null, actie: "geen-regel", doel: null });
      diagnostics.push({ severity: "warning", code: "TRF-GEEN-REGEL", message: `Geen regel voor ${soort} (vorm ${item.vorm || "–"}); niet overgenomen`, sourceId: item.id, path: waar(item) });
      continue;
    }
    if (regel.negeer) {
      trace.push({ soort, bronId: item.id, regel: regel.naam, actie: "genegeerd", doel: null });
      continue;
    }
    view.type = regel.maak.type;
    elementen.set(item.id, {
      sleutel: item.id,
      bronSoort: soort,
      type: regel.maak.type,
      naam: vul(regel.maak.naam ?? "{tekst|eenregel}", view),
      data: vulData(regel.maak.data, view),
      groep: item.groep ?? null,
      regel: regel.naam,
    });
    trace.push({ soort, bronId: item.id, regel: regel.naam, actie: "gemaakt", doel: item.id });
    meldInterpretatie(regel, item, `${soort} → ${regel.maak.type}`);
  }

  // 2. Verbindingen → connectoren, of eigenschappen op een uiteinde.
  for (const verbinding of graaf.verbindingen || []) {
    const view = { ...verbinding, soort: "verbinding", bron: views.get(verbinding.bron) || null, doel: views.get(verbinding.doel) || null };
    const omschrijving = `${verbinding.bron} → ${verbinding.doel}${verbinding.label ? ` (${verbinding.label})` : ""}`;
    const regel = regelVoor("verbinding", view);
    if (!regel) {
      trace.push({ soort: "verbinding", bronId: verbinding.id, regel: null, actie: "geen-regel", doel: null });
      diagnostics.push({ severity: "warning", code: "TRF-GEEN-REGEL", message: `Geen regel voor verbinding ${omschrijving}; niet overgenomen`, sourceId: verbinding.id, path: waar(verbinding) });
      continue;
    }
    if (regel.negeer) {
      trace.push({ soort: "verbinding", bronId: verbinding.id, regel: regel.naam, actie: "genegeerd", doel: null });
      continue;
    }
    if (regel.zet) {
      const doelwit = elementen.get(verbinding[regel.zet.op]);
      if (!doelwit) {
        trace.push({ soort: "verbinding", bronId: verbinding.id, regel: regel.naam, actie: "overgeslagen", doel: null });
        diagnostics.push({ severity: "warning", code: "TRF-UITEINDE", message: `Verbinding ${omschrijving}: ${regel.zet.op} is niet omgezet`, sourceId: verbinding.id, path: waar(verbinding) });
        continue;
      }
      for (const [sleutel, waarde] of Object.entries(vulData(regel.zet.data, view))) {
        const bestaand = doelwit.data[sleutel];
        // Twee bronnen voor dezelfde teksteigenschap: onder elkaar, niets weggooien.
        doelwit.data[sleutel] = typeof bestaand === "string" && bestaand && typeof waarde === "string" && waarde !== bestaand ? `${bestaand}\n\n${waarde}` : waarde;
      }
      if (regel.zet.vervalt) vervallen.set(verbinding[regel.zet.vervalt], doelwit.sleutel);
      trace.push({ soort: "verbinding", bronId: verbinding.id, regel: regel.naam, actie: "gezet", doel: doelwit.sleutel });
      meldInterpretatie(regel, verbinding, omschrijving);
      continue;
    }
    const [van, naar] = regel.maak.omgekeerd ? [verbinding.doel, verbinding.bron] : [verbinding.bron, verbinding.doel];
    if (!elementen.has(van) || !elementen.has(naar)) {
      trace.push({ soort: "verbinding", bronId: verbinding.id, regel: regel.naam, actie: "overgeslagen", doel: null });
      diagnostics.push({ severity: "warning", code: "TRF-UITEINDE", message: `Verbinding ${omschrijving}: een uiteinde is niet omgezet`, sourceId: verbinding.id, path: waar(verbinding) });
      continue;
    }
    connectoren.push({
      sleutel: verbinding.id,
      type: regel.maak.type,
      bron: van,
      doel: naar,
      naam: vul(regel.maak.naam ?? "", view),
      data: vulData(regel.maak.data, view),
      regel: regel.naam,
    });
    trace.push({ soort: "verbinding", bronId: verbinding.id, regel: regel.naam, actie: "gemaakt", doel: verbinding.id });
    meldInterpretatie(regel, verbinding, `${omschrijving} → ${regel.maak.type}`);
  }

  // 3. Elementen die in een ander opgingen vervallen — tenzij er toch een
  //    connector aan hangt.
  const inGebruik = new Set(connectoren.flatMap((connector) => [connector.bron, connector.doel]));
  for (const [sleutel, doel] of vervallen) {
    if (inGebruik.has(sleutel) || !elementen.has(sleutel)) continue;
    elementen.delete(sleutel);
    const spoor = trace.find((item) => item.bronId === sleutel && item.soort !== "verbinding");
    if (spoor) Object.assign(spoor, { actie: "opgegaan", doel });
  }

  // 4. Een lid van een niet-omgezette groep schuift door naar de naaste
  //    omvattende groep die er wél is.
  const groepVan = new Map((graaf.groepen || []).map((groep) => [groep.id, groep.groep ?? null]));
  for (const element of elementen.values()) {
    let groep = element.groep;
    const gezien = new Set();
    while (groep != null && !elementen.has(groep) && !gezien.has(groep)) {
      gezien.add(groep);
      groep = groepVan.get(groep) ?? null;
    }
    element.groep = groep != null && elementen.has(groep) ? groep : null;
  }

  return { elementen: [...elementen.values()], connectoren, trace, diagnostics };
}
