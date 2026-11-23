# Architectuurbeslissingen (ADR's)

Besluiten over de architectuur van Omnium, één per bestand, in de vorm Context → Besluit → Gevolgen.
Eerst als document (Mark 23-11); later mogelijk als model in een ADR-profiel (familie van
Requirements; BACKLOG ADR-1), in het project *Omnium architectuur* (zie `../README.md`).

De eerste reeks is de wrap-up van 21–23 november 2026: de centrale projecten (plan *Sidecar-project
— weergaven en starten uit het project*), uitgebracht als api 0.32.0 / studio 0.48.0 / render 0.6.0.
Waar een besluit een voorstel van Claude was dat Mark niet tegensprak, staat dat bij *Besloten door*.

| Nr | Besluit | Status | Datum |
|---|---|---|---|
| [0001](0001-vier-soorten-project.md) | Vier soorten project: M1, weergaven, M2 + transformaties, M3 | Aanvaard | 2026-11-21 |
| [0002](0002-weergaven-als-profiel-reserve-in-code.md) | Weergaven als elementen in een eigen profiel; volledige reserve in de code | Aanvaard | 2026-11-21 |
| [0003](0003-centrale-plek-leestoken-vastpinnen.md) | Eén centrale plek; lezen met een leestoken; een release pint exact vast; een klant-centrale is een spiegel | Aanvaard | 2026-11-22 |
| [0004](0004-versie-alleen-omhoog-bij-uitbrengen.md) | De projectversie gaat alleen omhoog bij uitbrengen; daartussen is het een concept | Aanvaard | 2026-11-22 |
| [0005](0005-een-project-profielen-transformaties.md) | Eén project voor profielen en transformaties; de activiteiten zijn zichten | Aanvaard | 2026-11-22 |
| [0006](0006-profiel-is-container.md) | Een profiel is een container in het M3; diagrammen zijn views; de JSON is afgeleid | Aanvaard | 2026-11-22 |
| [0007](0007-klantaanpassing-als-delta.md) | Een klantaanpassing is een delta op de vastgepinde basisversie | Aanvaard | 2026-11-22 |
| [0008](0008-versiegraaf-onderhoudslijnen.md) | Een graaf van versies: semver per lijn, onderhoudslijnen, terugmergen | Aanvaard | 2026-11-22 |
| [0009](0009-rol-ontwerper-main-van-beheerder.md) | De ontwerper werkt in een branch; MAIN van een centraal project is van de beheerder | Aanvaard | 2026-11-21 |
| [0010](0010-transformaties-in-tussen-uit.md) | Transformaties: in, tussen of uit; een transformatie is een container | Aanvaard | 2026-11-23 |
| [0011](0011-profielen-ordenen-in-groepen.md) | Profielen in groepsmappen (voorlopige indeling) | Voorlopig | 2026-11-23 |
| [0012](0012-eerste-versie-1-0-0.md) | De eerste uitgebrachte versie is 1.0.0; het projectnummer staat los van de profielversies | Aanvaard | 2026-11-23 |
| [0013](0013-studio-opslag-gewone-tabellen.md) | De opslag van de Studio blijft voorlopig in gewone tabellen, niet in het register | Aanvaard | 2026-11-23 |
| [0014](0014-weergave-en-sidecar-als-eigen-project.md) | Het weergave- en sidecar-project open je altijd als eigen project | Aanvaard | 2026-11-22 |

## Nieuwe ADR

Volgnummer + korte slug (`0015-…md`), met de kopjes Status, Datum, Besloten door, Context, Besluit,
Gevolgen en Bronnen. Een vervangen besluit krijgt status *Vervangen door ADR-xxxx*; het blijft staan.
