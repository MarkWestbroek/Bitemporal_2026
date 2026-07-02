/**
 * basisShapes — de standaard ShapeTypes van de core (Implementatie-domein).
 *
 *   class-box — UML-klassenbox: header (stereotype/naam/badge) + compartimenten
 *   note      — gele post-it (leest element.data.tekst)
 *   rounded   — afgeronde rechthoek met expressie (constraints)
 *   anker     — klein cirkelvormig ankerpunt (associatieklasse-constructie)
 *
 * Visueel gelijkwaardig aan de umleditor-nodes (fase 1: pariteit), maar
 * volledig data-gedreven: geen domeinkennis, alles komt uit element +
 * elementType. Registratie gebeurt onderaan dit bestand.
 */
import { registreerShape } from "./shapeRegistry.js";

/** Eén veld-regel, gerenderd volgens FieldType.render. */
function VeldRegel({ veld, fieldType }) {
  const render = fieldType?.render || "naam-type";
  const d = veld.data || {};

  if (render === "waarde") {
    return <div className="dc-veld is-waarde">{veld.naam}</div>;
  }
  if (render === "tekst") {
    return <div className="dc-veld is-tekst">{veld.naam}</div>;
  }
  // "naam-type": naam links (vet indien verplicht), typeLabel rechts
  return (
    <div className={"dc-veld" + (d.cursief ? " is-cursief" : "")}>
      <span className="dc-veld-naam">
        {d.afgeleid && <span className="dc-veld-afgeleid">/</span>}
        {d.verplicht ? <strong>{veld.naam}</strong> : <span>{veld.naam}</span>}
      </span>
      {d.typeLabel ? <span className="dc-veld-type">{d.typeLabel}</span> : null}
    </div>
  );
}

/** Compartimenten-stapel: divider + (optioneel label) + veld-regels. */
export function CompartimentLijst({ element, fieldTypesById, compartmentTypesById }) {
  const compartimenten = element.compartimenten || [];
  return (
    <>
      {compartimenten
        .filter((c) => (c.velden || []).length > 0)
        .map((c, i) => {
          const ct = compartmentTypesById?.[c.compartmentType];
          return (
            <div key={c.compartmentType || i}>
              <div className="dc-divider" />
              <div className="dc-compartiment">
                {ct?.label ? <div className="dc-compartiment-label">{ct.label}</div> : null}
                {c.velden.map((v, j) => (
                  <VeldRegel key={j} veld={v} fieldType={fieldTypesById?.[v.fieldType]} />
                ))}
              </div>
            </div>
          );
        })}
    </>
  );
}

/** UML-klassenbox. */
function ClassBoxShape({ element, elementType, selected, fieldTypesById, compartmentTypesById, children }) {
  const d = element.data || {};
  const borderColor = selected ? "#2563eb" : "#94a3b8";
  return (
    <div
      className="dc-node"
      style={{
        borderColor,
        borderWidth: elementType.id === "entiteit" ? 3 : 2,
        backgroundColor: d.kleur || elementType.kleur || "#f1f5f9",
      }}
    >
      {children}
      <div className="dc-node-header">
        <div className="dc-stereotype">{d.stereotype || elementType.stereotype || ""}</div>
        <div className={"dc-naam" + (d.abstract ? " is-abstract" : "")}>
          {element.naam || "(naamloos)"}
        </div>
        {d.materieel && <div className="dc-badge">materieel</div>}
      </div>
      <CompartimentLijst
        element={element}
        fieldTypesById={fieldTypesById}
        compartmentTypesById={compartmentTypesById}
      />
    </div>
  );
}

/** Gele post-it notitie. */
function NoteShape({ element, selected, children }) {
  const d = element.data || {};
  const borderColor = selected ? "#f59e0b" : "#fbbf24";
  return (
    <div
      className="dc-node"
      style={{
        minWidth: 160,
        minHeight: 60,
        borderRadius: 4,
        border: `2px solid ${borderColor}`,
        backgroundColor: d.kleur || "#fffde7",
        boxShadow: "2px 3px 6px rgba(0,0,0,0.25)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {children}
      <div
        style={{
          background: "rgba(0,0,0,0.06)",
          borderBottom: `1px solid ${borderColor}`,
          padding: "3px 8px",
          fontSize: 11,
          fontWeight: 700,
          color: "#78350f",
        }}
      >
        📝 Notitie
      </div>
      <div style={{ flex: 1, padding: "6px 8px", fontSize: 12, color: "#44403c", whiteSpace: "pre-wrap", lineHeight: 1.45 }}>
        {d.tekst || <span style={{ color: "#a8a29e", fontStyle: "italic" }}>(geen tekst)</span>}
      </div>
    </div>
  );
}

/** Afgeronde rechthoek met expressie (constraint). */
function RoundedShape({ element, elementType, selected, children }) {
  const d = element.data || {};
  const borderColor = selected ? "#2563eb" : "#7dd3fc";
  return (
    <div
      className="dc-node"
      style={{
        borderRadius: 16,
        border: `2px solid ${borderColor}`,
        backgroundColor: d.kleur || elementType.kleur || "#e0f2fe",
        padding: "6px 12px",
      }}
    >
      {children}
      <div className="dc-node-header" style={{ padding: 0 }}>
        <div className="dc-stereotype">{d.stereotype || elementType.stereotype || ""}</div>
        <div className="dc-naam" style={{ fontSize: 12 }}>{element.naam || "(naamloos)"}</div>
      </div>
      {d.expressie ? (
        <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, color: "#0c4a6e", marginTop: 4, whiteSpace: "pre-wrap" }}>
          {`{${d.expressie}}`}
        </div>
      ) : null}
    </div>
  );
}

/** Klein cirkelvormig ankerpunt (associatieklasse-constructie). */
function AnkerShape({ selected, children }) {
  const borderColor = selected ? "#2563eb" : "#94a3b8";
  return (
    <div
      style={{
        width: 14,
        height: 14,
        borderRadius: "50%",
        border: `2px solid ${borderColor}`,
        backgroundColor: selected ? "#dbeafe" : "#f1f5f9",
        position: "relative",
      }}
    >
      {children}
    </div>
  );
}

registreerShape("class-box", ClassBoxShape);
registreerShape("note", NoteShape);
registreerShape("rounded", RoundedShape);
registreerShape("anker", AnkerShape);

export { ClassBoxShape, NoteShape, RoundedShape, AnkerShape };
