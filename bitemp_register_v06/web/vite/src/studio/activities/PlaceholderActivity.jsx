/**
 * maakPlaceholderActiviteit — fabriek voor nog-te-bouwen activiteiten.
 *
 * Levert meteen de uniforme drie-slot-structuur (Sidebar / Main / Inspector) zodat
 * een nieuwe functie direct dezelfde UX heeft. De inhoud is een vriendelijke
 * "concept"-placeholder; later vervang je Sidebar/Main/Inspector door echte
 * componenten zonder dat de shell verandert.
 */
import React from "react";

export function maakPlaceholderActiviteit({
  id,
  label,
  icon,
  groep,
  sidebarLabel = "Verkenner",
  inspectorLabel = "Eigenschappen",
  toelichting = "Deze functie is nog in ontwerp.",
  voorbeeldItems = [],
}) {
  function Sidebar() {
    return (
      <ul className="studio-list">
        {voorbeeldItems.length === 0 && (
          <li style={{ cursor: "default", color: "var(--s-fg-muted)" }}>— geen items —</li>
        )}
        {voorbeeldItems.map((it) => (
          <li key={it}>{it}</li>
        ))}
      </ul>
    );
  }

  function Main() {
    return (
      <div className="studio-placeholder">
        <span className="studio-placeholder__badge">concept</span>
        <h2>{label}</h2>
        <p>{toelichting}</p>
        <p style={{ color: "var(--s-fg-muted)" }}>
          De werkbank-structuur (links een verkenner, rechts een eigenschappen-paneel)
          staat al klaar. Vul Sidebar / Main / Inspector in om deze functie te bouwen.
        </p>
      </div>
    );
  }

  function Inspector() {
    return (
      <div className="studio-inspector-pad" style={{ color: "var(--s-fg-muted)" }}>
        Selecteer een item in de verkenner om de eigenschappen te zien.
      </div>
    );
  }

  return {
    id,
    label,
    icon,
    groep,
    Sidebar,
    Main,
    Inspector,
    sidebarLabel,
    inspectorLabel,
    status: "concept",
  };
}
