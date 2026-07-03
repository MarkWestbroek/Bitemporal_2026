/**
 * CelExpressieEditor — PropertyTypeEditor voor datatype "cel-expressie".
 *
 * Profiel-implementatie (canoniek-uml): hergebruikt de bestaande
 * ExpressieEditor-modal van de umleditor (syntax-highlighting, autocomplete,
 * validatie). De core kent dit datatype niet — het is het eerste bewijs dat
 * de registry datatype → PropertyTypeEditor uitbreidbaar is (plan §2,
 * property-laag).
 *
 * Weergave: één regel met de (ingekorte) expressie + "✎ Bewerken"-knop die
 * de modal opent. Context-velden voor autocomplete: de eigen velden van het
 * geselecteerde element (pad = veldnaam).
 */
import { lazy, Suspense, useMemo, useState } from "react";

const ExpressieEditor = lazy(() => import("../../umleditor/components/panels/ExpressieEditor.jsx"));

export default function CelExpressieEditor({ regel, waarde, onChange, element }) {
  const [open, setOpen] = useState(false);

  // Autocomplete-context: de velden van het element zelf.
  const contextVelden = useMemo(() => {
    const velden = [];
    for (const c of element?.compartimenten || []) {
      for (const v of c.velden || []) {
        if (v.naam) velden.push({ pad: v.naam, type: v.data?.typeLabel || "string", bron: "eigen" });
      }
    }
    return velden;
  }, [element]);

  return (
    <div style={{ flex: 1, minWidth: 0, display: "flex", gap: 3, alignItems: "center" }}>
      <input
        type="text"
        value={waarde || ""}
        placeholder={regel.label || regel.key}
        onChange={(e) => onChange(e.target.value)}
        style={{ fontFamily: "ui-monospace, monospace", fontSize: 11 }}
      />
      <button className="dc-mini-knop" title="Openen in expressie-editor" onClick={() => setOpen(true)}>
        ✎
      </button>
      {open && (
        <Suspense fallback={null}>
          <ExpressieEditor
            value={waarde || ""}
            taal="cel"
            contextVelden={contextVelden}
            onChange={onChange}
            onClose={() => setOpen(false)}
          />
        </Suspense>
      )}
    </div>
  );
}
