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

/**
 * Het voorbeeld van de Studio (Toegangverlening): de starttekst en "Voorbeeldbeleid laden".
 * Anders dan VOORBEELD_BELEID (de whitepaper, met "het inkomen van een natuurlijk persoon")
 * past dit beleid op het canonieke model van het register (np-loc: NatuurlijkPersoon met het
 * gegevenselement namen): het geeft geen controle-meldingen en levert een beleidsbundel.
 *
 * Wat de API er vandaag mee doet (proef, zie docs/TOEGANGSSPRAAK.md "Uitvoeren"): de regel
 * "inzage naam" werkt per record (rol uit het inlogtoken, achternaam van de betrokkene). Het
 * doel van het beleid staat als kopregel en niet als voorwaarde in de regel, omdat de API het
 * doel van de aanvraag nog niet doorgeeft; "geen export" wordt nog niet afgedwongen.
 */
export const VOORBEELD_STUDIO = `Beleid "Inzage naam bij schuldhulp".
  Geldig vanaf 1 mei 2026.
  Grondslag: de Wet gemeentelijke schuldhulpverlening.
  Doel: "schuldhulpverlening".

  Begrippen.
    Een schuldhulpverlener is: iemand met rol "schuldhulpverlener".
    Naamgegevens zijn: alle gegevens van de namen van een natuurlijk persoon.

  Regel "inzage naam".
    Een schuldhulpverlener mag de naamgegevens bekijken
    als de achternaam van de namen van de betrokkene met "A" begint
    waarbij: elke raadpleging wordt vastgelegd in het logboek.

  Regel "geen export".
    Een schuldhulpverlener mag de naamgegevens niet exporteren.
`;
