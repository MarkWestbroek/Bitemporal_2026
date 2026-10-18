// @ts-check
/**
 * assistentKern — de AI-assistent in context (AI-2), zuiver deel.
 *
 * Vorm zoals de transformaties (lezer → regelset → toepasser, docs/TRANSFORMATIES.md): de AI is
 * de "lezer" van een opdracht in gewone taal en levert een **plan** (JSON); de regelset is het
 * profiel (M2: element- en connectortypen met hun verbindingsregels, plus de aanwijzingen en
 * voorkeursparen uit `descriptor.assistent`), die het plan hier controleert; de toepasser is
 * `wijziging.js` (plan + stand → één wijziging: mappen, elementen, diagrammen, plaatsing,
 * kruisverbanden). De gebruiker ziet het voorstel eerst; niets gebeurt zonder Toepassen.
 *
 * Stap 1b (14-10, Mark): één opdracht mag **meerdere talen** raken (een use case met een
 * activiteitendiagram eronder), **mappen** maken, en op **bestaande elementen** aansluiten
 * (relatie leggen, op een diagram zetten, hernoemen). Dezelfde kern bedient de MCP
 * (tools/omnium-mcp): daar is de AI-client de lezer en levert hij hetzelfde plan.
 *
 * Alles hier werkt op een **profielsamenvatting** (gewone data), niet op de descriptor, zodat
 * de MCP in Node zonder de profielcode kan controleren (`tools/omnium-mcp/profielen.json`).
 */

/**
 * @typedef {Object} Samenvatting
 * @property {string} id            - profiel-id (store "model:<id>", boomsleutel "<id>::<diagram>")
 * @property {string} naam
 * @property {string} diagramTypeId
 * @property {{id: string, label: string, omschrijving?: string, container?: string, leden?: string[], vast?: boolean, uitwerking?: boolean, eigenschappen?: string[]}[]} elementen
 * @property {{id: string, label: string, omschrijving?: string, regels: {bron: string[], doel: string[]}[], eigenschappen?: string[]}[]} connectoren
 * @property {string[]} [aanwijzingen]
 * @property {Record<string, string[][]>} [paren]  - connector → toegestane [bron, doel]-paren (voorkeursrichting)
 */

/** Verbindingsregels van een (connector-)ElementType; zelfde als typeRegistry.verbindingsregelsVan. */
function regelsVan(et) {
  if (Array.isArray(et?.verbindingsregels) && et.verbindingsregels.length) {
    return et.verbindingsregels.map((r) => ({ bron: r?.bron?.elementTypes || r?.bron || [], doel: r?.doel?.elementTypes || r?.doel || [] }));
  }
  if (et?.bron || et?.doel) return [{ bron: et.bron?.elementTypes || [], doel: et.doel?.elementTypes || [] }];
  return [];
}

const eigenschapSleutels = (et) => (et?.properties || []).map((p) => p.key).filter((k) => k && !/kleur/i.test(k));

/**
 * Wat een profiel toestaat, als data (voor de prompt, de controle en de MCP).
 * Lidmaatschap van een container (systeemkader, partitie, package) heet in het plan `in`;
 * de bijbehorende connector ("bevat") staat daarom niet tussen de relaties.
 * @returns {Samenvatting}
 */
export function profielSamenvatting(descriptor, profielId = descriptor?.id) {
  const ets = descriptor?.elementTypes || [];
  const elementen = ets
    .filter((et) => !et.isConnector && !et.isAbstract && et.id !== "notitie")
    .map((et) => ({
      id: et.id,
      label: et.label || et.id,
      ...(et.omschrijving ? { omschrijving: et.omschrijving } : {}),
      ...(et.containerVoor ? { container: et.containerVoor } : {}),
      ...(et.resizebaar === false ? { vast: true } : {}),
      ...(et.uitwerking ? { uitwerking: true } : {}),
      ...(eigenschapSleutels(et).length ? { eigenschappen: eigenschapSleutels(et) } : {}),
      ...(veldCompartimenten(descriptor, et.id).length ? { velden: veldCompartimenten(descriptor, et.id).map((c) => ({ id: c.id, soort: c.soort, fieldType: c.fieldType })) } : {}),
    }));
  const bekend = new Set(elementen.map((e) => e.id));
  const lidmaatschap = new Set(elementen.map((e) => e.container).filter(Boolean));
  // Welke typen in een container mogen: de doeltypen van zijn lidmaatschap-connector.
  for (const e of elementen) {
    if (!e.container) continue;
    const ct = ets.find((et) => et.id === e.container);
    const leden = regelsVan(ct).filter((r) => r.bron.includes(e.id)).flatMap((r) => r.doel).filter((t) => bekend.has(t));
    if (leden.length) e.leden = [...new Set(leden)];
  }
  const connectoren = ets
    .filter((et) => et.isConnector && !et.isAbstract && !lidmaatschap.has(et.id))
    .map((et) => ({
      id: et.id,
      label: et.label || et.id,
      ...(et.omschrijving ? { omschrijving: et.omschrijving } : {}),
      regels: regelsVan(et)
        .map((r) => ({ bron: r.bron.filter((t) => bekend.has(t)), doel: r.doel.filter((t) => bekend.has(t)) }))
        .filter((r) => r.bron.length && r.doel.length),
      ...(eigenschapSleutels(et).length ? { eigenschappen: eigenschapSleutels(et) } : {}),
    }))
    .filter((c) => c.regels.length);
  const a = descriptor?.assistent || {};
  // Layouts van het profiel (bv. de zes richtingen van het canonieke model, 18-10): extra
  // opstel-acties voor een heel diagram of een selectie.
  const layouts = (descriptor?.layouts || []).filter((l) => l?.id).map((l) => ({ id: l.id, label: l.label || l.id }));
  return {
    id: profielId,
    naam: descriptor?.label || descriptor?.naam || profielId,
    diagramTypeId: descriptor?.id || profielId,
    elementen,
    connectoren,
    ...(layouts.length ? { layouts } : {}),
    ...(a.aanwijzingen?.length ? { aanwijzingen: a.aanwijzingen } : {}),
    ...(a.paren ? { paren: a.paren } : {}),
  };
}

/**
 * Wat er al is in een map (en zijn submappen), per profiel — voor de prompt en de controle.
 * `stand` = {mappen, plaatsing, profielen: {profielId: {elements, diagrams}}} (zoals de Studio-
 * stores of een projectsnapshot). Een element hoort erbij als het in de map geplaatst is of op
 * een diagram in de map staat; relaties alleen tussen zulke elementen. `mapId` null = de hoofdmap
 * (alles wat niet in een map geplaatst is).
 * @returns {{profielId: string, diagrammen: any[], elementen: any[], relaties: any[]}[]}
 */
