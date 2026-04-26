# refactoring UML import
Ik zou de UML import wat willen refactoren en uitbreiden.

## editor-v2 en IDE
Allereerst: zit deze nu enkel in de editor-v2? Ik dacht dat we het zo gemaakt hadden dat het ook voor de IDE kan werken, maar ik vind het niet (meer). Dat kan regressie zijn die ik niet opgemerkt heb. Wil je dat onderzoeken?

Dan: kunnen we de functionaliteit ook in de IDE maken? Eigenlijk wil ik dat dezelfde code gebruikt wordt, zodat bij uitbreiding van de import beide pagina's meeprofiteren. Als dat heel moeilijk is, dan hoor ik dat graag. Het moet wel duidelijk, onderhoudbaar, logisch en leesbaar blijven.

## casting naar GE/rel enz.
Als ik een (mermaid of XMI) uml diagram importeer, wordt elke klasse een ENT. Dat is op zich okee, want de import code kan dat niet weten.
Er zijn twee manieren waarop ik dat zou willen uitbreiden:
1. Door met een stereotype in de UML aan te kunnen geven wat de klasse moet worden in Metamodel termen.
    - stereotypen: entiteit, gegevenselement, relatie enz.
    - enum is al een standaard uml element
    - associatie-klasse wordt nu al een relatie
    - afgekort moet ook mogelijk zijn: ent, ge, rel, reflijst, reflitem
2. Een tweede manier is om via de UI een entiteit uit te pakken naar een ENT plus 1 of meer GE's
    - dit vraagt een dialoog:
        - per attribuut moet de gebruiker kunnen aangeven of dit attribuut een GE moet worden en met welke naam dan. Default krijgt elk attribuut een eigen GE met maar 1 veld. Maar de user kan de naam van de te maken GE overriden naar een andere, of naar een al bestaande: dan komen beide attributen in dat GE.
        - multipliciteit moet ook aangegeven kunnen worden. Default volgt wat eventueel bekend is:
            - optioneel veld: 0..* enkelvoudig
            - verplicht veld: 1..* enkelvoudig
            - arrays worden meervoudig (maar dat komt eigenlijk weinig voor in UML)

### opslaan tijdelijke toestand
Een probleem nu (in de editor-v2) is dat de toestand na import niet juist wordt opgeslagen als json V3 file. Ik vermoed dat dat is omdat entiteiten geen velden mogen bevatten.
Zou het mogelijk zijn de toestand van de editor-v2 op te slaan zoals ze is? Als ik nu opsla als bestand, en dan het bestand weer inlees, krijg ik veel minder te zien.
- Bestand dat is ingelezen: kennis-api-UML.md (mermaid) -> img 1
- opgeslagen: kennis v0.1.1.json
- na inlezen: img 2


====

So the IDE only has bestand/api import — no Mermaid/PlantUML/XMI. Let me now check pages directory for editor-v2 and find import handlers:

Now let me see the v3 export to understand the entity-with-fields issue:

Now I have enough context. Let me investigate the import code briefly for the IDE:

Voordat ik aan de slag ga: dit is een groot refactor met meerdere subtaken én één duidelijke ontwerpkeuze die ik graag eerst met je afstem. Hier is mijn analyse + plan.

