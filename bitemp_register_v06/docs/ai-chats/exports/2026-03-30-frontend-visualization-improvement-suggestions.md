# Chat: Frontend Visualization Improvement Suggestions

- **Datum**: 2026-03-30 17:55
- **Sessie-ID**: `9851a6c8-1dea-4455-823c-b4f96eca67a6`
- **Berichten**: 28

---

## 🧑 User

Over de visualisatie in de frontend (index.html is het).

Ik zou het netter en overzichtelijker willen presenteren.

De focus ligt op de naam (het afgeleide veld), de naam van ENT moet zichbaar zijn en de ID ook, maar kleiner en rustiger. De kleur symboliseert ook het type, dus het is met name de het afgeleide veld dat in het oog moet springen.

Bij locatie is dit al beter, omdat de ENT naam korter is, maar dit mag ook kleiner.

In de GE's staat np_id, maar dat is obvious, omdat ze eraan hangen. Dat kan dus weg en alleen de eigen velden. Als er een #sym:IsWeergaveVeld ==true veld is, override dat de losse velden. 

In bereikbaarheid staan de primaire ENT id en de secundaire, maar de sec. plakt er aan vast met haar ID, dus beide ID's hoeven daar niet in beeld.

In het REG blok gaat het in de opvoer/afvoer blokjes soms ook om een versie. Dat moet dan ook in beeld. "opvoer" en "afvoer" mag kleiner. Wil je een visueel aantrekkelijke presentatie voorstellen/ laten zien (alles is beter dan nu :-) )

---

## 🤖 Assistant

Let me read the actual component files that render the cards and registration blocks. Now let me see the CSS and understand the current label styles:  Now let me look at more CSS and at the  and  functions, as well as how the  is displayed:  Now let me look at how the IndexSchemaPage builds the props for these components — specifically , , and :  Now let me look at  and how  is passed: Let me look at how wijzigingen data is structured and what versie info is Let me look at how wijzigingen data is structured and what versie info is available: Let me look at how wijzigingen data is structured and what versie info is available:  Good, I can see there's already  Good, I can see there's already  and  on the node groups. Let me see how the group data is structured on the  on the node groups. Let me see how the group data is structured on the nodes: Now let me check How the  object is structured on the nodes passed to the visual: Now let me look at how registratie wijziging data looks, to understand what versie info we have: Let me look at the wijziging fields more closely: Let me check the Go model to understand what fields a wijziging record has: Let me check how  is used and what  provides:  Let me check what fields  has in the schema response: Good — the  object in the visual has  which is the full  from the schema API, including  and . Now I have everything I need.

Let me now read the complete IndexRegistratieVisual to plan the REG changes carefully:  Now I have complete understanding of the codebase. Let me implement all the changes. Let me read the key sections once more to get exact line matches:  Now I have all the context. Let me apply all changes: 
```

```

```

```

```

```

```

```

```

```

```

```


---

## 🧑 User

@agent Try Again

---

## 🤖 Assistant


```

```
Now let me also check whether  is imported in the IndexRepresentatieVisual:   is passed as a prop, not imported directly. But I'm now calling it directly inside the component. Let me check if it's indeed a prop:   Good —  is already a prop being passed to the component. My usage of  will work because the prop is the function itself. The extra parameter just needs to be handled by the function, which I already updated in schemaUtils.js.

Let me also check if  is imported in the registratie visual: Good, registratie visual doesn't need to use  directly.

Now let me verify the build:   Build succeeds. Let me verify the final state of both changed files:   Build is clean, no errors. Here's a summary of all changes:

### Entiteitskaart (central entity card)
- **Weergaveveld prominent**: When a `weergaveveld` exists (e.g. "Sanne van Dalen"), it's now the hero text at 19px bold, centered in the card
- **Type + ID subtiel eronder**: "NatuurlijkPersoon · id 1" in small 11.5px muted gray underneath
- **Fallback**: When no weergaveveld is defined, the old ENT+ID style still shows (just repositioned slightly)

### GE kaarten (gegevenselement cards)
- **Type name bold, rel_id muted**: "Persoonsidentificatie" in bold 13px, then "rel_id=1" in muted 10.5px gray — keeps it readable but less noisy
- **Weergaveveld overrides losse velden**: When `IsWeergaveVeld=true` exists, it shows that as bold 12.5px text; otherwise falls back to 
- **Parent entity ID removed**:  (e.g. `natuurlijkpersoon_id`) and  are now filtered out of , since the GE visually hangs off the parent anyway

