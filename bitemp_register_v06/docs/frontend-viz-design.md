# FrontEnd Viz Design

Dit document legt de huidige ontwerpkeuzes vast voor de index-visualisatie in de frontend. De focus ligt op een rustiger, informatie-hiërarchisch sterker beeld van entiteiten, gegevenselementen, relaties en registraties.

## Doel

De visualisatie moet in een oogopslag antwoord geven op drie vragen:

1. Wat is het hoofdobject?
2. Wat is de menselijk leesbare samenvatting daarvan?
3. Welke onderliggende representaties horen erbij?

Daarom krijgt niet elk veld evenveel visueel gewicht. De kleur van een kaart draagt al veel type-informatie, dus tekst hoeft dat niet nogmaals zwaar te herhalen.

## Algemene ontwerpprincipes

- De belangrijkste regel is: het afgeleide weergaveveld trekt als eerste de aandacht.
- Type-aanduiding en ID blijven zichtbaar, maar kleiner en rustiger dan de hoofdtekst.
- Redundante foreign keys worden niet getoond als de visuele koppeling ze al duidelijk maakt.
- Een expliciet `IsWeergaveVeld == true` overschrijft losse veldsamenvattingen.
- Samenvattingstekst blijft compact en toont hooguit enkele relevante velden.
- `opvoer` en `afvoer` zijn functioneel, maar mogen visueel niet concurreren met inhoudelijke gegevens.

## Entiteitskaart

De entiteitskaart is het visuele anker van de index-pagina.

- Als een entiteit een afgeleid weergaveveld heeft, wordt dat de hoofdregel van de kaart.
- Die hoofdregel staat gecentreerd en duidelijk groter dan de rest.
- De entiteitsnaam en ID blijven zichtbaar op een tweede, veel rustigere regel.
- Als er geen weergaveveld bestaat, valt de kaart terug op het klassieke patroon: type + ID als primaire tekst.

Voorbeeld gewenst beeld:

- `Sanne van Dalen`
- `NatuurlijkPersoon · id 1`

Niet gewenst als primair beeld:

- `NatuurlijkPersoon id=1` groter dan de feitelijke naam

## GE-kaarten

Gegevenselementen moeten leesbaar zijn, maar ondergeschikt blijven aan de centrale entiteit.

- De GE-typeaanduiding staat vooraan en in lichte nadruk.
- `rel_id` blijft zichtbaar, maar in klein en gedempt schrift.
- Als het type een afgeleid weergaveveld heeft, wordt dat direct onder de titel getoond.
- Als er geen weergaveveld is, wordt een compacte veldsamenvatting gebruikt.
- De parent-entiteit-ID wordt niet getoond in de samenvatting als die kaart al zichtbaar aan de entiteit hangt.

Concreet betekent dit:

- `natuurlijkpersoon_id`, `a_id`, `b_id` en vergelijkbare owner-kolommen horen niet in de GE-samenvatting.
- Tijdvelden zoals `opvoer`, `afvoer`, `aanvang` en `einde` horen niet in de kernsamenvatting.
- De samenvatting toont alleen inhoudelijke velden.

## Relatiekaarten

Relaties volgen dezelfde leeshiërarchie als GE-kaarten, met een extra regel voor de tweede entiteit.

- De relatienaam is leidend.
- `rel_id` is ondersteunend en visueel rustig.
- Als er een weergaveveld is, krijgt dat voorrang op losse velden.
- Zowel de primaire entiteit-ID als de secundaire entiteit-ID worden uit de losse samenvatting gefilterd als de relatiekaart al visueel gekoppeld is.
- De secundaire entiteit blijft apart zichtbaar als klikbaar label of badge.

Daarmee voorkomen we dubbeling zoals:

- in de samenvatting `locatie_id=8 | natuurlijkpersoon_id=8`
- terwijl de kaart al aan de centrale entiteit hangt en de secundaire entiteit al apart zichtbaar is

