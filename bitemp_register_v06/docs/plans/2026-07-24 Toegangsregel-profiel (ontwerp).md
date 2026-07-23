# Toegangsregel-profiel — visuele vorm van Toegangsspraak (ontwerp)

**Datum:** 2026-07-24
**Status:** denkrichting / ontwerpvoorstel (nog niet gebouwd)
**Bouwt op:** `2026-07-22 Klare-taal Toegangsbeleid — Toegangsspraak (ontwerp).md`,
`docs/TOEGANGSSPRAAK.md`, de diagramprofielen op de generieke motor en de
koppelingen-activiteit (kruisverbanden tussen profieltypen).

---

## 1. Idee

De canonieke vorm van Toegangsspraak is een deterministische projectie van de
AST — en de AST is klein en gesloten (± tien knoopsoorten). Dat maakt hem
precies geschikt als **profiel** op de generieke diagram-motor: dezelfde AST
krijgt er dan een **derde projectie** bij:

```
                    ┌── renderer ──▶  canonieke tekst (klare taal)
  Toegangsregel-AST ┼── odrl.js  ──▶  ODRL JSON-LD (NLGov)
                    └── profiel  ──▶  diagram (visuele regel)
```

Tekst en diagram zijn dan twee gelijkwaardige bewerkvormen van dezelfde regel;
de round-trip-garantie die nu voor tekst↔AST geldt, trekt door naar
diagram↔AST. Terminologie: het **element** heet *Toegangsregel* (één
kernzin); het document/diagram heet *Toegangsbeleid* (kop + begrippen +
regels) — "Access Policy" op documentniveau, regels als bouwstenen.

## 2. Elementtypen — afgeleid uit de canonieke vorm

De ontleding in de editor heeft de elementsoorten al blootgelegd én er een
kleur aan gegeven. Die kleurcodering wordt **de huisstijl van het profiel**:
wat in de tekst geel is, is in het diagram geel. Eén visuele taal, twee
weergaven.

| Profiel-elementtype | Uit AST | ODRL | Kleur (= ontleding) | Vorm (voorstel) |
|---|---|---|---|---|
| **Toegangsbeleid** | beleid | Policy (Set) | — | diagramkader met kopvakken (naam, geldigheid, grondslag, doel) |
| **Toegangsregel** | regel | Permission / Prohibition | band groen / rood | kaart met modaliteitsband links; verbod extra: ⃠-icoon |
| **Subject** | wie (begrip/kenmerken) | assignee (PartyCollection) | groen | afgeronde rechthoek, personen-icoon |
| **Handeling** | actie | action (nlgov:) | oranje | pil |
| **Gegevensselectie** | wat (verwijzing/alle/begrip) | target (Asset/-Collection) | geel | afgeronde rechthoek; label = van-vorm; ⚓-badge bij anker |
| **Voorwaardepoort** | blok en/of/xof | LogicalConstraint | paars (rand) | poort-knoop "alle" / "ten minste één" / "precies één", boomvormig |
| **Voorwaarde** | voorwaarde | Constraint | paars | kader: term — vergelijking — term |
| **Waarde** | literal | rightOperand | blauw | label (tekst/getal/datum) |
| **Plicht** | plicht | Duty | zeegroen | vlag/badge aan de regelkaart |
| **Begrip** | begripsdefinitie | Party-/AssetCollection | groen/geel, gestippelde rand | definitie-knoop — of extern, zie §4 |

### Schets van een regelkaart

```
┌─▌────────────────────────────────────────────────────┐   ▌ = modaliteitsband
│ Regel "inzage bij lopend dossier"          [gr o e n]│       groen = mag
│ ┌───────────────────┐   ┌──────────┐  ┌────────────┐ │       rood  = mag niet
│ │ Schuldhulpverlener│──▶│ bekijken │─▶│Inkomens-   │ │
│ │ (rol)             │   └──────────┘  │gegevens ▦  │ │   ▦ = cross-profiel-
│ └───────────────────┘                 └────────────┘ │       verwijzing
│  als ──▶ ◇ alle                                      │
│           ├─ [doel van de aanvraag] = ["schuldhulp…"]│
│           └─ ◇ ten minste één                        │
│               ├─ [achternaam …] begint met ["A"]     │
│               └─ …                                   │
│  waarbij ⚑ elke raadpleging wordt gelogd             │
└──────────────────────────────────────────────────────┘
```

De voorwaardeboom is het meest "diagram-achtige" deel: geneste opsommingen
worden poorten met takken — dezelfde structuur die de bullets in de tekst
uitdrukken, maar nu tweedimensionaal. (Vergelijk de DMN-beslistabel: ook daar
is de visuele vorm een projectie van dezelfde logica.)

## 3. Cross-profiel relaties — "het gebruikt elementen"

Het wezenlijke inzicht: het Toegangsregel-profiel **definieert** weinig eigen
inhoud; het **verwijst** vooral. Net als DMN-inputs die met een FieldRef aan
het canoniek model binden, wijst een Gegevensselectie naar een element in een
ánder profiel:

Een verwijzing is daarbij altijd een **paar (profiel, element)** — niet
hardgecodeerd naar het canoniek model, dat is alleen de *default*. Zo kan een
regel ook naar een element in een ander model wijzen (een andere doorsnede
van de universele projectboom, een extern register):

```json
{ "profiel": "canoniek-model", "element": "Organisatie.organisatienamen.naam" }
```

