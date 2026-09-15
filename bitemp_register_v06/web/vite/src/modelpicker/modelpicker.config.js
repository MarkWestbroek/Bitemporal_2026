// modelpicker.config.js — configuratie voor de canonieke modelbrowser.
// Deze file bepaalt welke domeinen standaard niet worden getoond en of de
// domeintak standaard geopend moet zijn.

export const modelPickerConfig = {
  hiddenDomains: [
    // Plumbing-achtige domeinen die niet relevant zijn voor de proces-/regel-
    // de basistabel voor referentielijsten, maar geen bruikbare data voor een proces 
    "configuratie",
    // IDE-bestanden, idem plumbing voor de IDE
    "ide-bestanden",
    // ABUVWXY is een test/referentiedomein en mag standaard verborgen blijven.
    "abuvwxy"    
  ],
  // Doorkijk over relaties: hoeveel hops naar een andere entiteit standaard in
  // de boom worden meegenomen. 0 = alleen de eigen GE's en relaties van een
  // entiteit. Activiteiten die ketens over registers heen nodig hebben (zoals
  // de toegang-activity, met "de wijk van de woonlocatie van …") zetten dit
  // per picker hoger via de prop `relatieDiepte`.
  defaultRelatieDiepte: 0,
  // De domeintak mag default gesloten zijn in de browser.
  defaultExpandDomeinen: false,
  // Entiteiten mogen standaard alleen open zijn wanneer een domein wordt
  // uitgeklapt; gebruik expandEntiteiten om dat te beïnvloeden.
  defaultExpandEntiteiten: false,
};
