import SchemaFormField from "./SchemaFormField";
import { bepaalWidgetOverride } from "./widgetOverrides";

/**
 * CustomFormulierRenderer — rendert een formulier op basis van een layout-JSON
 * (uit een FormulierDefinitie_Layout record) en de velden van een entiteittype.
 *
 * Layout elementen:
 *  - { type: "formulier", elementen: [...] }         → root container
 *  - { type: "groep", label: "...", elementen: [...] } → section met heading
 *  - { type: "rij", elementen: [...] }               → horizontal flex row
 *  - { type: "veld", veld: "veldnaam", breedte: "50%" } → enkel invoerveld
 *  - { type: "conditioneel", als: "veld == 'waarde'", dan: [...] } → conditionele zichtbaarheid
 *  - { type: "lijst", bron: "ENT.GE", label, elementen: [...] } → herhaalbare sectie (meervoudig)
 *
 * Adressering: `veld` verwijst naar een veld-def in `velden` (op `naam`). Binnen
 * een `lijst` zijn veld-verwijzingen RELATIEF aan `bron`: de def-lookup gebruikt
 * `bron.veld`, terwijl de waarde in het item-object onder de relatieve naam leeft.
 *
 * Props:
 *  - layout:    geparsed layout-object (root element)
 *  - velden:    array van schema-API velddefinities [{ naam, type, format, enum, ... }]
 *  - values:    { veldnaam: waarde } huidige formulierwaarden
 *  - onChange:  (veldnaam, nieuweWaarde) => void
 *  - errors:    optioneel { veldnaam: foutmelding } voor validatie
 *  - readOnly:  forceer read-only voor alle velden
 */
export default function CustomFormulierRenderer({
  layout,
  velden,
  values,
  onChange,
  errors = {},
  readOnly = false,
  typeMeta = null,
}) {
  if (!layout || !velden) return null;

  // Velden lookup op naam voor snelle toegang
  const veldenByNaam = {};
  velden.forEach((v) => {
    if (v?.naam) veldenByNaam[v.naam] = v;
  });

  // scope = { values, onChange, padContext } — top-level is de flat prop-scope;
  // een lijst-rij levert een item-scope (relatieve velden + row-onChange).
  function renderElement(element, index, scope) {
    if (!element) return null;
    const { values: sVal, onChange: sOnChange, padContext } = scope;

    switch (element.type) {
      case "formulier":
        return (
          <div key={index} className="cg-custom-formulier">
            {(element.elementen || []).map((child, i) => renderElement(child, i, scope))}
          </div>
        );

      case "groep":
        return (
          <fieldset
            key={index}
            className="cg-form-section"
            style={{ marginBottom: "1rem", padding: "0.75rem", border: "1px solid var(--cg-rand, #ccc)", borderRadius: "6px" }}
          >
            {element.label && (
              <legend className="utrecht-heading-3" style={{ fontSize: "1rem", fontWeight: 600, padding: "0 0.5rem" }}>
                {element.label}
              </legend>
            )}
            {(element.elementen || []).map((child, i) => renderElement(child, i, scope))}
          </fieldset>
        );

      case "rij":
        return (
          <div key={index} style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
            {(element.elementen || []).map((child, i) => (
              <div key={i} style={{ flex: child.breedte ? `0 0 ${child.breedte}` : "1 1 0", minWidth: 0 }}>
                {renderElement(child, i, scope)}
              </div>
            ))}
          </div>
        );

      case "veld": {
        // Def-lookup op het volle pad (padContext + relatieve naam); waarde en
        // onChange op de relatieve/scope-naam.
        const lookupNaam = padContext ? `${padContext}.${element.veld}` : element.veld;
        const veldDef = veldenByNaam[lookupNaam] || veldenByNaam[element.veld];
        if (!veldDef) {
          return (
            <div key={index} style={{ color: "var(--cg-fout, red)", marginBottom: "0.75rem" }}>
              Onbekend veld: <code>{lookupNaam}</code>
            </div>
          );
        }
        const veldMetOverride = element.beschrijving
          ? { ...veldDef, description: element.beschrijving }
          : veldDef;
        return (
          <div key={index} style={element.breedte ? {} : undefined}>
            <SchemaFormField
              veld={veldMetOverride}
              value={sVal?.[element.veld] ?? ""}
              onChange={(val) => sOnChange(element.veld, val)}
              error={errors[lookupNaam]}
              readOnly={readOnly || element.readonly}
              widgetOverride={bepaalWidgetOverride(typeMeta, lookupNaam, element.widget)}
              labelOverride={element.label}
            />
          </div>
        );
      }

      case "conditioneel": {
        const zichtbaar = element.conditie
          ? evalueerConditieObject(element.conditie, sVal)
          : evalueerConditie(element.als, sVal);
        if (!zichtbaar) return null;
        return (
          <div key={index}>
            {(element.dan || []).map((child, i) => renderElement(child, i, scope))}
          </div>
        );
      }

      case "lijst": {
        // Meervoudig: array van item-objecten onder `values[bron]`.
        const bron = element.bron;
        const rijen = Array.isArray(values?.[bron]) ? values[bron] : [];
        const template = element.elementen || [];
        const zetRijen = (nieuw) => onChange(bron, nieuw);
        return (
          <fieldset key={index} className="cg-form-section" style={{ marginBottom: "1rem", padding: "0.75rem", border: "1px dashed var(--cg-rand, #ccc)", borderRadius: "6px" }}>
            <legend className="utrecht-heading-3" style={{ fontSize: "1rem", fontWeight: 600, padding: "0 0.5rem" }}>
              {element.label || bron} <span style={{ fontWeight: 400, fontSize: "0.8em", color: "var(--cg-donkergrijs, #666)" }}>(meervoudig)</span>
            </legend>
            {rijen.length === 0 && (
              <div style={{ color: "var(--cg-donkergrijs, #666)", fontSize: "0.875rem", marginBottom: "0.5rem" }}>Nog geen items.</div>
            )}
            {rijen.map((rij, ri) => {
              const rowScope = {
                values: rij,
                onChange: (leaf, val) => zetRijen(rijen.map((r, j) => (j === ri ? { ...r, [leaf]: val } : r))),
                padContext: bron,
              };
              return (
                <div key={ri} style={{ position: "relative", border: "1px solid var(--cg-rand, #e2e8f0)", borderRadius: "6px", padding: "0.5rem 0.75rem", marginBottom: "0.5rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" }}>
                    <span style={{ fontSize: "0.75rem", color: "var(--cg-donkergrijs, #666)" }}>#{ri + 1}</span>
                    {!readOnly && (
                      <button type="button" onClick={() => zetRijen(rijen.filter((_, j) => j !== ri))} style={{ border: "none", background: "none", color: "var(--cg-fout, #dc2626)", cursor: "pointer", fontSize: "0.9rem" }} title="Verwijder item">✕</button>
                    )}
                  </div>
                  {template.map((child, ci) => renderElement(child, ci, rowScope))}
                </div>
              );
            })}
            {!readOnly && (
              <button type="button" onClick={() => zetRijen([...rijen, {}])} className="utrecht-button utrecht-button--secondary-action" style={{ fontSize: "0.8125rem", padding: "0.25rem 0.75rem" }}>
                ＋ {element.label || "item"} toevoegen
              </button>
            )}
          </fieldset>
        );
      }

      default:
        return null;
    }
  }

  return renderElement(layout, 0, { values, onChange, padContext: null });
}

