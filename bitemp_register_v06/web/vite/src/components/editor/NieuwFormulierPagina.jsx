import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router";
import { useSchema } from "../../context/SchemaContext";
import { safeArray } from "../../shared/schemaUtils";
import { coercedWaardeVoorVeld } from "../actions/ActionFormParts";
import CustomFormulierRenderer from "./CustomFormulierRenderer";
import { bouwCustomVeldMapping } from "./customFormMapping";
import { bouwNieuwWijzigingen, verzamelVasteWaarden } from "./nieuwFormulierMapping";
import { useFormulierDefinities } from "../../hooks/useFormulierDefinitie";

/**
 * NieuwFormulierPagina — een FormulierDefinitie in **nieuw-modus**: de layout wordt
 * zonder bestaande entiteit gerenderd en bij verzenden ontstaat één registratie die de
 * entiteit (id via max-id) én al haar GE's/relaties opvoert (plan 2026-09-22, stap A).
 *
 * Verschil met NieuwEntiteitPagina (de generieke "+ Nieuw"): de layout bepaalt welke
 * velden gevraagd worden, vaste waarden (bv. aanmeldstatus) gaan onzichtbaar mee en
 * lijsten met vaste rijen/meerkeuze vertalen naar losse opvoeren per item.
 *
 * Id's zijn plaatshouders (`$nieuw.<veldnaam>`, stap B): de server kent ze binnen de
 * transactie toe en geeft ze terug als `toegekendeIds`. Zo kan één registratie ook nieuwe
 * doel-ENT's (organisatie) aanmaken via `veld.nieuwFormulier`; de sub-FD's komen uit
 * `useFormulierDefinities("*")`.
 *
 * Props:
 *  - typeMeta:   meta van de doelentiteit
 *  - definitie:  { id, meta, layout } uit useFormulierDefinities
 *  - onSuccess:  optioneel ({ registratieId, entiteitId }) => void; anders navigatie naar detail
 */
