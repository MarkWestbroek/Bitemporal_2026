/**
 * Toegangsregel-shapes — de vormentaal uit het ontwerp-antwoord op de
 * designbrief (docs/plans/2026-07-25 … vormentaal (ontwerp-antwoord).md).
 *
 * Leidend idee: het diagram is de Toegangsspraak-zin, elk zinsdeel krijgt
 * een silhouet dat zijn rol naspeelt — herkenbaar zónder kleurkennis:
 *
 *   tr-kaft         Policy: kopkaart met boekrug (dikke gevulde linkerband)
 *   tr-regelkaart   Toegangsregel: kaart met modaliteitsband; "mag niet" =
 *                   diagonaal gearceerde band + ⃠ + tekst (nooit alleen rood)
 *   tr-badge        Subject: naambadge met clip-inkeping + persoon
 *   tr-pijlblok     Handeling: chevron — het werkwoord duwt de zin vooruit
 *   tr-cilinder     Gegevensselectie: gegevenscilinder, ▦ bij cross-profiel
 *   tr-poort        Voorwaardepoort: ruit met + / ○ / × (BPMN-taal) + naam
 *   tr-vergelijking Voorwaarde: strook "links · teken · rechts"
 *   tr-vaandel      Plicht: wimpel met zwaluwstaart + ⚑
 *   tr-tag          Begrip: label met oogje, gestippeld (referentie)
 *
 * Map gebruikt de bestaande `package`-hangmap. Kleuren blijven het
 * ontledingspalet (KLEUREN in index.js); de vorm is de eerste laag.
 * `children` bevat de React Flow-handles — altijd renderen.
 */
import React from "react";
import { registreerShape } from "../../diagramcore/shapes/shapeRegistry.js";

const randKleur = (selected) =>
  selected ? "var(--dc-selectie, #2563eb)" : "var(--dc-node-rand, #94a3b8)";
const vulKleur = (element, elementType, fallback) =>
  element?.data?.kleur || elementType?.kleur || fallback || "var(--dc-node-vulling, #f1f5f9)";

/** Naam-regel (gedeeld): vet, gecentreerd, afgekapt. */
function Naam({ element, maat = 12.5, kleur = "#0f172a", stijl }) {
  return (
    <div
      style={{
        fontSize: maat,
        fontWeight: 700,
        color: kleur,
        textAlign: "center",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        ...stijl,
      }}
    >
      {element?.naam || "(naamloos)"}
    </div>
  );
}

/** Policy: kopkaart met boekrug — het beleid als kaft om de regels. */
function KaftShape({ element, elementType, selected, children }) {
  const rand = randKleur(selected);
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        minWidth: 170,
        minHeight: 54,
        border: `1.5px solid ${rand}`,
        borderRadius: 4,
        background: vulKleur(element, elementType, "#e0e7ff"),
        position: "relative",
        display: "flex",
        alignItems: "center",
        cursor: "grab",
        boxShadow: "0 1px 4px rgba(0, 0, 0, 0.1)",
      }}
    >
      {children}
      {/* De rug: dikke gevulde band, silhouet-kenmerk van de kaft. */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 9,
          borderRadius: "3px 0 0 3px",
          background: "#a5b4fc",
          borderRight: `1.5px solid ${rand}`,
        }}
      />
      <div style={{ flex: 1, padding: "6px 10px 6px 19px", minWidth: 0 }}>
        <Naam element={element} />
        {(element?.data?.geldigVanaf || element?.data?.doel) && (
          <div style={{ fontSize: 9.5, color: "#475569", textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {[element.data.geldigVanaf && `vanaf ${element.data.geldigVanaf}`, element.data.doel]
              .filter(Boolean)
              .join(" · ")}
          </div>
        )}
      </div>
    </div>
  );
}

/** Verbods-arcering (SVG-pattern per node, id-loos via inline data-URI kan
 *  niet met currentColor — dus een klein herhaald lineair patroon in CSS). */
const ARCERING = {
  backgroundImage:
    "repeating-linear-gradient(45deg, #fecaca 0 3px, #dc2626 3px 5px)",
};

/** Toegangsregel: kaart met modaliteitsband. Vorm draagt het verbod. */
function RegelkaartShape({ element, elementType, selected, children }) {
  const rand = randKleur(selected);
  const verbod = /niet|verbod/i.test(element?.data?.modaliteit || "");
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        minWidth: 180,
        minHeight: 54,
        border: `1.5px solid ${rand}`,
        borderRadius: 10,
        background: vulKleur(element, elementType, "#ffffff"),
        position: "relative",
        cursor: "grab",
        boxShadow: "0 1px 4px rgba(0, 0, 0, 0.1)",
        overflow: "hidden",
      }}
    >
      {children}
      {/* Modaliteitsband: effen groen (mag) of gearceerd rood (mag niet). */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 11,
          background: verbod ? undefined : "#16a34a",
          ...(verbod ? ARCERING : {}),
          borderRight: `1px solid ${verbod ? "#dc2626" : "#15803d"}`,
        }}
      />
      <div style={{ padding: "5px 10px 6px 20px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 5,
            fontSize: 9.5,
            fontWeight: 700,
            color: verbod ? "#b91c1c" : "#15803d",
          }}
        >
          {verbod && (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#dc2626" strokeWidth="1.6" strokeLinecap="round">
              <circle cx="6" cy="6" r="4.6" />
              <line x1="2.9" y1="9.1" x2="9.1" y2="2.9" />
            </svg>
          )}
          {verbod ? "mag niet" : "mag"}
        </div>
        <Naam element={element} />
      </div>
    </div>
  );
}

