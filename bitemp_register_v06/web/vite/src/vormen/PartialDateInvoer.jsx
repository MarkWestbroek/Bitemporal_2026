import { useState, useEffect } from "react";
import { MAANDEN, leesDatumIncompleet, schrijfDatumIncompleet, datumIncompleetTekst, dagenInMaand } from "./datumIncompleet";

/**
 * PartialDateInvoer — de vorm `partial-date`: een gedeeltelijk bekende datum (datatype
 * DatumIncompleet). Jaar (verplicht om iets op te slaan), maand en dag, elk met "onbekend".
 * De dag kan pas als de maand bekend is. Opslag via datumIncompleet.js ("1975-06" of, met
 * unknownStyle "nullen", "1975-06-00"). Alleen-lezen: "juni 1975".
 *
 * Props: waarde, onChange, readOnly, labelId, config { unknownStyle, minYear, maxYear }
 */
export default function PartialDateInvoer({ waarde, onChange, readOnly = false, labelId, config = {} }) {
  const extern = leesDatumIncompleet(waarde);
  // Het jaar wordt lokaal bijgehouden tijdens het typen ("19" is nog geen jaar).
  const [jaarTekst, setJaarTekst] = useState(extern.jaar);
  useEffect(() => { if (extern.jaar) setJaarTekst(extern.jaar); }, [extern.jaar]);

  if (readOnly) return <span>{datumIncompleetTekst(waarde) || "—"}</span>;

  const stijl = config.unknownStyle === "nullen" ? "nullen" : "kort";
  const zet = (delen) => onChange(schrijfDatumIncompleet({ ...extern, jaar: extern.jaar || jaarTekst, ...delen }, stijl));
  const jaarGeldig = /^\d{4}$/.test(jaarTekst);
  const buiten = jaarGeldig && ((config.minYear != null && Number(jaarTekst) < config.minYear) || (config.maxYear != null && Number(jaarTekst) > config.maxYear));
  const dagen = dagenInMaand(extern.jaar, extern.maand);
  const selStijl = { width: "auto", minWidth: 0 };

  return (
    <div role="group" aria-labelledby={labelId} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <select className="utrecht-select utrecht-select--html-select" aria-label="Dag" style={selStijl}
        value={extern.dag ? String(Number(extern.dag)) : ""} disabled={!extern.maand}
        onChange={(e) => zet({ dag: e.target.value })}>
        <option value="">dag onbekend</option>
        {Array.from({ length: dagen }, (_, i) => <option key={i + 1} value={String(i + 1)}>{i + 1}</option>)}
      </select>
      <select className="utrecht-select utrecht-select--html-select" aria-label="Maand" style={selStijl}
        value={extern.maand ? String(Number(extern.maand)) : ""} disabled={!jaarGeldig}
        onChange={(e) => zet({ maand: e.target.value, ...(e.target.value ? {} : { dag: "" }) })}>
        <option value="">maand onbekend</option>
        {MAANDEN.map((m, i) => <option key={m} value={String(i + 1)}>{m}</option>)}
      </select>
      <input type="text" inputMode="numeric" className="utrecht-textbox utrecht-textbox--html-input" aria-label="Jaar"
        placeholder="jaar" maxLength={4} value={jaarTekst} style={{ width: "7ch" }}
        onChange={(e) => {
          const j = e.target.value.replace(/\D/g, "").slice(0, 4);
          setJaarTekst(j);
          onChange(/^\d{4}$/.test(j) ? schrijfDatumIncompleet({ ...extern, jaar: j }, stijl) : "");
        }} />
      <span aria-live="polite" style={{ fontSize: "0.85rem", color: buiten ? "#b91c1c" : "var(--cg-donkergrijs, #64748b)" }}>
        {buiten ? `jaar tussen ${config.minYear ?? "…"} en ${config.maxYear ?? "…"}` : datumIncompleetTekst(waarde)}
      </span>
    </div>
  );
}