export default function NieuwFormulierPagina({ typeMeta, definitie, onSuccess }) {
  const { baseUrl, typeMetaByTypenaam } = useSchema();
  const navigate = useNavigate();
  const layout = definitie?.layout || null;

  const [values, setValues] = useState({});
  const [bezig, setBezig] = useState(false);
  const [resultaat, setResultaat] = useState(null);
  const [volgendId, setVolgendId] = useState(null);

  // Nieuw formulier gekozen → schone lei.
  useEffect(() => { setValues({}); setResultaat(null); }, [definitie?.id]);

  // Onderliggende zonder materiële plumbing (zoals EntiteitFormulier).
  const onderliggende = useMemo(() => safeArray(typeMeta?.onderliggende).filter((child) => {
    const childMeta = typeMetaByTypenaam?.[child.doeltype];
    return childMeta && childMeta.ge_subtype !== "aanvang" && childMeta.ge_subtype !== "einde";
  }), [typeMeta, typeMetaByTypenaam]);

  // Velddefinities en GE-mapping uit de meta alleen (lege entiteit).
  const { customVelden, veldNaarGE } = useMemo(() => {
    if (!layout || !typeMeta) return { customVelden: [], veldNaarGE: {} };
    return bouwCustomVeldMapping({ entity: {}, typeMeta, onderliggende, typeMetaByTypenaam });
  }, [layout, typeMeta, onderliggende, typeMetaByTypenaam]);

  // Materiële aanvang van de entiteit (voor "<ENT>.aanvang.datum", bv. via kopieerNaar).
  const materieel = useMemo(() => {
    if (!typeMeta?.isMaterieel) return null;
    const kind = safeArray(typeMeta?.onderliggende).find((o) => typeMetaByTypenaam?.[o.doeltype]?.ge_subtype === "aanvang");
    const meta = kind ? typeMetaByTypenaam?.[kind.doeltype] : null;
    return meta ? { aanvangVeldnaam: meta.veldnaam, entiteitIDKolom: meta.entiteitIDKolom || null } : null;
  }, [typeMeta, typeMetaByTypenaam]);

  const vasteWaarden = useMemo(() => (layout ? verzamelVasteWaarden(layout) : {}), [layout]);
  const plaatshouder = `$nieuw.${String(typeMeta?.veldnaam || typeMeta?.typenaam || "entiteit").toLowerCase()}`;

  // Subformulieren voor nieuwe doel-ENT's (veld.nieuwFormulier): FD-id → layout + mapping.
  const { definities: alleDefinities } = useFormulierDefinities("*");
  const subFormulier = useCallback((doelEntiteit, fdId) => {
    const def = alleDefinities.find((d) => String(d.id) === String(fdId) && d.meta?.doeltype === doelEntiteit);
    const doelMeta = typeMetaByTypenaam?.[doelEntiteit];
    if (!def || !doelMeta) return null;
    const ond = safeArray(doelMeta.onderliggende).filter((c) => {
      const m = typeMetaByTypenaam?.[c.doeltype];
      return m && m.ge_subtype !== "aanvang" && m.ge_subtype !== "einde";
    });
    const { veldNaarGE: sub } = bouwCustomVeldMapping({ entity: {}, typeMeta: doelMeta, onderliggende: ond, typeMetaByTypenaam });
    const aanvangKind = safeArray(doelMeta.onderliggende).find((o) => typeMetaByTypenaam?.[o.doeltype]?.ge_subtype === "aanvang");
    const am = aanvangKind ? typeMetaByTypenaam?.[aanvangKind.doeltype] : null;
    return { layout: def.layout, veldNaarGE: sub, typeMeta: doelMeta, materieel: am ? { aanvangVeldnaam: am.veldnaam, entiteitIDKolom: am.entiteitIDKolom || null } : null };
  }, [alleDefinities, typeMetaByTypenaam]);

  // Indicatief volgend id (bij verzenden wordt max-id opnieuw opgehaald).
  useEffect(() => {
    if (!typeMeta?.typenaam || !baseUrl) return;
    fetch(`${baseUrl}/api/viz/entiteit/${encodeURIComponent(typeMeta.typenaam)}/max-id`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setVolgendId(j ? Number(j.nextId || 1) : null))
      .catch(() => setVolgendId(null));
  }, [baseUrl, typeMeta?.typenaam]);

  const bouw = useCallback((id) => bouwNieuwWijzigingen({
    layout, values, veldNaarGE, typeMeta, id, coerce: coercedWaardeVoorVeld, materieel, subFormulier,
  }), [layout, values, veldNaarGE, typeMeta, materieel, subFormulier]);

  const preview = useMemo(() => {
    if (!layout) return null;
    try { return bouw(plaatshouder); } catch (err) { return { fout: String(err?.message || err) }; }
  }, [layout, bouw, plaatshouder]);

  const voerUit = useCallback(async () => {
    setBezig(true);
    setResultaat(null);
    try {
      const { wijzigingen, ontbrekend } = bouw(plaatshouder);
      if (ontbrekend.length > 0) throw new Error(`Verplicht: ${ontbrekend.join(", ")}`);
      if (wijzigingen.length < 2) throw new Error("Het formulier is leeg.");

      const registratie = {
        registratietype: "registratie",
        opmerking: `Nieuwe ${typeMeta.klassenaam || typeMeta.typenaam} via formulier "${definitie?.meta?.naam || definitie?.id}"`,
      };
      const res = await fetch(`${baseUrl}/registratie/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registratie, wijzigingen }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}: ${res.statusText}`);
      const registratieId = Number(json?.registratie_id ?? json?.registratieId ?? 0);
      const id = Number(json?.toegekendeIds?.[plaatshouder] || 0);
      if (!id) throw new Error(`Registratie ${registratieId || "-"} is verwerkt, maar de server gaf geen toegekend id terug (backend van vóór stap B?).`);
      setResultaat({ ok: true, bericht: `Opvoer geslaagd (${typeMeta.klassenaam || typeMeta.typenaam} ${id}, registratie ${registratieId || "-"})` });
      if (onSuccess) onSuccess({ registratieId, entiteitId: id });
      else {
        const padnaam = typeMeta?.padnaam || typeMeta?.meervoud;
        if (padnaam) navigate(`/t/${padnaam}/${id}`);
      }
    } catch (err) {
      setResultaat({ ok: false, bericht: String(err?.message || err) });
    } finally {
      setBezig(false);
    }
  }, [baseUrl, typeMeta, bouw, plaatshouder, definitie, onSuccess, navigate]);

  if (!layout) return <div className="cg-feedback--fout">Formulierdefinitie zonder layout.</div>;

  const aantalOpvoeren = preview?.wijzigingen?.length || 0;
  const ontbrekend = preview?.ontbrekend || [];

  return (
    <div className="cg-form-card">
      <div className="cg-form-section__title" style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "0.5rem", flexWrap: "wrap" }}>
        <span>{definitie?.meta?.naam || "Formulier"}</span>
        <span style={{ fontWeight: 400, fontSize: "0.8125rem", color: "var(--cg-donkergrijs, #666)" }}>
          volgend id: {volgendId ?? "…"} (definitief bij verzenden)
          {Object.keys(vasteWaarden).length > 0 && ` · vast: ${Object.entries(vasteWaarden).map(([k, v]) => `${k.split(".").slice(-2).join(".")}=${v}`).join(", ")}`}
        </span>
      </div>
      {definitie?.meta?.beschrijving && (
        <p style={{ margin: "0 0 0.75rem", color: "var(--cg-donkergrijs, #666)" }}>{definitie.meta.beschrijving}</p>
      )}

      <CustomFormulierRenderer
        layout={layout}
        velden={customVelden}
        values={values}
        onChange={(veldnaam, waarde) => setValues((prev) => ({ ...prev, [veldnaam]: waarde }))}
        readOnly={bezig}
        typeMeta={typeMeta}
      />

      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap", marginTop: "0.5rem" }}>
        <button
          type="button"
          className="utrecht-button utrecht-button--primary-action"
          disabled={bezig || ontbrekend.length > 0 || aantalOpvoeren < 2}
          onClick={voerUit}
        >
          {bezig ? "Verzenden…" : "Verzenden"}
        </button>
        <button type="button" className="utrecht-button utrecht-button--secondary-action" disabled={bezig} onClick={() => { setValues({}); setResultaat(null); }}>
          Leegmaken
        </button>
        <span style={{ fontSize: "0.8125rem", color: "var(--cg-donkergrijs, #666)" }}>
          {aantalOpvoeren > 0 ? `${aantalOpvoeren} opvoer${aantalOpvoeren === 1 ? "" : "en"} in één registratie` : ""}
        </span>
        {resultaat && (
          <span className={resultaat.ok ? "cg-feedback--succes" : "cg-feedback--fout"} style={{ fontSize: "0.8125rem", padding: "0.125rem 0.5rem", borderRadius: 4 }}>
            {resultaat.bericht}
          </span>
        )}
      </div>
      {ontbrekend.length > 0 && (
        <div className="utrecht-form-field-error-message" role="alert" style={{ marginTop: "0.5rem" }}>
          Nog verplicht: {ontbrekend.map((p) => p.split(".").slice(-2).join(".")).join(", ")}
        </div>
      )}
      {preview?.fout && <div className="cg-feedback--fout" style={{ marginTop: "0.5rem" }}>{preview.fout}</div>}

      <details style={{ marginTop: "0.75rem" }}>
        <summary style={{ cursor: "pointer", fontSize: "0.8125rem", color: "var(--cg-donkergrijs, #666)" }}>Registratie-preview</summary>
        <pre style={{ fontSize: "0.75rem", overflow: "auto", maxHeight: "24rem" }}>{JSON.stringify(preview?.wijzigingen || preview, null, 2)}</pre>
      </details>
    </div>
  );
}
