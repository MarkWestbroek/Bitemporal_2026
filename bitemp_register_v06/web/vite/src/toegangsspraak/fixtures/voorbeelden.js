// Voorbeeldbeleiden voor de export- en de importtest (odrlExport.test.js, odrlImport.test.js).
import { VOORBEELD_BELEID } from "../voorbeeld.js";

// De FTV-demo (15 september 2026): relatieketen, eigen vergelijking, verbod.
export const DEMO_BELEID = `Beleid "Persoonsgegevens np-loc demo".
  Geldig vanaf 15 september 2026.
  Grondslag: de Gemeentewet.
  Doel: "dienstverlening".

  Begrippen.
    Een medewerker is: iemand met rol "medewerker".
    Een medewerker West is: iemand met rol "medewerker" en afdeling "West".
    Een telefoonmedewerker is: iemand met rol "medewerker" en kanaal "telefoon".
    De persoonsgegevens zijn: alle gegevens van een natuurlijk persoon.

  Regel "inzage eigen stadsdeel".
    Een medewerker West mag de persoonsgegevens bekijken
    als de wijk van de woonlocatie van de betrokkene "Stadsdeel West" is.

  Regel "avonddienst gemeentebreed".
    Een medewerker mag de persoonsgegevens bekijken
    als de dienst van de aanvrager "avond" is.

  Regel "geen geslacht aan de telefoon".
    Een telefoonmedewerker mag het geslacht van een natuurlijk persoon niet bekijken.

  Regel "aanspreken zonder geslacht".
    Een telefoonmedewerker mag de aanspreektitel van de aanspraak van een natuurlijk persoon bekijken
    als de aanspreektitel van de aanspraak van de betrokkene bekend is.
`;

// Het GBO-voorbeeld: bestaansvraag, argument-voorwaarde, begrip voor gegevens.
export const GBO_BELEID = `Beleid "GBO persoon".
  Doel: "inkomensverstrekking".

  Begrippen.
    Een afnemer is: iemand met rol "afnemer".
    Een geautoriseerde afnemer is: iemand met autorisatie "naam-en-adres".
    Inkomensgegevens zijn: alle gegevens van het inkomen van een persoon.

  Regel "persoon op bsn".
    Een afnemer mag alle gegevens van een persoon bekijken
    als er een toestemming voor de betrokkene is.

  Regel "inkomens tot en met 2024".
    Een afnemer mag de inkomens van een persoon bekijken
    als het jaar van de aanvraag ten hoogste 2024 is.

  Regel "inkomen velden".
    Een geautoriseerde afnemer mag de inkomensgegevens bekijken.
`;

// Geneste voorwaarden, lijst, datum, plicht, inline-wie.
export const RIJK_BELEID = `Beleid "Rijk".

  Regel "genest".
    Iemand met rol "beheerder" mag de naam van een natuurlijk persoon veranderen
    als aan alle volgende voorwaarden is voldaan:
      - het kanaal van de aanvraag is een van ("balie", "post");
      - aan ten minste één van de volgende voorwaarden is voldaan:
        - de geboortedatum van de betrokkene is kleiner dan 1 januari 2000;
        - de leeftijd van de betrokkene is ten minste 67;
    waarbij: de reden van de wijziging wordt vastgelegd bij de registratie.
`;

// De superpolicy, waarvan bij een begrip, "voor …" bij een bestaansvraag en een verwijzing als rechterterm.
export const VOLLEDIG_BELEID = `Beleid "Volledig".
  Standaard: toestaan.
  Bij conflict: de eerste regel geldt.

  Begrippen.
    Een behandelaar is: iemand met rol "behandelaar".
    Het dossier is: alle gegevens van het dossier van een cliënt waarvan de status van de gegevens "open" is.

  Regel "eigen afdeling".
    Een behandelaar mag het dossier bekijken
    als aan alle volgende voorwaarden is voldaan:
      - de afdeling van de betrokkene is de afdeling van de aanvrager;
      - er is een behandelrelatie voor de betrokkene.
`;

export const VOORBEELDEN = { schuldhulp: VOORBEELD_BELEID, demo: DEMO_BELEID, gbo: GBO_BELEID, rijk: RIJK_BELEID };
