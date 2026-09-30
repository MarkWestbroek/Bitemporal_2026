/**
 * selectie — welk deel van het model wordt getekend.
 *
 * Een compleet V3-model tekenen wordt al snel een chaos, dus (afspraak met
 * Imprint, 29-09-2026):
 *   1. `diagram=<naam>` → een opgeslagen diagram (`diagrammen[]`), op de
 *      posities uit dat diagram;
 *   2. `domein=<naam>`  → alle elementen van één domein, in autoLayout. Buren
 *      in een ander domein (doelentiteit van een relatie, een gedeelde enum)
 *      komen erbij als gestippelde "externe" stomp;
 *   3. geen van beide   → alleen toegestaan bij precies één domein en geen
 *      diagrammen (dan het hele model); anders een 400 met de keuzes.
 * `entiteiten=` verfijnt daarbinnen: alleen die entiteiten, hun
 * gegevenselementen en hun onderlinge relaties.
 */
import { ongeldigeParameter, nietGevonden } from "./fout.js";

/** De keuzes die een model biedt: { diagrammen: [naam], domeinen: [naam] }. */
export function v3Views(model) {
  const diagrammen = [];
  for (const d of model?.diagrammen || []) {
    if (d?.naam && !diagrammen.includes(d.naam)) diagrammen.push(d.naam);
  }
  const domeinen = [];
  const voegToe = (n) => {
    if (typeof n === "string" && n && !domeinen.includes(n)) domeinen.push(n);
  };
  (model?.domeinen || []).forEach((d) => voegToe(d?.naam));
  (model?.entiteiten || []).forEach((e) => voegToe(e?.domein));
  return { diagrammen, domeinen };
}

/** Bepaal de weergave uit de parameters, of gooi een 400/404 met de keuzes. */
export function kiesWeergave(model, { diagram, domein }) {
  const views = v3Views(model);
  if (diagram && domein) throw ongeldigeParameter("Geef 'diagram' óf 'domein' op, niet allebei.", views);
  if (diagram) {
    const diag = (model.diagrammen || []).find((d) => d?.naam === diagram);
    if (!diag) throw nietGevonden(`Het model heeft geen diagram '${diagram}'.`, views);
    return { soort: "diagram", diag, label: diag.naam };
  }
  if (domein) {
    if (!views.domeinen.includes(domein)) throw nietGevonden(`Het model heeft geen domein '${domein}'.`, views);
    return { soort: "domein", domein, label: `domein ${domein}` };
  }
  if (views.diagrammen.length === 0 && views.domeinen.length <= 1) {
    return { soort: "alles", label: views.domeinen[0] ? `domein ${views.domeinen[0]}` : "alle elementen" };
  }
  throw ongeldigeParameter(
    "Kies een diagram of een domein: zonder keuze wordt alleen een model met één domein en zonder opgeslagen diagrammen getekend.",
    views,
  );
}

const MET_DOMEIN = new Set(["entiteit", "gegevenselement", "relatie", "enumeratie", "gegevenstype", "notitie", "constraint"]);
const EXTERN_TYPES = new Set(["entiteit", "relatie", "enumeratie", "gegevenstype", "referentielijstInstantie"]);
const BIJ_GEBRUIK = new Set(["enumeratie", "gegevenstype", "referentielijstInstantie"]);

/**
 * Snijd de React Flow-nodes/edges (uit v3ModelNaarEditor) bij tot de weergave.
 * @returns {{ nodes, edges, extern: Set<string>, layout: boolean }}
 *   nodes behouden hun volgorde uit de mapping (deterministisch); bij een
 *   diagram krijgen ze de positie uit dat diagram.
 */
