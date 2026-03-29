import { useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router";
import { useSchema } from "../../context/SchemaContext";
import { safeArray } from "../../shared/schemaUtils";
import SchemaFormField from "./SchemaFormField";
import { coercedWaardeVoorVeld } from "../actions/ActionFormParts";

/**
 * RepresentatieFormulier — formulier voor één representatie (entiteit, GE of relatie).
 *
 * Props:
 *  - typeMeta:         het hub-type metadata object uit de schema-API
 *  - dataMeta:         (optioneel) het data-subtype metadata object — als het type een
 *                      hub is (bijv. NatuurlijkPersoon_Naam) worden de inhoudsvelden
 *                      uit dataMeta getoond in plaats van de hub-plumbing velden.
 *  - initialData:      bestaand (platgeslagen) record, of null voor nieuw
 *  - onSaved:          callback na succesvolle opslag
 *  - entiteitId:       parent entiteit ID (om FK terug te zetten in payload)
 *  - entiteitIdKolom:  naam van de FK-kolom (bijv. "natuurlijkpersoon_id")
 */
export default function RepresentatieFormulier({
  typeMeta,
  dataMeta,
  initialData,
  onSaved,
  entiteitId,
  entiteitIdKolom,
}) {
  const { baseUrl } = useSchema();
  const navigate = useNavigate();
  const isNieuw = !initialData;

  // Selecteer velden: data-velden als die beschikbaar zijn, anders hub-velden
  const meta = dataMeta || typeMeta;
  const alleVelden = safeArray(meta?.velden);

  // Splits immutable en bewerkbare velden
  const { immutableVelden, bewerkbareVelden } = useMemo(() => {
    const plumbingNamen = new Set(["opvoer", "afvoer"]);
    const immutable = [];
    const bewerkbaar = [];
    for (const v of alleVelden) {
      const naam = String(v.naam || "").toLowerCase();
      if (plumbingNamen.has(naam)) continue; // toon apart
      const isImmutable = v.autoIncrement
        || naam === String(typeMeta?.idKolom || "id").toLowerCase()
        || naam === String(entiteitIdKolom || "").toLowerCase()
        || naam === "versie"
        || naam === "rel_id";
      if (isImmutable) {
        immutable.push(v);
      } else {
        bewerkbaar.push(v);
      }
    }
    return { immutableVelden: immutable, bewerkbareVelden: bewerkbaar };
  }, [alleVelden, typeMeta, entiteitIdKolom]);

  // Formulierstaat — alleen bewerkbare velden
  const [values, setValues] = useState(() => {
    const init = {};
    for (const veld of bewerkbareVelden) {
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
        const payload = {};

        // FK naar parent entiteit
        if (entiteitIdKolom && entiteitId != null) {
          payload[entiteitIdKolom] = entiteitId;
        }

        for (const veld of bewerkbareVelden) {
          const raw = values[veld.naam];
          if (raw === "" || raw === null || raw === undefined) {
            if (veld.verplicht) throw new Error(`${veld.naam} is verplicht.`);
            continue;
          }
          payload[veld.naam] = coercedWaardeVoorVeld(raw, veld, veld.naam);
        }

        const registratiePayload = {
          opmerking: isNieuw ? `Nieuw ${typeMeta.typenaam}` : `Bewerk ${typeMeta.typenaam}`,
          wijzigingen: [
            {
              metatype: typeMeta.metatype,
              typenaam: typeMeta.typenaam,
              wijzigingstype: "opvoer",
              representatie: payload,
            },
          ],
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
    [values, bewerkbareVelden, typeMeta, baseUrl, isNieuw, onSaved, entiteitId, entiteitIdKolom]
  );

  return (
    <form onSubmit={handleSubmit}>
      <div className="cg-form-section">
        {/* Immutable velden als read-only display */}
        {immutableVelden.length > 0 && initialData && (
          <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap", fontSize: "0.875rem", color: "var(--cg-donkergrijs)", marginBottom: "0.5rem" }}>
            {immutableVelden.map((v) => {
              const val = initialData[v.naam];
              return val != null && val !== "" ? (
                <span key={v.naam}>
                  <strong>{v.naam}:</strong> {String(val)}
                </span>
              ) : null;
            })}
          </div>
        )}

        {/* Bewerkbare velden */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "0.5rem 1.5rem" }}>
          {bewerkbareVelden.map((veld) => (
            <SchemaFormField
              key={veld.naam}
              veld={veld}
              value={values[veld.naam]}
              onChange={(val) => updateVeld(veld.naam, val)}
            />
          ))}
        </div>

        {/* Formele metadata (readonly) */}
        {initialData && (initialData.opvoer || initialData.afvoer) && (
          <div style={{ opacity: 0.7, marginTop: "0.5rem" }}>
            <div style={{ fontSize: "0.8125rem", fontWeight: 600, marginBottom: "0.25rem" }}>Formele tijd</div>
            <div style={{ display: "flex", gap: "2rem", fontSize: "0.8125rem" }}>
              {initialData.opvoer && <span>opvoer: {String(initialData.opvoer).slice(0, 19).replace("T", " ")}</span>}
              {initialData.afvoer && <span style={{ color: "var(--cg-fout)" }}>afvoer: {String(initialData.afvoer).slice(0, 19).replace("T", " ")}</span>}
            </div>
          </div>
        )}

        {feedback && (
          <div className={feedback.type === "succes" ? "cg-feedback--succes" : "cg-feedback--fout"} style={{ marginTop: "0.5rem" }}>
            {feedback.text}
          </div>
        )}

        <div style={{ display: "flex", gap: "0.75rem", paddingTop: "0.75rem" }}>
          <button
            type="submit"
            className="utrecht-button utrecht-button--primary-action"
            style={{ padding: "0.5rem 1.25rem" }}
            disabled={busy}
          >
            {busy ? "Opslaan…" : "Opslaan"}
          </button>
        </div>
      </div>
    </form>
  );
}
