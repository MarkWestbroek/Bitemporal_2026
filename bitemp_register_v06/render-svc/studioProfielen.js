/**
 * studioProfielen — alle M2-profielen voor taal=studio, op de id's die projectbestanden
 * gebruiken (`diagramTypeId`, zie studio/activities/*Activity.jsx).
 *
 * Wordt met esbuild gebundeld (bouw.mjs): de profielen importeren JSX, dat Node niet
 * kan lezen. De .jsx-modules zijn in die bundel leeg; de tekenaar heeft React niet nodig.
 *
 * De tekenaar gaat mee in deze bundel: de ShapeTypes staan in een register in modulestaat,
 * dus profielen en tekenaar moeten dezelfde kopie delen.
 */
export { tekenDiagram, naarSvg } from "../web/vite/src/diagramcore/tekenaar/index.js";
import { getDiagramType } from "../web/vite/src/diagramcore/types/typeRegistry.js";
import { versieVan, profielVingerafdruk } from "../web/vite/src/diagramcore/types/profielVersie.js";
import { registreerActivity, ACTIVITY_ID } from "../web/vite/src/diagramprofielen/activity/index.js";
import { registreerArchimate, ARCHIMATE_ID } from "../web/vite/src/diagramprofielen/archimate/index.js";
import { registreerBpmnMotor, BPMN_ID } from "../web/vite/src/diagramprofielen/bpmn/index.js";
import { registreerBusiness, businessDiagramType } from "../web/vite/src/diagramprofielen/business/index.js";
import { registreerCanoniekUml, CANONIEK_UML_ID } from "../web/vite/src/diagramprofielen/canoniek-uml/index.js";
import { registreerCmmn, CMMN_ID } from "../web/vite/src/diagramprofielen/cmmn/index.js";
import { registreerCommunication, communicationDiagramType } from "../web/vite/src/diagramprofielen/communication/index.js";
import { registreerComponentDeployment, componentDeploymentDiagramType } from "../web/vite/src/diagramprofielen/component-deployment/index.js";
import { registreerCompositeStructure, compositeStructureDiagramType } from "../web/vite/src/diagramprofielen/composite-structure/index.js";
import { registreerDmnDrd, DMN_DRD_ID } from "../web/vite/src/diagramprofielen/dmn-drd/index.js";
import { registreerErd, ERD_ID } from "../web/vite/src/diagramprofielen/erd/index.js";
import { registreerFormulierProfiel, FORMULIER_ID } from "../web/vite/src/diagramprofielen/formulier/index.js";
import { registreerGraphql, GRAPHQL_ID } from "../web/vite/src/diagramprofielen/graphql/index.js";
import { registreerMim12, MIM12_ID } from "../web/vite/src/diagramprofielen/mim12/index.js";
import { registreerOas31, OAS31_ID } from "../web/vite/src/diagramprofielen/oas31/index.js";
import { registreerObject, objectDiagramType } from "../web/vite/src/diagramprofielen/object/index.js";
import { registreerPuurUml, PUUR_UML_ID } from "../web/vite/src/diagramprofielen/puur-uml/index.js";
import { registreerRequirements, requirementsDiagramType } from "../web/vite/src/diagramprofielen/requirements/index.js";
import { registreerShacl, SHACL_ID } from "../web/vite/src/diagramprofielen/shacl/index.js";
import { registreerSequence, SEQUENCE_ID } from "../web/vite/src/diagramprofielen/sequence/index.js";
import { registreerStateMachine, STATEMACHINE_ID } from "../web/vite/src/diagramprofielen/statemachine/index.js";
import { registreerSysml, SYSML_ID } from "../web/vite/src/diagramprofielen/sysml/index.js";
import { registreerToegangsregelProfiel, TOEGANGSREGEL_ID } from "../web/vite/src/diagramprofielen/toegangsregel/index.js";
import { registreerUseCase, USECASE_ID } from "../web/vite/src/diagramprofielen/usecase/index.js";
import { registreerWsdl, wsdlDiagramType } from "../web/vite/src/diagramprofielen/wsdl/index.js";
import { registreerXsd, xsdDiagramType } from "../web/vite/src/diagramprofielen/xsd/index.js";

