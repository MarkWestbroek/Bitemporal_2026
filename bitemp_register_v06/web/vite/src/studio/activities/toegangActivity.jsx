/**
 * toegangActivity — Toegangverlening: Toegangsspraak-editor (v0).
 *
 * Klare-taal toegangsbeleid (Toegangsspraak, een gecontroleerde natuurlijke
 * taal) dat 1-op-1 afbeeldt op de NLGov-ODRL-subset. Ontwerp:
 * docs/plans/"2026-07-22 Klare-taal Toegangsbeleid — Toegangsspraak (ontwerp).md".
 *
 * Slot-indeling:
 *   Sidebar   → ModelPicker (canoniek model): klik of sleep een veld om de
 *               van-vorm ("de achternaam van … van een …") in te voegen
 *   Main      → Tabs: Tekst (editor met highlighting + fouten) + Canoniek
 *               (leesweergave: de geherformatteerde canonieke vorm)
 *   Inspector → ODRL JSON-LD (NLGov-profiel) van het geparste beleid
 *
 * Autocomplete uit de schema-API (zoals de CEL-editor) en typebewaking op
 * veldtypen zijn vervolgstappen; drag & drop uit de projectboom werkt al.
 */
import React, { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from "react";
import EditorModule from "react-simple-code-editor";
const Editor = EditorModule.default ?? EditorModule;
import Prism from "../../shared/prismSetup";
import { ModelPicker, FIELDREF_MIME } from "../../modelpicker";
import {
  parseBeleid, renderBeleid, naarOdrl, padNaarVerwijzing,
  renderVerwijzing, VOORBEELD_BELEID,
} from "../../toegangsspraak";
import { IconToegang } from "../icons";
import { menuBus } from "../menuBus";
import { apiBase, downloadJson } from "../studioUtils";

// ── Prism-grammar voor Toegangsspraak (eenmalig registreren) ─────────────────
function registreerToegangsspraakGrammar() {
  if (Prism.languages.toegangsspraak) return;
  Prism.languages.toegangsspraak = {
    string: { pattern: /"[^"]*"/, greedy: true },
    // Structuurwoorden van het document
    keyword: /\b(?:Beleid|Begrippen|Regel|Geldig|vanaf|tot|Grondslag|Doel)\b/,
    // De modaliteit — het hart van elke regel
    important: /\bmag\b|\bniet\b/,
    // Verbindingswoorden van de grammatica
    operator: /\b(?:als|waarbij|waarvan|van|is|zijn|iemand|met|en|of)\b/,
    number: /\b\d+(?:\.\d+)?\b/,
    punctuation: /[.:;(),-]/,
  };
}
registreerToegangsspraakGrammar();

/** FieldRef-veldpad → van-vorm, bv. "de achternaam van de naam van een natuurlijk persoon". */
function veldpadNaarVanVorm(veldpad) {
  return renderVerwijzing(padNaarVerwijzing(veldpad));
}

const Ctx = createContext(null);

function ToegangProvider({ children }) {
  const [tekst, setTekst] = useState(VOORBEELD_BELEID);
  const [activeTab, setActiveTab] = useState("tekst"); // "tekst" | "canoniek"
  const editorWrapRef = useRef(null);

  const resultaat = useMemo(() => parseBeleid(tekst), [tekst]);
  const odrl = useMemo(
    () => (resultaat.ok ? naarOdrl(resultaat.beleid) : null),
    [resultaat]
  );
  const canoniek = useMemo(
    () => (resultaat.beleid ? renderBeleid(resultaat.beleid) : null),
    [resultaat]
  );

  // Verse waarden voor menu-acties zonder de listeners te herbinden.
  const ref = useRef({});
  ref.current = { tekst, resultaat, odrl, canoniek };

  /** Voeg tekst in op de cursorpositie van de editor-textarea. */
  const invoegOpCursor = useCallback((invoeg) => {
    const ta = editorWrapRef.current?.querySelector("textarea");
    setTekst((huidig) => {
      if (!ta) return huidig + invoeg;
      const start = ta.selectionStart ?? huidig.length;
      const einde = ta.selectionEnd ?? start;
      const nieuw = huidig.slice(0, start) + invoeg + huidig.slice(einde);
      requestAnimationFrame(() => {
        ta.focus();
        ta.selectionStart = ta.selectionEnd = start + invoeg.length;
      });
      return nieuw;
    });
  }, []);

  useEffect(() => {
    const af = [
      menuBus.on("toegang:voorbeeld", () => setTekst(VOORBEELD_BELEID)),
      menuBus.on("toegang:herformatteer", () => {
        const { canoniek } = ref.current;
        if (canoniek) setTekst(canoniek);
      }),
      menuBus.on("toegang:odrl", () => {
        const { odrl, resultaat } = ref.current;
        if (odrl) {
          downloadJson(odrl, `${(resultaat.beleid?.naam || "beleid").replace(/\s+/g, "_")}.odrl.json`);
        }
      }),
    ];
    return () => af.forEach((off) => off());
  }, []);

  return (
    <Ctx.Provider value={{ tekst, setTekst, activeTab, setActiveTab, resultaat, odrl, canoniek, editorWrapRef, invoegOpCursor }}>
      {children}
    </Ctx.Provider>
  );
}

function ToegangSidebar() {
  const { invoegOpCursor } = useContext(Ctx);

  const onPick = useCallback(
    (fieldRef) => invoegOpCursor(veldpadNaarVanVorm(fieldRef.veldpad)),
    [invoegOpCursor]
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <p style={{ margin: 0, padding: "8px 10px", fontSize: 12, color: "var(--s-fg-muted)" }}>
        Klik op “kies” of sleep een veld naar de tekst; het wordt in de van-vorm
        ingevoegd (“de achternaam van … van een …”).
      </p>
      <div style={{ flex: 1, minHeight: 0 }}>
        <ModelPicker baseUrl={apiBase()} onPick={onPick} expandEntiteiten />
      </div>
    </div>
  );
}

function FoutenPaneel({ fouten }) {
  return (
    <div
      style={{
        borderTop: "1px solid var(--s-border, #e5e7eb)",
        padding: "8px 12px",
        fontSize: 12,
        maxHeight: 120,
        overflow: "auto",
        background: "var(--s-panel-head)",
        color: "var(--s-fg)",
      }}
    >
      {fouten.map((fout, i) => (
        <div key={i} style={{ marginBottom: 4 }}>
          <span style={{ color: "#ef4444", fontWeight: 600 }}>
            {fout.regel ? `Regel ${fout.regel}: ` : ""}
          </span>
          {fout.bericht}
        </div>
      ))}
    </div>
  );
}

function ToegangMain() {
  const { tekst, setTekst, activeTab, setActiveTab, resultaat, canoniek, editorWrapRef, invoegOpCursor } = useContext(Ctx);

  const highlight = useCallback(
    (code) => Prism.highlight(code, Prism.languages.toegangsspraak, "toegangsspraak"),
    []
  );

  const onDrop = useCallback(
    (e) => {
      const data = e.dataTransfer.getData(FIELDREF_MIME);
      const veldpad = data ? JSON.parse(data).veldpad : e.dataTransfer.getData("text/plain");
      if (!veldpad) return;
      e.preventDefault();
      invoegOpCursor(veldpadNaarVanVorm(veldpad));
    },
    [invoegOpCursor]
  );

  const statusregel = resultaat.ok
    ? `✓ ${resultaat.beleid.regels.length} regel(s), ${resultaat.beleid.begrippen.length} begrip(pen)`
    : `✗ ${resultaat.fouten.length} fout(en)`;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div className="studio-tabs">
        <button
          className={"studio-tab" + (activeTab === "tekst" ? " is-actief" : "")}
          onClick={() => setActiveTab("tekst")}
        >
          Tekst
        </button>
        <button
          className={"studio-tab" + (activeTab === "canoniek" ? " is-actief" : "")}
          onClick={() => setActiveTab("canoniek")}
        >
          Canonieke vorm
        </button>
        <span style={{ marginLeft: "auto", alignSelf: "center", padding: "0 12px", fontSize: 12, color: resultaat.ok ? "#10b981" : "#ef4444" }}>
          {statusregel}
        </span>
      </div>

      <div className="studio-paper" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        {activeTab === "tekst" ? (
          <>
            <div
              ref={editorWrapRef}
              style={{ flex: 1, minHeight: 0, overflow: "auto" }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDrop}
            >
              <Editor
                value={tekst}
                onValueChange={setTekst}
                highlight={highlight}
                padding={14}
                textareaClassName="toegangsspraak-textarea"
                style={{
                  fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace",
                  fontSize: 13,
                  lineHeight: 1.6,
                  minHeight: "100%",
                }}
              />
            </div>
            {!resultaat.ok && <FoutenPaneel fouten={resultaat.fouten} />}
          </>
        ) : (
          <div style={{ flex: 1, minHeight: 0, overflow: "auto", padding: 14 }}>
            {canoniek ? (
              <pre style={{ margin: 0, fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace", fontSize: 13, lineHeight: 1.6 }}>
                {canoniek}
              </pre>
            ) : (
              <p style={{ fontSize: 13 }}>
                De tekst bevat nog fouten; los die eerst op om de canonieke vorm te zien.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ToegangInspector() {
  const { resultaat, odrl } = useContext(Ctx);

  return (
    <div className="studio-inspector-pad">
      <h3 style={{ margin: "0 0 6px", fontSize: 13 }}>ODRL (NLGov-profiel)</h3>
      {odrl ? (
        <pre style={{ margin: 0, background: "var(--s-panel-head)", color: "var(--s-fg)", padding: 10, borderRadius: 8, fontSize: 11, overflow: "auto" }}>
          {JSON.stringify(odrl, null, 2)}
        </pre>
      ) : (
        <p style={{ fontSize: 12, color: "var(--s-fg-muted)" }}>
          Zodra de tekst foutloos parset, verschijnt hier de ODRL-weergave
          (permission/prohibition, constraints, duties).
        </p>
      )}
      {!resultaat.ok && (
        <p style={{ fontSize: 12, color: "#ef4444" }}>
          {resultaat.fouten.length} fout(en) — zie het foutenpaneel onder de tekst.
        </p>
      )}
    </div>
  );
}

export default {
  id: "toegang",
  label: "Toegangverlening",
  icon: <IconToegang />,
  groep: "diensten",
  status: "concept", // nog alleen via Ga naar / opdrachtenpalet
  Provider: ToegangProvider,
  Sidebar: ToegangSidebar,
  Main: ToegangMain,
  Inspector: ToegangInspector,
  sidebarLabel: "Canoniek model",
  inspectorLabel: "ODRL",
  menus: [
    {
      id: "beleid",
      label: "Beleid",
      items: [
        { id: "toegang-voorbeeld", label: "Voorbeeldbeleid laden", onClick: () => menuBus.emit("toegang:voorbeeld") },
        { id: "toegang-herformatteer", label: "Herformatteer (canonieke vorm)", onClick: () => menuBus.emit("toegang:herformatteer") },
        { type: "separator" },
        { id: "toegang-odrl", label: "Exporteer ODRL (JSON-LD)…", onClick: () => menuBus.emit("toegang:odrl") },
      ],
    },
  ],
};