/** Subject: naambadge — clip-inkeping middenboven + persoon-icoon. */
function BadgeShape({ element, elementType, selected, children }) {
  const rand = randKleur(selected);
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        minWidth: 160,
        minHeight: 48,
        border: `1.5px solid ${rand}`,
        borderRadius: 11,
        background: vulKleur(element, elementType),
        position: "relative",
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 10px 6px 8px",
        cursor: "grab",
        boxShadow: "0 1px 4px rgba(0, 0, 0, 0.1)",
      }}
    >
      {children}
      {/* De clip van het pasje. */}
      <div
        style={{
          position: "absolute",
          top: -4,
          left: "50%",
          transform: "translateX(-50%)",
          width: 20,
          height: 7,
          borderRadius: 4,
          background: "var(--dc-canvas-achtergrond, #ffffff)",
          border: `1.3px solid ${rand}`,
        }}
      />
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#475569" strokeWidth="1.4" style={{ flexShrink: 0 }}>
        <circle cx="9" cy="6.2" r="3.1" />
        <path d="M3.2 15a5.8 5.8 0 0 1 11.6 0" />
      </svg>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Naam element={element} maat={12} />
      </div>
    </div>
  );
}

/** Handeling: pijlblok (chevron) — twee geknipte lagen voor de rand. */
function PijlblokShape({ element, elementType, selected, children }) {
  const rand = randKleur(selected);
  const PUNT = 14;
  const knip = (p) => `polygon(0 0, calc(100% - ${p}px) 0, 100% 50%, calc(100% - ${p}px) 100%, 0 100%)`;
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        minWidth: 130,
        minHeight: 44,
        position: "relative",
        cursor: "grab",
        filter: "drop-shadow(0 1px 3px rgba(0, 0, 0, 0.12))",
      }}
    >
      {children}
      <div style={{ position: "absolute", inset: 0, clipPath: knip(PUNT), background: rand }} />
      <div
        style={{
          position: "absolute",
          inset: 1.5,
          clipPath: knip(PUNT - 1),
          background: vulKleur(element, elementType),
        }}
      />
      <div
        style={{
          position: "relative",
          zIndex: 1,
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: `0 ${PUNT + 8}px 0 10px`,
        }}
      >
        <Naam element={element} maat={12} />
      </div>
    </div>
  );
}

/** Gegevensselectie: cilinder; ▦-badge zodra er een verwijzing is. */
function CilinderShape({ element, elementType, selected, children }) {
  const rand = randKleur(selected);
  const vulling = vulKleur(element, elementType);
  const verwijst = !!(element?.data?.verwijzingselement || element?.data?.verwijzingsprofiel);
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        minWidth: 140,
        minHeight: 56,
        position: "relative",
        cursor: "grab",
        filter: "drop-shadow(0 1px 3px rgba(0, 0, 0, 0.12))",
      }}
    >
      {children}
      <svg viewBox="0 0 180 70" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible" }}>
        <path
          d="M2 11v48a88 9 0 0 0 176 0V11"
          fill={vulling}
          stroke={rand}
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
        />
        <ellipse cx="90" cy="11" rx="88" ry="9" fill={vulling} stroke={rand} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      </svg>
      {verwijst && (
        <svg
          width="13"
          height="13"
          viewBox="0 0 13 13"
          fill="none"
          stroke="#475569"
          strokeWidth="1.1"
          style={{ position: "absolute", top: 8, right: 7 }}
          aria-label="verwijst cross-profiel"
        >
          <rect x="1" y="1" width="11" height="11" rx="1.5" fill="var(--dc-canvas-achtergrond, #ffffff)" />
          <path d="M1 6.5h11M6.5 1v11" />
        </svg>
      )}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "12px 14px 4px",
        }}
      >
        <Naam element={element} maat={12} />
      </div>
    </div>
  );
}

/** Symbool per poortsoort (BPMN-taal): alle = +, ten minste één = ○, precies één = ×. */
function poortSymbool(soort) {
  const s = (soort || "").toLowerCase();
  if (s.includes("minste") || s.includes("≥")) return "○";
  if (s.includes("precies") || s.includes("één van") || s.includes("xof")) return "×";
  return "+";
}

