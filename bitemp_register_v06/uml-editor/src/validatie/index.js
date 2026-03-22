/**
 * index.js — Publieke API van de validatiebibliotheek.
 *
 * Herexporteert alle publieke functies zodat consumenten één import-pad
 * kunnen gebruiken:
 *
 *   import { valideer, normaliseer, zoekDatatype } from "../validatie";
 *
 * @module validatie
 */

export { valideer, zoekDatatype, valideerVeld } from "./valideer.js";
export { normaliseer, beschikbareNormalisaties } from "./normaliseer.js";
export { voerRegelUit, beschikbareFuncties } from "./regels.js";
