/**
 * LineageDemoPage — stap 6 van de "driehoek proces – regels – data".
 *
 * Demonstreert de read-only lineage-view. We bouwen een lineage-index uit een
 * representatieve set artefacten (een DMN-beslistabel, een berichttype, twee
 * BPMN-events en een procescontract) die — net als in de echte editors —
 * allemaal hun velden uit het canoniek model halen. De view leidt daaruit de
 * herkomst/impact af zonder extra invoer.
 *
 * Route: /lineage-demo (zie App.jsx)
 */
import { useMemo } from "react";
import { LineageView, bouwLineageIndex } from "../lineage";

// Gedeelde canonieke velden (FieldRef-vorm).
const bsn = { typenaam: "NP_Naam_Data", veldnaam: "bsn", veldpad: "NatuurlijkPersoon.namen.bsn" };
const voornaam = { typenaam: "NP_Naam_Data", veldnaam: "voornaam", veldpad: "NatuurlijkPersoon.namen.voornaam" };
const achternaam = { typenaam: "NP_Naam_Data", veldnaam: "achternaam", veldpad: "NatuurlijkPersoon.namen.achternaam" };
const geboortedatum = { typenaam: "NP_Geboorte_Data", veldnaam: "geboortedatum", veldpad: "NatuurlijkPersoon.geboorte.geboortedatum" };
const besluit = { typenaam: "Aanmelding", veldnaam: "besluit", veldpad: "Aanmelding.besluit" };

// Een representatieve set artefacten — exact de vormen die de eerdere editors
// produceren (zie lineageIndex.js voor de verwachte vorm per soort).
const ARTEFACTEN = [
  {
    soort: "dmn",
    naam: "BepaalToelating",
    inputs: [{ fieldRef: geboortedatum }, { fieldRef: bsn }],
    outputs: [{ fieldRef: besluit }],
  },
  {
    soort: "bericht",
    naam: "InwonerAanmelding",
    velden: [{ ref: bsn }, { ref: voornaam }, { ref: achternaam }, { ref: geboortedatum }],
  },
  { soort: "bpmn-event", naam: "Aanmelding ontvangen", kind: "message", velden: [bsn, voornaam, achternaam] },
  { soort: "bpmn-event", naam: "Besluit gepubliceerd", kind: "signal", velden: [besluit] },
  {
    soort: "contract",
    naam: "Beoordeel aanmelding",
    isCall: true,
    input: { velden: [{ ref: bsn }, { ref: geboortedatum }] },
    output: { velden: [{ ref: besluit }] },
  },
];

export default function LineageDemoPage() {
  const index = useMemo(() => bouwLineageIndex(ARTEFACTEN), []);

  return (
    <div style={{ height: "100vh", boxSizing: "border-box", padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
      <div>
        <h2 style={{ margin: "0 0 2px", fontSize: 16 }}>Lineage — proces ↔ regels ↔ data</h2>
        <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>
          Eén DMN-beslistabel, één berichttype, twee events en één procescontract — allemaal gebonden aan het canoniek
          model. Kies links een veld: rechts zie je elke regel, payload en contract die het raakt, plus de artefacten
          die er via een gedeeld veld aan vasthangen.
        </p>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <LineageView index={index} />
      </div>
    </div>
  );
}
