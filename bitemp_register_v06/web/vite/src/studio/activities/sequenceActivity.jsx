/**
 * sequenceActivity — "Sequence": UML sequence-diagrammen op de generieke
 * motor (v0: levenslijnen met punten/activaties via het rand-primitief,
 * sync/async/retour-berichten, alt/opt/loop/par-fragmenten). Descriptor +
 * fabriek, verder niets — zie diagramprofielen/sequence/.
 */
import { IconSequence } from "../icons";
import { registreerSequence, sequenceDiagramType, maakElement } from "../../diagramprofielen/sequence/index.js";
import { maakDiagramActiviteit } from "./maakDiagramActiviteit.jsx";

registreerSequence();

export default maakDiagramActiviteit({
  id: "sequence05",
  label: "Sequence",
  icon: <IconSequence />,
  descriptor: sequenceDiagramType,
  maakElement,
  persistKey: "studio05-sequence",
  taakbalkSleutel: "studio05-taakbalken-sequence",
  menuPrefix: "sq05",
  menuLabel: "Sequence",
  kleur: "#f43f5e",
  standaardVerborgen: true, // preview-profiel; via Modelleren + instellingen bereikbaar
  previewTekst: "UML sequence (v0) — levenslijnen met punten/activaties op het rand-primitief; volgorde = y-positie.",
  devHookNaam: "__sequence05Store",
});
