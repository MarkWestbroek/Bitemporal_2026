/**
 * layoutOvernemenTransformatie — "Layout overnemen" in Modelleren ▸ Transformeren (richting
 * transform, elke taal). Bron = de map met het voorbeeld (bv. het met de hand geordende canonieke
 * model), doel = de map waarvan de diagrammen geschikt worden (bv. de SHACL-shapes). De
 * afbeelding is puur en getest (layoutOvernemen.js); hier de aansluiting: maten uit de ene
 * tekenaar (zoals de server-SVG ze tekent), partners uit de kruisverbanden.
 */
import { registreerTransformatie } from "./transformatieRegistry.js";
import { collectMapModel } from "./transformaties.js";
import { getProfieltype } from "../profieltypeRegistry";
import { useKruisStore } from "./koppelingenActivity.jsx";
import { tekenDiagram } from "../../diagramcore/tekenaar/index.js";
import { vindShapeSet, descriptorMetShapeSet } from "../../diagramcore/model/shapeSet.js";
import { voorkomenId } from "../../diagramcore/model/voorkomens.js";
import { layoutOvernemen, maakPartnersVan } from "./layoutOvernemen.js";

/** Maat per voorkomen zoals de tekenaar het tekent; bij een fout een schatting. */
function matenVan(profielId, diagram, elements) {
  const descriptor = getProfieltype(profielId)?.descriptor;
  try {
    if (descriptor) return tekenDiagram({ diagram, elements, descriptor: descriptorMetShapeSet(descriptor, vindShapeSet(descriptor, diagram.shapeSetId, diagram)) }).maten || {};
  } catch {
    /* terugval hieronder */
  }
  return {};
}
const maatVan = (maten, n) => maten[voorkomenId(n)] || { width: n.width || n.size?.width || 220, height: n.height || n.size?.height || 100 };

registreerTransformatie({
  id: "layout-overnemen",
  label: "Layout overnemen in de doelmap (via kruisverbanden)",
  richting: "transform",
  profielTypes: "*",
  toelichting:
    "Schikt de diagrammen in de doelmap zoals de diagrammen in deze map: elk element komt op de plek van zijn partner " +
    "(kruisverband, anders dezelfde naam), geschaald naar de grotere of kleinere dozen; wat dan overlapt schuift opzij. " +
    "Bijvoorbeeld: het geordende canonieke model als voorbeeld voor de SHACL-shapes waar het uit komt.",
  opties: [{ key: "schaal", label: "schaal (leeg = automatisch)", datatype: "string", default: "" }],
  run: async ({ bronMap, doelMap, opties = {} }) => {
    if (!doelMap || doelMap === bronMap) throw new Error("Kies als doel de map met het diagram dat geschikt moet worden.");
    const bron = collectMapModel(bronMap);
    const voorbeeld = new Map();
    for (const [pid, deel] of Object.entries(bron)) {
      for (const d of Object.values(deel.diagrams || {})) {
        const maten = matenVan(pid, d, deel.elements);
        for (const n of d.nodes || []) {
          const sleutel = `${pid}::${n.elementId}`;
          if (voorbeeld.has(sleutel) || !n.position) continue;
          const m = maatVan(maten, n);
          voorbeeld.set(sleutel, { x: n.position.x, y: n.position.y, w: m.width, h: m.height, naam: deel.elements?.[n.elementId]?.naam });
        }
      }
    }
    if (!voorbeeld.size) throw new Error("Geen diagram met elementen in deze map.");
    const schaal = String(opties.schaal || "").trim() ? Number(String(opties.schaal).replace(",", ".")) : "auto";
    const links = useKruisStore.getState().links;
    const doel = collectMapModel(doelMap);
    const verslag = [];
    let totaal = 0;
    for (const [pid, deel] of Object.entries(doel)) {
      const p = getProfieltype(pid);
      if (!p) continue;
      const partnersVan = maakPartnersVan(links, pid, voorbeeld);
      for (const [did, d] of Object.entries(deel.diagrams || {})) {
        if (!(d.nodes || []).length) continue;
        const maten = matenVan(pid, d, deel.elements);
        const doelNodes = d.nodes.map((n) => {
          const m = maatVan(maten, n);
          const el = deel.elements?.[n.elementId];
          return { id: voorkomenId(n), elementId: n.elementId, type: el?.elementType, naam: el?.naam, x: n.position?.x || 0, y: n.position?.y || 0, w: m.width, h: m.height };
        });
        const uit = layoutOvernemen({ voorbeeld, doelNodes, partnersVan, schaal });
        if (!uit.overgenomen) continue;
        const st = p.useStore.getState();
        const huidig = st.diagrams[did];
        p.useStore.setState({ diagrams: { ...st.diagrams, [did]: { ...huidig, nodes: huidig.nodes.map((n) => (uit.posities.has(voorkomenId(n)) ? { ...n, position: uit.posities.get(voorkomenId(n)) } : n)) } } });
        totaal += uit.overgenomen;
        verslag.push({ naam: d.naam || did, ...uit });
      }
    }
    if (!totaal) throw new Error("Geen enkel element in de doelmap heeft een partner (kruisverband of dezelfde naam) in deze map.");
    return {
      status: "success",
      summary: verslag.map((v) => `"${v.naam}": ${v.overgenomen} element(en) geschikt, schaal ${v.schaal.x} × ${v.schaal.y}${v.los.length ? `, ${v.los.length} zonder partner bovenaan` : ""}`).join("; ") + ".",
      diagnostics: [],
    };
  },
});
