/**
 * Object-shape: de UML-instantiedoos — "naam : Klasse" onderstreept, daarna
 * de slots (attribuut = waarde). De classifier komt uit de cross-profiel
 * verwijzing (`data.instantieVan`) of, zonder verwijzing, uit
 * `data.klassifierLabel` (zo zet de EA-lezer hem neer).
 *
 * Ook gebruikt door het communication-profiel (levenslijn-object).
 */
import React from "react";
import { registreerShape } from "../../diagramcore/shapes/shapeRegistry.js";
import { CompartimentLijst } from "../../diagramcore/shapes/basisShapes.jsx";
import { resolveerElementRef } from "../../studio/elementVerwijzing.jsx";

/** "jan : Persoon" — naam leeg = anoniem object (": Persoon"). */
export function objectKop(element) {
  const d = element?.data || {};
  const ref = d.instantieVan ? resolveerElementRef(d.instantieVan) : null;
  const klasse = ref?.label || d.klassifierLabel || "";
  const naam = element?.naam || "";
  const kop = klasse ? `${naam} : ${klasse}` : naam || "(object)";
  return d.toestand ? `${kop} ${d.toestand}` : kop;
}

function ObjectShape({ element, elementType, selected, fieldTypesById, compartmentTypesById, children }) {
  const d = element?.data || {};
  const rand = selected ? "var(--dc-selectie, #2563eb)" : "var(--dc-node-rand, #94a3b8)";
  const dubbel = (elementType?.randDikte ?? 2) >= 3;
  return (
    <div
      className="dc-node"
      style={{
        borderColor: rand,
        borderWidth: 2,
        // Multi-object: dubbele rand via een binnenlijn.
        ...(dubbel ? { boxShadow: `inset 0 0 0 2px var(--dc-node-vulling, #fff), inset 0 0 0 3px ${rand}` } : {}),
        backgroundColor: d.kleur || elementType?.kleur || "var(--dc-node-vulling, #f1f5f9)",
      }}
    >
      {children}
      <div className="dc-node-header">
        {d.stereotype ? <div className="dc-stereotype">{`«${d.stereotype}»`}</div> : null}
        <div className="dc-naam" style={{ textDecoration: "underline" }} data-dc-naam="">
          {objectKop(element)}
        </div>
      </div>
      <div className="ob-slots">
        <CompartimentLijst
          element={element}
          elementType={elementType}
          fieldTypesById={fieldTypesById}
          compartmentTypesById={compartmentTypesById}
        />
      </div>
      {/* Slots lezen als "attribuut = waarde": het "=" komt vóór het type-deel. */}
      <style>{`.ob-slots .dc-veld-type::before { content: "= "; }`}</style>
    </div>
  );
}

let _geregistreerd = false;
export function registreerObjectShapes() {
  if (_geregistreerd) return;
  registreerShape("ob-object", ObjectShape);
  _geregistreerd = true;
}
