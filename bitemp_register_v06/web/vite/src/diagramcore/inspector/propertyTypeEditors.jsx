/**
 * propertyTypeEditors — de registry datatype → PropertyTypeEditor (metamodel
 * §2, Implementatie-domein).
 *
 * Een PropertyType is declaratief {key, datatype, referenceTypes?}; de widget
 * die hem bewerkt wordt hier op datatype opgezocht. De core levert de
 * standaard-datatypes (string, tekst, boolean, colour); profielen registreren
 * er eigen bij (bv. "cel-expressie" → de CEL-editor van canoniek-uml) zonder
 * dat de core-inspector verandert.
 *
 * Heeft een PropertyType `referenceTypes`, dan wint de VerwijzingsKiezer
 * (keuzelijst + minibrowser) — kandidaten komen dan via ReferenceResolvers
 * uit het model/runtime (plan §4.5b).
 *
 * Editor-contract: component met props
 *   { regel, waarde, onChange, element?, kandidaten? }
 */
import { useMemo, useRef, useState } from "react";
import { getShape, alleShapeIds } from "../shapes/shapeRegistry.js";
import { TypeIcoon, alleIcoonIds } from "../shapes/typeIconen.jsx";

const _editors = new Map();

/** @param {string} datatype @param {Function} Component */
export function registreerPropertyTypeEditor(datatype, Component) {
  _editors.set(datatype, Component);
}

/** @param {string} datatype */
export function getPropertyTypeEditor(datatype) {
  return _editors.get(datatype);
}

// ── Standaard-editors (core) ────────────────────────────────────────────────

