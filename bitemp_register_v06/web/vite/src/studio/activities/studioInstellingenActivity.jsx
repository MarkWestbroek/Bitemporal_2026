/**
 * studioInstellingenActivity — "Studio-instellingen": globale, profiel-
 * overstijgende instellingen. Eerste onderdeel: de **vorm- en icoon-galerij**
 * (read-only), die de gedeelde registry's toont — dezelfde shapes/icons die
 * álle profielen gebruiken (het Style-domein leeft globaal, niet per profiel).
 *
 * Dit is het fundament voor de shape-editor (data-shapes + SVG): hier zie je
 * wat er ís; het shape-set-paneel en de PE-dropdowns verwijzen ernaar.
 */
import { IconInstellingen } from "../icons";
// Side-effect: registreert alle basis-shapes in de registry. Nodig omdat de
// galerij ook zónder een geopende canvas (die basisShapes lazy laadt) de
// volledige registry moet tonen.
import "../../diagramcore/shapes/basisShapes.jsx";
import { alleShapeIds, getShape } from "../../diagramcore/shapes/shapeRegistry.js";
import { alleIcoonIds, TypeIcoon } from "../../diagramcore/shapes/typeIconen.jsx";

/** Eén shape-kaart: de shape op ware grootte in een vaste preview-box. */
function ShapeKaart({ id }) {
  const Shape = getShape(id);
  const element = { naam: id, data: {}, compartimenten: [] };
  const elementType = { kleur: "#e2e8f0", compartments: [] };
  return (
    <div
      style={{
        border: "1px solid var(--s-border, #cbd5e1)",
        borderRadius: 8,
        background: "var(--s-panel, #fff)",
        padding: 8,
        display: "flex",
        flexDirection: "column",
        gap: 6,
        alignItems: "center",
      }}
    >
      <div style={{ width: 150, height: 74, overflow: "hidden", position: "relative", pointerEvents: "none" }}>
        {Shape ? (
          <Shape element={element} elementType={elementType} selected={false} fieldTypesById={{}} compartmentTypesById={{}} />
        ) : (
          <span style={{ color: "var(--s-fg-muted)" }}>—</span>
        )}
      </div>
      <code style={{ fontSize: 11, color: "var(--s-fg-muted, #64748b)" }}>{id}</code>
    </div>
  );
}

/** Eén icoon-kaart: het icoon groot, met zijn registry-id. */
function IcoonKaart({ id }) {
  return (
    <div
      style={{
        border: "1px solid var(--s-border, #cbd5e1)",
        borderRadius: 8,
        background: "var(--s-panel, #fff)",
        padding: "10px 6px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        alignItems: "center",
      }}
    >
      <span style={{ color: "var(--s-fg)" }}>
        <TypeIcoon elementType={{ icoon: id, shape: "class-box" }} maat={28} />
      </span>
      <code style={{ fontSize: 11, color: "var(--s-fg-muted, #64748b)", textAlign: "center" }}>{id}</code>
    </div>
  );
}

function Main() {
  const shapeIds = alleShapeIds().filter((id) => id !== "anker");
  const icoonIds = alleIcoonIds();
  const sectie = { padding: "12px 16px" };
  const grid = (min) => ({ display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${min}px, 1fr))`, gap: 10, marginTop: 8 });
  return (
    <div style={{ height: "100%", overflow: "auto", color: "var(--s-fg)" }}>
      <div style={{ padding: "12px 16px 0" }}>
        <h2 style={{ margin: "0 0 2px" }}>Vormen &amp; iconen</h2>
        <p style={{ margin: 0, color: "var(--s-fg-muted, #64748b)", fontSize: 13 }}>
          De gedeelde registry's — dezelfde shapes en iconen die álle profielen gebruiken.
          Read-only; bewerken/toevoegen (SVG) volgt.
        </p>
      </div>
      <div style={sectie}>
        <h3 style={{ margin: 0, fontSize: 13, color: "var(--s-fg-muted, #64748b)" }}>
          Shapes ({shapeIds.length})
        </h3>
        <div style={grid(170)}>
          {shapeIds.map((id) => (
            <ShapeKaart key={id} id={id} />
          ))}
        </div>
      </div>
      <div style={sectie}>
        <h3 style={{ margin: 0, fontSize: 13, color: "var(--s-fg-muted, #64748b)" }}>
          Iconen ({icoonIds.length})
        </h3>
        <div style={grid(96)}>
          {icoonIds.map((id) => (
            <IcoonKaart key={id} id={id} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default {
  id: "studio-instellingen",
  label: "Studio-instellingen",
  icon: <IconInstellingen />,
  groep: "beheer",
  fullMain: true,
  Main,
};
