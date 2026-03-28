Op basis van deze file en nog een boel extra informatie die ik getypt heb, maar die onbereibaar is geworden. Hebben we fase 1 en 2 (niet helemaal duidelijk hoever) geimplementeerd.

Ik heb ook fase 3 deels getest, maar er is ook wat gerollbackt dus ik moet dat opnieuw doen.

In ref lijsten.md heb ik ook UML diagrammen (mermaid) toegevoegd, omdat het e.e.a. rond de Referentielijst _klasse_ en de Referentielijst-X instantie (bijv. Landenlijst), dat een object is, of een record in de database.

Nu is er een Landenlijst in de Metaregistry, als struct en met aanvang en einde structs.

BELANGRIJK: dit is fout. Dit zou de Referentielijst klasse moeten zijn. De landenlijst is een instantie van deze klasse, oftewel een record in de Referentielijst tabel.
Het makkelijkst lijkt mij om
1. Landenlijst te refactoren naar Referentielijst
2. de tabel "register_referentielijst" daaraan te koppelen via de bun tag, om hem duidelijk een register (systeem) tabel te laten zijn, ook als ie registratietechnisch gewoon een entiteit. 

Het type #sym:RegisterReferentielijst  is daarom ook fout. Deze zou eenvoudigweg moeten worden  geimplementeerd door de Referentie entiteit, en kan dus weg.
- Wat dan wel nog moet gebeuren is de naam en beschrijving in RegisterReferentielijst omzetten naar een Referentielijstnaam en Referentielijstomschrijving gegevenstype onder Referentielijst (zie de UML diagrammen in deze md file).
- Tevens moet er op een andere manier gesynchroniseerd worden met de model json V3 die van de editor frontend of uit de DB komt.
- ook moeten de bestaande objecten, instanties, van referentielijst (dus bijv. de landenlijst, de EU-lidstatenlijst, een plantenlijst, enz.) nog ergens in de metaregistry landen.
- VRAAG: hoe staan deze nu in de model json V3?

De plaats van de structs in ref_modellen_*** is ook fout: deze horen gewoon in het np-loc model, dus bij de respectievelijke np_loc_modellen_*** .

De referentielijsten zijn "first class citizens" van een model (zoals np-loc). Net zoals de enums en gegevenstypen.

OPMERKING: ik moet nog wel nadenken over cross model referenties, aangezien we juist meerdere modellen in één register kunnen combineren. Als referentielijsten en gegevenstypen generiek zijn voor een register, moeten ze ook in een generiek model gestopt en moeten de niet-generieke modellen daar bij kunnen. Zowel in go als in de editor. Dat is een volgende iteratie, maar wel belangrijk om in gedachten te houden.

## koppeling tussen een landenlijst instantie en een relatieklasse van het subtype "referentielijstitems" (#sym:RelatieSubtypeReferentielijstItems )
Hier wordt het interessant.

Mijn inzicht / ontwerp is als volgt.
- een referentielijstitems-relatieklasse (bijv. LandenlijstLand (*)) is gewoon een relatie met dit verschil:
   - de *Primaire* ENT ID is voor alle instanties in deze relatie dezelfde, namelijk de ID van de referentielijstinstantie (hier Landenlijst, in het voorbeeld in de md ID=3).
   - Dit is dus een constraint en extra informatie die in de editor moet worden opgeslagen.
   - En daar visueel gemaakt door het trekken van een lijn tussen een referentielijstitems-relatie en een referentielijst-instantie. De referentielijstinstanties moeten er dus uitzien als een soort ENT, maar zonder het label "entiteit".
   - Het label is heel specifiek "Referentielijst" met een naam zoals "Landenlijst" en een opmerking-veld. Die naam en opmerking mappen dus naar de gegevens in de twee GEn onder Referentielijst (Referentielijstnaam en Referentielijstopmerking).
   - Deze constructie staat ons toe om de naam van een Referentielijst en de opmerking erover los te wijzigen, indien gewenst zowel over de materiele als de formele as.

We moeten plannen hoe deze veranderingen door te voeren, en kijken naar wat er nu al wel gemaakt is.
- er was bijv. misschien al iets van een routine om de informatie over een referentielijstinstantie uit het json model V3 te halen en in de database te stoppen indien die er nog niet in zit. Maar deze databasestructuur is dus sowieso verkeerd; zie boven.

Veranderingen zitten in:
- conceptuele achtergrond
- model json V3
- editor
- Metaregistry
- structs
- indeling bestanden in model map
- database instantiatie bij start en sync met metaregistry

Daarna moet ook de generator nog aangepast, maar pas nadat we weten dat de constructie zoals we hem neergezet hebben, werkt.

Dit vergt planning. Wil je die planning maken?

Wil je deze ook **uitgebreid** en **in detail** vastleggen in een implementatieplan-referentielijsten.md (of hoe jij dat doorgaans doet) zodat ik dat bij een crash van copilot o.i.d. kan vervolgen zonder problemen? Dus i.i.g. zo gedetailleerd, dat ik dit niet opnieuw moet gaan plannen en uitzoeken.

----

(*) naamgevingsconventie voor gewone klassen (dus entiteiten, relaties, gegevenselementen) zou moeten zijn:
- zonder underscores: underscores worden door systeemacties gebruikt: _Data _Aanvang  enz.
- Pascal casing dus WoordNogEenWoord
- Nederlands kan lange woorden hebben: bijv. Ondercuratelstelling

