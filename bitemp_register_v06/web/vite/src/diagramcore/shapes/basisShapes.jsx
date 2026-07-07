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
import { TypeIcoon } from "./typeIconen.jsx";

/**
 * Typering-regel in de node-kop (vormgevingssessie 2026-07-07, MIM-besluit):
 * rendert zowel het mini-icoon als de stereotype-tekst; welke zichtbaar is
 * bepaalt `data-dc-typering` op het canvasvlak (geen | icoon | tekst) via
 * CSS. Default ("tekst") = het huidige gedrag: alleen de stereotype-regel.
 */
function NodeTypering({ element, elementType }) {
  const d = element.data || {};
  return (
    <>
      <div className="dc-type-icoon">
        <TypeIcoon elementType={elementType} maat={13} />
      </div>
      <div className="dc-stereotype">{d.stereotype || elementType.stereotype || ""}</div>
    </>
  );
}

/** Gestippelde rand = "inhoud elders beheerd" (element-data wint van het type). */
const isDashed = (element, elementType) =>
  (element.data?.randStijl || elementType.randStijl) === "dashed";

/** Eén veld-regel, gerenderd volgens de FieldTypeViewer (fieldType.viewer). */
function VeldRegel({ veld, fieldType }) {
  const viewer = fieldType?.viewer || fieldType?.render || "naam-type";
  const d = veld.data || {};

  if (viewer === "waarde") {
    return <div className="dc-veld is-waarde">{veld.naam}</div>;
  }
  if (viewer === "tekst") {
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

/**
 * UML-klassenbox. Vormgrammatica-knoppen (per ElementType, allemaal
 * optioneel): `randDikte` (identiteit = dik), `hoekRadius` (structuur =
 * rond), `randStijl: "dashed"` (inhoud elders beheerd).
 */
function ClassBoxShape({ element, elementType, selected, fieldTypesById, compartmentTypesById, children }) {
  const d = element.data || {};
  const borderColor = selected ? "var(--dc-selectie, #2563eb)" : "var(--dc-node-rand, #94a3b8)";
  return (
    <div
      className="dc-node"
      style={{
        borderColor,
        borderWidth: elementType.randDikte ?? (elementType.id === "entiteit" ? 3 : 2),
        ...(elementType.hoekRadius !== undefined ? { borderRadius: elementType.hoekRadius } : {}),
        ...(isDashed(element, elementType) ? { borderStyle: "dashed" } : {}),
        backgroundColor: d.kleur || elementType.kleur || "var(--dc-node-vulling, #f1f5f9)",
      }}
    >
      {children}
      <div className="dc-node-header">
        <NodeTypering element={element} elementType={elementType} />
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

/**
 * Chip — de waarde-familie van de vormgrammatica (MIM-besluit 2026-07-07):
 * sterk afgeronde uiteinden, dunne rand. Gestippeld (`randStijl: "dashed"`)
 * = de inhoud leeft buiten het model (codelijst). Compartimenten (waarden,
 * data-elementen) renderen gewoon binnen de chip.
 */
function ChipShape({ element, elementType, selected, fieldTypesById, compartmentTypesById, children }) {
  const d = element.data || {};
  const borderColor = selected ? "var(--dc-selectie, #2563eb)" : "var(--dc-node-rand, #94a3b8)";
  return (
    <div
      className="dc-node"
      style={{
        minWidth: 150,
        borderColor,
        borderWidth: 1.5,
        borderRadius: 22,
        ...(isDashed(element, elementType) ? { borderStyle: "dashed" } : {}),
        backgroundColor: d.kleur || elementType.kleur || "var(--dc-node-vulling, #f1f5f9)",
        padding: "2px 8px 4px",
      }}
    >
      {children}
      <div className="dc-node-header" style={{ padding: "4px 10px 3px" }}>
        <NodeTypering element={element} elementType={elementType} />
        <div className={"dc-naam" + (d.abstract ? " is-abstract" : "")} style={{ fontSize: 13 }}>
          {element.naam || "(naamloos)"}
        </div>
      </div>
      <CompartimentLijst
        element={element}
        fieldTypesById={fieldTypesById}
        compartmentTypesById={compartmentTypesById}
      />
    </div>
  );
}

/**
 * Knip-box — vier afgeknipte hoeken: "meerdere gedaanten" (MIM-keuze).
 * Zelfde laag-techniek als de DMN-BKM (CSS-borders kunnen geen diagonale
 * knippen volgen): rand-laag + 1.5px kleinere vul-laag, inhoud erbovenop.
 */
function KnipBoxShape({ element, elementType, selected, fieldTypesById, compartmentTypesById, children }) {
  const d = element.data || {};
  const rand = selected ? "var(--dc-selectie, #2563eb)" : "var(--dc-node-rand, #94a3b8)";
  const KNIP = 13;
  const knip = (k) =>
    `polygon(${k}px 0, calc(100% - ${k}px) 0, 100% ${k}px, 100% calc(100% - ${k}px), calc(100% - ${k}px) 100%, ${k}px 100%, 0 calc(100% - ${k}px), 0 ${k}px)`;
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        minWidth: 160,
        minHeight: 52,
        position: "relative",
        cursor: "grab",
        fontSize: 12,
        filter: "drop-shadow(0 1px 3px rgba(0, 0, 0, 0.12))",
      }}
    >
      {children}
      <div style={{ position: "absolute", inset: 0, clipPath: knip(KNIP), background: rand }} />
      <div
        style={{
          position: "absolute",
          inset: 1.5,
          clipPath: knip(KNIP - 1),
          background: d.kleur || elementType.kleur || "var(--dc-node-vulling, #f1f5f9)",
        }}
      />
      <div style={{ position: "relative", zIndex: 1, padding: "2px 14px 4px" }}>
        <div className="dc-node-header" style={{ padding: "4px 0 3px" }}>
          <NodeTypering element={element} elementType={elementType} />
          <div className={"dc-naam" + (d.abstract ? " is-abstract" : "")} style={{ fontSize: 13 }}>
            {element.naam || "(naamloos)"}
          </div>
        </div>
        <CompartimentLijst
          element={element}
          fieldTypesById={fieldTypesById}
          compartmentTypesById={compartmentTypesById}
        />
      </div>
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
  const borderColor = selected ? "var(--dc-selectie, #2563eb)" : "var(--dc-node-rand, #94a3b8)";
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

/**
 * Boundary/kader (plan §8.6b): resizebaar kader dat achter de andere
 * elementen rendert (ElementType.achtergrond → zIndex -1 in de canvas).
 * Meestal puur vormgeving; een profiel kan er betekenis aan hangen.
 */
function BoundaryShape({ element, selected, children }) {
  const d = element.data || {};
  const rand = selected ? "#2563eb" : d.kleur || "#94a3b8";
  // Rand- en achtergrondkleur zijn apart instelbaar; zonder achtergrondkleur
  // een subtiele tint van de randkleur (~8%).
  const achtergrond = d.achtergrondKleur || (d.kleur ? `${d.kleur}14` : "transparent");
  return (
    <div
      className="dc-node"
      style={{
        minWidth: 240,
        minHeight: 160,
        border: `2px dashed ${rand}`,
        borderRadius: 10,
        background: achtergrond,
        boxShadow: "none",
      }}
    >
      {children}
      <div
        style={{
          position: "absolute",
          top: 4,
          left: 10,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.03em",
          color: rand,
          pointerEvents: "none",
        }}
      >
        {element.naam || "(kader)"}
      </div>
    </div>
  );
}

/**
 * Graaf-bol (POC, plan §8.10): de naam in een ronde kern, en de velden van
 * de compartimenten als kleine satelliet-bolletjes eromheen (spaak-lijntjes
 * naar de kern). Grafen lezen als bolletjes, UML als dozen — zelfde element,
 * andere ShapeType; de shape bepaalt zelf hoe hij zijn velden rendert.
 *
 * De node zélf is alleen de kern (hit-box en handles = de cirkel); de
 * satellieten steken er als decoratie overheen uit (pointer-events: none),
 * zodat edge-labels en andere elementen achter de "lege hoeken" gewoon
 * aanklikbaar blijven.
 */
function BolShape({ element, elementType, selected, children }) {
  const d = element.data || {};
  const kleur = d.kleur || elementType.kleur || "#a5b4fc";
  const rand = selected ? "var(--dc-selectie, #2563eb)" : "var(--dc-node-rand, #64748b)";
  const velden = (element.compartimenten || [])
    .flatMap((c) => c.velden || [])
    .filter((v) => v.naam);

  const KERN_R = 46;
  const SAT_R = 19;
  const ORBIT = KERN_R + SAT_R + 14;
  const MAAT = 2 * (ORBIT + SAT_R + 4);
  const M = MAAT / 2;
  // Posities relatief aan de container (kern-vierkant); centrum = (KERN_R, KERN_R).
  const posities = velden.map((_, i) => {
    const hoek = (i / Math.max(velden.length, 1)) * 2 * Math.PI - Math.PI / 2;
    return { x: KERN_R + ORBIT * Math.cos(hoek), y: KERN_R + ORBIT * Math.sin(hoek) };
  });

  return (
    <div
      className="dc-bol"
      style={{
        width: KERN_R * 2,
        height: KERN_R * 2,
        position: "relative",
        borderRadius: "50%",
        background: kleur,
        border: `${selected ? 2.5 : 1.5}px solid ${rand}`,
        boxSizing: "border-box",
      }}
    >
      {children}
      {/* Spaken + satellieten: decoratie búiten de node-box (geen hit-area). */}
      <svg
        width={MAAT}
        height={MAAT}
        style={{
          position: "absolute",
          left: KERN_R - M,
          top: KERN_R - M,
          pointerEvents: "none",
          overflow: "visible",
          zIndex: -1,
        }}
      >
        {posities.map((p, i) => (
          <line
            key={i}
            x1={M}
            y1={M}
            x2={M - KERN_R + p.x}
            y2={M - KERN_R + p.y}
            stroke={rand}
            strokeWidth="1"
            opacity="0.45"
          />
        ))}
        {posities.map((p, i) => (
          <circle
            key={`s${i}`}
            className="dc-bol-sat"
            cx={M - KERN_R + p.x}
            cy={M - KERN_R + p.y}
            r={SAT_R}
            fill="var(--s-panel, #ffffff)"
            stroke={rand}
            strokeWidth="1.2"
          />
        ))}
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          fontWeight: 600,
          fontSize: 12,
          color: "#1e293b",
          padding: 8,
          overflow: "hidden",
          pointerEvents: "none",
        }}
      >
        {element.naam || "(naamloos)"}
      </div>
      {velden.map((v, i) => (
        <div
          key={i}
          title={`${v.naam}${v.data?.typeLabel ? `: ${v.data.typeLabel}` : ""}`}
          style={{
            position: "absolute",
            left: posities[i].x - SAT_R,
            top: posities[i].y - SAT_R,
            width: SAT_R * 2,
            height: SAT_R * 2,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            fontSize: 8.5,
            lineHeight: 1.05,
            color: "var(--s-fg, #334155)",
            overflow: "hidden",
            pointerEvents: "none",
          }}
        >
          {v.naam.length > 12 ? `${v.naam.slice(0, 11)}…` : v.naam}
        </div>
      ))}
    </div>
  );
}

/**
 * UML-package: de "hangmap" — een naam-tab linksboven die zijn onderrand
 * deelt met de romp eronder (UML §12.2). De tab draagt de naam; de romp is
 * verder leeg en fungeert als drop-doel (ElementType.containerVoor).
 */
function PackageShape({ element, elementType, selected, children }) {
  const d = element.data || {};
  const rand = selected ? "var(--dc-selectie, #2563eb)" : "var(--dc-node-rand, #94a3b8)";
  const vulling = d.kleur || elementType.kleur || "var(--dc-node-vulling, #f1f5f9)";
  // Gestippeld = extern beheerd (bv. het MIM-«extern»-package).
  const stijl = isDashed(element, elementType) ? "dashed" : "solid";
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        minWidth: 200,
        minHeight: 110,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        position: "relative",
        cursor: "grab",
      }}
    >
      {children}
      {/* De tab overlapt de bovenrand van de romp (marginBottom -2 + zIndex),
          zodat tab en romp één doorlopende contour vormen — de hangmap. */}
      <div
        style={{
          maxWidth: "65%",
          padding: "3px 14px 4px",
          borderTop: `2px ${stijl} ${rand}`,
          borderLeft: `2px ${stijl} ${rand}`,
          borderRight: `2px ${stijl} ${rand}`,
          borderRadius: "6px 6px 0 0",
          background: vulling,
          fontSize: 12,
          fontWeight: 700,
          color: "#0f172a",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          position: "relative",
          zIndex: 1,
          marginBottom: -2,
        }}
      >
        {element.naam || "(naamloos)"}
      </div>
      <div
        style={{
          flex: 1,
          alignSelf: "stretch",
          border: `2px ${stijl} ${rand}`,
          borderRadius: "0 8px 8px 8px",
          background: vulling,
          boxShadow: "0 1px 4px rgba(0, 0, 0, 0.1)",
          padding: "6px 10px",
        }}
      >
        <div className="dc-stereotype">{d.stereotype || elementType.stereotype || ""}</div>
      </div>
    </div>
  );
}

