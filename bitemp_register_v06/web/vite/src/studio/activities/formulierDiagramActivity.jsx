/**
 * formulierDiagramActivity — "Formulier (diagram)": de FormulierDefinitie-layout
 * op de generieke diagram-motor (F48 P1, dogfood). Descriptor + fabriek; zie
 * diagramprofielen/formulier/.
 *
 * P1 = projectie: "Herlaad uit model" haalt de definitie die in de
 * Formulieren-activiteit geladen is (useFormulierEditorStore) en toont die als
 * diagram — letterlijk een tweede control op hetzelfde model. Terugschrijven
 * (publiceren naar het register) is P2.
 */
import { IconFormulier } from "../icons";
import {
  registreerFormulierProfiel,
  formulierDiagramType,
  maakElement,
} from "../../diagramprofielen/formulier/index.js";
import { layoutNaarFormulierModel } from "../../diagramprofielen/formulier/adapter.js";
import { serializeLayout } from "../../formuliereditor/layoutModel.js";
import { useFormulierEditorStore } from "../../formuliereditor/useFormulierEditorStore.js";
import { maakDiagramActiviteit } from "./maakDiagramActiviteit.jsx";

registreerFormulierProfiel();

export default maakDiagramActiviteit({
  id: "formulierdiagram",
  label: "Formulier (diagram)",
  icon: <IconFormulier />,
  descriptor: formulierDiagramType,
  maakElement,
  persistKey: "studio05-formulierdiagram",
  taakbalkSleutel: "studio05-taakbalken-formulierdiagram",
  menuPrefix: "fd05",
  menuLabel: "Formulier-diagram",
  kleur: "#8b5cf6",
  standaardVerborgen: true, // bereikbaar via Ga naar / Modelleren; geen extra balk-icoon
  previewTekst:
    "FormulierDefinitie als diagram (dogfood): laad een formulier in de Formulieren-activiteit en herlaad hier uit model.",
  devHookNaam: "__formulierDiagramStore",
  koppeling: {
    // Projectie uit de formulier-editor-store (de def die daar geladen/gebouwd is).
    herlaadUitModel: () => {
      const st = useFormulierEditorStore.getState();
      return layoutNaarFormulierModel(serializeLayout(st.root), st.meta);
    },
  },
});
