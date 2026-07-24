// @ts-check
/**
 * adapter — Toegangsspraak-AST → toegangsregel-profielmodel (stap 2).
 *
 * Deterministische afbeelding: hetzelfde beleid geeft hetzelfde model
 * (stabiele ids op volgorde, geen klok of random), zodat de projectie
 * testbaar is en de diagram-weergave — en straks de motor — er direct op
 * kunnen draaien. Naar het voorbeeld van diagramprofielen/formulier/adapter.
 *
 * Cross-profiel: gegevensselecties en begrippen dragen hun verwijzing als
 * paar { verwijzingsprofiel, verwijzingselement } — canoniek model is de
 * default (PROFIEL_CANONIEK), niet hardgecodeerd.
 */
import {
  renderVerwijzing, renderVoorwaarde, verwijzingNaarPad, verwijzingNaarGroepPad,
  geefActies, geefOperatoren,
} from "../../toegangsspraak/index.js";
import { slug } from "../../toegangsspraak/woorden.js";
import { toegangsregelDiagramType } from "./index.js";

export const PROFIEL_CANONIEK = "canoniek-model";
/** Profieltype-id van de motor-activiteit (toegangsregelsActivity). */
export const PROFIELTYPE_TOEGANGSREGELS = "toegangsregels";

// ── Teksthulpen (gedeeld met de diagram-weergave) ────────────────────────────

export function wieTekst(wie) {
  if (wie.soort === "iemand") {
    return `iemand met ${wie.kenmerken.map((k) => `${k.kenmerk} "${k.waarde}"`).join(" en ")}`;
  }
  return wie.lidwoord ? `${wie.lidwoord} ${wie.naam}` : wie.naam;
}

export function watTekst(wat) {
  if (wat.soort === "begrip") return wat.lidwoord ? `${wat.lidwoord} ${wat.naam}` : wat.naam;
  if (wat.soort === "alle") return `alle gegevens van ${renderVerwijzing(wat.verwijzing)}`;
  return renderVerwijzing(wat);
}

export function termTekst(term) {
  if (!term) return "";
  if (term.soort === "literal") return term.type === "tekst" ? `"${term.waarde}"` : String(term.waarde);
  return renderVerwijzing(term);
}

export function operatorZin(canoniek) {
  return geefOperatoren().find((op) => op.canoniek === canoniek)?.zin || canoniek;
}

export const KWANTOR_LABEL = { en: "alle", of: "ten minste één", xof: "precies één" };

/** Verwijzing van een wat-slot → (profiel, element); null zonder registerpad. */
export function watVerwijzing(wat) {
  const pad =
    wat.soort === "alle"
      ? wat.verwijzing.pad || verwijzingNaarGroepPad(wat.verwijzing)
      : wat.soort === "verwijzing"
        ? wat.pad || verwijzingNaarPad(wat)
        : null;
  return pad ? { verwijzingsprofiel: PROFIEL_CANONIEK, verwijzingselement: pad } : null;
}

// ── AST → profielmodel ───────────────────────────────────────────────────────

/**
 * @returns {{ elementen: Array, connectoren: Array }} elementen/connectoren in
 * de vocabulaire van het toegangsregel-profiel (elementType-ids uit index.js).
 *
 * Ids zijn **inhouds-gebaseerd en stabiel** (`trg:…`): een element toevoegen
 * of weghalen verandert de ids van de rest niet. Daardoor kan de publicatie
 * naar de motor-store de handmatige layout behouden (mergeCoreModel) en
 * wijzen kruisverbanden over publicaties heen naar hetzelfde element.
 */
