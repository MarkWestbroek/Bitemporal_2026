// @ts-check
/**
 * zaaktypeRegels — de **regelset** "canoniek model + e-dienst → zaaktype
 * (Catalogi API)" voor de inrichting van e-diensten (docs/TRANSFORMATIES.md §11.7).
 *
 * Anders dan bij het objecttype en het formulier kent het canonieke model de
 * inhoud van een zaaktype niet: statustypen, roltypen, resultaattypen,
 * selectielijst en termijnen zijn procesinrichting, geen gegevensmodel. Die
 * staan letterlijk in de e-dienst (`zaaktype`, `catalogus`,
 * `informatieobjecttypen`). Wat het model (M1) en het register (M0) wél weten,
 * komt hier vandaan en niet nog eens uit de e-dienst:
 *
 * - het **aanvraagtype** (M0-item van de referentielijst Aanvraagtype) draagt
 *   de identificatie van het zaaktype (`zaaktypeIdentificatie`) en het
 *   onderwerp (`omschrijving`);
 * - de **naam van de e-dienst** is de omschrijving van het zaaktype.
 *
 * Een afleiding vult alleen wat de e-dienst niet zelf zet (`als: "ontbreekt"`),
 * behalve de identificatie: die komt altijd uit M0, en een afwijkende waarde in
 * de e-dienst of als identifier van het artefact is een fout (`als: "altijd"`).
 * Volgnummers van statustypen en informatieobjecttypen volgen de volgorde in de
 * e-dienst als ze er niet staan.
 *
 * De toetsen (welke bijlage van welk formulier in welk informatieobjecttype
 * landt, een initiator onder de roltypen, een selectielijstklasse per
 * resultaattype) staan in de aansluiting (zaaktypeArtefact.js); de regelset zet
 * het beleid.
 */

export const CANONIEK_NAAR_ZAAKTYPE = {
  id: "canoniek-naar-zaaktype",
  versie: "0.1.0",
  titel: "Canoniek model + e-dienst → zaaktype (Catalogi API)",
  bron: "canoniek-uml (V3) + referentielijst Aanvraagtype (M0) + e-dienst",
  doel: "catalogi-api-json",
  afleidingen: [
    {
      naam: "Identificatie uit het aanvraagtype (M0)",
      doel: "zaaktype.identificatie",
      uit: { referentielijst: "Aanvraagtype", veld: "zaaktypeIdentificatie" },
      als: "altijd",
    },
    {
      naam: "Onderwerp uit het aanvraagtype (M0)",
      doel: "zaaktype.onderwerp",
      uit: { referentielijst: "Aanvraagtype", veld: "omschrijving" },
      als: "ontbreekt",
    },
    {
      naam: "Omschrijving uit de naam van de e-dienst",
      doel: "zaaktype.omschrijving",
      uit: { edienst: "naam" },
      als: "ontbreekt",
    },
  ],
  volgnummers: [
    { naam: "Volgnummer statustype uit de volgorde", lijst: "zaaktype.statustypen", veld: "statustypevolgnummer" },
    { naam: "Volgnummer informatieobjecttype uit de volgorde", lijst: "zaaktype.informatieobjecttypen", veld: "volgnummer" },
  ],
};
