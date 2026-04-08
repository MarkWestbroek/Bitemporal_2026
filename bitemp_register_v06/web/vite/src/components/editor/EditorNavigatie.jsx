import { useMemo, useRef } from "react";
import { useNavigate, useLocation } from "react-router";
import { Tree } from "react-arborist";
import { useSchema } from "../../context/SchemaContext";

/* ── Iconen per knooptype ────────────────────────────────── */
const ICONS = {
  domain: "📁",
  categorie: "📂",
  entiteit: "📦",
  referentielijstItem: "📌",
};

/* ── Boomdata bouwen uit inhoudNavigatieGroepen ──────────── */
function buildTree(groepen) {
  return groepen.map((groep) => {
    const children = [];

    if (groep.entiteiten.length > 0) {
      children.push({
        id: `cat_ent_${groep.domein}`,
        name: `ENT-en (${groep.entiteiten.length})`,
        nodeType: "categorie",
        children: groep.entiteiten.map((meta) => ({
          id: meta.typenaam,
          name: meta.klassenaam || meta.typenaam,
          nodeType: "entiteit",
          kleur: meta.kleur,
          padnaam: meta.padnaam || meta.meervoud || meta.veldnaam,
        })),
      });
    }

    if (groep.referentielijstItems.length > 0) {
      children.push({
        id: `cat_ref_${groep.domein}`,
        name: `Referentielijst-items (${groep.referentielijstItems.length})`,
        nodeType: "categorie",
        children: groep.referentielijstItems.map((meta) => ({
          id: meta.typenaam,
          name: meta.klassenaam || meta.typenaam,
          nodeType: "referentielijstItem",
          kleur: meta.kleur,
          padnaam: meta.padnaam || meta.meervoud || meta.veldnaam,
        })),
      });
    }

    return {
      id: `domain_${groep.domein}`,
      name: groep.domein,
      nodeType: "domain",
      children,
    };
  });
}

/* ── Node-renderer (licht thema) ─────────────────────────── */
function TreeNode({ node, style }) {
  const navigate = useNavigate();
  const location = useLocation();
  const isLeaf = !node.children || node.children.length === 0;
  const pad = node.data.padnaam;
  const isActive = isLeaf && pad && location.hash === `#/t/${pad}`;

  const handleClick = () => {
    if (isLeaf && pad) {
      navigate(`/t/${pad}`);
    } else {
      node.toggle();
    }
  };

  return (
    <div
      className={`cg-tree-node${isActive ? " cg-tree-node--active" : ""}`}
      style={{ ...style, paddingLeft: node.level * 16 + 8 }}
      onClick={handleClick}
    >
      {/* Chevron voor folders */}
      {!isLeaf ? (
        <span
          className="cg-tree-node__chevron"
          onClick={(e) => { e.stopPropagation(); node.toggle(); }}
        >
          {node.isOpen ? "▾" : "▸"}
        </span>
      ) : (
        <span className="cg-tree-node__chevron-spacer" />
      )}

      {/* Icoon */}
      <span className="cg-tree-node__icon">
        {ICONS[node.data.nodeType] || "•"}
      </span>

      {/* Kleurbol voor entiteiten/ref-items */}
      {node.data.kleur && (
        <span
          className="cg-tree-node__color-dot"
          style={{ background: node.data.kleur }}
        />
      )}

      {/* Label */}
      <span className="cg-tree-node__label">{node.data.name}</span>
    </div>
  );
}

/**
 * EditorNavigatie — zijbalk met in-/uitklapbare boom per domein.
 * Gebruikt react-arborist met een licht thema.
 */
export default function EditorNavigatie() {
  const { inhoudNavigatieGroepen, loading } = useSchema();
  const treeRef = useRef(null);

  const treeData = useMemo(
    () => buildTree(inhoudNavigatieGroepen),
    [inhoudNavigatieGroepen]
  );

  return (
    <nav className="cg-editor-sidebar" aria-label="Registerinhoud navigatie">
      <div className="cg-editor-sidebar__heading">Inhoud per domein</div>
      {loading && <div style={{ padding: "0.5rem 1rem", fontSize: "0.875rem" }}>Schema laden…</div>}
      {!loading && inhoudNavigatieGroepen.length === 0 && (
        <div style={{ padding: "0.5rem 1rem", fontSize: "0.875rem", color: "var(--cg-donkergrijs)" }}>
          Geen inhoudstypen gevonden.
        </div>
      )}

      {!loading && treeData.length > 0 && (
        <div className="cg-editor-tree">
          <Tree
            ref={treeRef}
            data={treeData}
            openByDefault={true}
            indent={16}
            rowHeight={30}
            width="100%"
            height={window.innerHeight - 140}
            disableDrag
            disableDrop
          >
            {TreeNode}
          </Tree>
        </div>
      )}
    </nav>
  );
}
