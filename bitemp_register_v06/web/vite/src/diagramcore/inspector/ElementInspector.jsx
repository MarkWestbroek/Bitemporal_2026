/**
 * ElementInspector (diagramcore) — gegenereerd eigenschappen-paneel.
 *
 * Volledig configuratie-gedreven: het formulier wordt opgebouwd uit
 *   1. de naam van het element,
 *   2. `elementType.dataVelden` (element-brede data zoals notitie-tekst),
 *   3. `elementType.compartments` × `FieldType.editor` (regels per veld).
 *
 * De inspector kent geen domein: hij rendert widgets ("text" | "textarea" |
 * "checkbox") volgens de descriptor en levert wijzigingen als patch terug via
 * `onUpdate` (zelfde vorm als store.updateElement).
 */
import { useCallback } from "react";

function Widget({ regel, waarde, onChange, widgetContext }) {
  if (regel.widget === "checkbox") {
    return (
      <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11 }}>
        <input type="checkbox" checked={!!waarde} onChange={(e) => onChange(e.target.checked)} />
        {regel.label || regel.key}
      </label>
    );
  }
  if (regel.widget === "textarea") {
    return <textarea value={waarde || ""} onChange={(e) => onChange(e.target.value)} />;
  }
  if (regel.widget === "kleur") {
    return (
      <input
        type="color"
        value={waarde || "#e2e8f0"}
        title={regel.label || regel.key}
        style={{ width: 36, height: 24, padding: 1, border: "1px solid var(--s-border, #cbd5e1)", borderRadius: 6, cursor: "pointer" }}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  if (regel.widget === "select") {
    // Opties: array = statisch; string = sleutel in de widgetContext van de
    // activiteit. Kandidaten mogen strings zijn of VerwijzingsKandidaten
    // ({waarde, label, icoon, groep}) — die laatste worden per groep als
    // optgroup gerenderd (VerwijzingsBron-patroon, plan §4.5b).
    const ruw = Array.isArray(regel.opties) ? regel.opties : widgetContext?.[regel.opties] || [];
    const kandidaten = ruw.map((o) => (typeof o === "string" ? { waarde: o, label: o } : o));
    const groepen = [];
    for (const k of kandidaten) {
      const naam = k.groep || "";
      let g = groepen.find((x) => x.naam === naam);
      if (!g) groepen.push((g = { naam, items: [] }));
      g.items.push(k);
    }
    const bekend = kandidaten.some((k) => k.waarde === waarde);
    const optie = (k) => (
      <option key={k.waarde} value={k.waarde}>
        {k.label}
        {k.icoon ? ` ${k.icoon}` : ""}
      </option>
    );
    return (
      <select
        value={waarde ?? ""}
        onChange={(e) => onChange(e.target.value)}
        style={{ flex: 1, minWidth: 0, font: "inherit", fontSize: 12, padding: "3px 4px", border: "1px solid var(--s-border, #cbd5e1)", borderRadius: 6, background: "var(--s-panel, #fff)", color: "var(--s-fg, #1e293b)" }}
      >
        {waarde && !bekend && <option value={waarde}>{waarde}</option>}
        <option value="">{`(${regel.label || regel.key})`}</option>
        {groepen.map((g) =>
          g.naam ? (
            <optgroup key={g.naam} label={g.naam}>
              {g.items.map(optie)}
            </optgroup>
          ) : (
            g.items.map(optie)
          )
        )}
      </select>
    );
  }
  return (
    <input
      type="text"
      value={waarde ?? ""}
      placeholder={regel.label || regel.key}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

/** Eén veld-rij binnen een compartiment: widgets volgens FieldType.editor. */
function VeldRij({ veld, fieldType, bewerkbaar, widgetContext, onChange, onVerwijder }) {
  const regels = fieldType?.editor || [{ key: "naam", widget: "text" }];
  const waardeVan = (key) => (key === "naam" ? veld.naam : veld.data?.[key]);
  const zet = (key, waarde) => {
    if (key === "naam") onChange({ ...veld, naam: waarde });
    else onChange({ ...veld, data: { ...veld.data, [key]: waarde } });
  };
  return (
    <div className="dc-inspector-rij">
      {regels.map((regel) => (
        <Widget
          key={regel.key}
          regel={regel}
          waarde={waardeVan(regel.key)}
          widgetContext={widgetContext}
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
  widgetContext,
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

      {/* Element-brede data-velden (bv. notitie-tekst, constraint-expressie) */}
      {(elementType?.dataVelden || []).map((regel) => (
        <div className="dc-inspector-rij" key={regel.key}>
          <label className="dc-veldlabel">{regel.label || regel.key}</label>
          <Widget
            regel={regel}
            waarde={element.data?.[regel.key]}
            widgetContext={widgetContext}
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
                widgetContext={widgetContext}
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
