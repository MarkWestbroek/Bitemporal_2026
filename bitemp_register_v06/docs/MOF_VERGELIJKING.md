# OMG MOF 2.5.1 en het Omnium-M3 — vergelijking

Datum: 2026-10-07 · Bron: `docs/extern/MOF formal-19-10-01.pdf` (76 p.) ·
Claude-sessie met Mark, als voorbereiding op het modelregister
(`plans/2026-10-06 Modelregister — het model in het register (ontwerpvoorstel).md`).

Vraag: is ons M3 (`web/vite/src/diagramcore/types/schema.js`) een superset van
MOF? Kan een MOF-metamodel naar ons M3 getransformeerd worden, en andersom?

---

## 1. Leeswijzer MOF — wat is de kern

De spec is kort maar gelaagd. Dit is genoeg:

| Deel | Inhoud | Lezen? |
|---|---|---|
| 7 Architecture | lagen zijn niet rigide: minimaal 2 (Class/Object), MOF werkt met elk aantal; "M3/M2/M1/M0" is gewoonte, geen regel | ja, 2 p. |
| 9 Reflection | `Element.getMetaClass()`, `Object.get/set/isSet/unset`, `Factory.create` | diagonaal |
| 10 Identifiers | `Extent`, `URIExtent`, `Property.isID`, `Package.URI` | diagonaal |
| 11 Extension | **`Tag`** = naam/waarde-paar op elk element ("dynamische annotatie, bv. tool-data") | ja, 1 p. |
| **12 EMOF** | fig. 12.2–12.5 = het **volledige** EMOF; 12.4 = de 32 constraints die UML Kernel inperken | **ja — dit is de kern** |
| 13 CMOF Reflection | `Link` (instantie van een Association), `invoke` | nee |
| 14 CMOF | fig. 14.2 = UML Kernel mét subsets/redefines; voegt toe: navigableOwnedEnd, redefinition, subsetting, PackageMerge, Constraint/OpaqueExpression | alleen 14.4 |
| 15 Abstract semantics | instantie-semantiek, optioneel voor EMOF | nee |

De bijgevoegde figuren 12.2–12.5 zijn dus inderdaad de kern: **EMOF = Package,
Class, Property, Association, Operation/Parameter, DataType/PrimitiveType/
Enumeration/EnumerationLiteral, Generalization, Comment, Type/TypedElement/
MultiplicityElement + Tag + reflectie + identifiers.** Sinds 2.4 is MOF geen
eigen metamodel meer maar *het UML-metamodel met OCL-constraints* (12.4, 14.4);
EMOF staat op zijn beurt in zichzelf beschreven (dogfooding, §8.1 van de spec).

Wat MOF **niet** doet: notatie, vormen, diagrammen, tool-gedrag. Dat zit bij
OMG in aparte specs (Diagram Definition/DI, BPMN DI, DMN DI) en in de notatie-
hoofdstukken van UML. MOF is uitsluitend **abstracte syntaxis**.

---

## 2. Twee assen, niet één lijn

De vraag "superset of subset" gaat uit van één as. Het zijn er twee:

```
                      abstracte syntaxis        concrete syntaxis / gedrag
                      (wat kan er bestaan)      (hoe ziet het eruit, wat doet de tool)
MOF (EMOF/CMOF)       rijk: generalisatie,      niets (→ DI-specs, prose)
                      derived, redefinition,
                      operations, OCL, Tag
Omnium-M3 Definitie   voldoende voor diagram-   —
                      talen, zónder generalisatie
Omnium-M3 Stijl/Impl  —                         rijk: shapes, compartimenten,
                                                taakbalken, gedaanten, afbakening,
                                                randElement, hooks, layouts, adapters
```

Conclusie: **ons M3 is noch subset noch superset van MOF.** Op de eerste as is
MOF rijker; op de tweede as heeft MOF niets en wij veel. De overlap is het
Definitie-domein. Dat is geen tekortkoming maar een andere scope: MOF is een
*metadata-framework* (repository, XMI, reflectie), ons M3 is een
*notatie-motor-contract*.

Opvallende parallel: MOF's `Tag` (11.2) is exact onze `element.data{}` /
`Element_Eigenschap`; MOF's `Element.getMetaClass()` is ons
`element.elementType → descriptor`; MOF's `Package`+`Factory` is onze
profiel-registry; `Property.isID`/`URIExtent` is onze element-id.

---

## 3. EMOF → Omnium-M3 (een MOF-metamodel als Omnium-profiel)

