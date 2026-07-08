# Verkenning — MIM 1.2 als diagramprofiel op de Studio 0.5-motor

- **Datum:** 2026-07-06
- **Auteur:** Claude (Claude Code, Fable 5), op verzoek van Mark
- **Status:** verkenning + eerste werkend profiel (`diagramprofielen/mim12/`,
  activiteit "MIM (0.5)")
- **Bronnen:**
  - [MIM 1.2-specificatie (definitief, 2024-06-13)](https://docs.geostandaarden.nl/mim/def-st-mim-20240613/)
  - [MIM-landingspagina](https://docs.geostandaarden.nl/mim/mim/) · [Geonovum/MIM op GitHub](https://github.com/Geonovum/MIM)
  - [Geonovum: Metamodel Informatiemodellering](https://www.geonovum.nl/geo-standaarden/metamodel-informatiemodellering-mim)

## 1. Waarom dit ertoe doet

MIM (Metamodel voor Informatie Modellering, beheer: Geonovum) standaardiseert
hóe overheden informatiemodellen opstellen, en heeft de
**"pas toe of leg uit"-status** (Forum Standaardisatie): overheden passen het
toe of leggen uit waarom niet. Een MIM-profiel op de 0.5-motor betekent dat
Omnium Studio MIM-conforme informatiemodellen kan tekenen, tonen en (later)
uitwisselen — voor Marks domein een directe aansluiting op de verplichte
standaard.

## 2. De verrassing: MIM en ons metamodel rijmen

MIM beschrijft metaclasses + metagegevens; onze motor beschrijft
ElementTypes + PropertyTypes. De kernstructuur valt vrijwel 1-op-1 samen:

| MIM 1.2 | Studio 0.5-motor | Opmerking |
|---|---|---|
| Objecttype | ElementType (class-box) | compartiment "attribuutsoorten" |
| Attribuutsoort | Field (FieldType `attribuutsoort`) | metagegevens = PropertyTypes op het veld |
| Gegevensgroep → Gegevensgroeptype | `gegevensgroep`-connector (◆) naar een eigen ElementType | zelfde patroon als canoniek ENT ◆ GE; doet mee in de boom-hiërarchie |
| Relatiesoort | connector-ElementType | rollen/kardinaliteiten als connector-data + edgeLabels-hook |
| **Relatieklasse** | connector **mét velden** | onze ASOC-materialisatie (anker + box) — gratis |
| Relatierol bron/doel | data op de connector (naam + kardinaliteit per zijde) | "relatierol leidend" vs "relatiesoort leidend" = instelling, zie §4 |
| Generalisatie | connector met ▷ | ook tussen datatypen toegestaan |
| Externe koppeling | dashed connector naar element in een Extern-package | |
| Enumeratie / Enumeratiewaarde | ElementType + waarden-compartiment | identiek aan bestaande profielen |
| Referentielijst / Referentie-element | idem | metagegeven `locatie` als property |
| Codelijst | ElementType met `waardenverzameling` (URI) | waarden extern beheerd |
| Primitief datatype | ElementType met patroon/lengte-properties | zelfde familie als canoniek `gegevenstype` |
| Gestructureerd datatype / Data-element | ElementType + data-element-compartiment | |
| Keuze (5 varianten) | ElementType `keuze` + `alternatief`-connector | v1 dekt de datatype-variant; zie §4 |
| Constraint | ElementType `constraint` | bestond al als patroon (canoniek) |
| Informatiemodel / Domein / Extern / View (packages) | `package`-ElementType met `soort`-property, `containerVoor: "bevat"` | vorige week gebouwd; boom, drag & drop en standaard-dicht doen automatisch mee |
| Metagegevens (naam, definitie, herkomst, …) | PropertyTypes | gedeelde basisset, per metaclass aangevuld |
| Indicatie materiële/formele historie | boolean-properties | sluit direct aan op het bitemporele domein van dit project |

## 3. Wat er nu al staat (profiel v1, "MIM-kern")

`diagramprofielen/mim12/` + activiteit **"MIM (0.5)"**:

- **Objecttype** met attribuutsoorten (naam, type, kardinaliteit, definitie,
  authentiek, indicatie materiële/formele historie, mogelijk geen waarde,
  identificerend, afleidbaar) en de MIM-basismetagegevens op het type
  (alias, begrip, definitie, toelichting, herkomst, herkomst definitie,
  datum opname, populatie, kwaliteit, indicatie abstract object).
- **Gegevensgroeptype** (zelfde veldenstructuur) + **gegevensgroep**-connector
  (◆) — nest in de elementen-boom.
- **Relatiesoort** met rolnamen/kardinaliteiten per zijde, unidirectioneel-
  vinkje en historie-indicaties; velden erop = relatieklasse (ASOC).
- **Generalisatie** (objecttypen én datatypen), **Externe koppeling**.
- **Waardelijsten**: enumeratie (+waarden), referentielijst (+elementen,
  locatie), codelijst (waardenverzameling-URI).
- **Datatypen**: primitief (patroon, formeel patroon, lengte),
  gestructureerd (+data-elementen).
- **Keuze** (datatype-variant) met `alternatief`-connectoren.
- **Constraint**, **notitie**, **kader**.
- **Package** met soort (informatiemodel/domein/extern/view), drop-doel
  (`containerVoor`), standaard dicht in de boom.
- Type-verwijzingen (attribuutsoort-type) via ReferenceResolvers: de
  MIM-primitieven (CharacterString, Integer, Real, Boolean, Date, DateTime,
  Year, Month, Day, URI) plus alle in het model getekende datatypen,
  enumeraties, codelijsten en referentielijsten.
- Hiërarchie in de boom: `["bevat", "gegevensgroep"]`.

Omdat het een gewoon geregistreerd profiel is, doet álles automatisch mee:
elementen-boom met packages, rechtsklik-menu's, knikken/boomstijl-lijnen,
export/import van 0.5-werkbestanden, en de profiel-ontwerper (het MIM-profiel
is daar te bekijken, aan te passen en opnieuw te activeren).

## 4. Wat aandacht vraagt (fase 2+)

1. **Keuze-varianten 2–5** (tussen attribuutsoorten, tussen invullingen van
   één attribuutsoort, tussen relatiedoelen, tussen relatiesoorten): vraagt
   keuze-constructies ín compartimenten resp. op connector-bundels. V1 dekt
   de meest gebruikte variant (keuze tussen datatypen) via het
   `keuze`-element; de rest is modelleerbaar maar nog niet gevalideerd.
2. **Relatiesoort leidend vs relatierol leidend** (instelling op het
   Informatiemodel): v1 legt beide vast als data op de connector; een echte
   schakelaar (welke metagegevens verplicht zijn waar) hoort bij een
   MIM-validator (vgl. de geplande profiel-validators).
3. **Views en Extern**: v1 behandelt ze als package-soorten zonder aparte
   semantiek (een View kopieert formeel elementen uit andere packages).
4. **Metagegevens-volledigheid**: MIM schrijft per metaclass een precieze
   verplicht/optioneel-set voor. V1 heeft de belangrijkste; de rest is
   declaratief bij te vullen (alleen PropertyTypes toevoegen).
5. **Uitwisseling — eerste versie gebouwd** (`mim12/adapter.js`):
   *Importeer MIM XMI/XML…* leest een XMI-export met het MIM-UML-profiel
   (de gangbare EA-vorm): packages/classes/enumeraties/datatypen met
   stereotypes uit de xmi:Extension, attributen met kardinaliteit en
   type-verwijzing, associaties met rollen per zijde, generalisaties en
   package-nesting. Nog niet: tagged values (de metagegevens-teksten),
   Linked Data, en export terug naar XMI. Bij echte exports (IMGeo, IMBOR)
   zullen tool-varianten opduiken — bijstellen op een echt bestand is de
   volgende stap.
6. **Transformatie canoniek → MIM — gebouwd**: ⟳ herlaad in "MIM (0.5)"
   voert *Zet canoniek model om naar MIM…* uit: de keten `vanCanoniekModel`
   → `vanCanoniekCoreNaarMim`. Entiteit→objecttype (velden→attribuutsoorten
   met kardinaliteit uit verplicht), gegevenselement→gegevensgroeptype met
   ◆-gegevensgroep, relatie→relatiesoort (rollen uit de naam-labels,
   materieel→indicatie materiële historie), enum/gegevenstype/referentie-
   lijst→waardelijsten en datatypen, domein-packages onder een gegenereerde
   informatiemodel-wortel — en de diagram-layouts blijven staan. De
   terugweg (MIM → canoniek) is de volgende stap; samen vormen ze de
   PTOLU-brug.

## 5. Advies

MIM 1.2 is groot maar níet vreemd: het is precies het soort metamodel waar
de motor voor gebouwd is. De kern staat nu als werkend profiel; het
zwaartepunt van het vervolg ligt niet bij het tekenen maar bij **validatie**
(verplichte metagegevens, keuze-regels) en **uitwisseling** (import van
bestaande MIM-modellen). Voorstel: v1 in de praktijk proberen op een echt
informatiemodel, en daarna fase 2 (validator) en fase 3 (import) plannen.