export function beleidNaarDiagramModel(beleid) {
  const elementen = [];
  const connectoren = [];
  const gebruikt = new Set();
  const uniek = (id) => {
    let kandidaat = id;
    let n = 2;
    while (gebruikt.has(kandidaat)) kandidaat = `${id}-${n++}`;
    gebruikt.add(kandidaat);
    return kandidaat;
  };
  const nieuw = (id, elementType, naam, data = {}) => {
    const element = { id: uniek(id), elementType, naam, data };
    elementen.push(element);
    return element;
  };
  const verbind = (elementType, van, naar) => {
    connectoren.push({
      id: `trg:c:${elementType}:${van.id}>${naar.id}`,
      elementType,
      van: van.id,
      naar: naar.id,
    });
  };

  // Top-level: de policy zelf. Regels hangen eraan met "omvat" (aggregatie) —
  // herbruikbaar over policies, geen compositie. Vast id: hernoemen van het
  // beleid verplaatst niets.
  const policy = nieuw("trg:policy", "policy", beleid.naam, {
    geldigVanaf: beleid.geldigVanaf || "",
    geldigTot: beleid.geldigTot || "",
    grondslag: beleid.grondslag || "",
    doel: beleid.doel || "",
  });

  // Begrippen — herbruikbare definitie-elementen.
  const begripPerNaam = new Map();
  for (const begrip of beleid.begrippen) {
    const data = { soort: begrip.soort };
    if (begrip.soort === "wie") {
      data.definitie = `iemand met ${begrip.kenmerken.map((k) => `${k.kenmerk} "${k.waarde}"`).join(" en ")}`;
    } else {
      data.definitie = watTekst(begrip.wat);
      Object.assign(data, watVerwijzing(begrip.wat) || {});
    }
    const element = nieuw(`trg:def:${slug(begrip.naam)}`, "begrip", begrip.naam, data);
    begripPerNaam.set(begrip.naam.toLowerCase(), element);
  }

  const voorwaardeBoom = (basisId, knoop, ouder, connector, pad) => {
    const eigenId = `${basisId}:als${pad.length ? ":" + pad.join(".") : ""}`;
    if (knoop.soort === "voorwaarde") {
      const element = nieuw(eigenId, "voorwaarde", renderVoorwaarde(knoop), {
        links: termTekst(knoop.links),
        vergelijking: operatorZin(knoop.operator),
        rechts: knoop.lijst
          ? `(${knoop.lijst.map(termTekst).join(", ")})`
          : knoop.rechts2
            ? `${termTekst(knoop.rechts)} en ${termTekst(knoop.rechts2)}`
            : termTekst(knoop.rechts),
      });
      verbind(connector, ouder, element);
      return;
    }
    const poort = nieuw(eigenId, "voorwaardepoort", KWANTOR_LABEL[knoop.soort], { soort: KWANTOR_LABEL[knoop.soort] });
    verbind(connector, ouder, poort);
    knoop.items.forEach((item, i) => voorwaardeBoom(basisId, item, poort, "tak", [...pad, i + 1]));
  };

  for (const regel of beleid.regels) {
    const basisId = uniek(`trg:reg:${slug(regel.naam)}`);
    const kaart = { id: basisId, elementType: "toegangsregel", naam: regel.naam, data: { modaliteit: regel.verbod ? "mag niet" : "mag" } };
    elementen.push(kaart);
    verbind("omvat", policy, kaart);

    const subject = nieuw(`${basisId}:wie`, "subject", wieTekst(regel.wie), regel.wie.soort === "iemand"
      ? { kenmerken: regel.wie.kenmerken.map((k) => `${k.kenmerk}="${k.waarde}"`).join(", ") }
      : { rol: regel.wie.naam });
    verbind("wie", kaart, subject);
    const wieBegrip = regel.wie.soort === "begrip" && begripPerNaam.get(regel.wie.naam.toLowerCase());
    if (wieBegrip) verbind("verwijst-naar", subject, wieBegrip);

    const nlgov = geefActies().find((a) => a.woord === regel.actie)?.nlgov || "";
    const handeling = nieuw(`${basisId}:doet`, "handeling", regel.actie, { nlgov });
    verbind("doet", subject, handeling);

    const gegevens = nieuw(`${basisId}:op`, "gegevensselectie", watTekst(regel.wat), watVerwijzing(regel.wat) || {});
    verbind("op", handeling, gegevens);
    const watBegrip = regel.wat.soort === "begrip" && begripPerNaam.get(regel.wat.naam.toLowerCase());
    if (watBegrip) verbind("verwijst-naar", gegevens, watBegrip);

    if (regel.voorwaarden) voorwaardeBoom(basisId, regel.voorwaarden, kaart, "als", []);
    regel.plichten.forEach((plicht, i) => {
      const element = nieuw(`${basisId}:plicht:${i + 1}`, "plicht", plicht.zin, { nlgov: plicht.nlgov });
      verbind("waarbij", kaart, element);
    });
  }

  return { elementen, connectoren };
}

// ── Profielmodel → core-model (stap 4: de motor-store) ───────────────────────

export const DIAGRAM_ID = "trg_overzicht";

/**
 * Zet het profielmodel om naar de vorm die `createDiagramStore.laadModel`
 * verwacht: één `elements`-map (connectoren zijn elementen met source/target)
 * en één diagram met beginposities. De layout is een deterministische
 * beginstand — op de canvas is daarna alles sleepbaar.
 */
