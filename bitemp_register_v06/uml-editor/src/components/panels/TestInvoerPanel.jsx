/**
 * TestInvoerPanel — Subsscherm voor het interactief testen van gegevenstype-validatie.
 *
 * Toont:
 *   - Dropdown om een gegevenstype te kiezen (uit de datatypeNodes op het canvas)
 *   - Invoerveld met weergave-hints (placeholder, prefix, suffix)
 *   - Live validatieresultaat: genormaliseerde waarde, fouten, stap-voor-stap feedback
 *   - Voorbeeldwaarden als snelknoppen
 *
 * Props:
 *   - datatypeNodes: React Flow nodes met type === "gegevenstype"
 *   - onClose: callback om het paneel te sluiten
 *
 * De validatie gebruikt de herbruikbare validatiebibliotheek uit src/validatie/
 * — exact dezelfde code die in de bitemporele data-frontend hergebruikt wordt.
 */
import { useState, useMemo } from "react";
import { valideer } from "../../validatie";

export default function TestInvoerPanel({ datatypeNodes = [], onClose }) {
  const [selectedFormat, setSelectedFormat] = useState("");
  const [invoer, setInvoer] = useState("");
  const [verplicht, setVerplicht] = useState(false);
  const [resultaat, setResultaat] = useState(null);

  // Bouw datatype-objecten uit de React Flow nodes
  const datatypes = useMemo(
    () => datatypeNodes.map((n) => n.data),
    [datatypeNodes]
  );

  const geselecteerdDatatype = useMemo(
    () => datatypes.find((dt) => dt.format === selectedFormat) || null,
    [datatypes, selectedFormat]
  );

  const weergave = geselecteerdDatatype?.weergave || {};
  const voorbeelden = geselecteerdDatatype?.validatie?.voorbeelden || [];

  function handleValideer() {
    if (!geselecteerdDatatype) return;
    const res = valideer(invoer, geselecteerdDatatype, { verplicht });
    setResultaat(res);
  }

  function handleInvoerChange(e) {
    setInvoer(e.target.value);
    // Automatisch valideren bij elke wijziging
    if (geselecteerdDatatype) {
      const res = valideer(e.target.value, geselecteerdDatatype, { verplicht });
      setResultaat(res);
    }
  }

  function handleVoorbeeld(vb) {
    setInvoer(String(vb));
    if (geselecteerdDatatype) {
      const res = valideer(String(vb), geselecteerdDatatype, { verplicht });
      setResultaat(res);
    }
  }

  function handleFormatChange(format) {
    setSelectedFormat(format);
    setInvoer("");
    setResultaat(null);
  }

  return (
    <div className="test-invoer-panel">
      <div className="test-invoer-header">
        <h3>🧪 Test invoer validatie</h3>
        {onClose && (
          <button className="btn-icon" onClick={onClose} title="Sluiten">
            ✕
          </button>
        )}
      </div>

      {datatypeNodes.length === 0 ? (
        <p className="test-invoer-empty">
          Voeg eerst een gegevenstype toe aan het canvas om validatie te testen.
        </p>
      ) : (
        <>
          {/* Gegevenstype kiezen */}
          <label>
            Gegevenstype
            <select
              value={selectedFormat}
              onChange={(e) => handleFormatChange(e.target.value)}
            >
              <option value="">— Kies een gegevenstype —</option>
              {datatypes.map((dt) => (
                <option key={dt.format || dt.naam} value={dt.format}>
                  {dt.naam} ({dt.basistype})
                </option>
              ))}
            </select>
          </label>

          {geselecteerdDatatype && (
            <>
              {/* Beschrijving */}
              {geselecteerdDatatype.description && (
                <p className="test-invoer-beschrijving">
                  {geselecteerdDatatype.description}
                </p>
              )}

              {/* Invoerveld met prefix/suffix */}
              <label>
                Testwaarde
                <div className="test-invoer-veld-wrapper">
                  {weergave.prefix && (
                    <span className="test-invoer-affix prefix">{weergave.prefix}</span>
                  )}
                  <input
                    type="text"
                    value={invoer}
                    onChange={handleInvoerChange}
                    placeholder={weergave.placeholder || ""}
                    className={
                      resultaat
                        ? resultaat.geldig
                          ? "invoer-geldig"
                          : "invoer-ongeldig"
                        : ""
                    }
                  />
                  {weergave.suffix && (
                    <span className="test-invoer-affix suffix">{weergave.suffix}</span>
                  )}
                </div>
              </label>

              <label className="checkbox-label small">
                <input
                  type="checkbox"
                  checked={verplicht}
                  onChange={(e) => setVerplicht(e.target.checked)}
                />
                Verplicht veld
              </label>

              {/* Voorbeeldwaarden */}
              {voorbeelden.length > 0 && (
                <div className="test-invoer-voorbeelden">
                  <span className="test-invoer-voorbeelden-label">Voorbeelden:</span>
                  {voorbeelden.map((vb, i) => (
                    <button
                      key={i}
                      className="btn-voorbeeld"
                      onClick={() => handleVoorbeeld(vb)}
                      title={`Test met "${vb}"`}
                    >
                      {String(vb)}
                    </button>
                  ))}
                </div>
              )}

              {/* Valideer knop */}
              <button className="btn-valideer" onClick={handleValideer}>
                ✓ Valideer
              </button>

              {/* Resultaat */}
              {resultaat && (
                <div
                  className={`test-invoer-resultaat ${
                    resultaat.geldig ? "geldig" : "ongeldig"
                  }`}
                >
                  <div className="resultaat-status">
                    {resultaat.geldig ? "✅ Geldig" : "❌ Ongeldig"}
                  </div>

                  {resultaat.genormaliseerd !== invoer && (
                    <div className="resultaat-normalisatie">
                      <span className="resultaat-label">Genormaliseerd:</span>{" "}
                      <code>{resultaat.genormaliseerd}</code>
                    </div>
                  )}

                  {resultaat.fouten.length > 0 && (
                    <ul className="resultaat-fouten">
                      {resultaat.fouten.map((fout, i) => (
                        <li key={i}>{fout}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* Details van het datatype (ter referentie) */}
              <details className="test-invoer-details">
                <summary>Datatype-definitie</summary>
                <pre>{JSON.stringify(geselecteerdDatatype, null, 2)}</pre>
              </details>
            </>
          )}
        </>
      )}
    </div>
  );
}
