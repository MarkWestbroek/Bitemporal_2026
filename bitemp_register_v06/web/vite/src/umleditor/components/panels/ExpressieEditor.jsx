/**
 * ExpressieEditor — breakout-modal voor het bewerken van afleidingsregels.
 *
 * Biedt:
 *  - Syntax-highlighting voor CEL (Custom Prism-grammar), JSON (JsonLogic),
 *    en plain tekst (Expr / Pseudo-code)
 *  - Autocomplete op basis van beschikbare context-variabelen (berekenContextVelden)
 *  - Keyboard-navigatie: ArrowDown/Up om te navigeren, Tab/Enter om in te voegen,
 *    Escape om de dropdown te sluiten
 *  - Klik op variabele in rechter paneel → invoegen op cursorpositie
 *  - Syntaxvalidatie (bracket-balans + onbekende X.y-paden voor CEL)
 *
 * Props:
 *  - value:          huidige expressiestring
 *  - taal:           "cel" | "expr" | "jsonlogic" | "pseudo"
 *  - onChange:       (nieuweWaarde: string) => void — live; modal slaat niet apart op
 *  - onClose:        () => void — sluit de modal
 *  - contextVelden:  array van { pad, type, bron } — geleverd door berekenContextVelden()
 */

import { useState, useRef, useMemo, useCallback } from "react";
import EditorModule from "react-simple-code-editor";
const Editor = EditorModule.default ?? EditorModule;
import Prism from "prismjs";
import "prismjs/components/prism-json";
import { AFLEIDINGSTALEN } from "../../metamodel/types";