// Alleen structuur-lijnen dragen een label: daar volgt de betekenis niet uit
// de vormen. De kernzin-keten (wie/doet/op) en de boomtakken vertellen hun
// verhaal al via badge → chevron → cilinder resp. de poort-ruit.
const LIJNEN_MET_LABEL = new Set(["omvat", "bevat", "als", "waarbij", "verwijst-naar"]);

export function naarCoreModel(model, { diagramNaam = "Toegangsbeleid" } = {}) {
  // Connector-naam = het type-label; de canvas toont el.naam als lijnlabel.
  const typeLabel = new Map(toegangsregelDiagramType.elementTypes.map((et) => [et.id, et.label]));
  const elements = {};
  for (const e of model.elementen) {
    elements[e.id] = { id: e.id, naam: e.naam, elementType: e.elementType, compartimenten: [], data: e.data || {} };
  }
  for (const c of model.connectoren) {
    elements[c.id] = {
      id: c.id,
      naam: LIJNEN_MET_LABEL.has(c.elementType) ? typeLabel.get(c.elementType) || c.elementType : "",
      elementType: c.elementType,
      source: c.van,
      target: c.naar,
      compartimenten: [],
      data: {},
    };
  }

  // Opzoekhulpen over de connectoren.
  const uit = (vanId, soort) => model.connectoren.filter((c) => c.elementType === soort && c.van === vanId).map((c) => c.naar);

  const posities = new Map();
  const zet = (id, x, y) => { if (id && !posities.has(id)) posities.set(id, { x, y }); };

  // Kop: policy linksboven, begrippen ernaast.
  const policy = model.elementen.find((e) => e.elementType === "policy");
  if (policy) zet(policy.id, 40, 40);
  model.elementen.filter((e) => e.elementType === "begrip").forEach((b, i) => zet(b.id, 360 + i * 320, 40));

  // Per regel een blok: kernzin-keten op één rij, voorwaardeboom eronder,
  // plichten links onder de kaart.
  const kaarten = model.elementen.filter((e) => e.elementType === "toegangsregel");
  kaarten.forEach((kaart, r) => {
    const basisY = 240 + r * 460;
    zet(kaart.id, 40, basisY);
    const subject = uit(kaart.id, "wie")[0];
    zet(subject, 340, basisY);
    const handeling = subject ? uit(subject, "doet")[0] : null;
    zet(handeling, 660, basisY);
    const gegevens = handeling ? uit(handeling, "op")[0] : null;
    zet(gegevens, 940, basisY);

    // Voorwaardeboom: diepte → kolom, volgorde → rij.
    let vwRij = 0;
    const plaatsVoorwaarde = (id, diepte) => {
      zet(id, 340 + diepte * 300, basisY + 150 + vwRij * 110);
      vwRij += 1;
      for (const kind of uit(id, "tak")) plaatsVoorwaarde(kind, diepte + 1);
    };
    for (const top of uit(kaart.id, "als")) plaatsVoorwaarde(top, 0);

    uit(kaart.id, "waarbij").forEach((p, i) => zet(p, 40, basisY + 150 + i * 110));
  });

  // Vangnet voor alles zonder positie.
  let rest = 0;
  for (const e of model.elementen) {
    if (!posities.has(e.id)) { zet(e.id, 40 + (rest % 5) * 300, 40 + 120 * Math.floor(rest / 5)); rest += 1; }
  }

  return {
    diagramTypeId: "toegangsregel",
    elements,
    diagrams: {
      [DIAGRAM_ID]: {
        id: DIAGRAM_ID,
        naam: diagramNaam,
        diagramType: "toegangsregel",
        nodes: model.elementen.map((e) => ({ elementId: e.id, position: posities.get(e.id) })),
        edges: [],
      },
    },
    actiefDiagramId: DIAGRAM_ID,
    meta: null,
  };
}

/**
 * Merge een nieuwe publicatie met de bestaande store-inhoud: **de layout is
 * heilig**. Regels:
 *  - Adapter-beheerde elementen (id `trg:…`) worden vervangen door de nieuwe
 *    stand: wat uit de tekst verdween, verdwijnt (dat is geen layout-verlies);
 *    wat bleef, behoudt zijn node (positie, afmeting, ankers) op het diagram.
 *  - Gebruikers-elementen (notities, handmatig getekende elementen/lijnen)
 *    blijven staan, incl. hun nodes; alleen lijnen naar verdwenen elementen
 *    worden opgeruimd.
 *  - Andere (handgemaakte) diagrammen en alle viewports (pan/zoom) blijven.
 *
 * @param bestaand {{elements, diagrams, viewports, actiefDiagramId, meta}} —
 *   de huidige store-state.
 * @param nieuw het resultaat van naarCoreModel().
 */