/**
 * Evalueer een eenvoudige conditie-expressie tegen de huidige waarden.
 * Ondersteunt:
 *  - "veld == 'waarde'"     → gelijkheid
 *  - "veld != 'waarde'"     → ongelijkheid
 *  - "veld"                 → truthy check
 *  - "!veld"                → falsy check
 */
function evalueerConditie(expressie, values) {
  if (!expressie || typeof expressie !== "string") return true;

  const trimmed = expressie.trim();

  // veld == 'waarde' of veld == "waarde"
  const eqMatch = trimmed.match(/^(\w+)\s*==\s*['"](.*)['"]$/);
  if (eqMatch) {
    return String(values?.[eqMatch[1]] ?? "") === eqMatch[2];
  }

  // veld != 'waarde' of veld != "waarde"
  const neqMatch = trimmed.match(/^(\w+)\s*!=\s*['"](.*)['"]$/);
  if (neqMatch) {
    return String(values?.[neqMatch[1]] ?? "") !== neqMatch[2];
  }

  // !veld → falsy
  if (trimmed.startsWith("!")) {
    const veldNaam = trimmed.slice(1).trim();
    const val = values?.[veldNaam];
    return !val || val === "" || val === "false";
  }

  // veld → truthy
  const val = values?.[trimmed];
  return val != null && val !== "" && val !== "false";
}

/**
 * Evalueer een datagedreven conditie-object tegen de huidige waarden.
 * Vorm: { veld: "ENT.GE.veld", op: "==" | "!=" | "leeg" | "nietleeg", waarde? }
 * Robuuster dan de string-vorm en makkelijker te bouwen in de visuele editor.
 */
export function evalueerConditieObject(conditie, values) {
  if (!conditie || typeof conditie !== "object") return true;
  const { veld, op = "nietleeg", waarde } = conditie;
  const actueel = values?.[veld];
  const isLeeg = actueel == null || actueel === "" || actueel === "false";
  switch (op) {
    case "leeg": return isLeeg;
    case "nietleeg": return !isLeeg;
    case "==": return String(actueel ?? "") === String(waarde ?? "");
    case "!=": return String(actueel ?? "") !== String(waarde ?? "");
    default: return true;
  }
}
