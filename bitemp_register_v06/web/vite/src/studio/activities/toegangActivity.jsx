/**
 * toegangActivity — Toegangverlening: Toegangsspraak-editor (v0).
 *
 * Klare-taal toegangsbeleid (Toegangsspraak, een gecontroleerde natuurlijke
 * taal) dat 1-op-1 afbeeldt op de NLGov-ODRL-subset. Ontwerp:
 * docs/plans/"2026-07-22 Klare-taal Toegangsbeleid — Toegangsspraak (ontwerp).md".
 *
 * Slot-indeling:
 *   Sidebar   → ModelPicker (canoniek model): klik of sleep een veld om de
 *               van-vorm in te voegen; dubbelklik in de tekst filtert de boom
 *   Main      → Tabs: Tekst (editor met zinsontleding, autocomplete, fouten)
 *               + Canoniek (leesweergave: de geherformatteerde canonieke vorm)
 *   Inspector → ODRL JSON-LD (NLGov-profiel) van het geparste beleid
 *
 * Metamodel-koppeling (schema-API): keten-resolutie met verkorting en
 * typebewaking (metamodel.js) draaien live mee; de ODRL-uitvoer gebruikt de
 * geresolvede registerpaden.
 *
 * Autocomplete werkt twee kanten op: een woord typen stelt van-vormen voor;
 * "de naam van " typen stelt alle bases voor die zo'n veld hebben. Labels
 * tonen het overslabare deel van de keten tussen haakjes. Toetsen: Tab
 * bladert door de opties, Ctrl+Space voegt de korte vorm in, Shift+Ctrl+Space
 * de volledige keten (klik / shift-klik idem). De doorsnede is nu het hele
 * canoniek model; filteren op domein (of een andere doorsnede uit de
 * universele projectboom) kan later door een andere veldenlijst in de index
 * te stoppen.
 */
