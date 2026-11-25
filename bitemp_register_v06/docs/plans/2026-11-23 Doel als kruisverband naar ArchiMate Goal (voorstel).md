# Doel als kruisverband naar een ArchiMate Goal (voorstel)

*TRANSFORMATIES, 23/24-11-2026. Status: de hoofdlijnen zijn door Mark beslist (§7); nog niets hiervan is gebouwd, behalve de header, de binding en de reikwijdte door ODRL. Af te stemmen met ODRL
(header `X-Omnium-Doel`, binding in de bundel) en OMNIUM-UI (doelkiezer in de Studio).*

## 1. Aanleiding

Mark heeft op 20-11 besloten dat `Doel:` in de kop van een Toegangsspraak-beleid een **binding**
is. Elke toestemming geldt dan alleen voor een aanvraag met dat doel; een verbod geldt altijd. Het
doel van de aanvraag komt binnen via de **header** `X-Omnium-Doel`. ODRL heeft die header en de
binding in de bundel gebouwd op `feat/toegang-verzoekzijde`; die branch is nog niet gemerged.

Daarmee zijn drie vragen nog niet beantwoord:

1. **Waar komt een doel vandaan?** Op dit moment is het een vrije tekst in het beleid, en de
   header moet die tekst letterlijk herhalen. Een tikfout leidt tot een binding die nooit geldt.
2. **Wie stuurt het doel mee?** Een medewerker kiest niet zelf een doel. Het doel volgt uit het
   werk dat hij doet.
3. **Wat doet de Studio?** Na de merge krijgt de Studio een 403 bij elk register met een `Doel:`
   in het beleid.

## 2. Wat een doel is

Volgens de AVG hoort een doel bij een **verwerking**. Elke organisatie legt haar verwerkingen
vast in het register van verwerkingsactiviteiten (art. 30), met per verwerking een doel en een
grondslag. Daaruit volgt:

- **Het doel hoort niet bij de gebruiker.** Het volgt uit de dienst of het zaaktype waarin de
  gebruiker werkt. ZAC doet dat al zo: de BRP-doelbinding staat daar in de koppeling van het
  zaaktype (`brpDoelbindingen`, zie het ZAC-voorstel van FUNSIM van 23-11).
- **Het doel staat los van de dienst.** Meerdere diensten delen vaak één doel; zo vallen
  aanvragen, wijzigen en beëindigen allemaal onder "schuldhulpverlening". Een interne verwerking
  heeft een doel zonder dat er een dienst bij hoort. Het doel is dus een eigen element, en een
  dienst of zaaktype verwijst ernaar.
- **Het aantal doelen is beperkt maar groeit.** Een gemeente heeft er tientallen tot een paar
  honderd. Een vrij veld is daarom te los en een vaste lijst in de code te strak. Het wordt een
  lijst die de organisatie zelf uitbreidt.

## 3. Op welk metaniveau

De eerste gedachte was dat het doel **M0** is: data, waar het model (M1) naar verwijst. Dat zou
een nieuw concept zijn. Dit voorstel kiest voor een andere lezing:

> Het doel is een element van het **architectuurmodel** van de organisatie. Dat is een M1-model in
> de taal ArchiMate (M2), en daarin is het doel een **Goal**. Het beleid in Toegangsspraak is ook
> M1. De verwijzing van het beleid naar het doel is dan een gewoon **kruisverband tussen twee
> M1-modellen**.

Voor de grondslag doen we dit al: een wetsartikel in een beleid wordt in ArchiMate een
**Constraint** (`toegangsregel/archimateKoppeling.js`, ontwerp Toegangsregel-profiel §4, juli
2026). Die koppeling beeldt het doel nu al af op een **Goal**, met een `realiseert`-relatie vanuit
het beleid.

Er komt dus **geen nieuw concept** bij. Wel draait de richting om:

| | Nu (`archimateKoppeling.js`) | Voorstel |
|---|---|---|
| Wat is de bron? | het beleid; de koppeling **maakt** een Goal met de naam van het doel | het ArchiMate-model; het beleid **verwijst** naar een Goal dat al bestaat |
| Identiteit | `arch:trg:doel:<slug van de naam>` | de uuid van het Goal |
| Onbekend doel | er wordt een nieuw Goal gemaakt | een melding, net als bij een onbekend begrip |

Het register van verwerkingsactiviteiten wordt daarmee een **weergave van het ArchiMate-model**:
per proces of dienst het Goal (doel) en de Constraint (grondslag). Daar zoekt GEMMA het ook.

### 3.1 Komt dit vaker voor?

Ja. Er zijn twee soorten verwijzingen vanuit een M1-model naar iets dat elders wordt beheerd:

| Soort | Voorbeelden | Waar de lijst staat |
|---|---|---|
| **Naar een ander M1-model**: wordt bij het ontwerpen gemaakt, er zijn er weinig, ze veranderen zelden | doel, grondslag, rol, dienst | ArchiMate, via kruisverbanden |
| **Naar M0-data**: groeit tijdens het gebruik | waarden van een referentielijst, zaaktype-URL's per omgeving | het register zelf (besluit 07-11 over referentielijsten) of plaatshouders per Omgeving |

Het doel hoort bij de eerste soort. De **rol** ("schuldhulpverlener") hoort er ook bij: die tekst
moet nu letterlijk overeenkomen met een rol in het inlogtoken. De rol kan later op dezelfde manier
een kruisverband naar een ArchiMate **Business rol** worden. Dat valt buiten dit voorstel.

## 4. Dienst, dienstversie en doel

*Richting van Mark, 23/24-11. We zeggen voortaan **dienst**, niet meer "e-dienst".*

| Wat | Niveau | Architectuurlaag | Waar |
|---|---|---|---|
| **Doel** | M1 | bedrijfsarchitectuur | een ArchiMate **Goal** |
| **Grondslag** | M1 | bedrijfsarchitectuur | een ArchiMate **Constraint** |
| **Dienst** | M1 | bedrijfsarchitectuur | een ArchiMate **Business service** |
| **Dienstversie** | M0 | applicatiearchitectuur | een object in het inrichtingsregister |

**De dienst is een Business service.** Er komt geen eigen dienstenprofiel. De Business service
draagt de betekenis en draagt via de motivatielaag bij aan het Goal. Een ArchiMate-element kan als
taal geen andere taal bevatten. In Omnium kan het wel, via het bestaande M3-mechanisme
`uitwerking`: zet dat aan voor `business-service` (een wijziging in de M2-descriptor, dus een
nieuwe profielversie), en dan hangen het BPMN-proces, de formulieren, het toegangsbeleid en de
toelichting in de projectboom onder de dienst.

**De dienstversie is een object (M0).** Versies staan al in het canonieke model van de inrichting
(het inrichtingsdomein: dienst, dienstversie, componentvereisten, status). Een versie is dus een
geregistreerd object en geen modelelement. Dat past bij het onderscheid tussen de lagen: wát de
dienst is en waarvoor, is bedrijfsarchitectuur; welke versie met welke componenten waar draait, is
applicatiearchitectuur. De dienstversie verwijst naar de Business service (uuid). Wat per versie
verschilt, staat in het object. Een marklaag voor inrichtingsgegevens op de Business service is
daardoor niet nodig.

**Wat er nu in het inrichtingsmodel staat** (nagekeken 24-11 in
`fixtures/cg-test/omnium-model-cg-test-v3.json`):

| Entiteit | Inhoud | Verwijst naar |
|---|---|---|
| `EDienst` | naam, omschrijving, eigenaar, code | `EDienst` (onderdeel van) |
| `EDienstVersie` | versienummer, bronmodelversie, bereik; status (concept, gereviewd, vrijgegeven, ingetrokken) | `EDienst`; `Component` (vereiste, met versiebereik) |
| `Artefact` | identificatie, inhoud, herkomst, traceregels | `EDienstVersie`, doelcomponent, andere artefacten (afhankelijkheid) |
| `Uitrol` | verloop, identificatie | `EDienstVersie`, `Omgeving`, resultaat |

