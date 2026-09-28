/**
 * Uitleg.jsx — het (i)-rondje bij een vraag, en het paneel met de uitleg (shared/uitleg.js).
 *
 * Toegankelijk als "disclosure", niet als tooltip: een echte knop (Tab, Enter, spatie) met
 * aria-expanded en aria-controls; het paneel staat in de gewone volgorde direct onder het
 * label, werkt op mobiel en in de iframe, en Escape sluit het en zet de focus terug op de knop.
 * Geen uitleg (geen code, eigen tekst of bediening van de vorm) → geen rondje.
 * `data-uitleg` op knop en paneel: een blur daarvan telt niet als 'veld aangeraakt' (SchemaFormField),
 * anders verschijnt 'verplicht' al na het openen van de uitleg.
 *
 * Gebruik als render-prop, zodat de knop náást het label kan staan (een knop hoort niet ín een
 * <label>) en het paneel eronder:
 *   <Uitleg element={el} vorm={vorm} label="Postcode">
 *     {({ knop, paneel }) => <>…label… {knop} {paneel}</>}
 *   </Uitleg>
 */
import { createContext, useContext, useId, useMemo, useRef, useState } from "react";
import { uitlegVoor, STANDAARD_TAAL } from "../../shared/uitleg.js";
import { markdownNaarHtml } from "../../publicatie/markdown.js";
import { VORMEN, normaliseerVorm } from "../../vormen/vormen.js";

/** { index, taal } — gezet door CustomFormulierRenderer (diepte 0). */
export const UitlegContext = createContext({ index: {}, taal: STANDAARD_TAAL });

const knopStijl = {
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  width: "1.25rem", height: "1.25rem", marginLeft: "0.35rem", padding: 0, verticalAlign: "text-bottom",
  borderRadius: "50%", border: "1.5px solid var(--cg-blauw, #1d4ed8)", background: "var(--cg-wit, #fff)",
  color: "var(--cg-blauw, #1d4ed8)", font: "italic 700 0.75rem/1 Georgia, serif", cursor: "pointer",
};
const paneelStijl = {
  margin: "0.25rem 0 0.5rem", padding: "0.5rem 0.75rem", borderLeft: "3px solid var(--cg-blauw, #1d4ed8)",
  background: "var(--cg-lichtblauw, #eff6ff)", borderRadius: "0 6px 6px 0", fontSize: "0.9rem", fontWeight: 400,
};

export default function Uitleg({ element, vorm, label = "", children }) {
  const { index, taal } = useContext(UitlegContext);
  const [open, setOpen] = useState(false);
  const knopRef = useRef(null);
  const id = useId();
  const naamVorm = normaliseerVorm(vorm || element?.vorm);
  const uitleg = useMemo(
    () => uitlegVoor(element, { index, taal, vorm: naamVorm, bediening: VORMEN[naamVorm]?.bediening }),
    [element, index, taal, naamVorm]
  );
  if (!uitleg) return children({ knop: null, paneel: null });

  const paneelId = `uitleg-${id}`;
  const knop = (
    <button ref={knopRef} type="button" data-uitleg="" style={knopStijl} aria-expanded={open} aria-controls={paneelId}
      aria-label={`Uitleg bij ${label || "deze vraag"}`} title={open ? "Uitleg sluiten" : "Uitleg"}
      onClick={() => setOpen((o) => !o)}>i</button>
  );
  const paneel = (
    <div id={paneelId} data-uitleg="" role="region" aria-label={`Uitleg bij ${label || "deze vraag"}`} hidden={!open} style={paneelStijl}
      onKeyDown={(e) => { if (e.key === "Escape") { setOpen(false); knopRef.current?.focus(); } }}>
      {open && (
        <>
          {uitleg.titel && <strong style={{ display: "block", marginBottom: "0.2rem" }}>{uitleg.titel}</strong>}
          {uitleg.tekst && <div className="cg-uitleg-tekst" dangerouslySetInnerHTML={{ __html: markdownNaarHtml(uitleg.tekst) }} />}
          {uitleg.bediening && (
            <p style={{ margin: uitleg.tekst ? "0.4rem 0 0" : 0, color: "var(--cg-donkergrijs, #475569)", fontSize: "0.85rem" }}>
              <span aria-hidden="true">⌨ </span>{uitleg.bediening}
            </p>
          )}
        </>
      )}
    </div>
  );
  return children({ knop, paneel });
}
