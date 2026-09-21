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
import { layoutNaarFormulierModel, formulierModelNaarLayout } from "../../diagramprofielen/formulier/adapter.js";
import { serializeLayout } from "../../formuliereditor/layoutModel.js";
import { bouwVeldInfoUitLayout } from "../../formuliereditor/schemaResolve.js";
import { useFormulierEditorStore } from "../../formuliereditor/useFormulierEditorStore.js";
import { apiBase } from "../studioUtils";
import { maakDiagramActiviteit } from "./maakDiagramActiviteit.jsx";

/**
 * Verrijk de veldInfo van de formulier-editor async uit het schema, zodat de
 * preview daar ook velden kent die op het diagram zijn toegevoegd. Best-effort:
 * bij een fout blijft de bestaande veldInfo staan.
 */
async function verrijkVeldInfo(layout) {
  try {
    const res = await fetch(`${apiBase()}/api/schema/model/code`);
    if (!res.ok) return;
    const types = await res.json();
    const lijst = Array.isArray(types) ? types : types?.types || [];
    const byTypenaam = {};
    for (const t of lijst) if (t?.typenaam) byTypenaam[t.typenaam] = t;
    const nieuw = bouwVeldInfoUitLayout(layout, byTypenaam);
    const st = useFormulierEditorStore.getState();
    useFormulierEditorStore.setState({ veldInfo: { ...st.veldInfo, ...nieuw } });
  } catch {
    /* offline of geen backend: bestaande veldInfo volstaat */
  }
}

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
    herlaadLabel: "Herlaad uit formulier-editor…",
    // P2: terugschrijven — diagram → layout → formulier-editor-store. Publiceren
    // naar het register blijft via de editor ("Opslaan", incl. update-in-place);
    // zo blijft er één bewezen schrijfpad en een review-moment (preview).
    zetTerugNaarModel: (coreState) => {
      const { layout, meta } = formulierModelNaarLayout(coreState);
      if (!layout) return ["Geen formulier-element gevonden op het diagram."];
      const st = useFormulierEditorStore.getState();
      const { fout } = st.laadDefinitie({
        layoutJson: JSON.stringify(layout),
        meta,
        veldInfo: st.veldInfo, // behoud bekende velddefs; async verrijkt hieronder
        id: st.geladenId,
        metaRelId: st.geladenMetaRelId,
        layoutRelId: st.geladenLayoutRelId,
      });
      if (fout) return [fout];
      verrijkVeldInfo(layout);
      return [];
    },
    zetTerugLabel: "Zet terug naar formulier-editor…",
    zetTerugBevestiging:
      "Dit vervangt het formulier in de Formulieren-activiteit door dit diagram.\n" +
      "Controleer het daar (preview) en sla het daar op naar het register. Doorgaan?",
  },
});
