import { useState, useCallback, useMemo, useEffect } from "react";
import { useNavigate } from "react-router";
import { useSchema } from "../../context/SchemaContext";
import { safeArray, platSlaHubItems } from "../../shared/schemaUtils";
import { evalueerCelExpressie, bouwCelContext } from "../../shared/celEvaluator";
import SchemaFormField from "./SchemaFormField";
import { coercedWaardeVoorVeld } from "../actions/ActionFormParts";

/**
 * RepresentatieFormulier — formulier voor één representatie (entiteit, GE of relatie).
 *
 * Bitemporele context:
 *   Dit formulier ontvangt altijd het *actuele* record (opvoer gezet, afvoer leeg).
 *   Bij opslaan wordt een registratie aangemaakt via POST /registratie/.
 *   De backend handelt het bitemporele mechanisme af:
 *   - Bij een enkelvoudig GE: vorige data-versie wordt automatisch afgevoerd
 *   - Bij een meervoudig GE: er kan een nieuw record worden toegevoegd
 *   - De hub zelf wordt niet aangeraakt, alleen de _Data of _Input representatie
 *
 * Hub→Data onderscheid:
 *   Het formulier toont de velden uit dataMeta (het _Data type) als die beschikbaar is,
 *   anders de velden van het hub-type zelf. Dit is nodig omdat de hub alleen structurele
 *   velden bevat (entiteit_id, rel_id), terwijl de data de inhoudsvelden heeft.
 *
 * Props:
 *  - typeMeta:         het hub-type metadata object uit de schema-API
 *  - dataMeta:         (optioneel) het data-subtype metadata object — als het type een
 *                      hub is (bijv. NatuurlijkPersoon_Naam) worden de inhoudsvelden
 *                      uit dataMeta getoond in plaats van de hub-plumbing velden.
 *  - initialData:      bestaand (platgeslagen) actueel record, of null voor nieuw
 *  - onSaved:          callback na succesvolle opslag
 *  - entiteitId:       parent entiteit ID (om FK terug te zetten in payload)
 *  - entiteitIdKolom:  naam van de FK-kolom (bijv. "natuurlijkpersoon_id")
 */
