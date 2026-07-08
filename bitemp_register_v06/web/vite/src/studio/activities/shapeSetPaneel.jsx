/**
 * shapeSetPaneel — het shape-set-matrixpaneel van de profiel-editor (P07).
 *
 * Shape-sets horen in het Style-domein (vorm), niet in de profiel-definitie:
 * daarom geen canvas-node maar dit aparte onder-dock-paneel, dat alleen in de
 * PE bestaat. Een matrix van **elementtypen** (rijen, = functie) tegen
 * **gedaanten** (kolommen):
 *
 *   - Kolom 0 "Standaard" = de eigen shape/icoon/kleur van het elementtype
 *     (dezelfde data als op de Elementtype-node; bewerken hier ⇄ daar).
 *   - Kolom 1..n = extra shape-sets die de standaard **overriden op volgorde**
 *     (leeg = neemt de standaard over). Elke cel is een volledige "skin":
 *     shape + icoon + kleur.
 *
 * Data leeft op het ontwerp-diagram (Style-data, via updateDiagramStijl); bij
 * *Activeer profiel…* gaat het pass-through naar descriptor.shapeSets.
 */
import { getShape, alleShapeIds } from "../../diagramcore/shapes/shapeRegistry.js";
import { TypeIcoon, alleIcoonIds } from "../../diagramcore/shapes/typeIconen.jsx";
import { slug } from "./profielOntwerp.js";

/** Alle bruikbare shape-ids — bij render (de registry vult zich bij import). */
const shapeOpties = () => alleShapeIds().filter((id) => !["anker", "edge"].includes(id));

/** Skin-waarde normaliseren: een kale string telt als alleen-shape. */
function alsSkin(waarde) {
  if (!waarde) return {};
  return typeof waarde === "string" ? { shape: waarde } : waarde;
}

/** Mini-preview van een shape in de gegeven kleur (of grijs). */
function ShapePreview({ shapeId, kleur }) {
  const Shape = getShape(shapeId || "class-box");
  const el = { naam: "Aa", data: { kleur }, compartimenten: [] };
  const et = { kleur: kleur || "#e2e8f0", compartments: [] };
  return (
    <div
      style={{ width: 54, height: 30, overflow: "hidden", borderRadius: 4, position: "relative", pointerEvents: "none", flexShrink: 0 }}
      title={shapeId || "class-box"}
    >
      <div style={{ position: "absolute", top: 1, left: 1, width: 150, height: 72, transform: "scale(0.34)", transformOrigin: "top left" }}>
        {Shape ? <Shape element={el} elementType={et} selected={false} fieldTypesById={{}} compartmentTypesById={{}} /> : null}
      </div>
    </div>
  );
}

const selStijl = {
  font: "inherit",
  fontSize: 11,
  padding: "1px 2px",
  border: "1px solid var(--s-border, #cbd5e1)",
  borderRadius: 5,
  background: "var(--s-panel, #fff)",
  color: "var(--s-fg, #1e293b)",
  maxWidth: 96,
};

