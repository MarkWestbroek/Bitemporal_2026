// @ts-check
/**
 * sidecarProject — de profielen (M2) en de transformaties van de tool als één Studio-project
 * (PROF-1 stap 3, TRANS-1; volgorde akkoord Mark 19-11).
 *
 * Mark 18-11: het sidecar-project zit half vastgegroeid aan de tool. Zonder geladen profielen
 * valt de tool om; zonder transformaties werkt hij, maar beperkt. Profielen en transformaties
 * leunen op elkaar en staan daarom samen in één project:
 *
 *   map Profielen
 *     map <groep>            ordening (Mark 23-11, profielGroepen.js): UML (Statisch, Dynamisch),
 *                            Gegevensmodellering, Schema's, Business, … Plumbing, Overig
 *       Profiel <profiel>    een container in de M3-taal (`m3Profiel05`, profielContainer.js): de
 *                            kopgegevens als eigenschappen, `bevat` zijn elementen; zijn diagram
 *                            (een view) hangt eronder (Mark 22-11: de map is het profiel, het
 *                            diagram een view)
 *   map Transformaties
 *     map In / Tussen / Uit  de richting (Mark 23-11)
 *       «transformatie»      een container (uitwerking) in het profiel Transformatie
 *                            (`transformatie05`): eronder haar eigen bron en doel en haar diagram
 *                            bron → transformatie → doel (regelsetAlsUitwerking)
 *
 * Een profiel is een model in het M3 (`ontwerpUitProfiel`, `studio/activities/ontwerptaal.js`), een
 * regelset een model in het profiel Transformatie (`regelsetsNaarModel`). De id's zijn vast
 * (afgeleid van het profiel-id en de regelset-id), zodat een volgende export dezelfde elementen
 * houdt en een vergelijking of samenvoeging per element werkt.
 *
 * Nog niet: kruisverbanden tussen een «taal» en het profiel waar hij naar wijst (een profiel heeft
 * nog geen eigen element), de weergaven (vormen, iconen als SVG), en de tool die zijn profielen uit
 * dit project laadt. Zie TRANSFORMATIES.md §9.5 en BACKLOG PROF-1.
 *
 * Puur: geen stores, geen DOM.
 */
import { ontwerpUitProfiel } from "./activities/profielOntwerp.js";
import { metProfielContainer } from "./activities/profielContainer.js";
import { M3_PROFIEL_ID, PROFIEL_ONTWERP_ID } from "./activities/m3Profiel.js";
import { regelsetAlsUitwerking } from "../transformatie/regelsetModel.js";
import { RICHTINGEN, normaliseerRichting } from "../transformatie/regelsetCatalogus.js";
import { groepeerProfielen } from "./profielGroepen.js";
import { TRANSFORMATIE_PROFIEL_ID } from "../diagramprofielen/transformatie/index.js";
import { versieVan } from "../diagramcore/types/profielVersie.js";
import { PROJECT_FORMAAT, PROJECT_FORMAAT_VERSIE } from "./activities/projectSync.js";
import { kopUitDeCode, SOORT_PROFIELEN } from "./projectGebruik.js";

export const SIDECAR_PROJECT_ID = "omnium-sidecar";
export const TRANSFORMATIE_ACTIVITEIT_ID = "transformatie05";

const veilig = (tekst) => String(tekst).replace(/[^A-Za-z0-9_-]+/g, "_");

/**
 * @param {Object} invoer
 * @param {any[]} invoer.descriptors - de geregistreerde profielen (zonder de M3-taal zelf)
 * @param {{regelset: any, richting?: string, schrijver?: string|null}[]} [invoer.vermeldingen] - de regelsets (catalogus)
 * @param {{m3?: any, transformatie?: any}} [invoer.taalDescriptors] - de descriptors van de M3-taal en het profiel Transformatie (voor hun versie)
 * @param {string} [invoer.naam]
 * @returns {Record<string, any>} een werkbestand (formaat studio-project)
 */