export function mergeCoreModel(bestaand, nieuw) {
  // Adapter-beheerd: de stabiele inhouds-ids (trg:…) én de oude
  // volgnummer-ids (trg_1/trg_c1) van eerdere publicaties — anders zou een
  // oud gepubliceerd model bij de eerste merge verdubbelen. Handwerk via de
  // taakbalk (trg_nieuw_…) is juist géén adapter-bezit en blijft staan.
  const isAdapterId = (id) => /^trg:/.test(id) || /^trg_c?\d+$/.test(id);

  const elements = {};
  for (const [id, el] of Object.entries(bestaand.elements || {})) {
    if (!isAdapterId(id)) elements[id] = el;
  }
  Object.assign(elements, nieuw.elements);
  // Lijnen (van wie dan ook) waarvan een uiteinde verdween: opruimen.
  for (const [id, el] of Object.entries(elements)) {
    if (el.source && el.target && !(elements[el.source] && elements[el.target])) delete elements[id];
  }

  const diagrams = {};
  for (const [id, diagram] of Object.entries(bestaand.diagrams || {})) {
    diagrams[id] = { ...diagram };
  }
  const nieuwDiagram = nieuw.diagrams[DIAGRAM_ID];
  const oud = diagrams[DIAGRAM_ID];
  if (oud) {
    const oudeNodes = new Map((oud.nodes || []).map((node) => [node.elementId, node]));
    const nodes = nieuwDiagram.nodes.map((node) => oudeNodes.get(node.elementId) || node);
    for (const node of oud.nodes || []) {
      if (!isAdapterId(node.elementId) && elements[node.elementId] && !nodes.some((n) => n.elementId === node.elementId)) {
        nodes.push(node);
      }
    }
    diagrams[DIAGRAM_ID] = { ...oud, nodes };
  } else {
    diagrams[DIAGRAM_ID] = nieuwDiagram;
  }
  for (const [id, diagram] of Object.entries(diagrams)) {
    const nodes = (diagram.nodes || []).filter((node) => elements[node.elementId]);
    // Viewport terug in het diagram stoppen: laadModel splitst hem er weer af
    // (anders zou herpubliceren pan/zoom resetten).
    const viewport = bestaand.viewports?.[id];
    diagrams[id] = { ...diagram, nodes, ...(viewport ? { viewport } : {}) };
  }

  return {
    diagramTypeId: nieuw.diagramTypeId,
    elements,
    diagrams,
    actiefDiagramId:
      bestaand.actiefDiagramId && diagrams[bestaand.actiefDiagramId] ? bestaand.actiefDiagramId : DIAGRAM_ID,
    meta: nieuw.meta ?? bestaand.meta ?? null,
  };
}

// ── Kruisverbanden (stap 3, v0) ──────────────────────────────────────────────

/**
 * De cross-profiel verwijzingen van een profielmodel als kruisverband-links
 * in het formaat van de Koppelingen-activiteit: rij = het toegangsregel-
 * element (onderliggend), kolom = het element in het andere profiel
 * (bovenliggend), soort "komt voort uit". De rij gebruikt de échte
 * element-ids van het gepubliceerde diagram-model (adapter is
 * deterministisch, dus publiceren en registreren wijzen naar hetzelfde
 * element); de kolom is nog pad-gebaseerd tot het canoniek model per
 * element aanspreekbaar is.
 */
export function kruisverbandenUit(model) {
  const links = [];
  const gezien = new Set();
  for (const element of model.elementen) {
    const { verwijzingsprofiel, verwijzingselement } = element.data || {};
    if (!verwijzingsprofiel || !verwijzingselement) continue;
    const sleutel = `${element.id}##${verwijzingsprofiel}::${verwijzingselement}`;
    if (gezien.has(sleutel)) continue;
    gezien.add(sleutel);
    links.push({
      rij: { profielId: PROFIELTYPE_TOEGANGSREGELS, elementId: element.id },
      kolom: { profielId: verwijzingsprofiel, elementId: verwijzingselement },
      soort: "komt voort uit",
    });
  }
  return links;
}