export function bestaandInMap(stand, mapId, profielIds = Object.keys(stand.profielen || {})) {
  const mappen = stand.mappen || {};
  const plaatsing = stand.plaatsing || {};
  const inMap = new Set([mapId || null]);
  if (mapId) {
    const loop = (id) => { for (const m of Object.values(mappen)) if (m.ouderId === id && !inMap.has(m.id)) { inMap.add(m.id); loop(m.id); } };
    loop(mapId);
  }
  // Uitwerking (M3): elementen in de map kunnen zelf ouder zijn (hun sleutel als "map").
  for (let groei = true; groei;) {
    groei = false;
    for (const [key, ouder] of Object.entries(plaatsing)) {
      if (key.startsWith("el::") && inMap.has(ouder) && !inMap.has(key)) { inMap.add(key); groei = true; }
    }
  }
  const mapVan = (key) => plaatsing[key] || null;
  const naamVanSleutel = (key) => { const [, pid, eid] = key.split("::"); return stand.profielen?.[pid]?.elements?.[eid]?.naam || eid; };
  const mapNaam = (id) => (!id || id === mapId ? "" : mappen[id]?.naam || (id.startsWith("el::") ? naamVanSleutel(id) : ""));
  const uit = [];
  for (const profielId of profielIds) {
    const p = stand.profielen?.[profielId];
    if (!p) continue;
    const els = p.elements || {};
    const diagrammen = Object.values(p.diagrams || {}).filter((d) => inMap.has(mapVan(`${profielId}::${d.id}`)));
    const ids = new Set();
    for (const d of diagrammen) for (const n of d.nodes || []) if (els[n.elementId] && !els[n.elementId].source) ids.add(n.elementId);
    for (const e of Object.values(els)) if (!e.source && plaatsing[`el::${profielId}::${e.id}`] && inMap.has(mapVan(`el::${profielId}::${e.id}`))) ids.add(e.id);
    const opDiagrammen = (id) => diagrammen.filter((d) => (d.nodes || []).some((n) => n.elementId === id)).map((d) => d.id);
    // Waar het element staat, per diagram (eerste voorkomen): x, y en, als bekend, de maat.
    const plekken = (id) => {
      const uit = {};
      for (const d of diagrammen) {
        const n = (d.nodes || []).find((k) => k.elementId === id);
        if (!n?.position) continue;
        uit[d.id] = [Math.round(n.position.x), Math.round(n.position.y), ...(n.size?.width ? [Math.round(n.size.width), Math.round(n.size.height)] : [])];
      }
      return uit;
    };
    const relaties = [];
    for (const e of Object.values(els)) {
      if (!e.source || !ids.has(e.source) || !ids.has(e.target)) continue;
      relaties.push({ id: e.id, type: e.elementType, bron: e.source, doel: e.target });
    }
    if (!diagrammen.length && !ids.size) continue;
    uit.push({
      profielId,
      diagrammen: diagrammen.map((d) => ({ id: d.id, naam: d.naam || d.id, ...(mapNaam(mapVan(`${profielId}::${d.id}`)) ? { map: mapNaam(mapVan(`${profielId}::${d.id}`)) } : {}) })),
      elementen: [...ids].map((id) => {
        const velden = (els[id].compartimenten || []).flatMap((c) => (c.velden || []).map((v) => v.naam)).filter(Boolean).slice(0, 30);
        const plek = plekken(id);
        return { id, type: els[id].elementType, naam: els[id].naam || "", diagrammen: opDiagrammen(id), ...(Object.keys(plek).length ? { plek } : {}), ...(velden.length ? { velden } : {}) };
      }),
      relaties,
    });
  }
  return uit;
}

/** Talen die de opdracht bij naam noemt (bv. "activiteitendiagram" → Activity). */
export function genoemdeTalen(opdracht, samenvattingen) {
  const t = String(opdracht || "").toLowerCase();
  const synoniemen = {
    activity: ["activiteitendiagram", "activiteitdiagram", "activity", " ad "],
    usecase: ["use case", "usecase", "use-case"],
    statemachine: ["toestandsdiagram", "state machine", "statemachine"],
    sequence: ["sequentiediagram", "sequencediagram", "sequence"],
    bpmn: ["bpmn", "procesmodel"],
    archimate: ["archimate"],
    erd: ["erd", "entity-relationship"],
  };
  return samenvattingen
    .filter((s) => {
      const sleutel = Object.keys(synoniemen).find((k) => s.id.toLowerCase().startsWith(k) || s.diagramTypeId.toLowerCase().startsWith(k));
      const woorden = [s.naam.toLowerCase(), ...(sleutel ? synoniemen[sleutel] : [])];
      return woorden.some((w) => w.trim().length > 2 && ` ${t} `.includes(w));
    })
    .map((s) => s.id);
}

/**
 * Opstel-acties → modus van diagramcore/layout/uitlijnen.js (dezelfde als de werkbalk Uitlijnen;
 * "boven-elkaar" = verticaal centreren, "naast-elkaar" = horizontaal centreren, zoals in EA).
 * "automatisch" = de kolommen-opstelling over het hele diagram.
 */
export const OPSTEL_ACTIES = {
  "naast-elkaar": "center-v",
  "boven-elkaar": "center-h",
  "verdeel-horizontaal": "distribute-h",
  "verdeel-verticaal": "distribute-v",
  links: "left",
  rechts: "right",
  boven: "top",
  onder: "bottom",
  automatisch: "automatisch",
};

/** Kanten voor een positie naast een ander element. */
export const KANTEN = ["rechts", "links", "onder", "boven"];

