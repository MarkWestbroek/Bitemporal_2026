/**
 * toegangsregelsActivity — het toegangsregel-profiel als volwaardige
 * diagram-activiteit op de generieke motor (stap 4 van "2026-07-24
 * Toegangsregel-profiel (ontwerp)").
 *
 * Via de fabriek krijgt het profiel een canvas (slepen/schalen), een eigen
 * model-store (persistent) en — omdat de groep "modelleren" is — automatisch
 * een plek in de Modelleren-projectboom. De Toegangverlening-activiteit
 * publiceert er beleid naartoe (menu Beleid → Publiceer naar Modelleren);
 * de tekst blijft de bron van waarheid (tekst-first, v1).
 */
import React from "react";
import { maakDiagramActiviteit } from "./maakDiagramActiviteit.jsx";
import { IconToegang } from "../icons";
import {
  toegangsregelDiagramType, maakElement, registreerToegangsregelProfiel,
} from "../../diagramprofielen/toegangsregel/index.js";
import { registreerToegangsregelShapes } from "../../diagramprofielen/toegangsregel/shapes.jsx";
import { registreerToegangsregelIconen } from "../../diagramprofielen/toegangsregel/iconen.jsx";

registreerToegangsregelShapes();
registreerToegangsregelIconen();
registreerToegangsregelProfiel();

export default maakDiagramActiviteit({
  id: "toegangsregels",
  label: "Toegangsregels",
  icon: <IconToegang />,
  descriptor: toegangsregelDiagramType,
  maakElement,
  persistKey: "studio05-toegangsregels",
  taakbalkSleutel: "studio05-taakbalken-toegangsregels",
  menuPrefix: "trg",
  menuLabel: "Toegangsregels",
  standaardVerborgen: true, // gedekt door de Modelleren-host
  devHookNaam: "__toegangsregelsStore",
});
