/**
 * m3Editors — twee bedieningen voor de ontwerptaal (ontwerptaal.js), die het M3 als taal
 * gebruikt: een getal (`m3-getal`) en een samengestelde waarde als JSON (`m3-json`).
 *
 * De waarde in het model blijft een echte waarde (getal, lijst, object); alleen de invoer is
 * tekst. Ongeldige JSON wordt niet opgeslagen: je ziet de fout, en de oude waarde blijft staan
 * tot de tekst weer klopt. Leeg = niet gezet.
 */
import { useEffect, useState } from "react";
import { getPropertyTypeEditor, registreerPropertyTypeEditor } from "../../diagramcore/inspector/propertyTypeEditors.jsx";

const STIJL = { flex: 1, minWidth: 0, font: "inherit", fontSize: 12, padding: "3px 6px", border: "1px solid var(--s-border, #cbd5e1)", borderRadius: 6, background: "var(--s-panel, #fff)", color: "var(--s-fg, #1e293b)" };

function GetalEditor({ regel, waarde, onChange }) {
  return (
    <input
      type="number"
      style={STIJL}
      value={waarde ?? ""}
      placeholder={regel.placeholder || ""}
      onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
    />
  );
}

const alsTekst = (waarde) => (waarde === undefined ? "" : JSON.stringify(waarde, null, 2));

function JsonEditor({ regel, waarde, onChange }) {
  const [tekst, setTekst] = useState(() => alsTekst(waarde));
  const [fout, setFout] = useState("");
  // Een wijziging van buiten (undo, sync) neemt de tekst over, zolang hij niet kapot is.
  useEffect(() => {
    if (!fout) setTekst(alsTekst(waarde));
  }, [waarde]); // eslint-disable-line react-hooks/exhaustive-deps
  const wijzig = (nieuw) => {
    setTekst(nieuw);
    if (!nieuw.trim()) {
      setFout("");
      onChange(undefined);
      return;
    }
    try {
      const gelezen = JSON.parse(nieuw);
      setFout("");
      onChange(gelezen);
    } catch (e) {
      setFout(e.message);
    }
  };
  return (
    <span style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0, gap: 2 }} data-testid={`m3-json-${regel.key}`}>
      <textarea
        rows={Math.min(8, Math.max(1, tekst.split("\n").length))}
        spellCheck={false}
        style={{ ...STIJL, fontFamily: "var(--s-mono, monospace)", fontSize: 11, resize: "vertical", borderColor: fout ? "#dc2626" : STIJL.border }}
        value={tekst}
        placeholder="JSON"
        onChange={(e) => wijzig(e.target.value)}
      />
      {fout && <span style={{ color: "#dc2626", fontSize: 11 }}>Geen geldige JSON; niet opgeslagen ({fout}).</span>}
    </span>
  );
}

/** Idempotent (HMR). */
export function registreerM3Editors() {
  if (!getPropertyTypeEditor("m3-getal")) registreerPropertyTypeEditor("m3-getal", GetalEditor);
  if (!getPropertyTypeEditor("m3-json")) registreerPropertyTypeEditor("m3-json", JsonEditor);
}
