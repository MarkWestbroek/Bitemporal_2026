# CMMN in het kort

> Achtergrond bij het CMMN-profiel in Omnium Studio
> (`web/vite/src/diagramprofielen/cmmn/`, activiteit "CMMN").
> Datum: 2026-08-08. Voor wie modelleertechnisch thuis is maar deze notatie
> niet dagelijks gebruikt.

---

## 1. Waar het vandaan komt

De OMG heeft drie procesnotaties die bedoeld zijn als drieluik:

| | Vraag | Karakter |
|---|---|---|
| **BPMN** | *hoe verloopt het?* | het proces dat je vóóraf kent |
| **DMN** | *wat is het besluit?* | de beslislogica |
| **CMMN** | *wat kán er gebeuren?* | de casus die je niet vooraf kent |

CMMN 1.1 is van 2016 en komt uit het casemanagement-erfgoed van IBM en Cordys.

## 2. Het centrale idee

BPMN zegt: *"eerst dit, dan dat."*
CMMN zegt: *"dit mág, zodra…"*

Je tekent geen volgorde maar een **verzameling dingen die kunnen gebeuren**, elk
met voorwaarden. Een bezwaarbehandelaar hoort de belanghebbende misschien wel,
misschien niet, misschien twee keer — en dat is geen uitzondering op het proces,
dat *is* het proces.

Daarom heeft CMMN **geen sequence flows**. Als je in een CMMN-plaat pijlen ziet
die "eerst-dan" betekenen, is het model verkeerd. Dat is het lastigste om af te
leren als je uit BPMN komt.

## 3. De begrippen, van buiten naar binnen

- **Case** — het geval zelf. Het **Case Plan Model** (de mapvorm) is de
  buitenste omhulling: alles wat er in deze casus kán gebeuren.
- **Case File** — het dossier. **Case File Items** zijn de gegevens erin (een
  aanvraag, een rapport). Niet decoratief: een gebeurtenis op een dossieritem
  ("er is een rapport toegevoegd") kan werk in gang zetten.
- **Stage** — een fase, en tegelijk een groepering. De achthoek. Kan ingeklapt
  worden (⊞).
- **Plan Item** — verzamelnaam voor alles wat in het plan staat: tasks, stages,
  milestones, event listeners.
- **Task** — het werk. Vier soorten:
  - **Human Task** — een mens doet het;
  - **Process Task** — start een proces (bijvoorbeeld BPMN) — hier haken de
    twee notaties in elkaar, zie §7;
  - **Case Task** — start een deelcasus;
  - **Decision Task** — roept een beslissing aan (bijvoorbeeld DMN).
- **Milestone** — het stadion-vormpje. Géén werk, alleen een bereikt resultaat:
  "besluit genomen". Handig als mijlpaal waar ánder werk op wacht.
- **Event Listener** — wacht op iets van buiten. **Timer** (termijn verstreken)
  of **User** (iemand drukt op de knop).

## 4. Het hart: sentries

Een **Sentry** is een bewaker, getekend als ruitje op de rand van een task,
stage of milestone. Twee soorten:

- **Entry criterion** (open ruit) — *wanneer mag dit beginnen?*
- **Exit criterion** (gevulde ruit) — *wanneer moet dit stoppen?*

Een sentry bestaat uit twee delen:

- **onPart** — de gebeurtenis waar hij naar luistert, getekend als de
  gestippelde lijn ernaartoe. Bijvoorbeeld: "*Hoor belanghebbende* is
  **complete**", of "het dossieritem *Rapport* is **create**d". De
  standaardgebeurtenissen zijn `complete`, `terminate`, `occur`, `create`,
  `update`.
- **ifPart** — een extra voorwaarde in expressievorm: "én het bedrag is hoger
  dan € 5.000".

Sentries zijn het **enige** koppelmechanisme. "Beoordeling mag pas beginnen als
het horen is afgerond" teken je dus niet als pijl van A naar B, maar als sentry
óp B, met een onPart die naar A wijst. Subtiel verschil, wezenlijk andere manier
van denken: de voorwaarde hoort bij *de ontvanger*, niet bij de verbinding.

## 5. Regels (de markeringen op de vorm)

| Markering | Regel | Betekenis |
|---|---|---|
| `!` | **Required rule** | de casus is niet af zolang dit niet is gedaan (of expliciet is overgeslagen) |
| `#` | **Repetition rule** | dit mag meerdere keren |
| `▷` | **Manual activation** | gaat niet vanzelf af zodra de sentry opengaat; een mens moet nog starten |
| — | **AutoComplete** (op een stage) | de fase sluit vanzelf zodra er niets verplichts meer openstaat |

## 6. Discretionary items en de planningstabel

Dit is het stuk dat CMMN echt onderscheidt van alles daarvoor.

Een **discretionary item** (gestreepte rand) staat wél in het model maar niet
automatisch in het plan: een casusbehandelaar mag het er **tijdens de
behandeling** bij pakken. De **planning table** is de plek waar die
keuzemogelijkheden hangen, en een **applicability rule** bepaalt wanneer een
discretionary item überhaupt aangeboden mag worden.

Dat is precies waar CMMN op mikt: het model schrijft niet voor, het **biedt
aan**. Een BPMN-model is een instructie; een CMMN-model is een gereedschapskist
met gebruiksvoorwaarden.

