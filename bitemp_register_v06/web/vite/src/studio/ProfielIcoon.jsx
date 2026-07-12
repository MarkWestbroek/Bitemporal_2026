/**
 * ProfielIcoon — toont het gezicht van een profieltype: het embleem uit de
 * stijl-override (Studio-instellingen → Profieltypen) als dat er is, anders
 * het code-default icoon uit de descriptor. Overal gebruiken waar een
 * profieltype visueel herkenbaar moet zijn (projectbrowser, tabs,
 * instellingen), zodat een override meteen overal doorwerkt.
 */
import React from "react";
import { effectieveStijl } from "./profieltypeRegistry";

export default function ProfielIcoon({ profiel }) {
  const { embleem } = effectieveStijl(profiel);
  if (embleem) {
    return (
      <span
        className="studio-profiel-embleem"
        style={{ fontSize: embleem.length > 1 ? 10 : 13 }}
        aria-hidden
      >
        {embleem}
      </span>
    );
  }
  return profiel.icon;
}