| Van (toegangsregel-profiel) | Relatie | Naar (profiel · element) | Drager |
|---|---|---|---|
| Gegevensselectie | *verwijst naar* | default canoniek model: veld/GE/entiteit | registerpad (FieldRef), bv. `de naam van een organisatie` → `Organisatie.organisatienamen.naam` |
| Subject / kenmerk | *verwijst naar* | rollenregister (of canoniek model) | rol-IRI |
| Begrip | *specialiseert / selecteert* | begrippenkader | zie §4 |
| Grondslag | *is gebaseerd op* | wettenlijst | IRI wetten.overheid.nl |
| Doel | *draagt bij aan* | doelenkader | doelbinding-term |

Dit zijn precies de **kruisverbanden** waarvoor de koppelingen-activiteit
(matrix tussen profieltypen) is bedacht — het toegangsregel-profiel wordt de
eerste grote afnemer. De metamodel-resolutie van Toegangsspraak
(`metamodel.js`) ís al de vertaling van de talige verwijzing naar het
doelelement; het diagram gebruikt dezelfde resolutie voor zijn bindingen.

## 4. Waar leven begrippen en wetten? → ArchiMate, geen nieuwe profielen

**Begrippen.** Eens met de intuïtie: begrippen horen op een hoger
abstractieniveau dan het logisch model (canoniek model). Voorstel: het
**ArchiMate Business Object** als drager van het begrippenkader — het
archimate-profiel bestaat al op de motor, de businesslaag is precies dat
hogere niveau, en de relatie *Business Object —realisatie→ canoniek-model-
entiteit* legt de brug naar het logisch model. Een apart "begrippenlijst-
profiel" zou dat dupliceren. Een Toegangsspraak-Begrip ("Inkomensgegevens
zijn: …") is dan een *selectie-verfijning* van zo'n business object: het
begrip verwijst naar het business object én naar de concrete selectie in het
canoniek model.

**Wetten.** Zelfde afweging, zelfde uitkomst: liever ArchiMate dan een kaal
Resource-profiel. De **motivatielaag** dekt dit domein verrassend precies:

- wet/artikel → **Driver** (aanleiding) of **Constraint** (dwingende regel);
  voor grondslagen bij toegangsregels is *Constraint* het meest treffend,
  met de wetten.overheid.nl-IRI als eigenschap;
- doelbinding → **Goal**;
- het toegangsbeleid zelf realiseert die constraints/goals — een relatie die
  auditors letterlijk willen zien (wet → beleid → regel → afdwinging).

Een simpel Resource-lijstje kan altijd nog als tussenstap (een lijst met
naam + IRI is snel gevuld), maar het doel-plaatje is de motivatielaag.

## 5. Hoe het past in wat er al is

- **Profiel op de generieke motor**, zoals canoniek-uml, OAS, MIM, DMN DRD,
  ArchiMate en sequence; registratie via `registreerActiviteitAlsProfieltype`
  zodat het ook in de Modelleren-host draait.
- **Derde tab "Diagram"** in de Toegangverlening-activiteit, naast Tekst en
  Canonieke vorm — drie projecties, één AST, wijzig in de vorm die je ligt.
- **Kleuren en iconen** uit `toegangActivity.css` (ontleding) hergebruiken
  als profiel-stijl; de vormen-/iconenregistratie van de Studio levert de
  bouwstenen.
- **Formulier-profiel als precedent**: dat dogfood-traject (formulier op de
  diagram-motor) is de mal voor "bestaande structuur → profiel".

## 6. Stappenplan (voorstel)

1. **Profieldefinitie**: elementtypen + relaties uit §2/§3 als
   profieldefinitie op de motor; kleuren = ontledingspalet.
2. **AST → diagram**: deterministische afbeelding (regelkaart + voorwaarde-
   boom); eerst read-only ("Diagram"-tab als derde projectie).
3. **Cross-profiel bindingen**: Gegevensselectie ↔ canoniek model via de
   bestaande resolutie; registreren in de koppelingen-matrix.
4. **Diagram → AST**: bewerken in het diagram (element droppen = van-vorm
   invoegen; poort omzetten = kwantor wisselen), met de tekst als bron van
   waarheid zolang de round-trip niet compleet is.
5. **ArchiMate-koppeling**: begrippen als Business Objects, grondslagen als
   Constraints, doelen als Goals; relaties in de koppelingen-matrix.

## 7. Open vragen — besluiten 2026-07-24

| Vraag | Besluit |
|---|---|
| Layout van voorwaardebomen | start met auto-layout; op de echte motor is alles vanzelf sleepbaar/schaalbaar, dus dit is alleen de beginstand |
| Bewerken: tekst-first of gelijkwaardig? | ✔ v1 tekst-first (diagram read-only), daarna gelijkwaardig — de round-trip-gedachte |
| Waar wonen begrippen definitief? | ArchiMate Business Object; wordt met de werkgroep afgestemd maar lijkt het gezondst, zeker gezien de band met **GEMMA** (grotendeels ArchiMate) |
| Eén regel per kaart of hele policy per diagram? | ✔ policy = diagram, regel = kaart erin; **elementen zijn herbruikbaar over diagrammen** |
| Verbod-notatie | rode band + ⃠, maar **checken op kleurenblindheid** — anders optioneel een tekstlabel ("verbod") erbij; vorm (band + icoon) draagt de betekenis dus nooit alleen kleur |