### Relatie kaarten
- Same improvements as GE: type name bold, rel_id muted, parent/secondary entity ID columns filtered from the field summary
- Weergaveveld takes priority when available
- The secondary entity box still shows separately (clickable navigation), but its redundant ID columns no longer clutter the text summary

### Registratie blokken
- **"opvoer"/"afvoer" smaller**: Changed from 27px bold to 13px uppercase with letter-spacing and muted gray — functional but not dominant
- **Versie shown**: When a wijziging has a  field (for data/aanvang/einde), it's now displayed as e.g. "Data: 1 v2" so you can see the version number

---

## 🧑 User

wil je al deze visuele keuzes documenteren in een FrontEnd viz design md documentje?

---

## 🤖 Assistant


```

```
De keuzes staan nu vastgelegd in bitemp_register_v06/docs/frontend-viz-design.md.

Het document beschrijft de informatie-hiërarchie voor entiteiten, GE’s, relaties en registratieblokken, inclusief de regels rond `IsWeergaveVeld`, het weglaten van redundante ID’s, en het tonen van versie-informatie in registratieblokken.

Als je wilt, kan ik hierna ook nog:
1. een korte verwijzing naar dit document opnemen in bitemp_register_v06/README.md
2. dezelfde ontwerpregels expliciet doortrekken naar de tijdlijn-visualisatie en replay-schermen

---

## 🧑 User

1 en 2: beide ja graag

---

## 🤖 Assistant

Ik ga eerst de README en de tijdlijn/replay-componenten nalopen, zodat ik de documentverwijzing toevoeg en dezelfde visual-hiërarchie gericht kan doorzetten buiten de index-pagina.Ik heb de tijdlijncomponenten gelezen. Daar zit nog de oude hiërarchie in: entiteitstype+ID domineren, GE/REL tonen redundante FK’s, en registratiepanelen missen de versie-indicatie. Ik pas dat nu gericht aan en voeg daarna de README-verwijzing toe.Ik zie dat alleen de tijdlijn dezelfde kaartvisualisaties rendert. De replay-pagina gebruikt geen vergelijkbare kaartcomponenten, dus daar hoeft geen parallelle typografie-update in de rendering zelf. Ik check nog kort of daar een verwijzing of toelichting zinnig is, en voer daarna de codewijzigingen in één keer door.Ik ga nu de tijdlijnvisuals en documentverwijzingen aanpassen. Het resultaat is dat index en tijdlijn dezelfde leeshiërarchie krijgen, en de README direct naar het ontwerpdocument verwijst.
```

```

```

```

```

```

```

```
De tijdlijncomponenten en documentverwijzingen zijn aangepast. Ik ga nu valideren op syntax en build, zodat we meteen zeker weten dat de wijzigingen bruikbaar zijn.Ik heb beide gedaan.

In README staat nu een expliciete verwijzing naar frontend-viz-design, zowel bij de index-pagina als bij de tijdlijn-pagina.

Daarnaast is dezelfde visuele hiërarchie doorgetrokken naar de tijdlijncomponenten in  en :
- entiteit: weergaveveld eerst, type + id rustiger eronder
- GE en relatie: weergaveveld heeft voorrang, owner/secundaire FK’s worden uit de samenvatting gefilterd
- registratieblokken: kleinere opvoer/afvoer-labels en versie-indicatie waar relevant

Ik heb het ontwerpdocument ook bijgewerkt zodat het nu expliciet zegt dat deze regels ook voor de tijdlijn gelden: .

De replay-schermen hebben geen aparte kaart-renderer met een afwijkende stijl; waar zij dezelfde representatiepanelen hergebruiken, geldt dus dezelfde ontwerpfilosofie. De frontend build draait nog steeds schoon.

---

## 🧑 User

ik zie in de tijdlijn nu helemaal geen info (zie image)

Verder was er daar ooit een rode lijn naar doorgehaalde (ongedaan gemaakte) REPs. Maar dat is ergens verdwenen. Kun je dat weer opduikelen en activeren?

ZIe image 2

---

## 🤖 Assistant

