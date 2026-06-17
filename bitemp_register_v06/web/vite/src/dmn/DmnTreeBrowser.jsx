/**
 * DmnTreeBrowser — Boomstructuur voor DMN views en elementen.
 *
 * Toont de DRD diagrammen en decision tables uit de dmn-js Modeler in een
 * hiërarchische boomstructuur, vergelijkbaar met de ProjectBrowser in de IDE.
 *
 * Structuur:
 *   📐 DRD (Decision Requirements Diagram)
 *   ├ 📊 Decision: Bepaal categorie
 *   ├ 📊 Decision: Bepaal korting
 *   └ 📥 Input: Leeftijd
 *   └ 📥 Input: Inkomen
 *
 * Klikken op een item opent de corresponderende view in de dmn-js Modeler.
 */
import { useMemo } from "react";
import { Tree } from "react-arborist";

// Iconen per element-type
const ICONS = {
  drd: "📐",
  decision: "📊",
  inputData: "📥",
  businessKnowledgeModel: "🔧",
  knowledgeSource: "📚",
};

/**
 * Bouw een boomstructuur uit de dmn-js views.
 */
function buildTree(views) {
  if (!views || views.length === 0) {
    return [
      {
        id: "empty",
        name: "Geen DMN diagrammen",
        nodeType: "empty",
        children: [],
      },
    ];
  }

  // Groepeer views per type
  const drdViews = views.filter((v) => v.type === "drd");
  const decisionViews = views.filter((v) => v.type === "decisionTable" || v.type === "literalExpression");

  const tree = [];

  // DRD views (meestal maar één)
  for (const drd of drdViews) {
    const drdNode = {
      id: drd.id,
      name: drd.element?.name || "DRD",
      nodeType: "drd",
      viewId: drd.id,
      children: [],
    };

    // Zoek alle decisions en input data die bij deze DRD horen
    // (dmn-js geeft views voor elk decision element)
    for (const decision of decisionViews) {
      if (decision.element) {
        drdNode.children.push({
          id: decision.id,
          name: decision.element.name || decision.element.id,
          nodeType: decision.element.type === "dmn:Decision" ? "decision" : "inputData",
          viewId: decision.id,
          elementType: decision.element.type,
        });
      }
    }

    tree.push(drdNode);
  }

  return tree;
}

/**
 * TreeNode renderer voor react-arborist.
 */
function TreeNode({ node, style }) {
  const handleClick = () => {
    if (node.data.viewId && node.data.nodeType !== "empty") {
      // Emit custom event om de view te openen
      const event = new CustomEvent("dmn:openView", {
        detail: { viewId: node.data.viewId },
      });
      window.dispatchEvent(event);
    }
  };

  const icon = ICONS[node.data.nodeType] || "📄";
  const isFolder = node.data.children && node.data.children.length > 0;

  return (
    <div
      style={{
        ...style,
        display: "flex",
        alignItems: "center",
        gap: "6px",
        padding: "4px 8px",
        cursor: "pointer",
        backgroundColor: node.isSelected ? "var(--s-selection, #3b82f6)" : "transparent",
        color: node.isSelected ? "white" : "var(--s-fg, #1f2937)",
        borderRadius: "4px",
        fontSize: "13px",
      }}
      onClick={handleClick}
    >
      {isFolder && (
        <span
          onClick={(e) => {
            e.stopPropagation();
            node.toggle();
          }}
          style={{ cursor: "pointer", userSelect: "none" }}
        >
          {node.isOpen ? "▼" : "▶"}
        </span>
      )}
      <span>{icon}</span>
      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {node.data.name}
      </span>
    </div>
  );
}

export default function DmnTreeBrowser({ views, onOpenView }) {
  const treeData = useMemo(() => buildTree(views), [views]);

  // Luister naar custom events van TreeNode clicks
  const handleOpenView = (event) => {
    if (onOpenView && event.detail?.viewId) {
      onOpenView(event.detail.viewId);
    }
  };

  // Registreer event listener
  useMemo(() => {
    window.addEventListener("dmn:openView", handleOpenView);
    return () => window.removeEventListener("dmn:openView", handleOpenView);
  }, [onOpenView]);

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div
        style={{
          padding: "8px 12px",
          borderBottom: "1px solid var(--s-border, #e5e7eb)",
          fontSize: "12px",
          fontWeight: "600",
          color: "var(--s-fg-muted, #6b7280)",
          textTransform: "uppercase",
          letterSpacing: "0.5px",
        }}
      >
        DMN Diagrammen
      </div>

      {/* Tree */}
      <div style={{ flex: 1, overflow: "hidden", padding: "8px" }}>
        <Tree
          data={treeData}
          idAccessor="id"
          width="100%"
          height={400}
          indent={16}
          rowHeight={32}
          onSelect={(nodes) => {
            if (nodes.length > 0 && nodes[0].data.viewId) {
              onOpenView?.(nodes[0].data.viewId);
            }
          }}
        >
          {TreeNode}
        </Tree>
      </div>

      {/* Help tekst */}
      <div
        style={{
          padding: "8px 12px",
          borderTop: "1px solid var(--s-border, #e5e7eb)",
          fontSize: "11px",
          color: "var(--s-fg-muted, #6b7280)",
        }}
      >
        Klik op een diagram om te openen
      </div>
    </div>
  );
}
