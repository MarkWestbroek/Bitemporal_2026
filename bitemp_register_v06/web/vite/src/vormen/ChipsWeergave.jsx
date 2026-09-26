/**
 * ChipsWeergave — de weergavevorm `chips`: gekozen waarden als afgeronde labels. Voor één of
 * meer uit een lijst (ook "Laag 1;Laag 2" in één veld: de aanroeper splitst).
 * Props: items [{ value, label }] (alleen de gekozen), config { accentColor }, leegTekst
 */
export default function ChipsWeergave({ items = [], config = {}, leegTekst = "—" }) {
  if (!items.length) return <span style={{ color: "var(--cg-donkergrijs, #64748b)" }}>{leegTekst}</span>;
  const accent = config.accentColor || "#1d4ed8";
  return (
    <span style={{ display: "inline-flex", flexWrap: "wrap", gap: 6 }}>
      {items.map((it) => (
        <span key={it.value} style={{ padding: "0.15rem 0.6rem", borderRadius: 999, fontSize: "0.85rem", fontWeight: 600,
          background: `color-mix(in srgb, ${accent} 12%, white)`, color: accent, border: `1px solid color-mix(in srgb, ${accent} 30%, white)` }}>
          {it.label}
        </span>
      ))}
    </span>
  );
}