Een EMOF-metamodel (bv. BPMN, DMN, een DSL, een UML-package) laat zich
**mechanisch** naar een M2-descriptor projecteren. Regelset in de vorm van
`TRANSFORMATIES.md` (lezer = XMI, regelset = hieronder, toepasser =
`profielRegistratie`):

| EMOF | Omnium-M3 | Opmerking |
|---|---|---|
| `Package` | profiel (`DiagramType`) of `ElementType` met `containerVoor` | nestedPackage → hierarchie |
| concrete `Class` | `ElementType` (shape default `class-box`) | `isAbstract` → géén ElementType (zie verlies) |
| `Generalization` tussen metaklassen | **geen tegenhanger** → platslaan: features van supertypen kopiëren naar elk concreet subtype | verlies, zie §5 |
| `Property` getypeerd met `DataType`/`PrimitiveType` | `PropertyType` (`datatype` string/boolean/…; `lower`/`upper` → `verplicht`; `default` → placeholder/default) | op ElementType óf op FieldType |
| `Property` getypeerd met `Enumeration` | `PropertyType` datatype `keuze`, `opties` = literals | |
| composite `Property` naar "bladklasse" (klasse zonder eigen associaties/containment, bv. UML `Property` in `Class`) | `CompartmentType` + `FieldType` met de bladklasse-properties als `PropertyTypes` | `{ordered}` → compartiment-volgorde |
| composite `Property` naar "volle" klasse | hierarchie-connector (`DiagramType.hierarchie`) of `containerVoor` | |
| niet-composite `Property` getypeerd met `Class` (referentie) | `ReferenceType` + `PropertyType.referenceTypes` (resolver: elementen van dat type) | `opposite` → bidirectioneel |
| `Association` (2 memberEnds) | connector-`ElementType` (`isConnector`, `bron`/`doel` = eindpunt-typen, `kardinaliteiten` uit lower/upper, `aggregation` → `edgePresentatie` markers) | MOF-Association is zelf Classifier — net als bij ons: connector = Element |
| `Operation`/`Parameter` | `FieldType` "operatie" in een compartiment, of weglaten | geen uitvoerbaarheid |
| `Comment` + `annotatedElement` | note-ElementType + connector | |
| `Tag` | `element.data` | 1-op-1 |
| OCL-constraints, derived properties | `hooks.valideer`, `hooks.extraCompartimenten` (code) | niet declaratief |

Wat erbij móet (MOF zwijgt): shape, kleur, compartiment-labels, taakbalken,
layouts — defaults volstaan voor een werkend profiel; een notatie-ontwerper
verfraait daarna. Serialisatie: XMI-lezer/-schrijver als adapter (de MIM-XMI-
adapter is al een instantie hiervan).

**Verlies bij MOF → Omnium:** generalisatie-hiërarchieën (UML: `Classifier`,
`NamedElement`, …; ArchiMate: `Element` → `BehaviorElement` → …) worden plat.
Een verbindingsregel "Dependency: NamedElement → NamedElement" wordt een
cartesiaans product van concrete typen. Werkt, maar schaalt slecht en verliest
de intentie. Dat is het grootste gat — zie §5.

---

## 4. Omnium-M3 → EMOF (een Omnium-profiel als MOF-metamodel)

Het Definitie-domein van elk profiel projecteert naar EMOF:

| Omnium-M3 | EMOF | Opmerking |
|---|---|---|
| `DiagramType` | `Package` (+ `URI`) | |
| `ElementType` (niet-connector) | `Class` | `stereotype`/`label` → naam |
| `ElementType.properties` | `Property` ⟶ `PrimitiveType`/`Enumeration` | `keuze`+`opties` → Enumeration |
| `CompartmentType` + `FieldType` | composite `Property [0..*] {ordered}` ⟶ `Class` (het veldtype als klasse met zijn PropertyTypes) | |
| `ReferenceType` | `Property` ⟶ `Class` (niet-composite) | resolver-semantiek verdwijnt |
| connector-`ElementType` zónder properties, één bron×doel-paar | `Association` (binair, multipliciteiten uit `kardinaliteiten`) | |
| connector-`ElementType` mét properties, of met eindpunt-*lijsten* | `Class` met twee `Property` ⟶ `Class` (bron, doel) + abstracte `Class` per eindpunt-lijst | AssociationClass zit niet in EMOF [8]; eindpunt-lijsten hebben geen MOF-tegenhanger zonder generalisatie |
| `verbindingsregels` (n paren) | n Associations, of één op gezamenlijke abstracte supertype | |
| `afbakeningVoor`/`overbrugt`, `randElement`, `containerVoor` | OCL-`Constraint` (CMOF) of prose | niet in EMOF |
| Stijl/Implementatie (shape, kleur, gedaante, opname, samentrekking, hooks, layouts, taakbalken, adapters) | **`Tag`** (naam/waarde) op de metaklasse, of weglaten | lossless-maar-opaak; de OMG-manier zou een DI-metamodel ernaast zijn |

