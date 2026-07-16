/**
 * icons — kleine inline SVG-iconen voor de Studio activity bar.
 * Eén stijl (currentColor, stroke), zodat thema-kleuren automatisch volgen.
 * Uitbreidbaar: voeg een nieuw icoon toe en gebruik het in een activiteit-descriptor.
 */
import React from "react";

const base = {
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

/** Modelleren: projectbrowser-boom met diagramknopen (fase 2-tab-host). */
export const IconModelleren = (p) => (
  <svg {...base} {...p}>
    <path d="M5 3v18" />
    <path d="M5 8h4M5 15h4" />
    <rect x="11" y="5" width="9" height="6" rx="1" />
    <rect x="11" y="13" width="9" height="6" rx="1" />
  </svg>
);

/** State machine: begin-stip → toestand → eind, met transities. */
export const IconStateMachine = (p) => (
  <svg {...base} {...p}>
    <circle cx="4" cy="6" r="1.6" fill="currentColor" stroke="none" />
    <rect x="9" y="3.5" width="11" height="5" rx="2.5" />
    <rect x="4" y="15" width="11" height="5" rx="2.5" />
    <path d="M6 7.5l3 -0.5M13 8.5v6" />
  </svg>
);

/** Koppelingen: twee werelden met een trace-link ertussen. */
export const IconKoppeling = (p) => (
  <svg {...base} {...p}>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
    <path d="M10 10l4 4" strokeDasharray="2.5 2" />
  </svg>
);

export const IconUML = (p) => (
  <svg {...base} {...p}>
    <rect x="3" y="3" width="8" height="6" rx="1" />
    <rect x="13" y="15" width="8" height="6" rx="1" />
    <path d="M7 9v3a2 2 0 0 0 2 2h4" />
  </svg>
);

export const IconDMN = (p) => (
  <svg {...base} {...p}>
    <rect x="3" y="4" width="18" height="16" rx="1.5" />
    <path d="M3 9h18M9 4v16M15 9v11" />
  </svg>
);

export const IconBPMN = (p) => (
  <svg {...base} {...p}>
    <circle cx="4.5" cy="12" r="2" />
    <rect x="9" y="9" width="6" height="6" rx="1" />
    <circle cx="19.5" cy="12" r="2" />
    <path d="M6.5 12H9M15 12h2.5" />
  </svg>
);

export const IconBericht = (p) => (
  <svg {...base} {...p}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m3 7 9 6 9-6" />
  </svg>
);

export const IconAPI = (p) => (
  <svg {...base} {...p}>
    <path d="M8 3 4 7l4 4M16 3l4 4-4 4" />
    <path d="M14 4 10 20" />
  </svg>
);

export const IconToegang = (p) => (
  <svg {...base} {...p}>
    <circle cx="8" cy="8" r="3" />
    <path d="M11 11l6 6M14 14l2-2 2 2-2 2zM17 17l1 3" />
  </svg>
);

export const IconRollen = (p) => (
  <svg {...base} {...p}>
    <circle cx="9" cy="8" r="3" />
    <path d="M3 20a6 6 0 0 1 12 0" />
    <path d="M16 11a3 3 0 1 0-1-5.8M21 20a6 6 0 0 0-5-5.9" />
  </svg>
);

export const IconReferentielijst = (p) => (
  <svg {...base} {...p}>
    <path d="M8 6h12M8 12h12M8 18h12" />
    <path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
  </svg>
);

/* Diagrammen (0.5): drie verbonden element-boxen — de generieke diagram-motor. */
export const IconDiagram = (p) => (
  <svg {...base} {...p}>
    <rect x="3" y="3" width="7" height="5" rx="1" />
    <rect x="14" y="3" width="7" height="5" rx="1" />
    <rect x="14" y="16" width="7" height="5" rx="1" />
    <path d="M10 5.5h4M6.5 8v8a2.5 2.5 0 0 0 2.5 2.5h5" />
  </svg>
);

/* ── 0.5-familie (vormgevingssessie 2026-07-05, agendapunt 7) ─────────────
   Elk 0.5-profiel draagt zijn familie-embleem: het kenmerkende taakbalk-
   icoon uit diagramcore/shapes/iconenVocabulaire.jsx, hertekend op het
   24-raster. Familiekenmerk: precies één gevuld vlak in currentColor —
   klassieke activiteiten blijven puur outline (gevuld = 0.5). */
const vul = { fill: "currentColor", stroke: "none" };

/* Diagrammen (0.5): mini-datamodel, accent = compositie-ruit ◆. */
export const IconDiagram05 = (p) => (
  <svg {...base} {...p}>
    <rect x="3" y="3" width="9" height="7" rx="1" />
    <line x1="3" y1="6" x2="12" y2="6" />
    <rect x="14" y="15" width="7" height="6" rx="1" />
    <path d="M7.5 10v5.5a2.5 2.5 0 0 0 2.5 2.5h0.8" />
    <path d="M14 18 12.4 16.6 10.8 18 12.4 19.4Z" {...vul} />
  </svg>
);

/* UML (0.5): klasse met gevulde kopbalk + open generalisatie-driehoek ▷. */
export const IconUML05 = (p) => (
  <svg {...base} {...p}>
    <rect x="3" y="3" width="11" height="9" rx="1" />
    <path d="M3 6.5V4a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v2.5Z" {...vul} />
    <line x1="5" y1="9.5" x2="11" y2="9.5" />
    <line x1="4.5" y1="19" x2="13.5" y2="19" />
    <path d="M13.5 15.8 19.5 19 13.5 22.2Z" />
  </svg>
);

/* OAS (0.5): schema-accolade, accent = de property-keys. */
export const IconOAS05 = (p) => (
  <svg {...base} {...p}>
    <path d="M9.5 3.5c-2.7 0-1.3 5.4-4.2 8 2.9 2.6 1.5 8 4.2 8" />
    <circle cx="13" cy="9" r="1.4" {...vul} />
    <line x1="16" y1="9" x2="20.5" y2="9" />
    <circle cx="13" cy="15" r="1.4" {...vul} />
    <line x1="16" y1="15" x2="20.5" y2="15" />
  </svg>
);

/* Profiel (0.5): register van gestapelde kaders, accent = de naam-tab. */
export const IconProfiel05 = (p) => (
  <svg {...base} {...p}>
    <path d="M8 6V4.5A1.5 1.5 0 0 1 9.5 3h10A1.5 1.5 0 0 1 21 4.5v10a1.5 1.5 0 0 1-1.5 1.5H18" />
    <rect x="3" y="7" width="14" height="13" rx="1.5" />
    <path d="M3 11.5V8.5A1.5 1.5 0 0 1 4.5 7H9v4.5Z" {...vul} />
  </svg>
);

/* MIM (0.5): de vormgrammatica in het klein — objecttype (scherpe rechthoek
   met dikke rand = identiteit) + waarde-chip (accent, gevuld). */
export const IconMIM05 = (p) => (
  <svg {...base} {...p}>
    <rect x="3" y="3" width="12" height="8.5" rx="1" strokeWidth="2.4" />
    <line x1="5.5" y1="6.6" x2="12.5" y2="6.6" />
    <path d="M9 11.5v3.5a2.5 2.5 0 0 0 2.5 2.5h0.5" />
    <rect x="12" y="14.8" width="9" height="6.2" rx="3.1" {...vul} />
  </svg>
);

/* Profiel-ontwerp (0.5): elementtype-stencil (gevuld sjabloonblok) + afgeleide. */
export const IconProfielOntwerp05 = (p) => (
  <svg {...base} {...p}>
    <rect x="3.5" y="3" width="13" height="10.5" rx="1" />
    <rect x="6" y="5.5" width="5" height="3.5" rx="0.7" {...vul} />
    <line x1="6" y1="11" x2="14" y2="11" />
    <line x1="10" y1="13.5" x2="10" y2="16.5" />
    <rect x="6.5" y="16.5" width="7" height="4.5" rx="0.8" />
  </svg>
);

/**
 * OmniumMark — het productmerk-logo (de "O" als orbit met facet-knooppunten rond
 * een centrale hub). Eigen kleurstijl (gradient-spectrum), los van de currentColor-
 * iconenset, zodat het merk altijd herkenbaar blijft. Gebruikt in de menubalk.
 */
export const OmniumMark = ({ size = 22, ...p }) => (
  <svg viewBox="0 0 48 48" width={size} height={size} role="img" aria-label="Omnium Studio" {...p}>
    <defs>
      <linearGradient id="om-ring-studio" x1="6" y1="6" x2="42" y2="42" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#60a5fa" />
        <stop offset="0.5" stopColor="#6366f1" />
        <stop offset="1" stopColor="#22d3ee" />
      </linearGradient>
      <linearGradient id="om-hub-studio" x1="18" y1="18" x2="30" y2="30" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#a5b4fc" />
        <stop offset="1" stopColor="#38bdf8" />
      </linearGradient>
    </defs>
    <circle cx="24" cy="24" r="18" fill="none" stroke="url(#om-ring-studio)" strokeWidth="3" />
    <circle cx="24" cy="6" r="3.4" fill="#3b82f6" />
    <circle cx="39.59" cy="15" r="3.4" fill="#6366f1" />
    <circle cx="39.59" cy="33" r="3.4" fill="#8b5cf6" />
    <circle cx="24" cy="42" r="3.4" fill="#22d3ee" />
    <circle cx="8.41" cy="33" r="3.4" fill="#0ea5e9" />
    <circle cx="8.41" cy="15" r="3.4" fill="#38bdf8" />
    <rect x="19.5" y="19.5" width="9" height="9" rx="2.2" transform="rotate(45 24 24)" fill="url(#om-hub-studio)" />
  </svg>
);

// Tandwiel: kern + ring + korte dikke tanden op de ring (dunne lange
// spaken lazen als zon).
export const IconInstellingen = (p) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="2.6" />
    <circle cx="12" cy="12" r="5.8" />
    <g strokeWidth="3.2">
      <path d="M12 3.4v1.4M12 19.2v1.4M3.4 12h1.4M19.2 12h1.4M5.9 5.9l1 1M17.1 17.1l1 1M5.9 18.1l1-1M17.1 6.9l1-1" />
    </g>
  </svg>
);

/** Formulieren: een formulier met velden en een invulregel. */
export const IconFormulier = (p) => (
  <svg {...base} {...p}>
    <rect x="4" y="3" width="16" height="18" rx="2" />
    <path d="M8 8h8M8 12h8M8 16h4" />
  </svg>
);

export const IconChevronLeft = (p) => (
  <svg {...base} width={16} height={16} {...p}>
    <path d="m15 18-6-6 6-6" />
  </svg>
);

export const IconChevronRight = (p) => (
  <svg {...base} width={16} height={16} {...p}>
    <path d="m9 18 6-6-6-6" />
  </svg>
);
