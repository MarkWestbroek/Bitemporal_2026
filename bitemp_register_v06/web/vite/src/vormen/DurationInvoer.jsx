import { EENHEDEN, leesDuur, schrijfDuur, duurTekstNL } from "./duur";

const STANDAARD = ["jaren", "maanden", "dagen"];

/**
 * DurationInvoer — de vorm `duration`: een tijdsduur (datatype Duur) als losse getallen per
 * eenheid, opgeslagen als ISO 8601 ("P1Y2M", "PT30M"). Welke eenheden: vormConfig.units
 * (standaard jaren, maanden, dagen). Een opgeslagen waarde met een eenheid die niet in de lijst
 * staat, krijgt er toch een veld bij, zodat er niets verloren gaat. Alleen-lezen: "1 jaar en
 * 2 maanden".
 *
 * Props: waarde, onChange, readOnly, labelId, config { units }
 */
export default function DurationInvoer({ waarde, onChange, readOnly = false, labelId, config = {} }) {
  if (readOnly) return <span>{duurTekstNL(waarde) || "—"}</span>;
  const delen = leesDuur(waarde);
  const ongeldig = delen === null;
  const d = delen || {};
  const gekozen = new Set(Array.isArray(config.units) && config.units.length ? config.units : STANDAARD);
  const zichtbaar = EENHEDEN.filter((e) => gekozen.has(e.sleutel) || d[e.sleutel] > 0);

  return (
    <div role="group" aria-labelledby={labelId} style={{ display: "flex", gap: "0.5rem 0.9rem", alignItems: "flex-end", flexWrap: "wrap" }}>
      {zichtbaar.map((e) => (
        <label key={e.sleutel} style={{ display: "inline-flex", flexDirection: "column", fontSize: "0.8rem", color: "var(--cg-donkergrijs, #64748b)" }}>
          {e.meer}
          <input type="number" min={0} step={e.sleutel === "seconden" ? "any" : 1} inputMode="numeric"
            className="utrecht-textbox utrecht-textbox--html-input" style={{ width: "7ch" }}
            value={d[e.sleutel] ?? ""}
            onChange={(ev) => {
              const n = ev.target.value === "" ? undefined : Math.max(0, Number(ev.target.value));
              onChange(schrijfDuur({ ...d, [e.sleutel]: n }));
            }} />
        </label>
      ))}
      <span aria-live="polite" style={{ fontSize: "0.85rem", paddingBottom: 6, color: ongeldig ? "#b91c1c" : "var(--cg-donkergrijs, #64748b)" }}>
        {ongeldig ? `"${waarde}" is geen geldige duur; vul hem opnieuw in` : duurTekstNL(waarde)}
      </span>
    </div>
  );
}
