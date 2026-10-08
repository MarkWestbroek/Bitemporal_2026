/**
 * puurUmlActivity — "UML (0.5)": het puur-UML-profiel (klassediagrammen) op
 * de generieke diagram-motor. Fase 5-lakmoesproef: dit bestand is bewust
 * niet meer dan een descriptor + een fabriek-aanroep — geen koppeling met
 * het canonieke model, geen serialisatie, geen eigen componenten.
 */
import { IconUML05 } from "../icons";
import { registreerPuurUml, puurUmlDiagramType, maakElement, operatiesVan } from "../../diagramprofielen/puur-uml/index.js";
import { maakDiagramActiviteit } from "./maakDiagramActiviteit.jsx";
import { importeerQeaAlsPuurUml } from "../../diagramprofielen/ea/importQea.js";

registreerPuurUml();

export default maakDiagramActiviteit({
  id: "puurUml05",
  label: "UML",
  icon: <IconUML05 />,
  descriptor: puurUmlDiagramType,
  maakElement,
  persistKey: "studio05-puur-uml",
  taakbalkSleutel: "studio05-taakbalken-puur-uml",
  menuPrefix: "u05",
  menuLabel: "UML",
  kleur: "#60a5fa",
  standaardVerborgen: true, // gedekt door de Modelleren-host
  previewTekst: "Puur UML-klassediagram — tweede profiel (fase 5-lakmoesproef), lege sandbox.",
  devHookNaam: "__puurUml05Store",
  // OperatieResolver: operaties-compartiment van klassen/interfaces.
  operatiesVan,
  koppeling: {
    /** Sparx EA-repository (.qea = SQLite) → puur-uml, één pakket met deelpakketten. */
    importBestand: {
      label: "Importeer Sparx EA (.qea) — alleen dit profiel…",
      accept: ".qea,.qeax",
      binair: true,
      verwerk: (bytes, bestandsnaam) => importeerQeaAlsPuurUml(bytes, bestandsnaam),
    },
  },
});
