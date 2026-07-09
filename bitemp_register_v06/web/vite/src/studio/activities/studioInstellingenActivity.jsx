/**
 * studioInstellingenActivity — "Studio-instellingen": globale, profiel-
 * overstijgende instellingen (het Style-domein leeft globaal, niet per
 * profiel). Twee onderdelen:
 *
 *   1. Galerij (read-only): de gedeelde shape- en icoon-registry's, elk met
 *      live preview — dezelfde shapes/icons die álle profielen gebruiken.
 *   2. Eigen vormen: een editor voor **data-shapes** (vorm als data), die
 *      git-persistent zijn en overal bruikbaar worden (galerij, PE-kiezers,
 *      shape-sets) — zonder code te schrijven.
 */
import { useState } from "react";
import { IconInstellingen } from "../icons";
// Side-effect: registreert alle basis-shapes én de data-shapes in de registry,
// zodat de galerij de volledige registry toont ook zonder geopende canvas.
import "../../diagramcore/shapes/basisShapes.jsx";
import { alleShapeIds, getShape } from "../../diagramcore/shapes/shapeRegistry.js";
import { alleIcoonIds, TypeIcoon } from "../../diagramcore/shapes/typeIconen.jsx";
import { maakDataShapeComponent } from "../../diagramcore/shapes/dataShape.jsx";
import { leesVormen, bewaarVorm, verwijderVorm } from "./vormenRegistratie.js";

const kaartStijl = {
  border: "1px solid var(--s-border, #cbd5e1)",
  borderRadius: 8,
  background: "var(--s-panel, #fff)",
  padding: 8,
  display: "flex",
  flexDirection: "column",
  gap: 6,
  alignItems: "center",
};

/** Preview-box: rendert een shape-component op ware grootte, geschaald. */
function ShapePreviewBox({ Shape, naam = "Aa", kleur, schaal = 1 }) {
  const element = { naam, data: {}, compartimenten: [] };
  const elementType = { kleur: kleur || "#e2e8f0", compartments: [] };
  return (
    <div style={{ width: 150 * schaal, height: 74 * schaal, overflow: "hidden", position: "relative", pointerEvents: "none" }}>
      <div style={{ position: "absolute", top: 0, left: 0, width: 150, height: 74, transform: `scale(${schaal})`, transformOrigin: "top left" }}>
        {Shape ? (
          <Shape element={element} elementType={elementType} selected={false} fieldTypesById={{}} compartmentTypesById={{}} />
        ) : (
          <span style={{ color: "var(--s-fg-muted)" }}>—</span>
        )}
      </div>
    </div>
  );
}

const invoer = {
  font: "inherit",
  fontSize: 12,
  padding: "3px 6px",
  border: "1px solid var(--s-border, #cbd5e1)",
  borderRadius: 6,
  background: "var(--s-panel, #fff)",
  color: "var(--s-fg, #1e293b)",
};
const GRONDVORMEN = ["rechthoek", "afgerond", "stadium", "chip", "zeshoek", "afgeknipt"];