Onderzoek
1. Mermaid/PlantUML/XMI import zit alleen in editor-v2 (UML-editor), niet in de IDE
Editor-v2 (umleditor/components/MetamodelEditor.jsx) heeft handleImportMermaid/PlantUML/XMI die importVan*() uit umleditor/import/*.js aanroepen en het resultaat ({nodes, edges}) via applyLoadedGraph in de canvas-state zetten.
IDE (pages/IdePage.jsx + ide/ImportDialog.jsx) ondersteunt enkel "bestand" (V3 JSON / IDE-v1) en "API" (code / DB versie). Geen Mermaid/PlantUML/XMI.
Dit is geen regressie: het heeft daar nooit gezeten. Het is ontwikkeld in de UML-editor en niet doorgetrokken naar de IDE.
De importers (importVanMermaid, importVanPlantUML, importVanXMI) produceren direct React Flow nodes/edges in editor-v2-formaat. De IDE gebruikt een ander datamodel (elements, structuralEdges, diagrams, …) via useModelStore met adapters in store/adapters.js.

2. Save-verlies bug
Bevestigd in umleditor/metamodel/types.js#editorNaarV3Model: het exporteert alleen velden die op GE-nodes staan; velden op entiteit-nodes worden weggegooid. Mermaid-import legt alle attributen ón entiteit-nodes (omdat elke klasse → entiteit). Dus bij V3-export → file → V3-import gaan alle attributen verloren. De entiteit-nodes blijven over (zoals in img 3), maar leeg. Dit is exact wat je ziet.

Dit is niet alleen een save-toestand-probleem, het is een modelconsistentie-probleem: in het V3-metamodel mag een entiteit géén velden hebben. Dat is al correct. Het probleem zit aan de importkant: de mermaid/XMI/puml importers produceren een ongeldige tussentoestand die niet kan worden geserialiseerd.

Voorstel — plan in fasen
Fase A — Quickfix: voorkom verlies bij opslaan ná import
Twee opties:

A1: Bij V3-export: detecteer entiteit-nodes met velden, en voor elke gedetecteerde set velden, fabriceer per entiteit één impliciete GE met alle velden samen (rolnaam = naam entiteit in lowercase, of attributen). Dit maakt het export-resultaat geldig en ronde-trip-baar zonder UI-interventie.
A2: Sla naast V3-JSON óók de "rauwe" editor-state (flowState) op (zoals een eerder pad al doet), zodat re-import vanuit hetzelfde bestand de attributen herstelt — ook als ze nog op entities staan.
A2 is sneller maar verbergt het werkelijke probleem. A1 is structureler en sluit aan bij wat de "uitpak"-dialoog (fase C) bedoeld is om te formaliseren — alleen dan met betere defaults dan "alle velden in één GE".

Fase B — Stereotypen ondersteunen in importers
Mapping: <<entiteit|ent>> → entiteit, <<gegevenselement|ge>> → gegevenselement, <<relatie|rel>> → relatie, <<referentielijst|reflijst>> → referentielijst, <<referentielijstinstantie|reflitem>> → ref. instantie. (Mermaid: bestaat al deels via parseClassBlock; uitbreiden voor alle metatypes + aliassen. PlantUML: class X <<stereotype>>. XMI: <UML:Stereotype> of xmi:type).

Voor GE en relatie gevolg: de huidige importers maken een entiteit-node aan; voor stereotype ge moet er een GE-hub-node komen, voor relatie een rel-node + ASOC-anker. Dit raakt aan layout en vereist defaults voor parent-entiteit. Ik stel voor: GE/relatie zonder duidelijke parent worden in een "imported"-entiteit gehangen of de eerste compositie-edge bepaalt de parent. Dit verdient een korte ontwerpronde met je vóór ik hier code van schrijf.

Fase C — UI: "Uitpakken naar GE's" dialoog
Postimport-actie op één of meer entity-nodes: opent dialoog waar per attribuut:

target-GE-naam (default = veldnaam zelf, dropdown met bestaande GE-namen voor merging),
momentvoorkomen (default uit verplicht/array-status).
Genereert GE-nodes + compositie-edges, verwijdert velden van de entity. Past binnen de bestaande edge/handle-conventies. Dit is een nieuwe component die los kan staan van de importers en ook op handmatig getekende ENTs werkt.

Fase D — Hergebruik in IDE
De importers importVan*() produceren editor-v2 React Flow nodes/edges. Voor IDE-hergebruik zijn er twee paden:

D1 (meest onderhoudbaar): De importers laten produceren in een neutraal tussenformaat (een licht V3-achtige structuur of {entiteiten, gegevenselementen, relaties, enums, datatypes, edges}). Editor-v2 en IDE bouwen elk hun eigen rendermodel via een dunne adapter. Hiermee profiteren beide pagina's automatisch van uitbreidingen aan de importers.
D2 (snelste): importer → editor-v2 nodes/edges → bestaande nodesEdgesNaarV3() of vergelijkbare → v3ModelNaarStore(). Dit ketent twee bestaande converters maar voert in de IDE de UI-flow alsnog via V3 JSON; ongeldige tussentoestanden (zoals entiteit-met-velden) sneuvelen dan opnieuw. Zinvol pas nadat fase A is opgelost.
Mijn voorstel: D1, maar pas nadat fase A en B stabiel zijn.

Vragen voor jou voordat ik begin
Volgorde: akkoord met A1 → B → C → D1? Of wil je eerst D1 (architectuur) zodat de rest meteen breed landt?
Fase A: kies je A1 (impliciete GE per entiteit, één GE met alle losse attributen) of A2 (rauwe state bewaren)? Of beide (A2 als extra veiligheidsnet)?
Fase B: voor <<ge>> en <<rel>> zonder duidelijke parent in de UML — wil je (a) ze stille aan een nieuwe placeholder-entiteit hangen, (b) een waarschuwing tonen en als entity importeren, of (c) alleen toestaan als er een compositierelatie naar zo'n stereotype-class loopt?
Scope nu: wil je dat ik dit allemaal in één PR doe, of liever opdelen en eerst alleen fase A oppakken (kleine, veilige fix die onmiddellijk de save-bug oplost)?
Claude Opus 4.7 • 7.5x



====
Wat mij opviel tijdens het lezen:
2 save verlies:
- in de screenshots is ook te zien dat relaties onzichtbaar zijn geworden. (img2)
- dat is ook bij herimport van XMI (metamodel.xmi) (img3). ook de overerving is daar weg.
- bij herimport van een meteen geexporteerde mermaid (metamodel (1).md) (img 4)zijn de relaties er wel, enzelfs de velden en de overerving
- bij herimport van een meteen geexporteerde plantuml zijn de velden er wel maar de overerving niet (img5)

- afkortingen in fase B: er zijn 4 referentielijst stereotypen. (zie img) afkorting van referentielijstinstatie = refInst. refItem en refItems zijn de andere twee.
- UML: eigenlijk wil ik een tagged value toevoegen, maar stereotype werkt voorlopig wel even. Misschien kunnen we taggedValue bitemp::metatype = Entiteit ook herkennen?
====

Heldere antwoorden — ik ga starten. Eén korte concept-check vóór de grote refactor: ik wil dit goed scopen en je observaties verwerken in het plan.

Laat me eerst alle relevante bestanden in kaart brengen om geen verrassingen te krijgen, dan stuur ik je een concreet werkplan met file-lijst en open vragen vóór ik code schrijf.

Completed: Voorstel/plan terugkoppelen aan gebruiker (3/15)

Ik delegeer de inventarisatie naar een onderzoeksagent zodat ik niet zelf eindeloos veel reads hoef te doen, en kan dan gericht aan de slag.

De inventarisatie heeft veel goeds opgeleverd, maar ook bevestigd dat dit groter is dan één doorloop verstandig kan zijn. Een paar bugs die de subagent vond gaan dieper dan ik eerst dacht (bv. dat XMI-import generalisaties helemaal niet parseert, en dat editor→V3 relaties tussen entiteiten gewoon negeert).

Voor de menselijke kant: laat me dit in twee leverbare blokken doen, zodat we elk blok kunnen verifiëren voordat we doorgaan. Anders eindigen we met een PR die te groot is om met vertrouwen te reviewen.

Voorgestelde split
Blok 1 (nu, klein en zichtbaar):
Fix bug: PlantUML import herkent generalisatie niet
Fix bug: XMI import parseert UML:Generalization niet
Fix bug: XMI import reconstrueert relatie-edges niet volledig
Fix bug: editor → V3 export negeert entiteit↔entiteit-relaties (waardoor relaties verdwijnen na save→load van een Mermaid-import)
A2: rauwe editor-state opslaan met aparte extensie .editor-flow.json (knop "Bewaar editor-toestand"); en een loader die deze extensie herkent
Stereotype-aliassen in alle 3 importers: ent/entiteit/Objecttype, ge/gegevenselement/Gegevensgroeptype, rel/relatie/Relatiesoort, reflijst/Codelijst, refInst/referentielijstinstantie, refItem, refItems, plus UML taggedValue bitemp::metatype = X
Documentatie
Blok 2 (volgende sessie):
D1 architectuur: definieer RuwUML tussenformaat + 3 dunne adapters
IDE-integratie: Mermaid/PlantUML/XMI in ImportDialog.jsx
Placeholder-entiteit voor orphan <<ge>>/<<rel>> met dialoog (warn + cancel/continue)
Tests voor de nieuwe pijplijn
Reden voor deze volgorde
Blok 1 lost de échte pijn op (save-verlies, missende relaties/overerving) en geeft je direct werkbare ontwikkel-tools (rauwe save = jouw .editor-flow.json ontwikkelhulp).
Blok 2 is een architecturele lift — beter gedaan met een schoner uitgangspunt, en wil je echt eerst zien werken voordat we de IDE er ook op aansluiten.
Stereotype-uitbreiding zit in blok 1 omdat het in elk van de 3 importers minimaal is en jouw observaties (ref-stereotypen + taggedValue) direct meeneemt.
Akkoord met deze split? Zo ja, dan begin ik direct met blok 1. Zo nee (je wilt echt alles in één keer), zeg het en ik doe het — maar wees dan voorbereid op een PR met aanzienlijk veel bestandswijzigingen die in één keer reviewen lastig is.