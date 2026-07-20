# Ideas for STUDIO
## Layout
| # | Status | Item | Bron |
|---|------|------|------|
| L01 | done | front-back postition elements | z-order |
| L02 | | make same size / height/ width | selecteer een of meer plus nog één: die laatste is de bronsize |
| L03 | done? | override normalisatie (clip) | soms wil je normalisatie overriden en een edge vastclippen op een bepaalde plek |


## Graphical design
| # | Status | Item | Bron |
|---|------|------|------|
| G01 | | shapes format (svg) or handler | Hoe zit dit? Kun je zelf een shape uploaden? |
| G03 | | font | zelf instellen ergens in shape of andere handler editor? |
| G04 | | | |
| G05 | | | |

## Project browser, Tree
| PB01 | elementen ook first citizen in PB| zoals in IDE | |
| PB02 | element | rechtsklik : vind op diagrammen -> modal met klikbare diagrammenlijst | | |
| PB0 | | | |
| PB0 | | | |
| PB0 | | | |
| PB10 | diagram verwijderen (met rechtsklik | bewerken menu) | | |
| PB11 | diagram rechtsklik: verplaats alle element uit dit diagram naar de boom | een ordenings-feature | |
| PB0 | | | |
| PB0 | | | |
| PB0 | | | |
| PB0 | | | |


## Profiel-editor
| # | Status | Item | Bron |
|---|------|------|------|
| P01 | done | Bewaar meerdere profielen  | na kan er maar 1 tegelijk. Alle profielen zouden moeten kunnen worden getoond en los geexporteerd - geimporteerd |
| P02 | done | Concept van hierarchie definieren | Soms (vaak) geldt er in een model een hierarchie. Deze zou moeten worden vastgelegd in het profiel. De tree browser kan die gebruiken. |
| P02 | | 'placement handlers' / renderer/ resolver of andere in code uitgedrukte vormgeving / plaatsing / ophalers (ding bijv. dat de props in de graaf rondom de bol zet) niet alleen op naam gekoppeld maar duidelijk zichtbaar en editable | welke er zijn is zichtbaar in de profile editor (apart subschermpje of modal) met naam, beschrijving en (optionele) illustratie? |
| P03 | | Ook autoroute? | waarom niet ook autoroute in de profiel editor? |
| P04 | | Profielen zo persisteren dat ze via git ook op andere dev implementaties terecht komen | Inclusief layout en iconenset |
| P05 | | Het activiteit-icoon zichtbaar (wijzigbaar) bij het profiel  | N.B. ook git-gepersisteerd |
| P06 | | De shape en het toolbar-icoon zichtbaar in de PE | wijzigbaar en git-gepersisteerd |
| P07 | | Moeilijker: meerdere sets shapes voor 1 profiel mogelijk maken: bijv. MIM-modern, MIM-UML-stijl, MIM-experimenteel | Vraag: losse shape editor? |
| P08 | | |  |
| P09 | | |  |

## Editor en IDE binnen Studio = edit een diagram (inclusief het profiel-editor diagram)
| # | Status | Item | Bron |
|---|------|------|------|
| E01 | done | Concept van hierarchy in tree-browser kunnen aanzetten | nu is de tree van de configureerbare profielen plat. Als er een hierarchie in de elementtypen zit, kan deze genest, zoals nu de IDE-editor's tree |
| E02 |  | Bron uiteinde vastzetten ook met de muis mogelijk | pakken, lostrekken, vastzetten op andere plek |
| E03 |  | Aantal handles kunnen vergroten | Nu alleen NOZW, maar ook daartussenin. Misschien handle-size iets verkleinen. |
| E04 |  | Handle rondje kunnen verbergen | Of alleen zichtbaar |
| E05 | done | copy selectie naar clipboard (als svg?)  | |

## transformaties
| T01 | | markdown export: ook diagrammen mee-exporteren |  |