const SCHEMA_PLAN = {
  type: "object",
  additionalProperties: false,
  required: ["uitleg", "diagrammen", "elementen", "connectoren"],
  properties: {
    uitleg: { type: "string", description: "kort, in het Nederlands: wat je maakt of wijzigt en welke keuzes je deed" },
    diagrammen: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["sleutel"],
        properties: {
          sleutel: { type: "string" },
          taal: { type: "string", description: "profiel-id; alleen bij een nieuw diagram" },
          naam: { type: "string" },
          map: { type: "string", description: "naam van een (nieuwe) submap van de huidige map; leeg = de huidige map" },
          bestaand: { type: "string", description: "id van een bestaand diagram (dan geen taal/naam)" },
        },
      },
    },
    elementen: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          sleutel: { type: "string" },
          type: { type: "string" },
          naam: { type: "string" },
          diagram: { type: "string", description: "sleutel van het diagram waar het element op komt" },
          in: { type: "string", description: "sleutel of id van de container (systeemkader, partitie) waar het in ligt" },
          bestaand: { type: "string", description: "id van een bestaand element (hernoemen of op een diagram zetten)" },
          eigenschappen: { type: "object", additionalProperties: { type: "string" } },
          velden: {
            type: "array",
            description: "attributen (naam + type) of waarden (alleen naam) erbij",
            items: { type: "object", additionalProperties: false, required: ["naam"], properties: { naam: { type: "string" }, type: { type: "string" }, compartiment: { type: "string" } } },
          },
        },
      },
    },
    connectoren: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["type", "bron", "doel"],
        properties: {
          type: { type: "string" },
          bron: { type: "string" },
          doel: { type: "string" },
          naam: { type: "string" },
          diagram: { type: "string" },
          eigenschappen: { type: "object", additionalProperties: { type: "string" } },
        },
      },
    },
    opstelling: {
      type: "array",
      description: "uitlijnen of opstellen op een diagram",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["diagram", "actie"],
        properties: {
          diagram: { type: "string" },
          actie: { type: "string", description: `${Object.keys(OPSTEL_ACTIES).join(", ")}, of een layout van de taal` },
          elementen: { type: "array", items: { type: "string" } },
        },
      },
    },
    posities: {
      type: "array",
      description: "elementen verplaatsen: naar x/y, of naast een ander element",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["diagram", "element"],
        properties: {
          diagram: { type: "string" },
          element: { type: "string" },
          x: { type: "number" },
          y: { type: "number" },
          naast: { type: "string" },
          kant: { type: "string", enum: KANTEN },
          afstand: { type: "number" },
        },
      },
    },
    nietGedaan: {
      type: "array",
      description: "delen van de opdracht die je niet kunt uitvoeren, in korte zinnen",
      items: { type: "string" },
    },
    verbanden: {
      type: "array",
      description: "kruisverbanden tussen elementen in verschillende talen",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["van", "naar", "soort"],
        properties: { van: { type: "string" }, naar: { type: "string" }, soort: { type: "string" } },
      },
    },
    verwijderen: {
      type: "array",
      description: "ids van bestaande elementen of relaties die uit het model gaan (alleen als de opdracht dat vraagt)",
      items: { type: "string" },
    },
  },
};

/** Soorten kruisverband (koppelingen-matrix, koppelingenActivity TRACE_TYPEN). */
export const VERBAND_SOORTEN = ["komt voort uit", "heeft te maken met", "genereert", "realiseert"];

