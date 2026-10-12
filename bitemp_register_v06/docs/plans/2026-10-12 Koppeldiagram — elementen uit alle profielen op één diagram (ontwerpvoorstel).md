# Koppeldiagram — elementen uit alle profielen op één diagram (ontwerpvoorstel)

*2026-10-12. Aanleiding: Mark wil koppelingen tussen profielen (de matrix) ook visueel kunnen
maken en bekijken, op diagrammen waar elementen uit meerdere profielen samenkomen. Status:
voorstel met Marks eerste keuzes (12-10); nog niets gebouwd.*

## 1. Wat er al is

| Onderdeel | Stand | Bron |
|---|---|---|
| Koppeling (kruisverband) | `{id, rij:{profielId,elementId}, kolom:{…}, soort, omgekeerd}`; id = de cel, dus één koppeling per paar | `koppelingenActivity.jsx:128-157` |
| Soorten | *komt voort uit*, *heeft te maken met* (standaard), *genereert*, *realiseert* | `TRACE_TYPEN`, `:43-48` |
| Opslag en sync | eigen store `kruis`, gesynct als net-diff (`patchLinks`); zit in de projectexport (`kruisverbanden`) | `operaties.js:376-381`, `modellerenActivity.jsx:2444` |
| Grafische weergave | één React Flow-canvas per *profieltype × profieltype*; een lijn trekken maakt een koppeling; posities in de kruis-store | `koppelingenGrafisch.jsx` |
| Verwijzing naar ander profiel | `element-verwijzing` (levenslijn → klasse, object → klasse), drop via `ELEMENT_REF_MIME` | `sequence/index.js:50`, `externDrop.js` |
| Validatie | geen: elk profiel mag naar elk profiel, elke soort | — |
| Uniekheid | element-id's zijn uniek **per profiel**; het paar `(profielId, elementId)` is de globale sleutel | `createDiagramStore.js:193` |

De weergave toont nu kaartjes met naam en profiel (zie screenshot 12-10), niet de eigen notatie.

## 2. Doel

1. **Meerdere koppeldiagrammen** per project, met naam, in de Studio-mappen (geen aparte boom:
   het is één model).
2. Elementen uit **elk profiel** erop, in **hun eigen notatie**, compact of uitgebreid.
3. **Koppeling leggen op het diagram = koppeling in de matrix** (zelfde model, twee views).
4. Koppelingen ook **op veldniveau**: attribuut ↔ OAS-veld.
5. Optioneel de **relaties binnen een profiel** tonen (NP met Naam en Partner naast de
   OAS-elementen), ter verduidelijking.

## 3. Het M2 van koppelingen: placeholders voor M3-elementen

Mark noemde drie richtingen. Mijn advies: **(b) en (c) samen, (a) niet nu.**

**(b) Placeholders `{Elementtype}` en `{Veldtype}`.** Het koppelprofiel (M2) definieert zijn
vier verbindingstypen niet tussen concrete typen, maar tussen *metaniveau-placeholders*:

| Verbinding | Van | Naar |
|---|---|---|
| element ↔ element | `{Elementtype}` (elk profiel) | `{Elementtype}` |
| element ↔ veld | `{Elementtype}` | `{Veldtype}` |
| veld ↔ veld | `{Veldtype}` | `{Veldtype}` |

In het typecontract (`schema.js`) wordt dat een bron/doel-verwijzing naar een **M3-soort** in
plaats van een type-id, bv. `bron: { metaSoort: "ElementType", profielen: "*" }`, optioneel
ingeperkt (`profielen: ["canoniek05", "oas31"]`). De accolades in Marks notatie maken het
niveauverschil zichtbaar; dat nemen we over in de profiel-ontwerper.

**(c) Een basisprofiel met de algemene elementen.** **Kader**, **Notitie** en **Notitie-lijn**
staan nu in elk profiel opnieuw, met in de profiel-ontwerper een woud aan notitie-lijnen naar elk
type (screenshots 12-10). Met (b) kan één basisprofiel ze eenmaal definiëren: een notitie-lijn
loopt naar `{Elementtype}` of `{Veldtype}`. Elk diagram mag elementen uit het basisprofiel
bevatten; de profielen raken ze kwijt.

**Waarom (b)+(c) bij elkaar horen.** Een notitie uit het basisprofiel op een UML-diagram is een
element uit *een ander profiel* op dat diagram. Dat is precies het vermogen dat het koppeldiagram
nodig heeft. We bouwen het dus één keer: **een diagram kan verwijzingen naar elementen van andere
profielen bevatten**. Het koppeldiagram is dan gewoon een diagram van het koppelprofiel.

**(a) Overerving tussen profielen** (een superklasse voor alle elementtypen en een voor alle
veldtypen) doet hetzelfde, maar trekt de erfenisregels (`erft`, `isAbstract`, nu binnen één
profiel) over de profielgrenzen. Dat compliceert de resolutie, de validatie en de
profiel-ontwerper flink, voor geen extra uitdrukkingskracht. Bewaren voor als profielen echt
semantiek gaan delen.

## 4. Weergave per profiel: compact of uitgebreid

- **Compact**: naam, type-icoon en profiel (zoals nu in de grafische weergave). Goed voor
  element-mappings.
