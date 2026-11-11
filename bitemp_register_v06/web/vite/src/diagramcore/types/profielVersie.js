// @ts-check
/**
 * profielVersie — de versie van een profiel (M2) en de notitie daarvan in een project (M1).
 *
 * Een model (M1) leunt op zijn profiel (M2): de elementtypen, hun eigenschappen en de
 * verbindingsregels bepalen wat het model betekent. De profielen zitten vast in de Studio, dus
 * een project dat met een nieuwere Studio is bewaard kan typen of eigenschappen hebben die een
 * oudere Studio niet kent (Mark, 11-11: "zoals een Word-document met fonts die niet op je
 * computer staan"). Daarom:
 *
 *  1. elk profiel heeft een eigen `versie` (DiagramType.versie, semver; zie schema.js);
 *  2. het project noteert per gebruikt profiel de versie waarmee het is bewaard
 *     (`profielVersies` in het werkbestand, naast `profielen`);
 *  3. bij het openen vergelijkt de Studio die notitie met wat hij zelf heeft.
 *
 * Verwijzen, niet insluiten: het project bevat geen kopie van het profiel. Een profiel is ook
 * code (hooks, adapters), en kopieën per project lopen uit elkaar.
 *
 * Wanneer verhoog je de versie van een profiel?
 *  - **major**: bestaande modellen veranderen van betekenis of hebben een migratie nodig
 *    (type weg of hernoemd, eigenschap weg, verbindingsregel strenger);
 *  - **minor**: uitbreiding (nieuw type, nieuwe eigenschap, ruimere verbindingsregel). Een
 *    oudere Studio kent dat niet en kan het bij het bewaren kwijtraken;
 *  - **patch**: alleen weergave of uitleg (labels, kleuren, vormen, layout).
 * `profielVingerafdruk` bewaakt dit: de test in render-svc faalt als de structuur van een profiel
 * verandert terwijl zijn versie gelijk blijft (render-svc/profielVersies.vast.json).
 *
 * Zuiver: geen stores, geen React.
 */

export const STANDAARD_PROFIELVERSIE = "1.0.0";

const VERSIE_RE = /^(\d+)\.(\d+)\.(\d+)$/;

/** @param {any} v @returns {boolean} "1.2.3" */
export function isProfielVersie(v) {
  return typeof v === "string" && VERSIE_RE.test(v);
}

