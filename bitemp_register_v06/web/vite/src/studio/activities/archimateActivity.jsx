/**
 * archimateActivity — "ArchiMate": enterprise-architectuur op de generieke
 * motor (v0: Business/Application/Technology/Motivation-subset + de elf
 * relaties, permissief). Descriptor + fabriek, verder niets — zie
 * diagramprofielen/archimate/ en het plan
 * "2026-07-17 ArchiMate en verdere notaties".
 */
import { IconArchiMate } from "../icons";
import { registreerArchimate, archimateDiagramType, maakElement } from "../../diagramprofielen/archimate/index.js";
import { maakDiagramActiviteit } from "./maakDiagramActiviteit.jsx";

registreerArchimate();

export default maakDiagramActiviteit({
  id: "archimate05",
  label: "ArchiMate",
  icon: <IconArchiMate />,
  descriptor: archimateDiagramType,
  maakElement,
  persistKey: "studio05-archimate",
  taakbalkSleutel: "studio05-taakbalken-archimate",
  menuPrefix: "am05",
  menuLabel: "ArchiMate",
  kleur: "#14b8a6",
  standaardVerborgen: true, // preview-profiel; via Modelleren + instellingen bereikbaar
  previewTekst: "ArchiMate 3.2 (v0) — vier lagen, elf relaties; geldigheidsmatrix volgt in v1.",
  devHookNaam: "__archimate05Store",
});
