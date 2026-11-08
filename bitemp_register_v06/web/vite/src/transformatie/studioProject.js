// @ts-check
/**
 * studioProject — een deel van een Studio-project (`formaat: "studio-project"`)
 * als invoer voor de exportstap Inrichtingsartefacten, zonder Studio
 * (docs/TRANSFORMATIES.md §11.16).
 *
 * Besluit Mark 07-11/08-11: de Studio is de bron, V3 wordt afgeleid. De CLI
 * (`scripts/maak_inrichtingsexport.mjs`) krijgt een projectexport en een of
 * meer mappen (`Domeinen`, `Overig/gegevenstypen`, …) en neemt daaruit:
 *
 * - alles wat in die mappen staat, **recursief**: submappen, en wat onder een
 *   element hangt (uitwerking: het diagram GPK onder Gehandicaptenparkeerkaart);
 * - per profiel de elementen en diagrammen, plus de elementen op die
 *   diagrammen en de connectoren tussen alle betrokken elementen — net als
 *   `collectMapModel` in de Studio (studio/activities/transformaties.js).
 *
 * De keuze van de mappen is dus ook de keuze van de diagrammen in de bron
 * `logisch-model`: de map inrichting valt erbuiten als je hem niet noemt.
 *
 * Puur en store-loos; de omzetting naar V3 doet de aanroeper (exporteerV3).
 */


/** Pad van een map of package in de projectboom: `Overig/gegevenstypen`. */
function padVan(project, sleutel) {
  const mappen = project?.structuur?.mappen || {};
  const plaatsing = project?.structuur?.plaatsing || {};
  const delen = [];
  for (let x = sleutel, n = 0; x && n < 50; n += 1) {
    if (mappen[x]) {
      delen.unshift(mappen[x].naam);
      x = mappen[x].ouderId;
    } else if (x.startsWith("el::")) {
      const [, profielId, elementId] = x.split("::");
      const el = project?.profielen?.[profielId]?.elements?.[elementId];
      delen.unshift(el?.naam || el?.name || elementId);
      x = plaatsing[x];
    } else break;
  }
  return delen.join("/");
}

/**
 * Zoek een map of package (domein) op id, naam of pad (`Domeinen`,
 * `Overig/gegevenstypen`); hoofdletterongevoelig. Een package is een element
 * (`el::diagram05::pkg_…`) dat in een map staat; de boom toont het als submap.
 * @param {any} project
 * @param {string} wie
 * @returns {string} map-id of element-sleutel
 */
export function vindMap(project, wie) {
  const mappen = project?.structuur?.mappen || {};
  const plaatsing = project?.structuur?.plaatsing || {};
  if (mappen[wie] || plaatsing[wie]) return wie;
  const pakketten = Object.keys(plaatsing).filter((k) => {
    if (!k.startsWith("el::")) return false;
    const [, profielId, elementId] = k.split("::");
    return project?.profielen?.[profielId]?.elements?.[elementId]?.elementType === "package";
  });
  const alle = [...Object.keys(mappen), ...pakketten].map((k) => ({ k, pad: padVan(project, k) }));
  const zoek = String(wie).toLowerCase().replace(/^\/+|\/+$/g, "");
  const opPad = alle.filter((x) => x.pad.toLowerCase() === zoek);
  const kandidaten = opPad.length ? opPad : alle.filter((x) => x.pad.split("/").pop().toLowerCase() === zoek);
  if (kandidaten.length === 1) return kandidaten[0].k;
  if (!kandidaten.length) throw new Error(`Map of domein "${wie}" niet gevonden; wel: ${alle.map((x) => x.pad).sort().join(", ")}`);
  throw new Error(`"${wie}" is dubbelzinnig (${kandidaten.map((x) => x.pad).join(", ")}); geef het pad`);
}

/**
 * Wat in de gekozen mappen staat, per profiel: {elementen, diagrammen} als Sets.
 * Recursief door submappen en door wat onder een element (package, uitwerking) hangt.
 * @param {any} project
 * @param {string[]} sleutels - map-id's of element-sleutels (vindMap)
 */
