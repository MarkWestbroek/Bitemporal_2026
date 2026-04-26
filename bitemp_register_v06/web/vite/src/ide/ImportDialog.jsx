/**
 * ImportDialog — Modal dialoog voor het importeren van een model.
 *
 * Bronnen:
 * - 📂 Uit bestand:
 *     - V3 JSON (.json)
 *     - IDE-v1 JSON (.json)
 *     - Mermaid (.mmd / .md / .txt)
 *     - PlantUML (.puml / .plantuml / .txt)
 *     - XMI (.xmi / .xml)
 * - 🌐 Vanuit API (code/MetaRegistry, nieuwste DB versie, specifieke versie)
 *
 * Voor textuele UML-formaten wordt eerst de bijbehorende parser gedraaid;
 * losliggende GE/relatie-nodes (orphans) worden via een aparte
 * {@link OrphanDialog} aan de gebruiker voorgelegd voordat de afbeelding wordt
 * omgezet naar V3 JSON en doorgegeven aan de IDE.
 *
 * Features:
 * - Domeinfilter — importeer alle domeinen of één specifiek domein
 * - Import-modus: "vervang alles" of "merge domein" (alleen bij domeinfilter)
 * - Auto-diagram: bij V3/code import wordt automatisch een diagram aangemaakt
 *   met de posities uit het V3-model
 */
import { useState, useEffect, useCallback } from "react";
import { importVanMermaid } from "../umleditor/import/importMermaid";
import { importVanPlantUML } from "../umleditor/import/importPlantUML";
import { importVanXMI } from "../umleditor/import/importXMI";
import { detecteerOrphans, pasOrphanActiesToe } from "../umleditor/import/rawuml";
import { editorNaarV3Model } from "../umleditor/metamodel/types";
import OrphanDialog from "../umleditor/components/OrphanDialog";

// ── Herbruikbare stijlen (identiek aan ExportDialog) ──────
const S = {
  backdrop: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
    display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000,
  },
  dialog: {
    background: "var(--ide-menu-bg, #2d2d2d)", border: "1px solid var(--ide-menu-border, #555)", borderRadius: 8,
    boxShadow: "0 8px 32px rgba(0,0,0,0.6)", minWidth: 460, maxWidth: 620,
    color: "var(--ide-panel-color, #ccc)", fontSize: 13,
  },
  header: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "10px 16px", borderBottom: "1px solid var(--ide-menu-sep, #444)",
  },
  title: { margin: 0, fontSize: 15, color: "var(--ide-panel-color-heading, #ddd)" },
  closeBtn: {
    background: "none", border: "none", color: "var(--ide-panel-color-muted, #888)", fontSize: 18,
    cursor: "pointer", padding: "0 4px", lineHeight: 1,
  },
  body: { padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10 },
  field: { display: "flex", flexDirection: "column", gap: 3 },
  label: { fontSize: 11, color: "var(--ide-panel-color-muted, #999)" },
  input: {
    background: "var(--ide-input-bg, #1e1e1e)", color: "var(--ide-input-color, #ccc)", border: "1px solid var(--ide-input-border, #3a3a3a)",
    borderRadius: 3, padding: "5px 8px", fontSize: 12, outline: "none",
    width: "100%", boxSizing: "border-box",
  },
  select: {
    background: "var(--ide-input-bg, #1e1e1e)", color: "var(--ide-input-color, #ccc)", border: "1px solid var(--ide-input-border, #3a3a3a)",
    borderRadius: 3, padding: "5px 8px", fontSize: 12, outline: "none",
    width: "100%", boxSizing: "border-box",
  },
  radioGroup: { display: "flex", gap: 16, padding: "2px 0" },
  radioLabel: { display: "flex", alignItems: "center", gap: 5, cursor: "pointer", fontSize: 12 },
  note: {
    background: "#1a2633", border: "1px solid #2a4a6a", borderRadius: 4,
    padding: "6px 10px", fontSize: 11, color: "#8cb4ff", lineHeight: 1.4,
  },
  actions: {
    display: "flex", justifyContent: "flex-end", gap: 8,
    padding: "8px 16px", borderTop: "1px solid var(--ide-menu-sep, #444)",
  },
  btnCancel: {
    background: "var(--ide-btn-bg, #3c3c3c)", color: "var(--ide-btn-color, #ccc)", border: "1px solid var(--ide-btn-border, #555)",
    borderRadius: 3, padding: "5px 14px", cursor: "pointer", fontSize: 12,
  },
  btnSubmit: {
    background: "#1a4a2e", color: "#8dff8d", border: "1px solid #3a7a4a",
    borderRadius: 3, padding: "5px 14px", cursor: "pointer", fontSize: 12, fontWeight: 600,
  },
  versieRij: {
    display: "flex", gap: 8, padding: "4px 6px", borderRadius: 3, fontSize: 11, cursor: "pointer",
    alignItems: "center",
  },
  versieRijSelected: {
    background: "#264f78",
  },
  fileInfo: {
    fontFamily: "monospace", fontSize: 11, color: "#8dff8d", padding: "4px 8px",
    background: "#1a2a1a", borderRadius: 3, border: "1px solid #3a5a3a",
  },
};