/** @param {string} v @returns {[number, number, number]|null} */
function delen(v) {
  const m = typeof v === "string" ? VERSIE_RE.exec(v) : null;
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/**
 * @param {string} a @param {string} b
 * @returns {number} <0 als a ouder is dan b, 0 gelijk, >0 nieuwer; een ongeldige versie telt als oudste
 */
export function vergelijkVersies(a, b) {
  const x = delen(a) || [-1, -1, -1];
  const y = delen(b) || [-1, -1, -1];
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
}

/** De versie van een descriptor (zonder eigen versie: de standaard). @param {any} descriptor */
export function versieVan(descriptor) {
  return isProfielVersie(descriptor?.versie) ? descriptor.versie : STANDAARD_PROFIELVERSIE;
}

/**
 * Wat het project noteert bij het bewaren: per profiel met inhoud de versie van deze Studio.
 * Was het project met een nieuwere versie bewaard, dan blijft die staan: door hier te bewaren
 * wordt de inhoud niet ouder. Notities van profielen die deze Studio niet kent blijven ook staan
 * (hun inhoud gaat ongewijzigd mee terug).
 *
 * @param {string[]} profielIdsMetInhoud - profiel-id's in het werkbestand
 * @param {Record<string, string>} beschikbaar - profiel-id → versie in deze Studio
 * @param {Record<string, string>} [geladen] - de notitie uit het laatst geladen werkbestand
 * @returns {Record<string, string>}
 */
export function noteerProfielVersies(profielIdsMetInhoud, beschikbaar, geladen = {}) {
  /** @type {Record<string, string>} */
  const uit = {};
  for (const pid of [...profielIdsMetInhoud].sort()) {
    const hier = beschikbaar?.[pid];
    const was = geladen?.[pid];
    if (isProfielVersie(hier)) uit[pid] = isProfielVersie(was) && vergelijkVersies(was, hier) > 0 ? was : hier;
    else if (isProfielVersie(was)) uit[pid] = was;
  }
  return uit;
}

/**
 * @typedef {Object} ProfielVersieBevinding
 * @property {string} profielId
 * @property {string} project  - de versie waarmee het project is bewaard
 * @property {string} studio   - de versie in deze Studio
 * @property {"major"|"minor"} ernst - major: de betekenis kan anders zijn; minor: hier kan
 *   iets ontbreken (nieuwe typen of eigenschappen)
 */

/**
 * Vergelijk de notitie van een project met de profielen van deze Studio. Alleen een project dat
 * *nieuwer* is dan de Studio is een bevinding: een ouder project gaat door de migratie van het
 * profiel (hooks.migreerModel), een project zonder notitie is van vóór deze regeling, en een
 * profiel dat de Studio niet kent wordt al apart gemeld. Een verschil in patch telt niet.
 *
 * @param {Record<string, string>|undefined|null} genoteerd
 * @param {Record<string, string>} beschikbaar
 * @returns {ProfielVersieBevinding[]}
 */
export function beoordeelProfielVersies(genoteerd, beschikbaar) {
  /** @type {ProfielVersieBevinding[]} */
  const uit = [];
  for (const [profielId, project] of Object.entries(genoteerd || {}).sort(([a], [b]) => a.localeCompare(b))) {
    const studio = beschikbaar?.[profielId];
    const p = delen(project);
    const s = delen(studio);
    if (!p || !s) continue;
    if (p[0] > s[0]) uit.push({ profielId, project, studio, ernst: "major" });
    else if (p[0] === s[0] && p[1] > s[1]) uit.push({ profielId, project, studio, ernst: "minor" });
  }
  return uit;
}

/**
 * De melding bij het openen, of "" als er niets te melden is.
 * @param {ProfielVersieBevinding[]} bevindingen
 * @param {(profielId: string) => string} [labelVan]
 */
export function profielVersieMelding(bevindingen, labelVan = (id) => id) {
  if (!bevindingen.length) return "";
  const regel = (b) => `  ${labelVan(b.profielId)}: project ${b.project}, deze Studio ${b.studio}`;
  const major = bevindingen.filter((b) => b.ernst === "major");
  const minor = bevindingen.filter((b) => b.ernst === "minor");
  const delenTekst = ["Dit project is bewaard met een nieuwere versie van een profiel dan deze Studio heeft."];
  if (major.length) {
    delenTekst.push(
      `Andere hoofdversie: het model kan hier iets anders betekenen. Bewerk het niet voordat de Studio is bijgewerkt.\n${major.map(regel).join("\n")}`,
    );
  }
  if (minor.length) {
    delenTekst.push(
      `Nieuwere uitbreiding: typen of eigenschappen die deze Studio niet kent kunnen hier ontbreken.\n${minor.map(regel).join("\n")}`,
    );
  }
  delenTekst.push("Werk de Studio bij (herlaad de pagina).");
  return delenTekst.join("\n\n");
}

// ── Vingerafdruk: de structuur van een profiel, zonder weergave ───────────────────────────────

/** Stabiele JSON: sleutels gesorteerd, functies en undefined weg. @param {any} v @returns {string} */
function stabiel(v) {
  if (Array.isArray(v)) return `[${v.map(stabiel).join(",")}]`;
  if (v && typeof v === "object") {
    return `{${Object.keys(v)
      .filter((k) => v[k] !== undefined && typeof v[k] !== "function")
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stabiel(v[k])}`)
      .join(",")}}`;
  }
  return typeof v === "function" || v === undefined ? "null" : JSON.stringify(v);
}

/** FNV-1a (32 bits), twee keer met een ander begin: 16 hex-tekens. @param {string} s */
function hash(s) {
  const een = (begin) => {
    let h = begin >>> 0;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, "0");
  };
  return een(0x811c9dc5) + een(0x01234567);
}

const eigenschap = (p) => ({
  key: p?.key,
  datatype: p?.datatype || "string",
  ...(Array.isArray(p?.opties) ? { opties: p.opties.map((o) => o?.waarde ?? o) } : {}),
});

/**
 * Wat een model aan zijn profiel bindt: de typen met hun eigenschappen, vakken en
 * verbindingsregels. Labels, kleuren, vormen, iconen, layout en hooks tellen niet mee.
 * Bedoeld voor een geregistreerde descriptor (overerving uitgevlakt, superprofiel aangevuld).
 *
 * @param {any} descriptor
 * @returns {any}
 */
export function profielStructuur(descriptor) {
  const opId = (a, b) => String(a.id).localeCompare(String(b.id));
  return {
    id: descriptor?.id,
    hierarchie: descriptor?.hierarchie ?? null,
    hernoemdeTypen: descriptor?.hernoemdeTypen ?? null,
    facetten: descriptor?.facetten ?? null,
    fieldTypes: [...(descriptor?.fieldTypes || [])].sort(opId).map((f) => ({
      id: f.id,
      properties: (f.properties || []).map(eigenschap),
    })),
    elementTypes: [...(descriptor?.elementTypes || [])].sort(opId).map((e) => ({
      id: e.id,
      abstract: !!e.isAbstract,
      connector: !!e.isConnector,
      aard: e.aard ?? null,
      facetten: e.facetten ?? null,
      containerVoor: e.containerVoor ?? null,
      properties: (e.properties || []).map(eigenschap),
      compartments: (e.compartments || []).map((c) => ({ id: c.id, fieldType: c.fieldType })),
      verbindingsregels: e.verbindingsregels ?? null,
      bron: e.bron ?? null,
      doel: e.doel ?? null,
    })),
  };
}

/** @param {any} descriptor @returns {string} 16 hex-tekens */
export function profielVingerafdruk(descriptor) {
  return hash(stabiel(profielStructuur(descriptor)));
}
