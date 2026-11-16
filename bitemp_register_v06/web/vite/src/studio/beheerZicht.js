// @ts-check
/**
 * beheerZicht — wat alleen een beheerder in de Studio ziet (Mark 16-11).
 *
 * De klassieke editors (profieltypen met `klassiek: true`: Canoniek model IDE (v1), DMN-model met
 * dmn-js, BPMN-proces met bpmn.io, Berichtdefinities) lopen niet mee in het project. Ze staan nog in
 * de boom en op de startpagina, maar alleen voor een beheerder, of voor iedereen als de login uit
 * staat (lokaal ontwikkelen).
 *
 * Naast de hook een modulevariabele, voor menu's die buiten React worden opgebouwd
 * (`nieuwDiagramItems`); de zijbalk houdt hem bij.
 */
import { useContext } from "react";
import { AuthContext } from "../context/AuthContext.jsx";
import { isBeheerder } from "../shared/rollen.js";

/** Beheerder, of login uit. Buiten een AuthProvider: nee. */
export function useBeheerZicht() {
  const auth = useContext(AuthContext);
  if (!auth) return false;
  return !auth.authEnabled || isBeheerder(auth.gebruiker?.rol);
}

export { zetBeheerZicht, heeftBeheerZicht, zichtbareProfielen } from "./beheerZichtRegels.js";
