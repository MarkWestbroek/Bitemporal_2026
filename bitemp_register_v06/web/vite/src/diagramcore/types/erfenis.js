// @ts-check
/**
 * erfenis — overerving en abstracte typen in het M3 (`ElementType.erft`,
 * `ElementType.isAbstract`), uitgevlakt bij registratie.
 *
 * Afspraak (M3-MOF + EA-SYNC, 2026-10-08; MOF_VERGELIJKING §5.1, onderzoek
 * Sparx EA-sync §6.6): dit is EMOF Class.superClass (één ouder, voorlopig) +
 * Class.isAbstract. Eén plek vlakt uit — `normaliseerErfenis` — zodat alle
 * consumenten (canvas, inspector, taakbalk, browser, adapters) alleen
 * volledige, concrete ElementTypes zien. De hiërarchie blijft op de
 * descriptor staan (`erft`, `isAbstract`, `_geerfd`, `_voorExpansie`) voor de
 * profiel-ontwerper en de EMOF/XMI-projectie.
 *
 * Regels:
 * - scalars en objecten: het kind wint; wat het kind niet zet, komt van de
 *   ouder (niet: id, label, kort, omschrijving, erft, isAbstract);
 * - `compartments` (op id) en `properties` (op key): ouder eerst, kind
 *   overschrijft dezelfde id/key en voegt de rest toe;
 * - `hooks` en `edgePresentatie`: per sleutel, kind wint;
 * - `bron`/`doel`/`verbindingsregels`: geërfd als het kind er geen heeft;
 * - `isConnector` erft mee en mag niet omslaan;
 * - bereik-expansie: elke lijst van elementtype-ids (bron/doel, regels,
 *   randElement.ouderTypes, afbakeningVoor, overbrugt, shapeSets) wordt de
 *   lijst van **concrete** afstammelingen van elk genoemd type (een abstract
 *   type telt niet zelf mee). Daarna hoeft niemand meer te weten dat
 *   {Representatie} bestond.
 *
 * Werkt in place (de activiteiten houden het descriptor-object zelf vast) en
 * is idempotent (`dt._erfenisGenormaliseerd`).
 */

/** Sleutels die een kind nooit van zijn ouder overneemt. */
const NIET_ERVEN = new Set(["id", "label", "kort", "omschrijving", "erft", "isAbstract"]);

/**
 * @param {import("./schema.js").DiagramType} dt
 * @returns {string[]} fouten (leeg = ok); bij fouten in de hiërarchie wordt niet uitgevlakt
 */
