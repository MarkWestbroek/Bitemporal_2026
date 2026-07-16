/**
 * FormulierIndex — lijst met filter van bestaande FormulierDefinities,
 * gegroepeerd per hoofdentiteit (doeltype). Klik = laad de definitie in de editor.
 *
 * Dit is de "formulierboom" (F43/F44): een aparte laag naast het model. We tonen
 * de *definities* (niet de ingevulde formulieren) en identificeren per entiteitnaam.
 */
import React, { useEffect, useMemo, useState } from "react";
import { useSchema } from "../context/SchemaContext";
import { safeArray } from "../shared/schemaUtils";
import { parseLayout } from "./layoutModel";
import { bouwVeldInfoUitLayout } from "./schemaResolve";
import { useFormulierEditorStore } from "./useFormulierEditorStore";

/** Actueel (niet-afgevoerd) data-record uit een genest GE in de full-response. */
function actueleData(fullEntity, geJsonNaam) {
  for (const hub of safeArray(fullEntity?.[geJsonNaam])) {
    const items = safeArray(hub?.data);
    const actueel = items.find((d) => d?.opvoer && !d?.afvoer);
    if (actueel) return actueel;
    if (items.length > 0) return items[items.length - 1];
  }
  return null;
}

export default function FormulierIndex() {
  const { baseUrl, typeMetaByTypenaam } = useSchema();
  const laadDefinitie = useFormulierEditorStore((s) => s.laadDefinitie);
  const reset = useFormulierEditorStore((s) => s.reset);
  const geladenId = useFormulierEditorStore((s) => s.geladenId);
  const opslagTeller = useFormulierEditorStore((s) => s.opslagTeller);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("");
  const [herlaad, setHerlaad] = useState(0);
  const [dichtGroepen, setDichtGroepen] = useState({}); // { doeltype: true } = ingeklapt
  const [versiesOpen, setVersiesOpen] = useState({}); // { defId: true } = versielijst uitgeklapt

  useEffect(() => {
    // baseUrl mag "" zijn (same-origin relatief) — dus niet op falsy guarden.
    if (baseUrl == null) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`${baseUrl}/full/formulier_definities`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((lijst) => {
        if (cancelled) return;
        const rows = safeArray(lijst?.["formulier definities"])
          .filter((full) => full && !full.afvoer) // afgevoerde definities uitsluiten
          .map((full) => {
          const meta = actueleData(full, "formulier_definitie_metas") || {};
          const layout = actueleData(full, "formulier_definitie_layouts") || {};
          return {
            id: full.id,
            naam: meta.naam || `#${full.id}`,
            doeltype: meta.doeltype || "(onbekend)",
            status: meta.status || "",
            isStandaard: meta.is_standaard === true || meta.is_standaard === "true",
            beschrijving: meta.beschrijving || "",
            versie: layout.definitie_versie || "",
            layoutJson: layout.layout_json || "",
            metaRelId: meta.rel_id ?? null,
            layoutRelId: layout.rel_id ?? null,
            // F45-light: alle layout-versies (bitemporele historie uit de full-respons).
            versies: safeArray(full.formulier_definitie_layouts)
              .flatMap((hub) => safeArray(hub?.data))
              .map((d) => ({
                versie: d.versie,
                definitieVersie: d.definitie_versie || "",
                opvoer: d.opvoer || "",
                afvoer: d.afvoer || "",
              }))
              .sort((a, b) => (a.versie ?? 0) - (b.versie ?? 0)),
          };
        });
        setItems(rows);
        setLoading(false);
      })
      .catch((e) => { if (!cancelled) { setError(e.message); setLoading(false); } });
    return () => { cancelled = true; };
  }, [baseUrl, herlaad, opslagTeller]);

  const groepen = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const gefilterd = items.filter(
      (it) => !q || it.naam.toLowerCase().includes(q) || it.doeltype.toLowerCase().includes(q)
    );
    const map = new Map();
    for (const it of gefilterd) {
      if (!map.has(it.doeltype)) map.set(it.doeltype, []);
      map.get(it.doeltype).push(it);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], "nl"));
  }, [items, filter]);

  function laad(it) {
    const { root, fout } = parseLayout(it.layoutJson);
    if (fout) { window.alert(`Ongeldige layout: ${fout}`); return; }
    const veldInfo = bouwVeldInfoUitLayout(root, typeMetaByTypenaam);
    laadDefinitie({
      layoutJson: it.layoutJson,
      meta: { naam: it.naam, doeltype: it.doeltype, beschrijving: it.beschrijving, definitieVersie: it.versie, status: it.status, isStandaard: it.isStandaard },
      veldInfo,
      id: it.id,
      metaRelId: it.metaRelId,
      layoutRelId: it.layoutRelId,
    });
  }

  async function verwijder(it, e) {
    e.stopPropagation();
    if (!window.confirm(`FormulierDefinitie "${it.naam}" (#${it.id}) verwijderen (afvoeren)?`)) return;
    try {
      const res = await fetch(`${baseUrl}/registratie/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registratie: { registratietype: "registratie" }, wijzigingen: [{ afvoer: { formulierdefinitie: { id: it.id } } }] }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (geladenId === it.id) reset();
      setHerlaad((n) => n + 1);
    } catch (err) {
      window.alert(`Verwijderen mislukt: ${err.message}`);
    }
  }

  const knopStijl = { border: "1px solid var(--s-border, #cbd5e1)", background: "var(--s-bg, #fff)", color: "var(--s-fg, #1e293b)", borderRadius: 5, padding: "3px 7px", cursor: "pointer", fontSize: 12 };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <div style={{ padding: "8px 10px 4px", display: "flex", gap: 6 }}>
        <button type="button" onClick={() => reset()} title="Nieuw leeg formulier"
          style={{ ...knopStijl, flex: 1, fontWeight: 600, background: "var(--s-accent, #6366f1)", color: "#fff", borderColor: "transparent" }}>
          ＋ Nieuw formulier
        </button>
      </div>
      <div style={{ padding: "0 10px 8px", display: "flex", gap: 6, alignItems: "center" }}>
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter op naam of entiteit…"
          style={{ flex: 1, minWidth: 0, padding: "4px 6px", fontSize: 12, border: "1px solid var(--s-border, #cbd5e1)", borderRadius: 5, background: "var(--s-bg, #fff)", color: "inherit" }}
        />
        <button type="button" title="Herladen" onClick={() => setHerlaad((n) => n + 1)} style={knopStijl}>↻</button>
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: "0 6px 8px" }}>
        {loading && <div style={{ padding: 10, fontSize: 12, color: "var(--s-fg-muted, #94a3b8)" }}>Laden…</div>}
        {error && <div style={{ padding: 10, fontSize: 12, color: "#dc2626" }}>Fout: {error}</div>}
        {!loading && !error && groepen.length === 0 && (
          <div style={{ padding: 10, fontSize: 12, color: "var(--s-fg-muted, #94a3b8)" }}>Geen definities.</div>
        )}
        {groepen.map(([doeltype, defs]) => (
          <div key={doeltype} style={{ marginBottom: 8 }}>
            <button
              type="button"
              onClick={() => setDichtGroepen((p) => ({ ...p, [doeltype]: !p[doeltype] }))}
              style={{ display: "block", width: "100%", textAlign: "left", border: "none", background: "transparent", cursor: "pointer", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4, color: "var(--s-fg-muted, #64748b)", padding: "4px 6px" }}
            >
              {dichtGroepen[doeltype] ? "▸" : "▾"} {doeltype} <span style={{ fontWeight: 400 }}>({defs.length})</span>
            </button>
            {!dichtGroepen[doeltype] && defs.map((it) => {
              const actief = geladenId === it.id;
              return (
                <div
                  key={it.id}
                  className="fi-rij"
                  style={{
                    display: "flex", alignItems: "center", marginBottom: 2, borderRadius: 5,
                    border: "1px solid " + (actief ? "var(--s-accent, #6366f1)" : "transparent"),
                    background: actief ? "var(--s-accent-bg, #e0e7ff)" : "transparent",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => laad(it)}
                    title={it.beschrijving || it.naam}
                    style={{ flex: 1, minWidth: 0, textAlign: "left", cursor: "pointer", padding: "5px 8px", border: "none", background: "transparent", color: "inherit", fontSize: 12.5 }}
                  >
                    <span style={{ fontWeight: 500 }}>{it.naam}</span>
                    <span style={{ float: "right", fontSize: 10.5, color: "var(--s-fg-muted, #94a3b8)" }}>
                      {it.versie && `v${it.versie}`}{it.status ? ` · ${it.status}` : ""}{it.isStandaard ? " · ★" : ""}
                    </span>
                  </button>
                  {it.versies.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setVersiesOpen((p) => ({ ...p, [it.id]: !p[it.id] })); }}
                      title={`${it.versies.length} layout-versies`}
                      style={{ flex: "0 0 auto", border: "none", background: "transparent", color: "var(--s-fg-muted, #94a3b8)", cursor: "pointer", fontSize: 10.5, padding: "4px 2px" }}
                    >{versiesOpen[it.id] ? "⌄" : "▸"}{it.versies.length}</button>
                  )}
                  <button
                    type="button"
                    onClick={(e) => verwijder(it, e)}
                    title="Verwijderen (afvoeren)"
                    style={{ flex: "0 0 auto", border: "none", background: "transparent", color: "var(--s-fg-muted, #94a3b8)", cursor: "pointer", fontSize: 12, padding: "4px 7px" }}
                  >✕</button>
                </div>
              );
            })}
            {/* F45-light: uitgeklapte versielijst (bitemporele layout-historie) */}
            {!dichtGroepen[doeltype] && defs.map((it) =>
              versiesOpen[it.id] ? (
                <div key={`v${it.id}`} style={{ margin: "0 6px 6px 18px", borderLeft: "2px solid var(--s-border, #e2e8f0)", paddingLeft: 8 }}>
                  {it.versies.map((v, i) => {
                    const actueel = v.opvoer && !v.afvoer;
                    return (
                      <div key={i} style={{ fontSize: 11, padding: "2px 0", color: actueel ? "inherit" : "var(--s-fg-muted, #94a3b8)" }}>
                        v{v.definitieVersie || "?"} <span style={{ opacity: 0.7 }}>({v.versie ?? i + 1})</span>
                        {actueel ? " · actueel" : v.afvoer ? " · vervangen" : ""}
                      </div>
                    );
                  })}
                </div>
              ) : null
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