export function snijBij(model, alleNodes, alleEdges, weergave, entiteitenFilter) {
  const edges = alleEdges.filter((e) => !e.hidden);
  const perId = new Map(alleNodes.map((n) => [n.id, n]));

  // Eigenaarschap uit het ruwe model (GE/relatie → entiteit).
  const geEigenaar = new Map();
  const relatie = new Map(); // relNaam → { bron, doel }
  for (const ent of model.entiteiten || []) {
    for (const ge of ent.gegevenselementen || []) geEigenaar.set(`${ent.typenaam}_${ge.naam}`, ent.typenaam);
    for (const rel of ent.relaties || []) {
      if (!relatie.has(rel.naam)) relatie.set(rel.naam, { bron: ent.typenaam, doel: rel.doelEntiteit || "" });
    }
  }

  let leden;
  let posities = null;
  if (weergave.soort === "diagram") {
    posities = new Map();
    for (const n of weergave.diag.nodes || []) {
      if (!posities.has(n.elementId)) posities.set(n.elementId, { x: Number(n.x) || 0, y: Number(n.y) || 0 });
    }
    leden = new Set(alleNodes.filter((n) => posities.has(n.id)).map((n) => n.id));
  } else if (weergave.soort === "domein") {
    leden = new Set(alleNodes.filter((n) => MET_DOMEIN.has(n.type) && n.data?.domein === weergave.domein).map((n) => n.id));
    for (const n of alleNodes) {
      if (n.type === "associatieAnker" && leden.has(n.data?.relatieNaam)) leden.add(n.id);
    }
    for (const e of edges) {
      if (perId.get(e.source)?.type === "referentielijstInstantie" && leden.has(e.target)) leden.add(e.source);
    }
    // Enums/datatypes zijn gedeelde woordenschat (vaak zonder domein): wat
    // het domein gebruikt, hoort bij de weergave — niet als externe stomp.
    for (const e of edges) {
      if (leden.has(e.source) && BIJ_GEBRUIK.has(perId.get(e.target)?.type)) leden.add(e.target);
    }
  } else {
    leden = new Set(alleNodes.map((n) => n.id));
  }

  if (entiteitenFilter && entiteitenFilter.length > 0) {
    const E = new Set(entiteitenFilter);
    const onbekend = entiteitenFilter.filter((naam) => !(leden.has(naam) && perId.get(naam)?.type === "entiteit"));
    if (onbekend.length > 0) {
      throw ongeldigeParameter(`Onbekende entiteit(en) in deze weergave: ${onbekend.join(", ")}.`, { entiteiten: onbekend });
    }
    const houd = new Set();
    for (const id of leden) {
      const n = perId.get(id);
      if (n.type === "entiteit" && E.has(id)) houd.add(id);
      else if (n.type === "gegevenselement" && E.has(geEigenaar.get(id))) houd.add(id);
      else if (n.type === "relatie") {
        const r = relatie.get(id);
        if (r && E.has(r.bron) && (!r.doel || E.has(r.doel))) houd.add(id);
      }
    }
    for (const id of leden) {
      const n = perId.get(id);
      if (n.type === "associatieAnker" && houd.has(n.data?.relatieNaam)) houd.add(id);
    }
    for (const e of edges) {
      // enum/datatype/instantie alleen als een behouden element ze gebruikt
      for (const [van, naar] of [[e.source, e.target], [e.target, e.source]]) {
        if (houd.has(van) && leden.has(naar) && BIJ_GEBRUIK.has(perId.get(naar)?.type)) houd.add(naar);
      }
    }
    for (const e of edges) {
      if (e.data?.kind === "scope" && leden.has(e.source) && houd.has(e.target)) houd.add(e.source);
    }
    leden = houd;
  }

  const extern = new Set();
  if (weergave.soort === "domein") {
    for (const e of edges) {
      const binnen = leden.has(e.source);
      if (binnen === leden.has(e.target)) continue;
      const ander = perId.get(binnen ? e.target : e.source);
      if (ander && EXTERN_TYPES.has(ander.type)) extern.add(ander.id);
    }
  }

  const nodes = alleNodes
    .filter((n) => leden.has(n.id) || extern.has(n.id))
    .map((n) => (posities ? { ...n, position: posities.get(n.id) } : n));
  const inSet = new Set(nodes.map((n) => n.id));
  return {
    nodes,
    edges: edges.filter((e) => inSet.has(e.source) && inSet.has(e.target)),
    extern,
    layout: weergave.soort !== "diagram",
  };
}
