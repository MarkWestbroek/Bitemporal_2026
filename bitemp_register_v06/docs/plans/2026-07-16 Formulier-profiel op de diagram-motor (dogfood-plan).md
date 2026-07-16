# Plan — Formulier-profiel op de diagram-motor ("eat your own dogfood")

> **Opgesteld**: 2026-07-16 (idee van Mark, avondsessie)
> **Status**: **P1 gebouwd** (2026-07-16): profiel `diagramprofielen/formulier/` (containers als
> nodes met veld-compartimenten, `bevat`-connector ◆ met volgorde-index, hiërarchie in de
> elementen-boom), pure adapter `layoutNaarFormulierModel` (5/5 unit-tests) en activiteit
> **"Formulier (diagram)"** (`formulierDiagramActivity`, standaard verborgen — via *Ga naar*).
> `herlaadUitModel` projecteert de definitie uit de formulier-editor-store: laad een formulier
> in de Formulieren-activiteit → open het diagram → "Herlaad uit model" — letterlijk twee
> controls op hetzelfde model. **P2 gebouwd** (2026-07-17): reverse adapter
> `formulierModelNaarLayout` (round-trip verliesvrij, 8/8 tests) + menu "Zet terug naar
> formulier-editor…" (behoudt geladen id → Opslaan werkt bij; veldInfo async verrijkt).
> Publiceren blijft via de editor (één schrijfpad + review). Index kreeg inklapbare
> entiteit-groepen + versielijst per definitie (F45-light). Open: gefilterde projectboom
> (§5b), P3 (één documentmodel), kruisverband-traces in de matrix.
> **Relatie**: bouwt voort op `2026-07-16 Formulier-editor Studio-activiteit (plan).md` (F41/F43–F47)
> en op de profiel-machinerie van STUDIO-05 (diagramcore, profielen, kruisverbanden, meta-editor §8.9).

## 1. Het idee

De `layout_json` van een FormulierDefinitie heeft een vast formaat — dat *is* feitelijk een
metamodel. Maak daar een **diagramprofiel** van (zoals canoniek-uml, OAS, MIM, DMN DRD,
state machine), dan wordt een formulierdefinitie een **modelleerbaar ding**: te bekijken en
te bewerken op een diagram in de Modelleren-editor.

Cruciaal: **het verandert niets aan de formdef zelf.** De bestaande formulier-editor
(palette → boom → preview) blijft gewoon bestaan — het wordt "een andere control op
hetzelfde model". En de formdef-browser wordt dan een **alternatieve projectboom** met
alleen formdefs erin.

## 2. Waarom dit sterk is

1. **Uniformiteit gratis.** Alles wat de diagram-motor al kan, krijgt de formdef cadeau:
   projectboom, **vrije mappen** (bestaat al in Modelleren — dat beantwoordt de eerdere
   mappen-wens zónder model-wijziging), structuur-undo, inspector, auto-layout,
   beeld-export, opdrachtenpalet.
2. **Kruisverbanden = impactanalyse.** `veld`-elementen verwijzen naar `ENT.GE.veld` in het
   canoniek model. Dat zijn precies **trace-links** voor de kruisverbanden-machinerie
   (fase 4, matrix + grafisch): *"welke formulieren raken `Initiatief.producten.naam`?"*
   wordt een query; een modelwijziging toont zijn impact op formulieren.
3. **Zelfde devloop als het canoniek model.** Ontwerpen in Studio → **publiceren naar het
   register** (bitemporeel). `saveFormulierDefinitie` (incl. update-in-place) ís die
   publiceer-stap al. Symmetrie: model → MetaRegistry; formulier → FormulierDefinitie.
4. **Dogfood.** Het bewijst de profiel-/meta-editor-machinerie (§8.9 trede 1/2) op een echt,
   klein, intern formaat — precies waarvoor die gebouwd wordt.

## 3. De ene harde regel (les uit de DMN-afweging, BACKLOG 0.0.1)

**Eén bron van waarheid: het register.** De FormulierDefinitie in de DB blijft de bron
(de inhoud-editor-runtime leest dáár). Het Studio-profieldocument is een **werkkopie /
projectie**. Twee representaties synchroon houden is de echte onderhoudslast, dus:

- Adapter `layout_json ↔ profieldocument` moet **lossless** zijn (onbekende sleutels
  pass-through, zoals de OAS-adapter met benoemde componenten doet).
- Import ("laad uit register") en publiceer ("sla op naar register") via het bestaande
  **transformaties-raamwerk**; geen stille tweerichtings-sync.
