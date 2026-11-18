// @ts-check
/**
 * cmVorm — een object uit de simulatie in de vorm van het canonieke model (POC, Mark 14-11,
 * ontwerp Simulatie §11.7).
 *
 * De store is plat: de vorm van het objecttype (wat de beslistabel en de formulieren lezen). Het
 * cm kent een entiteit met gegevenselementen (GE's) en relaties. De state van een object is
 * volgens Mark "simpelweg de velden die een waarde hebben": de totale objecttoestand als M0.
 * Verplichte velden hebben altijd een waarde, optionele mogen leeg zijn. Een GE (compositie) en
 * een relatie vanuit de entiteit zijn ook state. Een relatie mag optioneel zijn, maar als ze er
 * is moet het doel bekend zijn, en de verplichte velden op de relatie.
 *
 * Hoe: de lezer `v3Graaf` geeft de structuur van de entiteit (met overerving, GE's, ingebedde
 * relaties, verplicht en meervoudig per knoop). De traceregels van het objecttype-artefact zeggen
 * per modelpad waar het in de platte vorm staat. Dat is precies de omkering die nodig is: per
 * veld van het cm de waarde uit het platte object. Een veld zonder doelpad zit niet in het
 * objecttype; de waarde is dan onbekend. Relaties die de e-dienst niet inbedt, komen uit het
 * model zelf, ook als onbekend.
 *
 * Puur, op `maakCmBeeld` na (async, want het objecttype-artefact rekent een hash).
 */
import { v3Graaf } from "../transformatie/v3Graaf.js";
import { maakObjecttypeArtefact } from "../diagramprofielen/canoniek-uml/objecttypeArtefact.js";

/** "/jsonSchema/properties/partijen/items/properties/partij/properties/bsn" → ["partijen","[]","partij","bsn"]. */
export function doelSegmenten(doelPad) {
  if (!doelPad) return null;
  const delen = doelPad.replace(/^\/jsonSchema/, "").split("/").filter(Boolean);
  const uit = [];
  for (let i = 0; i < delen.length; i++) {
    if (delen[i] === "properties") uit.push(delen[++i]);
    else if (delen[i] === "items") uit.push("[]");
  }
  // De envelop (verzoek) zet het schema onder data; het object in de store is dat data-deel.
  return uit[0] === "data" ? uit.slice(1) : uit;
}

const heeftWaarde = (w) => w !== undefined && w !== null && w !== "" && !(Array.isArray(w) && !w.length);

function lees(obj, pad) {
  let x = obj;
  for (const s of pad) {
    if (x == null || typeof x !== "object" || s === "[]") return undefined;
    x = x[s];
  }
  return x;
}

/**
 * Het beeld van één objecttype: de structuur uit het cm en de doelpaden uit de trace.
 * @param {{model: any, edienst: any, identifier: string, sha256Hex: (t: string) => Promise<string> | string}} p
 */
export async function maakCmBeeld({ model, edienst, identifier, sha256Hex }) {
  const keuzes = (edienst?.artefacten || []).find((a) => a.identifier === identifier);
  const m = model?.model || model;
  const graaf = v3Graaf({ model: m, keuzes });
  const { artefact } = await maakObjecttypeArtefact({ modelBestand: m, edienst, identifier, sha256Hex });
  const paden = new Map();
  for (const t of artefact.traceregels || []) if (t.doelPad && t.actie === "aangemaakt" && !String(t.bronGE).startsWith("envelop:")) paden.set(t.bronGE, doelSegmenten(t.doelPad));
  return { identifier, bron: keuzes?.bron, graaf, paden, model: m };
}

/**
 * Het beeld van een entiteit zonder e-dienstmodel (16-11): de structuur komt rechtstreeks uit het
 * cm, en elk veld staat in het platte object op zijn veldnaam. Dat is de vorm die de beslistabel
 * ook leest (`fieldRef.veldnaam`). Een meervoudig gegevenselement is een lijst onder zijn meervoud
 * (`aanvraagbijlagen`), en anders onder zijn naam met een kleine letter. Relaties staan er als
 * onbekend bij: zonder e-dienstmodel is niet bekend hoe ze in het object zijn ingebed.
 * @param {{model: any, bron: string}} p - bron = de naam van de entiteit (hoofdletters tellen niet)
 * @returns {any|null} null als de entiteit niet in het model staat
 */