/** Eén cel: shape + icoon + kleur (leeg toegestaan wanneer overerfbaar). */
function Cel({ skin, standaard, metLeeg, onChange }) {
  const s = alsSkin(skin);
  const effShape = s.shape || (metLeeg ? "" : standaard?.shape || "class-box");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 116 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
        <ShapePreview shapeId={effShape || standaard?.shape} kleur={s.kleur || standaard?.kleur} />
        <select style={selStijl} value={s.shape || ""} onChange={(e) => onChange({ ...s, shape: e.target.value || undefined })}>
          {metLeeg && <option value="">— (std)</option>}
          {shapeOpties().map((id) => (
            <option key={id} value={id}>{id}</option>
          ))}
        </select>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
        <span style={{ width: 18, display: "inline-flex", justifyContent: "center", flexShrink: 0 }}>
          <TypeIcoon elementType={{ icoon: s.icoon || standaard?.icoon, shape: effShape || "class-box" }} maat={14} />
        </span>
        <select style={selStijl} value={s.icoon || ""} onChange={(e) => onChange({ ...s, icoon: e.target.value || undefined })}>
          <option value="">{metLeeg ? "— (std)" : "(volgt shape)"}</option>
          {alleIcoonIds().map((id) => (
            <option key={id} value={id}>{id}</option>
          ))}
        </select>
        <input
          type="color"
          title="kleur"
          value={s.kleur || standaard?.kleur || "#e2e8f0"}
          onChange={(e) => onChange({ ...s, kleur: e.target.value })}
          style={{ width: 22, height: 20, padding: 0, border: "1px solid var(--s-border, #cbd5e1)", borderRadius: 4, cursor: "pointer", flexShrink: 0 }}
        />
        {metLeeg && (s.shape || s.icoon || s.kleur) && (
          <button
            className="dc-mini-knop"
            title="Cel leegmaken (neemt de standaard over)"
            onClick={() => onChange(null)}
            style={{ padding: "0 5px" }}
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}

export default function ShapeSetPaneel({ useStore }) {
  const actief = useStore((s) => s.actiefDiagramId);
  const diagram = useStore((s) => s.diagrams[s.actiefDiagramId]);
  const elements = useStore((s) => s.elements);
  if (!diagram) {
    return <p style={{ margin: 10, color: "var(--s-fg-muted)" }}>Geen profiel actief.</p>;
  }

  // Rijen = de Elementtype-nodes van dit ontwerp (de ElementtypeSet).
  const rijen = (diagram.nodes || [])
    .map((n) => elements[n.elementId])
    .filter((el) => el?.elementType === "elementDef");
  const sets = diagram.shapeSets || [];

  const standaardVan = (el) => ({
    shape: el.data?.shape || "class-box",
    icoon: el.data?.icoon,
    kleur: el.data?.doelKleur,
  });

  const zetStandaard = (el, skin) =>
    useStore.getState().updateElement(el.id, {
      data: { shape: skin.shape || "class-box", icoon: skin.icoon || undefined, doelKleur: skin.kleur || undefined },
    });

  const zetCel = (setIndex, sleutel, skin) => {
    const next = sets.map((set, i) => {
      if (i !== setIndex) return set;
      const shapes = { ...(set.shapes || {}) };
      if (skin) shapes[sleutel] = skin;
      else delete shapes[sleutel];
      return { ...set, shapes };
    });
    useStore.getState().updateDiagramStijl(actief, { shapeSets: next });
  };

  const nieuweSet = () => {
    const label = window.prompt("Naam van de nieuwe gedaante (shape-set):", `Stijl ${sets.length + 1}`);
    if (!label) return;
    useStore.getState().updateDiagramStijl(actief, {
      shapeSets: [...sets, { id: slug(label), label, shapes: {} }],
    });
  };
  const hernoemSet = (i) => {
    const label = window.prompt("Nieuwe naam:", sets[i].label || sets[i].id);
    if (!label) return;
    const next = sets.map((set, j) => (j === i ? { ...set, label } : set));
    useStore.getState().updateDiagramStijl(actief, { shapeSets: next });
  };
  const verwijderSet = (i) => {
    if (!window.confirm(`Gedaante "${sets[i].label || sets[i].id}" verwijderen?`)) return;
    useStore.getState().updateDiagramStijl(actief, { shapeSets: sets.filter((_, j) => j !== i) });
  };

  const kopStijl = {
    position: "sticky",
    top: 0,
    background: "var(--s-panel, #fff)",
    textAlign: "left",
    padding: "4px 8px",
    fontSize: 11,
    color: "var(--s-fg-muted, #64748b)",
    borderBottom: "1px solid var(--s-border, #cbd5e1)",
    whiteSpace: "nowrap",
  };
  const celStijl = { padding: "4px 8px", borderBottom: "1px solid var(--s-border, #e2e8f0)", verticalAlign: "top" };

  if (!rijen.length) {
    return (
      <p style={{ margin: 10, color: "var(--s-fg-muted)" }}>
        Teken eerst Elementtype-nodes; dan verschijnen ze hier als rijen.
      </p>
    );
  }

  return (
    <div style={{ padding: 8, overflow: "auto" }}>
      <table style={{ borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr>
            <th style={kopStijl}>Elementtype</th>
            <th style={kopStijl}>Standaard</th>
            {sets.map((set, i) => (
              <th key={set.id} style={kopStijl}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  {set.label || set.id}
                  <button className="dc-mini-knop" title="Hernoemen" onClick={() => hernoemSet(i)} style={{ padding: "0 4px" }}>✎</button>
                  <button className="dc-mini-knop is-gevaar" title="Verwijderen" onClick={() => verwijderSet(i)} style={{ padding: "0 4px" }}>×</button>
                </span>
              </th>
            ))}
            <th style={kopStijl}>
              <button className="dc-mini-knop" onClick={nieuweSet}>＋ gedaante</button>
            </th>
          </tr>
        </thead>
        <tbody>
          {rijen.map((el) => {
            const sleutel = slug(el.naam);
            const std = standaardVan(el);
            return (
              <tr key={el.id}>
                <td style={{ ...celStijl, fontWeight: 600, whiteSpace: "nowrap" }}>{el.naam || "(naamloos)"}</td>
                <td style={celStijl}>
                  <Cel skin={std} standaard={std} metLeeg={false} onChange={(skin) => zetStandaard(el, skin)} />
                </td>
                {sets.map((set, i) => (
                  <td key={set.id} style={celStijl}>
                    <Cel
                      skin={set.shapes?.[sleutel]}
                      standaard={std}
                      metLeeg
                      onChange={(skin) => zetCel(i, sleutel, skin)}
                    />
                  </td>
                ))}
                <td style={celStijl} />
              </tr>
            );
          })}
        </tbody>
      </table>
      <p style={{ margin: "8px 2px 2px", fontSize: 11, color: "var(--s-fg-muted, #64748b)" }}>
        Kolom <b>Standaard</b> = de eigen vorm van het type. Extra gedaanten overriden op volgorde;
        een lege cel neemt de standaard over. Wisselen doe je via <b>Beeld → Shape-set</b> na activeren.
      </p>
    </div>
  );
}
