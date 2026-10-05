/**
 * graphqlActivity — "GraphQL": het GraphQL-schema (typesysteem, spec §3) op de
 * generieke diagram-motor. Descriptor + fabriek, verder niets — zie
 * diagramprofielen/graphql/ en docs/plans/"2026-10-01 GraphQL-schema-profiel
 * (M2) op de diagram-motor (voorstel).md".
 *
 * Import en export gaan via de eigen SDL-parser (geen dependency). Bij de
 * export worden de veldlijnen opnieuw uit de velden afgeleid: de velden zijn
 * de bron, de lijnen de weergave.
 */
import { IconGraphQL05 } from "../icons";
import { registreerGraphql, graphqlDiagramType, maakElement } from "../../diagramprofielen/graphql/index.js";
import { vanSdl, naarSdlTekst, valideerSchema } from "../../diagramprofielen/graphql/adapter.js";
import { maakDiagramActiviteit } from "./maakDiagramActiviteit.jsx";

registreerGraphql();

export default maakDiagramActiviteit({
  id: "graphql05",
  label: "GraphQL",
  icon: <IconGraphQL05 />,
  descriptor: graphqlDiagramType,
  maakElement,
  persistKey: "studio05-graphql",
  taakbalkSleutel: "studio05-taakbalken-graphql",
  menuPrefix: "gql05",
  menuLabel: "GraphQL",
  kleur: "#db2777",
  standaardVerborgen: true, // preview-profiel; via Modelleren + instellingen bereikbaar
  previewTekst: "GraphQL-schema — typen, interfaces, unions, enums, inputs en directives; SDL in en uit.",
  devHookNaam: "__graphql05Store",
  koppeling: {
    /** SDL → diagram. Een parsefout meldt regel en kolom. */
    importBestand: {
      label: "Importeer GraphQL-schema (SDL)…",
      accept: ".graphql,.graphqls,.gql,.sdl,.txt",
      verwerk: (tekst) => vanSdl(tekst),
    },
    /**
     * Diagram → SDL. Schema-meldingen (onbekend type, ontbrekend interface-
     * veld, …) blokkeren de export niet maar komen als #-commentaar bovenaan,
     * zodat ze niet ongezien blijven; wat geen SDL kan worden (veld zonder
     * type) geeft een fout met de plek.
     */
    exportBestand: {
      label: "Exporteer GraphQL-schema (SDL)…",
      bestandsnaam: () => "schema.graphql",
      maak: (staat) => {
        const sdl = naarSdlTekst(staat);
        const meldingen = valideerSchema(staat);
        const kop = meldingen.length
          ? meldingen.map((m) => `# ${m.niveau}: ${m.bericht}`).join("\n") + "\n\n"
          : "";
        return kop + sdl;
      },
    },
  },
});