// API-bron types
const BRON_BESTAND = "bestand";
const BRON_API = "api";
const API_CODE = "code";
const API_DB_NIEUWSTE = "db_nieuwste";
const API_DB_VERSIE = "db_versie";

// Textuele UML-formaten en hun parsers/extensies.
const UML_FORMATEN = {
  mermaid: { label: "Mermaid", extensies: [".mmd"], parser: importVanMermaid },
  plantuml: { label: "PlantUML", extensies: [".puml", ".plantuml"], parser: importVanPlantUML },
  xmi: { label: "XMI", extensies: [".xmi"], parser: importVanXMI },
};

// .md, .txt, .xml zijn ambigu: eerst extensie matchen, daarna fallback op
// inhoud ("classDiagram" → mermaid, "@startuml" → plantuml, "<XMI" → xmi).
function detecteerUmlFormaatVanBestand(file, text) {
  const naam = (file?.name || "").toLowerCase();
  for (const [key, def] of Object.entries(UML_FORMATEN)) {
    if (def.extensies.some((ext) => naam.endsWith(ext))) return key;
  }
  if (naam.endsWith(".json")) return null; // JSON-pad
  const head = (text || "").slice(0, 4096);
  if (/classDiagram/i.test(head)) return "mermaid";
  if (/@startuml/i.test(head)) return "plantuml";
  if (/<\s*XMI\b/i.test(head) || /<\?xml/i.test(head)) return "xmi";
  if (naam.endsWith(".md") || naam.endsWith(".txt") || naam.endsWith(".xml")) {
    return null; // onbekend; gebruiker zal de fout zien
  }
  return null;
}

function apiBase() {
  return window.location.port === "5174" ? "http://localhost:8082" : "";
}

/**
 * @param {Object} props
 * @param {boolean}  props.open
 * @param {string[]} props.domains          — beschikbare domeinnamen
 * @param {Object}   props.domainMeta       — Record<naam, {versie?, ...}>
 * @param {string}   [props.prefillDomein]  — domein pre-selectie (bij rechtsklik)
 * @param {Function} props.onImport         — (data, meta) => void
 * @param {Function} props.onClose
 */