- Twee edit-oppervlakken (diagram-inspector én formulier-editor) zijn pas veilig als ze op
  **hetzelfde documentmodel** werken — dat is het eindbeeld (P3); tot die tijd bruggen via
  expliciete import/export.

## 4. Profiel-schets

Elementtypen (analoog aan het MIM-profiel: nodes met `compartments`, nesting via
`containerVoor` + `hierarchie` in de boom):

| Profieltype | Layout-element | Bijzonderheden |
|---|---|---|
| `formulier` | root/document | document in de projectboom; meta (naam/doeltype/status/is_standaard/versie) als properties |
| `groep` | `groep` | label, context; container (`bevat`) |
| `rij` | `rij` | container; **F47: kolom-variant** past hier als tweede layout-container (of één container met richting-property) |
| `lijst` | `lijst` | bron-referentie naar meervoudig GE; container voor item-template |
| `conditioneel` | `conditioneel` | conditie (veld/op/waarde) als properties |
| `veld` | `veld` | **`veldpad`-referentie naar het canoniek model** via een resolver (`referenceTypes`, zoals MIM's typekandidaten) → dit levert de kruisverband-trace; label/breedte/widget/readonly als properties |
| later | `virtueelVeld`, `regel`/`zetWaarde` | P2 van het formulier-editor-plan |

Aandachtspunten:
- **Volgorde is betekenisvol** in een formulier; diagram-posities zijn vrij. De *boomvolgorde*
  (elementen-onderboom) is leidend voor de serialisatie; het diagram is weergave. Verticale
  auto-layout als default.
- De adapter is klein: beide kanten zijn JSON-bomen (layout-elementen ↔ geneste
  profiel-elementen), 1-op-1.

## 5. Fasering

- **P1 — read-only projectie.** Profiel registreren; import-transformatie
  `FormulierDefinitie → profieldocument` (formdefs verschijnen als documenten in de
  Modelleren-boom, in mappen te ordenen); diagramweergave; `veld`-refs zichtbaar als
  trace-links. Geen bewerken, geen publiceren.
- **P2 — bewerken + publiceren.** Elementen maken/wijzigen op diagram + inspector;
  publiceer-transformatie → `saveFormulierDefinitie` (update-in-place bestaat).
  Kruisverbanden-matrix toont formulier ↔ canoniek-model-verbanden.
- **P3 — één documentmodel.** De bestaande formulier-editor (palette/boom/preview) wordt een
  tweede *control* op hetzelfde profieldocument; de aparte FormulierIndex kan dan opgaan in
  de projectboom-variant. Live preview blijft — dat is de kracht van de formulier-editor.

## 5b. Aanvullingen (Mark, 2026-07-16)

- **Gefilterde projectboom.** Er komt behoefte aan een boom-optie die filtert op soort:
  alleen formulieren, of formulieren + entiteiten. Die gefilterde boom landt in de
  formulieren-activiteit als browser van de beschikbare definities (vervangt op termijn de
  losse `FormulierIndex`).
- **Persistentie-/bitemporaliteits-spectrum.** Niet alle modelelementen leven gelijk:
  1. *Formulierdefs* leven **direct in de DB** met eigen bitemporele tabellen (zelf ook
     dogfood: FormulierDefinitie is een gemodelleerde entiteit).
  2. *Canoniek-modelelementen* (ENT/GE/REL/reflijst/…) leven óók in de DB maar anders:
     als **metamodel-definitie** én als **geïnstantieerde tabellen** — dat laatste is
     secundair (gerealiseerde output van de generator-transformatie).
  3. *Overige profielelementen* (BPMN/DMN/state machine/…) zitten **niet** in de DB
     (alleen project-werkbestand).
  Het profiel/de boom moet dit verschil kennen (bv. per documentsoort een andere
  bron/refresh/publiceer-semantiek).
- **Picker ↔ boom.** Mogelijk merget de veld-picker t.z.t. gewoon met de projectboom
  (één boom, één mentaal model). Nog geen besluit — gevoel.

## 6. Risico's / open punten

- **Dubbele edit-oppervlakken** vóór P3: uitsluitend via expliciete import/export, anders
  divergentie (zie §3).
- **Bitemporele versies (F45)** blijven register-kant; de Studio-boom toont hooguit een
  versielijst per document (geen volle bitemporele boom — bewust simpel).
- **Preview op het diagram**: niet doen; preview hoort bij de formulier-control. Het diagram
  is structuur + verbanden.
- Prioriteit t.o.v. lopende punten (dnd-kit, F46-restjes, mappen): dit plan is *richting*;
  de kleinere UX-verbeteringen op de bestaande editor blijven de kortste route naar dagelijks
  gebruik.
