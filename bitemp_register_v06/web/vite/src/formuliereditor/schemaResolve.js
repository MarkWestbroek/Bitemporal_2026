/**
 * schemaResolve — reconstrueert de per-pad `veldInfo` uit een geladen layout +
 * het canoniek model, zodat een bestaande FormulierDefinitie in de editor
 * getoond en bewerkt kan worden (preview/inspector hebben velddef-info nodig).
 *
 * Adressering: velden gebruiken het volle pad `ENT.GE.veld`. Binnen een `lijst`
 * zijn ze relatief aan `bron` (= `ENT.GE`). Korte-naam-definities (legacy) worden
 * overgeslagen — er is bewust géén legacy-resolver.
 */
import { kinderSleutel } from "./layoutModel.js";

/** Bouw veldInfo (map vol-pad → velddef-metadata) uit een layout-boom. */
export function bouwVeldInfoUitLayout(root, typeMetaByTypenaam) {
  const veldInfo = {};
  const bezoek = (el, padContext) => {
    if (!el) return;
    if (el.type === "veld") {
      const volPad = padContext ? `${padContext}.${el.veld}` : el.veld;
      const info = resolveVeldpad(volPad, typeMetaByTypenaam);
      if (info) veldInfo[volPad] = info;
    }
    const sleutel = kinderSleutel(el);
    const kindContext = el.type === "lijst" ? el.bron : padContext;
    if (sleutel && Array.isArray(el[sleutel])) el[sleutel].forEach((k) => bezoek(k, kindContext));
  };
  bezoek(root, null);
  return veldInfo;
}

/** Resolve één vol pad `ENT.GE.veld` (of `ENT.veld`) naar velddef-metadata. */
export function resolveVeldpad(volPad, typeMetaByTypenaam) {
  const delen = String(volPad || "").split(".");
  if (delen.length < 2) return null; // korte naam → overslaan (geen legacy-resolver)
  const entNaam = delen[0];
  const entMeta = typeMetaByTypenaam?.[entNaam];
  if (!entMeta) return null;

  // ENT.veld → eigen entiteitveld (zeldzaam); ENT.rol.veld → veld in een GE.
  if (delen.length === 2) {
    const v = safe(entMeta.velden).find((x) => x?.naam === delen[1]);
    return v ? veldInfoUit(v, "") : null;
  }
  const [, rol, veldNaam] = delen;
  const child = safe(entMeta.onderliggende).find((c) => (c.jsonRolnaam || c.rolnaam) === rol);
  if (!child) return null;
  const childMeta = typeMetaByTypenaam?.[child.doeltype];
  const dataChild = safe(childMeta?.onderliggende).find(
    (c) => typeMetaByTypenaam?.[c.doeltype]?.ge_subtype === "data"
  );
  const bronMeta = dataChild ? typeMetaByTypenaam?.[dataChild.doeltype] : childMeta;
  const v = safe(bronMeta?.velden).find((x) => x?.naam === veldNaam);
  return v ? veldInfoUit(v, child.momentvoorkomen) : null;
}

function veldInfoUit(v, momentvoorkomen) {
  return {
    veldnaam: v.naam,
    datatype: v.datatype || "",
    type: v.type || "string",
    format: v.format || "",
    enum: Array.isArray(v.enum) ? v.enum : [],
    ref: v.ref || "",
    momentvoorkomen: momentvoorkomen || "",
  };
}

function safe(a) {
  return Array.isArray(a) ? a : [];
}