/** Eén taal in de prompt. */
function taalTekst(s) {
  const regels = [
    `## ${s.id} — ${s.naam}`,
    "Elementtypen:",
    ...s.elementen.map((e) => `- ${e.id}: ${e.label}${e.omschrijving ? ` — ${e.omschrijving}` : ""}${e.container ? ` (container: ${e.leden ? e.leden.join(", ") : "andere elementen"} kunnen erin liggen via \`in\`)` : ""}${e.uitwerking ? " (kan een uitwerking dragen: een diagram eronder via map)" : ""}${e.velden ? ` [velden: ${e.velden.map((v) => (v.soort === "waarde" ? `${v.id} (alleen naam)` : `${v.id} (naam + type)`)).join(", ")}]` : ""}${e.eigenschappen ? ` [eigenschappen: ${e.eigenschappen.join(", ")}]` : ""}`),
    "Relaties (bron → doel):",
    ...s.connectoren.map((c) => {
      const paren = s.paren?.[c.id];
      const regel = paren ? paren.map(([b, d]) => `${b} → ${d}`).join("; ") : c.regels.map((r) => `${r.bron.join("|")} → ${r.doel.join("|")}`).join("; ");
      return `- ${c.id}: ${c.label} — ${regel}${c.omschrijving ? ` (${c.omschrijving})` : ""}${c.eigenschappen ? ` [eigenschappen: ${c.eigenschappen.join(", ")}]` : ""}`;
    }),
  ];
  if (s.layouts?.length) regels.push(`Layouts (actie in \`opstelling\`): ${s.layouts.map((l) => `${l.id} (${l.label})`).join(", ")}`);
  if (s.aanwijzingen?.length) regels.push("Aanwijzingen:", ...s.aanwijzingen.map((a) => `- ${a}`));
  return regels.join("\n");
}

/**
 * Wat er al is, compact. `bestaand` per profiel: {profielId, diagrammen: [{id, naam}],
 * elementen: [{id, type, naam, diagrammen?: string[], in?: string}], relaties: [{id, type, bron, doel}]}.
 */
export function bestaandTekst(bestaand = [], { max = 200 } = {}) {
  const regels = [];
  let n = 0;
  for (const p of bestaand) {
    if (!p.diagrammen?.length && !p.elementen?.length) continue;
    regels.push(`[${p.profielId}]`);
    for (const d of p.diagrammen || []) regels.push(`  diagram ${d.id} "${d.naam}"${d.map ? ` (map ${d.map})` : ""}`);
    for (const e of p.elementen || []) {
      if (n++ >= max) { regels.push("  … (meer elementen weggelaten)"); break; }
      const op = (e.diagrammen || []).map((d) => {
        const p = e.plek?.[d];
        return p ? `${d} @ ${p[0]},${p[1]}${p.length > 2 ? ` (${p[2]}×${p[3]})` : ""}` : d;
      });
      regels.push(`  element ${e.id}: ${e.type} "${e.naam}"${op.length ? ` op ${op.join(", ")}` : ""}${e.in ? ` in ${e.in}` : ""}${e.velden?.length ? ` — velden: ${e.velden.join(", ")}` : ""}`);
    }
    for (const r of (p.relaties || []).slice(0, max)) regels.push(`  relatie ${r.id}: ${r.type} ${r.bron} → ${r.doel}`);
  }
  return regels.join("\n");
}

const PLAN_VORM =
  '{"uitleg": "…", ' +
  '"diagrammen": [{"sleutel": "d1", "taal": "<profiel-id>", "naam": "…", "map": ""}, {"sleutel": "d2", "bestaand": "<diagram-id>"}], ' +
  '"elementen": [{"sleutel": "u1", "type": "<elementtype-id>", "naam": "…", "diagram": "d1", "in": "<container>"}, {"bestaand": "<element-id>", "naam": "<nieuwe naam, optioneel>", "diagram": "d1", "in": "<container, optioneel>", "velden": [{"naam": "…", "type": "…"}]}], ' +
  '"connectoren": [{"type": "<relatietype-id>", "bron": "<sleutel of bestaand id>", "doel": "<sleutel of bestaand id>", "eigenschappen": {}}], ' +
  '"verbanden": [{"van": "<sleutel of id>", "naar": "<sleutel of id>", "soort": "realiseert"}], ' +
  '"opstelling": [{"diagram": "<diagram-id of sleutel>", "actie": "naast-elkaar", "elementen": ["<id of sleutel>"]}], ' +
  '"posities": [{"diagram": "<diagram-id of sleutel>", "element": "<id of sleutel>", "x": 400, "y": 200}, {"diagram": "…", "element": "…", "naast": "<id of sleutel>", "kant": "rechts", "afstand": 60}], ' +
  '"verwijderen": ["<id van een bestaand element of een bestaande relatie>"], ' +
  '"nietGedaan": ["<deel van de opdracht dat je niet kunt>"]}';

/**
 * Systeemprompt + vraag voor een opdracht in de map.
 * @param {Samenvatting[]} talen
 * @param {string} opdracht
 * @param {{mapNaam?: string, submappen?: string[], bestaand?: any[]}} [kontekst]
 */
export function vraagVoorOpdracht(talen, opdracht, { mapNaam = "", submappen = [], bestaand = [] } = {}) {
  const wat = bestaandTekst(bestaand);
  const systeem = [
    "Je bent de modelleerassistent van Omnium Studio. Je maakt of wijzigt modellen in een projectmap.",
    `Je werkt in de map "${mapNaam || "(hoofdmap)"}"${submappen.length ? `; submappen: ${submappen.map((m) => `"${m}"`).join(", ")}` : ""}.`,
    "Gebruik ALLEEN deze talen, en per taal ALLEEN deze typen en relaties:",
    ...talen.map(taalTekst),
    wat ? `WAT ER AL IS (verwijs met het id; maak het niet opnieuw):\n${wat}` : "De map is nog leeg.",
    "REGELS:",
    "- Een nieuw element krijgt een korte unieke `sleutel` (u1, a1, …) en komt op een diagram (`diagram`: sleutel van een diagram in `diagrammen`). Het diagram bepaalt de taal.",
    "- Verwijs naar iets dat al bestaat met zijn id (in `bron`, `doel`, `in`, `van`, `naar`, of als `bestaand`). Wil je een bestaand element op een nieuw diagram, of het hernoemen, zet het dan in `elementen` met `bestaand`.",
    "- Een relatie tussen bestaande elementen: alleen een connector met hun ids; geen nieuw diagram nodig.",
    "- Velden (attributen van een klasse, waarden van een enumeratie): `velden` op het element, nieuw of bestaand ({\"bestaand\": \"<id>\", \"velden\": [{\"naam\": \"…\", \"type\": \"…\"}]}); bij waarden alleen de naam. Bestaande velden niet opnieuw.",
    "- Iets in een container zetten (bv. een use case in een systeemkader): `in` met de sleutel of het id van de container — ook voor een bestaand element ({\"bestaand\": \"<id>\", \"in\": \"<container>\"}). Zeg in de uitleg alleen wat het plan echt doet.",
    "- Nieuwe diagrammen in een submap: zet `map` (naam); een bestaande submap met die naam wordt hergebruikt.",
    "- Een diagram onder een element hangen (bv. een activiteitendiagram onder een use case): zet `map` op de naam of het id van een element dat een uitwerking kan dragen — een bestaand element, of een nieuw element uit dit plan (zijn sleutel). Het diagram komt dan in de boom onder dat element.",
    "- Uitlijnen of opstellen: `opstelling` met het diagram (id of sleutel), een actie (naast-elkaar = op één rij, boven-elkaar = in één kolom, verdeel-horizontaal, verdeel-verticaal, links, rechts, boven, onder, automatisch = het hele diagram netjes opstellen, of een layout die de taal noemt, bv. hierarchisch) en de elementen (ids of sleutels; leeg = alle). \"Horizontaal uitlijnen\" = naast-elkaar (zelfde hoogte), \"verticaal uitlijnen\" = boven-elkaar (zelfde midden); verdelen alleen als om gelijke afstanden gevraagd wordt. Leden van een container schuiven mee.",
    "- Verplaatsen: `posities` met het diagram en het element, en óf `x`/`y` (linkerbovenhoek, in de coördinaten achter @ bij WAT ER AL IS), óf `naast` een ander element met `kant` (rechts, links, onder, boven) en eventueel `afstand` (standaard 60). Leden van een container schuiven mee.",
    "- Weghalen: `verwijderen` met ids van bestaande elementen of relaties — alleen als de opdracht dat vraagt. Een element verdwijnt met zijn relaties uit het model en van alle diagrammen; een relatie alleen zelf.",
    "- Wat je niet kunt: diagrammen of mappen weghalen, kleuren of lettertypen zetten, lijnen een eigen route geven, en maten van elementen kiezen. Zet zulke delen van de opdracht in `nietGedaan` (korte zinnen) en beweer in de uitleg nooit dat je iets doet wat niet in het plan staat.",
    "- Hangen modellen in verschillende talen samen (bv. een use case met een activiteitendiagram dat hem uitwerkt), leg dan een `verband` tussen twee elementen — geen diagrammen; bv. de eerste actie van het activiteitendiagram realiseert de use case (soort: " + VERBAND_SOORTEN.join(", ") + ").",
    "- Namen in de taal van de opdracht, zoals een analist ze zou schrijven. Maak niets wat niet uit de opdracht volgt. Geef relaties de richting die de taal voorschrijft.",
    "Antwoord uitsluitend met JSON in deze vorm (geen tekst eromheen; lege lijsten mogen):",
    PLAN_VORM,
  ].join("\n");
  return { systeem, vraag: `Opdracht:\n${opdracht}`, jsonSchema: SCHEMA_PLAN };
}

/** Bewerkbare compartimenten van een elementtype met naam-type-velden. */
export function veldCompartimenten(descriptor, elementType) {
  const et = (descriptor?.elementTypes || []).find((t) => t.id === elementType);
  const fts = new Map((descriptor?.fieldTypes || []).map((f) => [f.id, f]));
  // naam-type: attributen ("naam: type"); waarde: alleen een naam (enumeratiewaarden, literals —
  // melding #4, 16-10: "enum-waarden toevoegen via de assistent/MCP").
  return (et?.compartments || [])
    .filter((c) => !c.alleenWeergave && ["naam-type", "waarde"].includes(fts.get(c.fieldType)?.viewer) && !fts.get(c.fieldType)?.afgeleid)
    .map((c) => ({ id: c.id, label: c.label || c.id, fieldType: c.fieldType, soort: fts.get(c.fieldType).viewer === "waarde" ? "waarde" : "attribuut" }));
}

const SCHEMA_VELDEN = {
  type: "object",
  additionalProperties: false,
  required: ["uitleg", "compartiment", "velden"],
  properties: {
    uitleg: { type: "string" },
    compartiment: { type: "string", description: "id van het compartiment waar de velden in komen" },
    velden: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["naam"],
        properties: { naam: { type: "string" }, type: { type: "string" }, verplicht: { type: "boolean" } },
      },
    },
  },
};