Dus: **elk profiel is in EMOF uit te drukken** (en XMI-exporteerbaar), met
Stijl/Implementatie als Tags of als apart DI-achtig model. Dat is precies de
richting van plan §8.5: Definitie = data, Implementatie = code op id.

---

## 5. Wat we van MOF moeten overnemen

1. **Generalisatie tussen ElementTypes** (`ElementType.erft`, `isAbstract`).
   Het enige structurele MOF-concept dat ons M3 mist en dat écht pijn doet:
   verbindingsregels op abstracte typen, overerving van PropertyTypes en
   compartimenten, kleinere profielen (ArchiMate, UML). Ook nodig om
   MOF-metamodellen verliesvrij te importeren. Register-kant heeft overerving
   al (TPT, `overerving-analyse.md`).
   **Gerealiseerd (2026-10-08, EA-SYNC, branch `feat/ea-qea-lezer`):**
   `ElementType.erft` + `isAbstract`, uitgevlakt bij registratie in
   `diagramcore/types/erfenis.js`; zie `STUDIO-05-diagramcore-plan.md` §4.2b.
   Keuze Mark (08-10): {Relatie} erft van {Gegevenselement} — `isConnector`
   mag bij overerving omslaan (EMOF legt "connector-heid" niet vast; dat is
   ons notatiebegrip), en een abstract *knoop*-type als bereik levert geen
   connector-afstammelingen op: "relatie: Representatie → Representatie"
   expandeert naar entiteit/gegevenselement, nooit naar relatie. Dat is de
   recursiegrens uit het canonieke metamodel (bron/doel zijn nooit zelf een
   REL) — in MOF-termen een OCL-constraint op de associaties bron/doel, geen
   generalisatieregel.
2. **`Tag` als expliciet M3-begrip** i.p.v. het ongetypeerde `data{}`: in het
   modelregister wordt dat `Element_Eigenschap` (sleutel, waarde) — MOF-conform
   zonder meer.
3. **Identifiers**: `Property.isID` en `URIExtent` ↔ onze element-id en een
   project-URI; nuttig voor kruisverwijzingen tussen registers.
4. **Scheiding abstracte/concrete syntaxis** vasthouden en benoemen: Definitie
   (≈ EMOF) vs. Stijl/Implementatie (≈ DI + tool). In het register: `Element`/
   `Veld`/`Verwijzing` zijn het MOF-deel; `Voorkomen` is het DI-deel.

Niet nastreven: MOF-*compliance* (vereist XMI-mapping per hfst. 15 en de
reflectie-API). Wel: **EMOF-uitdrukbaarheid** van het Definitie-domein, zodat
één generieke XMI/EMOF-importer een hele familie metamodellen ontsluit (UML-
packages, BPMN, DMN, SysML, CWM, MIM als UML-profiel) in plaats van per
notatie een handgemaakte descriptor.

---

## 6. Over "niet alle talen zitten in MOF"

Klopt, maar het betekent iets anders dan het lijkt. MOF *bevat* geen talen;
OMG-talen (UML, BPMN, DMN, SysML, CWM, MOF zelf) zijn *gedefinieerd in* MOF en
hebben daardoor XMI. ArchiMate (Open Group) is níet in MOF gedefinieerd — zijn
metamodel staat als informele klassediagrammen in de spec, met een XSD-
uitwisselformaat. Niets belet om ArchiMate in EMOF uit te drukken; het is
alleen niet gedaan. OAS en GraphQL zijn geen metamodellen in deze zin (JSON
Schema/SDL), MIM is een UML-profiel (dus MOF-familie). Voor Omnium is dat
onderscheid alleen relevant voor de **lezer**: XMI voor de MOF-familie, XSD/
JSON/SDL voor de rest. De regelset naar ons M3 is dezelfde.

---

## 7. Dogfooding, hun manier en de onze

MOF: CMOF beschrijft UML en zichzelf; EMOF is in EMOF beschreven. Omnium: de
profiel-ontwerper is een profiel (`profielOntwerp.js`), en met het modelregister
wordt het model van het domein `omnium` een project ín het modelregister. Zelfde
beweging. Het verschil: bij OMG is het bewijs formeel (OCL, XMI-roundtrip); bij
ons is het "werkt in de tool". Als we één ding formeel willen maken, dan de
EMOF-projectie van §4 — die is klein, controleerbaar en levert XMI gratis op.
