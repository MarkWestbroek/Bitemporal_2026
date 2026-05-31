/**
 * BerichttypeEditor — stelt een Berichttype samen als projectie over het
 * canoniek model. Stap 3 van de "driehoek proces – regels – data".
 *
 * Velden komen binnen via:
 *  1) drag-and-drop vanuit de ModelPicker (MIME application/x-canoniek-fieldref);
 *  2) onPick vanuit een gekoppelde ModelPicker (host roept voegVeldExtern aan).
 *
 * De editor toont per veld: pad (afgeleid = oranje/cursief), datatype, t-dimensie,
 * een verplicht-toggle en volgorde-/verwijderknoppen. Onderaan kies je een
 * export-formaat dat bruikbaar is VANUIT Valtimo/Operaton:
 *   - Operaton message (correlatie-contract)
 *   - JSON Schema (payload-validatie)
 *   - BPMN extensionElements (<canoniek:berichttype>)
 *   - V3 JSON (intern model)
 *
 * Controlled component: geef `bericht` + `onChange(nieuwBericht)` mee.
 */
import { useState } from "react";
import { FIELDREF_MIME } from "../modelpicker";
import {
  voegVeldToe,
  verwijderVeld,
  zetVerplicht,
  verplaatsVeld,
  zetNaam,
  zetBeschrijving,
  valideerBerichttype,
  berichtVeldKey,
  naarOperatonMessage,
  naarJSONSchema,
  naarBpmnExtensionElements,
  naarV3Berichttype,
} from "./berichtModel";
import "./bericht.css";

function leesFieldRefUitDrop(e) {
  const raw = e.dataTransfer.getData(FIELDREF_MIME);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

const EXPORTS = [
  { id: "operaton", label: "Operaton message" },
  { id: "jsonschema", label: "JSON Schema" },
  { id: "bpmn", label: "BPMN extensions" },
  { id: "v3", label: "V3 JSON" },
];

function exportTekst(id, bericht) {
  switch (id) {
    case "operaton":
      return JSON.stringify(naarOperatonMessage(bericht), null, 2);
    case "jsonschema":
      return JSON.stringify(naarJSONSchema(bericht), null, 2);
    case "bpmn":
      return naarBpmnExtensionElements(bericht);
    case "v3":
    default:
      return JSON.stringify(naarV3Berichttype(bericht), null, 2);
  }
}

export default function BerichttypeEditor({ bericht, onChange }) {
  const [dropActief, setDropActief] = useState(false);
  const [exportId, setExportId] = useState("operaton");

  const onDrop = (e) => {
    e.preventDefault();
    setDropActief(false);
    const ref = leesFieldRefUitDrop(e);
    if (ref) onChange(voegVeldToe(bericht, ref));
  };

  const meldingen = valideerBerichttype(bericht);

  return (
    <div className="bt-root">
      <div className="bt-kop">
        <input
          className="bt-naam"
          value={bericht.naam}
          spellCheck={false}
          onChange={(e) => onChange(zetNaam(bericht, e.target.value))}
          placeholder="Berichttype-naam (bv. InwonerAanmelding)"
        />
        <textarea
          className="bt-beschrijving"
          value={bericht.beschrijving}
          onChange={(e) => onChange(zetBeschrijving(bericht, e.target.value))}
          placeholder="Beschrijving (optioneel)"
        />
      </div>

      <div
        className={`bt-dropzone${dropActief ? " bt-drop-actief" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDropActief(true);
        }}
        onDragLeave={() => setDropActief(false)}
        onDrop={onDrop}
      >
        Sleep velden uit de Model Picker hierheen om de projectie samen te stellen.
      </div>

      <div className="bt-velden">
        {bericht.velden.length === 0 && <div className="bt-leeg">Nog geen velden in dit berichttype.</div>}
        {bericht.velden.map((v, i) => {
          const key = berichtVeldKey(v);
          const ref = v.ref || {};
          return (
            <div className="bt-veld" key={key}>
              <span className={`bt-veld-pad${ref.afgeleid ? " bt-veld-afgeleid" : ""}`} title={ref.veldpad}>
                {ref.afgeleid ? "/ " : ""}
                {ref.veldpad}
              </span>
              {ref.datatype ? (
                <span className="bt-chip bt-chip-dt">{ref.datatype}</span>
              ) : ref.type ? (
                <span className="bt-chip">{ref.type}</span>
              ) : null}
              <span className="bt-chip bt-chip-dim">{ref.tDimensie === "materieel" ? "t_m" : "t_f"}</span>
              <label className="bt-verplicht" title="Verplicht in de payload">
                <input
                  type="checkbox"
                  checked={Boolean(v.verplicht)}
                  onChange={(e) => onChange(zetVerplicht(bericht, key, e.target.checked))}
                />
                verplicht
              </label>
              <button
                className="bt-iconbtn"
                disabled={i === 0}
                title="Omhoog"
                onClick={() => onChange(verplaatsVeld(bericht, key, -1))}
              >
                ↑
              </button>
              <button
                className="bt-iconbtn"
                disabled={i === bericht.velden.length - 1}
                title="Omlaag"
                onClick={() => onChange(verplaatsVeld(bericht, key, +1))}
              >
                ↓
              </button>
              <button
                className="bt-iconbtn bt-iconbtn-del"
                title="Verwijder veld"
                onClick={() => onChange(verwijderVeld(bericht, key))}
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>

      <div className="bt-meldingen">
        {meldingen.map((m, i) => (
          <div key={i} className={`bt-melding bt-melding-${m.niveau}`}>
            {m.tekst}
          </div>
        ))}
      </div>

      <div className="bt-export-tabs">
        {EXPORTS.map((x) => (
          <button
            key={x.id}
            className={`bt-tab${exportId === x.id ? " bt-tab-actief" : ""}`}
            onClick={() => setExportId(x.id)}
          >
            {x.label}
          </button>
        ))}
      </div>
      <pre className="bt-export-pre">{exportTekst(exportId, bericht)}</pre>
    </div>
  );
}