export function maakCmBeeldDirect({ model, bron }) {
  const m = model?.model || model;
  const entiteiten = m?.entiteiten || [];
  const entiteit = entiteiten.find((e) => String(e.typenaam).toLowerCase() === String(bron || "").toLowerCase());
  if (!entiteit) return null;
  const graaf = v3Graaf({ model: m, keuzes: { bron: entiteit.typenaam } });
  const groepen = new Map(graaf.groepen.map((g) => [g.id, g]));
  const paden = new Map();
  for (const g of graaf.groepen) {
    g.geselecteerd = true; // zonder e-dienstmodel is er geen selectie: alles hoort bij het object
    if (g.aard !== "ge" || !g.meervoudig) continue;
    const [eigenaar, geNaam] = [g.groep, g.id.split(".").pop()];
    const ge = (entiteiten.find((e) => e.typenaam === eigenaar)?.gegevenselementen || []).find((x) => x.naam === geNaam);
    paden.set(g.id, [ge?.meervoud || geNaam.charAt(0).toLowerCase() + geNaam.slice(1)]);
  }
  for (const k of graaf.knopen) {
    const lijst = paden.get(groepen.get(k.groep)?.id);
    paden.set(k.id, [...(lijst ? [...lijst, "[]"] : []), k.eigenschappen?.veldnaam || k.id.split(".").pop()]);
  }
  return { identifier: entiteit.typenaam, bron: entiteit.typenaam, graaf, paden, model: m, direct: true };
}

/**
 * De beelden van alle objecttypen van een e-dienst. Een objecttype waarvan de bron-entiteit niet
 * in het model staat, wordt overgeslagen.
 */
export async function maakCmBeelden({ model, edienst, sha256Hex }) {
  const m = model?.model || model;
  const namen = new Set((m?.entiteiten || []).map((e) => e.typenaam));
  const uit = [];
  for (const a of edienst?.artefacten || []) {
    if (a.soort !== "objecttype" || !namen.has(a.bron)) continue;
    try {
      uit.push(await maakCmBeeld({ model: m, edienst, identifier: a.identifier, sha256Hex }));
    } catch {
      /* een objecttype dat niet te maken is, laat de rest staan */
    }
  }
  return uit;
}

/** Het beeld dat bij een object hoort: op het type (hoofdletterongevoelig, bron of identifier). */
export function beeldVoor(beelden, type) {
  const t = String(type || "").toLowerCase();
  return (beelden || []).find((b) => String(b.bron).toLowerCase() === t || String(b.identifier).toLowerCase() === t) || null;
}

/**
 * Een plat object in de cm-vorm, met de toets op de state.
 *
 * Knoop: {soort: "entiteit"|"ouder"|"ge"|"relatie"|"doel"|"veld", naam, verplicht?, meervoudig?,
 * inObjecttype, voorkomens?: Knoop[][], waarde?, entiteit?}.
 * Probleem: {pad, ernst: "fout"|"onbekend", melding}.
 *
 * @param {ReturnType<typeof maakCmBeeld> extends Promise<infer B> ? B : never} beeld
 * @param {Record<string, any>} plat
 */