/* ── DMN/DRD-shapes (vormgevingssessie 2026-07-05, t.b.v. het DMN-profiel) ──
   DMN §6.2 schrijft de DRD-vormen voor: Decision = rechthoek (class-box),
   Input Data = "stadium" (rechthoek met halfronde uiteinden), Business
   Knowledge Model = rechthoek met afgeknipte hoeken linksboven/rechtsonder,
   Knowledge Source = rechthoek met golvende onderrand. DRD-nodes tonen
   alleen hun naam (geen compartimenten). Kleuren komen uit het profiel. */

/** Gedeelde naam-overlay voor de DMN-shapes (stereotype klein, naam vet). */
function DmnNaam({ element, elementType, extraStijl }) {
  const d = element.data || {};
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "4px 14px",
        pointerEvents: "none",
        ...extraStijl,
      }}
    >
      <div className="dc-stereotype">{d.stereotype || elementType.stereotype || ""}</div>
      <div className="dc-naam" style={{ fontSize: 13 }}>{element.naam || "(naamloos)"}</div>
    </div>
  );
}

/** DMN Input Data: stadiumvorm — twee rechte zijden, halfronde uiteinden. */
function DmnInputDataShape({ element, elementType, selected, children }) {
  const d = element.data || {};
  const rand = selected ? "var(--dc-selectie, #2563eb)" : "var(--dc-node-rand, #94a3b8)";
  // Zelfde dashed-conventie als de andere shapes (isDashed-vlag van het type).
  const stijl = isDashed(element, elementType) ? "dashed" : "solid";
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        minWidth: 150,
        minHeight: 56,
        position: "relative",
        border: `2px ${stijl} ${rand}`,
        borderRadius: 999,
        background: d.kleur || elementType.kleur || "var(--dc-node-vulling, #f1f5f9)",
        boxShadow: "0 1px 4px rgba(0, 0, 0, 0.1)",
        cursor: "grab",
      }}
    >
      {children}
      <DmnNaam element={element} elementType={elementType} />
    </div>
  );
}