export default function RepresentatieFormulier({
  typeMeta,
  dataMeta,
  initialData,
  onSaved,
  onCancel,
  entiteitId,
  entiteitIdKolom,
  isEnkelvoudig = true,
}) {
  const { baseUrl, typeMetaByTypenaam } = useSchema();
  const navigate = useNavigate();
  const isNieuw = !initialData;

  // Selecteer velden: data-velden als die beschikbaar zijn, anders hub-velden
  const meta = dataMeta || typeMeta;
  const alleVelden = safeArray(meta?.velden);

  // Secondaire entiteit ID (bijv. locatie_id, b_id bij relaties)
  const secondaireIdKolom = String(typeMeta?.secondaireEntiteitIDKolom || "").toLowerCase();
  const doelEntiteitType = typeMeta?.doelEntiteit || "";
  const doelEntiteitMeta = doelEntiteitType ? typeMetaByTypenaam?.[doelEntiteitType] : null;
  const [secondaireOpties, setSecondaireOpties] = useState([]); // [{id, weergave}]
  const [secondaireLoading, setSecondaireLoading] = useState(false);
  const [secondaireError, setSecondaireError] = useState("");

  // Fetch volledige secondaire entiteiten + bereken weergaveveld
  useEffect(() => {
    if (!secondaireIdKolom || !doelEntiteitMeta) return;
    const apiPad = doelEntiteitMeta.padnaam || doelEntiteitMeta.meervoud || doelEntiteitMeta.veldnaam;
    if (!apiPad) return;
    setSecondaireLoading(true);
    fetch(`${baseUrl}/full/${encodeURIComponent(apiPad)}?page=1&size=1000`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => {
        const key = doelEntiteitMeta.meervoud || Object.keys(json).find((k) => Array.isArray(json[k]));
        const entities = safeArray(json[key] || json);
        const idKol = doelEntiteitMeta.idKolom || "id";
        // Bereken weergaveveld per entiteit via CEL-expressies
        const afgVelden = safeArray(doelEntiteitMeta?.afgeleideVelden)
          .filter((av) => av.isWeergaveVeld || av.weergaveVeld);
        const opties = entities.map((ent) => {
          let weergave = "";
          if (afgVelden.length > 0) {
            const onderl = safeArray(doelEntiteitMeta?.onderliggende);
            const childGroups = onderl.map((child) => {
              const childMeta = typeMetaByTypenaam?.[child.doeltype];
              const rawItems = safeArray(ent[child.jsonRolnaam] || ent[child.rolnaam]);
              const items = platSlaHubItems(rawItems, childMeta, typeMetaByTypenaam);
              return { doeltype: child.doeltype, rolnaam: child.rolnaam, items, typeMeta: childMeta };
            });
            const ctx = bouwCelContext(childGroups, typeMetaByTypenaam);
            weergave = afgVelden
              .map((av) => av.afleidingsregelTaal === "cel" && av.afleidingsregel
                ? evalueerCelExpressie(av.afleidingsregel, ctx) : null)
              .filter((v) => v != null && String(v).trim() !== "")
              .join(" | ");
          }
          return { id: ent[idKol], weergave };
        });
        setSecondaireOpties(opties);
        setSecondaireError("");
      })
      .catch((err) => { setSecondaireError(String(err?.message || err)); setSecondaireOpties([]); })
      .finally(() => setSecondaireLoading(false));
  }, [baseUrl, secondaireIdKolom, doelEntiteitMeta, typeMetaByTypenaam]);

  // Splits immutable en bewerkbare velden
  const { immutableVelden, bewerkbareVelden, secondaireVeld } = useMemo(() => {
    const plumbingNamen = new Set(["opvoer", "afvoer"]);
    const immutable = [];
    const bewerkbaar = [];
    let secVeld = null;
    for (const v of alleVelden) {
      const naam = String(v.naam || "").toLowerCase();
      if (plumbingNamen.has(naam)) continue; // toon apart
      // Secondaire ID kolom: bewerkbaar als dropdown, niet immutable
      if (secondaireIdKolom && naam === secondaireIdKolom) {
        secVeld = v;
        continue;
      }
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
    // Bij hub-pattern: secondaire FK zit op de hub (typeMeta), niet op de data-child.
    // Als het veld niet in alleVelden (= dataMeta.velden) gevonden is, zoek in typeMeta.velden.
    if (!secVeld && secondaireIdKolom && dataMeta) {
      const hubVelden = safeArray(typeMeta?.velden);
      secVeld = hubVelden.find((v) => String(v.naam || "").toLowerCase() === secondaireIdKolom) || null;
    }
    return { immutableVelden: immutable, bewerkbareVelden: bewerkbaar, secondaireVeld: secVeld };
  }, [alleVelden, typeMeta, entiteitIdKolom, secondaireIdKolom, dataMeta]);

  // Formulierstaat — bewerkbare velden + eventueel secondaire ID
  const [values, setValues] = useState(() => {
    const init = {};
    for (const veld of bewerkbareVelden) {
      init[veld.naam] = initialData?.[veld.naam] ?? "";
    }
    if (secondaireVeld) {
      init[secondaireVeld.naam] = initialData?.[secondaireVeld.naam] ?? "";
    }
    return init;
  });

  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const updateVeld = useCallback((naam, waarde) => {
    setValues((prev) => ({ ...prev, [naam]: waarde }));
  }, []);

  // Alle velden die "dirty" kunnen zijn (bewerkbare + secondaire)
  const alleBewerkbaar = useMemo(() => {
    return secondaireVeld ? [...bewerkbareVelden, secondaireVeld] : bewerkbareVelden;
  }, [bewerkbareVelden, secondaireVeld]);

  // ── Dirty tracking ──────────────────────────────────────────────────
  const isDirty = useMemo(() => {
    if (!initialData) return true;
    return alleBewerkbaar.some((veld) => {
      const original = initialData[veld.naam] ?? "";
      const current = values[veld.naam] ?? "";
      return String(original) !== String(current);
    });
  }, [values, alleBewerkbaar, initialData]);

  const aantalGewijzigdeVelden = useMemo(() => {
    if (!initialData) return alleBewerkbaar.length;
    return alleBewerkbaar.filter((veld) => {
      const original = initialData[veld.naam] ?? "";
      const current = values[veld.naam] ?? "";
      return String(original) !== String(current);
    }).length;
  }, [values, alleBewerkbaar, initialData]);

  // ── Payload builders ────────────────────────────────────────────────
  const buildOpvoerPayload = useCallback(() => {
    const repPayload = {};
    if (entiteitIdKolom && entiteitId != null) {
      repPayload[entiteitIdKolom] = Number(entiteitId);
    }
    if (initialData?.rel_id != null) {
      repPayload.rel_id = initialData.rel_id;
    }
    if (initialData && typeMeta?.idKolom) {
      const bestaandId = initialData[typeMeta.idKolom];
      if (bestaandId != null) repPayload[typeMeta.idKolom] = bestaandId;
    }
    for (const veld of bewerkbareVelden) {
      const raw = values[veld.naam];
      if (raw === "" || raw === null || raw === undefined) {
        if (veld.verplicht) throw new Error(`${veld.naam} is verplicht.`);
        continue;
      }
      repPayload[veld.naam] = coercedWaardeVoorVeld(raw, veld, veld.naam);
    }
    // Secondaire entiteit ID (bijv. b_id, locatie_id)
    if (secondaireVeld) {
      const secRaw = values[secondaireVeld.naam];
      if (secRaw !== "" && secRaw != null) {
        repPayload[secondaireVeld.naam] = Number(secRaw);
      } else if (secondaireVeld.verplicht) {
        throw new Error(`${secondaireVeld.naam} is verplicht.`);
      }
    }
    return repPayload;
  }, [values, bewerkbareVelden, typeMeta, entiteitId, entiteitIdKolom, initialData, secondaireVeld]);

  const buildAfvoerSleutel = useCallback(() => {
    const sleutel = {};
    const idKolom = typeMeta?.idKolom;
    if (idKolom && initialData?.[idKolom] != null) {
      sleutel[idKolom] = initialData[idKolom];
    }
    if (entiteitIdKolom && initialData?.[entiteitIdKolom] != null) {
      sleutel[entiteitIdKolom] = initialData[entiteitIdKolom];
    }
    // Secondaire FK mee in afvoer-sleutel zodat backend het record kan identificeren
    if (secondaireIdKolom && initialData?.[secondaireIdKolom] != null) {
      sleutel[secondaireIdKolom] = initialData[secondaireIdKolom];
    }
    if (!idKolom && initialData?.rel_id != null) {
      sleutel.rel_id = initialData.rel_id;
    } else if (!idKolom && initialData?.id != null) {
      sleutel.id = initialData.id;
    }
    return sleutel;
  }, [typeMeta, entiteitIdKolom, secondaireIdKolom, initialData]);

  // ── Actie-handler (wijzigen / corrigeren / beëindigen / verwijderen) ─
  const handleActie = useCallback(
    async (registratietype, isAfvoer = false) => {
      setBusy(true);
      setFeedback(null);
      try {
        const veldnaam = typeMeta.veldnaam || typeMeta.padnaam;
        const wijzigingen = isAfvoer
          ? [{ afvoer: { [veldnaam]: buildAfvoerSleutel() } }]
          : [{ opvoer: { [veldnaam]: buildOpvoerPayload() } }];

        const res = await fetch(`${baseUrl}/registratie/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ registratie: { registratietype }, wijzigingen }),
        });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(`HTTP ${res.status}: ${text}`);
        }

        const label = isAfvoer
          ? (isEnkelvoudig ? "Beëindigd" : "Verwijderd")
          : registratietype === "correctie" ? "Correctie opgeslagen" : "Opgeslagen";
        setFeedback({ type: "succes", text: `${label}!` });
        if (onSaved) onSaved();
      } catch (err) {
        setFeedback({ type: "fout", text: err.message });
      } finally {
        setBusy(false);
      }
    },
    [typeMeta, baseUrl, buildOpvoerPayload, buildAfvoerSleutel, onSaved, isEnkelvoudig]
  );

  // Wijzigen: bij weinig gewijzigde velden → suggestie corrigeren
  const handleWijzigen = useCallback(() => {
    if (aantalGewijzigdeVelden > 0 && aantalGewijzigdeVelden <= Math.ceil(alleBewerkbaar.length / 2) && alleBewerkbaar.length > 1) {
      if (window.confirm(
        `Er ${aantalGewijzigdeVelden === 1 ? "is" : "zijn"} slechts ${aantalGewijzigdeVelden} van de ${bewerkbareVelden.length} velden gewijzigd.\n\nWilt u niet eigenlijk corrigeren in plaats van wijzigen?\n\nKlik OK om te corrigeren, of Annuleren om toch te wijzigen.`
      )) {
        handleActie("correctie");
        return;
      }
    }
    handleActie("registratie");
  }, [handleActie, aantalGewijzigdeVelden, bewerkbareVelden.length]);

  const handleCorrigeren = useCallback(() => handleActie("correctie"), [handleActie]);

  const handleBeeindigen = useCallback(() => {
    const label = typeMeta?.klassenaam || typeMeta?.typenaam || "record";
    if (!window.confirm(`Weet u zeker dat u ${label} wilt beëindigen (afvoeren)?`)) return;
    handleActie("registratie", true);
  }, [handleActie, typeMeta]);

  const handleVerwijderen = useCallback(() => {
    const label = typeMeta?.klassenaam || typeMeta?.typenaam || "record";
    if (!window.confirm(`Weet u zeker dat u dit ${label} record wilt verwijderen?`)) return;
    handleActie("registratie", true);
  }, [handleActie, typeMeta]);

  const handleSubmit = useCallback(
    (e) => {
      e.preventDefault();
      if (isNieuw) handleActie("registratie");
    },
    [isNieuw, handleActie]
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

        {/* Secondaire entiteit ID als dropdown */}
        {secondaireVeld && (
          <div style={{ marginBottom: "0.5rem" }}>
            <label style={{ display: "block", fontWeight: 600, fontSize: "0.875rem", marginBottom: "0.25rem" }}>
              {secondaireVeld.naam}
              {secondaireVeld.verplicht && <span style={{ color: "var(--cg-fout, #dc2626)" }}> *</span>}
            </label>
            {secondaireLoading ? (
              <span style={{ fontSize: "0.8125rem", color: "var(--cg-donkergrijs)" }}>Laden…</span>
            ) : secondaireOpties.length > 0 ? (
              <select
                className="utrecht-select"
                style={{ minWidth: "320px" }}
                value={String(values[secondaireVeld.naam] ?? "")}
                onChange={(e) => updateVeld(secondaireVeld.naam, e.target.value)}
              >
                <option value="">(kies {doelEntiteitMeta?.klassenaam || secondaireVeld.naam})</option>
                {secondaireOpties.map((opt) => (
                  <option key={opt.id} value={String(opt.id)}>
                    {opt.weergave ? `${opt.id} — ${opt.weergave}` : String(opt.id)}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                inputMode="numeric"
                className="utrecht-textbox"
                style={{ minWidth: "200px" }}
                value={String(values[secondaireVeld.naam] ?? "")}
                onChange={(e) => updateVeld(secondaireVeld.naam, e.target.value)}
                placeholder={secondaireVeld.naam}
              />
            )}
            {secondaireError && (
              <div style={{ fontSize: "0.75rem", color: "var(--cg-fout, #dc2626)", marginTop: "0.25rem" }}>{secondaireError}</div>
            )}
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

        <div style={{ display: "flex", gap: "0.75rem", paddingTop: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
          {isNieuw ? (
            <button
              type="submit"
              className="utrecht-button utrecht-button--primary-action"
              style={{ padding: "0.5rem 1.25rem" }}
              disabled={busy}
            >
              {busy ? "Opslaan…" : "Opslaan"}
            </button>
          ) : isEnkelvoudig ? (
            <>
              <button
                type="button"
                className="utrecht-button utrecht-button--primary-action"
                style={{ padding: "0.5rem 1.25rem" }}
                disabled={busy || !isDirty}
                onClick={handleWijzigen}
              >
                {busy ? "Bezig…" : "Wijzigen"}
              </button>
              <button
                type="button"
                className="utrecht-button utrecht-button--secondary-action"
                style={{ padding: "0.5rem 1.25rem" }}
                disabled={busy || !isDirty}
                onClick={handleCorrigeren}
              >
                Corrigeren
              </button>
              <button
                type="button"
                className="utrecht-button utrecht-button--secondary-action"
                style={{ padding: "0.5rem 1.25rem", color: "var(--cg-fout, #b91c1c)" }}
                disabled={busy}
                onClick={handleBeeindigen}
              >
                Beëindigen
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="utrecht-button utrecht-button--secondary-action"
                style={{ padding: "0.5rem 1.25rem" }}
                disabled={busy || !isDirty}
                onClick={handleCorrigeren}
              >
                {busy ? "Bezig…" : "Corrigeren"}
              </button>
              <button
                type="button"
                className="utrecht-button utrecht-button--secondary-action"
                style={{ padding: "0.5rem 1.25rem", color: "var(--cg-fout, #b91c1c)" }}
                disabled={busy}
                onClick={handleVerwijderen}
              >
                Verwijderen
              </button>
              {onCancel && (
                <button
                  type="button"
                  className="utrecht-button utrecht-button--secondary-action"
                  style={{ padding: "0.5rem 1.25rem" }}
                  onClick={onCancel}
                >
                  Annuleren
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </form>
  );
}
