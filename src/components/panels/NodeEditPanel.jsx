/**
 * NodeEditPanel — Sidebar voor het bewerken van een geselecteerd type (node).
 *
 * Toont:
 *   - Basisgegevens: typenaam, description, metatype, kleur, isMaterieel
 *   - Veldenlijst: naam, type, format, verplicht, enum, etc.
 *   - Toevoegen/verwijderen van velden
 *
 * Props:
 *   - node: de geselecteerde React Flow node
 *   - onUpdate(nodeId, newData): callback om de node data bij te werken
 *   - onDelete(nodeId): callback om de node te verwijderen
 */
import { useState } from "react";
import { METATYPES, VELDTYPEN, maakLeegVeld, defaultKleur, bouwVeldtypen } from "../../metamodel/types";

const BASISTYPES = ["string", "integer", "number", "boolean"];

export default function NodeEditPanel({ node, onUpdate, onDelete, datatypeNodes = [] }) {
  if (!node) return null;

  const data = node.data;
  const isEnum = node.type === "enumeratie";
  const isDatatype = node.type === "gegevenstype";
  const beschikbareVeldtypen = bouwVeldtypen(datatypeNodes);

  function updateField(key, value) {
    onUpdate(node.id, { ...data, [key]: value });
  }

  function updateVeld(index, key, value) {
    const velden = [...(data.velden || [])];
    velden[index] = { ...velden[index], [key]: value };
    onUpdate(node.id, { ...data, velden });
  }

  function addVeld() {
    const velden = [...(data.velden || []), maakLeegVeld()];
    onUpdate(node.id, { ...data, velden });
  }

  function removeVeld(index) {
    const velden = (data.velden || []).filter((_, i) => i !== index);
    onUpdate(node.id, { ...data, velden });
  }

  function moveVeld(index, direction) {
    const velden = [...(data.velden || [])];
    const target = index + direction;
    if (target < 0 || target >= velden.length) return;
    [velden[index], velden[target]] = [velden[target], velden[index]];
    onUpdate(node.id, { ...data, velden });
  }

  // Enumeratie editing
  function updateEnumWaarde(index, value) {
    const waarden = [...(data.waarden || [])];
    waarden[index] = value;
    onUpdate(node.id, { ...data, waarden });
  }

  function addEnumWaarde() {
    const waarden = [...(data.waarden || []), ""];
    onUpdate(node.id, { ...data, waarden });
  }

  function removeEnumWaarde(index) {
    const waarden = (data.waarden || []).filter((_, i) => i !== index);
    onUpdate(node.id, { ...data, waarden });
  }

  // Gegevenstype editing helpers
  function updateValidatie(key, value) {
    const validatie = { ...(data.validatie || {}), [key]: value };
    onUpdate(node.id, { ...data, validatie });
  }

  function updateWeergave(key, value) {
    const weergave = { ...(data.weergave || {}), [key]: value };
    onUpdate(node.id, { ...data, weergave });
  }

  function addValidatieRegel() {
    const validatie = { ...(data.validatie || {}) };
    validatie.regels = [...(validatie.regels || []), { naam: "", type: "checksum", expressie: "", description: "" }];
    onUpdate(node.id, { ...data, validatie });
  }

  function updateValidatieRegel(index, key, value) {
    const validatie = { ...(data.validatie || {}) };
    const regels = [...(validatie.regels || [])];
    regels[index] = { ...regels[index], [key]: value };
    validatie.regels = regels;
    onUpdate(node.id, { ...data, validatie });
  }

  function removeValidatieRegel(index) {
    const validatie = { ...(data.validatie || {}) };
    validatie.regels = (validatie.regels || []).filter((_, i) => i !== index);
    onUpdate(node.id, { ...data, validatie });
  }

  // === Gegevenstype render ===
  if (isDatatype) {
    const validatie = data.validatie || {};
    const weergave = data.weergave || {};

    return (
      <div className="edit-panel">
        <h3>Gegevenstype bewerken</h3>

        <label>
          Naam
          <input
            type="text"
            value={data.naam || ""}
            onChange={(e) => updateField("naam", e.target.value)}
          />
        </label>

        <label>
          Beschrijving
          <textarea
            value={data.description || ""}
            onChange={(e) => updateField("description", e.target.value)}
            rows={2}
          />
        </label>

        <label>
          Basistype
          <select
            value={data.basistype || "string"}
            onChange={(e) => updateField("basistype", e.target.value)}
          >
            {BASISTYPES.map((bt) => (
              <option key={bt} value={bt}>{bt}</option>
            ))}
          </select>
        </label>

        <label>
          Format (unieke identifier)
          <input
            type="text"
            value={data.format || ""}
            onChange={(e) => updateField("format", e.target.value)}
            placeholder="bijv. nl-postcode"
          />
        </label>

        {/* Validatie */}
        <h4>Validatie</h4>

        <label>
          Pattern (regex)
          <input
            type="text"
            value={validatie.pattern || ""}
            onChange={(e) => updateValidatie("pattern", e.target.value)}
            placeholder="^[1-9][0-9]{3}\s?[A-Za-z]{2}$"
          />
        </label>

        {(data.basistype === "string") && (
          <>
            <div className="inline-fields">
              <label>
                Min. lengte
                <input
                  type="number"
                  value={validatie.minLength ?? ""}
                  onChange={(e) => updateValidatie("minLength", e.target.value ? Number(e.target.value) : null)}
                />
              </label>
              <label>
                Max. lengte
                <input
                  type="number"
                  value={validatie.maxLength ?? ""}
                  onChange={(e) => updateValidatie("maxLength", e.target.value ? Number(e.target.value) : null)}
                />
              </label>
            </div>
          </>
        )}

        {(data.basistype === "integer" || data.basistype === "number") && (
          <>
            <div className="inline-fields">
              <label>
                Minimum
                <input
                  type="number"
                  value={validatie.minimum ?? ""}
                  onChange={(e) => updateValidatie("minimum", e.target.value ? Number(e.target.value) : null)}
                />
              </label>
              <label>
                Maximum
                <input
                  type="number"
                  value={validatie.maximum ?? ""}
                  onChange={(e) => updateValidatie("maximum", e.target.value ? Number(e.target.value) : null)}
                />
              </label>
            </div>
            <label>
              Veelvoud van
              <input
                type="number"
                step="any"
                value={validatie.multipleOf ?? ""}
                onChange={(e) => updateValidatie("multipleOf", e.target.value ? Number(e.target.value) : null)}
              />
            </label>
          </>
        )}

        <label>
          Foutmelding
          <input
            type="text"
            value={validatie.foutmelding || ""}
            onChange={(e) => updateValidatie("foutmelding", e.target.value)}
            placeholder="Voer een geldige waarde in"
          />
        </label>

        <label>
          Voorbeelden (komma-gescheiden)
          <input
            type="text"
            value={(validatie.voorbeelden || []).join(", ")}
            onChange={(e) => updateValidatie("voorbeelden", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
          />
        </label>

        {/* Validatieregels */}
        <h4>Validatieregels</h4>
        {(validatie.regels || []).map((regel, i) => (
          <div key={i} className="veld-edit-row">
            <input
              type="text"
              placeholder="Naam"
              value={regel.naam}
              onChange={(e) => updateValidatieRegel(i, "naam", e.target.value)}
            />
            <select
              value={regel.type}
              onChange={(e) => updateValidatieRegel(i, "type", e.target.value)}
            >
              <option value="checksum">checksum</option>
              <option value="formula">formula</option>
              <option value="function">function</option>
            </select>
            <input
              type="text"
              placeholder="Expressie"
              value={regel.expressie}
              onChange={(e) => updateValidatieRegel(i, "expressie", e.target.value)}
            />
            <button className="btn-icon" onClick={() => removeValidatieRegel(i)} title="Verwijder">✕</button>
          </div>
        ))}
        <button className="btn-add" onClick={addValidatieRegel}>
          + Validatieregel toevoegen
        </button>

        {/* Normalisatie */}
        <h4>Normalisatie</h4>
        <label>
          Normalisatie
          <input
            type="text"
            value={data.normalisatie || ""}
            onChange={(e) => updateField("normalisatie", e.target.value)}
            placeholder="trim,uppercase_letters"
          />
        </label>

        {/* Weergave */}
        <h4>Weergave</h4>
        <label>
          Placeholder
          <input
            type="text"
            value={weergave.placeholder || ""}
            onChange={(e) => updateWeergave("placeholder", e.target.value)}
          />
        </label>
        <label>
          Invoermasker
          <input
            type="text"
            value={weergave.inputMask || ""}
            onChange={(e) => updateWeergave("inputMask", e.target.value)}
            placeholder="0000 AA"
          />
        </label>
        <div className="inline-fields">
          <label>
            Prefix
            <input
              type="text"
              value={weergave.prefix || ""}
              onChange={(e) => updateWeergave("prefix", e.target.value)}
              placeholder="€"
            />
          </label>
          <label>
            Suffix
            <input
              type="text"
              value={weergave.suffix || ""}
              onChange={(e) => updateWeergave("suffix", e.target.value)}
              placeholder="%"
            />
          </label>
        </div>

        <div className="panel-actions">
          <button className="btn-danger" onClick={() => onDelete(node.id)}>
            Verwijder gegevenstype
          </button>
        </div>
      </div>
    );
  }

  if (isEnum) {
    return (
      <div className="edit-panel">
        <h3>Enumeratie bewerken</h3>

        <label>
          Naam
          <input
            type="text"
            value={data.naam || ""}
            onChange={(e) => updateField("naam", e.target.value)}
          />
        </label>

        <h4>Waarden</h4>
        {(data.waarden || []).map((w, i) => (
          <div key={i} className="enum-waarde-row">
            <input
              type="text"
              value={w}
              onChange={(e) => updateEnumWaarde(i, e.target.value)}
            />
            <button
              className="btn-icon"
              onClick={() => removeEnumWaarde(i)}
              title="Verwijder"
            >
              ✕
            </button>
          </div>
        ))}
        <button className="btn-add" onClick={addEnumWaarde}>
          + Waarde toevoegen
        </button>

        <div className="panel-actions">
          <button className="btn-danger" onClick={() => onDelete(node.id)}>
            Verwijder enumeratie
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="edit-panel">
      <h3>
        {data.metatype === "entiteit"
          ? "Entiteit"
          : data.metatype === "relatie"
          ? "Relatie"
          : "Gegevenselement"}{" "}
        bewerken
      </h3>

      {/* Basis velden */}
      <label>
        Typenaam
        <input
          type="text"
          value={data.typenaam || ""}
          onChange={(e) => updateField("typenaam", e.target.value)}
        />
      </label>

      <label>
        Beschrijving
        <textarea
          value={data.description || ""}
          onChange={(e) => updateField("description", e.target.value)}
          rows={2}
        />
      </label>

      <label>
        Metatype
        <select
          value={data.metatype || "entiteit"}
          onChange={(e) => {
            updateField("metatype", e.target.value);
            updateField("kleur", defaultKleur(e.target.value));
          }}
        >
          {METATYPES.map((mt) => (
            <option key={mt} value={mt}>
              {mt}
            </option>
          ))}
        </select>
      </label>

      <label>
        Kleur
        <input
          type="color"
          value={data.kleur || "#bfdbfe"}
          onChange={(e) => updateField("kleur", e.target.value)}
        />
      </label>

      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={data.isMaterieel || false}
          onChange={(e) => updateField("isMaterieel", e.target.checked)}
        />
        Materieel (heeft tijdlijn)
      </label>

      {/* Velden / attributen */}
      <h4>Velden</h4>
      {(data.velden || []).map((v, i) => (
        <div key={i} className="veld-edit-row">
          <div className="veld-edit-main">
            <input
              type="text"
              placeholder="naam"
              value={v.naam}
              onChange={(e) => updateVeld(i, "naam", e.target.value)}
              className="veld-naam-input"
            />
            <select
              value={`${v.type}|${v.format || ""}`}
              onChange={(e) => {
                const [type, format] = e.target.value.split("|");
                updateVeld(i, "type", type);
                updateVeld(i, "format", format || "");
              }}
              className="veld-type-select"
            >
              {beschikbareVeldtypen.map((vt) => (
                <option
                  key={`${vt.type}|${vt.format}`}
                  value={`${vt.type}|${vt.format}`}
                >
                  {vt.label}{vt.isCustom ? " ✦" : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="veld-edit-controls">
            <label className="checkbox-label small">
              <input
                type="checkbox"
                checked={v.verplicht}
                onChange={(e) => updateVeld(i, "verplicht", e.target.checked)}
              />
              Verplicht
            </label>
            <label className="checkbox-label small">
              <input
                type="checkbox"
                checked={v.autoIncrement || false}
                onChange={(e) =>
                  updateVeld(i, "autoIncrement", e.target.checked)
                }
              />
              AI
            </label>
            <button
              className="btn-icon"
              onClick={() => moveVeld(i, -1)}
              title="Omhoog"
            >
              ↑
            </button>
            <button
              className="btn-icon"
              onClick={() => moveVeld(i, 1)}
              title="Omlaag"
            >
              ↓
            </button>
            <button
              className="btn-icon"
              onClick={() => removeVeld(i)}
              title="Verwijder"
            >
              ✕
            </button>
          </div>
        </div>
      ))}

      <button className="btn-add" onClick={addVeld}>
        + Veld toevoegen
      </button>

      <div className="panel-actions">
        <button className="btn-danger" onClick={() => onDelete(node.id)}>
          Verwijder type
        </button>
      </div>
    </div>
  );
}
