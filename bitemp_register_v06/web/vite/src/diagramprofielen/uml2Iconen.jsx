/**
 * uml2Iconen — taakbalk-/browser-glyphs voor de "EA-aanvulling"-profielen
 * (sessie 2026-10-09, opdracht Mark via EA-SYNC): component & deployment,
 * object, requirements, business (Eriksson-Penker), XSD, WSDL, composite
 * structure en communication. 14px-vormen in currentColor op het
 * typeIconen-koppelvlak, net als gedragTypeIconen.jsx / sysml/iconen.jsx.
 *
 * Familieregels (ronde 1/2 iconen): het icoon is het silhouet van de
 * canvasvorm waar die vorm zelf de betekenis draagt; één gevuld accent per
 * icoon (B1); open markers blijven open (B2). Namespaces per profiel:
 * `cd-` component/deployment, `ob-` object, `rq-` requirements, `ep-`
 * Eriksson-Penker, `xs-` XSD, `ws-` WSDL, `cs-` composite structure,
 * `cm-` communication.
 */
import React from "react";
import { registreerTypeIcoon } from "../diagramcore/shapes/typeIconen.jsx";

const basis = (maat, kinderen) => (
  <svg
    width={maat}
    height={maat}
    viewBox="0 0 14 14"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ flexShrink: 0 }}
  >
    {kinderen}
  </svg>
);

/** Het ene gevulde accent per icoon. */
const vul = { fill: "currentColor", stroke: "none" };

