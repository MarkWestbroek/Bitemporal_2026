// @ts-check
/**
 * v3Graaf — **lezer** voor een samengestelde bron: een V3-model (het canonieke
 * datamodel, M1) plus de keuzes van één artefact uit een e-dienst-
 * inrichtingsmodel (docs/TRANSFORMATIES.md §7.7 en §11).
 *
 * De lezer kent de taal V3: entiteiten, gegevenselementen (GE's) met velden,
 * relaties, datatypen, enums en referentielijsten. Hij kent níét het doel
 * (JSON Schema, een formulier); dat staat in een regelset. Wat de e-dienst
 * kiest, staat als eigenschap op de knopen (`geselecteerd`) en bepaalt welke
 * relaties worden ingebed — zodat de regelset generiek blijft.
 *
 * Graaf, vanuit de bron-entiteit van het artefact:
 *
 *   groep  wortel            id <Entiteit>                       — de bron-entiteit
 *   groep  ge                id <Entiteit>.<GE>                  — groep: wortel
 *   groep  relatie-ingebed   id <Entiteit>.<Relatie>             — groep: wortel
 *   groep  ge                id <Entiteit>.<Relatie>.<Doel>.<GE> — groep: de relatie
 *   knoop  veld              id <pad van het GE>.<veld>          — groep: het GE
 *
 * De ids zijn de modelpaden die het e-dienstmodel gebruikt
 * ("Aanvraag.AanvraagAanvrager.Aanvrager.AanvragerNaam.naam"), zodat de trace
 * van elk artefact naar dezelfde modelknoop wijst.
 *
 * Eigenschappen van een veld (`eigenschappen`): de V3-feiten, opgelost — het
 * basistype en de validatie van het datatype (model eerst, dan de gedeelde
 * bibliotheek), de waarden van een enum, en bij een verwijzing naar een
 * referentielijst de projectie die de e-dienst kiest (`als: "code"`).
 *
 * Puur en store-loos.
 */

/**
 * @typedef {Object} ArtefactKeuzes  - één artefact uit het e-dienstmodel
 * @property {string} bron           - naam van de bron-entiteit
 * @property {string[]} velden       - positieve selectie, als modelpaden
 * @property {{materieel?: string, relaties?: Record<string, {als: string, naam?: string}>,
 *   referentielijsten?: Record<string, {als: string, enum?: boolean}>}} [projectie]
 */

const leeg = (waarde) => waarde == null || waarde === "";

/** Datatypen op naam: die van het model gaan voor de gedeelde bibliotheek. */
function datatypeIndex(model, gedeeld) {
  const index = new Map();
  for (const dt of gedeeld || []) index.set(dt.naam, dt);
  for (const dt of model?.datatypes || []) index.set(dt.naam, dt);
  return index;
}

/**
 * @param {Object} invoer
 * @param {any} invoer.model                     - V3-model (het object onder `model`, of het hele bestand)
 * @param {ArtefactKeuzes} invoer.keuzes
 * @param {any[]} [invoer.datatypen]             - de gedeelde datatypebibliotheek (testdata/gegevenstypen.json)
 * @param {Record<string, any[]>} [invoer.referentielijsten] - M0-items per referentielijst-entiteit, voor `enum: true`
 * @returns {{knopen: any[], groepen: any[], verbindingen: any[], waarschuwingen: any[]}}
 */
