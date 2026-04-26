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

// ── Helper: zoek enum-waarden op naam in een nodes-array ────────────────────
function zoekEnumWaarden(enumNaam, nodes) {
  const node = nodes.find((n) => {
    const d = n.data || {};
    const isEnum = n.type === "EnumeratieNode" || n.type === "enumeratie" ||
      (Array.isArray(d.waarden) && d.waarden.length > 0 && !d.velden);
    const naamMatch = d.naam === enumNaam || d.typenaam === enumNaam || d.klassenaam === enumNaam;
    return isEnum && naamMatch;
  });
  return node?.data?.waarden ?? [];
}

// ── Helper: voeg velden + optionele enum-waarden toe aan de veldenlijst ──────
// inclPrefix=false → eigen velden (simpele naam) + hidden gekwalificeerde alias
// inclPrefix=true  → altijd prefixen (sibling / parent)
function voegVeldenToe(velden, veldenLijst, bronNaam, inclPrefix, allNodesOfElements, verwerkteEnums) {
  const nodes = allNodesOfElements
    ? (Array.isArray(allNodesOfElements) ? allNodesOfElements : Object.values(allNodesOfElements))
    : [];
  for (const veld of veldenLijst || []) {
    if (!veld.naam) continue;
    const pad = inclPrefix ? `${bronNaam}.${veld.naam}` : veld.naam;
    velden.push({ pad, type: veld.type || "string", bron: bronNaam });
    if (!inclPrefix && bronNaam) {
      // Hidden alias zodat TypeNaam.veldnaam ook geldig is wanneer je binnen dat type werkt
      velden.push({ pad: `${bronNaam}.${veld.naam}`, type: veld.type || "string", bron: bronNaam, verborgen: true });
    }
    // Enum waarden (eenmalig per enum)
    if (veld.enumNaam && verwerkteEnums && !verwerkteEnums.has(veld.enumNaam)) {
      verwerkteEnums.add(veld.enumNaam);
      for (const w of zoekEnumWaarden(veld.enumNaam, nodes)) {
        velden.push({
          pad: w,
          type: "enumwaarde",
          bron: veld.enumNaam,
          soort: "enumwaarde",
          invoegTekst: `"${w}"`,
        });
      }
    }
  }
}

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
  const eigenNaam = nodeData.klassenaam || nodeData.typenaam || "";
  const verwerkteEnums = new Set();

  // 1. Eigen velden (simpele naam + hidden alias + enum waarden)
  voegVeldenToe(velden, nodeData.velden, eigenNaam, false, allNodes, verwerkteEnums);

  // 2. Parent zoeken via inkomende compositie-edges
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

    // 2a. Sibling-GEs
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
      const siblingNaam = sibling.data.klassenaam || sibling.data.typenaam;
      if (!siblingNaam) continue;
      voegVeldenToe(velden, sibling.data.velden, siblingNaam, true, allNodes, verwerkteEnums);
    }

    // 2b. Velden van de parent-entiteit zelf
    const parentNaam = parent.data?.klassenaam || parent.data?.typenaam || "";
    voegVeldenToe(velden, parent.data?.velden, parentNaam, true, allNodes, verwerkteEnums);
  }

  return velden;
}

// ── Context-variabelen berekenen vanuit de model store (IDE-context) ─────────
/**
 * Versie van berekenContextVelden die werkt met de Zustand model store
 * in plaats van React Flow nodes/edges. Gebruikt in de IDE's DetailsPanel.
 *
 * @param {string} elementId      - ID van het geselecteerde element
 * @param {object} elements       - map van id → element (uit useModelStore)
 * @param {array}  structuralEdges - array van structurele edges (uit useModelStore)
 * @returns {Array<{ pad: string, type: string, bron: string }>}
 */
