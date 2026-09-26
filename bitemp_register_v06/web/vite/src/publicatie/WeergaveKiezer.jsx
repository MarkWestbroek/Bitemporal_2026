import { isEmbedModus } from "./embed";

/**
 * WeergaveKiezer — kies welke WeergaveDefinitie de publicatiepagina gebruikt, als er voor het
 * type meer dan één actief is (zoals "Invoer via" bij formulieren). De keuze gaat via
 * `?weergave=<id>` in de URL (querystring vóór de #), dus een link naar een weergave is te
 * delen; de standaard = zonder parameter. In de embed (iframe) nooit: die toont de standaard.
 *
 * Props: alternatieven [{ id, naam, isStandaard }], huidigId
 */
export default function WeergaveKiezer({ alternatieven = [], huidigId }) {
  if (isEmbedModus() || alternatieven.length < 2) return null;
  const kies = (id) => {
    const url = new URL(window.location.href);
    const gekozen = alternatieven.find((a) => String(a.id) === String(id));
    if (!gekozen || gekozen.isStandaard) url.searchParams.delete("weergave");
    else url.searchParams.set("weergave", String(id));
    window.location.assign(url.toString());
  };
  return (
    <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.85rem", marginLeft: "auto" }}>
      Weergave
      <select className="utrecht-select utrecht-select--html-select" value={String(huidigId ?? "")} onChange={(e) => kies(e.target.value)} style={{ minWidth: 200 }}>
        {alternatieven.map((a) => (
          <option key={a.id} value={String(a.id)}>{a.naam}{a.isStandaard ? " (standaard)" : ""}</option>
        ))}
      </select>
    </label>
  );
}