Twee dingen vallen op:

- **De dienst zelf staat ook als object in het register** (`EDienst`, omschreven als "een
  business service / product-dienst / concrete use case"). De dienst komt dus twee keer voor: als
  Business service in het model (M1) en als `EDienst`-object (M0). Voorstel: het object blijft,
  omdat de versie, de artefacten en de uitrol er in het register naar moeten kunnen verwijzen. Het
  krijgt **dezelfde uuid als de Business service**, en zijn naam en omschrijving komen uit het
  model. Het object is dan de registratie van het modelelement, geen tweede bron. Zie §7, vraag 6.
- **Een versie verwijst niet naar haar voorganger.** De volgorde volgt nu alleen uit het
  versienummer. De versiegraaf bestaat verder al wel: versie → dienst, versie → vereiste
  componenten, artefact → versie, artefact → artefact, uitrol → versie en omgeving.

De entiteiten heten nog `EDienst` en `EDienstVersie`. Hernoemen naar `Dienst` en
`Dienstversie` is een schemawijziging met een rebuild; dat is een eigen besluit (§7, vraag 6).

**Waar stel je het in?** In de werkbank op het inrichtingsregister; de uitwerking van de
rondreis met het model staat in §4.2.

**Hoe het doel bij de aanroep komt.** De dienstversie kent haar dienst, en de dienst haar Goal.
Bij het maken van de inrichtingsartefacten gaat de uuid van het Goal mee: bij ZAC in de
zaaktypekoppeling, bij GZAC als procesvariabele in de BPMN. De applicatie stuurt die mee in de
header `X-Omnium-Doel`.

De map in de projectboom blijft een manier om te ordenen. Het huidige e-dienstmodel (het
JSON-bestand, bijvoorbeeld `gpk-edienst.json`) is een overgangsvorm: de inhoud ervan hoort
uiteindelijk bij de dienstversie in het register.

### 4.1 ArchiMate als opstap

ArchiMate is een opstap naar stabielere bronnen. De verwijzing blijft hetzelfde (een uuid, een
kruisverband); alleen datgene waarnaar ze wijst, wordt later stabieler:

- de **grondslag** wijst dan naar de wetgeving zelf (een wetsartikel met zijn eigen identificatie);
- het **doel** wijst dan naar een referentielijst van verwerkingsactiviteiten in het register.

Het Goal of de Constraint wordt op dat moment een weergave van die bron en is dan niet meer zelf
de bron. Beleid en bundel hoeven daarvoor niet te veranderen.

### 4.2 Rondreis tussen model en inrichtingsregister (Mark, 24-11)

De M0-weergave van de dienstversies is **geen simulatie**, en de Studio (Omnium) hoeft er niet
voor te veranderen. Het gaat om twee gegevensbronnen met een verschillende vorm: het model
(Business services, Goals, en de objecten als M0-weergave met hun plaats op het diagram) en het
inrichtingsregister (de objecten zelf).

**Wat er nu is.** Alleen een heenweg, en alleen voor de *acties* van het inrichten:

- De Studio-export *Inrichtingsartefacten* maakt uit het model een zip met artefacten. Iemand
  start die met de hand.
- FUNDAMENT schrijft de artefacten in het register met `omnium-registreer-artefact.ps1`.
- De exportstap leest het register (`full/artefacten`, `full/ediensten`,
  `full/edienstversies`) en vergelijkt per artefact op de payloadHash: nieuw, gewijzigd of
  ongewijzigd. Dat is vergelijken in één richting, zonder keuze bij een conflict.

Voor de *basis* van de inrichting (diensten, dienstversies, componenten, omgevingen) is er geen
transformatie vanuit het model. Dat is het pad waar de rondreis over gaat; het staat los van de
uitrollen.

**Hoe de rondreis werkt.**

1. **Het register is leidend, dus de werkbank op het register stuurt de sync.** De werkbank leest
   het model en het register, berekent de delta in beide richtingen en legt de verschillen voor
   aan de ontwerper.
2. **De ontwerper kiest bij een conflict.** Er wordt niets stilzwijgend overschreven.
3. **Van register naar model:** staat er in het register meer dan in het model, dan schrijft de
   werkbank de kale registerdata in het model, met een zinnige automatische opmaak. Mooier maken
   gebeurt daarna in de Studio.
4. **De vorm blijft intact.** Bij een volgende sync blijven plaats, maat en opmaak van een element
   staan zolang de inhoud ervan blijft bestaan. Alleen wat nieuw is krijgt een automatische plaats;
   wat verdwenen is, wordt als verschil voorgelegd.

De koppeling tussen de twee bronnen gaat op de uuid (§4: het dienst-object heeft dezelfde uuid als
de Business service).

**Nog te beleggen:** wie de werkbank met deze sync bouwt, en via welke weg de werkbank het model
leest en schrijft (de projectsync met POST ops ligt voor de hand, want die bewaart de opmaak).

## 5. De waarde in de header

De header bevat de **uuid van het Goal**. Dat volgt Marks regel: "uuid = identiteit, naampad =
betekenis" (31-10).

- Een naam kan veranderen of in twee modellen voorkomen; een uuid niet.
- De bundel schrijft de binding als `aanvraag.doel eq <uuid>`, met de naam ernaast voor de lezer.
- In het logboek en in een 403-melding komt de **naam** te staan. De PDP haalt die uit de bundel.
- Overgang: zolang een beleid een doel heeft dat nog niet aan een Goal gekoppeld is, blijft de
  binding de naam. De Studio meldt dat het doel nog niet gekoppeld is.

**Afgestemd met ODRL (23-11).** De machinerie op `feat/toegang-verzoekzijde` (e34a0d38) hoeft niet
te veranderen:

- De PDP vergelijkt `aanvraag.doel` met een tekstwaarde. Of die waarde een naam of een uuid is,
  maakt niet uit. De normalisatie (trim, kleine letters) werkt ook voor een uuid.
- **Bundelvorm:** `beleid.doel` blijft een tekst, want in Go is het een `*string`
  (`toegang/bundel.go`). Het bevat de uuid, of tijdens de overgang de naam. Daarnaast komt er een
  nieuw veld **`beleid.doelNaam`**. Een object van `doel` maken zou de bestaande bundels breken.
- **Geen dubbele binding.** Een beleid bindt óf aan de uuid óf aan de naam, niet aan "naam of
  uuid". Anders wordt de binding te ruim.
- De bundelwijziging zelf is klein (`metDoelbinding` in `bundel.js`). De resolver van stap 1 moet
  de uuid van het Goal op het beleid zetten.
- Een 403 met de naam van het doel is klein werk in de PEP: de naam komt uit `Bundel.Beleid`.

## 6. Wat de Studio meestuurt

In de Studio werk je niet binnen een dienst: je modelleert en je test. Toch leest de Studio
registers, bijvoorbeeld bij het bekijken van data, bij de werkplaats, of bij het uitproberen van
een beleid. Na de merge van ODRL krijgt de Studio een 403 waar het beleid een doel heeft, omdat
de Studio geen header meestuurt.

Voorstel:

- **Bij het testen van toegang** kies je een Goal uit het gekoppelde ArchiMate-model, als
  onderdeel van "lezen als": naast de rol kies je het doel. Dit is nadrukkelijk een testfunctie.
  Dit is de doelkiezer voor OMNIUM-UI.
- **Voor het gewone beheerwerk** van de Studio komt er geen doel. Of een beleid ook voor
  beheerders geldt, beslist Mark (§7, vraag 3).

**Hoe het nu is (ODRL, 23-11).** In de bouw van ODRL geldt de binding ook voor de beheerrollen. Een
beheerder of bouwer erft de lagere rollen, maar voldoet zonder header niet aan de binding. Hij
krijgt dan een 403 op alles wat alleen via een toestemming met doel openstaat. Een verbod geldt
altijd.

Als beheer zonder doel mag, zijn er twee routes:

- **(a) In het beleid:** een eigen regel, of een apart beleid zonder `Doel:`, voor de beheerrol.
  Dat is expliciet en controleerbaar, maar elke beleidsschrijver moet eraan denken. Een sjabloon
  in de Studio kan daarbij helpen.
- **(b) In de PEP:** een vaste uitzondering voor de beheerrollen. Dat regelt het op één plek, maar
  het is een achterdeur buiten het beleid. Ook beheer is een verwerking in de zin van de AVG.

ODRL en TRANSFORMATIES geven beide de voorkeur aan **(a)**.

**Afgestemd met OMNIUM-UI (23-11).**

- De Studio heeft nog geen "lezen als" en geen rolkeuze. Ze leest altijd als de ingelogde
  gebruiker en stuurt geen doel mee.
- **Plek voor de keuze:** een paneel **"Proberen"** in de Toegang-activiteit. Daar kies je een rol,
  een doel (alleen de Goals uit het gekoppelde ArchiMate-model) en eventueel een entiteit, en je
  ziet de beslissing: toegestaan, voorwaardelijk of 403.
- **Geen doelkeuze die voor de hele Studio geldt.** Zo'n keuze blijft gemakkelijk per ongeluk
  aanstaan en raakt dan ook het beheerwerk.

**De reikwijdte van een bundel (gemeten door ODRL, 23-11).** OMNIUM-UI vroeg zich af of een beleid
met `Doel:` ook het beheerdomein en de definities dichtzet. ODRL heeft dat gemeten op main en op
de eigen branch, met de bundel *openbaar* en zonder inloggen. Uitkomst: **een bundel heeft geen
reikwijdte.** Is `TOEGANG_BUNDEL` gezet, dan beoordeelt de PEP elk registertype dat via de
generieke routes gelezen wordt (`/full/*`, de platte GE-routes, GraphQL). Voor een type waar geen
regel over gaat, geldt `Standaard: weigeren`, en dan volgt een 403.

| route | main | branch, zonder header | branch, met doel |
|---|---|---|---|
| `/full/natuurlijk_personen` | 200 | 403 | 200 |
| `/full/gebruikers`, `/gebruikers` | 403 | 403 | 403 |
| `/full/formulier_-`, `lijst_-`, `weergave_-`, `dashboard_definities` | 403 | 403 | 403 |
| `/full/landen`, `/referentielijsten` | 403 | 403 | 403 |
| `/registraties`, `/wijzigingen` (plumbing) | 401 anoniem; met inlog toegestaan | idem | idem |
| `/tests`, GraphQL-introspectie | 200 | 200 | 200 |

Dat het beheerdomein en de definities dichtgaan, komt dus **niet door de doelbinding**. Het
gebeurt op main al sinds `TOEGANG_BUNDEL` bestaat; dat staat alleen aan bij proeven. De
doelbinding voegt er alleen aan toe dat ook de gegevens die het beleid noemt dichtgaan als er
geen header meekomt. Dit is dan ook geen voorwaarde voor de merge van ODRL. Het is wel een
voorwaarde om `TOEGANG_BUNDEL` buiten een proef aan te zetten. Daarvoor zijn drie opties:

1. **De bundel krijgt een reikwijdte.** Alleen de domeinen of typen die het beleid noemt, vallen
   onder de PEP. Voor de rest blijft het gewone rol- en leestoegangsmodel gelden.
2. **Een tweede beleid** met `Standaard: toestaan` voor het beheer- en inrichtingsdomein, naast
   het beleid op persoonsgegevens. Dat kan pas als er meerdere bundels kunnen zijn, of als
   beleidsregels samengevoegd kunnen worden.
3. **Een ander proefbeleid.** Nu zet elk beleid met `Standaard: weigeren` het hele register dicht.

**Besluit Mark (24-11, gemeld door ODRL): optie (1), een reikwijdte per beleid.** ODRL heeft het
gebouwd op `feat/toegang-verzoekzijde` (nog niet gecommit):

- De bundel krijgt een veld `reikwijdte`: de entiteittypen die het beleid noemt, afgeleid uit
  het eerste padsegment van de gegevens van toestemmingen en verboden. Een bundel zonder dat veld
  leidt het af bij het laden.
- Valt een type buiten de reikwijdte, dan staat de PDP het toe, zonder standaard en zonder
  doelbinding. De gewone rol- en leestoegang beslist daar.
- Een regel op alle gegevens van de betrokkene (`*`) maakt het hele register de reikwijdte;
  `compileerBundel` meldt dat.
- Gemeten door ODRL met *openbaar*, zonder header: gebruikers, de definities, landen, locaties en
  referentielijsten geven 200. `/full/natuurlijk_personen` geeft zonder doel 403 en met doel 200.

De zorg van OMNIUM-UI is hiermee weg. De ODRL-export verandert niet: daar volgt de reikwijdte al
uit de targets van de regels.

## 7. Besluiten van Mark en wat open is

| # | Onderwerp | Besluit |
|---|---|---|
| 1 | Richting | Het doel is een ArchiMate Goal (M1), als opstap naar een stabielere bron (§4.1). 23-11 |
| 2 | Waar staan de Goals? | In het architectuurproject van de organisatie; het verwerkingsregister is een weergave daarvan. 24-11 |
| 3 | Beheer zonder doel | Via het beleid: een eigen regel voor de beheerrol. Geen uitzondering in de PEP. 24-11 |
| 4 | Dienst en dienstversie | Dienst = Business service (M1), dienstversie = object in het inrichtingsregister (M0). 23/24-11 |
| 5 | Reikwijdte van een bundel | Een reikwijdte per beleid; gebouwd door ODRL (§6). 24-11 |
| 6a | Het `EDienst`-object | Blijft, met dezelfde uuid als de Business service. 24-11 |
| 6b | Hernoemen naar `Dienst`/`Dienstversie` | Ja, bij een latere rebuild. Niet in de rebuild voor de omgevingswizard (FUNDAMENT, 25-11): die blijft additief. 24-11, 25-11 |
| 6c | Versie verwijst naar haar voorganger | Ja, zodat de versiegraaf ook vertakkingen kan tonen. Nog te verwerken in het inrichtingsmodel (FUNDAMENT). 25-11 |
| 7 | M0-weergave en rondreis | Geen simulatie, geen wijziging in de Studio; de werkbank op het register stuurt de sync (§4.2). 24-11 |

Open:

- **Rondreis.** Wie bouwt de sync in de werkbank, en langs welke weg leest en schrijft die het
  model (§4.2)? Mark (25-11): voorleggen aan AI-INRICHTEN en FUNDAMENT; dat is gedaan.

## 8. Stappen, na akkoord

Mark gaf op 25-11 akkoord op stap 1.

| Stap | Wat | Wie |
|---|---|---|
| 1 | Toegangsspraak: `Doel:` zoekt het Goal op in het gekoppelde ArchiMate-model; bij een onbekend doel een melding; `archimateKoppeling.js` maakt dan geen nieuw Goal meer als er al een is | TRANSFORMATIES |
| 2 | Bundel en ODRL-export: binding op de uuid, met de naam ernaast | ODRL (bundel), TRANSFORMATIES (ODRL-export) |
| 3 | ArchiMate-profiel: `uitwerking` op `business-service` (nieuwe profielversie) | M2 / OMNIUM-UI |
| 3b | Dienstversie verwijst naar de Business service; de artefacten nemen het doel over (GZAC-procesvariabele, ZAC-zaaktypekoppeling) | TRANSFORMATIES, met FUNDAMENT en PLUGIN |
| 3c | Rondreis tussen model en inrichtingsregister, gestuurd vanuit de werkbank (§4.2) | nog te beleggen |
| 3d | Sjabloon in de Studio voor een beheerregel zonder doel (besluit 3) | OMNIUM-UI / TRANSFORMATIES |
| 4 | Studio: doelkiezer bij het testen van toegang | OMNIUM-UI |
