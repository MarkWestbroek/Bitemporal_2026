// @ts-check
/**
 * centraalVersies — de vastgepinde versies van de centrale projecten voor deze build van de Studio
 * (plan "Sidecar-project" §8, stap 5; besluit Mark 22-11: een release pint exact vast).
 *
 * Per soort een uitgebrachte versie ("X.Y.Z") of `null` (= starten uit de code, zoals tot nu toe).
 * Een nieuwe versie van het profielen- of weergaveproject in gebruik nemen = dit bestand bijwerken
 * en een release maken; de releasemelding noemt de versies ook. Zie `centraal.js`.
 */
export const CENTRAAL_VERSIES = {
  profielen: null,
  weergaven: null,
};
