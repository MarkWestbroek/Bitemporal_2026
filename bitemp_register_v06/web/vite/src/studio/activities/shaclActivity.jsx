/**
 * shaclActivity — "SHACL": shapes (W3C Shapes Constraint Language) op de
 * generieke diagram-motor. Descriptor + fabriek, verder niets — zie
 * diagramprofielen/shacl/ en docs/plans/"2026-11-06 Linked data als M2 —
 * SHACL, SKOS, OWL (plan).md" (fase 1).
 *
 * Import via de eigen Turtle-lezer (geen dependency). Na de import toont een
 * dialoog de lint-meldingen (plan §11): wat een tekening uit SHACL anders
 * stil weglaat. Export via schrijver.js (fase 2).
 */
import { IconSHACL05 } from "../icons";
import { registreerShacl, shaclDiagramType, maakElement } from "../../diagramprofielen/shacl/index.js";
import { vanTurtle, meldingenAlsTekst, lintTurtle } from "../../diagramprofielen/shacl/adapter.js";
import { naarTurtle } from "../../diagramprofielen/shacl/schrijver.js";
import { toonMelding } from "../naamDialog.jsx";
import { maakDiagramActiviteit } from "./maakDiagramActiviteit.jsx";

registreerShacl();

export default maakDiagramActiviteit({
  id: "shacl05",
  label: "SHACL",
  icon: <IconSHACL05 />,
  descriptor: shaclDiagramType,
  maakElement,
  persistKey: "studio05-shacl",
  taakbalkSleutel: "studio05-taakbalken-shacl",
  menuPrefix: "shacl05",
  menuLabel: "SHACL",
  kleur: "#15803d",
  standaardVerborgen: true, // preview-profiel; via Modelleren + instellingen bereikbaar
  previewTekst: "SHACL — node shapes, property shapes als regels, sh:class-pijlen, constraints; Turtle in, met meldingen voor de bekende valkuilen.",
  devHookNaam: "__shacl05Store",
  koppeling: {
    /** Turtle → diagram. Een parsefout meldt regel en kolom; de lint daarna in een dialoog. */
    importBestand: {
      label: "Importeer SHACL (Turtle)…",
      accept: ".ttl,.turtle,.shacl,.txt",
      verwerk: async (tekst, bestandsnaam) => {
        const { meldingen, ...model } = vanTurtle(tekst, { bestandsnaam });
        if (meldingen.length) {
          const fouten = meldingen.filter((m) => m.niveau === "fout").length;
          const waarschuwingen = meldingen.filter((m) => m.niveau === "waarschuwing").length;
          await toonMelding({
            titel: `SHACL-import: ${fouten} fout(en), ${waarschuwingen} waarschuwing(en)`,
            tekst: `Het bestand is gelezen; dit valt op (een Turtle-parser of tekendienst meldt dit niet):\n\n${meldingenAlsTekst(meldingen)}`,
            bevestig: "Importeer",
          });
        }
        return model;
      },
    },
    /**
     * Diagram → Turtle (fase 2). De rondreis is semantisch: dezelfde graaf, niet dezelfde tekst.
     * Meldingen (een fragment dat geen Turtle is, een constraint in natuurlijke taal, …) blokkeren
     * de export niet maar komen als #-commentaar bovenaan, net als bij GraphQL; de lint van de
     * uitvoer ook, zodat een valkuil niet ongezien het bestand uit gaat.
     */
    exportBestand: {
      label: "Exporteer SHACL (Turtle)…",
      bestandsnaam: (staat) => {
        const graaf = Object.values(staat?.elements || {}).find((el) => el.elementType === "shapesgraaf");
        return `${String(graaf?.naam || "shapes").replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "") || "shapes"}.ttl`;
      },
      maak: (staat) => {
        const { tekst, meldingen } = naarTurtle(staat);
        const alle = [...meldingen, ...lintTurtle(tekst)];
        const kop = alle.length ? alle.map((m) => `# ${m.niveau}: ${m.bericht.replace(/\n/g, " ")}`).join("\n") + "\n\n" : "";
        return kop + tekst;
      },
    },
  },
});