/** Editor voor één data-shape-concept (live preview + opslaan/verwijderen). */
function VormEditor({ start, onOpslaan, onVerwijderen, onSluiten }) {
  const [def, setDef] = useState(start);
  const zet = (patch) => setDef((d) => ({ ...d, ...patch }));
  const Preview = maakDataShapeComponent(def);
  const rij = (label, node) => (
    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
      <span style={{ width: 120, color: "var(--s-fg-muted, #64748b)" }}>{label}</span>
      {node}
    </label>
  );
  return (
    <div style={{ ...kaartStijl, alignItems: "stretch", gap: 10, maxWidth: 520 }}>
      <div style={{ display: "flex", gap: 14 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
          {rij("naam", <input style={{ ...invoer, flex: 1 }} value={def.label || ""} onChange={(e) => zet({ label: e.target.value })} />)}
          {rij(
            "grondvorm",
            <select style={{ ...invoer, flex: 1 }} value={def.grondvorm || "rechthoek"} onChange={(e) => zet({ grondvorm: e.target.value })}>
              {GRONDVORMEN.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          )}
          {rij("hoekradius", <input type="number" style={{ ...invoer, width: 80 }} value={def.hoekRadius ?? ""} placeholder="auto" onChange={(e) => zet({ hoekRadius: e.target.value === "" ? undefined : Number(e.target.value) })} />)}
          {rij(
            "rand",
            <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <select style={invoer} value={def.randStijl || "solid"} onChange={(e) => zet({ randStijl: e.target.value })}>
                <option value="solid">doorgetrokken</option>
                <option value="dashed">gestippeld</option>
              </select>
              <input type="number" style={{ ...invoer, width: 56 }} value={def.randDikte ?? 2} onChange={(e) => zet({ randDikte: Number(e.target.value) || 0 })} title="dikte (px)" />
            </span>
          )}
          {rij("vulling", <input type="color" value={def.vulling || "#e2e8f0"} onChange={(e) => zet({ vulling: e.target.value })} style={{ width: 40, height: 24, padding: 0, border: "1px solid var(--s-border)", borderRadius: 6, cursor: "pointer" }} />)}
          {rij("clip-path", <input style={{ ...invoer, flex: 1, fontFamily: "monospace", fontSize: 11 }} value={def.clipPath || ""} placeholder="(eigen polygon/path — wint van grondvorm)" onChange={(e) => zet({ clipPath: e.target.value || undefined })} />)}
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <span style={{ fontSize: 11, color: "var(--s-fg-muted, #64748b)" }}>preview</span>
          <ShapePreviewBox Shape={Preview} naam={def.label || def.id} kleur={def.vulling} />
          <code style={{ fontSize: 10, color: "var(--s-fg-muted, #64748b)" }}>{def.id}</code>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="dc-mini-knop" onClick={() => onOpslaan(def)}>Opslaan</button>
        <button className="dc-mini-knop" onClick={onSluiten}>Annuleren</button>
        {onVerwijderen && (
          <button className="dc-mini-knop is-gevaar" style={{ marginLeft: "auto" }} onClick={onVerwijderen}>Verwijderen</button>
        )}
      </div>
    </div>
  );
}

function Main() {
  const [versie, setVersie] = useState(0);
  const [bewerk, setBewerk] = useState(null); // data-shape-concept in bewerking, of null
  const ververs = () => setVersie((v) => v + 1);

  const eigenVormen = leesVormen();
  const eigenIds = new Set(Object.keys(eigenVormen));
  const shapeIds = alleShapeIds().filter((id) => id !== "anker");
  const icoonIds = alleIcoonIds();

  const nieuweVorm = () => {
    const naam = window.prompt("Naam van de nieuwe vorm:", "Mijn vorm");
    if (!naam) return;
    const id = naam.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "vorm";
    setBewerk({ id, label: naam, grondvorm: "afgerond", randDikte: 2, vulling: "#e2e8f0" });
  };
  const opslaan = (def) => {
    bewaarVorm(def);
    setBewerk(null);
    ververs();
  };
  const verwijderen = (def) => {
    if (!window.confirm(`Vorm "${def.label || def.id}" verwijderen?`)) return;
    verwijderVorm(def.id);
    setBewerk(null);
    ververs();
  };

  const sectie = { padding: "12px 16px" };
  const grid = (min) => ({ display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${min}px, 1fr))`, gap: 10, marginTop: 8 });

  return (
    <div style={{ height: "100%", overflow: "auto", color: "var(--s-fg)" }}>
      <div style={{ padding: "12px 16px 0" }}>
        <h2 style={{ margin: "0 0 2px" }}>Vormen &amp; iconen</h2>
        <p style={{ margin: 0, color: "var(--s-fg-muted, #64748b)", fontSize: 13 }}>
          De gedeelde registry's — dezelfde shapes en iconen die álle profielen gebruiken.
        </p>
      </div>

      {/* Eigen vormen (data-shapes): maken/bewerken. */}
      <div style={sectie}>
        <h3 style={{ margin: 0, fontSize: 13, color: "var(--s-fg-muted, #64748b)", display: "flex", alignItems: "center", gap: 10 }}>
          Eigen vormen ({eigenIds.size})
          <button className="dc-mini-knop" onClick={nieuweVorm}>＋ nieuwe vorm</button>
        </h3>
        {bewerk && (
          <div style={{ marginTop: 8 }}>
            <VormEditor
              key={bewerk.id}
              start={bewerk}
              onOpslaan={opslaan}
              onVerwijderen={eigenIds.has(bewerk.id) ? () => verwijderen(bewerk) : null}
              onSluiten={() => setBewerk(null)}
            />
          </div>
        )}
        {eigenIds.size > 0 && (
          <div style={grid(170)}>
            {Object.values(eigenVormen).map((def) => (
              <div key={def.id} style={{ ...kaartStijl, cursor: "pointer" }} onClick={() => setBewerk(def)} title="Klik om te bewerken">
                <ShapePreviewBox Shape={getShape(def.id)} naam={def.label} kleur={def.vulling} />
                <code style={{ fontSize: 11, color: "var(--s-fg-muted, #64748b)" }}>{def.id} ✎</code>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={sectie}>
        <h3 style={{ margin: 0, fontSize: 13, color: "var(--s-fg-muted, #64748b)" }}>Ingebouwde shapes ({shapeIds.length})</h3>
        <div style={grid(170)}>
          {shapeIds.map((id) => (
            <div key={id} style={kaartStijl}>
              <ShapePreviewBox Shape={getShape(id)} naam={id} />
              <code style={{ fontSize: 11, color: "var(--s-fg-muted, #64748b)" }}>{id}{eigenIds.has(id) ? " (eigen)" : ""}</code>
            </div>
          ))}
        </div>
      </div>

      <div style={sectie}>
        <h3 style={{ margin: 0, fontSize: 13, color: "var(--s-fg-muted, #64748b)" }}>Iconen ({icoonIds.length})</h3>
        <div style={grid(96)}>
          {icoonIds.map((id) => (
            <div key={id} style={{ ...kaartStijl, padding: "10px 6px" }}>
              <span style={{ color: "var(--s-fg)" }}>
                <TypeIcoon elementType={{ icoon: id, shape: "class-box" }} maat={28} />
              </span>
              <code style={{ fontSize: 11, color: "var(--s-fg-muted, #64748b)", textAlign: "center" }}>{id}</code>
            </div>
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
