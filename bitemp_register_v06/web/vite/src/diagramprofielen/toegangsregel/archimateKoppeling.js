// @ts-check
/**
 * archimateKoppeling — stap 5 van "2026-07-24 Toegangsregel-profiel (ontwerp)":
 * begrippen, grondslag en doel van een Toegangsbeleid landen in het
 * ArchiMate-model, met kruisverbanden ernaartoe.
 *
 * Afbeelding (besluiten §4 van het plan, band met GEMMA):
 *   wat-begrip   → Business object   (begrippenkader boven het logisch model)
 *   wie-begrip   → Business rol
 *   grondslag    → Constraint        (wet- en regelgeving, motivatielaag)
 *   doel         → Goal              (doelbinding)
 *
 * Kruisverbanden (Koppelingen-matrix; kolom = bovenliggend):
 *   begrip-element  —komt voort uit→  Business object / rol
 *   policy          —komt voort uit→  Constraint (grondslag)
 *   policy          —realiseert→      Goal (doelbinding)
 *
 * De koppeling is **additief**: bestaande ArchiMate-elementen met dezelfde
 * naam en soort worden hergebruikt (het ArchiMate-model is van de gebruiker;
 * er wordt nooit iets verwijderd of hernoemd). Puur en testbaar: de aanroeper
 * levert de bestaande elementen en schrijft zelf naar de stores.
 */
import { slug } from "../../toegangsspraak/woorden.js";
import { PROFIELTYPE_TOEGANGSREGELS } from "./adapter.js";

/** Profieltype-id van de ArchiMate-motoractiviteit (archimateActivity.jsx). */
export const PROFIELTYPE_ARCHIMATE = "archimate05";

/** Gewenste ArchiMate-elementen voor dit beleid (nog los van wat er al is). */
export function archimateElementenUit(beleid) {
  const gewenst = [];
  for (const begrip of beleid.begrippen) {
    gewenst.push({
      id: `arch:trg:${begrip.soort === "wie" ? "rol" : "bo"}:${slug(begrip.naam)}`,
      elementType: begrip.soort === "wie" ? "business-rol" : "business-object",
      naam: begrip.naam,
      bron: { soort: "begrip", naam: begrip.naam },
    });
  }
  if (beleid.grondslag) {
    gewenst.push({
      id: `arch:trg:wet:${slug(beleid.grondslag)}`,
      elementType: "constraint",
      naam: beleid.grondslag,
      bron: { soort: "grondslag" },
    });
  }
  if (beleid.doel) {
    gewenst.push({
      id: `arch:trg:doel:${slug(beleid.doel)}`,
      elementType: "goal",
      naam: beleid.doel,
      bron: { soort: "doel" },
    });
  }
  return gewenst;
}

/**
 * Bepaal wat er toegevoegd moet worden en welke kruisverbanden er horen,
 * gegeven de bestaande ArchiMate-elementen (hergebruik op soort + naam,
 * hoofdletter-ongevoelig).
 *
 * @param beleid   geparst Toegangsspraak-beleid
 * @param bestaand bestaande ArchiMate-elementen: Array<{id, elementType, naam}>
 * @returns {{ toeTeVoegen: Array, links: Array }}
 */
export function koppelArchimate(beleid, bestaand = []) {
  const bestaandPerSleutel = new Map(
    bestaand.map((el) => [`${el.elementType}::${String(el.naam).toLowerCase()}`, el])
  );
  const toeTeVoegen = [];
  const links = [];

  const kolomVoor = (gewenstElement) => {
    const sleutel = `${gewenstElement.elementType}::${gewenstElement.naam.toLowerCase()}`;
    const hergebruik = bestaandPerSleutel.get(sleutel);
    if (hergebruik) return hergebruik.id;
    if (!toeTeVoegen.some((el) => el.id === gewenstElement.id)) {
      toeTeVoegen.push({ id: gewenstElement.id, elementType: gewenstElement.elementType, naam: gewenstElement.naam });
    }
    return gewenstElement.id;
  };

  for (const gewenstElement of archimateElementenUit(beleid)) {
    const kolomId = kolomVoor(gewenstElement);
    const kolom = { profielId: PROFIELTYPE_ARCHIMATE, elementId: kolomId };
    if (gewenstElement.bron.soort === "begrip") {
      links.push({
        rij: { profielId: PROFIELTYPE_TOEGANGSREGELS, elementId: `trg:def:${slug(gewenstElement.bron.naam)}` },
        kolom,
        soort: "komt voort uit",
      });
    } else {
      links.push({
        rij: { profielId: PROFIELTYPE_TOEGANGSREGELS, elementId: "trg:policy" },
        kolom,
        soort: gewenstElement.bron.soort === "doel" ? "realiseert" : "komt voort uit",
      });
    }
  }
  return { toeTeVoegen, links };
}
