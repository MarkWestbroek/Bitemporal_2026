# Taal als fundementeel aspect van data of onderdeel van het model?

Ik worstel met iets waarvan ik niet weet of het:
a. een basaal fundamenteel aspect van data (d.w.z. alle content data, dus tekst, uitleg, maar in feite ook landnamen en soms ook plaatsnamen (in Nederland zijn er in Friesland officieel 2 talen, in omringende landen ook: belgie, luxemburg, zwitserland, delen van Polen, enz.)) is, of
b. iets dat in elk register apart moet worden gemodelleerd op de manier die daar past.


## ad a
Aangezien ik in de stijl van het register data altijd vrij ver (eigenlijk meestal maximaal) uitnormaliseer, eindigt genoemde content data vaak als enige veld in een GE/REL.

### Toevoegen van een taal(-code) veld zou gemakkelijk zijn
Dan is de content per taal instelbaar (het zit in _data), en de hub blijft uniek.
Probleem is wel de multipliciteit: enkelvoudig zou dan moeten gaan betekenen: enkelvoudig in de tijd èn in de taal.
Zou dat een goede optie zijn om meertaligheid standaard (als het altijd volgens hetzelfde mechanisme gaat, is een standaard querystring parameter ook goed te doen)?

### Toevoegen van een `taligheid` of `content` aspect aan de core van het register
Bovenstaande nog meer formaliseren, is het toevoegen van het taal-aspect aan de core.
Vergelijk: `materieel` -> dat voegt een optionele aanvang en einde toe
`talige content` -> voegt een taal-veld toe naast de content. Multipliteit blijft wat ze is. Relaties zijn toch al formeel, UML-technisch, 0..* of 1..* (0..1 of 0..* kan eigenlijk niet, omdat er altijd formele versies mogelijk zijn), en alleen de `enkelvoudig` of `meervoudig` constraint zegt iets over de hoeveelheid GE's die er tegelijkertijd kunnen zijn.
Dat breidt dan uit naar: de hoeveelheid GE's die er tegelijkertijd en per taal kunnen zijn.


## ad b
In bijgaand diagram is het specifiek gemodelleerd. Dat kan soms voordelen hebben, bijv. hier, waar de Taalvariant een soort cluster is voor de verschillende Secties per taal. De Secties hebben geen taal meer nodig dan, omdat ze onder de Taalvariant vallen.

## a tegenover b
Maar met taal als filter over de data heen gelegd, zou je de hele Taalvariant niet nodig hebben, want het Kennisartikel kan dan 'talig' zijn. Klopt dat?


## De rest van de wereld
Hoe doet men dit 'in de rest van de wereld'?

Er zijn toch plenty applicaties, API's, CMS-en, die met dit zelfde probleem zitten of zaten. Is er lijn te ontdekken in hoe men dit doorgaans oplost?

Zijn er standaarden voor (behalve dan de land- of taalcodes), met name in het ontwerp en de architectuur?

Is er een standaard, of zijn er standaard taal-patronen (zoals design patterns of analysis patterns)?

Ik ben heel benieuwd!