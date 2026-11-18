# Uuid voor de elementen van alle talen — projectformaat 5 (plan, 18-11-2026)

*Sessie OMNIUM-UI (Claude), op vraag van Mark (18-11). Status: **voorstel, niets gebouwd**; §8
bevat de vragen waarop Mark moet beslissen. Aanleiding: marks (plan 2026-11-18 Marks) verwijzen
op de uuid, maar alleen het canonieke model heeft uuid's.*

## 1. Kern

Sinds projectformaat 4 (15-11) heeft elk modelelement en elk veld van het **canonieke model** een
uuid. Dit plan breidt dat uit naar **alle talen**: BPMN, DMN, ArchiMate, UML, MIM, ERD, OAS en de
rest. Daarna verwijst een mark overal op dezelfde manier, en heeft ook een veld buiten het
canonieke model een identiteit die een hernoeming overleeft.

## 2. Wat er nu is

- `canoniek-uml/uuids.js`: `UUID_SOORTEN` (entiteit, gegevenselement, relatie, enumeratie,
  gegevenstype, referentielijst-instantie) en hun velden in het compartiment "velden" krijgen
  `data.uuid`.
- De Studio vult ontbrekende uuid's zelf aan, na het openen en na elke eigen wijziging
  (`studio/uuidAanvulling.js`). De uuid is **afgeleid** (uuid v5): een element uit het stamproject
  en zijn element-id, een veld uit de uuid van zijn element, het compartiment en de veldnaam van
  dat moment. Twee clients, of een branch en zijn MAIN, komen zo op dezelfde uuid's uit. Eenmaal
  gezet blijft een uuid staan, ook na hernoemen.
- Alleen de canoniek-store doet mee (`startUuidAanvulling` in `maakDiagramActiviteit.jsx`, als
  het profiel `vulUuids` heeft).
- Voor de servers is er `scripts/projecten-uuids-aanvullen.mjs`.
- Een Studio weigert een werkbestand met een hogere formaatversie dan hij kent
  (`normaliseerProjectData`: "werk de Studio bij").

## 3. Wat het oplevert, eerlijk gewogen

Een **element** heeft al een id dat binnen een project stabiel is. Voor een element voegt de uuid
dus vooral eenvormigheid toe: één manier van verwijzen in alle talen, en een identiteit die ook
buiten het project uniek is.

De winst zit bij **velden**. Een veld heeft geen eigen id; buiten het canonieke model is de naam
het enige houvast. Een mark of een veldverwijzing op zo'n veld breekt nu bij een hernoeming. Met
een uuid niet meer. Ook *samenvoegen per veld* wordt er beter van: dat koppelt velden nu op uuid
en valt anders terug op de naam.

Wat het **niet** oplost: koppelingen tussen talen en element-verwijzingen blijven op profiel en
element-id werken. Dat is geen probleem (die id is stabiel) en omzetten is een aparte stap (§7).

## 4. Voorstel

**Welke elementen.** Alle elementen van alle talen op de motor, ook verbindingen (een mark kan op
een relatie staan), en elk veld met een naam, in elk compartiment. Niet: de klassieke editors
(dmn-js, bpmn.io), want die lopen niet mee in het project.

**Afleiding.** Zoals nu, met één verschil voor de nieuwe talen: het profiel gaat mee in de naam,
`element:<profielId>/<elementId>`. Zonder dat krijgen twee elementen met hetzelfde id in twee
talen dezelfde uuid (een entiteit `Aanvraag` en een BPMN-data-object `Aanvraag`). Voor het
canonieke model blijft de afleiding ongewijzigd, zodat bestaande uuid's niet veranderen.

**Waar de code komt.** De aanvulling verhuist van `canoniek-uml/uuids.js` naar de motor
(`diagramcore/model/uuids.js`): `ontbrekendeUuids(state, maak, {soorten?, compartimenten?})`.
Canoniek-uml geeft zijn eigen lijst mee (ongewijzigd gedrag); elk ander profiel krijgt de
standaard "alles". `maakDiagramActiviteit` start de aanvulling dan voor elk profiel.

**Marks omzetten.** Een mark die nu met `{profielId, elementId, veldNaam?}` verwijst, wordt
omgezet naar `{uuid}` zodra het doel een uuid heeft. Eén pure functie (`marksNaarUuid`), die de
Studio draait na de aanvulling. Het id van een mark volgt uit laag, soort en doel, dus twee
clients die tegelijk omzetten komen op hetzelfde uit. Tot de omzetting gedaan is leest het scherm
beide vormen.