export function normaliseerErfenis(dt) {
  const fouten = [];
  const types = Array.isArray(dt?.elementTypes) ? dt.elementTypes.filter((et) => et && et.id) : [];
  if (!types.length) return fouten;
  const perId = new Map(types.map((et) => [et.id, et]));
  const ctx = (et) => `DiagramType "${dt.id}", ElementType "${et.id}"`;

  // ── Controles op de hiërarchie ───────────────────────────────────────
  for (const et of types) {
    if (et.erft == null) continue;
    if (et.erft === et.id) fouten.push(`${ctx(et)}: erft van zichzelf`);
    else if (!perId.has(et.erft)) fouten.push(`${ctx(et)}: erft van onbekend ElementType "${et.erft}"`);
  }
  for (const et of types) {
    const gezien = new Set([et.id]);
    let cursor = et;
    while (cursor?.erft != null && perId.has(cursor.erft)) {
      if (gezien.has(cursor.erft)) {
        fouten.push(`${ctx(et)}: cyclische overerving via "${cursor.erft}"`);
        break;
      }
      gezien.add(cursor.erft);
      cursor = perId.get(cursor.erft);
    }
  }
  for (const et of types) {
    const ouder = et.erft != null ? perId.get(et.erft) : null;
    if (ouder && et.isConnector != null && !!et.isConnector !== !!ouder.isConnector) {
      fouten.push(`${ctx(et)}: isConnector mag niet omslaan t.o.v. ouder "${ouder.id}"`);
    }
  }
  if (fouten.length) return fouten;

  // ── Uitvlakken (ouder vóór kind), eenmalig ───────────────────────────
  if (!dt._erfenisGenormaliseerd) {
    const klaar = new Set();
    const vlak = (et) => {
      if (klaar.has(et.id)) return;
      klaar.add(et.id);
      if (et.erft == null) return;
      const ouder = perId.get(et.erft);
      vlak(ouder);
      erfVan(et, ouder);
    };
    for (const et of types) vlak(et);
  }

  // ── Bereik-expansie (idempotent via _voorExpansie) ───────────────────
  const kinderen = new Map();
  for (const et of types) {
    if (et.erft == null) continue;
    if (!kinderen.has(et.erft)) kinderen.set(et.erft, []);
    kinderen.get(et.erft).push(et.id);
  }
  const concreet = (id, gezien = new Set()) => {
    if (gezien.has(id)) return [];
    gezien.add(id);
    const et = perId.get(id);
    if (!et) return [id]; // onbekend: laat de validatie het melden
    const uit = et.isAbstract ? [] : [id];
    for (const kind of kinderen.get(id) || []) uit.push(...concreet(kind, gezien));
    return uit;
  };
  const expandeer = (lijst) => {
    const uit = [];
    for (const id of lijst || []) for (const c of concreet(id)) if (!uit.includes(c)) uit.push(c);
    return uit;
  };
  const expandeerEindpunt = (eindpunt) => {
    if (!eindpunt) return;
    if (Array.isArray(eindpunt)) return; // kale lijst: door de aanroeper
    const bron = eindpunt._voorExpansie || eindpunt.elementTypes || [];
    eindpunt._voorExpansie = bron;
    eindpunt.elementTypes = expandeer(bron);
  };
  for (const et of types) {
    expandeerEindpunt(et.bron);
    expandeerEindpunt(et.doel);
    for (const r of et.verbindingsregels || []) {
      for (const kant of ["bron", "doel"]) {
        if (Array.isArray(r[kant])) {
          const bron = r[`_${kant}VoorExpansie`] || r[kant];
          r[`_${kant}VoorExpansie`] = bron;
          r[kant] = expandeer(bron);
        } else expandeerEindpunt(r[kant]);
      }
    }
    if (et.randElement?.ouderTypes) {
      const bron = et.randElement._ouderTypesVoorExpansie || et.randElement.ouderTypes;
      et.randElement._ouderTypesVoorExpansie = bron;
      et.randElement.ouderTypes = expandeer(bron);
    }
    for (const sleutel of ["afbakeningVoor", "overbrugt"]) {
      if (!Array.isArray(et[sleutel])) continue;
      const bron = et[`_${sleutel}VoorExpansie`] || et[sleutel];
      et[`_${sleutel}VoorExpansie`] = bron;
      et[sleutel] = expandeer(bron);
    }
  }
  // Connectortype-lijsten die de motor met === tegen el.elementType legt:
  // DiagramType.hierarchie, samentrekking.relatieTypes, opname.relatieTypes.
  if (dt.hierarchie != null) {
    const bron = dt._hierarchieVoorExpansie ?? dt.hierarchie;
    dt._hierarchieVoorExpansie = bron;
    const uit = [];
    for (const h of [].concat(bron)) {
      if (typeof h === "string") uit.push(...expandeer([h]));
      else if (h && typeof h === "object" && h.type) for (const c of expandeer([h.type])) uit.push({ ...h, type: c });
      else uit.push(h);
    }
    dt.hierarchie = typeof bron === "string" && uit.length === 1 && typeof uit[0] === "string" ? uit[0] : uit;
  }
  for (const et of types) {
    for (const sleutel of ["samentrekking", "opname"]) {
      const obj = et[sleutel];
      if (!obj || !Array.isArray(obj.relatieTypes)) continue;
      const bron = obj._relatieTypesVoorExpansie || obj.relatieTypes;
      obj._relatieTypesVoorExpansie = bron;
      obj.relatieTypes = expandeer(bron);
    }
    // Eén id, geen lijst: een container-relatie moet een concreet connectortype zijn.
    if (et.containerVoor && perId.get(et.containerVoor)?.isAbstract) {
      fouten.push(`${ctx(et)}: containerVoor "${et.containerVoor}" is abstract; kies een concreet connectortype`);
    }
  }
  // Shape-sets: een gedaante voor een abstract type geldt voor zijn afstammelingen.
  for (const set of dt.shapeSets || []) {
    const shapes = set?.shapes || {};
    for (const [id, shapeId] of Object.entries(shapes)) {
      if (!perId.get(id)?.isAbstract) continue;
      for (const c of concreet(id)) if (!(c in shapes)) shapes[c] = shapeId;
    }
  }
  dt._erfenisGenormaliseerd = true;
  return fouten;
}

