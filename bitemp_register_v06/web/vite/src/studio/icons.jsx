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
