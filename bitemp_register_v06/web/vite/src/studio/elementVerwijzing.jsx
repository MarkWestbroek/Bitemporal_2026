/**
 * elementVerwijzing — het cross-profiel "instantie-van"-concept (ontwerp
 * "Sequence hermetisch" §1–2) op studio-niveau:
 *
 *   - `resolveerElementRef({profielId, elementId})` — zoek element + profiel
 *     op via de profieltypeRegistry (runtime; verwijderde doelen → null);
 *   - datatype **"element-verwijzing"** — picker profiel → element, waarde
 *     `{profielId, elementId}`. Declaratief inperkbaar met `regel.profielen`
 *     en/of `regel.elementTypes`;
 *   - datatype **"operatie-keuze"** — voor berichten in een sequence-
 *     diagram: volgt de keten bericht → doel-punt → levenslijn →
 *     instantieVan → profieltype.operatiesVan(type-element) en biedt die
 *     operaties als keuzelijst (waarde `{id, naam}`).
 *
 * De editors registreren zich hier (studio-laag) op het core-koppelvlak —
 * de diagramcore zelf kent de profieltypeRegistry bewust niet.
 */
import React from "react";
import { getProfieltypen, getProfieltype } from "./profieltypeRegistry";
import { registreerPropertyTypeEditor } from "../diagramcore/inspector/propertyTypeEditors.jsx";

/** @param {{profielId?: string, elementId?: string}|null} ref */
export function resolveerElementRef(ref) {
  if (!ref?.profielId || !ref?.elementId) return null;
  const profiel = getProfieltype(ref.profielId);
  const element = profiel?.useStore?.getState?.().elements?.[ref.elementId] || null;
  if (!profiel || !element) return null;
  return { profiel, element, label: element.naam || element.id };
}

/**
 * Operaties van een element volgens zijn profieltype (OperatieResolver-
 * facet): `profieltype.operatiesVan(element, elements)` → [{id, naam, …}].
 */
export function operatiesVanRef(ref) {
  const opgelost = resolveerElementRef(ref);
  if (!opgelost?.profiel?.operatiesVan) return [];
  const elements = opgelost.profiel.useStore.getState().elements || {};
  try {
    return opgelost.profiel.operatiesVan(opgelost.element, elements) || [];
  } catch {
    return [];
  }
}

const selectStijl = {
  flex: 1,
  minWidth: 0,
  font: "inherit",
  fontSize: 12,
  padding: "3px 4px",
  border: "1px solid var(--s-border, #cbd5e1)",
  borderRadius: 6,
  background: "var(--s-panel, #fff)",
  color: "var(--s-fg, #1e293b)",
};

/** Picker profiel → element; waarde {profielId, elementId}. */
function ElementVerwijzingEditor({ regel, waarde, onChange }) {
  const ref = waarde || {};
  const profielen = getProfieltypen().filter(
    (p) => p.useStore?.getState?.().elements && (!regel.profielen || regel.profielen.includes(p.id))
  );
  const profiel = ref.profielId ? getProfieltype(ref.profielId) : null;
  const kandidaten = profiel
    ? Object.values(profiel.useStore.getState().elements || {}).filter(
        (el) =>
          !getTypeVan(profiel, el)?.isConnector &&
          (!regel.elementTypes || regel.elementTypes.includes(el.elementType))
      )
    : [];
  return (
    <div style={{ flex: 1, minWidth: 0, display: "flex", gap: 4 }}>
      <select
        value={ref.profielId || ""}
        title="profiel"
        style={{ ...selectStijl, flex: "0 1 40%" }}
        onChange={(e) => onChange(e.target.value ? { profielId: e.target.value, elementId: null } : null)}
      >
        <option value="">(geen)</option>
        {profielen.map((p) => (
          <option key={p.id} value={p.id}>{p.label}</option>
        ))}
      </select>
      <select
        value={ref.elementId || ""}
        title={regel.label || regel.key}
        style={selectStijl}
        disabled={!profiel}
        onChange={(e) => onChange(e.target.value ? { profielId: ref.profielId, elementId: e.target.value } : { profielId: ref.profielId, elementId: null })}
      >
        <option value="">(kies element)</option>
        {kandidaten
          .slice()
          .sort((a, b) => (a.naam || "").localeCompare(b.naam || ""))
          .map((el) => (
            <option key={el.id} value={el.id}>{el.naam || el.id}</option>
          ))}
      </select>
    </div>
  );
}

function getTypeVan(profiel, element) {
  return (profiel.descriptor?.elementTypes || []).find((t) => t.id === element.elementType) || null;
}

/**
 * Operatie-keuze voor een bericht: doel-punt → levenslijn → instantieVan →
 * operaties. Waarde: {id, naam} (naam ook persistent, zodat het edge-label
 * geen cross-store-lookup nodig heeft).
 */
function OperatieKeuzeEditor({ regel, waarde, onChange, element, context }) {
  const elements = context?.elements || {};
  // Keten: bericht.target (punt/activatie) → randVan (levenslijn) → instantieVan.
  const doel = element?.target ? elements[element.target] : null;
  const lijn = doel?.data?.randVan ? elements[doel.data.randVan] : doel;
  const ref = lijn?.data?.instantieVan || null;
  const operaties = operatiesVanRef(ref);
  if (!ref) {
    return (
      <span style={{ fontSize: 11, color: "var(--s-fg-muted, #64748b)" }}>
        (typeer eerst de doel-levenslijn — "instantie van")
      </span>
    );
  }
  const bekend = waarde?.id && operaties.some((o) => o.id === waarde.id);
  return (
    <select
      value={waarde?.id || ""}
      title={regel.label || regel.key}
      style={selectStijl}
      onChange={(e) => {
        const op = operaties.find((o) => o.id === e.target.value);
        onChange(op ? { id: op.id, naam: op.naam } : null);
      }}
    >
      <option value="">(geen operatie)</option>
      {!bekend && waarde?.id && <option value={waarde.id}>{waarde.naam} (niet meer gevonden)</option>}
      {operaties.map((o) => (
        <option key={o.id} value={o.id}>{o.naam}</option>
      ))}
    </select>
  );
}

registreerPropertyTypeEditor("element-verwijzing", ElementVerwijzingEditor);
registreerPropertyTypeEditor("operatie-keuze", OperatieKeuzeEditor);
