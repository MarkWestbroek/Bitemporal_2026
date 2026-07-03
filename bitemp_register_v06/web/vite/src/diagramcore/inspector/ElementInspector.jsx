/**
 * ElementInspector (diagramcore) — gegenereerd eigenschappen-paneel.
 *
 * Volledig metamodel-gedreven (vierde iteratie, plan §2):
 *   - een veld wordt bewerkt via de **PropertyTypes** van zijn FieldType;
 *   - een element-brede eigenschap (tekst, expressie, kleur) via de
 *     **PropertyTypes** van het ElementType (`properties`);
 *   - de widget per property komt uit de **registry datatype →
 *     PropertyTypeEditor** (propertyTypeEditors.jsx) — string, tekst,
 *     boolean, colour, en door profielen geregistreerde datatypes zoals
 *     "cel-expressie";
 *   - heeft een property `referenceTypes`, dan wint de VerwijzingsKiezer:
 *     kandidaten via de ReferenceResolvers van het DiagramType
 *     (keuzelijst + minibrowser, plan §4.5b).
 *
 * Props:
 *   element, elementType, fieldTypesById  — model + definitie
 *   kandidatenVoor(referenceTypeIds) → VerwijzingsKandidaat[]
 *   bewerkbaar, onUpdate(patch), onVerwijderVanDiagram?, onVerwijderUitModel?
 */
import { useCallback } from "react";
import {
  getPropertyTypeEditor,
  VerwijzingsKiezer,
} from "./propertyTypeEditors.jsx";

/** Eén property: kiezer bij referenceTypes, anders editor op datatype. */
function PropertyWidget({ regel, waarde, onChange, element, kandidatenVoor }) {
  if (regel.referenceTypes?.length) {
    return (
      <VerwijzingsKiezer
        regel={regel}
        waarde={waarde}
        onChange={onChange}
        kandidaten={kandidatenVoor ? kandidatenVoor(regel.referenceTypes) : []}
      />
    );
  }
  const Editor = getPropertyTypeEditor(regel.datatype || "string") || getPropertyTypeEditor("string");
  return <Editor regel={regel} waarde={waarde} onChange={onChange} element={element} />;
}

/** Eén veld-rij binnen een compartiment: widgets volgens FieldType.properties. */
function VeldRij({ veld, fieldType, bewerkbaar, element, kandidatenVoor, onChange, onVerwijder }) {
  const regels = fieldType?.properties || [{ key: "naam", datatype: "string" }];
  const waardeVan = (key) => (key === "naam" ? veld.naam : veld.data?.[key]);
  const zet = (key, waarde) => {
    if (key === "naam") onChange({ ...veld, naam: waarde });
    else onChange({ ...veld, data: { ...veld.data, [key]: waarde } });
  };
  return (
    <div className="dc-inspector-rij">
      {regels.map((regel) => (
        <PropertyWidget
          key={regel.key}
          regel={regel}
          waarde={waardeVan(regel.key)}
          element={element}
          kandidatenVoor={kandidatenVoor}
          onChange={(w) => bewerkbaar && zet(regel.key, w)}
        />
      ))}
      {bewerkbaar && (
        <button className="dc-mini-knop is-gevaar" title="Veld verwijderen" onClick={onVerwijder}>
          ×
        </button>
      )}
    </div>
  );
}

export default function ElementInspector({
  element,
  elementType,
  fieldTypesById,
  kandidatenVoor,
  bewerkbaar = false,
  onUpdate,
  onVerwijderVanDiagram,
  onVerwijderUitModel,
}) {
  const compartimenten = element.compartimenten || [];

  /** Vervang de velden van één compartiment (maakt het aan als het ontbreekt). */
  const zetCompartiment = useCallback(
    (compartmentTypeId, velden) => {
      const bestaand = compartimenten.some((c) => c.compartmentType === compartmentTypeId);
      const volgende = bestaand
        ? compartimenten.map((c) => (c.compartmentType === compartmentTypeId ? { ...c, velden } : c))
        : [...compartimenten, { compartmentType: compartmentTypeId, velden }];
      onUpdate({ compartimenten: volgende });
    },
    [compartimenten, onUpdate]
  );

  return (
    <div className="dc-inspector">
      <h3>{element.naam || "(naamloos)"}</h3>
      <p className="dc-inspector-sub">
        {elementType?.label || element.elementType}
        {element.data?.domein ? ` · ${element.data.domein}` : ""}
      </p>

      {/* Naam */}
      <div className="dc-inspector-rij">
        <label className="dc-veldlabel">naam</label>
        <input
          type="text"
          value={element.naam || ""}
          readOnly={!bewerkbaar}
          onChange={(e) => bewerkbaar && onUpdate({ naam: e.target.value })}
        />
      </div>

      {/* PropertyTypes van het ElementType (tekst, expressie, kleur, …) */}
      {(elementType?.properties || []).map((regel) => (
        <div className="dc-inspector-rij" key={regel.key}>
          <label className="dc-veldlabel">{regel.label || regel.key}</label>
          <PropertyWidget
            regel={regel}
            waarde={element.data?.[regel.key]}
            element={element}
            kandidatenVoor={kandidatenVoor}
            onChange={(w) => bewerkbaar && onUpdate({ data: { [regel.key]: w } })}
          />
        </div>
      ))}

      {/* Compartimenten volgens het ElementType */}
      {(elementType?.compartments || []).map((def) => {
        const instantie = compartimenten.find((c) => c.compartmentType === def.id);
        const velden = instantie?.velden || [];
        const fieldType = fieldTypesById?.[def.fieldType];
        return (
          <div className="dc-inspector-sectie" key={def.id}>
            <div className="dc-inspector-sectie-titel">{def.label || def.id}</div>
            {velden.map((veld, i) => (
              <VeldRij
                key={i}
                veld={veld}
                fieldType={fieldType}
                bewerkbaar={bewerkbaar}
                element={element}
                kandidatenVoor={kandidatenVoor}
                onChange={(nieuw) => zetCompartiment(def.id, velden.map((v, j) => (j === i ? nieuw : v)))}
                onVerwijder={() => zetCompartiment(def.id, velden.filter((_, j) => j !== i))}
              />
            ))}
            {bewerkbaar && (
              <button
                className="dc-mini-knop"
                onClick={() =>
                  zetCompartiment(def.id, [...velden, { naam: "", fieldType: def.fieldType, data: {} }])
                }
              >
                + veld
              </button>
            )}
          </div>
        );
      })}

      {bewerkbaar && (
        <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
          {onVerwijderVanDiagram && (
            <button className="dc-mini-knop" onClick={onVerwijderVanDiagram}>
              Van diagram halen
            </button>
          )}
          {onVerwijderUitModel && (
            <button className="dc-mini-knop is-gevaar" onClick={onVerwijderUitModel}>
              Verwijder uit model
            </button>
          )}
        </div>
      )}
    </div>
  );
}
