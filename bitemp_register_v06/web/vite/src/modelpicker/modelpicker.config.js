// modelpicker.config.js — configuratie voor de canonieke modelbrowser.
// Deze file bepaalt welke domeinen standaard niet worden getoond en of de
// domeintak standaard geopend moet zijn.

export const modelPickerConfig = {
  hiddenDomains: [
    // Plumbing-achtige domeinen die niet relevant zijn voor de proces-/regel-
    // editor demo's.
    "configuratie",
    // ABUVWXY is een test/referentiedomein en mag standaard verborgen blijven.
    "abuvwxy",
  ],
  // De domeintak mag default gesloten zijn in de browser.
  defaultExpandDomeinen: false,
  // Entiteiten mogen standaard alleen open zijn wanneer een domein wordt
  // uitgeklapt; gebruik expandEntiteiten om dat te beïnvloeden.
  defaultExpandEntiteiten: false,
};