import React, { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from "react";
import EditorModule from "react-simple-code-editor";
const Editor = EditorModule.default ?? EditorModule;
import Prism from "../../shared/prismSetup";
import { ModelPicker, FIELDREF_MIME, useSchemaModel, bouwModelTree } from "../../modelpicker";
import {
  parseBeleid, renderBeleid, naarOdrl, padNaarVerwijzing, renderVerwijzing,
  verwijzingNaarPad, maakVeldIndex, resolveerBeleid, resolveerVerwijzing,
  resolveerGroep, bepaalSuggesties, VOORBEELD_BELEID,
} from "../../toegangsspraak";
import { IconToegang } from "../icons";
import { menuBus } from "../menuBus";
import { apiBase, downloadJson } from "../studioUtils";
import "./toegangActivity.css";

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

/** Platte veldenlijst (voor metamodel.js) uit de schema-API types. */
function verzamelVelden(types) {
  const velden = [];
  for (const domein of bouwModelTree(types)) {
    for (const ent of domein.entiteiten) {
      const pak = (knopen) => {
        for (const knoop of knopen || []) {
          const ref = knoop.ref;
          // Collectie-velden (arrays) zijn adressen van lijsten, geen waarden.
          if (!ref || ref.format === "array") continue;
          velden.push(ref);
        }
      };
      pak(ent.velden);
      for (const kind of ent.kinderen) pak(kind.velden);
    }
  }
  return velden;
}

// ── Zinsontleding: spans → gekleurde HTML ────────────────────────────────────

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function ontleedHtml(tekst, spans, actieveSpan) {
  let html = "";
  let pos = 0;
  for (const span of spans) {
    if (span.van < pos || span.tot > tekst.length) continue;
    html += escapeHtml(tekst.slice(pos, span.van));
    const actief = span === actieveSpan ? " ts-sem-actief" : "";
    const ontkenning = span.ontkenning ? " ts-sem-ontkenning" : "";
    html += `<span class="ts-sem ts-sem-${span.soort}${ontkenning}${actief}">${escapeHtml(tekst.slice(span.van, span.tot))}</span>`;
    pos = span.tot;
  }
  return html + escapeHtml(tekst.slice(pos));
}

const Ctx = createContext(null);

function ToegangProvider({ children }) {
  const [tekst, setTekst] = useState(VOORBEELD_BELEID);
  const [activeTab, setActiveTab] = useState("tekst"); // "tekst" | "canoniek"
  const [ontleding, setOntleding] = useState(true);
  const [suggesties, setSuggesties] = useState([]);
  const [actieveIndex, setActieveIndex] = useState(0);
  const [actieveGegevens, setActieveGegevens] = useState(null); // span na dubbelklik
  const [focusVeldpad, setFocusVeldpad] = useState(null); // exact element in de modelboom
  const editorWrapRef = useRef(null);
  // Na een programmatische invoeging even geen suggesties heropenen.
  const onderdrukRef = useRef(false);

  // Metamodel uit de schema-API → veldindex voor resolutie, typebewaking en
  // autocomplete. Zonder backend blijft alles werken, alleen zonder controle.
  const { types } = useSchemaModel({ baseUrl: apiBase() });
  const veldIndex = useMemo(() => {
    const velden = verzamelVelden(types || []);
    return velden.length ? maakVeldIndex(velden) : null;
  }, [types]);

  const resultaat = useMemo(() => parseBeleid(tekst), [tekst]);
  const geresolved = useMemo(
    () => (resultaat.ok && veldIndex ? resolveerBeleid(resultaat.beleid, veldIndex) : null),
    [resultaat, veldIndex]
  );
  const controleFouten = geresolved?.fouten || [];
  const odrl = useMemo(
    () => (resultaat.ok ? naarOdrl(geresolved?.beleid || resultaat.beleid) : null),
    [resultaat, geresolved]
  );
  const canoniek = useMemo(
    () => (resultaat.beleid ? renderBeleid(resultaat.beleid) : null),
    [resultaat]
  );

  // Verse waarden voor menu-acties zonder de listeners te herbinden.
  const ref = useRef({});
  ref.current = { tekst, resultaat, odrl, canoniek };

  const vindTextarea = useCallback(
    () => editorWrapRef.current?.querySelector("textarea"),
    []
  );

  const bijwerkSuggesties = useCallback(() => {
    if (onderdrukRef.current) { onderdrukRef.current = false; return; }
    const ta = vindTextarea();
    if (!ta || document.activeElement !== ta) { setSuggesties([]); return; }
    const begrippen = (ref.current.resultaat?.beleid?.begrippen || []).map((b) => b.naam);
    setSuggesties(bepaalSuggesties({
      tekst: ta.value,
      caret: ta.selectionStart ?? 0,
      spans: ref.current.resultaat?.spans || [],
      veldIndex,
      begrippen,
    }));
    setActieveIndex(0);
  }, [veldIndex, vindTextarea]);

  /**
   * Voeg tekst in via het native edit-mechanisme (execCommand), zodat Ctrl+Z
   * gewoon werkt. Vervangt `vervangVoor` tekens vóór de caret, of het
   * absolute `bereik` (span-vervanging). Fallback: directe state-update.
   */
  const invoegOpCursor = useCallback((invoeg, vervangVoor = 0, bereik = null) => {
    const ta = vindTextarea();
    setSuggesties([]);
    setActieveGegevens(null);
    onderdrukRef.current = true;
    if (!ta) { setTekst((huidig) => huidig + invoeg); return; }
    const caret = ta.selectionStart ?? ta.value.length;
    const start = bereik ? bereik.van : caret - vervangVoor;
    const einde = bereik ? bereik.tot : (ta.selectionEnd ?? caret);
    ta.focus();
    ta.setSelectionRange(start, einde);
    let gelukt = false;
    try {
      gelukt = document.execCommand("insertText", false, invoeg);
    } catch {
      gelukt = false;
    }
    if (!gelukt) {
      setTekst((huidig) => huidig.slice(0, start) + invoeg + huidig.slice(einde));
      requestAnimationFrame(() => {
        ta.focus();
        ta.selectionStart = ta.selectionEnd = start + invoeg.length;
      });
    }
  }, [vindTextarea]);

  /** Suggestie invoegen: standaard de korte vorm, met `voluit` de hele keten. */
  const pasSuggestieToe = useCallback(
    (s, voluit = false) => invoegOpCursor(voluit ? s.lang : s.kort, s.vervang || 0, s.bereik || null),
    [invoegOpCursor]
  );

  /** Dubbelklik op een gegevens-keten: groepeer, toon pad, focus het element in de modelboom. */
  const toonGegevensOpPositie = useCallback((positie) => {
    const spans = ref.current.resultaat?.spans || [];
    const span = spans.find((s) => s.soort === "gegevens" && s.van <= positie && positie <= s.tot);
    if (!span) { setActieveGegevens(null); return; }
    let pad = null;
    let echtPad = null; // pad zoals het in het metamodel staat → exact element
    if (span.verwijzing) {
      if (veldIndex) {
        const veld = resolveerVerwijzing(span.verwijzing, veldIndex);
        const groep = veld.fout ? resolveerGroep(span.verwijzing, veldIndex) : null;
        echtPad = (!veld.fout && veld.pad) || (groep && !groep.fout && groep.pad) || null;
      }
      pad = echtPad || verwijzingNaarPad(span.verwijzing);
    }
    setActieveGegevens({ span, pad, begrip: span.begrip || null, inBoom: Boolean(echtPad) });
    if (echtPad) setFocusVeldpad(echtPad);
  }, [veldIndex]);

  useEffect(() => {
    const af = [
      // Vervang de tekst via het edit-mechanisme zodat ook dit undo-baar is.
      menuBus.on("toegang:voorbeeld", () => {
        const ta = vindTextarea();
        if (ta) invoegOpCursor(VOORBEELD_BELEID, 0, { van: 0, tot: ta.value.length });
        else setTekst(VOORBEELD_BELEID);
      }),
      menuBus.on("toegang:herformatteer", () => {
        const { canoniek } = ref.current;
        if (!canoniek) return;
        const ta = vindTextarea();
        if (ta) invoegOpCursor(canoniek, 0, { van: 0, tot: ta.value.length });
        else setTekst(canoniek);
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
    <Ctx.Provider
      value={{
        tekst, setTekst, activeTab, setActiveTab, ontleding, setOntleding,
        resultaat, controleFouten, odrl, canoniek, editorWrapRef, invoegOpCursor,
        suggesties, setSuggesties, actieveIndex, setActieveIndex,
        bijwerkSuggesties, pasSuggestieToe, actieveGegevens, setActieveGegevens,
        toonGegevensOpPositie, focusVeldpad,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

function ToegangSidebar() {
  const { invoegOpCursor, focusVeldpad } = useContext(Ctx);

  const onPick = useCallback(
    (fieldRef) => invoegOpCursor(veldpadNaarVanVorm(fieldRef.veldpad)),
    [invoegOpCursor]
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <p style={{ margin: 0, padding: "8px 10px", fontSize: 12, color: "var(--s-fg-muted)" }}>
        Klik op “kies” of sleep een veld naar de tekst (van-vorm). Dubbelklik in
        de tekst op een gegevens-keten om hem hier terug te vinden.
      </p>
      <div style={{ flex: 1, minHeight: 0 }}>
        <ModelPicker baseUrl={apiBase()} onPick={onPick} expandEntiteiten focusVeldpad={focusVeldpad} />
      </div>
    </div>
  );
}

function FoutenPaneel({ fouten, controleFouten }) {
  return (
    <div
      style={{
        borderTop: "1px solid var(--s-border, #e5e7eb)",
        padding: "8px 12px",
        fontSize: 12,
        maxHeight: 140,
        overflow: "auto",
        background: "var(--s-panel-head)",
        color: "var(--s-fg)",
      }}
    >
      {fouten.map((fout, i) => (
        <div key={`f${i}`} style={{ marginBottom: 4 }}>
          <span style={{ color: "#ef4444", fontWeight: 600 }}>
            {fout.regel ? `Regel ${fout.regel}: ` : "Fout: "}
          </span>
          {fout.bericht}
        </div>
      ))}
      {controleFouten.map((fout, i) => (
        <div key={`c${i}`} style={{ marginBottom: 4 }}>
          <span style={{ color: "#f59e0b", fontWeight: 600 }}>Controle: </span>
          {fout.bericht}
        </div>
      ))}
    </div>
  );
}

function SuggestieBalk({ suggesties, actieveIndex, onKies }) {
  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap",
        borderTop: "1px solid var(--s-border, #e5e7eb)",
        padding: "6px 12px", background: "var(--s-panel-head)",
      }}
    >
      <span style={{ fontSize: 11, color: "var(--s-fg-muted)" }} title="Tab bladert; Ctrl+Space voegt in; Shift+Ctrl+Space of shift-klik voegt de volledige keten in ((…) = overslaanbaar)">
        Tab ↹ · Ctrl+Space
      </span>
      {suggesties.map((s, i) => (
        <button
          key={i}
          onMouseDown={(e) => { e.preventDefault(); onKies(s, e.shiftKey); }}
          title={s.kort === s.lang ? s.kort : `Ctrl+Space: ${s.kort}\nShift: ${s.lang}`}
          style={{
            font: "12px/1.4 ui-monospace, Consolas, monospace",
            padding: "2px 8px", borderRadius: 999, cursor: "pointer",
            border: i === actieveIndex ? "1px solid #6366f1" : "1px solid var(--s-border, #e5e7eb)",
            background: i === actieveIndex ? "rgba(99,102,241,0.12)" : "transparent",
            color: "var(--s-fg)",
          }}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}

function ToegangMain() {
  const {
    tekst, setTekst, activeTab, setActiveTab, ontleding, setOntleding,
    resultaat, controleFouten, canoniek, editorWrapRef, invoegOpCursor,
    suggesties, setSuggesties, actieveIndex, setActieveIndex,
    bijwerkSuggesties, pasSuggestieToe, actieveGegevens, setActieveGegevens,
    toonGegevensOpPositie,
  } = useContext(Ctx);

  const highlight = useCallback(
    (code) => {
      if (ontleding && resultaat.ok && resultaat.spans.length && code === tekst) {
        return ontleedHtml(code, resultaat.spans, actieveGegevens?.span || null);
      }
      return Prism.highlight(code, Prism.languages.toegangsspraak, "toegangsspraak");
    },
    [ontleding, resultaat, tekst, actieveGegevens]
  );

  // De canonieke leesweergave krijgt dezelfde ontleding: de canonieke tekst
  // parset per definitie, dus de spans komen uit een verse parse ervan.
  const canoniekSpans = useMemo(
    () => (ontleding && canoniek ? parseBeleid(canoniek).spans : null),
    [ontleding, canoniek]
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

  const onChange = useCallback(
    (waarde) => {
      setTekst(waarde);
      setActieveGegevens(null);
      requestAnimationFrame(bijwerkSuggesties);
    },
    [setTekst, setActieveGegevens, bijwerkSuggesties]
  );

  // Capture-fase: bij openstaande suggesties wint Tab-bladeren van de
  // Tab-als-insprong van react-simple-code-editor; zonder suggesties blijft
  // Tab gewoon inspringen. Ctrl+Space voegt in (Shift erbij = volledige keten)
  // en opent de suggesties als ze dicht zijn.
  const onKeyDownCapture = useCallback(
    (e) => {
      if (e.key === "Tab" && suggesties.length) {
        e.preventDefault();
        e.stopPropagation();
        setActieveIndex((i) => (i + 1) % suggesties.length);
      } else if (e.code === "Space" && e.ctrlKey) {
        e.preventDefault();
        e.stopPropagation();
        if (suggesties.length) pasSuggestieToe(suggesties[actieveIndex], e.shiftKey);
        else bijwerkSuggesties();
      } else if (e.key === "Escape") {
        setSuggesties([]);
      }
    },
    [suggesties, actieveIndex, pasSuggestieToe, bijwerkSuggesties, setActieveIndex, setSuggesties]
  );

  const onKeyUp = useCallback(
    (e) => {
      if (["Tab", "Escape", "Control", "Shift", "Alt", "Meta"].includes(e.key)) return;
      bijwerkSuggesties();
    },
    [bijwerkSuggesties]
  );

  const onDoubleClick = useCallback(() => {
    const ta = editorWrapRef.current?.querySelector("textarea");
    if (!ta) return;
    toonGegevensOpPositie(ta.selectionStart ?? 0);
  }, [editorWrapRef, toonGegevensOpPositie]);

  const heeftFouten = !resultaat.ok;
  const statusregel = heeftFouten
    ? `✗ ${resultaat.fouten.length} fout(en)`
    : `✓ ${resultaat.beleid.regels.length} regel(s), ${resultaat.beleid.begrippen.length} begrip(pen)` +
      (controleFouten.length ? ` · ${controleFouten.length} controle-melding(en)` : "");
  const statusKleur = heeftFouten ? "#ef4444" : controleFouten.length ? "#f59e0b" : "#10b981";

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
        <button
          className={"studio-tab" + (ontleding ? " is-actief" : "")}
          onClick={() => setOntleding((v) => !v)}
          title="Kleur de elementen van elke zin: subject, gegevens, vergelijking, waarde, handeling, plicht"
        >
          Ontleding
        </button>
        <span style={{ marginLeft: "auto", alignSelf: "center", padding: "0 12px", fontSize: 12, color: statusKleur }}>
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
              onKeyDownCapture={onKeyDownCapture}
              onKeyUp={onKeyUp}
              onClick={bijwerkSuggesties}
              onDoubleClick={onDoubleClick}
            >
              <Editor
                value={tekst}
                onValueChange={onChange}
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
            {actieveGegevens && (
              <div style={{ borderTop: "1px solid var(--s-border, #e5e7eb)", padding: "6px 12px", fontSize: 12, background: "var(--s-panel-head)", color: "var(--s-fg)" }}>
                <span style={{ fontWeight: 600, color: "#6366f1" }}>Gegevens: </span>
                {actieveGegevens.pad
                  ? <>registerpad <code>{actieveGegevens.pad}</code>{actieveGegevens.inBoom ? " — gemarkeerd in de modelboom links." : " — niet gevonden in het metamodel."}</>
                  : actieveGegevens.begrip
                    ? <>begrip “{actieveGegevens.begrip}” — gedefinieerd onder Begrippen.</>
                    : null}
              </div>
            )}
            {suggesties.length > 0 && (
              <SuggestieBalk suggesties={suggesties} actieveIndex={actieveIndex} onKies={pasSuggestieToe} />
            )}
            {(!resultaat.ok || controleFouten.length > 0) && (
              <FoutenPaneel fouten={resultaat.fouten} controleFouten={controleFouten} />
            )}
          </>
        ) : (
          <div style={{ flex: 1, minHeight: 0, overflow: "auto", padding: 14 }}>
            {canoniek ? (
              canoniekSpans?.length ? (
                <pre
                  style={{ margin: 0, fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace", fontSize: 13, lineHeight: 1.6 }}
                  dangerouslySetInnerHTML={{ __html: ontleedHtml(canoniek, canoniekSpans, null) }}
                />
              ) : (
                <pre style={{ margin: 0, fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace", fontSize: 13, lineHeight: 1.6 }}>
                  {canoniek}
                </pre>
              )
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
  const { resultaat, controleFouten, odrl } = useContext(Ctx);

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
      {resultaat.ok && controleFouten.length > 0 && (
        <p style={{ fontSize: 12, color: "#f59e0b" }}>
          {controleFouten.length} controle-melding(en) uit het metamodel — de ODRL-weergave
          gebruikt waar mogelijk de geresolvede registerpaden.
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