// [profiel-id in het project, registratie, type-id in het typeregister]
const PROFIELEN = [
  ["activity05", registreerActivity, ACTIVITY_ID],
  ["archimate05", registreerArchimate, ARCHIMATE_ID],
  ["bpmnMotor05", registreerBpmnMotor, BPMN_ID],
  ["business05", registreerBusiness, businessDiagramType.id],
  ["cmmn05", registreerCmmn, CMMN_ID],
  ["communication05", registreerCommunication, communicationDiagramType.id],
  ["componentDeployment05", registreerComponentDeployment, componentDeploymentDiagramType.id],
  ["compositeStructure05", registreerCompositeStructure, compositeStructureDiagramType.id],
  ["diagram05", registreerCanoniekUml, CANONIEK_UML_ID],
  ["dmnDrd05", registreerDmnDrd, DMN_DRD_ID],
  ["erd05", registreerErd, ERD_ID],
  ["formulierdiagram", registreerFormulierProfiel, FORMULIER_ID],
  ["graphql05", registreerGraphql, GRAPHQL_ID],
  ["mim05", registreerMim12, MIM12_ID],
  ["oas05", registreerOas31, OAS31_ID],
  ["object05", registreerObject, objectDiagramType.id],
  ["puurUml05", registreerPuurUml, PUUR_UML_ID],
  ["requirements05", registreerRequirements, requirementsDiagramType.id],
  ["sequence05", registreerSequence, SEQUENCE_ID],
  ["shacl05", registreerShacl, SHACL_ID],
  ["statemachine05", registreerStateMachine, STATEMACHINE_ID],
  ["sysml05", registreerSysml, SYSML_ID],
  ["toegangsregels", registreerToegangsregelProfiel, TOEGANGSREGEL_ID],
  ["usecase05", registreerUseCase, USECASE_ID],
  ["wsdl05", registreerWsdl, wsdlDiagramType.id],
  ["xsd05", registreerXsd, xsdDiagramType.id],
];

const typeIds = new Map();
for (const [profielId, registreer, typeId] of PROFIELEN) {
  registreer();
  typeIds.set(profielId, typeId);
}

export const profielIds = [...typeIds.keys()];

/**
 * Per profiel-id de versie en de vingerafdruk van de structuur (types/profielVersie.js). De
 * test profielVersies.test.mjs legt dit naast profielVersies.vast.json: een structuurwijziging
 * zonder versieverhoging laat hem falen.
 * @returns {Record<string, {versie: string, vingerafdruk: string}>}
 */
export function profielVersieOverzicht() {
  return Object.fromEntries(
    [...typeIds.keys()].sort().map((pid) => {
      const d = getDiagramType(typeIds.get(pid));
      return [pid, { versie: versieVan(d), vingerafdruk: profielVingerafdruk(d) }];
    }),
  );
}

/** De descriptor van een profiel-id uit een project, of undefined. */
export function descriptorVan(profielId) {
  return typeIds.has(profielId) ? getDiagramType(typeIds.get(profielId)) : undefined;
}

// ── V3-export van een Studio-project (07-11, Mark: "het model is de bron voor het genereren") ──
// Dezelfde terugreis als de Studio (canoniek-uml/adapter.js naarCanoniekModel + store/adapters.js
// storeNaarV3Model), met eerst de ops ná de snapshot nagespeeld (zoals de MCP) en de migratie van
// het profiel (composities, overerving, «gebruikt»). Zie server.mjs POST /export/v3.
import { maakStand, speelOpsNa } from "../web/vite/src/diagramprofielen/ea/sidecarImport.js";
import { naarCanoniekModel } from "../web/vite/src/diagramprofielen/canoniek-uml/adapter.js";
import { exporteerV3 as studioExporteerV3, importeerV3 } from "../web/vite/src/diagramprofielen/canoniek-uml/serialisatie.js";
import { valideerVoorV3 } from "../web/vite/src/store/adapters.js";

/**
 * @param {{profiel: any, ops?: Array<{store: string, op: string, args: any[], volgnummer?: number}>, profielId?: string}} p
 * @returns {{model: any, meldingen: Array<{regel?: string, bericht: string, elementId?: string}>, nagespeeld: number}}
 */
export function exporteerV3({ profiel, ops = [], profielId = "diagram05" }) {
  const stand = maakStand({ profielen: { [profielId]: profiel || {} } });
  // Alleen de ops van dit profiel; structuur en kruisverbanden doen voor V3 niet mee.
  const r = speelOpsNa(stand, (ops || []).filter((o) => o?.store === `model:${profielId}`));
  const st = stand.profielVoor(profielId).getState();
  const basis = { elements: st.elements || {}, diagrams: st.diagrams || {}, meta: st.meta || {} };
  const desc = descriptorVan(profielId);
  const mig = desc?.hooks?.migreerModel?.(basis);
  const staat = mig ? { ...basis, ...mig } : basis;
  // Precies wat de Studio bij "Exporteer V3" doet (serialisatie.exporteerV3, met het overzicht en
  // de canonieke diagram-ids); de Studio geeft hem zijn al gemigreerde storestaat.
  const { v3, overgeslagen } = studioExporteerV3({ ...st, ...staat });
  const meldingen = [
    ...r.problemen.map((bericht) => ({ regel: "OPS", bericht })),
    ...(valideerVoorV3(naarCanoniekModel(staat)) || []).map((o) => ({ regel: o.regel, bericht: o.bericht || o.melding || o.tekst || JSON.stringify(o), ...(o.elementId ? { elementId: o.elementId } : {}) })),
    ...(overgeslagen?.length ? [{ regel: "OVERGESLAGEN", bericht: `Niet in V3 (geen tegenhanger): ${overgeslagen.join(", ")}.` }] : []),
  ];
  return { model: v3, meldingen, nagespeeld: r.toegepast };
}