/** Systeemprompt + schema voor velden bij één element. */
export function vraagVoorVelden(descriptor, element, opdracht) {
  const comps = veldCompartimenten(descriptor, element.elementType);
  const bestaand = (element.compartimenten || []).flatMap((c) => (c.velden || []).map((v) => `${c.compartmentType}: ${v.naam}${v.data?.typeLabel ? ` : ${v.data.typeLabel}` : ""}`));
  const systeem = [
    "Je bent de modelleerassistent van Omnium Studio. Je voegt velden toe aan één element.",
    `Element: "${element.naam || element.id}" (type ${element.elementType}).`,
    `Compartimenten (id): ${comps.map((c) => c.id).join(", ") || "geen"}.`,
    bestaand.length ? `Het heeft al: ${bestaand.join("; ")}. Voeg die niet opnieuw toe.` : "Het heeft nog geen velden.",
    "Neem namen en typen over zoals de gebruiker ze geeft (bv. 'tekst', 'int', 'string', 'datum'); verzin geen extra velden. " +
      "Antwoord uitsluitend met JSON in deze vorm (geen tekst eromheen):",
    '{"uitleg": "…", "compartiment": "<compartiment-id>", "velden": [{"naam": "…", "type": "…", "verplicht": false}]}',
  ].join("\n");
  return { systeem, vraag: `Opdracht:\n${opdracht}`, jsonSchema: SCHEMA_VELDEN };
}

/** JSON uit een antwoord (ook als het model er tekst of ```json omheen zette). */
export function leesAntwoord(tekst) {
  const t = String(tekst || "").trim();
  try { return JSON.parse(t); } catch { /* verder zoeken */ }
  const blok = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (blok) { try { return JSON.parse(blok[1]); } catch { /* verder */ } }
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch { /* geen JSON */ } }
  return null;
}

const tekst = (x) => String(x ?? "").trim();

/** Alleen de eigenschappen die het type kent, als tekst. */
function filterEigenschappen(waarden, toegestaan = []) {
  const uit = {};
  for (const [k, v] of Object.entries(waarden && typeof waarden === "object" ? waarden : {})) {
    if (toegestaan.includes(k) && v != null && tekst(v)) uit[k] = tekst(v);
  }
  return uit;
}

/**
 * Controleer een plan tegen de profielen en wat er al is (de regelset).
 *
 * `bestaand` zoals bij vraagVoorOpdracht (per profiel de elementen en diagrammen die de AI
 * mocht zien). Uit: een genormaliseerd plan waarin elke verwijzing is opgelost naar
 * `{nieuw: sleutel}` of `{id, profielId}`, plus `problemen` (weggelaten, met reden) en
 * `opmerkingen` (bijgestuurd, bv. een omgedraaide associatie).
 *
 * @param {any} antwoord
 * @param {Samenvatting[]} talen
 * @param {any[]} [bestaand]
 */
