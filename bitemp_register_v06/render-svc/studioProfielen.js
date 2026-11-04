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

/** De descriptor van een profiel-id uit een project, of undefined. */
export function descriptorVan(profielId) {
  return typeIds.has(profielId) ? getDiagramType(typeIds.get(profielId)) : undefined;
}
