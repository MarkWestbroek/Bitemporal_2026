/**
 * datatypeValidatie.js — validatie uit het DATATYPE, voor elk invoerveld (inhoud, formulier,
 * aanmelden). Validatie is een eigenschap van de inhoud, niet van de vorm (ontwerp "Invoersoort
 * en vorm" §9d): het datatype in het model (bv. BSN) draagt patroon, lengte, normalisatie en
 * regels (checksum, formula, function). De server controleert hetzelfde (model/validation.go,
 * model/regels_eval.go); hier gebeurt het al tijdens het invullen.
 *
 * De uitvoering zit in de bestaande bibliotheek `umleditor/validatie` (valideer), die ook het
 * paneel "Test invoer" in de metamodel-editor gebruikt.
 *
 * De datatypes komen van /api/viz/schema/datatypes (SchemaContext zet ze met `zetDatatypes`).
 * Een module-register in plaats van een prop, zodat de bestaande, pure validatiefunctie
 * (validatieMeldingVoorVeld) ze zonder extra doorgeefwerk kan gebruiken.
 *
 * Een veld kan daarnaast zelf validatie meebrengen (`veld.validatie`, bv. uit de layout van een
 * formulier, of een veld uit een bron zonder datatype). Die geldt AANVULLEND: een formulier kan
 * de regels van het model strenger maken, niet opheffen.
 */
import { valideer } from "../umleditor/validatie/valideer.js";

let datatypesOpNaam = new Map();

/** Zet de bekende datatypes (lijst van V3Datatype). */
export function zetDatatypes(lijst) {
  datatypesOpNaam = new Map((lijst || []).filter((d) => d?.naam).map((d) => [d.naam, d]));
}

/** Het datatype van een schema-veld (op `datatype`-naam, anders op `format`), of null. */
export function datatypeVanVeld(veld) {
  if (!veld) return null;
  if (veld.datatype && datatypesOpNaam.has(veld.datatype)) return datatypesOpNaam.get(veld.datatype);
  if (veld.format) {
    for (const d of datatypesOpNaam.values()) if (d.format === veld.format) return d;
  }
  return null;
}

/** Heeft deze validatie iets te controleren? */
const heeftRegels = (v) => Boolean(v && (v.pattern || v.minLength != null || v.maxLength != null
  || v.minimum != null || v.maximum != null || v.multipleOf != null || (v.regels || []).length));

/** Eén melding uit een valideer-resultaat: de foutmelding van het datatype als die er is. */
function melding(res, validatie) {
  if (res.geldig) return "";
  return validatie?.foutmelding || res.fouten[0] || "Ongeldige waarde.";
}

/**
 * De melding voor een (niet-lege) waarde volgens het datatype van het veld en de eigen
 * validatie van het veld, of "" als alles klopt. Verplicht/leeg regelt de aanroeper.
 */
export function datatypeMelding(waarde, veld) {
  if (waarde == null || String(waarde).trim() === "") return "";
  const dt = datatypeVanVeld(veld);
  if (dt && (heeftRegels(dt.validatie) || dt.normalisatie)) {
    const m = melding(valideer(waarde, dt), dt.validatie);
    if (m) return m;
  }
  const eigen = veld?.validatie;
  if (heeftRegels(eigen)) {
    const m = melding(valideer(waarde, { basistype: dt?.basistype || "string", validatie: eigen }), eigen);
    if (m) return m;
  }
  return "";
}