export function v3Graaf({ model: invoerModel, keuzes, datatypen = [], referentielijsten = {} }) {
  const model = invoerModel?.model || invoerModel;
  const entiteiten = new Map((model?.entiteiten || []).map((e) => [e.typenaam, e]));
  const enums = new Map((model?.enums || []).map((e) => [e.goType, e]));
  const datatypes = datatypeIndex(model, datatypen);
  const geselecteerd = new Set(keuzes?.velden || []);
  const projectie = keuzes?.projectie || {};
  const knopen = [];
  const groepen = [];
  const waarschuwingen = [];
  const meld = (melding, tekst = "") => waarschuwingen.push({ regel: 0, tekst, melding });

  const wortel = entiteiten.get(keuzes?.bron);
  if (!wortel) {
    meld(`Bron-entiteit ${keuzes?.bron} staat niet in het model`);
    return { knopen, groepen, verbindingen: [], waarschuwingen };
  }

  /** V3-feiten van één veld, met het datatype, de enum en de verwijzing opgelost. */
  function veldEigenschappen(veld, pad) {
    const e = {
      geselecteerd: geselecteerd.has(pad),
      verplicht: veld.verplicht === true,
      beschrijving: veld.description || "",
      basistype: veld.type || "string",
      datatype: veld.datatype || "",
      format: veld.format || "",
      pattern: "",
      minLength: null,
      maxLength: null,
      enumWaarden: null,
    };
    const dt = veld.datatype ? datatypes.get(veld.datatype) : null;
    if (veld.datatype && !dt) meld(`Datatype ${veld.datatype} is onbekend (niet in het model en niet in de gedeelde bibliotheek)`, pad);
    if (dt) {
      e.basistype = dt.basistype || e.basistype;
      e.format = veld.format || dt.format || "";
      e.pattern = dt.validatie?.pattern || "";
      e.minLength = dt.validatie?.minLength ?? null;
      e.maxLength = dt.validatie?.maxLength ?? null;
    }
    if (veld.enum) {
      const en = enums.get(veld.enum);
      if (!en) meld(`Enum ${veld.enum} staat niet in het model`, pad);
      else e.enumWaarden = en.waarden.map((w) => w.waarde);
    }
    if (veld.$ref) {
      // Verwijzing naar een (referentielijst-)entiteit: de e-dienst kiest hoe
      // die in het doel verschijnt. "code" = de sleutel van het item (het
      // unieke veld van de entiteit) als tekst.
      const doel = entiteiten.get(veld.$ref);
      const keuze = projectie.referentielijsten?.[veld.$ref];
      e.refNaar = veld.$ref;
      if (!doel) meld(`Verwijzing naar ${veld.$ref}, maar die entiteit staat niet in het model`, pad);
      else if (!keuze) meld(`Geen projectie voor de verwijzing naar ${veld.$ref}; het veld blijft een id`, pad);
      else if (keuze.als === "code") {
        const sleutel = doel.gegevenselementen.flatMap((g) => g.velden).find((v) => v.uniek === "entiteit");
        if (!sleutel) meld(`${veld.$ref} heeft geen uniek veld om als code te gebruiken`, pad);
        else {
          const sleutelDt = sleutel.datatype ? datatypes.get(sleutel.datatype) : null;
          e.refAls = "code";
          e.basistype = sleutelDt?.basistype || sleutel.type || "string";
          // De code is een verwijzing, geen vrije tekst: het patroon en de
          // lengte van het sleutelveld horen bij de referentielijst, niet hier.
          e.datatype = "";
          if (keuze.enum) {
            const items = referentielijsten[veld.$ref];
            if (!items) meld(`enum: true voor ${veld.$ref}, maar er zijn geen referentielijst-items meegegeven`, pad);
            else e.enumWaarden = items.map((item) => item[sleutel.naam]).filter((w) => !leeg(w));
          }
        }
      } else meld(`Onbekende projectie "${keuze.als}" voor ${veld.$ref}`, pad);
    }
    return e;
  }

  /** De GE's van een entiteit als groepen onder `ouder`, met hun velden als knopen. */
  function voegGEsToe(entiteit, padVoorvoegsel, ouder) {
    for (const ge of entiteit.gegevenselementen || []) {
      const gePad = `${padVoorvoegsel}.${ge.naam}`;
      const velden = (ge.velden || []).map((veld) => ({ veld, pad: `${gePad}.${veld.naam}` }));
      groepen.push({
        id: gePad,
        aard: "ge",
        tekst: ge.naam,
        groep: ouder,
        eigenschappen: {
          meervoudig: ge.momentvoorkomen === "meervoudig",
          meervoud: ge.meervoud || "",
          beschrijving: ge.description || "",
          materieel: ge.isMaterieel === true,
          geselecteerd: velden.some(({ pad }) => geselecteerd.has(pad)),
        },
      });
      for (const { veld, pad } of velden) {
        knopen.push({ id: pad, aard: "veld", tekst: veld.naam, groep: gePad, eigenschappen: veldEigenschappen(veld, pad) });
      }
    }
  }

  groepen.push({
    id: wortel.typenaam,
    aard: "wortel",
    tekst: wortel.typenaam,
    groep: null,
    eigenschappen: { beschrijving: wortel.description || "", materieel: projectie.materieel || "", geselecteerd: true },
  });
  voegGEsToe(wortel, wortel.typenaam, wortel.typenaam);

  for (const relatie of wortel.relaties || []) {
    const keuze = projectie.relaties?.[relatie.naam];
    const relPad = `${wortel.typenaam}.${relatie.naam}`;
    const doel = entiteiten.get(relatie.doelEntiteit);
    const ergensGeselecteerd = [...geselecteerd].some((pad) => pad.startsWith(`${relPad}.`));
    if (!keuze) {
      if (ergensGeselecteerd) meld(`Velden van relatie ${relatie.naam} zijn geselecteerd, maar de relatie heeft geen projectie`, relPad);
      continue;
    }
    if (keuze.als !== "ingebed") {
      meld(`Onbekende projectie "${keuze.als}" voor relatie ${relatie.naam}`, relPad);
      continue;
    }
    if (!doel) {
      meld(`Relatie ${relatie.naam} verwijst naar ${relatie.doelEntiteit}, die niet in het model staat`, relPad);
      continue;
    }
    groepen.push({
      id: relPad,
      aard: "relatie-ingebed",
      tekst: keuze.naam || relatie.naam,
      groep: wortel.typenaam,
      eigenschappen: {
        // Verplicht als er altijd precies (minstens) één doel is.
        verplicht: /^1/.test(String(relatie.doelKardinaliteit || "")),
        meervoudig: relatie.momentvoorkomen === "meervoudig",
        beschrijving: relatie.description || "",
        geselecteerd: ergensGeselecteerd,
      },
    });
    voegGEsToe(doel, `${relPad}.${doel.typenaam}`, relPad);
  }

  // Toetsbaar maken: de toepasser toetst op eigenschappen van het item zelf,
  // niet op geneste objecten (regels.js, `past`).
  for (const item of [...groepen, ...knopen]) {
    item.geselecteerd = item.eigenschappen.geselecteerd === true;
    item.meervoudig = item.eigenschappen.meervoudig === true;
  }

  // Een geselecteerd pad dat niet in het model bestaat is een fout in het
  // e-dienstmodel: melden, niet stil overslaan.
  const bekend = new Set(knopen.map((k) => k.id));
  for (const pad of geselecteerd) if (!bekend.has(pad)) meld(`Geselecteerd veld bestaat niet in het model: ${pad}`, pad);

  return { knopen, groepen, verbindingen: [], waarschuwingen };
}