/** Vlak één kind uit met zijn (al uitgevlakte) ouder. */
function erfVan(kind, ouder) {
  const geerfd = { compartments: [], properties: [] };
  // Verbindingsregels: `bron` en `doel` erven per kant (een kind mag alleen
  // zijn bron vernauwen); `verbindingsregels` als geheel, en alleen als het
  // kind zelf geen bron/doel/regels heeft.
  const heeftEigenRegels = kind.verbindingsregels != null;
  for (const [k, v] of Object.entries(ouder)) {
    if (NIET_ERVEN.has(k) || k.startsWith("_")) continue;
    if (k === "compartments" || k === "properties") continue;
    if (k === "hooks" || k === "edgePresentatie") {
      kind[k] = { ...(v || {}), ...(kind[k] || {}) };
      continue;
    }
    if (k === "bron" || k === "doel") {
      if (!heeftEigenRegels && kind[k] == null) kind[k] = kloon(v);
      continue;
    }
    if (k === "verbindingsregels") {
      if (!heeftEigenRegels && kind.bron == null && kind.doel == null) kind[k] = kloon(v);
      continue;
    }
    if (kind[k] === undefined) kind[k] = kloon(v);
  }
  const eigenComp = new Set((kind.compartments || []).map((c) => c?.id));
  const eigenProp = new Set((kind.properties || []).map((p) => p?.key));
  const compOuder = (ouder.compartments || []).filter((c) => !eigenComp.has(c?.id));
  const propOuder = (ouder.properties || []).filter((p) => !eigenProp.has(p?.key));
  geerfd.compartments = compOuder.map((c) => c.id);
  geerfd.properties = propOuder.map((p) => p.key);
  if (compOuder.length || kind.compartments) kind.compartments = [...compOuder, ...(kind.compartments || [])];
  if (propOuder.length || kind.properties) kind.properties = [...propOuder, ...(kind.properties || [])];
  // Ook wat de ouder zelf al geërfd had, telt voor het kind als geërfd.
  for (const c of ouder._geerfd?.compartments || []) if (!eigenComp.has(c) && !geerfd.compartments.includes(c)) geerfd.compartments.push(c);
  for (const p of ouder._geerfd?.properties || []) if (!eigenProp.has(p) && !geerfd.properties.includes(p)) geerfd.properties.push(p);
  kind._geerfd = geerfd;
}

/**
 * Diepe kopie voor gewone data (geen functies — hooks worden apart
 * samengevoegd). Motor-interne `_`-sleutels (`_voorExpansie`, `_geerfd`)
 * gaan niet mee: een al geëxpandeerde ouder kopieert ze zo nooit in een kind.
 */
function kloon(v) {
  if (Array.isArray(v)) return v.map(kloon);
  if (v && typeof v === "object") {
    return Object.fromEntries(Object.entries(v).filter(([k]) => !k.startsWith("_")).map(([k, x]) => [k, kloon(x)]));
  }
  return v;
}

/**
 * Oppervlakkige kopie van een descriptor waarop `normaliseerErfenis` veilig
 * kan werken zonder het origineel te raken (voor validatie van een rauwe
 * descriptor). Hooks (functies) worden gedeeld, data-delen gekopieerd.
 * @param {import("./schema.js").DiagramType} dt
 */
export function kopieVoorNormalisatie(dt) {
  if (!dt || typeof dt !== "object") return dt;
  const { _erfenisGenormaliseerd, _hierarchieVoorExpansie, ...rest } = dt;
  return {
    ...rest,
    elementTypes: Array.isArray(dt.elementTypes)
      ? dt.elementTypes.map((et) => {
          if (!et || typeof et !== "object") return et;
          const k = { ...et };
          for (const s of ["bron", "doel", "verbindingsregels", "randElement", "afbakeningVoor", "overbrugt", "compartments", "properties", "edgePresentatie", "samentrekking", "opname"]) {
            if (k[s] !== undefined) k[s] = kloon(k[s]);
          }
          if (k.hooks) k.hooks = { ...k.hooks };
          delete k._geerfd;
          return k;
        })
      : dt.elementTypes,
    ...(Array.isArray(dt.shapeSets) ? { shapeSets: kloon(dt.shapeSets) } : {}),
    ...(dt.hierarchie != null ? { hierarchie: kloon(dt.hierarchie) } : {}),
  };
}

/**
 * De concrete elementtypen waar een (abstract of concreet) type voor staat,
 * ná normalisatie. Handig voor lezers/adapters die een abstract type als
 * bereik willen gebruiken.
 * @param {import("./schema.js").DiagramType} dt
 * @param {string} id
 */
export function concreteTypenVan(dt, id) {
  const perId = new Map((dt?.elementTypes || []).map((et) => [et.id, et]));
  const uit = [];
  const loop = (x, gezien) => {
    if (gezien.has(x)) return;
    gezien.add(x);
    const et = perId.get(x);
    if (!et) return;
    if (!et.isAbstract) uit.push(x);
    for (const k of dt.elementTypes) if (k.erft === x) loop(k.id, gezien);
  };
  loop(id, new Set());
  return uit;
}
