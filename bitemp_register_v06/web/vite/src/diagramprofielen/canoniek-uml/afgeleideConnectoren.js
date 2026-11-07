// @ts-check
/**
 * afgeleideConnectoren — overerving en «gebruikt» als modelgegevens in het canonieke model
 * (Mark 06-11, via FUNDAMENT; backlog ERFT-1 en GEBR-1).
 *
 * **ERFT-1: overerving.** Na een V3-import stond `erft` alleen als presentatie-edge
 * (`isGeneralization`) op de import-diagrammen: een nieuw diagram met beide entiteiten toonde hem
 * niet, en de export verloor hem zodra die diagrammen weg waren. `vouwOudeGeneralisaties` maakt
 * er één `generalisatie`-connector per paar van (de core tekent hem op elk diagram waar beide
 * staan) en haalt de presentatie-edges weg — zoals `vouwOudeComposities` in 09-2026.
 *
 * **GEBR-1: «gebruikt».** Een veld waarvan het type een enumeratie, gegevenstype of
 * referentielijst-item is, betekent "dit element gebruikt dat type". `synchroniseerGebruik`
 * houdt daar een `gebruik`-connector voor bij (id `gebr_<bron>__<doel>`, `data.afgeleid:
 * "veldtype"`): erbij als een veld het type krijgt, weg als geen veld het nog gebruikt. Een
 * handmatig getrokken «gebruikt»-lijn (zonder `afgeleid`) blijft altijd staan. Oude «use»-
 * presentatie-edges (`isDependency`) vervallen zodra er een connector voor het paar is; een
 * verborgen exemplaar wordt `verborgenConnectoren` op dat diagram.
 *
 * Beide draaien via `hooks.migreerModel` bij het laden én na elke wijziging in de Studio, en in
 * de tekenaar (server-SVG). Idempotent: null als er niets te doen is. Vaste ids, zodat twee
 * clients niet elk een eigen connector maken. Puur.
 */

/** Is dit element een referentielijst-item (een entiteit met dat subtype)? Zelfde regel als index.js. */
export function isRli(el) {
  if (el?.elementType !== "entiteit") return false;
  const d = el.data || {};
  return "entiteitSubtype" in d ? d.entiteitSubtype === "referentielijst_item" : d.stereotype === "«ref.lijst item»";
}

/**
 * Is dit element de items-relatie van een referentielijst (relatieSubtype referentielijst_items)?
 * Zelfde regel als index.js `isRefLijstItems`. Plan Referentielijst-instanties §8 (08-11): het
 * voorkeursdoel van een veld dat een referentielijst gebruikt.
 */
export function isItemsRel(el) {
  if (el?.elementType !== "relatie") return false;
  const d = el.data || {};
  return "relatieSubtype" in d ? d.relatieSubtype === "referentielijst_items" : d.stereotype === "«ref.lijst items»";
}

const edgeData = (e) => ({ ...(e?.data?.bron || {}), ...(e?.data || {}) });

/** Het typelabel van een V3-veld zoals de adapter het vóór 08-11 maakte (een `$ref` als basistype). */
function oudRefLabel(v) {
  let t = v.type || "";
  if (v.format) t += ` «${v.format}»`;
  if (v.autoIncrement) t += " {AI}";
  if (v.enum) t += ` {${v.enum.join("|")}}`;
  return t;
}

/**
 * Velden met een `$ref` (in `data.bron.velden`: refItemNaam) die nog het oude label dragen
 * ("integer") krijgen de naam van wat ze noemen: de items-relatie of de item-entiteit (08-11).
 * Zo ziet de modelleur de verwijzing, leidt GEBR-1 de «gebruikt»-lijn af en kan hij hem
 * omhangen. Een label dat de modelleur zelf zette, blijft. Idempotent; null als er niets te doen is.
 * @param {{elements: Record<string, any>, diagrams: Record<string, any>}} state
 */
export function herstelRefTypeLabels(state) {
  const elements = state?.elements || {};
  let nieuw = null;
  for (const el of Object.values(elements)) {
    const bronVelden = el?.data?.bron?.velden;
    if (!Array.isArray(bronVelden) || !bronVelden.some((v) => v?.refItemNaam)) continue;
    let gewijzigd = false;
    const compartimenten = (el.compartimenten || []).map((c) => {
      if (c.compartmentType !== "velden") return c;
      let cGewijzigd = false;
      const velden = (c.velden || []).map((v) => {
        const b = (v.data?.uuid && bronVelden.find((x) => x.uuid === v.data.uuid)) || bronVelden.find((x) => x.naam === v.naam);
        if (!b?.refItemNaam || b.enumNaam || b.datatypeNaam) return v;
        if ((v.data?.typeLabel || "") !== oudRefLabel(b)) return v;
        cGewijzigd = true;
        return { ...v, data: { ...(v.data || {}), typeLabel: b.refItemNaam } };
      });
      if (!cGewijzigd) return c;
      gewijzigd = true;
      return { ...c, velden };
    });
    if (!gewijzigd) continue;
    nieuw = nieuw || { ...elements };
    nieuw[el.id] = { ...el, compartimenten };
  }
  return nieuw ? { elements: nieuw, diagrams: state?.diagrams || {} } : null;
}

/**
 * ERFT-1: presentatie-edges met `isGeneralization` → `generalisatie`-connectoren.
 * @param {{elements: Record<string, any>, diagrams: Record<string, any>}} state
 * @returns {{elements: Record<string, any>, diagrams: Record<string, any>}|null}
 */