## Registratieblok

Het registratieblok toont formele wijzigingen en moet vooral de structuur van de registratie uitleggen.

- `Reg id` en `t` blijven duidelijk zichtbaar in de kop.
- `opvoer` en `afvoer` worden kleiner en rustiger getoond dan voorheen.
- De wijzigingssoort is een statuslabel, geen hoofdkop.
- Entiteit en representatie blijven afzonderlijk leesbaar.
- Als een wijziging over een data-, aanvang- of einde-record gaat met versie-identiteit, dan moet de versie zichtbaar zijn.

Voor representatie-identificatie geldt:

- reguliere hub/relatie-records: toon representatienaam + `representatie_id`
- versiegebaseerde records: toon representatienaam + `representatie_id` + `v<versie>`

Voorbeeld:

- `Data: 1 v2`
- `Aanvang: 1 v1`

## Regelset voor samenvattingsvelden

De compacte veldsamenvatting is alleen fallback, en volgt deze regels:

1. Sla technische sleutelvelden over.
2. Sla temporale plumbing-velden over.
3. Sla owner-FK's over als de visuele structuur die relatie al laat zien.
4. Sla secundaire entiteit-FK's over als die al als losse badge zichtbaar zijn.
5. Toon slechts een klein aantal inhoudelijke velden.

De samenvatting is dus nadrukkelijk geen dump van alle primitieve velden.

## Hiërarchie per kaarttype

Visuele prioriteit, van hoog naar laag:

1. Afgeleid weergaveveld
2. Type-aanduiding
3. Eigen ID of `rel_id`
4. Compacte inhoudelijke samenvatting
5. Formele metadata zoals `opv`, `afvoer`, versie-indicatie

Opmerking: in het registratieblok is versie geen ruis maar functioneel onderdeel van de identificatie van sommige representaties.

## Kleurgebruik

- Kaartkleur symboliseert het type en blijft daarom belangrijk.
- Tekst hoeft type-informatie niet te zwaar te herhalen als de kleur dat al ondersteunt.
- Sterke typografische nadruk wordt gereserveerd voor inhoud met betekenis voor de gebruiker, vooral namen en weergaveteksten.

## Toepassing in code

Deze ontwerpkeuzes zijn nu verwerkt in de index-visualisatie:

- entiteitskaart: afgeleid weergaveveld als hero-regel, type + ID subtiel eronder
- GE-kaarten: owner-ID's uit samenvatting gefilterd
- relatiekaarten: redundante primaire en secundaire ID's uit samenvatting gefilterd
- registratievisual: kleinere wijzigingslabels en zichtbare versie-indicatie waar relevant

Relevante implementatiebestanden:

- `web/vite/src/components/index/IndexRepresentatieVisual.jsx`
- `web/vite/src/components/index/IndexRegistratieVisual.jsx`
- `web/vite/src/components/tijdlijn/TijdlijnRepresentatiePaneel.jsx`
- `web/vite/src/components/tijdlijn/TijdlijnRegistratiePaneel.jsx`
- `web/vite/src/shared/schemaUtils.js`

Deze regels zijn inmiddels niet alleen in de index-visualisatie toegepast, maar ook in de tijdlijnvisualisatie. De replay-schermen gebruiken geen afzonderlijke kaartstijl met een afwijkende hiërarchie; waar zij dezelfde representatiepanelen gebruiken, geldt dus dezelfde ontwerpfilosofie.

## Ontwerpgrens

Deze visualisatie is geen generieke tabellaire inspectie. Het is een leesvisualisatie. Dat betekent:

- minder nadruk op volledigheid per kaart
- meer nadruk op herkenning, context en betekenis
- details mogen pas zichtbaar worden in interactie of in bewerkdialogen

Als deze ontwerpfilosofie later wordt uitgebreid naar tijdlijn- of replay-schermen, dan moet dezelfde informatie-hiërarchie behouden blijven.