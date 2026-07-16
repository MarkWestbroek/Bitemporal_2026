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

  function renderElement(element, index) {
    if (!element) return null;

    switch (element.type) {
      case "formulier":
        return (
          <div key={index} className="cg-custom-formulier">
            {(element.elementen || []).map((child, i) => renderElement(child, i))}
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
            {(element.elementen || []).map((child, i) => renderElement(child, i))}
          </fieldset>
        );

      case "rij":
        return (
          <div key={index} style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
            {(element.elementen || []).map((child, i) => (
              <div key={i} style={{ flex: child.breedte ? `0 0 ${child.breedte}` : "1 1 0", minWidth: 0 }}>
                {renderElement(child, i)}
              </div>
            ))}
          </div>
        );

      case "veld": {
        const veldDef = veldenByNaam[element.veld];
        if (!veldDef) {
          return (
            <div key={index} style={{ color: "var(--cg-fout, red)", marginBottom: "0.75rem" }}>
              Onbekend veld: <code>{element.veld}</code>
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
              value={values?.[element.veld] ?? ""}
              onChange={(val) => onChange(element.veld, val)}
              error={errors[element.veld]}
              readOnly={readOnly}
              widgetOverride={bepaalWidgetOverride(typeMeta, element.veld, element.widget)}
              labelOverride={element.label}
            />
          </div>
        );
      }

      case "conditioneel": {
        const zichtbaar = element.conditie
          ? evalueerConditieObject(element.conditie, values)
          : evalueerConditie(element.als, values);
        if (!zichtbaar) return null;
        return (
          <div key={index}>
            {(element.dan || []).map((child, i) => renderElement(child, i))}
          </div>
        );
      }

      default:
        return null;
    }
  }

  return renderElement(layout, 0);
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