Ik ga gericht de tijdlijnlogica nalopen: eerst waarom de inhoud op `-` uitkomt, daarna de verdwenen rode undo-lijn terug activeren in dezelfde renderflow.Ik zie nu al twee waarschijnlijke oorzaken: tijdlijn gebruikt on-geflattenede hub-data (waardoor veel `-`), en undo-target matching gebruikt waarschijnlijk andere naam/ID-velden dan wat er op de kaart-id’s staat. Ik lees nu het undo-gedeelte volledig uit en fix beide oorzaken samen.Ik ga nu twee technische fixes doen: 1) hubs in de tijdlijn flattenen zoals op index (zodat inhoudelijke velden en afgeleide naam weer gevuld zijn), 2) undo-link matching robuuster maken op typenaam/klassenaam en meerdere id-varianten (rel_id, id, versie), zodat de rode lijnen weer kunnen landen op de juiste REP.
```

```

```

```
De twee kernfixes staan erin. Ik valideer nu snel op compile/syntax en daarna geef ik je precies wat dit oplost en wat je in de UI moet zien.Top, dit heb ik zojuist hersteld.

Wat ik heb aangepast:

1. Tijdlijn-inhoud weer gevuld
- In web/vite/src/pages/TijdlijnSchemaPage.jsx gebruik ik nu ook hub→data flattening (zelfde principe als op de index), zodat de tijdlijn niet alleen hub-plumbing ziet maar ook de inhoudelijke data.
- Daardoor kunnen samenvattingen en afgeleide weergavevelden weer echte waarden tonen in plaats van alleen “-”.

2. Rode undo-lijn naar doorgehaalde REPs weer geactiveerd
- In web/vite/src/components/tijdlijn/TijdlijnRepresentatiePaneel.jsx heb ik de target-matching robuuster gemaakt:
- match op typenaam én klassenaam
- match op meerdere ID-kandidaten (rel_id, id, versie)
- extra onzichtbare anchors toegevoegd voor alternatieve ID’s, zodat de overlay-lijn weer een geldig doel vindt
- Dit herstelt ook de highlighting van ongedaan gemaakte representaties in dezelfde flow.

Validatie:
- Frontend build is groen na de fix.

Als je nu de tijdlijn hard refresht en dezelfde ongedaanmaking-case opent, zou je weer:
1. inhoudelijke waarden in de representatiekaartjes moeten zien
2. rode lijnen moeten zien naar de doorgehaalde ongedaan-gemaakte REPs

Als je wilt, kan ik hierna nog een kleine debug-indicator toevoegen die het aantal gevonden undo-links toont, zodat je direct ziet of de lijnlogica matches vindt per dataset.

---

## 🧑 User

hier zou een lijn moeten staan. Die zie ik niet.

Wil je die debug indicator toevoegen?

---

## 🤖 Assistant

Je hebt gelijk, die lijn hoort zichtbaar te zijn.

Ik heb nu twee dingen gedaan:

1. Lijn-overlay echt boven de kaarten gezet
- In web/vite/src/styles/tijdlijn-schema.css staat nu:
- `.timeline-overlay` met `z-index: 20`
-  met `position: relative; z-index: 1`
- Hiermee kan de rode undo-lijn niet meer “achter” de panelen verdwijnen.

2. Debug-indicator toegevoegd
- In web/vite/src/pages/TijdlijnSchemaPage.jsx toont de UI nu:
- `Undo links gevraagd`
- `Undo links getekend`
- `Undo links missend` (alleen bij mismatch)
- En bij missende links een uitklapbare debug-sectie met de ontbrekende -ankers, zodat je exact ziet waarom een lijn niet gerenderd wordt.

Build is groen.

Wat ik je nu vraag te checken:
1. Herlaad de tijdlijnpagina hard.
2. Kijk naar de nieuwe debugchips boven de tijdlijn.
3. Als `missend > 0`, open de debug-details en stuur die JSON hier; dan kan ik de target-id matching meteen exact afmaken voor die specifieke replaycase.

---

## 🧑 User

[
  {
    "sourceId": "undo-src-28-1",
    "targetId": "undo-target-rep-27-NATUURLIJKPERSOON_PARTNERNAAM_DATA-1"
  }
]

---

## 🤖 Assistant