/** Voorwaardepoort: ruit met symbool, naam eronder. Ruit blijft vierkant. */
function PoortShape({ element, elementType, selected, children }) {
  const rand = selected ? "var(--dc-selectie, #2563eb)" : "#9333ea";
  const soort = element?.data?.soort || "alle";
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        minWidth: 96,
        minHeight: 76,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 3,
        position: "relative",
        cursor: "grab",
      }}
    >
      {children}
      <svg width="44" height="44" viewBox="0 0 44 44" style={{ flexShrink: 0, filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.12))" }}>
        <path d="M22 2 42 22 22 42 2 22Z" fill={vulKleur(element, elementType, "#ecdcf7")} stroke={rand} strokeWidth="1.6" strokeLinejoin="round" />
        <text x="22" y="28.5" textAnchor="middle" fontSize="19" fontWeight="700" fill="#6b21a8">
          {poortSymbool(soort)}
        </text>
      </svg>
      <div style={{ fontSize: 9.5, fontWeight: 600, color: "#7e22ce" }}>{soort}</div>
    </div>
  );
}

/** Voorwaarde: vergelijkingsstrook — links · teken · rechts (of de naam). */
function VergelijkingShape({ element, elementType, selected, children }) {
  const rand = randKleur(selected);
  const d = element?.data || {};
  const heeftDelen = d.links || d.rechts;
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        minWidth: 150,
        minHeight: 34,
        border: `1.3px solid ${rand}`,
        borderRadius: 999,
        background: vulKleur(element, elementType, "#ecdcf7"),
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 7,
        padding: "3px 16px",
        cursor: "grab",
        fontSize: 11,
        color: "#1e293b",
      }}
    >
      {children}
      {heeftDelen ? (
        <>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.links}</span>
          <span style={{ fontWeight: 700, color: "#6b21a8", flexShrink: 0 }}>{d.vergelijking || "="}</span>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.rechts}</span>
        </>
      ) : (
        <Naam element={element} maat={11.5} />
      )}
    </div>
  );
}

/** Plicht: vaandel — zwaluwstaart rechts + ⚑. */
function VaandelShape({ element, elementType, selected, children }) {
  const rand = randKleur(selected);
  const STAART = 12;
  const knip = (p) => `polygon(0 0, 100% 0, calc(100% - ${p}px) 50%, 100% 100%, 0 100%)`;
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        minWidth: 140,
        minHeight: 44,
        position: "relative",
        cursor: "grab",
        filter: "drop-shadow(0 1px 3px rgba(0, 0, 0, 0.12))",
      }}
    >
      {children}
      <div style={{ position: "absolute", inset: 0, clipPath: knip(STAART), background: rand }} />
      <div style={{ position: "absolute", inset: 1.5, clipPath: knip(STAART - 1), background: vulKleur(element, elementType) }} />
      <div
        style={{
          position: "relative",
          zIndex: 1,
          height: "100%",
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: `0 ${STAART + 8}px 0 10px`,
        }}
      >
        <svg width="14" height="15" viewBox="0 0 14 15" fill="none" stroke="#0f766e" strokeWidth="1.5" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <path d="M3 14V1.5l8 3-8 3" />
        </svg>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Naam element={element} maat={12} />
        </div>
      </div>
    </div>
  );
}

/** Begrip: label/tag met oogje — gestippeld (herbruikbare definitie). */
function TagShape({ element, elementType, selected, children }) {
  const rand = randKleur(selected);
  const vulling = vulKleur(element, elementType, "#e2e8f0");
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        minWidth: 150,
        minHeight: 40,
        position: "relative",
        display: "flex",
        alignItems: "center",
        cursor: "grab",
      }}
    >
      {children}
      {/* De punt van het label: geroteerd vierkant met gestippelde randen. */}
      <div
        style={{
          position: "absolute",
          left: 3,
          top: "50%",
          width: 22,
          height: 22,
          transform: "translateY(-50%) rotate(45deg)",
          background: vulling,
          borderLeft: `1.4px dashed ${rand}`,
          borderBottom: `1.4px dashed ${rand}`,
          borderRadius: 3,
        }}
      />
      <div
        style={{
          position: "relative",
          flex: 1,
          height: "100%",
          marginLeft: 13,
          border: `1.4px dashed ${rand}`,
          borderLeft: "none",
          borderRadius: "0 8px 8px 0",
          background: vulling,
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "4px 10px 4px 10px",
        }}
      >
        <span
          style={{
            width: 5.5,
            height: 5.5,
            borderRadius: "50%",
            border: "1.3px solid #64748b",
            flexShrink: 0,
          }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <Naam element={element} maat={11.5} />
        </div>
      </div>
    </div>
  );
}

let _geregistreerd = false;

/** Registreer de vormentaal (idempotent; aangeroepen door het profiel). */
export function registreerToegangsregelShapes() {
  if (_geregistreerd) return;
  _geregistreerd = true;
  registreerShape("tr-kaft", KaftShape);
  registreerShape("tr-regelkaart", RegelkaartShape);
  registreerShape("tr-badge", BadgeShape);
  registreerShape("tr-pijlblok", PijlblokShape);
  registreerShape("tr-cilinder", CilinderShape);
  registreerShape("tr-poort", PoortShape);
  registreerShape("tr-vergelijking", VergelijkingShape);
  registreerShape("tr-vaandel", VaandelShape);
  registreerShape("tr-tag", TagShape);
}
