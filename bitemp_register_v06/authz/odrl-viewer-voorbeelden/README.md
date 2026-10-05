# Voorbeelden voor de ODRL-viewer — van klare taal naar ODRL

Drie stukken toegangsbeleid zoals wij ze schrijven, in **Toegangsspraak** (gecontroleerde
klare taal uit Omnium Studio), en wat de vertaling naar ODRL daarvan maakt. Bedoeld om in de
[ODRL-viewer](https://vng-realisatie.github.io/ftv/odrlvis/) van de werkgroep FTV te laden,
naast de voorbeelden Vlierdam en Breda.

| Voorbeeld | Laat zien | Bron in klare taal | Voor de viewer |
|---|---|---|---|
| **Inzage inkomen bij schuldhulp** | toestemming met doel en een voorwaarde op de inhoud, een plicht, een verbod, begrippen, geldigheid en grondslag | [`beleid/schuldhulp.toegangsspraak`](beleid/schuldhulp.toegangsspraak) | [`uit/schuldhulp.viewer.ttl`](uit/schuldhulp.viewer.ttl) |
| **Persoonsgegevens np-loc demo** (FTV-demo 15-09) | groepen bepaald door meer kenmerken, een keten over relaties heen ("de wijk van de woonlocatie van de betrokkene"), een verbod op één gegeven | [`beleid/np-loc-demo.toegangsspraak`](beleid/np-loc-demo.toegangsspraak) | [`uit/np-loc-demo.viewer.ttl`](uit/np-loc-demo.viewer.ttl) |
| **GBO persoon** (het voorbeeld uit het FTV GraphQL-profiel) | het register tot op veldniveau uit het model, een bestaansvraag, een argument-voorwaarde, en per regel de **realisatie** door een gegenereerde Rego-module | [`beleid/gbo-persoon.toegangsspraak`](beleid/gbo-persoon.toegangsspraak) | [`uit/gbo-persoon.viewer.ttl`](uit/gbo-persoon.viewer.ttl) |

Elk `.viewer.ttl` begint met de oorspronkelijke tekst als commentaar. Daarnaast staat per
voorbeeld `uit/<naam>.odrl.jsonld`: wat de editor vandaag exporteert, ter vergelijking.

## Zo schrijven wij het

```
Beleid "Inzage inkomen bij schuldhulp".
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
```

Eén kernzin draagt de taal: *wie* mag *wat* *doen* — of mag het niet — *als* … *waarbij* ….
Elke zin heeft precies één betekenis; de editor ontleedt hem en bewaakt hem tegen het model.

## Zo wordt het ODRL

| In de klare taal | In ODRL | Waarom zo |
|---|---|---|
| `Beleid "…"` | `odrl:Set` met `dct:title`, `odrl:uid`, `odrl:profile apnl:profiel` | |
| `Geldig vanaf …` | `schema:validFrom` (`xsd:date`), publicatie als `dct:issued` | Visualisation Note §5 |
| `Grondslag: …` | `dpv:hasLegalBasis` naar een benoemde bron | zoals het Breda-voorbeeld; nog zonder wetten.overheid.nl-IRI |
| `Regel "…"` + mag / mag niet | `odrl:Permission` / `odrl:Prohibition` met `odrl:uid`, `dct:title` en **de zin zelf als `dct:description`** | Note §1, §2 — de regel leest in de viewer zoals hij geschreven is |
| het werkwoord (bekijken) | een handeling met `rdf:value odrl:read`; eigen woorden (exporteren) als term met label | ODRL wint waar het een woord al kent |
| `Een schuldhulpverlener is: iemand met rol …` | `odrl:PartyCollection` met de kenmerken als `odrl:refinement`; dezelfde benoemde voorwaarde is ook verfijning op de handeling | de groep is bepaald door haar kenmerken; de regel toetst ze op het verzoek (`apnl:rolAanvrager`) |
| `Doel: …` en "het doel van de aanvraag is …" | `odrl:purpose odrl:eq <begrip>` als verfijning op de handeling van elke toestemming | ODRL-AP-NL: doel is een kenmerk van het verzoek. Een verbod krijgt hem niet: dat geldt ongeacht het doel |
| voorwaarde over de aanvraag of de aanvrager | `odrl:refinement` op de handeling | te toetsen vóór de bron iets ophaalt |
| voorwaarde over de betrokkene of een veldwaarde, en "er is een …" | `odrl:constraint` op de regel | pas te toetsen met de gegevens in handen, of een vraag aan een informatiepunt |
| "aan ten minste één van de volgende voorwaarden" | `odrl:LogicalConstraint` met `odrl:or ( … )` in tekstvolgorde | |
| `waarbij: …` | `odrl:Duty` met de zin als titel | |
| `Inkomensgegevens zijn: alle gegevens van …` | `odrl:AssetCollection`; het registerdeel hangt eronder met `odrl:partOf` | zoals de veldcollecties in het Vlierdam-voorbeeld |
| "de naam van een persoon" | `odrl:Asset` per pad in het model (`Persoon`, `Persoon.Naam`, `Persoon.Naam.naam`), met `odrl:partOf` en een niveau-klasse (entiteit, gegevenselement, veld) | Note §3 |
| elke operand, vergelijking en handeling die ODRL niet kent | een term in de eigen woordenschat (`ts:`), **met de zinsnede uit de klare taal als label** | Note §1: namen komen uit de data. Onze taal ís die naamgeving |

Het punt van dit alles: **de labels hoeven niet bedacht te worden.** "De achternaam van de naam
van de betrokkene" is tegelijk wat de beleidsmaker schreef en het `rdfs:label` van de operand.

### Realisatie (alleen het GBO-voorbeeld)

Uit dezelfde ODRL genereert `authz/gbo-voorbeeld/` Rego-modules voor het FTV GraphQL-profiel.
Die staan hier als `apnl:RegoModule` (met `apnl:entrypoint` en `apnl:sha256` van het echte
bestand), elk met een anker in de vorm van ODRL-AP-NL: `apnl:verwerkingsverzoek
apnl:conformsToPolicy <module>`, getypeerd `dpv:TechnicalMeasure`, met `prov:wasDerivedFrom`
naar de regel en naar de voorwaarden die de module echt toetst (Note §7). De doelbinding van
het beleid zit niet in de Rego en blijft dus zichtbaar als niet gerealiseerd.

## Bekijken

De viewer leest een bron via `?src=`. Zet de drie `.viewer.ttl`-bestanden ergens waar de viewer
erbij kan (naast de app, of een eigen webadres) en open bijvoorbeeld:

```
…/odrlvis/?src=<pad-of-url>/gbo-persoon.viewer.ttl&lang=nl
```

Met de profielbundel van ODRL-AP-NL erbij (`data/profile.json` naast de app) herkent de viewer
de Rego-modules als artefacten en toont hij het realisatieteken per regel en voorwaarde.

## Opnieuw maken

```
node scripts/maak_voorbeelden.mjs
```

Het script is alleen de runner. De vertaling zelf staat in `web/vite/src/toegangsspraak/`
(`graaf.js`, `odrlApNlRegels.js`, `odrlExport.js`) en volgt de transformatievorm
graafbeeld → regelset → schrijver uit `docs/TRANSFORMATIES.md` §8. De regelset is data: wie een
andere afbeelding wil (een ander profiel, een andere plek voor de rol), past daar regels aan.

## Wat wij ons afvragen

1. **Rol: verfijning op de handeling, op de groep, of allebei?** ODRL-AP-NL zet
   `apnl:rolAanvrager` op de handeling; het Vlierdam-voorbeeld zet `afdeling` op de
   PartyCollection. Wij doen nu beide met dezelfde benoemde voorwaarde, zodat de viewer de groep
   als groep toont. Is dat dubbelop, of juist de bedoeling?
2. **Voorwaarden op de inhoud** ("de achternaam … begint met A") kan een beslispunt vóór het
   koppelvlak niet toetsen. Wij zetten ze als `odrl:constraint` op de regel en de
   verzoek-voorwaarden als verfijning. Is dat onderscheid in ODRL-AP-NL bedoeld als het
   onderscheid tussen "aan de poort" en "in de bron"?
3. **Eigen woordenschat.** Wat Toegangsspraak meer nodig heeft dan ODRL en ODRL-AP-NL staat nu
   onder `ts:` met een eigen `odrl:Profile`. Welke termen horen in het profiel zelf (begint met,
   is bekend, bestaat)?
4. **De bestaansvraag** ("er is een toestemming voor de betrokkene") is bij ons een operand met
   de vergelijking `ts:bestaat`. Is daar in de werkgroep al een vorm voor, bijvoorbeeld bij
   toestemming als eigen beleid van de burger?
5. **Het register als assets.** Onze paden komen uit het model (entiteit, gegevenselement,
   veld). Sluit dat aan op hoe DCAT-AP-NL de dataset en zijn distributies beschrijft, of horen
   de assets daaronder te hangen?
