import SchemaFormField from "./SchemaFormField";
import { bepaalWidgetOverride } from "./widgetOverrides";
import { vasteWaardenVanLijst, rijPastBijLijst } from "./nieuwFormulierMapping";
import RefMeerkeuze from "./RefMeerkeuze";

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
 * Extra eigenschappen (plan 2026-09-22 §5.5, stap A):
 *  - veld.vasteWaarde   → niet getoond; buiten een lijst een vaste waarde, binnen een lijst
 *                         óók het filter: meerdere lijsten op dezelfde bron delen één array
 *                         en tonen elk alleen de rijen die bij hun vaste waarden passen.
 *  - veld.kopieerNaar   → bij invoer wordt de waarde ook naar dat (volle) pad geschreven.
 *  - lijst.min / max    → min rijen worden altijd getoond (vaste rij: min = max = 1),
 *                         boven max geen "toevoegen", op of onder min geen "verwijder".
 *  - lijst.widget       → "meerkeuze": één veld in het sjabloon; enum → checkboxes, referentielijst
 *                         → chips + zoekveld (RefMeerkeuze); per keuze een rij { ...vast, [veld]: keuze }.
 *  - veld.nieuwFormulier→ (stap B) FD-id waarmee vanuit een relatieveld een nieuwe doel-ENT
 *                         ingebed kan worden aangemaakt (alleen op diepte 0, zie NieuwSubFormulier).
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
  diepte = 0,
  toonValidatie,
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

      case "groep": {
        // Een groep zonder zichtbare inhoud (bv. alleen velden met vasteWaarde, of een
        // conditioneel blok dat dicht is) wordt niet getoond.
        const kinderen = (element.elementen || []).map((child, i) => renderElement(child, i, scope));
        if (kinderen.every((k) => k == null)) return null;
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
            {kinderen}
          </fieldset>
        );
      }

      case "rij": {
        const cellen = (element.elementen || []).map((child, i) => ({ child, inhoud: renderElement(child, i, scope) })).filter((c) => c.inhoud != null);
        if (cellen.length === 0) return null;
        return (
          <div key={index} style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
            {cellen.map(({ child, inhoud }, i) => (
              <div key={i} style={{ flex: child.breedte ? `0 0 ${child.breedte}` : "1 1 0", minWidth: 0 }}>
                {inhoud}
              </div>
            ))}
          </div>
        );
      }

      case "veld": {
        // Vaste waarde: geen invoer. De waarde wordt bij opvoeren (nieuw-modus) of als
        // lijstfilter toegepast — zie nieuwFormulierMapping.
        if (element.vasteWaarde !== undefined && element.vasteWaarde !== null && element.vasteWaarde !== "") return null;
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
              onChange={(val) => {
                sOnChange(element.veld, val);
                // Eén invoer, twee doelen (bv. startdatum → Initiatief.aanvang.datum).
                if (element.kopieerNaar) onChange(element.kopieerNaar, val);
              }}
              error={errors[lookupNaam]}
              readOnly={readOnly || element.readonly}
              widgetOverride={bepaalWidgetOverride(typeMeta, lookupNaam, element.widget)}
              labelOverride={element.label}
              nieuwFormulier={element.nieuwFormulier}
              diepte={diepte}
              toonValidatie={toonValidatie}
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
        // Meervoudig: array van item-objecten onder `values[bron]`. Meerdere lijsten op
        // dezelfde bron delen die array; elke lijst ziet de rijen die bij haar vaste
        // waarden passen (vasteWaarde = filter én waarde).
        const bron = element.bron;
        const alle = Array.isArray(values?.[bron]) ? values[bron] : [];
        const vast = vasteWaardenVanLijst(element);
        const heeftFilter = Object.keys(vast).length > 0;
        const eigenIdx = alle.map((rij, i) => (heeftFilter ? (rijPastBijLijst(rij, vast) ? i : -1) : i)).filter((i) => i >= 0);
        const min = Number(element.min) > 0 ? Number(element.min) : 0;
        const max = Number(element.max) > 0 ? Number(element.max) : Infinity;
        const template = element.elementen || [];
        const zetAlle = (nieuw) => onChange(bron, nieuw);
        const isVasteRij = min > 0 && min === max;
        const legendaSuffix = isVasteRij ? null : "(meervoudig)";

        // Rijen die de lijst toont: eigen rijen, aangevuld tot `min` met virtuele lege
        // rijen (nog niet in de array; bij de eerste invoer worden ze toegevoegd).
        const getoond = eigenIdx.map((i) => ({ idx: i, rij: alle[i] }));
        while (getoond.length < min) getoond.push({ idx: -1, rij: { ...vast } });

        const rijScope = ({ idx, rij }) => ({
          values: rij,
          padContext: bron,
          onChange: (leaf, val) => {
            if (idx >= 0) zetAlle(alle.map((r, j) => (j === idx ? { ...r, [leaf]: val } : r)));
            else zetAlle([...alle, { ...vast, [leaf]: val }]);
          },
        });

        // Meerkeuze: één veld in het sjabloon → enum: checkbox per optie; referentielijst:
        // chips + zoekveld (RefMeerkeuze). Per keuze ontstaat een rij { ...vast, [veld]: keuze }.
        if (element.widget === "meerkeuze") {
          const keuzeEl = template.find((t) => t.type === "veld" && (t.vasteWaarde === undefined || t.vasteWaarde === null || t.vasteWaarde === ""));
          const keuzeDef = keuzeEl ? veldenByNaam[`${bron}.${keuzeEl.veld}`] : null;
          const opties = Array.isArray(keuzeDef?.enum) ? keuzeDef.enum.filter(Boolean) : [];
          const gekozen = new Set(getoond.filter((g) => g.idx >= 0).map((g) => String(g.rij?.[keuzeEl?.veld] ?? "")));
          const verwijder = (opt) => zetAlle(alle.filter((r, j) => !(eigenIdx.includes(j) && String(r?.[keuzeEl.veld] ?? "") === String(opt))));
          const toggle = (opt) => {
            if (gekozen.has(opt)) verwijder(opt);
            else zetAlle([...alle, { ...vast, [keuzeEl.veld]: opt }]);
          };
          if (keuzeDef?.ref) {
            return (
              <fieldset key={index} className="cg-form-section" style={{ marginBottom: "1rem", padding: "0.75rem", border: "1px dashed var(--cg-rand, #ccc)", borderRadius: "6px" }}>
                <legend className="utrecht-heading-3" style={{ fontSize: "1rem", fontWeight: 600, padding: "0 0.5rem" }}>{element.label || bron}</legend>
                {element.beschrijving && <div className="utrecht-form-field-description" style={{ marginBottom: "0.25rem" }}>{element.beschrijving}</div>}
                <RefMeerkeuze
                  refType={keuzeDef.ref}
                  ids={[...gekozen].filter(Boolean)}
                  onAdd={(id) => zetAlle([...alle, { ...vast, [keuzeEl.veld]: id }])}
                  onRemove={verwijder}
                  readOnly={readOnly}
                />
              </fieldset>
            );
          }
          return (
            <fieldset key={index} className="cg-form-section" style={{ marginBottom: "1rem", padding: "0.75rem", border: "1px dashed var(--cg-rand, #ccc)", borderRadius: "6px" }}>
              <legend className="utrecht-heading-3" style={{ fontSize: "1rem", fontWeight: 600, padding: "0 0.5rem" }}>
                {element.label || bron}
              </legend>
              {element.beschrijving && <div className="utrecht-form-field-description" style={{ marginBottom: "0.25rem" }}>{element.beschrijving}</div>}
              {!keuzeDef && <div style={{ color: "var(--cg-fout, red)" }}>Meerkeuze zonder (enum-)veld: <code>{bron}</code></div>}
              {opties.length === 0 && keuzeDef && <div style={{ color: "var(--cg-fout, red)" }}>Meerkeuze vraagt een enum-veld: <code>{keuzeDef.naam}</code></div>}
              <div style={{ display: "flex", gap: "0.5rem 1.25rem", flexWrap: "wrap" }}>
                {opties.map((opt) => (
                  <label key={opt} style={{ display: "inline-flex", alignItems: "center", gap: 4, cursor: readOnly ? "default" : "pointer" }}>
                    <input type="checkbox" checked={gekozen.has(opt)} onChange={() => toggle(opt)} disabled={readOnly} />
                    {opt}
                  </label>
                ))}
              </div>
            </fieldset>
          );
        }

        return (
          <fieldset key={index} className="cg-form-section" style={{ marginBottom: "1rem", padding: "0.75rem", border: "1px dashed var(--cg-rand, #ccc)", borderRadius: "6px" }}>
            <legend className="utrecht-heading-3" style={{ fontSize: "1rem", fontWeight: 600, padding: "0 0.5rem" }}>
              {element.label || bron} {legendaSuffix && <span style={{ fontWeight: 400, fontSize: "0.8em", color: "var(--cg-donkergrijs, #666)" }}>{legendaSuffix}</span>}
            </legend>
            {element.beschrijving && <div className="utrecht-form-field-description" style={{ marginBottom: "0.25rem" }}>{element.beschrijving}</div>}
            {getoond.length === 0 && (
              <div style={{ color: "var(--cg-donkergrijs, #666)", fontSize: "0.875rem", marginBottom: "0.5rem" }}>Nog geen items.</div>
            )}
            {getoond.map((g, ri) => {
              const magWeg = !readOnly && g.idx >= 0 && getoond.length > min;
              return (
                <div key={ri} style={isVasteRij ? {} : { position: "relative", border: "1px solid var(--cg-rand, #e2e8f0)", borderRadius: "6px", padding: "0.5rem 0.75rem", marginBottom: "0.5rem" }}>
                  {!isVasteRij && (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" }}>
                      <span style={{ fontSize: "0.75rem", color: "var(--cg-donkergrijs, #666)" }}>#{ri + 1}</span>
                      {magWeg && (
                        <button type="button" onClick={() => zetAlle(alle.filter((_, j) => j !== g.idx))} style={{ border: "none", background: "none", color: "var(--cg-fout, #dc2626)", cursor: "pointer", fontSize: "0.9rem" }} title="Verwijder item">✕</button>
                      )}
                    </div>
                  )}
                  {template.map((child, ci) => renderElement(child, ci, rijScope(g)))}
                </div>
              );
            })}
            {!readOnly && getoond.length < max && (
              <button type="button" onClick={() => zetAlle([...alle, { ...vast }])} className="utrecht-button utrecht-button--secondary-action" style={{ fontSize: "0.8125rem", padding: "0.25rem 0.75rem" }}>
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
