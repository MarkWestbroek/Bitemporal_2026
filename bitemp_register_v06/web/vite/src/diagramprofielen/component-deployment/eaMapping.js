// @ts-check
/**
 * eaMapping — Sparx EA → component-deployment-profiel. De tabel waarmee de
 * EA-lezer (`diagramprofielen/ea/`) EA-objecten en -connectoren op onze
 * elementtype-id's afbeeldt. Puur data, zodat de lezer én de tests dezelfde
 * bron gebruiken. De id's zijn een contract (EA-GUID → id): nooit wijzigen.
 *
 * EA-kolommen: `t_object.Object_Type` + `Stereotype` (of de xref-stereotypen),
 * `t_connector.Connector_Type` + `Stereotype`. Diagram_Type van de
 * EA-diagrammen die hier landen: "Component" en "Deployment".
 *
 * N.B. EA slaat device/execution environment in sommige versies op als
 * Object_Type "Device"/"ExecutionEnvironment" en in andere als Object_Type
 * "Node" met stereotype — allebei staan hieronder; `scripts/inspecteer-qea.py`
 * laat zien welke het bestand gebruikt.
 */

export const EA_DIAGRAM_TYPES = ["Component", "Deployment"];

/**
 * EA Object_Type (+ optioneel stereotype, kleine letters) → elementtype-id.
 * Eerst de specifieke rij (met stereotype), dan de algemene.
 * @type {{objectType: string, stereotype?: string, elementType: string, opmerking?: string}[]}
 */
export const OBJECTEN = [
  { objectType: "Component", elementType: "component" },
  { objectType: "Interface", elementType: "interface" },
  { objectType: "Port", elementType: "poort", opmerking: "randElement op component/node; EA: PDATA/ParentID = gastheer" },
  { objectType: "Artifact", stereotype: "deployment spec", elementType: "deploymentspec" },
  { objectType: "DeploymentSpecification", elementType: "deploymentspec" },
  { objectType: "Artifact", elementType: "artifact" },
  { objectType: "Node", stereotype: "device", elementType: "device" },
  { objectType: "Node", stereotype: "executionenvironment", elementType: "executieomgeving" },
  { objectType: "Device", elementType: "device" },
  { objectType: "ExecutionEnvironment", elementType: "executieomgeving" },
  { objectType: "Node", elementType: "node" },
  { objectType: "Package", elementType: "package" },
  { objectType: "Note", elementType: "notitie" },
  { objectType: "Text", elementType: "notitie" },
  { objectType: "Boundary", elementType: "boundary" },
  // Klassen op een component-/deploymentdiagram: als component tonen
  // (alleen de naam), het echte klassediagram leeft in puur-uml.
  { objectType: "Class", elementType: "component", opmerking: "verwijzing; stereotype reist mee op data" },
];

/**
 * EA Connector_Type (+ optioneel stereotype) → connectortype-id.
 * @type {{connectorType: string, stereotype?: string, elementType: string, opmerking?: string}[]}
 */
export const CONNECTOREN = [
  { connectorType: "Realisation", elementType: "realisatie" },
  { connectorType: "Realization", elementType: "realisatie" },
  { connectorType: "Usage", elementType: "gebruikt" },
  { connectorType: "Dependency", stereotype: "use", elementType: "gebruikt" },
  { connectorType: "Assembly", elementType: "assembly" },
  { connectorType: "Delegate", elementType: "delegatie" },
  { connectorType: "Deployment", elementType: "deployment" },
  { connectorType: "Dependency", stereotype: "deploy", elementType: "deployment" },
  { connectorType: "Manifest", elementType: "manifest" },
  { connectorType: "Dependency", stereotype: "manifest", elementType: "manifest" },
  { connectorType: "Association", elementType: "communicatiepad", opmerking: "tussen node-typen; anders dependency" },
  { connectorType: "Generalization", elementType: "generalisatie" },
  { connectorType: "Dependency", elementType: "dependency", opmerking: "stereotype → data.stereotype (label op de lijn)" },
  { connectorType: "NoteLink", elementType: "notitielijn" },
  { connectorType: "Nesting", elementType: "bevat" },
  { connectorType: "Aggregation", elementType: "bevat", opmerking: "EA tekent compositie node∋artifact soms zo" },
];

/** Typen die op de rand van hun gastheer wonen (EA: Object met ParentID). */
export const RAND_ELEMENTEN = ["poort"];
/** Typen die leden hebben (EA: Object met ParentID → `bevat`). */
export const CONTAINERS = ["component", "node", "device", "executieomgeving", "package"];

/**
 * Zoek het elementtype voor een EA-object.
 * @param {string} objectType
 * @param {string[]} [stereotypen] - kleine letters
 */
export function elementTypeVoorObject(objectType, stereotypen = []) {
  const st = new Set(stereotypen.map((s) => String(s).toLowerCase()));
  const rij =
    OBJECTEN.find((r) => r.objectType === objectType && r.stereotype && st.has(r.stereotype)) ||
    OBJECTEN.find((r) => r.objectType === objectType && !r.stereotype);
  return rij?.elementType || null;
}

/**
 * Zoek het connectortype voor een EA-connector.
 * @param {string} connectorType
 * @param {string} [stereotype]
 */
export function elementTypeVoorConnector(connectorType, stereotype = "") {
  const st = String(stereotype || "").toLowerCase();
  const rij =
    CONNECTOREN.find((r) => r.connectorType === connectorType && r.stereotype && r.stereotype === st) ||
    CONNECTOREN.find((r) => r.connectorType === connectorType && !r.stereotype);
  return rij?.elementType || null;
}
