import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router";
import { useSchema } from "../../context/SchemaContext";
import { safeArray, platSlaHubItems, platSlaAlleVersies, tUitRegistratieTijdstip } from "../../shared/schemaUtils";
import { evalueerCelExpressie, bouwCelContext } from "../../shared/celEvaluator";
import RepresentatieFormulier from "./RepresentatieFormulier";

// ── Helpers ─────────────────────────────────────────────────────────────

/**
 * filterActueel — filtert platgeslagen items op formele geldigheid.
 *
 * Bitemporele context:
 *   - Een GE/relatie is "actueel" als het een opvoer heeft en géén afvoer.
 *   - Na een ongedaanmaking kan de opvoer ontbreken → dan is het record niet meer geldig.
 *   - Bij een nieuwe versie van een enkelvoudig GE (bijv. Partnernaam_Data v2)
 *     wordt de vorige versie afgevoerd (afvoer gezet); de nieuwe is actueel.
 *
 * Na platSlaan bevat het item de opvoer/afvoer van het hub-record.
 * De inhoudsvelden komen uit het actieve data-record (platSlaHubItems kiest
 * het data-record zonder afvoer).
 *
 * @param {Array} flatItems - platgeslagen hub-items (output van platSlaHubItems)
 * @returns {Array} Alleen items die nu formeel geldig zijn (opvoer ≠ null, afvoer = null)
 */
function filterActueel(flatItems) {
  return flatItems.filter((item) => item.opvoer && !item.afvoer);
}

/**
 * Berekent weergaveveld-tekst voor een child group uit de full entity.
 * Gebruikt het actuele (niet-afgevoerde) record voor de CEL-evaluatie.
 */
function childWeergave(childMeta, items, typeMetaByTypenaam) {
  const afgVelden = safeArray(childMeta?.afgeleideVelden)
    .filter((av) => av.isWeergaveVeld || av.weergaveVeld);
  if (afgVelden.length === 0 || items.length === 0) return null;

  const flat = platSlaHubItems(items, childMeta, typeMetaByTypenaam);
  const actief = flat.find((i) => !i.afvoer) || flat[0];
  if (!actief) return null;

  // Bouw een minimale context met de klassenaam als key
  const klassenaam = childMeta?.klassenaam || childMeta?.typenaam;
  const ctx = { [klassenaam]: actief };

  return afgVelden
    .map((av) => av.afleidingsregelTaal === "cel" ? evalueerCelExpressie(av.afleidingsregel, ctx) : null)
    .filter((v) => v != null && String(v).trim() !== "")
    .join(" | ");
}

/**
 * Geeft een korte samenvatting (max 3 primitieve velden) van een platgeslagen GE/rel item.
 */
function korteVeldSamenvatting(item, meta) {
  if (!item) return "";
  const skip = new Set(["opvoer", "afvoer"]);
  const entKolom = meta?.entiteitIDKolom;
  if (entKolom) skip.add(entKolom);

  return Object.entries(item)
    .filter(([k, v]) => !skip.has(k) && v != null && typeof v !== "object")
    .slice(0, 3)
    .map(([k, v]) => `${k}=${v}`)
    .join(", ");
}

/**
 * EntiteitFormulier — toont een volledige entiteit met geneste GE/relatie-secties.
 * Haalt de full entity op via /full/{padnaam}/{id} en rendert per onderliggend
 * type een formulier (enkelvoudig) of compact tabel (meervoudig).
 */
