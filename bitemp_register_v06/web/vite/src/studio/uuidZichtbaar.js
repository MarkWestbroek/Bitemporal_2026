// @ts-check
/**
 * uuidZichtbaar — mag de huidige gebruiker uuid's zien (Mark 15-11: "een instelling voor de
 * admin")? Een beheerder, of iedereen als de login uit staat (lokaal ontwikkelen). Of ze ook
 * getoond worden, is de voorkeur `toonUuids` (useStudioStore).
 */
import { useContext } from "react";
import { AuthContext } from "../context/AuthContext.jsx";
import { isBeheerder } from "../shared/rollen.js";
import useStudioStore from "./useStudioStore";

/** Mag de gebruiker de instelling zien? (Buiten een AuthProvider: nee.) */
export function useMagUuidsZien() {
  const auth = useContext(AuthContext);
  if (!auth) return false;
  return !auth.authEnabled || isBeheerder(auth.gebruiker?.rol);
}

/** Worden uuid's getoond: mag het, en staat de voorkeur aan? */
export function useToonUuids() {
  const mag = useMagUuidsZien();
  const aan = useStudioStore((s) => s.toonUuids);
  return mag && !!aan;
}