/** Heenreis (voor tests en proeven): V3 → de profielstaat zoals de Studio hem bewaart. */
export function v3NaarProfiel(v3) {
  const core = importeerV3(v3);
  return { diagramTypeId: core.diagramTypeId, elements: core.elements, diagrams: core.diagrams, meta: core.meta || {} };
}

// ── Verschil tussen een afgeleid project (branch) en MAIN (09-11, branch stap 1) ──────────────
// Drie werkbestanden materialiseren (snapshot + ops, zoals hierboven) en vergelijken met
// studio/takken/verschilMetMain.js. Na elkaar: maakStand ontkoppelt de vorige stand.
import { bouwWerkbestand } from "../web/vite/src/diagramprofielen/ea/sidecarImport.js";
import { verschilMetMain } from "../web/vite/src/studio/takken/verschilMetMain.js";
import { bouwHierarchie } from "../web/vite/src/studio/boomRegels.js";

/** Snapshot + ops → werkbestand ("studio-project" v3). */
export function materialiseer({ profiel, ops = [] }) {
  const stand = maakStand(profiel || {});
  const r = speelOpsNa(stand, ops || []);
  return { werkbestand: bouwWerkbestand(stand), problemen: r.problemen, nagespeeld: r.toegepast };
}

/**
 * Eén profiel nagespeeld (10-11, voor GET /api/studio/projecten/:id/model/:profiel van BACKEND en
 * laag 2 van de werkplaats op Imprint): het profiel uit de blob plus alleen de ops op zijn eigen
 * store (`model:<profielId>`). Ops op structuur of kruis raken het profiel niet; die worden
 * overgeslagen (en geteld). → `{profiel, nagespeeld, overgeslagen, meldingen}`; een op die niet
 * na te spelen is staat in `meldingen` (regel "OPS").
 *
 * @param {{profielId: string, profiel: any, ops?: any[]}} p
 */
export function materialiseerProfiel({ profielId, profiel, ops = [] }) {
  const store = `model:${profielId}`;
  const eigen = (ops || []).filter((o) => o?.store === store);
  const werkbestand = { formaat: "studio-project", versie: 3, profielen: { [profielId]: profiel || { elements: {}, diagrams: {} } } };
  const r = materialiseer({ profiel: werkbestand, ops: eigen });
  return {
    profiel: r.werkbestand?.profielen?.[profielId] ?? null,
    nagespeeld: r.nagespeeld,
    overgeslagen: (ops || []).length - eigen.length,
    meldingen: (r.problemen || []).map((bericht) => ({ regel: "OPS", bericht: typeof bericht === "string" ? bericht : JSON.stringify(bericht) })),
  };
}

/**
 * @param {{basis: {profiel: any, ops?: any[]}, tak: {profiel: any, ops?: any[]}, main: {profiel: any, ops?: any[]}, mapId?: string|null}} p
 */
export function vergelijkProjecten({ basis, tak, main, mapId = null }) {
  const m = { basis: materialiseer(basis), tak: materialiseer(tak), main: materialiseer(main) };
  // Boomouder per profiel en per stand (hiërarchie van de descriptor), voor kinderen zonder plaatsing.
  const cache = new Map();
  const ouderVan = (profielId, elementId, stand) => {
    const sleutel = stand.profielen?.[profielId];
    if (!sleutel) return null;
    if (!cache.has(sleutel)) {
      const desc = descriptorVan(profielId);
      let kaart = new Map();
      if (desc?.hierarchie) {
        try {
          kaart = bouwHierarchie(sleutel.elements || {}, desc.hierarchie, desc.hooks?.hierarchieParen?.(sleutel) || []).ouderVan;
        } catch { kaart = new Map(); }
      }
      cache.set(sleutel, kaart);
    }
    return cache.get(sleutel).get(elementId) || null;
  };
  const uit = verschilMetMain({ basis: m.basis.werkbestand, tak: m.tak.werkbestand, main: m.main.werkbestand, mapId, ouderVan });
  const meldingen = Object.entries(m).flatMap(([kant, x]) => x.problemen.map((bericht) => ({ regel: "OPS", kant, bericht })));
  return { ...uit, meldingen };
}
