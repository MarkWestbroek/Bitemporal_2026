import MetamodelEditor from "@umleditor/components/MetamodelEditor";
import { demoNodes, demoEdges } from "@umleditor/metamodel/demoData";
import "@umleditor/styles/editor.css";

/**
 * EditorPage — Wrapper die de UML-metamodel-editor uit het subtree-project
 * integreert als pagina in de bitemporal-viz React-app.
 */
export default function EditorPage() {
  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <MetamodelEditor initialNodes={demoNodes} initialEdges={demoEdges} />
    </div>
  );
}