export function cmVorm(beeld, plat) {
  const { graaf, paden, model } = beeld;
  const kinderen = new Map();
  // Velden eerst: de velden van een relatie (partijrol) vóór haar doel.
  for (const x of [...graaf.knopen, ...graaf.groepen]) {
    if (!x.groep) continue;
    if (!kinderen.has(x.groep)) kinderen.set(x.groep, []);
    kinderen.get(x.groep).push(x);
  }
  const naamUit = (id) => id.split(".").pop();
  const relatief = (segs, basis) => (basis.every((s, i) => segs[i] === s) ? segs.slice(basis.length) : segs);

  function bouwVeld(k, ctx, basis) {
    const segs = paden.get(k.id) || null;
    const waarde = segs ? lees(ctx, relatief(segs, basis)) : undefined;
    // platSleutel: het veld op het hoogste niveau van de platte vorm waar dit cm-veld onder valt (voor de markering van een wijziging).
    return { soort: "veld", id: k.id, naam: k.eigenschappen.veldnaam || naamUit(k.id), verplicht: k.eigenschappen.verplicht === true, inObjecttype: !!segs, inDoel: k.inDoel === true, waarde, platSleutel: segs?.[0] || null };
  }

  function bouwKinderen(g, ctx, basis) {
    return (kinderen.get(g.id) || []).map((x) => (graaf.knopen.includes(x) ? bouwVeld(x, ctx, basis) : bouwGroep(x, ctx, basis)));
  }

  function bouwGroep(g, ctx, basis) {
    const segs = paden.get(g.id) || null;
    const soort = { wortel: "entiteit", ouder: "ouder", ge: "ge", "relatie-ingebed": "relatie", doel: "doel" }[g.aard] || g.aard;
    const knoop = { soort, id: g.id, naam: naamUit(g.id), verplicht: g.eigenschappen.verplicht === true, meervoudig: g.meervoudig === true, inObjecttype: g.geselecteerd === true, voorkomens: [] };
    if (g.meervoudig && segs) {
      const lijst = lees(ctx, relatief(segs, basis));
      knoop.voorkomens = (Array.isArray(lijst) ? lijst : []).map((item) => bouwKinderen(g, item, [...segs, "[]"]));
    } else knoop.voorkomens = [bouwKinderen(g, ctx, basis)];
    return knoop;
  }

  const wortelGroep = graaf.groepen.find((g) => g.aard === "wortel");
  if (!wortelGroep) return { boom: null, problemen: [{ pad: "", ernst: "fout", melding: "De bron-entiteit staat niet in het model" }] };
  const boom = bouwGroep(wortelGroep, plat, []);
  boom.naam = wortelGroep.id;

  // Relaties die de e-dienst niet inbedt: wel state in het cm, maar niet in het objecttype.
  const entiteiten = new Map((model?.entiteiten || []).map((e) => [e.typenaam, e]));
  const ingebed = new Set(graaf.groepen.filter((g) => g.aard === "relatie-ingebed").map((g) => g.id));
  const metOuders = [wortelGroep.id, ...graaf.groepen.filter((g) => g.aard === "ouder").map((g) => g.id)];
  for (const naam of metOuders) {
    const e = entiteiten.get(naam);
    for (const r of e?.relaties || []) {
      const id = `${naam}.${r.naam}`;
      if (ingebed.has(id)) continue;
      const knoop = { soort: "relatie", id, naam: r.naam, doel: r.doelEntiteit, verplicht: /^1/.test(String(r.doelKardinaliteit || "")), meervoudig: r.momentvoorkomen === "meervoudig", inObjecttype: false, voorkomens: [] };
      const ouder = naam === wortelGroep.id ? boom : boom.voorkomens[0].find((x) => x.soort === "ouder" && x.id === naam);
      (ouder || boom).voorkomens[0].push(knoop);
    }
  }

  // Wat in het platte object staat maar nergens in het cm: de behandelvelden (beoordeling,
  // behandelaar) die de simulatie zet zolang Beslissing en Zaak nog niet in het cm staan (vraag 12).
  const bekendeSleutels = new Set([...paden.values()].filter(Boolean).map((s) => s[0]));
  const buitenCm = Object.fromEntries(Object.entries(plat || {}).filter(([k]) => !bekendeSleutels.has(k)));

  return { boom, problemen: toets(boom), buitenCm };
}

/** Heeft deze voorkomen (een lijst kinderen) ergens een waarde? */
function ietsBekend(kinderen) {
  return kinderen.some((k) => (k.soort === "veld" ? heeftWaarde(k.waarde) : k.voorkomens.some(ietsBekend)));
}

/** De toets op de state: verplicht ingevuld, relatie met een bekend doel. */
export function toets(boom) {
  const uit = [];
  function loop(knoop, pad, binnenDoel) {
    const hier = pad ? `${pad}.${knoop.naam}` : knoop.naam;
    if (knoop.soort === "veld") return;
    if (knoop.soort === "relatie") {
      if (!knoop.inObjecttype) {
        if (knoop.verplicht) uit.push({ pad: hier, ernst: "onbekend", melding: "verplichte relatie, niet in het objecttype" });
        return;
      }
      if (knoop.verplicht && !knoop.voorkomens.some(ietsBekend)) uit.push({ pad: hier, ernst: "fout", melding: "verplichte relatie ontbreekt" });
    }
    knoop.voorkomens.forEach((kinderen, i) => {
      const vPad = knoop.meervoudig ? `${hier}[${i}]` : hier;
      // Een GE binnen het doel van een relatie (de "is"-GE's van een Partij) is een alternatief:
      // verplicht telt alleen als het GE er is.
      const geldt = !(binnenDoel && knoop.soort === "ge") || ietsBekend(kinderen);
      if (knoop.soort === "relatie") {
        const doel = kinderen.find((k) => k.soort === "doel");
        if (ietsBekend(kinderen) && doel && !doel.voorkomens.some(ietsBekend)) uit.push({ pad: vPad, ernst: "fout", melding: "relatie zonder bekend doel" });
      }
      for (const k of kinderen) {
        if (k.soort === "veld") {
          if (!k.verplicht || !geldt || heeftWaarde(k.waarde)) continue;
          // Leeg in een relatie die er niet is (enkelvoudig, niets bekend): geen fout van het veld.
          if (knoop.soort === "relatie" && !ietsBekend(kinderen)) continue;
          uit.push(k.inObjecttype ? { pad: `${vPad}.${k.naam}`, ernst: "fout", melding: "verplicht veld zonder waarde" } : { pad: `${vPad}.${k.naam}`, ernst: "onbekend", melding: "verplicht, niet in het objecttype" });
        } else loop(k, vPad, binnenDoel || knoop.soort === "doel");
      }
    });
  }
  loop(boom, "", false);
  return uit;
}