- **Uitgebreid**: de eigen notatie van het profiel, mét compartimenten. Nodig voor veld-mappings.
- **Keuze per diagram × profieltype** (Mark, 12-10), met *compact* als standaard. Het
  koppeldiagram bewaart `weergavePerProfiel: { canoniek05: "uitgebreid", oas31: "uitgebreid" }`.
  Technisch is dat een **gedaante** (shape-set) per profiel, gekozen per diagram, dus het bestaande
  mechanisme, uitgebreid van één naar meerdere profielen.

**Veldkoppelingen** vragen twee nieuwe dingen:

1. **Aanhechten aan een veldregel**: elke regel in een compartiment krijgt (alleen in dit
   diagram) een onzichtbaar aanhechtpunt links en rechts.
2. **Stabiele veld-id's**: een koppeling wijst nu naar `(profielId, elementId)`. Voor een veld is
   een derde deel nodig. De huidige veldsleutel is `compartiment:index`, en die verschuift bij
   herordenen. Velden hebben dus een **eigen id** nodig. Dat is een M3-wijziging (FieldType-instantie
   krijgt `id`), af te stemmen met M3-MOF.

## 5. Diagrameigenschappen als venster

Het koppeldiagram heeft meer instellingen dan nu in het paneel passen. Voorstel: een venster
**Diagrameigenschappen** met tabs, zoals EA:

| Tab | Inhoud |
|---|---|
| Algemeen | naam, omschrijving, map |
| Weergave | per profiel compact/uitgebreid (gedaante); stereotypen, typering |
| Elementen | relaties binnen profielen tonen (aan/uit, per profiel) |
| Verbindingen | lijnvorm-standaard, labels |
| Thema | vormregels/huisstijl (zie het vormregelvoorstel) |

Dat venster is ook bruikbaar voor gewone diagrammen.

## 6. Kleur

- **Koppeling = Omniumpaars**, als accenttoken `koppeling` (vormregelvoorstel §3.1).
  Let op twee botsingen: de **selectiekleur** van het canvas is al merk-indigo `#4f46e5`, en de
  **render-API** tekent gewone relaties nu in violet (`--diagram-accent`). Voorstel: koppeling
  violet **`#7c3aed` / `#a78bfa`** (contrast 5,7 : 1 op wit, 6,3 : 1 op donker), selectie blijft
  indigo, en gewone relaties in de render-API gaan naar de standaard-lijnkleur.
- **Afgeleid = oranjerood** (Mark, 12-10). Dat verschuift het "zachte rood" uit het
  vormregelvoorstel naar oranje, bv. `#c4502b` / `#f2865f` (4,6 en 6,8 : 1). Het blijft goed te
  onderscheiden van het paars.

## 7. Bewerken en rechten

- Een koppeldiagram is een view, zoals elk diagram. **"Van het diagram halen"** mag altijd.
  **"Uit het model verwijderen"** van een element uit een ander profiel staat hier standaard
  **uit**, omdat je vaak naar modellen van anderen wijst. Een koppeling verwijderen mag wel; die
  is van dit diagram.
- **Rechten per map** (Mark, 12-10): "gebruiker A mag alleen map X wijzigen, Mark alle mappen".
  Dat zijn autorisatieprofielen **in de tool, gemodelleerd met de tool**: het toegangsregelprofiel
  en de FTV/ODRL-keten, toegepast op het eigen project (dogfooding). Dit hoort bij het plan
  *2026-10-12 Toegang op beleid — PAP, PDP en PEP*. Het koppeldiagram gebruikt het zodra het er
  is: elementen uit een map zonder schrijfrecht zijn alleen-lezen.

## 8. Meerdere projecten

Elk project heeft een UUID. Koppelen over projecten heen zou een verwijzing
`(projectId, profielId, elementId)` vragen, zoals EA met zijn element-GUID's. Dat staat los van
dit voorstel. Het echte risico is het browsergeheugen bij meerdere grote projecten tegelijk.

## 9. Gefaseerd bouwen

| Fase | Inhoud |
|---|---|
| 1 | Diagrammen kunnen **verwijzingen naar elementen uit andere profielen** bevatten (render met het eigen descriptor/gedaante van dat profiel); het koppelprofiel met de vier soorten en de placeholders `{Elementtype}`; **meerdere koppeldiagrammen** in de mappen; de bestaande grafische weergave wordt het eerste koppeldiagram (migratie) |
| 2 | Weergave per profiel (compact/uitgebreid) en het venster Diagrameigenschappen; kleur `koppeling` |
| 3 | **Veldkoppelingen**: stabiele veld-id's (M3-MOF), aanhechtpunten per veldregel, `{Veldtype}` |
| 4 | **Basisprofiel** (Kader, Notitie, Notitie-lijn) uit alle profielen halen; profiel-ontwerper toont `{Elementtype}`/`{Veldtype}` |
| 5 | Relaties binnen profielen tonen; rechten per map (na het toegangsplan) |

## 10. Open vragen

1. Akkoord met (b)+(c) en (a) uitstellen?
2. Kleur koppeling: violet `#7c3aed`, en gewone relaties in de render-API terug naar de
   standaard-lijnkleur?
3. Afgeleid oranjerood `#c4502b`: dan pas ik het vormregelvoorstel aan.
4. Stabiele veld-id's: oppakken met M3-MOF, of eerst element-koppelingen af?
