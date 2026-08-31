/**
 * CMMN-shapes (v0). CMMN heeft een eigen, vrij strakke vormentaal — en die
 * ís de betekenis, dus alle zeven vormen zijn eigen shapes:
 *
 *   - **case plan model**: mapvorm (rechthoek met tab linksboven);
 *   - **stage**: rechthoek met **afgeschuinde hoeken** (achthoek); de vlag
 *     `discretionair` maakt de rand gestreept — dat is in CMMN de notatie
 *     voor een discretionary stage / plan fragment, en dus een eigenschap,
 *     geen apart elementtype;
 *   - **task**: afgeronde rechthoek met een type-icoontje linksboven
 *     (human ☺ · process ▸ · case ▤ · decision ⊞) en de planningsmarkeringen
 *     onderaan (`!` verplicht · `#` herhaling · `▷` handmatig);
 *   - **milestone**: rechthoek met halfronde uiteinden (stadion);
 *   - **event listener**: dubbele cirkel, met klok (timer) of poppetje (user);
 *   - **case file item**: dokje met omgevouwen hoek;
 *   - **sentry**: de ruit óp de rand — **open** = entry criterion,
 *     **gevuld** = exit criterion. Dit is het rand-primitief (`randElement`)
 *     en daarmee het hart van de notatie: een sentry hóórt bij zijn stage,
 *     task of milestone en beweegt ermee mee.
 *
 * `children` bevat de React Flow-handles (+ resizer/badge) — altijd renderen.
 */
import React from "react";
import { registreerShape } from "../../diagramcore/shapes/shapeRegistry.js";

// Thema-tokens (diagramcore.css §StyleType-tokens v2): --dc-lijn is de
// lijnkleur per thema en --dc-marker-vulling de canvaskleur. Dat laatste is
// precies waarom een "open" symbool in het donkere thema ook écht open oogt —
// cruciaal hier, want open vs. gevuld ís het verschil tussen een entry- en
// een exit-sentry.
const LIJN = "var(--dc-lijn, #334155)";
const OPEN = "var(--dc-marker-vulling, #ffffff)";
const HOEK = 12; // afschuining van de stage-hoeken

const randKleur = (selected, val = "#94a3b8") =>
  selected ? "var(--dc-selectie, #2563eb)" : val;

/** Planningsmarkeringen onderaan een task of stage. */
function Markeringen({ data }) {
  const tekens = [];
  if (data?.verplicht) tekens.push(["!", "verplicht (required rule)"]);
  if (data?.herhaling) tekens.push(["#", "herhaling (repetition rule)"]);
  if (data?.handmatig) tekens.push(["▷", "handmatig starten (manual activation)"]);
  if (!tekens.length) return null;
  return (
    <div
      style={{
        position: "absolute",
        bottom: 2,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        gap: 6,
        fontSize: 11,
        lineHeight: 1,
        color: "#475569",
        pointerEvents: "none",
      }}
    >
      {tekens.map(([t, titel]) => (
        <span key={t} title={titel}>{t}</span>
      ))}
    </div>
  );
}

/** Case plan model: de mapvorm — rechthoek met een tab linksboven. */
function CasePlanShape({ element, selected, children }) {
  const rand = randKleur(selected);
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        minWidth: 320,
        minHeight: 220,
        position: "relative",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* De tab overlapt de bovenrand van de romp, zodat tab en romp één
          doorlopende contour vormen — dezelfde truc als de UML-package. */}
      <div
        style={{
          maxWidth: "60%",
          padding: "3px 14px 4px",
          border: `1.8px solid ${rand}`,
          borderBottom: "none",
          borderRadius: "5px 5px 0 0",
          background: element?.data?.kleur || "rgba(148,163,184,0.10)",
          fontSize: 12,
          fontWeight: 700,
          color: "var(--s-fg, #0f172a)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          marginBottom: -1,
          position: "relative",
          zIndex: 1,
        }}
      >
        {element?.naam || "(case)"}
      </div>
      <div
        style={{
          flex: 1,
          border: `1.8px solid ${rand}`,
          borderRadius: "0 5px 5px 5px",
          background: element?.data?.kleur ? `${element.data.kleur}18` : "rgba(148,163,184,0.06)",
        }}
      />
      {children}
    </div>
  );
}