export function berekenContextVeldenFromStore(elementId, elements, structuralEdges) {
  const element = elements[elementId];
  if (!element) return [];
  const velden = [];
  const eigenNaam = element.naam || "";
  const verwerkteEnums = new Set();

  // 1. Eigen velden (simpele naam + hidden alias + enum waarden)
  voegVeldenToe(velden, element.data?.velden, eigenNaam, false, elements, verwerkteEnums);

  // 2. Zoek parent via inkomende structurele edge
  const parentEdge = structuralEdges.find((e) => e.target === elementId);
  if (parentEdge) {
    const parent = elements[parentEdge.source];
    if (parent) {
      const parentNaam = parent.naam || "";

      // 2a. Sibling GEs
      const siblingEdges = structuralEdges.filter(
        (e) => e.source === parentEdge.source && e.target !== elementId
      );
      for (const se of siblingEdges) {
        const sibling = elements[se.target];
        if (!sibling?.naam) continue;
        voegVeldenToe(velden, sibling.data?.velden, sibling.naam, true, elements, verwerkteEnums);
      }

      // 2b. Velden van de parent-entiteit zelf
      voegVeldenToe(velden, parent.data?.velden, parentNaam, true, elements, verwerkteEnums);
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

  // Splitter-state: breedte van het rechter variabelenpaneel
  const [rightWidth, setRightWidth] = useState(230);
  const isSplitting = useRef(false);
  const splitterStartX = useRef(0);
  const splitterStartWidth = useRef(0);

  // Container-ref: we zoeken de onderliggende <textarea> via DOM-query
  const containerRef = useRef(null);

  const taalLabel = AFLEIDINGSTALEN.find((t) => t.value === taal)?.label ?? taal;

  const validatieFout = useMemo(
    () => valideerExpressie(localValue, taal, contextVelden),
    [localValue, taal, contextVelden]
  );

  // Groepeer context-velden per bron — verborgen aliassen worden niet getoond
  const bronGroepen = useMemo(() => {
    const groepen = new Map();
    for (const v of contextVelden) {
      if (v.verborgen) continue;
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
          !v.verborgen &&
          v.pad.toLowerCase().startsWith(huidigWoord.toLowerCase()) &&
          v.pad !== huidigWoord
      )
      .slice(0, 10);

    setSuggesties(filtered);
    setSelectedIdx(0);
  }

  // ── Suggestie invoegen op cursor-positie ───────────────────────────────
  function voegInSuggestie(suggestie) {
    const textarea = containerRef.current?.querySelector("textarea");
    const cursor = textarea?.selectionStart ?? localValue.length;
    const tekstVoor = localValue.slice(0, cursor);
    const huidigWoord = tekstVoor.match(/[\w.]+$/)?.[0] ?? "";
    // Enum waarden: invoegTekst bevat aanhalingstekens; anders het pad zelf
    const invoegTekst = suggestie.invoegTekst ?? suggestie.pad;
    const nieuwVoor = tekstVoor.slice(0, tekstVoor.length - huidigWoord.length) + invoegTekst;
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
  function voegInVariabele(pad, invoegTekst) {
    const tekst = invoegTekst ?? pad;
    const textarea = containerRef.current?.querySelector("textarea");
    const cursor = textarea?.selectionStart ?? localValue.length;
    const nieuwVal = localValue.slice(0, cursor) + tekst + localValue.slice(cursor);

    setLocalValue(nieuwVal);
    onChange(nieuwVal);
    setSuggesties([]);

    requestAnimationFrame(() => {
      if (textarea) {
        textarea.focus();
        const pos = cursor + tekst.length;
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
    if (isSplitting.current) {
      // Splitter verschuiven: cursor naar links = rechter kolom breder
      const delta = splitterStartX.current - e.clientX;
      setRightWidth(Math.max(160, Math.min(520, splitterStartWidth.current + delta)));
      return;
    }
    if (!isDragging.current) return;
    didDrag.current = true;
    setModalPos({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y,
    });
  }, []);

  const handleBackdropMouseUp = useCallback(() => {
    isDragging.current = false;
    isSplitting.current = false;
  }, []);

  const handleBackdropClick = useCallback((e) => {
    if (didDrag.current) {
      didDrag.current = false;
      return;
    }
    onClose();
  }, [onClose]);

  // Splitter: start kolombreedteaanpassing
  const handleSplitterMouseDown = useCallback((e) => {
    isSplitting.current = true;
    didDrag.current = true; // Voorkom backdrop-click bij loslaten
    splitterStartX.current = e.clientX;
    splitterStartWidth.current = rightWidth;
    e.preventDefault();
    e.stopPropagation();
  }, [rightWidth]);

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
            {(taal === "cel" || taal === "expr") && (
              <div className="expressie-editor-modal__hint">
                <strong>CEL:</strong> <code>+</code> tekst, <code>? :</code> ternary,{" "}
                <code>!= null</code> null-check, <code>has(veld)</code> aanwezigheid.<br />
                <strong>Switch/case</strong> via chained ternary:<br />
                <code style={{ display: "block", marginTop: 4, lineHeight: 1.7 }}>
                  {`veld == "Waarde1" ? resultaat1 :`}<br />
                  {`veld == "Waarde2" ? resultaat2 :`}<br />
                  {`standaard`}
                </code>
                <span style={{ color: "#94a3b8", fontSize: "0.75rem" }}>
                  Enum waarden staan rechts (klik = invoegen met aanhalingstekens).
                </span>
              </div>
            )}
            {taal === "jsonlogic" && (
              <div className="expressie-editor-modal__hint">
                JsonLogic: JSON-gebaseerde regels, bijv.{" "}
                <code>{"{"}"==": [{"{"}"var": "status"{"}"}, "actief"]{"}"}</code>
              </div>
            )}
          </div>

          {/* Splitter: versleep om de kolomverhouding aan te passen */}
          <div
            className="expressie-editor-modal__splitter"
            onMouseDown={handleSplitterMouseDown}
          />

          {/* Rechter kolom: beschikbare variabelen + enum waarden */}
          <div className="expressie-editor-modal__right" style={{ width: rightWidth, minWidth: rightWidth }}>
            <div className="expressie-editor-modal__vars-header">Beschikbare variabelen</div>

            {bronGroepen.length === 0 ? (
              <div className="expressie-editor-modal__vars-leeg">
                Geen context beschikbaar.<br />
                <span style={{ fontSize: "0.75rem" }}>
                  Voeg velden toe aan gekoppelde types in de editor.
                </span>
              </div>
            ) : (
              bronGroepen.map(([bron, bVelden]) => {
                const isEnumGroep = bVelden.some((v) => v.soort === "enumwaarde");
                return (
                  <div key={bron} className="expressie-editor-modal__vars-groep">
                    {bron && (
                      <div
                        className={`expressie-editor-modal__vars-bron${isEnumGroep ? " expressie-editor-modal__vars-bron--enum" : ""}`}
                        title={isEnumGroep ? `Enum: ${bron}` : undefined}
                      >
                        {isEnumGroep ? `◇ ${bron}` : bron}
                      </div>
                    )}
                    {bVelden.map((v) => (
                      <button
                        key={v.pad}
                        className={`expressie-editor-modal__var-btn${v.soort === "enumwaarde" ? " expressie-editor-modal__var-btn--enum" : ""}`}
                        title={v.soort === "enumwaarde" ? `Enum waarde — inserts: "${v.pad}"` : `Type: ${v.type} — klik om in te voegen`}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          voegInVariabele(v.pad, v.invoegTekst);
                        }}
                      >
                        <span className="expressie-editor-modal__var-pad">
                          {v.soort === "enumwaarde" ? `"${v.pad}"` : v.pad}
                        </span>
                        <span className="expressie-editor-modal__var-type">
                          {v.soort === "enumwaarde" ? "enum" : v.type}
                        </span>
                      </button>
                    ))}
                  </div>
                );
              })
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