export function controleerPlan(antwoord, talen, bestaand = []) {
  const problemen = [];
  const opmerkingen = [];
  const taalVan = new Map(talen.map((s) => [s.id, s]));
  const typeIn = (s, id) => s.elementen.find((e) => e.id === id);

  // Wat er al is: id → {profielId, type, naam}; diagram-id → profielId.
  const bestaandEl = new Map();
  const bestaandDi = new Map();
  for (const p of bestaand) {
    for (const e of p.elementen || []) bestaandEl.set(e.id, { profielId: p.profielId, type: e.type, naam: e.naam });
    for (const d of p.diagrammen || []) bestaandDi.set(d.id, { profielId: p.profielId, naam: d.naam });
  }

  // 1. Diagrammen.
  const diagrammen = [];
  const diagramVan = new Map();
  for (const d of Array.isArray(antwoord?.diagrammen) ? antwoord.diagrammen : []) {
    const sleutel = tekst(d?.sleutel) || `d${diagrammen.length + 1}`;
    if (diagramVan.has(sleutel)) { problemen.push(`Diagram met dubbele sleutel ${sleutel} overgeslagen.`); continue; }
    if (d?.bestaand) {
      const b = bestaandDi.get(tekst(d.bestaand));
      if (!b) { problemen.push(`Diagram ${d.bestaand} bestaat niet (of valt buiten deze map); overgeslagen.`); continue; }
      const uit = { sleutel, profielId: b.profielId, bestaandId: tekst(d.bestaand), naam: b.naam };
      diagrammen.push(uit); diagramVan.set(sleutel, uit);
      continue;
    }
    const s = taalVan.get(tekst(d?.taal));
    if (!s) { problemen.push(`Taal "${d?.taal}" is niet gekozen of bestaat niet; diagram "${d?.naam || sleutel}" overgeslagen.`); continue; }
    const uit = { sleutel, profielId: s.id, naam: tekst(d.naam) || "Nieuw diagram", map: tekst(d.map) };
    diagrammen.push(uit); diagramVan.set(sleutel, uit);
  }

  /**
   * Een diagram-verwijzing: een sleutel uit het plan, of (zoals de AI het vaak doet) direct het
   * id van een bestaand diagram — dat wordt dan alsnog een plandiagram (melding #9).
   */
  const diagramOp = (ref) => {
    const r = tekst(ref);
    if (!r) return null;
    if (diagramVan.has(r)) return diagramVan.get(r);
    const b = bestaandDi.get(r);
    if (!b) return null;
    const uit = { sleutel: r, profielId: b.profielId, bestaandId: r, naam: b.naam };
    diagrammen.push(uit); diagramVan.set(r, uit);
    return uit;
  };
  /** Zonder diagram: het enige bestaande diagram in de map van een taal die het type kent. */
  const enigBestaand = (type) => {
    const kandidaten = [...bestaandDi].filter(([, b]) => typeIn(taalVan.get(b.profielId) || { elementen: [] }, type));
    return kandidaten.length === 1 ? diagramOp(kandidaten[0][0]) : null;
  };

  // 2. Elementen: nieuw (met sleutel) of bestaand (hernoemen / op een diagram zetten).
  const elementen = [];
  const hernoemd = [];
  const opDiagram = [];
  const lidVan = []; // bestaande elementen die in een container gaan
  const veldenBij = []; // velden erbij op bestaande elementen
  /** Velden uit het plan → {compartiment, fieldType, soort, velden:[{naam, type}]}; null als er niets (geldigs) is. */
  const veldenUitPlan = (ruw, s, type, naam) => {
    if (!Array.isArray(ruw) || !ruw.length) return null;
    const comps = (s?.elementen.find((x) => x.id === type)?.velden) || [];
    if (!comps.length) { problemen.push(`"${naam}" (${type}) heeft geen velden; ${ruw.length} veld(en) overgeslagen.`); return null; }
    const gevraagd = tekst(ruw.find((v) => v?.compartiment)?.compartiment);
    const comp = comps.find((c) => c.id === gevraagd) || comps[0];
    const velden = ruw.map((v) => ({ naam: tekst(typeof v === "string" ? v : v?.naam), type: comp.soort === "waarde" ? "" : tekst(v?.type) })).filter((v) => v.naam);
    return velden.length ? { compartiment: comp.id, fieldType: comp.fieldType, soort: comp.soort, velden } : null;
  };
  const nieuwVan = new Map(); // sleutel → element
  const ruw = Array.isArray(antwoord?.elementen) ? antwoord.elementen : [];
  for (const e of ruw) {
    if (e?.bestaand) {
      const id = tekst(e.bestaand);
      const b = bestaandEl.get(id);
      if (!b) { problemen.push(`Element ${id} bestaat niet (of valt buiten deze map); overgeslagen.`); continue; }
      if (tekst(e.naam) && tekst(e.naam) !== b.naam) hernoemd.push({ profielId: b.profielId, id, naam: tekst(e.naam), oud: b.naam });
      const dia = e.diagram ? diagramOp(e.diagram) : null;
      if (e.diagram && !dia) problemen.push(`Diagram ${e.diagram} voor ${b.naam} bestaat niet in het plan.`);
      else if (dia && dia.profielId !== b.profielId) problemen.push(`${b.naam} (${b.profielId}) kan niet op een ${dia.profielId}-diagram.`);
      else if (dia) opDiagram.push({ profielId: b.profielId, id, diagram: dia.sleutel });
      // Een bestaand element in een container zetten (melding #9: "zet test in systeem Omnium").
      if (tekst(e.in)) lidVan.push({ profielId: b.profielId, id, type: b.type, naam: b.naam, in: tekst(e.in) });
      // Velden erbij (melding #4: waarden aan een enumeratie).
      const vb = veldenUitPlan(e.velden, taalVan.get(b.profielId), b.type, b.naam);
      if (vb) veldenBij.push({ profielId: b.profielId, id, naam: b.naam, ...vb });
      continue;
    }
    const sleutel = tekst(e?.sleutel);
    if (!sleutel || nieuwVan.has(sleutel) || bestaandEl.has(sleutel)) { problemen.push(`Element zonder of met dubbele sleutel overgeslagen (${e?.naam || "?"}).`); continue; }
    let dia = e?.diagram ? diagramOp(e.diagram) : null;
    if (!dia) {
      // Geen (geldig) diagram: het enige diagram, of het eerste van een taal die het type kent,
      // of anders het enige bestaande diagram in de map waar het type past.
      dia = diagrammen.length === 1 ? diagrammen[0] : diagrammen.find((d) => typeIn(taalVan.get(d.profielId) || { elementen: [] }, e?.type)) || enigBestaand(e?.type);
    }
    if (!dia) { problemen.push(`"${e?.naam}" heeft geen diagram (en dus geen taal); overgeslagen.`); continue; }
    const s = taalVan.get(dia.profielId);
    const et = s && typeIn(s, e?.type);
    if (!et) { problemen.push(`Type "${e?.type}" bestaat niet in ${s?.naam || dia.profielId}; "${e?.naam}" overgeslagen.`); continue; }
    const vn = veldenUitPlan(e?.velden, s, et.id, tekst(e.naam));
    const uit = { sleutel, profielId: dia.profielId, type: et.id, naam: tekst(e.naam), diagram: dia.sleutel, in: tekst(e.in), data: filterEigenschappen(e.eigenschappen, et.eigenschappen), ...(vn ? { velden: vn } : {}) };
    elementen.push(uit); nieuwVan.set(sleutel, uit);
  }

  /** Verwijzing → {nieuw, profielId, type} of {id, profielId, type}; null als onbekend. */
  const los = (ref) => {
    const r = tekst(ref);
    if (nieuwVan.has(r)) { const e = nieuwVan.get(r); return { nieuw: r, profielId: e.profielId, type: e.type, naam: e.naam }; }
    if (bestaandEl.has(r)) { const e = bestaandEl.get(r); return { id: r, profielId: e.profielId, type: e.type, naam: e.naam }; }
    return null;
  };

  // Een relatie van het lidmaatschapstype ("bevat") is lidmaatschap: doel ligt in bron.
  const lidmaatschapType = (profielId) => new Set((taalVan.get(profielId)?.elementen || []).map((x) => x.container).filter(Boolean));
  const overig = [];
  for (const c of Array.isArray(antwoord?.connectoren) ? antwoord.connectoren : []) {
    const doel = los(c?.doel);
    if (!doel || !lidmaatschapType(doel.profielId).has(c?.type)) { overig.push(c); continue; }
    if (doel.nieuw) { const e = nieuwVan.get(doel.nieuw); if (!e.in) e.in = tekst(c.bron); }
    else if (!lidVan.some((l) => l.id === doel.id)) lidVan.push({ profielId: doel.profielId, id: doel.id, type: doel.type, naam: doel.naam, in: tekst(c.bron) });
  }

  // Lidmaatschap (in): de container moet in dezelfde taal een container zijn.
  const lidFout = (naam, ref, type, ct, s) =>
    `"${naam}" kan niet in ${ref} liggen (${ct?.container ? `een ${type} hoort niet in een ${ct.id}` : `geen container in ${s?.naam}`}); los geplaatst.`;
  const leden = [];
  for (const l of lidVan) {
    const c = los(l.in);
    const s = taalVan.get(l.profielId);
    const ct = c && s && typeIn(s, c.type);
    if (!c || c.profielId !== l.profielId || !ct?.container || (ct.leden && !ct.leden.includes(l.type))) { problemen.push(lidFout(l.naam, l.in, l.type, ct, s)); continue; }
    if ((c.nieuw ?? c.id) === l.id) continue;
    leden.push({ profielId: l.profielId, id: l.id, in: c.nieuw ? { nieuw: c.nieuw } : { id: c.id } });
  }
  for (const e of elementen) {
    if (!e.in) continue;
    const c = los(e.in);
    const s = taalVan.get(e.profielId);
    const ct = c && s && typeIn(s, c.type);
    if (!c || c.profielId !== e.profielId || !ct?.container || (ct.leden && !ct.leden.includes(e.type))) {
      problemen.push(lidFout(e.naam, e.in, e.type, ct, s));
      e.in = "";
    } else {
      e.in = c.nieuw ? { nieuw: c.nieuw } : { id: c.id };
    }
  }

  // 3. Connectoren: type in de taal van de uiteinden, regels, voorkeursparen, geen dubbele.
  const connectoren = [];
  const gezien = new Set();
  for (const c of overig) {
    let bron = los(c?.bron), doel = los(c?.doel);
    if (!bron || !doel) { problemen.push(`${c?.type || "Relatie"} tussen onbekende elementen (${c?.bron} → ${c?.doel}) overgeslagen.`); continue; }
    if (bron.profielId !== doel.profielId) { problemen.push(`${c.type} tussen twee talen (${bron.naam} → ${doel.naam}) kan niet; gebruik een verband.`); continue; }
    const s = taalVan.get(bron.profielId);
    const ct = s?.connectoren.find((x) => x.id === c.type);
    if (!ct) { problemen.push(`Relatietype "${c?.type}" bestaat niet in ${s?.naam || bron.profielId}; overgeslagen.`); continue; }
    if ((bron.nieuw ?? bron.id) === (doel.nieuw ?? doel.id)) { problemen.push(`${ct.label} van "${bron.naam}" naar zichzelf overgeslagen.`); continue; }
    const paren = s.paren?.[ct.id];
    if (paren) {
      const past = (b, d) => paren.some(([pb, pd]) => pb === b.type && pd === d.type);
      if (!past(bron, doel)) {
        if (past(doel, bron)) {
          opmerkingen.push(`${ct.label} "${bron.naam}" → "${doel.naam}" omgedraaid (${paren.map((p) => p.join(" → ")).join(", ")}).`);
          [bron, doel] = [doel, bron];
        } else {
          problemen.push(`${ct.label} tussen ${bron.type} en ${doel.type} ("${bron.naam}" → "${doel.naam}") hoort niet in ${s.naam}; overgeslagen.`);
          continue;
        }
      }
    }
    if (!ct.regels.some((r) => r.bron.includes(bron.type) && r.doel.includes(doel.type))) {
      problemen.push(`${ct.label} van ${bron.type} naar ${doel.type} mag niet in ${s.naam}; overgeslagen.`);
      continue;
    }
    const sleutel = `${ct.id}|${bron.nieuw ?? bron.id}|${doel.nieuw ?? doel.id}`;
    if (gezien.has(sleutel)) continue;
    gezien.add(sleutel);
    const dia = c.diagram ? diagramOp(c.diagram) : null;
    connectoren.push({
      profielId: s.id,
      type: ct.id,
      bron: bron.nieuw ? { nieuw: bron.nieuw } : { id: bron.id },
      doel: doel.nieuw ? { nieuw: doel.nieuw } : { id: doel.id },
      naam: tekst(c.naam),
      data: filterEigenschappen(c.eigenschappen, ct.eigenschappen),
      ...(dia && dia.profielId === s.id ? { diagram: dia.sleutel } : {}),
    });
  }

  // 4. Kruisverbanden tussen talen. Een verband ligt tussen elementen; noemt de AI een diagram
  // ("het activiteitendiagram realiseert de use case"), dan het eerste element erop dat geen
  // begin/eind is (een vast element) — met een opmerking.
  const hoofdelement = (ref) => {
    const r = tekst(ref);
    const d = diagramVan.get(r) || (bestaandDi.has(r) ? { bestaandId: r, profielId: bestaandDi.get(r).profielId, naam: bestaandDi.get(r).naam } : null);
    if (!d) return null;
    const s = taalVan.get(d.profielId);
    const vast = (type) => !!s && !!typeIn(s, type)?.vast;
    const nieuw = elementen.filter((e) => e.diagram === (d.sleutel ?? r));
    const kandidaat = nieuw.find((e) => !vast(e.type)) || nieuw[0];
    if (kandidaat) return { ref: kandidaat.sleutel, naam: d.naam, element: kandidaat.naam };
    const p = bestaand.find((b) => b.profielId === d.profielId);
    const op = (p?.elementen || []).filter((e) => e.diagrammen?.includes(d.bestaandId));
    const b = op.find((e) => !vast(e.type)) || op[0];
    return b ? { ref: b.id, naam: d.naam, element: b.naam } : null;
  };
  const losVerband = (ref) => {
    const r = los(ref);
    if (r) return r;
    const h = hoofdelement(ref);
    if (!h) return null;
    opmerkingen.push(`Verband met diagram "${h.naam}" gelegd op "${h.element}".`);
    return los(h.ref);
  };
  const verbanden = [];
  for (const v of Array.isArray(antwoord?.verbanden) ? antwoord.verbanden : []) {
    const van = losVerband(v?.van), naar = losVerband(v?.naar);
    if (!van || !naar) { problemen.push(`Verband ${v?.van} → ${v?.naar} tussen onbekende elementen overgeslagen.`); continue; }
    const soort = VERBAND_SOORTEN.includes(tekst(v.soort)) ? tekst(v.soort) : "heeft te maken met";
    verbanden.push({ van: van.nieuw ? { nieuw: van.nieuw } : { id: van.id }, naar: naar.nieuw ? { nieuw: naar.nieuw } : { id: naar.id }, vanProfiel: van.profielId, naarProfiel: naar.profielId, soort });
  }

  // 5. Opstelling (uitlijnen) op een diagram.
  const opstelling = [];
  for (const o of Array.isArray(antwoord?.opstelling) ? antwoord.opstelling : []) {
    const dia = diagramOp(o?.diagram) || (diagrammen.length === 1 ? diagrammen[0] : null) || (bestaandDi.size === 1 ? diagramOp([...bestaandDi.keys()][0]) : null);
    if (!dia) { problemen.push(`Opstelling op onbekend diagram ${o?.diagram || "?"} overgeslagen.`); continue; }
    // Een layout van de taal (bv. hierarchisch) heet "layout:<id>" in de wijziging.
    const layouts = taalVan.get(dia.profielId)?.layouts || [];
    const modus = OPSTEL_ACTIES[tekst(o?.actie)] || (layouts.some((l) => l.id === tekst(o?.actie)) ? `layout:${tekst(o?.actie)}` : null);
    if (!modus) { problemen.push(`Opstel-actie "${o?.actie}" bestaat niet voor deze taal (wel: ${[...Object.keys(OPSTEL_ACTIES), ...layouts.map((l) => l.id)].join(", ")}).`); continue; }
    const els = [];
    for (const ref of Array.isArray(o.elementen) ? o.elementen : []) {
      const e = los(ref);
      if (!e || e.profielId !== dia.profielId) { problemen.push(`${ref} staat niet op diagram "${dia.naam}"; niet uitgelijnd.`); continue; }
      els.push(e.nieuw ? { nieuw: e.nieuw } : { id: e.id });
    }
    if (modus !== "automatisch" && !modus.startsWith("layout:") && els.length === 1) { problemen.push(`Uitlijnen met één element (${o.elementen[0]}) doet niets.`); continue; }
    opstelling.push({ diagram: dia.sleutel, profielId: dia.profielId, actie: tekst(o.actie), modus, elementen: els });
  }

  // 5b. Posities (18-10, Mark): een element naar x/y, of naast een ander element.
  const posities = [];
  for (const p of Array.isArray(antwoord?.posities) ? antwoord.posities : []) {
    const dia = diagramOp(p?.diagram) || (diagrammen.length === 1 ? diagrammen[0] : null) || (bestaandDi.size === 1 ? diagramOp([...bestaandDi.keys()][0]) : null);
    if (!dia) { problemen.push(`Positie op onbekend diagram ${p?.diagram || "?"} overgeslagen.`); continue; }
    const e = los(p?.element);
    if (!e || e.profielId !== dia.profielId) { problemen.push(`${p?.element || "?"} staat niet op diagram "${dia.naam}"; niet verplaatst.`); continue; }
    const element = e.nieuw ? { nieuw: e.nieuw } : { id: e.id };
    const x = Number(p.x), y = Number(p.y);
    if (p.x != null && p.y != null && Number.isFinite(x) && Number.isFinite(y)) {
      posities.push({ diagram: dia.sleutel, profielId: dia.profielId, element, x: Math.round(x), y: Math.round(y) });
      continue;
    }
    const n = p?.naast != null ? los(p.naast) : null;
    if (!n || n.profielId !== dia.profielId) { problemen.push(`Positie van ${e.naam || p.element}: geef x en y, of naast een element op hetzelfde diagram; niet verplaatst.`); continue; }
    const kant = KANTEN.includes(tekst(p.kant)) ? tekst(p.kant) : "rechts";
    const afstand = Number.isFinite(Number(p.afstand)) ? Math.max(0, Math.min(800, Math.round(Number(p.afstand)))) : 60;
    posities.push({ diagram: dia.sleutel, profielId: dia.profielId, element, naast: n.nieuw ? { nieuw: n.nieuw } : { id: n.id }, kant, afstand });
  }
  // Wat de AI zelf zegt niet te kunnen; de Studio en de MCP tonen het apart.
  const nietGedaan = (Array.isArray(antwoord?.nietGedaan) ? antwoord.nietGedaan : []).map(tekst).filter(Boolean).slice(0, 10);

  // 6. Weghalen (AI-2 stap 2, 16-10): alleen bestaande elementen en relaties, op id; nooit iets
  // uit dit plan. Een relatie naar iets dat weggaat, vervalt.
  const bestaandRel = new Map();
  for (const p of bestaand) for (const r of p.relaties || []) bestaandRel.set(r.id, { profielId: p.profielId, type: r.type });
  const verwijderen = [];
  const wegIds = new Set();
  for (const ref of Array.isArray(antwoord?.verwijderen) ? antwoord.verwijderen : []) {
    const id = tekst(typeof ref === "object" && ref ? ref.id : ref);
    if (!id || wegIds.has(id)) continue;
    if (bestaandEl.has(id)) {
      const b = bestaandEl.get(id);
      verwijderen.push({ profielId: b.profielId, id, naam: b.naam, type: b.type, soort: "element" });
      wegIds.add(id);
    } else if (bestaandRel.has(id)) {
      const r = bestaandRel.get(id);
      verwijderen.push({ profielId: r.profielId, id, naam: "", type: r.type, soort: "relatie" });
      wegIds.add(id);
    } else {
      problemen.push(`${id} bestaat niet (of valt buiten deze map); niet weggehaald.`);
    }
  }
  const connectorenNa = connectoren.filter((c) => {
    const raakt = wegIds.has(c.bron.id) || wegIds.has(c.doel.id);
    if (raakt) problemen.push(`${c.type} naar een element dat weggaat is overgeslagen.`);
    return !raakt;
  });

  // Een nieuw diagram zonder iets erop is niets.
  const gebruikt = new Set([...elementen.map((e) => e.diagram), ...opDiagram.map((o) => o.diagram), ...connectorenNa.map((c) => c.diagram).filter(Boolean), ...opstelling.map((o) => o.diagram), ...posities.map((p) => p.diagram)]);
  const leeg = diagrammen.filter((d) => !d.bestaandId && !gebruikt.has(d.sleutel));
  for (const d of leeg) problemen.push(`Diagram "${d.naam}" blijft leeg; niet gemaakt.`);

  return {
    uitleg: tekst(antwoord?.uitleg),
    diagrammen: diagrammen.filter((d) => !leeg.includes(d)),
    elementen,
    hernoemd,
    veldenBij,
    opDiagram,
    leden,
    opstelling,
    posities,
    connectoren: connectorenNa,
    verbanden,
    verwijderen,
    nietGedaan,
    problemen,
    opmerkingen,
  };
}