Mooi, dit maakt het exact: de undo verwijst naar een `_DATA`-typenaam, terwijl de kaartankers nu op hub-typenaam zitten. Ik ga een gerichte compat-fix doen zodat hubs ook onzichtbare `_DATA` target-ankers krijgen.Ik ga nu een alias-laag toevoegen voor `_DATA`-typenamen op dezelfde REP-kaart, zodat `undo-target-rep-..._DATA-...` ook een bestaand DOM-anker krijgt en de lijn meteen kan landen.
```

```
Perfecte debug-output, dank. Dit bevestigde precies de mismatch.

Je missing target was:
- `undo-target-rep-27-NATUURLIJKPERSOON_PARTNERNAAM_DATA-1`

De kaart had alleen hub-ankers, niet `_DATA`-ankers. Dat heb ik nu opgelost in :

- REP-ankers krijgen nu alias-namen:
- hub typenaam
- doeltype
- data typenaam (`..._DATA`) als die bestaat
- Voor elk van die namen worden ankers gezet voor meerdere ID-kandidaten (, , )

Daardoor kan jouw target-id nu gevonden worden en moet de lijn weer verschijnen.

Build is groen.

Wat je nu zou moeten zien na refresh:
1. `Undo links gevraagd: 1`
2. `Undo links getekend: 1`
3. `Undo links missend: 0`
4. De rode lijn zichtbaar naar de juiste REP-kaart

Als die nog niet verschijnt, stuur dan nog 1 screenshot van de debugchips + details (nu verwacht ik óf 0 missend, óf een nieuwe specifieke target-id die we meteen kunnen mappen).

---

## 🧑 User

een ongedaanmaking van een registratie toont nu wel goed. Hij mist er twee, maar dat zijn de _data en _aanvang.

Die van een correctie doet ie niet. Is dat ingebouwd? Het zou wel kunnen, het is een soort opvoer die ongedaan gemaakt wordt.

De eerste was van een afvoer. Dat is ook lastig weergeven. Die staat niet eens in de lijst.

[
  {
    "sourceId": "undo-src-28-1",
    "targetId": "undo-target-rep-27-NATUURLIJKPERSOON_PARTNERNAAM_DATA-1"
  },
  {
    "sourceId": "undo-src-33-1",
    "targetId": "undo-target-rep-32-NATUURLIJKPERSOON_BURGERSCHAP_DATA-2"
  },
  {
    "sourceId": "undo-src-33-2",
    "targetId": "undo-target-rep-32-NATUURLIJKPERSOON_BURGERSCHAP_AANVANG-2"
  }
]

---

## 🤖 Assistant

Ik ga nu de undo/correctie-logica in de tijdlijn uitbreiden: 1) ook `_DATA`/`_AANVANG` (versie-gebaseerde children) als doelanker ondersteunen, 2) links niet alleen op  maar ook op  kunnen bouwen waar mogelijk, en 3) checken of correctie-relaties al in de data zitten en die zichtbaar maken.Ik ga het nu robuust maken op drie punten: 1) target-candidates met bovenliggend typenaam (zodat `_DATA/_AANVANG` op hub-kaarten landen), 2) ook  links meenemen, 3) correctie-registraties dezelfde terugverwijs-lijnen laten tekenen. Daarna blijft de debug-sectie exact tonen wat nog mist.
```

```

```

```

```

```
Ik heb nu zowel ongedaanmaking als correctie meegenomen, plus target-fallbacks voor `_DATA/_AANVANG` via bovenliggend-type kandidaten. Ik doe nu de buildcheck en dan geef ik je precies wat je straks in de debugchips moet zien.Helemaal goed gezien. Dit zat inderdaad nog niet volledig ingebouwd.

Wat ik nu heb ingebouwd:

1. `_DATA` en `_AANVANG` misses opgevangen
- In  worden target-ID’s nu opgebouwd met meerdere naamkandidaten:
- originele 
-  (hub)
- 
- afgeleide fallback door `_DATA/_AANVANG/_EINDE` suffix weg te halen
- Bij het tekenen wordt de eerste bestaande target-anchor gebruikt.
- Hierdoor kan een verwijzing naar bv. `...PARTNERNAAM_DATA-1` alsnog landen op de hubkaart.

