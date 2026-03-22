/**
 * DatatypeNode — UML-blok voor custom gegevenstypen.
 *
 *   ┌─────────────────────────────┐
 *   │  «gegevenstype»             │
 *   │  NLPostcode                 │
 *   ├─────────────────────────────┤
 *   │  basistype: string          │
 *   │  format:    nl-postcode     │
 *   │  pattern:   ^[1-9]...       │
 *   ├─────────────────────────────┤
 *   │  normalisatie: uppercase... │
 *   │  placeholder:  1234 AB      │
 *   │  suffix:       %            │
 *   └─────────────────────────────┘
 */
import { memo } from "react";
import { Handle, Position } from "@xyflow/react";

function DatatypeNode({ data, selected }) {
  const borderColor = selected ? "#0891b2" : "#94a3b8";
  const validatie = data.validatie || {};
  const weergave = data.weergave || {};

  // Bouw lijst van validatieregels om te tonen
  const validatieItems = [];
  if (validatie.pattern) validatieItems.push(`pattern: ${validatie.pattern}`);
  if (validatie.minLength != null) validatieItems.push(`minLength: ${validatie.minLength}`);
  if (validatie.maxLength != null) validatieItems.push(`maxLength: ${validatie.maxLength}`);
  if (validatie.minimum != null) validatieItems.push(`minimum: ${validatie.minimum}`);
  if (validatie.maximum != null) validatieItems.push(`maximum: ${validatie.maximum}`);
  if (validatie.multipleOf != null) validatieItems.push(`multipleOf: ${validatie.multipleOf}`);
  (validatie.regels || []).forEach((r) => {
    validatieItems.push(`regel: ${r.naam}`);
  });

  // Weergave-items
  const weergaveItems = [];
  if (weergave.placeholder) weergaveItems.push(`placeholder: ${weergave.placeholder}`);
  if (weergave.inputMask) weergaveItems.push(`mask: ${weergave.inputMask}`);
  if (weergave.prefix) weergaveItems.push(`prefix: ${weergave.prefix}`);
  if (weergave.suffix) weergaveItems.push(`suffix: ${weergave.suffix}`);

  return (
    <div
      className="metamodel-node datatype-node"
      style={{
        borderColor,
        backgroundColor: data.kleur || "#e0f2fe",
      }}
    >
      {/* Handles op alle zijden */}
      <Handle type="target" position={Position.Top} id="top" />
      <Handle type="source" position={Position.Bottom} id="bottom" />
      <Handle type="source" position={Position.Top} id="top" />
      <Handle type="target" position={Position.Bottom} id="bottom" />
      <Handle type="source" position={Position.Left} id="left" />
      <Handle type="target" position={Position.Left} id="left" />
      <Handle type="source" position={Position.Right} id="right" />
      <Handle type="target" position={Position.Right} id="right" />

      <div className="node-header">
        <div className="node-stereotype">«gegevenstype»</div>
        <div className="node-typenaam">{data.naam || "(naamloos)"}</div>
        {data.description && (
          <div className="node-description-hint" title={data.description}>
            ℹ
          </div>
        )}
      </div>

      <div className="node-divider" />

      {/* Basis-info */}
      <div className="node-velden">
        <div className="node-veld">
          <span className="veld-naam">basistype</span>
          <span className="veld-type">{data.basistype || "string"}</span>
        </div>
        <div className="node-veld">
          <span className="veld-naam">format</span>
          <span className="veld-type">{data.format || "–"}</span>
        </div>
      </div>

      {/* Validatie */}
      {validatieItems.length > 0 && (
        <>
          <div className="node-divider" />
          <div className="node-velden">
            {validatieItems.map((item, i) => (
              <div key={i} className="node-veld datatype-detail">
                {item}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Normalisatie */}
      {data.normalisatie && (
        <>
          <div className="node-divider" />
          <div className="node-velden">
            <div className="node-veld datatype-detail">
              norm: {data.normalisatie}
            </div>
          </div>
        </>
      )}

      {/* Weergave */}
      {weergaveItems.length > 0 && (
        <>
          <div className="node-divider" />
          <div className="node-velden">
            {weergaveItems.map((item, i) => (
              <div key={i} className="node-veld datatype-detail">
                {item}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default memo(DatatypeNode);