// ── CEL Prism-grammar (eenmalig registreren) ──────────────────────────────────
// CEL (Common Expression Language) is C-achtig; we modelleren de meest
// herkenbare token-typen. Er bestaat geen standaard Prism-grammar voor CEL.
function registreerCelGrammar() {
  if (Prism.languages.cel) return;
  Prism.languages.cel = {
    // Regels commentaar (CEL ondersteunt dit officieel niet, maar Expr wel)
    comment: /\/\/.*/,
    // String-literals — single- en double-quoted, met escape-sequences
    string: {
      pattern: /(["'])(?:(?!\1)[^\\]|\\.)*\1/,
      greedy: true,
    },
    // Getallen — integer en float
    number: /\b\d+(?:\.\d+)?\b/,
    // Ingebouwde CEL-functies en keywords
    keyword:
      /\b(?:true|false|null|in|has|all|exists|exists_one|map|filter|size|type|matches|startsWith|endsWith|contains|duration|timestamp|int|uint|double|string|bytes|list|dyn)\b/,
    // Operatoren
    operator: /[+\-*/%]=?|[!=<>]=?|&&|\|\||[?:]/,
    // Leestekens
    punctuation: /[{}[\]();,.]/,
  };
}

// ── Welke Prism-grammar per taal ─────────────────────────────────────────────
const TAAL_PRISM = {
  cel: "cel",
  expr: "cel",       // Expr-taal lijkt sterk op CEL
  jsonlogic: "json",
  pseudo: null,      // Geen highlighting voor pseudo-code
};

// ── Syntaxvalidatie (lichtgewicht, design-time) ───────────────────────────────
function valideerExpressie(expressie, taal, contextVelden) {
  if (!expressie || !expressie.trim()) return "";

  // 1. Bracket-balans: tel haakjes
  let diepte = 0;
  for (const c of expressie) {
    if (c === "(") {
      diepte++;
    } else if (c === ")") {
      diepte--;
      if (diepte < 0) return "Onverwacht sluitend haakje )";
    }
  }
  if (diepte > 0) return `${diepte} niet-gesloten haakje${diepte > 1 ? "s" : ""}`;

  // 2. CEL/Expr: controleer of gebruikte X.y-paden voorkomen in de context
  if ((taal === "cel" || taal === "expr") && contextVelden.length > 0) {
    const bekendePaden = new Set(contextVelden.map((v) => v.pad));
    // Zoek patronen UpperCase.lowercase (bijv. Naam.voornaam, U.aaa)
    const gevonden = [...expressie.matchAll(/\b([A-Z][A-Za-z0-9_]*\.[a-z_][A-Za-z0-9_]*)\b/g)].map(
      (m) => m[1]
    );
    for (const pad of gevonden) {
      if (!bekendePaden.has(pad)) {
        return `Onbekend veld: '${pad}'`;
      }
    }
  }

  return "";
}

// ── Context-variabelen berekenen uit node + grafiek ──────────────────────────
/**
 * Berekent de beschikbare variabelen voor een expressie op basis van:
 *  - Eigen velden van het huidige type (simpele namen)
 *  - Velden van sibling-GEs (via de parent-entiteit): "TypNaam.veldnaam"
 *  - Velden van de parent-entiteit zelf: "EntNaam.veldnaam"
 *
 * @param {object} node     - geselecteerde React Flow node
 * @param {array}  allNodes - alle nodes in de grafiek
 * @param {array}  edges    - alle edges in de grafiek
 * @returns {Array<{ pad: string, type: string, bron: string }>}
 */
export function berekenContextVelden(node, allNodes, edges) {
  if (!node) return [];
  const velden = [];
  const nodeData = node.data || {};

  // Gebruik de UML-weergavenaam (klassenaam) als prefix, niet de Go-typenaam
  const eigenNaam = nodeData.klassenaam || nodeData.typenaam || "";

  // 1. Eigen velden — simpele namen, geen prefix
  for (const veld of nodeData.velden || []) {
    if (veld.naam) {
      velden.push({
        pad: veld.naam,
        type: veld.type || "string",
        bron: eigenNaam,
      });
    }
  }

  // 2. Zoek parent-entiteit via inkomende compositie-edges
  //    (identificeer compositie door: bron=entiteit node, doel=dit node,
  //     geen speciale flags zoals isAssociation / isDependency)
  const inkomend = edges.filter(
    (e) =>
      e.target === node.id &&
      !e.data?.isAssociation &&
      !e.data?.isAssociationClassLink &&
      !e.data?.isDependency &&
      !e.data?.isGeneralization
  );

  for (const edge of inkomend) {
    const parent = allNodes.find((n) => n.id === edge.source);
    if (!parent) continue;

    // 2a. Sibling-GEs: andere uitgaande compositie-edges van dezelfde parent
    const siblingEdges = edges.filter(
      (e) =>
        e.source === parent.id &&
        e.target !== node.id &&
        !e.data?.isAssociation &&
        !e.data?.isAssociationClassLink &&
        !e.data?.isDependency &&
        !e.data?.isGeneralization
    );
    for (const se of siblingEdges) {
      const sibling = allNodes.find((n) => n.id === se.target);
      if (!sibling?.data) continue;
      // Gebruik de UML-weergavenaam (klassenaam) als prefix, niet de Go-typenaam
      const siblingNaam = sibling.data.klassenaam || sibling.data.typenaam;
      if (!siblingNaam) continue;
      for (const veld of sibling.data.velden || []) {
        if (veld.naam) {
          velden.push({
            pad: `${siblingNaam}.${veld.naam}`,
            type: veld.type || "string",
            bron: siblingNaam,
          });
        }
      }
    }

    // 2b. Velden van de parent-entiteit zelf
    const parentNaam = parent.data?.klassenaam || parent.data?.typenaam || "";
    for (const veld of parent.data?.velden || []) {
      if (veld.naam) {
        velden.push({
          pad: `${parentNaam}.${veld.naam}`,
          type: veld.type || "string",
          bron: parentNaam,
        });
      }
    }
  }

  return velden;
}

// ── Hoofd-component ───────────────────────────────────────────────────────────
export default function ExpressieEditor({ value, taal, onChange, onClose, contextVelden = [] }) {
  registreerCelGrammar();

  const [localValue, setLocalValue] = useState(value ?? "");
  const [suggesties, setSuggesties] = useState([]);
  const [selectedIdx, setSelectedIdx] = useState(0);

  // Drag-state voor de verplaatsbare modal
  const [modalPos, setModalPos] = useState({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const didDrag = useRef(false);

  // Container-ref: we zoeken de onderliggende <textarea> via DOM-query
  const containerRef = useRef(null);

  const taalLabel = AFLEIDINGSTALEN.find((t) => t.value === taal)?.label ?? taal;

  const validatieFout = useMemo(
    () => valideerExpressie(localValue, taal, contextVelden),
    [localValue, taal, contextVelden]
  );

  // Groepeer context-velden per bron voor het rechter paneel
  const bronGroepen = useMemo(() => {
    const groepen = new Map();
    for (const v of contextVelden) {
      const key = v.bron || "";
      if (!groepen.has(key)) groepen.set(key, []);
      groepen.get(key).push(v);
    }
    return [...groepen.entries()];
  }, [contextVelden]);

  // ── Highlight-functie voor Prism ────────────────────────────────────────
  function highlight(code) {
    const prismTaal = TAAL_PRISM[taal] ?? null;
    if (!code || !prismTaal) return code ?? "";
    const grammar = Prism.languages[prismTaal];
    if (!grammar) return code;
    try {
      return Prism.highlight(code, grammar, prismTaal);
    } catch {
      return code;
    }
  }

  // ── Waarde wijzigen + autocomplete bijwerken ────────────────────────────
  function handleChange(nieuwVal) {
    setLocalValue(nieuwVal);
    onChange(nieuwVal);

    if (!contextVelden.length) {
      setSuggesties([]);
      return;
    }

    // Haal cursor-positie op via de verborgen textarea in de editor-container
    const textarea = containerRef.current?.querySelector("textarea");
    const cursor = textarea?.selectionStart ?? nieuwVal.length;
    const tekstVoor = nieuwVal.slice(0, cursor);
    // Huidig woord = aaneengesloten reeks van word-chars + punt
    const huidigWoord = tekstVoor.match(/[\w.]+$/)?.[0] ?? "";

    if (huidigWoord.length < 1) {
      setSuggesties([]);
      return;
    }

    const filtered = contextVelden
      .filter(
        (v) =>
          v.pad.toLowerCase().startsWith(huidigWoord.toLowerCase()) &&
          v.pad !== huidigWoord
      )
      .slice(0, 8);

    setSuggesties(filtered);
    setSelectedIdx(0);
  }

  // ── Suggestie invoegen op cursor-positie ───────────────────────────────
  function voegInSuggestie(suggestie) {
    const textarea = containerRef.current?.querySelector("textarea");
    const cursor = textarea?.selectionStart ?? localValue.length;
    const tekstVoor = localValue.slice(0, cursor);
    const huidigWoord = tekstVoor.match(/[\w.]+$/)?.[0] ?? "";
    const nieuwVoor = tekstVoor.slice(0, tekstVoor.length - huidigWoord.length) + suggestie.pad;
    const nieuwVal = nieuwVoor + localValue.slice(cursor);

    setLocalValue(nieuwVal);
    onChange(nieuwVal);
    setSuggesties([]);

    requestAnimationFrame(() => {
      if (textarea) {
        textarea.focus();
        textarea.setSelectionRange(nieuwVoor.length, nieuwVoor.length);
      }
    });
  }

  // ── Variabele invoegen op cursor-positie (klik in rechter paneel) ──────
  function voegInVariabele(pad) {
    const textarea = containerRef.current?.querySelector("textarea");
    const cursor = textarea?.selectionStart ?? localValue.length;
    const nieuwVal = localValue.slice(0, cursor) + pad + localValue.slice(cursor);

    setLocalValue(nieuwVal);
    onChange(nieuwVal);
    setSuggesties([]);

    requestAnimationFrame(() => {
      if (textarea) {
        textarea.focus();
        const pos = cursor + pad.length;
        textarea.setSelectionRange(pos, pos);
      }
    });
  }

  // ── Keyboard-navigatie in autocomplete-dropdown ─────────────────────────
  function handleKeyDown(e) {
    if (!suggesties.length) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, suggesties.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Tab" || e.key === "Enter") {
      if (selectedIdx >= 0 && selectedIdx < suggesties.length) {
        e.preventDefault();
        voegInSuggestie(suggesties[selectedIdx]);
      }
    } else if (e.key === "Escape") {
      setSuggesties([]);
    }
  }

  // ── Drag-handlers voor de verplaatsbare modal ──────────────────────────
  const handleHeaderMouseDown = useCallback((e) => {
    if (e.button !== 0) return;
    isDragging.current = true;
    didDrag.current = false;
    dragStart.current = {
      x: e.clientX - modalPos.x,
      y: e.clientY - modalPos.y,
    };
    e.preventDefault();
  }, [modalPos]);

  const handleBackdropMouseMove = useCallback((e) => {
    if (!isDragging.current) return;
    didDrag.current = true;
    setModalPos({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y,
    });
  }, []);

  const handleBackdropMouseUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  const handleBackdropClick = useCallback((e) => {
    if (didDrag.current) {
      didDrag.current = false;
      return;
    }
    onClose();
  }, [onClose]);

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div
      className="expressie-editor-backdrop"
      onMouseMove={handleBackdropMouseMove}
      onMouseUp={handleBackdropMouseUp}
      onClick={handleBackdropClick}
    >
      <div
        className="expressie-editor-modal"
        style={{ transform: `translate(${modalPos.x}px, ${modalPos.y}px)` }}
        onClick={(e) => e.stopPropagation()}
      >

        {/* Header — ook drag-handle */}
        <div
          className="expressie-editor-modal__header"
          onMouseDown={handleHeaderMouseDown}
        >
          <span className="expressie-editor-modal__title">
            Expressie — <span className="expressie-editor-modal__taal">{taalLabel}</span>
          </span>
          <button
            className="expressie-editor-modal__close"
            onClick={onClose}
            aria-label="Sluiten"
            type="button"
          >
            ✕
          </button>
        </div>

        {/* Body: links editor, rechts variabelenpaneel */}
        <div className="expressie-editor-modal__body">

          {/* Linker kolom: code-editor + autocomplete + validatie */}
          <div className="expressie-editor-modal__left" ref={containerRef}>
            <Editor
              value={localValue}
              onValueChange={handleChange}
              highlight={highlight}
              padding={12}
              placeholder={
                taal === "cel" || taal === "expr"
                  ? "bijv. Naam.voornaam + ' ' + Naam.achternaam"
                  : taal === "jsonlogic"
                  ? '{"+":[{"var":"Naam.voornaam"}," ",{"var":"Naam.achternaam"}]}'
                  : "Schrijf hier je expressie..."
              }
              className="expressie-editor-code"
              textareaClassName="expressie-editor-textarea"
              preClassName="expressie-editor-pre"
              textareaProps={{ onKeyDown: handleKeyDown }}
              style={{
                fontFamily: "ui-monospace, SFMono-Regular, SF Mono, Menlo, monospace",
                fontSize: "0.875rem",
                lineHeight: 1.6,
                minHeight: "160px",
              }}
            />

            {/* Autocomplete-dropdown */}
            {suggesties.length > 0 && (
              <div className="expressie-autocomplete">
                {suggesties.map((s, i) => (
                  <div
                    key={s.pad}
                    className={`expressie-autocomplete__item${
                      i === selectedIdx ? " expressie-autocomplete__item--selected" : ""
                    }`}
                    // onMouseDown ipv onClick: voorkomt blur op de textarea vóór de klik
                    onMouseDown={(e) => {
                      e.preventDefault();
                      voegInSuggestie(s);
                    }}
                  >
                    <span className="expressie-autocomplete__pad">{s.pad}</span>
                    <span className="expressie-autocomplete__type">{s.type}</span>
                  </div>
                ))}
                <div className="expressie-autocomplete__hint">
                  ↑↓ navigeren · Tab / Enter invoegen · Esc sluiten
                </div>
              </div>
            )}

            {/* Validatiestatus */}
            {validatieFout ? (
              <div className="expressie-editor-modal__fout">⚠ {validatieFout}</div>
            ) : localValue.trim() ? (
              <div className="expressie-editor-modal__ok">✓ Syntaxis ok</div>
            ) : null}

            {/* Hulptekst voor de geselecteerde taal */}
            {taal === "cel" && (
              <div className="expressie-editor-modal__hint">
                CEL: <code>+</code> tekst samenvoegen, <code>? :</code> ternary,{" "}
                <code>!= null</code> null-check, <code>has(veld)</code> aanwezigheid.
                Gebruik <code>TypeNaam.veldnaam</code> voor velden van gekoppelde types.
              </div>
            )}
            {taal === "expr" && (
              <div className="expressie-editor-modal__hint">
                Expr: vergelijkbaar met CEL. Gebruik <code>TypeNaam.veldnaam</code>{" "}
                voor velden.
              </div>
            )}
            {taal === "jsonlogic" && (
              <div className="expressie-editor-modal__hint">
                JsonLogic: JSON-gebaseerde regels, bijv.{" "}
                <code>{"{"}"==": [{"{"}"var": "status"{"}"}, "actief"]{"}"}</code>
              </div>
            )}
          </div>

          {/* Rechter kolom: beschikbare variabelen */}
          <div className="expressie-editor-modal__right">
            <div className="expressie-editor-modal__vars-header">Beschikbare variabelen</div>

            {bronGroepen.length === 0 ? (
              <div className="expressie-editor-modal__vars-leeg">
                Geen context beschikbaar.<br />
                <span style={{ fontSize: "0.75rem" }}>
                  Voeg velden toe aan gekoppelde types in de editor.
                </span>
              </div>
            ) : (
              bronGroepen.map(([bron, bVelden]) => (
                <div key={bron} className="expressie-editor-modal__vars-groep">
                  {bron && (
                    <div className="expressie-editor-modal__vars-bron">{bron}</div>
                  )}
                  {bVelden.map((v) => (
                    <button
                      key={v.pad}
                      className="expressie-editor-modal__var-btn"
                      title={`Type: ${v.type} — klik om in te voegen op cursorpositie`}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        voegInVariabele(v.pad);
                      }}
                    >
                      <span className="expressie-editor-modal__var-pad">{v.pad}</span>
                      <span className="expressie-editor-modal__var-type">{v.type}</span>
                    </button>
                  ))}
                </div>
              ))
            )}

            <div className="expressie-editor-modal__vars-hint">
              Klik op een variabele om in te voegen op de cursorpositie.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="expressie-editor-modal__footer">
          <button
            className="expressie-editor-modal__btn expressie-editor-modal__btn--primary"
            type="button"
            onClick={onClose}
          >
            Toepassen
          </button>
        </div>
      </div>
    </div>
  );
}
