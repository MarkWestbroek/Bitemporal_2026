import MetamodelEditor from "./components/MetamodelEditor";
import { demoNodes, demoEdges } from "./metamodel/demoData";
import "./styles/editor.css";

/**
 * App — Root component.
 *
 * Laadt de MetamodelEditor met demo-data die het bitemporele model
 * (entiteiten A en B met hun GE's en relaties) weerspiegelt.
 */
export default function App() {
  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <MetamodelEditor initialNodes={demoNodes} initialEdges={demoEdges} />
    </div>
  );
}