export default function EntiteitFormulier() {
  const { typePad, id } = useParams();
  const { baseUrl, typeMetaByPadnaam, typeMetaByTypenaam } = useSchema();
  const navigate = useNavigate();

  const typeMeta = typeMetaByPadnaam[typePad];
  const [entity, setEntity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [nieuwGE, setNieuwGE] = useState(null); // doeltype als er een nieuw record wordt toegevoegd
  const [bewerkRij, setBewerkRij] = useState(null); // { doeltype, index } — meervoudig rij in correctiemodus
  const [toonHistorie, setToonHistorie] = useState({}); // { [doeltype]: true/false } — toggle per GE-type

  const apiPath = typeMeta?.padnaam || typeMeta?.meervoud || typeMeta?.veldnaam;

  const fetchEntity = useCallback(async () => {
    if (!apiPath || !id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${baseUrl}/full/${apiPath}/${id}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setEntity(json);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [baseUrl, apiPath, id]);

  useEffect(() => { fetchEntity(); }, [fetchEntity]);

  // Weergaveveld berekening voor de hoofd-entiteit
  const weergaveTekst = useMemo(() => {
    if (!entity || !typeMeta) return "";
    const afgVelden = safeArray(typeMeta?.afgeleideVelden)
      .filter((av) => av.isWeergaveVeld || av.weergaveVeld);
    if (afgVelden.length === 0) return "";

    const onderliggende = safeArray(typeMeta?.onderliggende);
    const childGroups = onderliggende.map((child) => {
      const childMeta = typeMetaByTypenaam?.[child.doeltype];
      const rawItems = safeArray(entity[child.jsonRolnaam] || entity[child.rolnaam]);
      const items = platSlaHubItems(rawItems, childMeta, typeMetaByTypenaam);
      return { doeltype: child.doeltype, rolnaam: child.rolnaam, items, typeMeta: childMeta };
    });

    const ctx = bouwCelContext(childGroups, typeMetaByTypenaam);
    return afgVelden
      .map((av) => av.afleidingsregelTaal === "cel" ? evalueerCelExpressie(av.afleidingsregel, ctx) : null)
      .filter((v) => v != null && String(v).trim() !== "")
      .join(" | ");
  }, [entity, typeMeta, typeMetaByTypenaam]);

  if (!typeMeta) {
    return <div className="cg-feedback--fout">Onbekend type: {typePad}</div>;
  }

  if (loading) {
    return <div style={{ padding: "1rem", color: "var(--cg-donkergrijs)" }}>Laden…</div>;
  }

  if (error) {
    return <div className="cg-feedback--fout">Fout: {error}</div>;
  }

  if (!entity) {
    return <div className="cg-feedback--fout">Record niet gevonden.</div>;
  }

  // Filter onderliggende: skip materiële plumbing (aanvang/einde op entiteitsniveau)
  const onderliggende = safeArray(typeMeta.onderliggende).filter((child) => {
    const childMeta = typeMetaByTypenaam?.[child.doeltype];
    return childMeta && childMeta.ge_subtype !== "aanvang" && childMeta.ge_subtype !== "einde";
  });

  // Verwijderen (afvoer) van een meervoudig GE record
  async function handleVerwijderenRij(item, childMeta) {
    const label = childMeta?.klassenaam || childMeta?.typenaam || "record";
    if (!window.confirm(`Weet u zeker dat u dit ${label} record wilt verwijderen?`)) return;
    setBewerkRij(null);
    const veldnaam = childMeta.veldnaam || childMeta.padnaam;
    const idKolom = childMeta?.idKolom;
    const entKolom = childMeta?.entiteitIDKolom;
    const sleutel = {};
    if (idKolom && item[idKolom] != null) sleutel[idKolom] = item[idKolom];
    if (entKolom && item[entKolom] != null) sleutel[entKolom] = item[entKolom];
    if (!idKolom && item.rel_id != null) sleutel.rel_id = item.rel_id;
    try {
      const res = await fetch(`${baseUrl}/registratie/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registratie: { registratietype: "registratie" },
          wijzigingen: [{ afvoer: { [veldnaam]: sleutel } }],
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text}`);
      }
      fetchEntity();
    } catch (err) {
      alert(`Fout bij verwijderen: ${err.message}`);
    }
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "baseline", gap: "1rem", marginBottom: "1rem" }}>
        <button
          className="utrecht-button utrecht-button--secondary-action"
          onClick={() => navigate(`/t/${typeMeta.padnaam || typeMeta.meervoud || typePad}`)}
        >
          ← Terug naar overzicht
        </button>
        <h2 className="utrecht-heading-2" style={{ margin: 0 }}>
          {typeMeta.klassenaam || typeMeta.typenaam} #{id}
        </h2>
        {weergaveTekst && (
          <span style={{ color: "var(--cg-donkergrijs)", fontStyle: "italic", fontSize: "1rem" }}>
            {weergaveTekst}
          </span>
        )}
      </div>

      {/* Entiteit ID en formele tijd — compact weergave */}
      <div className="cg-form-card">
        <div className="cg-form-section">
          <div className="cg-form-section__title" style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
            <span>
              {typeMeta.klassenaam || typeMeta.typenaam}
              <span style={{ fontWeight: 400, fontSize: "0.8125rem", color: "var(--cg-donkergrijs)", marginLeft: "0.5rem" }}>
                #{entity[typeMeta.idKolom || "id"]}
              </span>
            </span>
            <span style={{ fontWeight: 400, fontSize: "0.75rem", color: "var(--cg-donkergrijs)" }}>
              {entity.opvoer && <>t={tUitRegistratieTijdstip(entity.opvoer) ?? "?"}</>}
              {entity.afvoer && <span style={{ color: "var(--cg-fout)", marginLeft: "0.75rem" }}>afgevoerd t={tUitRegistratieTijdstip(entity.afvoer) ?? "?"}</span>}
            </span>
          </div>

          {/* Samenvattend overzicht onderliggende GE's als scroll-knoppen.
            * Telt alleen actuele records (met opvoer, zonder afvoer). */}
          {onderliggende.length > 0 && (
            <div style={{ marginTop: "1rem", display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              {onderliggende.map((child) => {
                const childMeta = typeMetaByTypenaam?.[child.doeltype];
                if (!childMeta) return null;
                const rawItems = safeArray(entity[child.jsonRolnaam] || entity[child.rolnaam]);
                const flat = platSlaHubItems(rawItems, childMeta, typeMetaByTypenaam);
                const actueel = filterActueel(flat);
                const count = actueel.length;
                const actief = actueel[0] || null;
                const weergave = childWeergave(childMeta, rawItems, typeMetaByTypenaam);
                const samenvatting = weergave || (actief ? korteVeldSamenvatting(actief, childMeta) : "");
                const label = childMeta.klassenaam || child.rolnaam || child.doeltype;
                return (
                  <button
                    type="button"
                    key={child.doeltype}
                    onClick={() => {
                      const el = document.getElementById(`ge-${child.doeltype}`);
                      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                    style={{
                      display: "inline-block",
                      padding: "0.375rem 0.75rem",
                      borderRadius: "6px",
                      background: childMeta.kleur || "var(--cg-lichtgrijs)",
                      border: `1px solid ${childMeta.kleur ? "rgba(0,0,0,0.15)" : "var(--cg-grijs)"}`,
                      color: "var(--cg-donkerblauw)",
                      cursor: "pointer",
                      textAlign: "left",
                      fontSize: "0.8125rem",
                      lineHeight: 1.4,
                      boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                      transition: "box-shadow 0.15s, transform 0.1s",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 2px 6px rgba(0,0,0,0.14)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.08)"; e.currentTarget.style.transform = "none"; }}
                  >
                    <strong>{label}</strong>
                    {count > 0 ? ` (${count})` : ""}
                    {samenvatting && (
                      <span style={{ display: "block", fontSize: "0.75rem", color: "var(--cg-donkergrijs)" }}>
                        {samenvatting.length > 60 ? samenvatting.slice(0, 57) + "…" : samenvatting}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Onderliggende GE's en relaties */}
      {onderliggende.map((child) => {
        const childMeta = typeMetaByTypenaam?.[child.doeltype];
        if (!childMeta) return null;

        const rawItems = safeArray(entity[child.jsonRolnaam] || entity[child.rolnaam]);

        /*
         * Platslaan: hub→data zodat inhoudsvelden beschikbaar zijn.
         * Na platslaan bevat elk item de hub-velden (opvoer, afvoer, rel_id, entiteitID)
         * plus de inhoudsvelden van het actieve data-record.
         *
         * Daarna filteren we op formele geldigheid:
         *   - enkelvoudig GE: max 1 actief record (vorige versie is afgevoerd)
         *   - meervoudig GE:  0..n actieve records
         * Niet-actuele records (hub afgevoerd of opvoer leeg na ongedaanmaking) worden
         * uitgefilterd — de UI toont altijd de actuele toestand.
         */
        const flatItems = platSlaHubItems(rawItems, childMeta, typeMetaByTypenaam);
        const actueleItems = filterActueel(flatItems);
        const historischeItems = flatItems.length - actueleItems.length;

        const isEnkelvoudig = child.momentvoorkomen === "enkelvoudig";
        const label = childMeta.klassenaam || child.rolnaam || child.doeltype;

        // Bepaal welk data-type de inhoudsvelden definiëert
        const dataChild = safeArray(childMeta?.onderliggende).find((c) => {
          const cm = typeMetaByTypenaam?.[c.doeltype];
          return cm?.ge_subtype === "data";
        });
        const dataMeta = dataChild ? typeMetaByTypenaam?.[dataChild.doeltype] : null;
        // Gebruik data-velden als ze er zijn, anders de velden van het hub-type
        const inhoudsvelden = safeArray(dataMeta?.velden || childMeta?.velden).filter((v) => {
          // Filter plumbing-velden
          const naam = String(v.naam || "").toLowerCase();
          if (["opvoer", "afvoer", "versie"].includes(naam)) return false;
          if (childMeta.entiteitIDKolom && naam === childMeta.entiteitIDKolom) return false;
          if (v.autoIncrement) return false;
          return true;
        });

        // Alle velden (incl. plumbing) voor het formulier
        const alleVelden = safeArray(dataMeta?.velden || childMeta?.velden);

        return (
          <div key={child.doeltype} id={`ge-${child.doeltype}`} className="cg-form-card" style={{ marginTop: "0.75rem" }}>
            <div className="cg-form-section__title" style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
              <span>
                {label}
                <span style={{ fontWeight: 400, fontSize: "0.75rem", color: "var(--cg-donkergrijs)", marginLeft: "0.5rem" }}>
                  ({child.momentvoorkomen}) — {actueleItems.length} actueel
                  {historischeItems > 0 && (
                    <span style={{ color: "var(--cg-grijs)" }}>, {historischeItems} hist.</span>
                  )}
                </span>
                {/* Compact ID boven de gele streep voor enkelvoudig */}
                {isEnkelvoudig && actueleItems.length > 0 && (() => {
                  const item = actueleItems[0];
                  const entKolom = String(childMeta.entiteitIDKolom || "").toLowerCase();
                  const entId = entKolom ? item[entKolom] : null;
                  const relId = item.rel_id;
                  const versie = item.versie;
                  if (entId == null) return null;
                  let compactId = `${entId}`;
                  if (relId != null) compactId += `.${relId}`;
                  if (versie != null) compactId += `.${versie}`;
                  return <span style={{ fontWeight: 400, fontFamily: "monospace", fontSize: "0.6875rem", color: "var(--cg-donkergrijs)", marginLeft: "0.75rem" }}>#{compactId}</span>;
                })()}
              </span>
              {/* Symbolische formele tijd rechts, boven de gele streep */}
              {isEnkelvoudig && actueleItems.length > 0 && (
                <span style={{ fontWeight: 400, fontSize: "0.6875rem", color: "var(--cg-donkergrijs)" }}>
                  {actueleItems[0].opvoer && <>t={tUitRegistratieTijdstip(actueleItems[0].opvoer) ?? "?"}</>}
                  {actueleItems[0].afvoer && <span style={{ color: "var(--cg-fout)", marginLeft: "0.5rem" }}>afgevoerd t={tUitRegistratieTijdstip(actueleItems[0].afvoer) ?? "?"}</span>}
                </span>
              )}
            </div>

            {isEnkelvoudig && actueleItems.length > 0 ? (
              /* Enkelvoudig: formulier met het actuele (platgeslagen) record.
               * Bij enkelvoudig GEs is er altijd max 1 actueel hub-record.
               * Eerdere versies van de data zijn afgevoerd en worden niet getoond
               * tenzij de gebruiker de historie openklapt. */
              <div style={{ position: "relative" }}>
                {/* Gestapelde historische kaarten achter de actuele */}
                {(() => {
                  const rawHub = rawItems[0]; // eerste (enige) hub voor enkelvoudig
                  const alleVersies = rawHub ? platSlaAlleVersies(rawHub, childMeta, typeMetaByTypenaam) : [];
                  const historischeVersies = alleVersies.filter((v) => v._data_afvoer);
                  const heeftHistorie = historischeVersies.length > 0;
                  const historieTonen = toonHistorie[child.doeltype];

                  return (
                    <>
                      {/* Visuele "gestapelde kaarten" hint als er historie is */}
                      {heeftHistorie && !historieTonen && (
                        <div style={{
                          position: "absolute", top: 4, left: 4, right: -4, bottom: -4,
                          background: "var(--cg-grijs)", borderRadius: "6px", opacity: 0.5,
                          border: "1px solid var(--cg-grijs)", zIndex: 0,
                          pointerEvents: "none",
                        }} />
                      )}
                      {heeftHistorie && !historieTonen && historischeVersies.length > 1 && (
                        <div style={{
                          position: "absolute", top: 7, left: 7, right: -7, bottom: -7,
                          background: "var(--cg-grijs)", borderRadius: "6px", opacity: 0.3,
                          border: "1px solid var(--cg-grijs)", zIndex: 0,
                          pointerEvents: "none",
                        }} />
                      )}

                      {/* Actueel formulier (bovenop de stack) */}
                      <div style={{ position: "relative", zIndex: 1 }}>
                        <RepresentatieFormulier
                          typeMeta={childMeta}
                          dataMeta={dataMeta}
                          initialData={actueleItems[0]}
                          onSaved={fetchEntity}
                          entiteitId={id}
                          entiteitIdKolom={childMeta.entiteitIDKolom}
                          isEnkelvoudig={true}
                          hideIdEnTijd={true}
                        />
                      </div>

                      {/* Toggle om historie te tonen */}
                      {heeftHistorie && (
                        <div style={{ position: "relative", zIndex: 1, paddingTop: historieTonen ? "0.25rem" : "0.5rem" }}>
                          <button
                            type="button"
                            onClick={() => setToonHistorie((prev) => ({ ...prev, [child.doeltype]: !prev[child.doeltype] }))}
                            style={{
                              background: "none", border: "none", cursor: "pointer",
                              fontSize: "0.75rem", color: "var(--cg-blauw)",
                              padding: "0.125rem 0", textDecoration: "underline",
                            }}
                          >
                            {historieTonen ? "▴ Historie verbergen" : `▾ ${historischeVersies.length} historische versie${historischeVersies.length > 1 ? "s" : ""} tonen`}
                          </button>
                        </div>
                      )}

                      {/* Uitgeklapte historische versies */}
                      {heeftHistorie && historieTonen && (
                        <div style={{ position: "relative", zIndex: 1, marginTop: "0.25rem" }}>
                          {historischeVersies.map((versie, vi) => {
                            const tOpvoer = versie._data_opvoer ? tUitRegistratieTijdstip(versie._data_opvoer) : null;
                            const tAfvoer = versie._data_afvoer ? tUitRegistratieTijdstip(versie._data_afvoer) : null;
                            return (
                              <div
                                key={vi}
                                style={{
                                  background: "var(--cg-lichtgrijs)",
                                  border: "1px dashed var(--cg-grijs)",
                                  borderRadius: "6px",
                                  padding: "0.625rem 1rem",
                                  marginTop: vi > 0 ? "0.375rem" : 0,
                                  opacity: 0.75,
                                }}
                              >
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: "0.6875rem", color: "var(--cg-donkergrijs)", marginBottom: "0.375rem" }}>
                                  <span style={{ fontFamily: "monospace" }}>
                                    versie {versie._data_versie ?? (historischeVersies.length - vi)}
                                  </span>
                                  <span>
                                    {tOpvoer != null && <>t={tOpvoer}</>}
                                    {tAfvoer != null && <span style={{ color: "var(--cg-fout)", marginLeft: "0.5rem" }}>→ afgevoerd t={tAfvoer}</span>}
                                  </span>
                                </div>
                                <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap", fontSize: "0.8125rem" }}>
                                  {inhoudsvelden.map((v) => {
                                    const val = versie[v.naam];
                                    return val != null && val !== "" ? (
                                      <span key={v.naam}>
                                        <span style={{ color: "var(--cg-donkergrijs)" }}>{v.naam}:</span>{" "}
                                        <span style={{ color: "var(--cg-donkerblauw)" }}>{String(val)}</span>
                                      </span>
                                    ) : null;
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            ) : !isEnkelvoudig && actueleItems.length > 0 ? (
              /* Meervoudig: compact tabel met actuele records + acties per rij */
              <div>
                <div style={{ overflowX: "auto" }}>
                  <table className="utrecht-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr className="utrecht-table__header-row">
                        {inhoudsvelden.map((v) => (
                          <th key={v.naam} className="utrecht-table__header-cell">{v.naam}</th>
                        ))}
                        <th className="utrecht-table__header-cell" style={{ width: "1%", whiteSpace: "nowrap" }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {actueleItems.map((item, i) => (
                        <tr
                          key={i}
                          className="utrecht-table__row"
                          style={{
                            background: bewerkRij?.doeltype === child.doeltype && bewerkRij?.index === i
                              ? "var(--cg-lichtblauw, #e0f0ff)"
                              : i % 2 === 1 ? "var(--cg-lichtgrijs)" : undefined,
                          }}
                        >
                          {inhoudsvelden.map((v) => (
                            <td key={v.naam} className="utrecht-table__cell" style={{ padding: "0.375rem 0.75rem" }}>
                              {item[v.naam] != null ? String(item[v.naam]) : "—"}
                            </td>
                          ))}
                          <td className="utrecht-table__cell" style={{ padding: "0.375rem 0.5rem", whiteSpace: "nowrap" }}>
                            <button
                              type="button"
                              className="utrecht-button utrecht-button--secondary-action"
                              style={{ fontSize: "0.75rem", padding: "0.125rem 0.5rem", marginRight: "0.25rem" }}
                              title="Corrigeren"
                              onClick={() => { setNieuwGE(null); setBewerkRij({ doeltype: child.doeltype, index: i }); }}
                            >
                              ✎
                            </button>
                            <button
                              type="button"
                              className="utrecht-button utrecht-button--secondary-action"
                              style={{ fontSize: "0.75rem", padding: "0.125rem 0.5rem", color: "var(--cg-fout, #b91c1c)" }}
                              title="Verwijderen"
                              onClick={() => handleVerwijderenRij(item, childMeta)}
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Inline correctieformulier voor geselecteerde meervoudige rij */}
                {bewerkRij?.doeltype === child.doeltype && bewerkRij.index < actueleItems.length && (
                  <div style={{ marginTop: "0.5rem", padding: "0.75rem", border: "1px solid var(--cg-grijs, #ccc)", borderRadius: "6px", background: "var(--cg-lichtgrijs, #f8f9fa)" }}>
                    <div style={{ fontSize: "0.8125rem", fontWeight: 600, marginBottom: "0.5rem" }}>
                      Correctie {label}
                    </div>
                    <RepresentatieFormulier
                      typeMeta={childMeta}
                      dataMeta={dataMeta}
                      initialData={actueleItems[bewerkRij.index]}
                      onSaved={() => { setBewerkRij(null); fetchEntity(); }}
                      onCancel={() => setBewerkRij(null)}
                      entiteitId={id}
                      entiteitIdKolom={childMeta.entiteitIDKolom}
                      isEnkelvoudig={false}
                    />
                  </div>
                )}
              </div>
            ) : null}

            {/* Lege GE: mogelijkheid om nieuw record toe te voegen */}
            {actueleItems.length === 0 && nieuwGE !== child.doeltype && (
              <div style={{ display: "flex", alignItems: "center", gap: "1rem", padding: "0.5rem 0" }}>
                <span style={{ color: "var(--cg-donkergrijs)", fontSize: "0.875rem" }}>Geen records.</span>
                <button
                  type="button"
                  className="utrecht-button utrecht-button--secondary-action"
                  style={{ fontSize: "0.8125rem", padding: "0.25rem 0.75rem" }}
                  onClick={() => { setBewerkRij(null); setNieuwGE(child.doeltype); }}
                >
                  + {label} toevoegen
                </button>
              </div>
            )}

            {/* Nieuw record formulier */}
            {nieuwGE === child.doeltype && (
              <div style={{ marginTop: "0.5rem" }}>
                <RepresentatieFormulier
                  typeMeta={childMeta}
                  dataMeta={dataMeta}
                  initialData={null}
                  onSaved={() => { setNieuwGE(null); setBewerkRij(null); fetchEntity(); }}
                  entiteitId={id}
                  entiteitIdKolom={childMeta.entiteitIDKolom}
                />
                <button
                  type="button"
                  className="utrecht-button utrecht-button--secondary-action"
                  style={{ fontSize: "0.8125rem", marginTop: "0.5rem" }}
                  onClick={() => setNieuwGE(null)}
                >
                  Annuleren
                </button>
              </div>
            )}

            {/* Meervoudig: knop om extra record toe te voegen */}
            {!isEnkelvoudig && actueleItems.length > 0 && nieuwGE !== child.doeltype && (
              <div style={{ paddingTop: "0.5rem" }}>
                <button
                  type="button"
                  className="utrecht-button utrecht-button--secondary-action"
                  style={{ fontSize: "0.8125rem", padding: "0.25rem 0.75rem" }}
                  onClick={() => { setBewerkRij(null); setNieuwGE(child.doeltype); }}
                >
                  + {label} toevoegen
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
