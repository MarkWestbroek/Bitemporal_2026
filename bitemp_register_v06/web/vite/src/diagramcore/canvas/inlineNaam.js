/**
 * inlineNaam — gedeelde context voor het inline hernoemen op het canvas en
 * de "vlak"-handle (verbind-modus).
 *
 * Hernoemen (F2 / dubbelklik): DiagramCanvas houdt bij wélke node in bewerking
 * is en levert dat via deze context aan ElementNode. Bewust een context en
 * geen node-data: de nodes-opbouw is zwaar (nesting, opname, voorkomens) en
 * hoeft niet opnieuw te draaien om één tekstveld te tonen.
 *
 * Vlak-handle: elke gewone node draagt naast de acht standaard-handles een
 * onzichtbare source-handle ter grootte van de hele node (`source-vlak`).
 * Die vangt alleen muis-input in verbind-modus (Shift ingedrukt) of zolang er
 * een lijn gesleept wordt — zo kun je vanaf élke plek op een vorm een lijn
 * beginnen en hem ook op élke plek van de doelvorm loslaten. Een vlak-handle
 * belandt nooit in het model: bij opslag wordt hij `null` (automatische
 * zijde via `besteZijde`), zie `normaliseerHandle`.
 */
import { createContext } from "react";

export const VLAK_HANDLE = "source-vlak";

/** Is dit handle-id de vlak-handle (verbind-modus) i.p.v. een echte zijde? */
export function isVlakHandle(handleId) {
  return typeof handleId === "string" && /^(source|target)-vlak$/.test(handleId);
}

/**
 * @typedef {Object} InlineNaamToestand
 * @property {string|null} nodeId  — React Flow-node-id in bewerking (of null)
 * @property {(nodeId: string, naam: string|null) => void} klaar
 *   — bevestigen (naam) of annuleren (null)
 */
export const InlineNaamContext = createContext({ nodeId: null, klaar: () => {} });

/**
 * Veldsleutel voor inline bewerken van een veld in een compartiment:
 * `<compartmentType>:<index>` (de shape zet hem als `data-dc-veld` op de
 * veldregel; alleen eigen compartimenten, niet de extra's zoals overgeërfde
 * velden). Terug splitsen gebeurt op de láátste dubbele punt.
 */
export function maakVeldSleutel(compartmentType, index) {
  return `${compartmentType}:${index}`;
}

export function splitsVeldSleutel(sleutel) {
  const i = String(sleutel).lastIndexOf(":");
  if (i < 0) return { compartmentType: sleutel, index: -1 };
  return { compartmentType: sleutel.slice(0, i), index: Number(sleutel.slice(i + 1)) };
}
