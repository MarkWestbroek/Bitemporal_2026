import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router";
import { useSchema } from "../../context/SchemaContext";
import { safeArray, platSlaHubItems } from "../../shared/schemaUtils";
import { evalueerCelExpressie, bouwCelContext } from "../../shared/celEvaluator";
import RepresentatieFormulier from "./RepresentatieFormulier";

/**
 * Berekent weergaveveld-tekst voor een child group uit de full entity.
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
  const [nieuwGE, setNieuwGE] = useState(null); // { doeltype } als er een nieuw record wordt toegevoegd

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

      {/* Entiteit ID en formele tijd — alleen weergave, geen formulier */}
      <div className="cg-form-card">
        <div className="cg-form-section">
          <div className="cg-form-section__title">
            {typeMeta.klassenaam || typeMeta.typenaam}
          </div>
          <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap", fontSize: "0.9375rem" }}>
            <span><strong>{typeMeta.idKolom || "id"}:</strong> {entity[typeMeta.idKolom || "id"]}</span>
            {entity.opvoer && <span style={{ color: "var(--cg-donkergrijs)" }}>opvoer: {String(entity.opvoer).slice(0, 19).replace("T", " ")}</span>}
            {entity.afvoer && <span style={{ color: "var(--cg-fout)" }}>afvoer: {String(entity.afvoer).slice(0, 19).replace("T", " ")}</span>}
          </div>

          {/* Samenvattend overzicht onderliggende GE's als anchor-links */}
          {onderliggende.length > 0 && (
            <div style={{ marginTop: "1rem", display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              {onderliggende.map((child) => {
                const childMeta = typeMetaByTypenaam?.[child.doeltype];
                if (!childMeta) return null;
                const rawItems = safeArray(entity[child.jsonRolnaam] || entity[child.rolnaam]);
                const count = rawItems.length;
                const flat = platSlaHubItems(rawItems, childMeta, typeMetaByTypenaam);
                const weergave = childWeergave(childMeta, rawItems, typeMetaByTypenaam);
                const samenvatting = weergave || (flat.length > 0 ? korteVeldSamenvatting(flat.find((i) => !i.afvoer) || flat[0], childMeta) : "");
                const label = childMeta.klassenaam || child.rolnaam || child.doeltype;
                return (
                  <a
                    key={child.doeltype}
                    href={`#ge-${child.doeltype}`}
                    style={{
                      display: "inline-block",
                      padding: "0.375rem 0.75rem",
                      borderRadius: "6px",
                      background: childMeta.kleur || "var(--cg-lichtgrijs)",
                      border: `1px solid ${childMeta.kleur ? "rgba(0,0,0,0.15)" : "var(--cg-grijs)"}`,
                      color: "var(--cg-donkerblauw)",
                      textDecoration: "none",
                      fontSize: "0.8125rem",
                      lineHeight: 1.4,
                    }}
                  >
                    <strong>{label}</strong>
                    {count > 0 ? ` (${count})` : ""}
                    {samenvatting && (
                      <span style={{ display: "block", fontSize: "0.75rem", color: "var(--cg-donkergrijs)" }}>
                        {samenvatting.length > 60 ? samenvatting.slice(0, 57) + "…" : samenvatting}
                      </span>
                    )}
                  </a>
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
        // Platslaan: hub→data zodat inhoudsvelden beschikbaar zijn
        const flatItems = platSlaHubItems(rawItems, childMeta, typeMetaByTypenaam);
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
          <div key={child.doeltype} id={`ge-${child.doeltype}`} className="cg-form-card" style={{ marginTop: "1rem" }}>
            <div className="cg-form-section__title">
              {label}
              <span style={{ fontWeight: 400, fontSize: "0.8125rem", color: "var(--cg-donkergrijs)", marginLeft: 8 }}>
                ({child.momentvoorkomen}) — {flatItems.length} record(s)
              </span>
            </div>

            {isEnkelvoudig && flatItems.length > 0 ? (
              /* Enkelvoudig: formulier met de platgeslagen data */
              <RepresentatieFormulier
                typeMeta={childMeta}
                dataMeta={dataMeta}
                initialData={flatItems[0]}
                onSaved={fetchEntity}
                entiteitId={id}
                entiteitIdKolom={childMeta.entiteitIDKolom}
              />
            ) : !isEnkelvoudig && flatItems.length > 0 ? (
              /* Meervoudig: compact tabel van inhoudsvelden */
              <div style={{ overflowX: "auto" }}>
                <table className="utrecht-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr className="utrecht-table__header-row">
                      {inhoudsvelden.map((v) => (
                        <th key={v.naam} className="utrecht-table__header-cell">{v.naam}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {flatItems.map((item, i) => (
                      <tr key={i} className="utrecht-table__row" style={{ background: i % 2 === 1 ? "var(--cg-lichtgrijs)" : undefined }}>
                        {inhoudsvelden.map((v) => (
                          <td key={v.naam} className="utrecht-table__cell" style={{ padding: "0.375rem 0.75rem" }}>
                            {item[v.naam] != null ? String(item[v.naam]) : "—"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            {/* Lege GE: mogelijkheid om nieuw record toe te voegen */}
            {flatItems.length === 0 && nieuwGE !== child.doeltype && (
              <div style={{ display: "flex", alignItems: "center", gap: "1rem", padding: "0.5rem 0" }}>
                <span style={{ color: "var(--cg-donkergrijs)", fontSize: "0.875rem" }}>Geen records.</span>
                <button
                  type="button"
                  className="utrecht-button utrecht-button--secondary-action"
                  style={{ fontSize: "0.8125rem", padding: "0.25rem 0.75rem" }}
                  onClick={() => setNieuwGE(child.doeltype)}
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
                  onSaved={() => { setNieuwGE(null); fetchEntity(); }}
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
            {!isEnkelvoudig && flatItems.length > 0 && nieuwGE !== child.doeltype && (
              <div style={{ paddingTop: "0.5rem" }}>
                <button
                  type="button"
                  className="utrecht-button utrecht-button--secondary-action"
                  style={{ fontSize: "0.8125rem", padding: "0.25rem 0.75rem" }}
                  onClick={() => setNieuwGE(child.doeltype)}
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
