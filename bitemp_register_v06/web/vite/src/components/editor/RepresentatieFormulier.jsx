import { useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router";
import { useSchema } from "../../context/SchemaContext";
import { safeArray } from "../../shared/schemaUtils";
import SchemaFormField from "./SchemaFormField";
import { coercedWaardeVoorVeld } from "../actions/ActionFormParts";

/**
 * RepresentatieFormulier — formulier voor één representatie (entiteit, GE of relatie).
 * Toont dynamisch alle velden uit typeMeta, met validatie en opslaan via /api/registreer.
 */
export default function RepresentatieFormulier({ typeMeta, initialData, onSaved }) {
  const { baseUrl } = useSchema();
  const navigate = useNavigate();
  const velden = safeArray(typeMeta?.velden);
  const isNieuw = !initialData;

  // Formulierstaat
  const [values, setValues] = useState(() => {
    const init = {};
    for (const veld of velden) {
      init[veld.naam] = initialData?.[veld.naam] ?? "";
    }
    return init;
  });

  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const updateVeld = useCallback((naam, waarde) => {
    setValues((prev) => ({ ...prev, [naam]: waarde }));
  }, []);

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      setBusy(true);
      setFeedback(null);

      try {
        // Coerce waarden naar juiste types
        const payload = {};
        for (const veld of velden) {
          if (veld.autoIncrement) continue; // Skip autoincrement velden
          const raw = values[veld.naam];
          if (raw === "" || raw === null || raw === undefined) {
            if (veld.verplicht) throw new Error(`${veld.naam} is verplicht.`);
            continue;
          }
          payload[veld.naam] = coercedWaardeVoorVeld(raw, veld, veld.naam);
        }

        // Bouw registratie-payload
        const wijziging = {
          metatype: typeMeta.metatype,
          typenaam: typeMeta.typenaam,
          wijzigingstype: "opvoer",
          representatie: payload,
        };

        const registratiePayload = {
          opmerking: isNieuw ? `Nieuw ${typeMeta.typenaam}` : `Bewerk ${typeMeta.typenaam}`,
          wijzigingen: [wijziging],
        };

        const res = await fetch(`${baseUrl}/registratie/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(registratiePayload),
        });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(`HTTP ${res.status}: ${text}`);
        }

        setFeedback({ type: "succes", text: "Opgeslagen!" });
        if (onSaved) onSaved();
      } catch (err) {
        setFeedback({ type: "fout", text: err.message });
      } finally {
        setBusy(false);
      }
    },
    [values, velden, typeMeta, baseUrl, isNieuw, onSaved]
  );

  return (
    <form onSubmit={handleSubmit}>
      <div className="cg-form-card">
        <div className="cg-form-section">
          <div className="cg-form-section__title">
            {isNieuw ? `Nieuw: ${typeMeta.klassenaam || typeMeta.typenaam}` : typeMeta.klassenaam || typeMeta.typenaam}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "0.5rem 1.5rem" }}>
            {velden.map((veld) => (
              <SchemaFormField
                key={veld.naam}
                veld={veld}
                value={values[veld.naam]}
                onChange={(val) => updateVeld(veld.naam, val)}
                readOnly={!!initialData && (veld.naam === (typeMeta.idKolom || "id") || veld.autoIncrement)}
              />
            ))}
          </div>
        </div>

        {/* Formele metadata (readonly) */}
        {initialData && (initialData.opvoer || initialData.afvoer) && (
          <div className="cg-form-section" style={{ opacity: 0.7 }}>
            <div className="cg-form-section__title" style={{ fontSize: "0.875rem" }}>Formele tijd (metadata)</div>
            <div style={{ display: "flex", gap: "2rem", fontSize: "0.875rem" }}>
              {initialData.opvoer && <span><strong>Opvoer:</strong> {initialData.opvoer}</span>}
              {initialData.afvoer && <span><strong>Afvoer:</strong> {initialData.afvoer}</span>}
            </div>
          </div>
        )}

        {feedback && (
          <div className={feedback.type === "succes" ? "cg-feedback--succes" : "cg-feedback--fout"}>
            {feedback.text}
          </div>
        )}

        <div style={{ display: "flex", gap: "0.75rem", paddingTop: "0.75rem" }}>
          <button type="submit" className="utrecht-button utrecht-button--primary-action" disabled={busy}>
            {busy ? "Opslaan…" : "Opslaan"}
          </button>
          <button
            type="button"
            className="utrecht-button utrecht-button--secondary-action"
            onClick={() => navigate(-1)}
            disabled={busy}
          >
            Terug
          </button>
        </div>
      </div>
    </form>
  );
}