/** @type {Record<string, (m: number) => JSX.Element>} */
const GLYPHS = {
  // ── Component & deployment ─────────────────────────────────────────────
  /** Component: doos met de twee "stekkertjes" links (het UML-componentsymbool). */
  "cd-component": (m) =>
    basis(m, (
      <>
        <rect x="4" y="2" width="8.5" height="10" />
        <rect x="1.8" y="4.2" width="4" height="2" {...vul} />
        <rect x="1.8" y="7.8" width="4" height="2" {...vul} />
      </>
    )),
  /** Interface: lollipop — bolletje aan een steeltje. */
  "cd-interface": (m) =>
    basis(m, (
      <>
        <circle cx="9.5" cy="5" r="3" />
        <path d="M9.5 8 V12.5 M4 12.5 H9.5" />
      </>
    )),
  /** Poort: vierkantje op een rand. */
  "cd-poort": (m) =>
    basis(m, (
      <>
        <path d="M2 2 H8 V12 H2" />
        <rect x="6" y="5" width="4" height="4" {...vul} />
      </>
    )),
  /** Artifact: document met omgevouwen hoek. */
  "cd-artifact": (m) =>
    basis(m, (
      <>
        <path d="M3 1.5 H8.5 L11.5 4.5 V12.5 H3 Z" />
        <path d="M8.5 1.5 V4.5 H11.5" {...vul} />
      </>
    )),
  /** Node: 3D-doos (kubus). */
  "cd-node": (m) =>
    basis(m, (
      <>
        <path d="M2 4.5 H9.5 V12.5 H2 Z" />
        <path d="M2 4.5 L4.5 2 H12 V10 L9.5 12.5 M9.5 4.5 L12 2" />
      </>
    )),
  /** Device: kubus met een gevuld schermpje. */
  "cd-device": (m) =>
    basis(m, (
      <>
        <path d="M2 4.5 H9.5 V12.5 H2 Z" />
        <path d="M2 4.5 L4.5 2 H12 V10 L9.5 12.5 M9.5 4.5 L12 2" />
        <rect x="3.5" y="6.5" width="4.5" height="3" {...vul} />
      </>
    )),
  /** Execution environment: kubus met een tandwielpunt. */
  "cd-executieomgeving": (m) =>
    basis(m, (
      <>
        <path d="M2 4.5 H9.5 V12.5 H2 Z" />
        <path d="M2 4.5 L4.5 2 H12 V10 L9.5 12.5 M9.5 4.5 L12 2" />
        <circle cx="5.75" cy="8.5" r="1.6" {...vul} />
      </>
    )),
  /** Assembly: bolletje in een halve maan (ball-and-socket). */
  "cd-assembly": (m) =>
    basis(m, (
      <>
        <path d="M1.5 7 H4.5" />
        <circle cx="6.5" cy="7" r="2" {...vul} />
        <path d="M9 4.2 A3.2 3.2 0 0 0 9 9.8 M9 7 H12.5" />
      </>
    )),
  /** Deploy: pijl die in een doos landt. */
  "cd-deploy": (m) =>
    basis(m, (
      <>
        <path d="M7 1.5 V8 M4.5 5.5 L7 8 L9.5 5.5" />
        <path d="M2 9 H12 V12.5 H2 Z" />
      </>
    )),
  /** Manifest: document met pijl eruit. */
  "cd-manifest": (m) =>
    basis(m, (
      <>
        <path d="M2 1.5 H6.5 L8.5 3.5 V9 H2 Z" />
        <path d="M8.5 11.5 H12.5 M10.5 9.5 L12.5 11.5 L10.5 13.5" />
      </>
    )),
  /** Communicatiepad: twee kubusjes met een lijn. */
  "cd-communicatiepad": (m) =>
    basis(m, (
      <>
        <rect x="1.5" y="4.5" width="4" height="4" />
        <rect x="8.5" y="4.5" width="4" height="4" {...vul} />
        <path d="M5.5 6.5 H8.5" />
      </>
    )),

  // ── Object (instanties) ────────────────────────────────────────────────
  /** Object: doos met onderstreepte naam (de instantie-conventie). */
  "ob-object": (m) =>
    basis(m, (
      <>
        <rect x="2" y="2" width="10" height="10" />
        <path d="M4 5.2 H10" strokeWidth="1.6" />
        <path d="M4 8.5 H8 M4 10.5 H7" />
      </>
    )),
  /** Link: lijn tussen twee onderstreepte doosjes. */
  "ob-link": (m) =>
    basis(m, (
      <>
        <rect x="1.5" y="4" width="4" height="4.5" />
        <path d="M2.5 7.3 H4.5" />
        <rect x="8.5" y="4" width="4" height="4.5" {...vul} />
        <path d="M5.5 6.3 H8.5" />
      </>
    )),

  // ── Requirements ───────────────────────────────────────────────────────
  /** Requirement: doos met vinkregels en een gevulde kop. */
  "rq-requirement": (m) =>
    basis(m, (
      <>
        <rect x="2" y="2" width="10" height="10" />
        <rect x="2" y="2" width="10" height="3" {...vul} />
        <path d="M4 8 H10 M4 10 H8" />
      </>
    )),
  /** Feature: ster/ruitje. */
  "rq-feature": (m) => basis(m, <path d="M7 1.5 L8.6 5.4 L12.8 5.7 L9.6 8.4 L10.6 12.5 L7 10.3 L3.4 12.5 L4.4 8.4 L1.2 5.7 L5.4 5.4 Z" {...vul} />),
  /** Issue: driehoek met uitroepteken. */
  "rq-issue": (m) =>
    basis(m, (
      <>
        <path d="M7 1.8 L12.8 12.2 H1.2 Z" />
        <path d="M7 5.5 V8.5" strokeWidth="1.6" />
        <circle cx="7" cy="10.4" r="0.8" {...vul} />
      </>
    )),
  /** Change: ronde pijl (delta). */
  "rq-change": (m) =>
    basis(m, (
      <>
        <path d="M11 7 A4 4 0 1 1 8.8 3.4" />
        <path d="M8.5 1.5 L9.2 3.9 L6.8 4.4 Z" {...vul} />
      </>
    )),
  /** Bevat (aggregatie): open ruit aan een lijn. */
  "rq-bevat": (m) =>
    basis(m, (
      <>
        <path d="M1.5 7 L3.8 5 L6.1 7 L3.8 9 Z" />
        <path d="M6.1 7 H12.5" />
      </>
    )),

  // ── Eriksson-Penker ────────────────────────────────────────────────────
  /** Proces: de EP-pijlvorm (chevron). */
  "ep-proces": (m) => basis(m, <path d="M1.5 3 H9.5 L12.5 7 L9.5 11 H1.5 L4 7 Z" {...vul} />),
  /** Doel: schietschijf. */
  "ep-doel": (m) =>
    basis(m, (
      <>
        <circle cx="7" cy="7" r="5.2" />
        <circle cx="7" cy="7" r="2" {...vul} />
      </>
    )),
  /** Fysieke resource: doos/kist. */
  "ep-resource-fysiek": (m) =>
    basis(m, (
      <>
        <path d="M2 5 H12 V12 H2 Z" />
        <path d="M2 5 L4 2.5 H10 L12 5" />
        <rect x="5.5" y="7.5" width="3" height="2" {...vul} />
      </>
    )),
  /** Mensen-resource: strekfiguur. */
  "ep-resource-mensen": (m) =>
    basis(m, (
      <>
        <circle cx="7" cy="3.5" r="2" {...vul} />
        <path d="M7 6 V9 M3.5 7.5 H10.5 M7 9 L4.5 12.5 M7 9 L9.5 12.5" />
      </>
    )),
  /** Informatie-resource: document met "i". */
  "ep-resource-informatie": (m) =>
    basis(m, (
      <>
        <path d="M3 1.5 H8.5 L11.5 4.5 V12.5 H3 Z" />
        <circle cx="7.2" cy="6.3" r="0.8" {...vul} />
        <path d="M7.2 8 V10.8" strokeWidth="1.6" />
      </>
    )),
  /** Gebeurtenis: bliksem. */
  "ep-event": (m) => basis(m, <path d="M8.5 1.5 L3.5 8 H7 L5.5 12.5 L10.5 6 H7 Z" {...vul} />),
  /** Bedrijfsobject: doos met gevulde kop. */
  "ep-object": (m) =>
    basis(m, (
      <>
        <rect x="2" y="2.5" width="10" height="9" />
        <rect x="2" y="2.5" width="10" height="2.5" {...vul} />
      </>
    )),
  /** Actor (EP): strekfiguur in een cirkel. */
  "ep-actor": (m) =>
    basis(m, (
      <>
        <circle cx="7" cy="3.2" r="1.6" {...vul} />
        <path d="M7 5 V8.5 M4 6.5 H10 M7 8.5 L4.5 12.5 M7 8.5 L9.5 12.5" />
      </>
    )),

  // ── XSD ────────────────────────────────────────────────────────────────
  /** Schema: document met <>. */
  "xs-schema": (m) =>
    basis(m, (
      <>
        <path d="M3 1.5 H8.5 L11.5 4.5 V12.5 H3 Z" />
        <path d="M6 7 L4.8 8.5 L6 10 M8.4 7 L9.6 8.5 L8.4 10" />
      </>
    )),
  /** complexType: doos met drie regels, gevulde kop. */
  "xs-complex": (m) =>
    basis(m, (
      <>
        <rect x="2" y="2" width="10" height="10" />
        <rect x="2" y="2" width="10" height="2.6" {...vul} />
        <path d="M4 7 H10 M4 9.5 H8" />
      </>
    )),
  /** simpleType: afgeronde doos met één regel. */
  "xs-simple": (m) =>
    basis(m, (
      <>
        <rect x="2" y="3.5" width="10" height="7" rx="2" />
        <path d="M4.5 7 H9.5" strokeWidth="1.6" />
      </>
    )),
  /** element: label-tag. */
  "xs-element": (m) =>
    basis(m, (
      <>
        <path d="M2 3 H9 L12.5 7 L9 11 H2 Z" />
        <circle cx="4.5" cy="7" r="1" {...vul} />
      </>
    )),
  /** attribute: @. */
  "xs-attribute": (m) =>
    basis(m, (
      <>
        <circle cx="7" cy="7" r="5.2" />
        <circle cx="7" cy="7" r="2" {...vul} />
        <path d="M9 7 V8.5 A1.3 1.3 0 0 0 11.6 8.2" />
      </>
    )),
  /** group: accolade met regels. */
  "xs-group": (m) =>
    basis(m, (
      <>
        <path d="M4.5 1.5 C2.5 1.5 3 4 2.5 5.5 C2 7 1 7 1 7 C1 7 2 7 2.5 8.5 C3 10 2.5 12.5 4.5 12.5" />
        <path d="M7 4 H12 M7 7 H11 M7 10 H12" />
      </>
    )),
  /** enumeration: lijstje met bolletjes. */
  "xs-enumeration": (m) =>
    basis(m, (
      <>
        <circle cx="3" cy="3.5" r="1" {...vul} />
        <circle cx="3" cy="7" r="1" {...vul} />
        <circle cx="3" cy="10.5" r="1" {...vul} />
        <path d="M6 3.5 H12 M6 7 H11 M6 10.5 H12" />
      </>
    )),

  // ── WSDL ───────────────────────────────────────────────────────────────
  /** Service: wolk met stekker. */
  "ws-service": (m) =>
    basis(m, (
      <>
        <path d="M4 10.5 A2.6 2.6 0 0 1 4.2 5.3 A3.4 3.4 0 0 1 10.6 5.6 A2.5 2.5 0 0 1 10.5 10.5 Z" />
        <rect x="5.5" y="7" width="3.5" height="2" {...vul} />
      </>
    )),
  /** Port type (interface): lollipop. */
  "ws-porttype": (m) =>
    basis(m, (
      <>
        <circle cx="9.5" cy="5" r="3" />
        <path d="M9.5 8 V12.5 M4 12.5 H9.5" />
      </>
    )),
  /** Binding: twee ringen in elkaar. */
  "ws-binding": (m) =>
    basis(m, (
      <>
        <circle cx="5.2" cy="7" r="3.2" />
        <circle cx="8.8" cy="7" r="3.2" />
        <circle cx="7" cy="7" r="1" {...vul} />
      </>
    )),
  /** Message: envelop. */
  "ws-message": (m) =>
    basis(m, (
      <>
        <rect x="1.5" y="3" width="11" height="8" />
        <path d="M1.5 3 L7 8 L12.5 3" />
      </>
    )),
  /** Types: <> in een doos. */
  "ws-types": (m) =>
    basis(m, (
      <>
        <rect x="2" y="2" width="10" height="10" />
        <path d="M6 5.5 L4.5 7 L6 8.5 M8 5.5 L9.5 7 L8 8.5" />
      </>
    )),
  /** Operatie: pijl heen en terug. */
  "ws-operatie": (m) =>
    basis(m, (
      <>
        <path d="M2 5 H11 M9 3 L11 5 L9 7" />
        <path d="M12 9.5 H3 M5 7.5 L3 9.5 L5 11.5" />
      </>
    )),

  // ── Composite structure ────────────────────────────────────────────────
  /** Part: doos ín een doos. */
  "cs-part": (m) =>
    basis(m, (
      <>
        <rect x="1.5" y="1.5" width="11" height="11" />
        <rect x="4" y="5" width="6" height="5" {...vul} />
      </>
    )),
  /** Collaboration: gestippelde ellips. */
  "cs-collaboratie": (m) => basis(m, <ellipse cx="7" cy="7" rx="5.5" ry="3.8" strokeDasharray="2 1.5" />),
  /** Collaboration use: gestippelde ellips met gevulde rol. */
  "cs-collaboratiegebruik": (m) =>
    basis(m, (
      <>
        <ellipse cx="7" cy="7" rx="5.5" ry="3.8" strokeDasharray="2 1.5" />
        <circle cx="7" cy="7" r="1.5" {...vul} />
      </>
    )),

  // ── Communication ──────────────────────────────────────────────────────
  /** Levenslijn-object (communication): doosje met rolnaam. */
  "cm-object": (m) =>
    basis(m, (
      <>
        <rect x="2" y="3" width="10" height="8" />
        <path d="M4 6.5 H10" strokeWidth="1.6" />
      </>
    )),
  /** Bericht met volgnummer: "1:" boven een pijltje. */
  "cm-bericht": (m) =>
    basis(m, (
      <>
        <path d="M2 9.5 H11 M9 7.5 L11 9.5 L9 11.5" />
        <path d="M3.5 2.5 H5 V6 M3.2 6 H6.8" strokeWidth="1.1" />
      </>
    )),
};

let _geregistreerd = false;

/** Registreer de UML2-aanvullingsiconen (idempotent; per profiel aangeroepen). */
export function registreerUml2Iconen() {
  if (_geregistreerd) return;
  _geregistreerd = true;
  for (const [id, teken] of Object.entries(GLYPHS)) {
    registreerTypeIcoon(id, ({ maat = 14 }) => teken(maat));
  }
}

/** Voor tests/documentatie: alle icoon-ids van deze set. */
export const UML2_ICOON_IDS = Object.keys(GLYPHS);
