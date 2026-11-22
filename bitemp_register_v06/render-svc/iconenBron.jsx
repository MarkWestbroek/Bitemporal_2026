/**
 * iconenBron — de ingang voor iconenSvg.mjs: alle ingebouwde JSX-iconen geregistreerd, plus
 * React om ze te tekenen. Alleen voor het genereren en de rondreistest, niet voor de server
 * (de server-bundel maakt van JSX een stub, zie bouw.mjs).
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { alleIcoonIds, getTypeIcoon, standaardIconen } from "../web/vite/src/diagramcore/shapes/typeIconen.jsx";
import { maakDataIcoonComponent } from "../web/vite/src/diagramcore/shapes/dataIcoon.jsx";
import { registreerIconenVocabulaire } from "../web/vite/src/diagramcore/shapes/iconenVocabulaire.jsx";
import { registreerUml2Iconen } from "../web/vite/src/diagramprofielen/uml2Iconen.jsx";
import { registreerGedragTypeIconen } from "../web/vite/src/diagramprofielen/gedragTypeIconen.jsx";
import { registreerArchimateIconen } from "../web/vite/src/diagramprofielen/archimate/iconen.jsx";
import { registreerCmmnIconen } from "../web/vite/src/diagramprofielen/cmmn/iconen.jsx";
import { registreerErdIconen } from "../web/vite/src/diagramprofielen/erd/iconen.jsx";
import { registreerSysmlIconen } from "../web/vite/src/diagramprofielen/sysml/iconen.jsx";
import { registreerToegangsregelIconen } from "../web/vite/src/diagramprofielen/toegangsregel/iconen.jsx";

export { markupNaarIcoonSvg } from "../web/vite/src/diagramcore/shapes/iconenAlsSvg.js";
export { schoonSvg } from "../web/vite/src/diagramcore/shapes/svgSchoon.js";

const teken = (Component) => renderToStaticMarkup(createElement(Component, { maat: 14 }));

/** id → markup van elk ingebouwd icoon (de standaardiconen als `vorm:<shape>`). */
export function ingebouwdeIconenAlsMarkup() {
  for (const registreer of [registreerIconenVocabulaire, registreerUml2Iconen, registreerGedragTypeIconen, registreerArchimateIconen, registreerCmmnIconen, registreerErdIconen, registreerSysmlIconen, registreerToegangsregelIconen]) registreer();
  const uit = {};
  for (const id of alleIcoonIds()) uit[id] = teken(getTypeIcoon(id));
  for (const [id, Component] of standaardIconen()) uit[id] = teken(Component);
  return uit;
}

/** Een data-icoon tekenen zoals de Studio het doet (voor de rondreis). */
export const tekenDataIcoon = (def) => teken(maakDataIcoonComponent(def));