/** Velden-antwoord → nieuwe compartimenten voor het element (bestaande namen worden niet verdubbeld). */
export function veldenToepassing(antwoord, descriptor, element) {
  const comps = veldCompartimenten(descriptor, element.elementType);
  const problemen = [];
  if (!comps.length) return { compartimenten: null, nieuw: [], problemen: ["Dit element heeft geen compartiment voor velden."], uitleg: "" };
  const doel = comps.find((c) => c.id === antwoord?.compartiment) || comps[0];
  if (antwoord?.compartiment && antwoord.compartiment !== doel.id) problemen.push(`Compartiment "${antwoord.compartiment}" bestaat niet; ${doel.id} gebruikt.`);
  const oud = (element.compartimenten || []).find((c) => c.compartmentType === doel.id);
  const namen = new Set((oud?.velden || []).map((v) => String(v.naam).toLowerCase()));
  const nieuw = [];
  for (const v of Array.isArray(antwoord?.velden) ? antwoord.velden : []) {
    const naam = String(v?.naam || "").trim();
    if (!naam) continue;
    if (namen.has(naam.toLowerCase())) { problemen.push(`"${naam}" bestaat al; overgeslagen.`); continue; }
    namen.add(naam.toLowerCase());
    nieuw.push({ naam, fieldType: doel.fieldType, data: doel.soort === "waarde" ? {} : { ...(v.type ? { typeLabel: String(v.type).trim() } : {}), ...(v.verplicht ? { verplicht: true } : {}) } });
  }
  const compartimenten = (element.compartimenten || []).some((c) => c.compartmentType === doel.id)
    ? element.compartimenten.map((c) => (c.compartmentType === doel.id ? { ...c, velden: [...(c.velden || []), ...nieuw] } : c))
    : [...(element.compartimenten || []), { compartmentType: doel.id, velden: nieuw }];
  return { compartimenten, nieuw, compartiment: doel.id, problemen, uitleg: String(antwoord?.uitleg || "").trim() };
}