/**
 * DMN Business Knowledge Model: rechthoek met afgeknipte hoeken (linksboven
 * en rechtsonder). Twee gelijk geknipte lagen op elkaar — de onderste in de
 * randkleur, de bovenste 2px kleiner in de vulkleur — geven een strakke rand
 * die de diagonale knippen volgt (CSS-borders kunnen dat niet).
 */
function DmnBkmShape({ element, elementType, selected, children }) {
  const d = element.data || {};
  const rand = selected ? "var(--dc-selectie, #2563eb)" : "var(--dc-node-rand, #94a3b8)";
  const KNIP = 14;
  const knip = (k) =>
    `polygon(${k}px 0, 100% 0, 100% calc(100% - ${k}px), calc(100% - ${k}px) 100%, 0 100%, 0 ${k}px)`;
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        minWidth: 160,
        minHeight: 64,
        position: "relative",
        cursor: "grab",
        filter: "drop-shadow(0 1px 3px rgba(0, 0, 0, 0.12))",
      }}
    >
      {children}
      <div style={{ position: "absolute", inset: 0, clipPath: knip(KNIP), background: rand }} />
      <div
        style={{
          position: "absolute",
          inset: 2,
          clipPath: knip(KNIP - 1),
          background: d.kleur || elementType.kleur || "var(--dc-node-vulling, #f1f5f9)",
        }}
      />
      <DmnNaam element={element} elementType={elementType} />
    </div>
  );
}