export function inhoudVanMappen(project, sleutels) {
  const mappen = project?.structuur?.mappen || {};
  const plaatsing = project?.structuur?.plaatsing || {};
  const ouders = new Set(sleutels);
  const perProfiel = {};
  const zorg = (pid) => (perProfiel[pid] ??= { elementen: new Set(), diagrammen: new Set() });
  for (const s of sleutels) {
    if (!s.startsWith("el::")) continue;
    const [, profielId, elementId] = s.split("::");
    zorg(profielId).elementen.add(elementId);
  }
  let groei = true;
  const gezien = new Set();
  while (groei) {
    groei = false;
    for (const m of Object.values(mappen)) if (m.ouderId && ouders.has(m.ouderId) && !ouders.has(m.id)) { ouders.add(m.id); groei = true; }
    for (const [sleutel, ouder] of Object.entries(plaatsing)) {
      if (gezien.has(sleutel) || !ouders.has(ouder)) continue;
      gezien.add(sleutel);
      groei = true;
      if (sleutel.startsWith("el::")) {
        const [, profielId, elementId] = sleutel.split("::");
        zorg(profielId).elementen.add(elementId);
        ouders.add(sleutel);
      } else {
        const [profielId, diagramId] = sleutel.split("::");
        zorg(profielId).diagrammen.add(diagramId);
      }
    }
  }
  return perProfiel;
}

/**
 * Connectoren waarlangs het deel groeit: van een gekozen element naar wat het
 * nodig heeft. Een domein bevat zijn elementen, een entiteit zijn GE's, een
 * subtype zijn ouder, een veld zijn gegevenstype of enumeratie. Een relatie
 * komt alleen mee als beide uiteinden er al zijn (zoals collectMapModel).
 */
const GROEI_LANGS = new Set(["bevat", "compositie", "generalisatie", "gebruik", "relatie"]);

/**
 * Het model van de gekozen mappen voor één profiel, in de vorm van
 * `collectMapModel`: {diagramTypeId, elements, diagrams, viewports, meta}.
 * Alleen de relevante stukken (Mark 08-11): de elementen van de gekozen
 * domeinen en diagrammen met wat ze nodig hebben (GROEI_LANGS), en alleen de
 * diagrammen die in die mappen staan. Zonder inhoud in dat profiel: null.
 * @param {any} project
 * @param {string[]} sleutels
 * @param {string} profielId
 */
export function profielUitMappen(project, sleutels, profielId) {
  const st = project?.profielen?.[profielId];
  const inhoud = inhoudVanMappen(project, sleutels)[profielId];
  if (!st || !inhoud) return null;
  const alle = st.elements || {};
  const elemIds = new Set([...inhoud.elementen].filter((id) => alle[id]));
  const diagrams = {};
  const viewports = {};
  for (const dId of inhoud.diagrammen) {
    const d = st.diagrams?.[dId];
    if (!d) continue;
    diagrams[dId] = d;
    if (st.viewports?.[dId]) viewports[dId] = st.viewports[dId];
    for (const n of d.nodes || []) if (alle[n.elementId]) elemIds.add(n.elementId);
  }
  const connectoren = Object.values(alle).filter((el) => el.source && el.target);
  for (let groei = true; groei; ) {
    groei = false;
    for (const c of connectoren) {
      if (!GROEI_LANGS.has(c.elementType) || !elemIds.has(c.source) || elemIds.has(c.target) || !alle[c.target]) continue;
      elemIds.add(c.target);
      groei = true;
    }
  }
  for (const c of connectoren) if (elemIds.has(c.source) && elemIds.has(c.target)) elemIds.add(c.id);
  const elements = {};
  for (const id of elemIds) elements[id] = alle[id];
  if (!Object.keys(elements).length && !Object.keys(diagrams).length) return null;
  return { diagramTypeId: st.diagramTypeId, elements, diagrams, viewports, meta: st.meta };
}