/**
 * Stage: rechthoek met afgeschuinde hoeken; gestreept = discretionair.
 *
 * De achthoek is een SVG-pad op de échte nodemaat, niet een `clip-path` en
 * niet een uitgerekte viewBox. Beide alternatieven zijn geprobeerd en geen
 * van beide klopt: `clip-path` knipt óók de rand weg, waardoor de schuine
 * zijden geen lijn hebben, en `preserveAspectRatio="none"` maakt de
 * afschuining scheef zodra de stage breder dan hoog wordt. Meten dus.
 */
function StageShape({ element, selected, children }) {
  const d = element?.data || {};
  const rand = randKleur(selected);
  const gestreept = !!d.discretionair; // = plan fragment / discretionary stage
  const vlak = React.useRef(null);
  const [maat, setMaat] = React.useState({ w: 220, h: 130 });
  React.useLayoutEffect(() => {
    const el = vlak.current;
    if (!el) return;
    const meet = () => setMaat({ w: el.clientWidth, h: el.clientHeight });
    meet();
    const ro = new ResizeObserver(meet);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // Achthoek, met de rand een halve lijndikte naar binnen zodat hij niet
  // half buiten de node valt.
  const m = 1;
  const { w, h } = maat;
  const pad = `M ${HOEK + m} ${m} H ${w - HOEK - m} L ${w - m} ${HOEK + m} V ${h - HOEK - m} L ${w - HOEK - m} ${h - m} H ${HOEK + m} L ${m} ${h - HOEK - m} V ${HOEK + m} Z`;
  return (
    <div
      ref={vlak}
      style={{
        width: "100%",
        height: "100%",
        minWidth: 220,
        minHeight: 130,
        position: "relative",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <svg width={w} height={h} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        <path
          d={pad}
          fill={d.kleur ? `${d.kleur}18` : "rgba(148,163,184,0.06)"}
          stroke={rand}
          strokeWidth="1.8"
          strokeDasharray={gestreept ? "6 4" : undefined}
          strokeLinejoin="round"
        />
      </svg>
      <div style={{ position: "relative", padding: "6px 20px 2px", fontSize: 12, fontWeight: 700, color: "var(--s-fg, #0f172a)", textAlign: "center", overflowWrap: "anywhere" }}>
        {element?.naam || "(stage)"}
      </div>
      <Markeringen data={d} />
      {children}
    </div>
  );
}

/** Type-icoontje linksboven in een task (viewBox 0 0 14 14). */
function TaakIcoon({ soort, kleur }) {
  const s = { stroke: kleur, strokeWidth: 1.2, fill: "none", strokeLinecap: "round", strokeLinejoin: "round" };
  switch (soort) {
    case "human":
      return (
        <g {...s}>
          <circle cx="7" cy="4.4" r="2.2" />
          <path d="M2.8 12c0-2.4 1.9-4 4.2-4s4.2 1.6 4.2 4" />
        </g>
      );
    case "proces":
      return <path {...s} d="M3 2.5 L10.5 7 L3 11.5 Z" />;
    case "case":
      return (
        <g {...s}>
          <path d="M2 4.2 V11.5 H12 V5.6 H7.2 L6 4.2 Z" />
        </g>
      );
    case "decision":
      return (
        <g {...s}>
          <rect x="2" y="3" width="10" height="8" rx="0.8" />
          <path d="M2 6 H12 M6 3 V11" />
        </g>
      );
    default:
      return null;
  }
}

/** Task: afgeronde rechthoek; gestreept = discretionair. */
function TaakShape({ element, selected, children }) {
  const d = element?.data || {};
  const rand = selected ? "var(--dc-selectie, #2563eb)" : "#7dd3fc";
  return (
    <div
      className="dc-node"
      style={{
        borderRadius: 12,
        border: `2px ${d.discretionair ? "dashed" : "solid"} ${rand}`,
        backgroundColor: d.kleur || "#e0f2fe",
        padding: "8px 12px 14px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
      }}
    >
      {d.soort ? (
        <svg width="14" height="14" viewBox="0 0 14 14" style={{ position: "absolute", top: 4, left: 5, pointerEvents: "none" }}>
          <TaakIcoon soort={d.soort} kleur={LIJN} />
        </svg>
      ) : null}
      <div style={{ fontSize: 12, fontWeight: 600, color: "#0f172a", textAlign: "center", lineHeight: 1.3, overflowWrap: "anywhere" }}>
        {element?.naam || "(task)"}
      </div>
      <Markeringen data={d} />
      {children}
    </div>
  );
}

/** Milestone: rechthoek met halfronde uiteinden (stadion). */
function MijlpaalShape({ element, selected, children }) {
  const d = element?.data || {};
  const rand = selected ? "var(--dc-selectie, #2563eb)" : "#a78bfa";
  return (
    <div
      className="dc-node"
      style={{
        // Halve hoogte als radius = halfronde uiteinden, ongeacht de maat.
        borderRadius: 999,
        border: `2px solid ${rand}`,
        backgroundColor: d.kleur || "#f3e8ff",
        padding: "8px 22px",
        minWidth: 150,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 600, color: "#0f172a", textAlign: "center", lineHeight: 1.3, overflowWrap: "anywhere" }}>
        {element?.naam || "(milestone)"}
      </div>
      {children}
    </div>
  );
}

/** Event listener: dubbele cirkel met klok (timer) of poppetje (user). */
function EventShape({ element, selected, children }) {
  const d = element?.data || {};
  const kleur = selected ? "var(--dc-selectie, #2563eb)" : LIJN;
  const s = { stroke: kleur, strokeWidth: 1.3, fill: "none", strokeLinecap: "round", strokeLinejoin: "round" };
  return (
    <div className="dc-punt-node" style={{ width: 32, height: 32, position: "relative", boxSizing: "border-box" }}>
      <svg width="32" height="32" viewBox="0 0 20 20" style={{ display: "block", pointerEvents: "none" }}>
        <circle cx="10" cy="10" r="9" fill={OPEN} stroke={kleur} strokeWidth="1.3" />
        <circle cx="10" cy="10" r="7.2" fill="none" stroke={kleur} strokeWidth="1.1" />
        {d.soort === "timer" && (
          <g {...s}>
            <circle cx="10" cy="10" r="4.2" />
            <path d="M10 7.4 V10 L11.9 11.4" />
          </g>
        )}
        {d.soort === "user" && (
          <g {...s}>
            <circle cx="10" cy="8.3" r="1.8" />
            <path d="M6.8 13.6c0-1.8 1.4-3 3.2-3s3.2 1.2 3.2 3" />
          </g>
        )}
      </svg>
      {children}
    </div>
  );
}

/** Case file item: dokje met omgevouwen hoek. */
function CaseFileShape({ element, selected, children }) {
  const kleur = selected ? "var(--dc-selectie, #2563eb)" : LIJN;
  return (
    <div style={{ width: 46, position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
      <svg width="30" height="38" viewBox="0 0 30 38" style={{ display: "block", pointerEvents: "none" }}>
        <path d="M2 2 H20 L28 10 V36 H2 Z" fill={OPEN} stroke={kleur} strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M20 2 V10 H28" fill="none" stroke={kleur} strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
      {children}
    </div>
  );
}

/**
 * Sentry: de ruit op de rand. Open = entry criterion (wanneer mag dit
 * beginnen), gevuld = exit criterion (wanneer stopt dit).
 */
function SentryShape({ element, selected, children }) {
  const d = element?.data || {};
  const kleur = selected ? "var(--dc-selectie, #2563eb)" : LIJN;
  const gevuld = d.soort === "exit";
  return (
    <div className="dc-punt-node" style={{ width: 18, height: 24, position: "relative", boxSizing: "border-box" }}>
      <svg width="18" height="24" viewBox="0 0 18 24" style={{ display: "block", pointerEvents: "none" }}>
        <path
          d="M9 1 L17 12 L9 23 L1 12 Z"
          fill={gevuld ? kleur : OPEN}
          stroke={kleur}
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
      </svg>
      {children}
    </div>
  );
}

let _geregistreerd = false;
export function registreerCmmnShapes() {
  if (_geregistreerd) return;
  registreerShape("cmmn-caseplan", CasePlanShape);
  registreerShape("cmmn-stage", StageShape);
  registreerShape("cmmn-taak", TaakShape);
  registreerShape("cmmn-mijlpaal", MijlpaalShape);
  registreerShape("cmmn-event", EventShape);
  registreerShape("cmmn-casefile", CaseFileShape);
  registreerShape("cmmn-sentry", SentryShape);
  _geregistreerd = true;
}