/** DMN Knowledge Source: rechthoek met golvende onderrand. */
function DmnKnowledgeSourceShape({ element, elementType, selected, children }) {
  const d = element.data || {};
  const rand = selected ? "var(--dc-selectie, #2563eb)" : "var(--dc-node-rand, #94a3b8)";
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        minWidth: 160,
        minHeight: 80,
        position: "relative",
        cursor: "grab",
      }}
    >
      {children}
      {/* preserveAspectRatio="none": de golf rekt mee met de node; de stroke
          blijft 2px door vector-effect. De golf zakt onder de tekstzone. */}
      <svg
        viewBox="0 0 200 130"
        preserveAspectRatio="none"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible" }}
      >
        <path
          d="M2 2 H198 V104 C165 84 135 124 100 104 C65 84 35 124 2 104 Z"
          fill={d.kleur || elementType.kleur || "var(--dc-node-vulling, #f1f5f9)"}
          stroke={rand}
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
        />
      </svg>
      <DmnNaam element={element} elementType={elementType} extraStijl={{ paddingBottom: "22%" }} />
    </div>
  );
}

registreerShape("class-box", ClassBoxShape);
registreerShape("chip", ChipShape);
registreerShape("knip-box", KnipBoxShape);
registreerShape("note", NoteShape);
registreerShape("rounded", RoundedShape);
registreerShape("anker", AnkerShape);
registreerShape("boundary", BoundaryShape);
registreerShape("bol", BolShape);
registreerShape("package", PackageShape);
registreerShape("dmn-input-data", DmnInputDataShape);
registreerShape("dmn-bkm", DmnBkmShape);
registreerShape("dmn-knowledge-source", DmnKnowledgeSourceShape);

export {
  ClassBoxShape,
  ChipShape,
  KnipBoxShape,
  NoteShape,
  RoundedShape,
  AnkerShape,
  BoundaryShape,
  BolShape,
  PackageShape,
  DmnInputDataShape,
  DmnBkmShape,
  DmnKnowledgeSourceShape,
};