2.  ook meegenomen
- Voor link-opbouw en highlights nam de code eerder alleen .
- Nu worden zowel  als  meegenomen.
- Dit helpt specifiek bij jouw opmerking dat de eerste van een afvoer was en eerder buiten beeld viel.

3. Correctie-linking toegevoegd
- Ja: dit was eerder niet expliciet ingebouwd.
- Nu behandelt de tijdlijn ook  analoog aan ongedaanmaking:
- targetregistratie via 
- linkopbouw en highlights tegen die targetregistratie
- bronankers worden in het registratiepaneel ook gezet voor correctie-kolommen.

4. Debug is bruikbaarder gemaakt
- Missing links tonen nu intern ook of  of  ontbreekt, zodat we sneller exact zien waar het gat zit.

Alles bouwt groen.

Wat ik nu van je wil:
1. Hard refresh op tijdlijn
2. Kijk of chips nu richting `gevraagd == getekend` gaan
3. Als er nog missers zijn, plak nog 1 keer de debug JSON; met deze nieuwe info () kunnen we de laatste randgevallen afmaken in één slag.

---

## 🧑 User

Paar opmerkingen en vragen.

1. Kan de naam van de GE wat lager.
- Daarachter geen "rel_id" maar wel het id.
- Daarachter als er een versie is anders dan 1: v2 (of welke versie het is)

2. Een hub en een _data element hebben wel allebei een opvoer of afvoer, maar die komen altijd met zijn twee (image 2)
- kunnen we niet een boogje van de hub naar de data afvoer maken en dan door naar het blokje beneden?

3. imge 3 en 4: Een correctie is afvoeren van v1 en opvoeren van v2.
- v1 staat eigenlijk (hier) een registratie naar links (maar soms verder). Misschien hier ook een boogje van de afvoer naar de opvoer?
- en dan is het een opvoer die je aanwijst, dus dan is rood geen goede kleur. Misschien een groene lijn naar het gecorrigeerde element?

---

## 🤖 Assistant

Ik ga nu drie gerichte UI-aanpassingen combineren: GE-label/versie-opmaak, lijnkleur en deduplicatie voor correctie/ongedaanmaking, en een intern boogje in het registratieblok tussen afvoer→opvoer (en bij hub+data-paren).Ik ga nu de laatste functionele stap zetten: 1) GE-labellayout/id+versie, 2) slimme deduplicatie van hub+data links, 3) correctiepad in groen + intern boogje in het registratieblok. Daarna buildcheck ik direct.
```

```

```

```

```

```

```

```

```

```

```

```

```

```

```

```

```

```

```

```

```

```

```

```

```

```

```

```
Ik heb de implementatie rond; ik check nu op compilefouten (er waren net een paar variabele-scopes om te corrigeren) en daarna geef ik je de verwachte zichtbare uitkomst per punt.Mooi scherpe feedback, en ik heb alle 3 punten nu verwerkt.

Wat is aangepast:

1. GE-naam lager + id/versie-format
- In :
- GE titel staat nu lager ( omhoog/omlaag afgestemd)
- label toont nu  in plaats van 
- versie wordt alleen getoond als , dus bijvoorbeeld 
- zelfde formattering ook doorgetrokken naar relatie-kaarten voor consistentie

2. Hub + _data samenhang beter weergegeven
- In :
- linkselectie voor ongedaanmaking dedupliceert nu op basis van representatie-basisnaam + id
- bij dubbele kandidaten krijgt `_DATA/_AANVANG/_EINDE` voorrang op hub (rank)
- resultaat: minder “dubbele V-lijnen” naar hetzelfde doel; data/plumbing-referenties landen consistenter
- daarnaast wordt actieve data-versie vanuit hub afgeleid en beschikbaar gemaakt voor display

- In :
- interne boogjes toegevoegd:
- bij ongedaanmaking voor hub/data-paar met zelfde basis + id
- visueel laat dit de interne keten zien voordat de externe overlay-lijn loopt

3. Correctieflow aangepast (afvoer→opvoer en groen naar doel)
- Correctie-links worden nu als correctie behandeld:
- externe overlaylijn is groen (eigen marker + stroke)
- voor correctie wordt alleen de -regel als externe source gebruikt
- intern boogje in registratiepaneel toont  koppeling

Technisch gevalideerd:
- frontend build draait groen.