## 7. Levenscyclus

Elk plan item doorloopt toestanden. Voor tasks en stages:

```
available → enabled → active → completed
                   ↘        ↘ terminated / failed
                    disabled   (suspended kan er tussendoor)
```

Milestones en event listeners hebben een kortere cyclus: `available` →
`completed` (via de gebeurtenis `occur`) of `terminated`.

Dit is waar je in debugt als je ooit met een CMMN-engine werkt. "Waarom staat
mijn taak er niet?" is bijna altijd: de sentry is niet opengegaan, of het item
staat op `disabled` door een applicability rule.

## 8. Toepasbaarheid in de praktijk

Wereldwijd heeft CMMN beperkt voet aan de grond gekregen. **Camunda heeft het
met versie 8 laten vallen**; **Flowable** ondersteunt het nog volwaardig.

**Maar in het Nederlandse gemeentelijke domein ligt dat anders.** In **ZAC**
(het Zaakafhandelcomponent, met Flowable als motor) wordt naar schatting **90%
van de gevallen met CMMN gemodelleerd** en slechts een klein deel met BPMN. Het
aantal gemeenten dat ZAC gebruikt is nog klein, maar de *toepasbaarheid* is daar
groot — en dat is niet toevallig: bezwaar, handhaving en vergunningverlening
laten zich slecht in een vaste procesvolgorde persen. Zaakgericht werken is
casemanagement.

Voor Omnium Studio is de vraag "is het een levende uitvoeringsstandaard?"
overigens minder zwaar dan voor een engine-leverancier: wij tekenen en
modelleren, wij voeren niet uit. Als notatie om over casusgericht werk te
*praten* is CMMN waardevol, ook los van welke engine er straks onder ligt.

## 9. De fusie BPMN + CMMN — "los waar het kan, vast waar nodig"

Dat is de juiste ambitie, en het is deels al mogelijk. Er zijn drie bestaande
routes, in oplopende volledigheid:

1. **CMMN roept BPMN aan** — de **Process Task** is precies daarvoor gemaakt:
   binnen een losse casus zit één strak stukje procedure, en dát modelleer je
   in BPMN. Andersom kan ook (**Case Task** start een deelcasus). Dit is de
   route die ZAC/Flowable in de praktijk gebruikt.
2. **BPMN's eigen antwoord: het ad-hoc subproces.** BPMN heeft een
   constructie voor "een verzameling activiteiten zonder voorgeschreven
   volgorde" — het *ad-hoc subprocess*. Conceptueel is dat een mini-casus
   binnen een proces. Het is de reden dat Camunda kon zeggen "gebruik BPMN met
   ad-hoc". In de praktijk is het slecht ondersteund en armer dan CMMN (geen
   sentries, geen discretionary items), maar het is er.
3. **Eén gemengd diagram** — bestaat niet, in geen enkele standaard. Dat is het
   gat waar je op wijst.

**Wat wij hier al kunnen.** Route 1 is bij ons vrijwel gratis, en dat is geen
toeval: de CMMN Process Task en het BPMN-subproces zijn allebei "een node die
naar ander gedrag verwijst" — hetzelfde `gedragsVerwijzing`-primitief
(`STUDIO-05-gedragsdiagrammen.md` §3.2). Dat primitief is bewust
**cross-notatie** gebouwd: een activity-node kan een BPMN-subproces aanroepen
en omgekeerd, want het is dezelfde relatie.

Concreet openstaand punt: de CMMN process task en case task hebben nog géén
`gedragsVerwijzing: true`. Dat toevoegen is een paar regels en levert meteen
doorklikken op — van een casus naar het BPMN-proces dat één stap ervan
uitvoert, en terug. Dat is route 1 volledig, in beeld en in het model.

Route 3 (één gemengd diagram) is een onderzoeksvraag, geen bouwopdracht. De
interessante deelvraag daarbinnen: *wat is het minimale mechanisme waarmee een
losse verzameling en een vaste volgorde in één plaat kunnen samenleven zonder
dat de lezer in de war raakt?* Ons profiel-mechanisme laat dat experiment
toe — een profiel is een declaratie, dus een "los-en-vast"-profiel is te
schetsen zonder iets in de motor te breken.

## 10. Wat het profiel in Studio dekt

**Wel:** case plan model (mapvorm) en stage (achthoek) als containers, task met
soort (human/process/case/decision) en de markeringen `!`/`#`/`▷`, discretionair
als gestreepte rand, milestone (stadion), event listener (dubbele cirkel, timer
of user), case file item, sentry (open = entry, gevuld = exit) als rand-element,
en de on-part-lijn met standaardgebeurtenis.

**Nog niet:** de **planningstabel** (§6 — de discretionary items zijn er wel, de
tabelmarkering niet), **caseFileItem-relaties** (parent/child/refer), en de
**expressietaal** achter sentries en rules. Dat laatste is de interessantste
openstaande keuze: koppelen aan CEL of Toegangsspraak in plaats van er een taal
bij te verzinnen.

---

*Zie ook:* `docs/plans/2026-07-17 ArchiMate en verdere notaties (plan).md` (§CMMN),
`docs/STUDIO-05-gedragsdiagrammen.md` (§3.1 rand-aanhechting — waar de sentry op
draait), `docs/plans/2026-07-29 Overdracht Notaties — diagramprofielen (status).md`.
