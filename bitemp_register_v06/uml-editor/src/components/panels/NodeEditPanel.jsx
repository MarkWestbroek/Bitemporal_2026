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
import { METATYPES, ENTITEIT_SUBTYPES, RELATIE_SUBTYPES, VELDTYPEN, AFLEIDINGSTALEN, maakLeegVeld, maakLeegAfgeleidVeld, defaultKleur, bouwVeldtypen } from "../../metamodel/types";

const BASISTYPES = ["string", "integer", "number", "boolean"];

export default function NodeEditPanel({ node, onUpdate, onDelete, datatypeNodes = [], enumNodes = [], entiteitNodes = [], allNodes = [] }) {
  if (!node) return null;

  const data = node.data;
  const isEnum = node.type === "enumeratie";
  const isDatatype = node.type === "gegevenstype";
  const isRelatie = node.type === "relatie";
  const isRefInstantie = node.type === "referentielijstInstantie";
  const beschikbareVeldtypen = bouwVeldtypen(
    datatypeNodes,
    enumNodes,
    // Referentielijst_item entiteiten als keuzetype in veld-dropdown
    (entiteitNodes || []).filter((n) => n.data?.entiteitSubtype === "referentielijst_item")
  );
  const beschikbareEntiteiten = (entiteitNodes || [])
    .map((n) => n.data?.typenaam)
    .filter(Boolean);

  // Track welke velden uitgevouwen zijn (voor description / afgeleid details)
  const [expandedVelden, setExpandedVelden] = useState({});
  function toggleVeldExpanded(index) {
    setExpandedVelden((prev) => ({ ...prev, [index]: !prev[index] }));
  }

  // Afgeleide velden op entiteit-niveau
  function addAfgeleidVeld() {
    const afgeleideVelden = [...(data.afgeleideVelden || []), maakLeegAfgeleidVeld()];
    onUpdate(node.id, { ...data, afgeleideVelden });
  }

  function updateAfgeleidVeld(index, key, value) {
    const afgeleideVelden = [...(data.afgeleideVelden || [])];
    afgeleideVelden[index] = { ...afgeleideVelden[index], [key]: value };
    onUpdate(node.id, { ...data, afgeleideVelden });
  }

  function removeAfgeleidVeld(index) {
    const afgeleideVelden = (data.afgeleideVelden || []).filter((_, i) => i !== index);
    onUpdate(node.id, { ...data, afgeleideVelden });
  }

  function updateField(key, value) {
    onUpdate(node.id, { ...data, [key]: value });
  }

  function updateVeld(index, key, value) {
    const velden = [...(data.velden || [])];
    velden[index] = { ...velden[index], [key]: value };
    onUpdate(node.id, { ...data, velden });
  }

  function updateVeldMulti(index, updates) {
    const velden = [...(data.velden || [])];
    velden[index] = { ...velden[index], ...updates };
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

  // === Referentielijst-instantie render ===
  if (isRefInstantie) {
    return (
      <div className="edit-panel">
        <h3>Ref.lijst instantie bewerken</h3>

        <label>
          Systeemnaam
          <input
            type="text"
            value={data.systeemnaam || ""}
            onChange={(e) => updateField("systeemnaam", e.target.value)}
            placeholder="bijv. Landenlijst"
          />
        </label>

        <label>
          Naam
          <input
            type="text"
            value={data.naam || ""}
            onChange={(e) => updateField("naam", e.target.value)}
            placeholder="bijv. Landen"
          />
        </label>

        <label>
          Omschrijving
          <textarea
            value={data.omschrijving || ""}
            onChange={(e) => updateField("omschrijving", e.target.value)}
            placeholder="Korte beschrijving van deze referentielijst"
            rows={3}
          />
        </label>

        <div className="panel-actions">
          <button className="btn-danger" onClick={() => onDelete(node.id)}>
            Verwijder instantie
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
        Meervoud (padnaam)
        <input
          type="text"
          value={data.meervoud || ""}
          onChange={(e) => updateField("meervoud", e.target.value)}
          placeholder={
            data.metatype === "entiteit"
              ? "bijv. natuurlijke_personen"
              : data.metatype === "relatie"
              ? "bijv. relaties"
              : "bijv. gegevenselementen"
          }
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
            // Beide velden in één update om stale-closure bug te voorkomen
            const newMetatype = e.target.value;
            onUpdate(node.id, { ...data, metatype: newMetatype, kleur: defaultKleur(newMetatype) });
          }}
        >
          {METATYPES.map((mt) => (
            <option key={mt} value={mt}>
              {mt}
            </option>
          ))}
        </select>
      </label>

      {/* Subtype-keuze voor referentielijsten (zie Referentielijsten.md §7) */}
      {data.metatype === "entiteit" && (
        <label>
          Subtype
          <select
            value={data.entiteitSubtype || ""}
            onChange={(e) => {
              // Beide velden in één update om stale-closure bug te voorkomen
              const subtype = e.target.value;
              onUpdate(node.id, { ...data, entiteitSubtype: subtype, kleur: defaultKleur("entiteit", subtype) });
            }}
          >
            {ENTITEIT_SUBTYPES.map((st) => (
              <option key={st} value={st}>
                {st || "(geen — gewone entiteit)"}
              </option>
            ))}
          </select>
        </label>
      )}
      {data.metatype === "relatie" && (
        <label>
          Subtype
          <select
            value={data.relatieSubtype || ""}
            onChange={(e) => {
              // Beide velden in één update om stale-closure bug te voorkomen
              const subtype = e.target.value;
              onUpdate(node.id, { ...data, relatieSubtype: subtype, kleur: defaultKleur("relatie", subtype) });
            }}
          >
            {RELATIE_SUBTYPES.map((st) => (
              <option key={st} value={st}>
                {st || "(geen — gewone relatie)"}
              </option>
            ))}
          </select>
        </label>
      )}
      {data.metatype === "relatie" && data.relatieSubtype === "referentielijst_items" && (
        <label>
          Gebonden instantie
          <select
            value={data.referentielijstInstantie || ""}
            onChange={(e) => updateField("referentielijstInstantie", e.target.value)}
          >
            <option value="">(geen)</option>
            {(allNodes || [])
              .filter((n) => n.type === "referentielijstInstantie" && n.data?.systeemnaam)
              .map((n) => (
                <option key={n.data.systeemnaam} value={n.data.systeemnaam}>
                  {n.data.systeemnaam}
                </option>
              ))}
          </select>
        </label>
      )}

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

      {isRelatie && (
        <label>
          Doelentiteit (V3)
          <select
            value={data.doelEntiteit || ""}
            onChange={(e) => updateField("doelEntiteit", e.target.value)}
          >
            <option value="">(automatisch via edge)</option>
            {beschikbareEntiteiten.map((naam) => (
              <option key={naam} value={naam}>
                {naam}
              </option>
            ))}
          </select>
        </label>
      )}

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
              style={v.afgeleid ? { fontStyle: "italic", borderLeft: "3px solid #f59e0b" } : {}}
            />
            <select
              value={(() => {
                if (v.enumNaam) return `enum:${v.enumNaam}`;
                if (v.refItemNaam) return `refitem:${v.refItemNaam}`;
                if (v.datatypeNaam) return `datatype:${v.datatypeNaam}`;
                const datatypeEntry = beschikbareVeldtypen.find(
                  (vt) =>
                    vt.isCustom &&
                    vt.type === v.type &&
                    (vt.format || "") === (v.format || "")
                );
                if (datatypeEntry?.datatypeNaam) {
                  return `datatype:${datatypeEntry.datatypeNaam}`;
                }
                return `${v.type}|${v.format || ""}`;
              })()}
              onChange={(e) => {
                const val = e.target.value;
                if (val.startsWith("enum:")) {
                  const enumNaam = val.slice(5);
                  const entry = beschikbareVeldtypen.find(vt => vt.isEnum && vt.enumNaam === enumNaam);
                  updateVeldMulti(i, {
                    type: "string",
                    format: "",
                    enumNaam,
                    datatypeNaam: null,
                    refItemNaam: null,
                    enum: entry?.enumWaarden || [],
                  });
                } else if (val.startsWith("refitem:")) {
                  // Referentielijst-item als veldtype (FK-referentie, zie Referentielijsten.md §7)
                  const refItemNaam = val.slice(8);
                  updateVeldMulti(i, {
                    type: "integer",
                    format: "",
                    refItemNaam,
                    datatypeNaam: null,
                    enumNaam: null,
                    enum: null,
                  });
                } else if (val.startsWith("datatype:")) {
                  const datatypeNaam = val.slice(9);
                  const entry = beschikbareVeldtypen.find(
                    (vt) => vt.isCustom && vt.datatypeNaam === datatypeNaam
                  );
                  updateVeldMulti(i, {
                    type: entry?.type || "string",
                    format: entry?.format || "",
                    datatypeNaam: datatypeNaam || null,
                    enumNaam: null,
                    refItemNaam: null,
                    enum: null,
                  });
                } else {
                  const [type, format] = val.split("|");
                  updateVeldMulti(i, {
                    type,
                    format: format || "",
                    datatypeNaam: null,
                    enumNaam: null,
                    refItemNaam: null,
                    enum: null,
                  });
                }
              }}
              className="veld-type-select"
            >
              {beschikbareVeldtypen.map((vt) => {
                const optValue = vt.isEnum
                  ? `enum:${vt.enumNaam}`
                  : vt.isRefItem
                  ? `refitem:${vt.refItemNaam}`
                  : vt.isCustom
                  ? `datatype:${vt.datatypeNaam}`
                  : `${vt.type}|${vt.format}`;
                return (
                  <option key={optValue} value={optValue}>
                    {vt.label}{vt.isCustom ? " ✦" : ""}{vt.isEnum ? " ◇" : ""}{vt.isRefItem ? " ▣" : ""}
                  </option>
                );
              })}
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
            <label className="checkbox-label small" title="Afgeleid veld (derived)">
              <input
                type="checkbox"
                checked={v.afgeleid || false}
                onChange={(e) =>
                  updateVeld(i, "afgeleid", e.target.checked)
                }
              />
              /
            </label>
            <button
              className="btn-icon"
              onClick={() => toggleVeldExpanded(i)}
              title="Details (beschrijving, afleiding)"
              style={expandedVelden[i] ? { background: "#e2e8f0" } : {}}
            >
              ⋯
            </button>
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
          {/* Uitklapbaar detailpaneel */}
          {expandedVelden[i] && (
            <div className="veld-details" style={{ width: "100%", paddingTop: "4px", borderTop: "1px solid #e2e8f0" }}>
              <label style={{ fontSize: "0.85em" }}>
                Beschrijving
                <input
                  type="text"
                  value={v.description || ""}
                  onChange={(e) => updateVeld(i, "description", e.target.value)}
                  placeholder="Omschrijving van dit veld"
                  style={{ width: "100%" }}
                />
              </label>
              {v.afgeleid && (
                <>
                  <label style={{ fontSize: "0.85em" }}>
                    Afleidingstaal
                    <select
                      value={v.afleidingsregelTaal || "cel"}
                      onChange={(e) => updateVeld(i, "afleidingsregelTaal", e.target.value)}
                    >
                      {AFLEIDINGSTALEN.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </label>
                  <label style={{ fontSize: "0.85em" }}>
                    Afleidingsregel
                    <textarea
                      value={v.afleidingsregel || ""}
                      onChange={(e) => updateVeld(i, "afleidingsregel", e.target.value)}
                      placeholder="bijv. voornaam + ' ' + achternaam"
                      rows={2}
                      style={{ width: "100%", fontFamily: "monospace", fontSize: "0.85em" }}
                    />
                  </label>
                </>
              )}
            </div>
          )}
        </div>
      ))}

      <button className="btn-add" onClick={addVeld}>
        + Veld toevoegen
      </button>

      {/* Afgeleide velden op entiteit/GE/relatie-niveau */}
      {(data.metatype === "entiteit" || data.metatype === "gegevenselement" || data.metatype === "relatie") && (
        <>
          <h4 style={{ marginTop: "16px" }}>Afgeleide velden</h4>
          <p style={{ fontSize: "0.8em", color: "#64748b", margin: "0 0 8px 0" }}>
            Velden die worden afgeleid uit onderliggende velden, bijv. een weergavenaam.
          </p>
          {(data.afgeleideVelden || []).map((av, i) => (
            <div key={i} className="veld-edit-row" style={{ borderLeft: "3px solid #f59e0b", paddingLeft: "6px" }}>
              <div style={{ width: "100%" }}>
                <div className="veld-edit-main">
                  <input
                    type="text"
                    placeholder="naam"
                    value={av.naam || ""}
                    onChange={(e) => updateAfgeleidVeld(i, "naam", e.target.value)}
                    className="veld-naam-input"
                    style={{ fontStyle: "italic" }}
                  />
                  <input
                    type="text"
                    placeholder="goType"
                    value={av.goType || "string"}
                    onChange={(e) => updateAfgeleidVeld(i, "goType", e.target.value)}
                    style={{ width: "80px" }}
                  />
                  <button
                    className="btn-icon"
                    onClick={() => removeAfgeleidVeld(i)}
                    title="Verwijder"
                  >
                    ✕
                  </button>
                </div>
                <label style={{ fontSize: "0.85em" }}>
                  Beschrijving
                  <input
                    type="text"
                    value={av.description || ""}
                    onChange={(e) => updateAfgeleidVeld(i, "description", e.target.value)}
                    placeholder="Omschrijving"
                    style={{ width: "100%" }}
                  />
                </label>
                <label style={{ fontSize: "0.85em" }}>
                  Afleidingstaal
                  <select
                    value={av.afleidingsregelTaal || "cel"}
                    onChange={(e) => updateAfgeleidVeld(i, "afleidingsregelTaal", e.target.value)}
                  >
                    {AFLEIDINGSTALEN.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </label>
                <label style={{ fontSize: "0.85em" }}>
                  Afleidingsregel
                  <textarea
                    value={av.afleidingsregel || ""}
                    onChange={(e) => updateAfgeleidVeld(i, "afleidingsregel", e.target.value)}
                    placeholder="bijv. Naam.roepnaam + ' ' + Naam.achternaam"
                    rows={2}
                    style={{ width: "100%", fontFamily: "monospace", fontSize: "0.85em" }}
                  />
                </label>
                <label style={{ fontSize: "0.85em", display: "flex", alignItems: "center", gap: "6px" }}>
                  <input
                    type="checkbox"
                    checked={av.isWeergaveVeld || false}
                    onChange={(e) => updateAfgeleidVeld(i, "isWeergaveVeld", e.target.checked)}
                  />
                  Weergaveveld (toon op kaarten)
                </label>
              </div>
            </div>
          ))}
          <button className="btn-add" onClick={addAfgeleidVeld}>
            + Afgeleid veld toevoegen
          </button>
        </>
      )}

      <div className="panel-actions">
        <button className="btn-danger" onClick={() => onDelete(node.id)}>
          Verwijder type
        </button>
      </div>
    </div>
  );
}
