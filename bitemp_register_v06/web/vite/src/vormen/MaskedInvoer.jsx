import { pasMaskerToe, maskerWaarde, maskerPlaceholder } from "./masker";

/**
 * MaskedInvoer — de vorm `masked`: een tekstveld met een invoermasker (masker.js), zoals het
 * datatype het noemt (NLPostcode "0000 AA"). Letterlijke tekens verschijnen vanzelf, letters
 * worden hoofdletter, tekens die niet passen worden genegeerd. Plakken werkt ("1234ab" →
 * "1234 AB"). De validatie blijft die van het datatype (shared/datatypeValidatie.js).
 *
 * Props: waarde, onChange, readOnly, labelId, config { mask, keepLiterals, placeholder }
 */
export default function MaskedInvoer({ waarde, onChange, readOnly = false, labelId, config = {} }) {
  const mask = config.mask || "";
  const weergave = mask ? pasMaskerToe(waarde, mask).weergave : String(waarde ?? "");
  if (readOnly) return <span style={{ fontVariantNumeric: "tabular-nums" }}>{weergave || "—"}</span>;
  return (
    <input
      type="text"
      className="utrecht-textbox utrecht-textbox--html-input"
      aria-labelledby={labelId}
      value={weergave}
      placeholder={config.placeholder || (mask ? maskerPlaceholder(mask) : undefined)}
      maxLength={mask ? mask.replace(/\\(.)/g, "$1").length : undefined}
      inputMode={/^[0\W]*$/.test(mask) ? "numeric" : undefined}
      autoComplete="off"
      spellCheck={false}
      onChange={(e) => onChange(mask ? maskerWaarde(e.target.value, mask, Boolean(config.keepLiterals)) : e.target.value)}
      style={{ fontVariantNumeric: "tabular-nums", letterSpacing: "0.03em", maxWidth: mask ? `${Math.max(8, mask.length + 4)}ch` : undefined }}
    />
  );
}