export function vouwOudeGeneralisaties(state) {
  const elements = state?.elements || {};
  const diagrams = state?.diagrams || {};
  const isOud = (e) => edgeData(e).isGeneralization === true && elements[e.source] && elements[e.target];
  if (!Object.values(diagrams).some((d) => (d?.edges || []).some(isOud))) return null;
  const bestaand = new Set(Object.values(elements).filter((c) => c.elementType === "generalisatie" && c.source).map((c) => `${c.source}->${c.target}`));
  const nieuw = { ...elements };
  for (const d of Object.values(diagrams)) {
    for (const e of d?.edges || []) {
      if (!isOud(e)) continue;
      const sleutel = `${e.source}->${e.target}`;
      if (bestaand.has(sleutel)) continue;
      bestaand.add(sleutel);
      const bron = edgeData(e);
      const data = { bron };
      if (bron.naamLabelHeen) data.naamLabelHeen = bron.naamLabelHeen;
      if (bron.naamLabelTerug) data.naamLabelTerug = bron.naamLabelTerug;
      const id = `gen_${e.source}__${e.target}`;
      nieuw[id] = { id, naam: "", elementType: "generalisatie", source: e.source, target: e.target, compartimenten: [], data };
    }
  }
  const nieuweDiagrams = Object.fromEntries(
    Object.entries(diagrams).map(([id, d]) => {
      const edges = (d?.edges || []).filter((e) => !isOud(e));
      return [id, edges.length === (d?.edges || []).length ? d : { ...d, edges }];
    })
  );
  return { elements: nieuw, diagrams: nieuweDiagrams };
}

/** De typenaam uit een veld-typeLabel: zonder `{…}` (enumwaarden) en `«…»` (format). */
function typeNaam(label) {
  return String(label || "").replace(/\s*\{[^}]*\}\s*$/g, "").replace(/\s*«[^»]*»\s*$/g, "").trim();
}

/** Bron-elementtypen waarvan velden een type kunnen gebruiken. */
const BRONNEN = new Set(["entiteit", "gegevenselement", "relatie"]);

/**
 * GEBR-1: «gebruikt»-connectoren afleiden uit de veldtypen, en oude «use»-edges opruimen.
 * @param {{elements: Record<string, any>, diagrams: Record<string, any>}} state
 * @returns {{elements: Record<string, any>, diagrams: Record<string, any>}|null}
 */
export function synchroniseerGebruik(state) {
  const elements = state?.elements || {};
  const diagrams = state?.diagrams || {};
  // Typen op naam (de eerste wint bij dubbele namen).
  const typeOpNaam = new Map();
  for (const el of Object.values(elements)) {
    if (!el?.naam || typeOpNaam.has(el.naam)) continue;
    if (el.elementType === "enumeratie" || el.elementType === "gegevenstype" || isRli(el) || isItemsRel(el)) typeOpNaam.set(el.naam, el.id);
  }
  // Gewenste paren uit de velden.
  const gewenst = new Set();
  for (const el of Object.values(elements)) {
    if (!BRONNEN.has(el?.elementType)) continue;
    for (const c of el.compartimenten || []) {
      for (const v of c.velden || []) {
        const doel = typeOpNaam.get(typeNaam(v?.data?.typeLabel));
        if (doel && doel !== el.id) gewenst.add(`${el.id}->${doel}`);
      }
    }
  }
  const gebruik = Object.values(elements).filter((c) => c.elementType === "gebruik" && c.source && c.target);
  const aanwezig = new Set(gebruik.map((c) => `${c.source}->${c.target}`));
  let nieuw = null;
  for (const paar of gewenst) {
    if (aanwezig.has(paar)) continue;
    const [bron, doel] = paar.split("->");
    const id = `gebr_${bron}__${doel}`;
    nieuw = nieuw || { ...elements };
    nieuw[id] = { id, naam: "", elementType: "gebruik", source: bron, target: doel, compartimenten: [], data: { afgeleid: "veldtype" } };
    aanwezig.add(paar);
  }
  for (const c of gebruik) {
    if (c.data?.afgeleid === "veldtype" && !gewenst.has(`${c.source}->${c.target}`)) {
      nieuw = nieuw || { ...elements };
      delete nieuw[c.id];
      aanwezig.delete(`${c.source}->${c.target}`);
    }
  }
  // Oude «use»-presentatie-edges: weg zodra er een connector voor het paar is.
  const naElements = nieuw || elements;
  const connectorVoor = new Map(Object.values(naElements).filter((c) => c.elementType === "gebruik" && c.source).map((c) => [`${c.source}->${c.target}`, c.id]));
  let nieuweDiagrams = null;
  for (const [id, d] of Object.entries(diagrams)) {
    const oud = (d?.edges || []).filter((e) => edgeData(e).isDependency === true && connectorVoor.has(`${e.source}->${e.target}`));
    if (!oud.length) continue;
    const verborgen = new Set(d.verborgenConnectoren || []);
    for (const e of oud) if (e.hidden) verborgen.add(connectorVoor.get(`${e.source}->${e.target}`));
    nieuweDiagrams = nieuweDiagrams || { ...diagrams };
    nieuweDiagrams[id] = {
      ...d,
      edges: d.edges.filter((e) => !oud.includes(e)),
      ...(verborgen.size ? { verborgenConnectoren: [...verborgen] } : {}),
    };
  }
  if (!nieuw && !nieuweDiagrams) return null;
  return { elements: naElements, diagrams: nieuweDiagrams || diagrams };
}