**Formaatversie 5.** `PROJECT_FORMAAT_VERSIE = 5`. Een v4-bestand laadt gewoon en wordt v5 bij de
volgende snapshot, zoals v3 → v4 ging.

## 5. Gevolgen en risico's

| Onderwerp | Gevolg |
|---|---|
| **Oudere Studio** | Weigert een v5-project. Daarom eerst overal de nieuwe Studio uitrollen (app, pf, Fundament), en pas dan mag een project v5 worden. Zie §6, stap 1. |
| **Eerste keer openen** | Elk bestaand project krijgt één keer een reeks wijzigingen: een uuid op elk element van elke taal. Bij formaat 4 was dat goed te doen (lokaal 7 projecten, 513 elementen); nu gaat het om alle talen, dus meer. Het script voor de servers doet het in één keer. |
| **Branches** | Branch en MAIN leiden dezelfde uuid's af, dus er komt geen verschil bij. Voorwaarde: beide worden aangevuld vóór een samenvoeging. Het script moet branches meenemen. |
| **Alleen-lezen** | Wie niet mag schrijven vult niet aan (zoals nu). Zijn scherm werkt met de terugval op id. |
| **Kopiëren** | Een kopie krijgt een nieuwe uuid (zoals nu bij het canonieke model). |
| **EA-import** | Geïmporteerde elementen dragen al een `eaGuid`. Die blijft apart: de uuid is van Omnium, de GUID van EA. Zie vraag 3. |
| **Exports** | BPMN-XML, OAS, V3: geen wijziging. De uuid staat alleen in het project (en voor het canonieke model al in V3). |
| **Profielversies** | Geen wijziging van een descriptor, dus geen nieuwe profielversies. |
| **Omvang** | Elk element en veld wordt 45 tekens groter. Voor een groot project (enkele duizenden elementen) is dat enkele honderden kB in de blob. |
| **Projectmetamodel** | Het model van M3-MOF legt "uuid vanaf formaat 4, canoniek" vast als eis; dat wordt "formaat 5, alle talen". De controletest en het voorbeeldbestand moeten mee. |

## 6. Stappen

| Stap | Wat | Wie |
|---|---|---|
| 1 | Studio leert v5 **lezen** zonder zelf v5 te schrijven; die versie uitrollen op alle omgevingen | OMNIUM-UI, FUNDAMENT |
| 2 | Aanvulling naar de motor, voor alle talen, met het profiel in de afleiding; tests | OMNIUM-UI |
| 3 | Marks omzetten naar uuid; scherm leest beide vormen | OMNIUM-UI |
| 4 | Script voor de servers uitbreiden (alle talen, branches); droog draaien | OMNIUM-UI |
| 5 | Formaatversie naar 5; projectmetamodel en zijn test bijwerken | OMNIUM-UI, M3-MOF |
| 6 | Uitrollen, daarna het script per server | met Marks akkoord |

Stap 1 gaat een release vooruit op de rest. Zo is er geen moment waarop iemand met een oudere
Studio een project niet meer kan openen.

## 7. Bewust niet in dit plan

- **Koppelingen en element-verwijzingen op uuid.** Ze werken op profiel en element-id en dat is
  stabiel. Omzetten raakt de koppelingen-matrix, de afgeleide koppelingen, de DMN-invoer, de
  simulatie en de MCP. Pas doen als er een reden voor is (bijvoorbeeld verwijzen over projecten).
- **Uuid op diagrammen, voorkomens en mappen.** Geen vraag naar.
- **Uuid in de exports van andere talen.**

## 8. Vragen voor Mark

1. **Alles of een deel?** Alle elementen van alle talen (eenvoudig, eenvormig), of alleen wat een
   mark of veldverwijzing kan dragen? Mijn voorstel: alles.
2. **Ook verbindingen?** Mijn voorstel: ja, een mark kan op een relatie staan.
3. **EA-GUID als uuid?** Een uit EA geïmporteerd element heeft al een GUID. Die als uuid
   overnemen maakt een her-import eenvoudiger, maar dan zijn er twee soorten uuid (afgeleid en
   overgenomen). Mijn voorstel: niet overnemen; `eaGuid` blijft het koppelpunt met EA.
4. **Wanneer?** Stap 1 kan mee met de eerstvolgende release (0.46.1 of 0.47.0); de rest een
   release later. Of wacht dit tot er een concrete vraag is naar marks op BPMN of DMN?
5. **Nodig nu?** De enige gebruiker vandaag is een mark op een veld buiten het canonieke model.
   Als dat nog niet speelt, kan dit plan blijven liggen zonder dat er iets stuk gaat.