Wat je nu zou moeten zien:
1. GE-koppen met  en alleen `vN` als `N > 1`
2. bij ongedaanmaking minder dubbele lijnen en betere landing op data/aanvang targets
3. bij correctie:
- intern boogje van afvoer naar opvoer in het registratieblok
- groene externe lijn naar gecorrigeerd element

Als je wilt, kan ik als laatste stap nog de debug-output compacter maken door alleen missende links te tonen per registratietype (`ongedaanmaking` vs `correctie`) zodat je sneller ziet waar eventuele restgevallen zitten.

---

## 🧑 User

1. In 26: dit is de ongedaanmaking van een afvoer. Het element komt dus terug. Dat moet ook in groen.
2. in 27: goed
3. in 28:
- de ongedaanmaking van de opvoer van v2 is idd een rode lijn naar reg 27.np.partnernaam rel_id=1 versie=2
- de ongedaanmaking van de afvoer van v1 is dan weer een groene lijn naar partnernaam v1 in de eigen registratiekolom, die immers terugkomt

Verder (zie image 3): de naam vd ENT en de naam van de GE en dan Data of iets past niet zo goed. Dat was op 3 lijnen, dacht ik, maar het is nu een beetje raar.

---

## 🤖 Assistant

Ik ga nu de semantiek van de lijnen per wijzigingstype corrigeren (afvoer-ongedaanmaking = groen en naar eigen kolom), plus de registratie-tekst compacter op 2-3 nette regels zetten zodat die overlap verdwijnt.
```

```

```

```

```

```

```

```

```

```

```

```

```

```

```

```
Ik heb de semantiek en layout verwerkt; ik draai nu een check om te bevestigen dat alles compileert en dat er geen regressies in de tijdlijncomponenten zitten.Heel goed, dit was precies de juiste inhoudelijke nuance. Ik heb je 4 punten nu verwerkt.

Wat er nu anders is:

1. Ongedaanmaking van afvoer is groen
- In  wordt bij ongedaanmaking per wijzigingstype onderscheiden:
- ongedaanmaking van  blijft rood (wordt verwijderd)
- ongedaanmaking van  is nu groen (`herstel`)
- Daarbij gaat die groene lijn nu naar de juiste herstel-doelkolom (eigen registratiekolom), niet altijd naar de oorspronkelijke doelregistratie.

2. Reg 28 gedrag (zoals je beschrijft) semantisch gesplitst
- Zelfde file: links worden nu per wijzigingstype met eigen targetreg opgebouwd.
- Daardoor kun je tegelijk krijgen:
- rood naar `v2` (ongedaanmaking van opvoer)
- groen naar `v1` (ongedaanmaking van afvoer → komt terug)
- De DOM-anchors ondersteunen nu zowel  als , zodat die “eigen kolom” targets ook echt gevonden worden.

3. GE-labelregel in representatiekaart
- In :
- label staat lager
- toont  i.p.v. 
- versie alleen als `> 1`, dus  (geen `v1`-ruis)

4. Registratieblok tekstlayout opgeschoond
- In :
- compacter font en kleinere line-step in entiteit/representatiekolommen
- iets ruimere woordopbreking
- minder overlap/“door elkaar”
- interne boogjes:
- correctie  in groen
- ongedaanmaking hub/data-paar kleurt nu semantisch mee (afvoer-herstel groen, anders rood)

Build is groen.

Wil je nu 1 nieuwe screenshot met dezelfde 26/27/28 kolommen sturen?  
Dan controleer ik meteen of de resterende lijnrouting exact overeenkomt met je bedoeling (vooral 28 met de gecombineerde rood+groen target).

---

## 🧑 User

hier is de ss

---

## 🤖 Assistant

Ik zie wat jij ook ziet: semantiek is nu bijna goed, maar visueel zijn er nog 2 ruispunten (rode X bij herstel en te lange type-teksten). Ik pas dat nu direct aan in tijdlijn én het registratiepaneel zodat het leesbaar blijft.
```

```

```

```

```

```
Ik heb nu de laatste visuele inconsistenties aangepakt. Ik check nog even build/syntax om zeker te zijn dat alles stabiel is.Dank, deze screenshot hielp veel. Ik heb nu precies de punten die je noemt doorgezet:

1. Ongedaanmaking van afvoer in 26 is semantisch groen
- In  krijgt  nu action type `herstel`.
- Die lijn wordt groen getekend.
- Target gaat per wijziging naar de juiste kolom (voor herstel naar eigen reg-kolom), niet blind naar de ongedaan-gemaakte registratie.

2. 28 opgesplitst zoals je beschrijft
- Zelfde file: per wijzigingstype aparte targetlogica:
- ongedaanmaking van opvoer -> rood naar de opvoer die ongedaan wordt
- ongedaanmaking van afvoer -> groen naar de versie die terugkomt
- Met reg-id alias-ankers in  zodat beide kolommen correct gevonden worden.

3. Tekst in registratieblokken netter (image 3-issue)
- In  en :
- CamelCase wordt nu gesplitst voor wrapping (`Natuurlijk Persoon`)
- font iets kleiner in de smalle kolommen
- Daardoor minder overlap van ENT/GE/Data labels.

4. Rode X in ongedaanmaking semantischer
- In :
- alle wijzigingen afvoer -> groene X
- alle wijzigingen opvoer -> rode X
- gemengd -> neutrale grijze X
- Dat voorkomt de visuele tegenspraak die je zag.

Build is weer groen.

Als je nog één keer een screenshot maakt van precies 26/27/28 na hard refresh, kan ik desnoods de laatste visuele tuning doen op de kruisingen van lijnen (bijv. bocht agressiever of startpunt per rij verschuiven) zodat het minder “door elkaar” oogt.

---

## 🧑 User

(26-27-28 is image 2) aanpassingen: graag (zodat lijnen meer gescheiden zijn)

Verder: de png export doet het niet: Fout: PNG-export niet beschikbaar: html2canvas niet geladen.

---

## 🤖 Assistant

, maar de app importeert  als module.
- Ik heb de check en call omgezet naar de module-import:
- check: `typeof html2canvas === "function"`
- call: 
- Daarmee verdwijnt de foutmelding “html2canvas niet geladen”.

Build is groen.

Wil je nu even deze 2 checks doen:
1. Klik `Download PNG` of `Kopieer PNG` op de tijdlijn.
2. Kijk of de lijnen in 26-27-28 nu visueel voldoende gescheiden zijn.

Als je nog nét te veel kruising ziet, kan ik in één laatste stap de routing “per registratietype” in vaste corridors zetten (bijv. ongedaanmaking altijd buitenom, correctie altijd middenbaan).

---

## 🧑 User

misschien de buigingsrichting omdraaien idd

---

## 🤖 Assistant

Ik draai de buigingsrichting nu om in de overlay-curves (groen/rechts en rood/links) en check daarna meteen of de build nog groen is.
```

```
Top, gedaan.

Ik heb de buigingsrichting omgedraaid in , zodat de lijnen nu de andere kant op “uitwaaieren”.

Build is groen gebleven.

Als je wilt kan ik daarna nog één stap doen:
1. per registratietype een vaste corridor afdwingen (bijv. ongedaanmaking altijd buitenom, correctie altijd binnenom), zodat kruisingen nog verder afnemen.

---

## 🧑 User

dit helpt eigenlijk niet, want nu kruisen de lijnen beneden weer. Wil je jouw idee met corridors proberen?

---

## 🤖 Assistant

Ja, scherp punt. Ik ga nu echte “corridor routing” inbouwen: per lijn eerst naar een vaste verticale baan, dan pas naar het doel. Daardoor blijven lijnen per type uit elkaar en kruisen ze minder onderin.
```

```
Yes, corridors staan er nu in.

Wat ik heb gedaan in :
- Elke kolom krijgt nu  en .
- Voor elke overlay-lijn bepaal ik bron- en doelkolom en reken ik een vaste  uit.
- Groen en rood krijgen verschillende corridor-banen.
- Binnen die baan komt nog een kleine lane-offset per rij-index.
- De Bezier-control points gebruiken nu die corridor, dus lijnen gaan eerst naar hun verticale “routebaan” en dan naar het doel.

Daarnaast:
- alles compileert,
- Vite build is groen.

Als je nog wilt, kan ik als laatste tuning:
1. groene corridor altijd links van de bronkolom zetten,
2. rode corridor altijd rechts van de bronkolom zetten,
zodat het gedrag nóg voorspelbaarder wordt bij veel registraties naast elkaar.

---
