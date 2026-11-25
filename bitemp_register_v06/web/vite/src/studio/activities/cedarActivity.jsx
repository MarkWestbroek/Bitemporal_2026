/**
 * cedarActivity — "Cedar": toegangsbeleid in Cedar (policies en schema) op de generieke
 * diagram-motor. Descriptor + fabriek, verder niets — zie diagramprofielen/cedar/ en
 * docs/plans/"2026-11-25 Cedar als M2 — profiel en vertaling via Toegangsspraak (plan).md".
 *
 * Import via de eigen Cedar-lezer (geen cedar-wasm: die weigert de PABC-vorm van Open FTV).
 * Meldingen (een actie die niet van type Action is, een policy die nooit geldt, een afgeleid
 * schema) in een dialoog. Export als Cedar-tekst; de JSON-vormen via het transformatiepaneel.
 */
import { IconCedar05 } from "../icons";
import { registreerCedar, cedarDiagramType, maakElement } from "../../diagramprofielen/cedar/index.js";
import { vanCedar, naarCedar } from "../../diagramprofielen/cedar/adapter.js";
import { toonMelding } from "../naamDialog.jsx";
import { maakDiagramActiviteit } from "./maakDiagramActiviteit.jsx";

registreerCedar();

const alsTekst = (meldingen) => meldingen.map((m) => `• ${m.niveau}: ${m.bericht}`).join("\n");

export default maakDiagramActiviteit({
  id: "cedar05",
  label: "Cedar",
  icon: <IconCedar05 />,
  descriptor: cedarDiagramType,
  maakElement,
  persistKey: "studio05-cedar",
  taakbalkSleutel: "studio05-taakbalken-cedar",
  menuPrefix: "cedar05",
  menuLabel: "Cedar",
  kleur: "#b45309",
  standaardVerborgen: true, // preview-profiel; via Modelleren + instellingen bereikbaar
  previewTekst: "Cedar — policies (permit/forbid) als kaarten, het schema als entiteittypen en acties; Cedar-tekst, -JSON en Open FTV-lijsten in en uit.",
  devHookNaam: "__cedar05Store",
  koppeling: {
    importBestand: {
      label: "Importeer Cedar (tekst, JSON of Open FTV-lijst)…",
      accept: ".cedar,.json,.cedarschema,.txt",
      verwerk: async (tekst, bestandsnaam) => {
        const { meldingen, ...model } = vanCedar(tekst, { bestandsnaam });
        if (meldingen.length) {
          const fouten = meldingen.filter((m) => m.niveau === "fout").length;
          const waarschuwingen = meldingen.filter((m) => m.niveau === "waarschuwing").length;
          await toonMelding({
            titel: `Cedar-import: ${fouten} fout(en), ${waarschuwingen} waarschuwing(en)`,
            tekst: `Het bestand is gelezen; dit valt op:\n\n${alsTekst(meldingen)}`,
            bevestig: "Importeer",
          });
        }
        return model;
      },
    },
    /** Diagram → Cedar-tekst; meldingen (een policy met een leesfout) als //-commentaar bovenaan. */
    exportBestand: {
      label: "Exporteer Cedar (tekst)…",
      bestandsnaam: () => "policies.cedar",
      maak: (staat) => {
        const { tekst, meldingen } = naarCedar(staat, { vorm: "tekst" });
        const kop = meldingen.length ? meldingen.map((m) => `// ${m.niveau}: ${m.bericht.replace(/\n/g, " ")}`).join("\n") + "\n\n" : "";
        return kop + tekst;
      },
    },
  },
});