function StringEditor({ regel, waarde, onChange }) {
  return (
    <input
      type="text"
      value={waarde ?? ""}
      placeholder={regel.label || regel.key}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function TekstEditor({ waarde, onChange }) {
  // rows=2: metagegevens-teksten (definitie/toelichting) zijn meestal kort;
  // de textarea groeit gewoon mee met de schuifbalk.
  return <textarea rows={2} value={waarde || ""} onChange={(e) => onChange(e.target.value)} />;
}

function BooleanEditor({ regel, waarde, onChange }) {
  // Alleen de checkbox: het label staat al vóór de rij (element-properties)
  // of in het veld-detailpaneel — dubbel label maakte de inspector breed.
  return (
    <input
      type="checkbox"
      title={regel.label || regel.key}
      checked={!!waarde}
      onChange={(e) => onChange(e.target.checked)}
      style={{ flex: "0 0 auto" }}
    />
  );
}

function ColourEditor({ regel, waarde, onChange }) {
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

/**
 * Shape-kiezer (P06): keuzelijst over de shape-registry met een live
 * mini-preview van de gekozen shape — zo zie je in de PE wat een
 * ElementType gaat worden. De preview gebruikt de kleur van het ontwerp
 * (data.doelKleur) als die er is.
 */
function ShapeKeuzeEditor({ regel, waarde, onChange, element }) {
  const ids = alleShapeIds().filter((id) => !["anker", "edge"].includes(id));
  const gekozen = waarde || "class-box";
  const Shape = getShape(gekozen);
  const dummyElement = {
    naam: element?.naam || "Aa",
    data: { kleur: element?.data?.doelKleur },
    compartimenten: [],
  };
  const dummyType = { kleur: element?.data?.doelKleur || "#e2e8f0", compartments: [] };
  return (
    <div style={{ flex: 1, minWidth: 0, display: "flex", gap: 6, alignItems: "center" }}>
      <select
        value={gekozen}
        onChange={(e) => onChange(e.target.value)}
        style={{ flex: 1, minWidth: 0, font: "inherit", fontSize: 12, padding: "3px 4px", border: "1px solid var(--s-border, #cbd5e1)", borderRadius: 6, background: "var(--s-panel, #fff)", color: "var(--s-fg, #1e293b)" }}
      >
        {ids.map((id) => (
          <option key={id} value={id}>{id}</option>
        ))}
      </select>
      <div
        title={`preview: ${gekozen}`}
        style={{ flex: "0 0 auto", width: 78, height: 40, overflow: "hidden", borderRadius: 6, border: "1px dashed var(--s-border, #cbd5e1)", position: "relative", pointerEvents: "none" }}
      >
        <div style={{ position: "absolute", top: 2, left: 2, width: 152, height: 72, transform: "scale(0.48)", transformOrigin: "top left" }}>
          {Shape ? (
            <Shape element={dummyElement} elementType={dummyType} selected={false} fieldTypesById={{}} compartmentTypesById={{}} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Icoon-kiezer (P05/P06): registry-lijst met het icoon zelf ernaast. */
function IcoonKeuzeEditor({ regel, waarde, onChange }) {
  const ids = alleIcoonIds();
  return (
    <div style={{ flex: 1, minWidth: 0, display: "flex", gap: 6, alignItems: "center" }}>
      <select
        value={waarde || ""}
        onChange={(e) => onChange(e.target.value)}
        style={{ flex: 1, minWidth: 0, font: "inherit", fontSize: 12, padding: "3px 4px", border: "1px solid var(--s-border, #cbd5e1)", borderRadius: 6, background: "var(--s-panel, #fff)", color: "var(--s-fg, #1e293b)" }}
      >
        <option value="">(volgt de shape)</option>
        {ids.map((id) => (
          <option key={id} value={id}>{id}</option>
        ))}
      </select>
      <span style={{ flex: "0 0 auto", display: "inline-flex", width: 20, justifyContent: "center" }} title={waarde || "shape-fallback"}>
        <TypeIcoon elementType={{ icoon: waarde || undefined, shape: "class-box" }} maat={16} />
      </span>
    </div>
  );
}

registreerPropertyTypeEditor("string", StringEditor);
registreerPropertyTypeEditor("shape-keuze", ShapeKeuzeEditor);
registreerPropertyTypeEditor("icoon-keuze", IcoonKeuzeEditor);
registreerPropertyTypeEditor("tekst", TekstEditor);
registreerPropertyTypeEditor("boolean", BooleanEditor);
registreerPropertyTypeEditor("colour", ColourEditor);

// ── VerwijzingsKiezer: keuzelijst + minibrowser op ReferenceResolvers ──────

/**
 * Keuzelijst (optgroups per ReferenceType) met een 🔍-knop die de
 * minibrowser opent: een popover met zoekveld en de kandidaten gegroepeerd
 * per soort en pad (package/domein). Zelfde kandidaten, rijkere kiezer.
 */
export function VerwijzingsKiezer({ regel, waarde, onChange, kandidaten = [] }) {
  const [open, setOpen] = useState(false);
  const [zoek, setZoek] = useState("");
  const ankerRef = useRef(null);

  const groepeer = (lijst) => {
    const per = [];
    for (const k of lijst) {
      const naam = k.groep || "";
      let g = per.find((x) => x.naam === naam);
      if (!g) per.push((g = { naam, items: [] }));
      g.items.push(k);
    }
    return per;
  };

  // Ongefilterd voor de keuzelijst; gefilterd (zoekterm) voor de minibrowser.
  const alleGroepen = useMemo(() => groepeer(kandidaten), [kandidaten]);
  const groepen = useMemo(() => {
    const term = zoek.trim().toLowerCase();
    return groepeer(term ? kandidaten.filter((k) => k.label.toLowerCase().includes(term)) : kandidaten);
  }, [kandidaten, zoek]);

  const bekend = kandidaten.some((k) => k.waarde === waarde);
  const optie = (k) => (
    <option key={k.waarde} value={k.waarde}>
      {k.label}
      {k.icoon ? ` ${k.icoon}` : ""}
    </option>
  );

  return (
    <div ref={ankerRef} style={{ flex: 1, minWidth: 0, display: "flex", gap: 3, position: "relative" }}>
      <select
        value={waarde ?? ""}
        onChange={(e) => onChange(e.target.value)}
        style={{ flex: 1, minWidth: 0, font: "inherit", fontSize: 12, padding: "3px 4px", border: "1px solid var(--s-border, #cbd5e1)", borderRadius: 6, background: "var(--s-panel, #fff)", color: "var(--s-fg, #1e293b)" }}
      >
        {waarde && !bekend && <option value={waarde}>{waarde}</option>}
        <option value="">{`(${regel.label || regel.key})`}</option>
        {alleGroepen.map((g) =>
          g.naam ? (
            <optgroup key={g.naam} label={g.naam}>
              {g.items.map(optie)}
            </optgroup>
          ) : (
            g.items.map(optie)
          )
        )}
      </select>
      <button
        className="dc-mini-knop"
        title="Bladeren…"
        onClick={() => {
          setZoek("");
          setOpen((v) => !v);
        }}
      >
        🔍
      </button>

      {open && (
        <div className="dc-minibrowser">
          <input
            type="text"
            autoFocus
            placeholder="Zoek type…"
            value={zoek}
            onChange={(e) => setZoek(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
          />
          <div className="dc-minibrowser-lijst">
            {groepen.length === 0 && <div className="dc-minibrowser-leeg">Geen kandidaten</div>}
            {groepen.map((g) => (
              <div key={g.naam || "_"}>
                {g.naam && <div className="dc-minibrowser-groep">{g.naam}</div>}
                {g.items.map((k) => (
                  <button
                    key={k.waarde}
                    className={"dc-minibrowser-item" + (k.waarde === waarde ? " is-actief" : "")}
                    onClick={() => {
                      onChange(k.waarde);
                      setOpen(false);
                    }}
                  >
                    <span>
                      {k.icoon ? `${k.icoon} ` : ""}
                      {k.label}
                    </span>
                    {k.pad?.filter(Boolean).length ? (
                      <span className="dc-minibrowser-pad">{k.pad.filter(Boolean).join(" / ")}</span>
                    ) : null}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
