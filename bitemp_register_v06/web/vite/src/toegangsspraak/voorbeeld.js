/**
 * voorbeeld.js — het voorbeeldbeleid uit de whitepaper, in canonieke
 * Toegangsspraak. Dit is exact wat de renderer produceert (round-trip-anker
 * in de tests) en de starttekst van de Studio-activiteit.
 */
export const VOORBEELD_BELEID = `Beleid "Inzage inkomen bij schuldhulp".
  Geldig vanaf 1 mei 2026.
  Grondslag: de Wet gemeentelijke schuldhulpverlening.
  Doel: "schuldhulpverlening".

  Begrippen.
    Een schuldhulpverlener is: iemand met rol "schuldhulpverlener".
    Inkomensgegevens zijn: alle gegevens van het inkomen van een natuurlijk persoon.

  Regel "inzage bij lopend dossier".
    Een schuldhulpverlener mag de inkomensgegevens bekijken
    als aan alle volgende voorwaarden is voldaan:
      - het doel van de aanvraag is "schuldhulpverlening";
      - de achternaam van de naam van de betrokkene begint met "A";
    waarbij: elke raadpleging wordt vastgelegd in het logboek.

  Regel "geen export".
    Een schuldhulpverlener mag de inkomensgegevens niet exporteren.
`;