export function sidecarProject({ descriptors, vermeldingen = [], taalDescriptors = {}, naam = "Omnium sidecar: profielen en transformaties" }) {
  const profielIds = new Set((descriptors || []).map((d) => d.id));
  const mappen = {};
  const plaatsing = {};
  const map = (id, mapNaam, ouderId, volgorde) => {
    mappen[id] = { id, naam: mapNaam, ouderId, volgorde };
    return id;
  };
  const profielenMap = map("map_profielen", "Profielen", null, 1);
  const groepen = groepeerProfielen([...profielIds], { ouderId: profielenMap });
  for (const g of groepen.mappen) map(g.id, g.naam, g.ouderId, g.volgorde);

  // Profielen: per profiel een Profiel-element (de container) met zijn diagram eronder als view.
  // De leden hangen in de boom onder het Profiel via `bevat` en ◆; ze krijgen geen eigen plaatsing.
  const m3 = { diagramTypeId: PROFIEL_ONTWERP_ID, elements: {}, diagrams: {}, actiefDiagramId: null, meta: {} };
  const gesorteerd = [...(descriptors || [])].sort((a, b) => String(a.label || a.id).localeCompare(String(b.label || b.id), "nl"));
  for (const descriptor of gesorteerd) {
    const sleutel = veilig(descriptor.id);
    const naam = descriptor.label || descriptor.id;
    const ontwerp = ontwerpUitProfiel(descriptor, { prefix: `p_${sleutel}` });
    const basis = Object.values(ontwerp.diagrams)[0];
    const diagramId = `dg_${sleutel}`;
    const { elements, diagrams, profielId } = metProfielContainer(
      { elements: ontwerp.elements, diagrams: { [diagramId]: { ...basis, id: diagramId, naam, diagramType: PROFIEL_ONTWERP_ID } } },
      { prefix: `p_${sleutel}`, naam }
    );
    Object.assign(m3.elements, elements);
    Object.assign(m3.diagrams, diagrams);
    m3.actiefDiagramId ??= diagramId;
    plaatsing[`el::${M3_PROFIEL_ID}::${profielId}`] = groepen.mapVan[descriptor.id] || profielenMap;
    plaatsing[`${M3_PROFIEL_ID}::${diagramId}`] = `el::${M3_PROFIEL_ID}::${profielId}`;
  }

  // Transformaties: per richting een map (in, tussen, uit; ook leeg, zodat de indeling zichtbaar
  // is), per regelset een «transformatie» als container met haar bron, doel en diagram eronder.
  const transformaties = { diagramTypeId: TRANSFORMATIE_PROFIEL_ID, elements: {}, diagrams: {}, actiefDiagramId: null, meta: {} };
  if (vermeldingen.length) {
    const tMap = map("map_transformaties", "Transformaties", null, 2);
    const perRichting = Object.fromEntries(RICHTINGEN.map((r, i) => [r.id, map(`map_tr_${r.id}`, r.label, tMap, i + 1)]));
    const el = (id) => `el::${TRANSFORMATIE_ACTIVITEIT_ID}::${id}`;
    for (const v of vermeldingen) {
      const { element, elements, leden, nodes } = regelsetAlsUitwerking(v, { isProfiel: (n) => profielIds.has(n) });
      Object.assign(transformaties.elements, elements);
      const diagramId = `dg_${element.id}`;
      transformaties.diagrams[diagramId] = { id: diagramId, naam: element.naam, diagramType: TRANSFORMATIE_PROFIEL_ID, nodes, edges: [] };
      transformaties.actiefDiagramId ??= diagramId;
      plaatsing[el(element.id)] = perRichting[normaliseerRichting(v.richting) || "uit"];
      for (const lid of leden) plaatsing[el(lid)] = el(element.id);
      plaatsing[`${TRANSFORMATIE_ACTIVITEIT_ID}::${diagramId}`] = el(element.id);
    }
  }

  const profielen = { [M3_PROFIEL_ID]: m3, ...(vermeldingen.length ? { [TRANSFORMATIE_ACTIVITEIT_ID]: transformaties } : {}) };
  return {
    formaat: PROJECT_FORMAAT,
    versie: PROJECT_FORMAAT_VERSIE,
    // Soort en versie in de kop (projectGebruik.js): uit de code = de versie van de Studio.
    project: { id: SIDECAR_PROJECT_ID, naam, ...kopUitDeCode(SOORT_PROFIELEN) },
    structuur: { mappen, plaatsing, plaatsingVolgorde: Object.keys(plaatsing) },
    kruisverbanden: [],
    profielVersies: {
      [M3_PROFIEL_ID]: versieVan(taalDescriptors.m3),
      ...(vermeldingen.length ? { [TRANSFORMATIE_ACTIVITEIT_ID]: versieVan(taalDescriptors.transformatie) } : {}),
    },
    profielen,
  };
}