export default function ImportDialog({ open, domains, domainMeta, prefillDomein, onImport, onClose }) {
  // ── State ──
  const [bron, setBron] = useState(BRON_BESTAND);
  const [apiBron, setApiBron] = useState(API_CODE);
  const [domeinFilter, setDomeinFilter] = useState("");
  const [modus, setModus] = useState("vervang");     // "vervang" | "merge"
  const [bestand, setBestand] = useState(null);       // File object
  const [bestandInfo, setBestandInfo] = useState(null); // { format, elementen, versie }
  const [parsedJson, setParsedJson] = useState(null);
  const [versies, setVersies] = useState([]);
  const [geselecteerdeVersie, setGeselecteerdeVersie] = useState(null);
  const [laden, setLaden] = useState(false);
  const [fout, setFout] = useState(null);

  // Wanneer een textuele UML-import orphans bevat, parkeren we de tussenstand
  // hier en tonen we OrphanDialog. Na bevestiging worden de acties toegepast,
  // de graaf naar V3 omgezet, en parsedJson gevuld zodat handleSubmit z'n
  // gewone V3-pad kan volgen.
  const [orphanDialoog, setOrphanDialoog] = useState(null);
  // null | { orphans, graaf, formaat, bestandsnaam }

  // Pre-fill domein bij rechtsklik
  useEffect(() => {
    if (open && prefillDomein !== undefined) {
      setDomeinFilter(prefillDomein || "");
    }
  }, [open, prefillDomein]);

  // Reset bij openen
  useEffect(() => {
    if (open) {
      setBron(BRON_BESTAND);
      setApiBron(API_CODE);
      setBestand(null);
      setBestandInfo(null);
      setParsedJson(null);
      setGeselecteerdeVersie(null);
      setFout(null);
      setModus("vervang");
      setOrphanDialoog(null);
      // domeinFilter wordt NIET gereset — kan pre-filled zijn
    }
  }, [open]);

  // Laad versies uit de API wanneer API-bron = specifieke versie
  useEffect(() => {
    if (!open || bron !== BRON_API || apiBron !== API_DB_VERSIE) return;
    let cancelled = false;
    setLaden(true);
    fetch(`${apiBase()}/api/schema/versies`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setVersies(Array.isArray(data) ? data : []);
      })
      .catch((err) => { if (!cancelled) setFout(`Versies ophalen mislukt: ${err.message}`); })
      .finally(() => { if (!cancelled) setLaden(false); });
    return () => { cancelled = true; };
  }, [open, bron, apiBron]);

  // ---- Hulp: editor-graaf → V3 + parsedJson invullen ----
  // Wordt gebruikt na een textuele UML-import (eventueel na orphan-acties).
  const zetEditorGraafAlsParsedJson = useCallback((graaf, formaat, bestandsnaam) => {
    const v3 = editorNaarV3Model(graaf.nodes, graaf.edges, {});
    // Wikkel in dezelfde envelope als V3-bestanden zodat handleSubmit hem als
    // V3 herkent (json.model.versie === "v3").
    const wrapped = { model: v3 };
    setParsedJson(wrapped);
    setBestandInfo({
      format: "V3",
      elementen: (v3.entiteiten || []).length,
      versie: `${UML_FORMATEN[formaat]?.label || formaat} → ${bestandsnaam}`,
    });
  }, []);

  // ---- Bestand selecteren & parsen ----
  const handleBestandKeuze = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBestand(file);
    setFout(null);
    setParsedJson(null);
    setBestandInfo(null);
    try {
      const text = await file.text();
      const umlFormaat = detecteerUmlFormaatVanBestand(file, text);

      if (umlFormaat) {
        // Textueel UML-formaat: parser draaien, orphans checken.
        const parser = UML_FORMATEN[umlFormaat].parser;
        let graaf;
        try {
          graaf = parser(text);
        } catch (err) {
          throw new Error(`${UML_FORMATEN[umlFormaat].label} parsen mislukt: ${err.message}`);
        }
        const orphans = detecteerOrphans(graaf);
        if (orphans.length > 0) {
          setOrphanDialoog({ orphans, graaf, formaat: umlFormaat, bestandsnaam: file.name });
          setBestandInfo({ format: UML_FORMATEN[umlFormaat].label, elementen: 0, versie: `${orphans.length} orphans — actie vereist` });
          return;
        }
        zetEditorGraafAlsParsedJson(graaf, umlFormaat, file.name);
        return;
      }

      // Anders: JSON pad (V3 of IDE-v1)
      const json = JSON.parse(text);
      setParsedJson(json);

      if (json._format === "ide-v1") {
        const elCount = Object.keys(json.elements || {}).length;
        setBestandInfo({ format: "IDE-v1", elementen: elCount, versie: json.modelMeta?.versie || "" });
      } else if (json.model?.versie === "v3" || json.versie === "v3") {
        const model = json.model || json;
        const entCount = (model.entiteiten || []).length;
        setBestandInfo({ format: "V3", elementen: entCount, versie: model.modelVersie || model.versie || "" });
      } else {
        setBestandInfo({ format: "Onbekend", elementen: 0, versie: "" });
        setFout("Onbekend bestandsformat. Verwacht IDE-v1, V3 JSON, Mermaid, PlantUML of XMI.");
      }
    } catch (err) {
      setFout(`Bestand lezen mislukt: ${err.message}`);
      setBestandInfo(null);
      setParsedJson(null);
    }
  }, [zetEditorGraafAlsParsedJson]);

  // ---- Orphan-dialoog acties ----
  const bevestigOrphanDialoog = useCallback((keuzes) => {
    if (!orphanDialoog) return;
    try {
      const { nodes, edges } = pasOrphanActiesToe(
        orphanDialoog.graaf,
        orphanDialoog.orphans,
        keuzes
      );
      zetEditorGraafAlsParsedJson(
        { nodes, edges },
        orphanDialoog.formaat,
        orphanDialoog.bestandsnaam
      );
      setOrphanDialoog(null);
    } catch (err) {
      setOrphanDialoog(null);
      if (err && err.code === "ORPHAN_ABORT") {
        setFout(err.message);
      } else {
        setFout(`Orphan-acties toepassen mislukt: ${err.message}`);
      }
      setBestandInfo(null);
      setParsedJson(null);
    }
  }, [orphanDialoog, zetEditorGraafAlsParsedJson]);

  const annuleerOrphanDialoog = useCallback(() => {
    setOrphanDialoog(null);
    setBestandInfo(null);
    setParsedJson(null);
  }, []);

  // ── Import uitvoeren ──
  const handleSubmit = useCallback(async () => {
    setFout(null);
    setLaden(true);
    try {
      let json = null;
      let versieLabel = "";
      let bronLabel = "";

      if (bron === BRON_BESTAND) {
        // --- Bestand ---
        if (!parsedJson) throw new Error("Geen bestand geselecteerd of geladen.");
        json = parsedJson;
        versieLabel = bestandInfo?.versie || bestand?.name || "";
        bronLabel = bestandInfo?.format === "V3"
          ? `V3 import ${versieLabel}`
          : bestandInfo?.format === "IDE-v1"
            ? `IDE import ${new Date().toISOString().slice(0, 10)}`
            : `Import ${versieLabel}`;
      } else {
        // --- API ---
        let url;
        if (apiBron === API_CODE) {
          url = `${apiBase()}/api/schema/model/code`;
          if (domeinFilter) url += `?domein=${encodeURIComponent(domeinFilter)}&strict=true`;
          bronLabel = "Code import";
        } else if (apiBron === API_DB_NIEUWSTE) {
          url = `${apiBase()}/api/schema/model`;
          bronLabel = "DB import (nieuwste)";
        } else if (apiBron === API_DB_VERSIE) {
          if (!geselecteerdeVersie?.id) throw new Error("Selecteer een versie.");
          url = `${apiBase()}/api/schema/model/${geselecteerdeVersie.id}`;
          versieLabel = geselecteerdeVersie.naam || `#${geselecteerdeVersie.id}`;
          bronLabel = `DB import #${geselecteerdeVersie.id}`;
        }
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
        json = await resp.json();
        if (apiBron === API_CODE) {
          versieLabel = json?.model?.modelVersie || json?.modelVersie || "code";
          bronLabel = `Code import ${versieLabel}`;
        }
      }

      const format = json?._format === "ide-v1" ? "ide"
        : (json?.model?.versie === "v3" || json?.versie === "v3") ? "v3"
        : "onbekend";

      if (format === "onbekend") throw new Error("Onbekend JSON-format. Verwacht IDE-v1 of V3.");

      onImport(json, {
        format,
        domein: domeinFilter || null,
        modus: domeinFilter ? modus : "vervang",
        versieLabel,
        bronLabel,
      });
    } catch (err) {
      setFout(err.message);
    } finally {
      setLaden(false);
    }
  }, [bron, apiBron, parsedJson, bestandInfo, bestand, domeinFilter, modus, geselecteerdeVersie, onImport]);

  if (!open) return null;

  const kanImporteren = bron === BRON_BESTAND
    ? !!parsedJson && !fout
    : apiBron === API_DB_VERSIE
      ? !!geselecteerdeVersie
      : true;

  return (
    <div style={S.backdrop} onClick={onClose}>
      <div style={S.dialog} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={S.header}>
          <h3 style={S.title}>📂 Importeer model</h3>
          <button style={S.closeBtn} onClick={onClose}>&times;</button>
        </div>

        {/* Body */}
        <div style={S.body}>
          {/* Bron keuze */}
          <div style={S.field}>
            <span style={S.label}>Bron</span>
            <div style={S.radioGroup}>
              <label style={S.radioLabel}>
                <input type="radio" name="importBron" checked={bron === BRON_BESTAND} onChange={() => setBron(BRON_BESTAND)} />
                📂 Uit bestand
              </label>
              <label style={S.radioLabel}>
                <input type="radio" name="importBron" checked={bron === BRON_API} onChange={() => setBron(BRON_API)} />
                🌐 Vanuit API
              </label>
            </div>
          </div>

          {/* --- Bestand-bron --- */}
          {bron === BRON_BESTAND && (
            <div style={S.field}>
              <span style={S.label}>Bestand (JSON, Mermaid, PlantUML of XMI)</span>
              <input
                type="file"
                accept=".json,.mmd,.md,.puml,.plantuml,.xmi,.xml,.txt"
                onChange={handleBestandKeuze}
                style={{ fontSize: 12 }}
              />
              {bestandInfo && (
                <div style={S.fileInfo}>
                  Format: <strong>{bestandInfo.format}</strong>
                  {bestandInfo.elementen > 0 && <> — {bestandInfo.elementen} {bestandInfo.format === "V3" ? "entiteiten" : "elementen"}</>}
                  {bestandInfo.versie && <> — {bestandInfo.versie}</>}
                </div>
              )}
            </div>
          )}

          {/* --- API-bron --- */}
          {bron === BRON_API && (
            <div style={S.field}>
              <span style={S.label}>API-bron</span>
              <div style={{ ...S.radioGroup, flexDirection: "column", gap: 4 }}>
                <label style={S.radioLabel}>
                  <input type="radio" name="apiBron" checked={apiBron === API_CODE} onChange={() => setApiBron(API_CODE)} />
                  🏗 Uit code (MetaRegistry)
                </label>
                <label style={S.radioLabel}>
                  <input type="radio" name="apiBron" checked={apiBron === API_DB_NIEUWSTE} onChange={() => setApiBron(API_DB_NIEUWSTE)} />
                  🗃 Nieuwste DB versie
                </label>
                <label style={S.radioLabel}>
                  <input type="radio" name="apiBron" checked={apiBron === API_DB_VERSIE} onChange={() => setApiBron(API_DB_VERSIE)} />
                  📋 Specifieke versie
                </label>
              </div>

              {/* Versie-tabel bij specifieke versie */}
              {apiBron === API_DB_VERSIE && (
                <div style={{ maxHeight: 160, overflowY: "auto", marginTop: 4, border: "1px solid #3a3a3a", borderRadius: 3 }}>
                  {versies.length === 0 && !laden && <div style={{ padding: 8, fontSize: 11, color: "#888" }}>Geen versies gevonden.</div>}
                  {versies.map((v) => (
                    <div
                      key={v.id}
                      onClick={() => setGeselecteerdeVersie(v)}
                      style={{
                        ...S.versieRij,
                        ...(geselecteerdeVersie?.id === v.id ? S.versieRijSelected : {}),
                        borderBottom: "1px solid #2a2a2a",
                      }}
                    >
                      <span style={{ fontWeight: 600, minWidth: 30 }}>#{v.id}</span>
                      <span style={{ flex: 1 }}>{v.naam || v.model_versie || "—"}</span>
                      <span style={{ color: "#888", fontSize: 10 }}>{v.status || ""}</span>
                      <span style={{ color: "#666", fontSize: 10 }}>{v.indiener || ""}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Domeinfilter */}
          <div style={S.field}>
            <span style={S.label}>Domeinfilter</span>
            <select style={S.select} value={domeinFilter} onChange={(e) => setDomeinFilter(e.target.value)}>
              <option value="">— Alle domeinen —</option>
              {(domains || []).map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          {/* Import-modus (alleen bij domeinfilter) */}
          {domeinFilter && (
            <div style={S.field}>
              <span style={S.label}>Import-modus</span>
              <div style={S.radioGroup}>
                <label style={S.radioLabel}>
                  <input type="radio" name="importModus" checked={modus === "vervang"} onChange={() => setModus("vervang")} />
                  🔄 Vervang domein
                </label>
                <label style={S.radioLabel}>
                  <input type="radio" name="importModus" checked={modus === "merge"} onChange={() => setModus("merge")} />
                  ➕ Merge domein
                </label>
              </div>
            </div>
          )}

          {/* Info-note */}
          <div style={S.note}>
            {domeinFilter
              ? modus === "merge"
                ? `Elementen van domein "${domeinFilter}" worden samengevoegd met het bestaande model. Bestaande elementen met dezelfde ID worden overschreven.`
                : `Alle elementen van domein "${domeinFilter}" in de editor worden vervangen door de geïmporteerde versie. Overige domeinen blijven ongewijzigd.`
              : "Het volledige model wordt vervangen door de import. Er wordt automatisch een diagram aangemaakt met posities uit het geïmporteerde model."
            }
          </div>

          {/* Foutmelding */}
          {fout && (
            <div style={{ ...S.note, background: "#331a1a", border: "1px solid #6a2a2a", color: "#ff8d8d" }}>
              ❌ {fout}
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={S.actions}>
          <button style={S.btnCancel} onClick={onClose}>Annuleren</button>
          <button
            style={{ ...S.btnSubmit, opacity: kanImporteren && !laden ? 1 : 0.5 }}
            disabled={!kanImporteren || laden}
            onClick={handleSubmit}
          >
            {laden ? "Laden…" : "📂 Importeer"}
          </button>
        </div>
      </div>

      {orphanDialoog && (
        <OrphanDialog
          orphans={orphanDialoog.orphans}
          onBevestig={bevestigOrphanDialoog}
          onAnnuleer={annuleerOrphanDialoog}
        />
      )}
    </div>
  );
}
