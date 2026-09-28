# FormulierDefinities — naslag

Naslag voor het maken van formulieren op het register: de **FormulierDefinitie** (configuratiedomein),
de **layout** (`layout_json`), de **widgets**, en de twee manieren waarop een formulier gebruikt
wordt: een bestaand record bewerken, of een nieuw record opvoeren (ook anoniem, via het openbare
aanmeldformulier). Tegenhanger van `PUBLICATIE_TEMPLATES.md` (de WeergaveDefinitie).

In MVC-termen: de **FormulierDefinitie is de control** op het model — hoe je gegevens invoert.
De selectie (welke rijen) is een QueryDefinitie, de weergave een WeergaveDefinitie. Een widget
verandert de editor, nooit de data.

Achtergrond en ontwerpkeuzes: `docs/plans/2026-09-22 Aanmeldformulier CG PF als formulierdefinitie (analyse).md`
(§5 widgets, §9–11 wat gebouwd is).

## 1. De FormulierDefinitie

| GE | Velden | Betekenis |
|---|---|---|
| `Meta` | `naam`, `code`, `beschrijving`, `doeltype`, `status`, `is_standaard` | `code` = leesbare sleutel, zie §1.1. `doeltype` = de entiteit (bv. `Initiatief`); alleen `status = actief` telt. `is_standaard` = het formulier dat de bewerk-pagina van dat doeltype gebruikt. De `beschrijving` staat boven het openbare formulier, dus schrijf hem voor de invuller. |
| `Layout` | `layout_json`, `definitie_versie` | de boom van elementen, zie §2 |

**Let op:** `Meta` en `Layout` zijn (nog) *meervoudig* in het configuratiemodel. Wie een nieuwe
layout opvoert, moet de oude layout-hub afvoeren; anders zijn er twee actief (de frontend neemt
dan de laatst opgevoerde). Zie replay 17 en 19 voor het patroon (`afvoer layout {formulierdefinitie_id, rel_id}` + `opvoer layout`).

### 1.1 `code`: een leesbare sleutel in plaats van het id

Het id van een FD verschilt per instantie: "Nieuwe organisatie" is FD 3 op pf, maar lokaal iets
anders. Wie een formulier aanwijst met een id (in een layout, een link of een `.env`) wijst dus
per instantie iets anders aan. Daarom heeft `Meta` sinds 27-09-2026 een optioneel veld **`code`**,
bv. `nieuwe-organisatie`, `aanmelding-initiatief`, `voorbeeld-vormen-2`. Die code is op elke
instantie gelijk.

Overal waar een FD wordt aangewezen mag **het id óf de code** staan:

| Waar | Voorbeeld |
|---|---|
| `veld.nieuwFormulier` in een layout | `"nieuwFormulier": "nieuwe-organisatie"` |
| URL's | `inhoud.html#/t/initiatieven/nieuw?formulier=aanmelding-initiatief-vormen`, `aanmelden.html?formulier=aanmelding-initiatief` |
| Openbaar indienen | `POST /aanmelding/aanmelding-initiatief`, `OPENBARE_FORMULIEREN=aanmelding-initiatief,nieuwe-organisatie` |

De regels:
- Een waarde van **alleen cijfers is een id**, al het andere een code. Een code bestaat daarom
  uit kleine letters, cijfers en koppeltekens en is nooit alleen cijfers. De formuliereditor
  controleert dat.
- Een code hoort **uniek** te zijn per soort definitie. Dat wordt (nog) niet afgedwongen; bij een
  dubbele code wint in de backend de laatst opgevoerde.
- De keuzelijsten (*Invoer via*, *Bewerken via*) zetten de code in de URL als die er is, anders
  het id. Oude links met een id blijven dus werken.
- Code: frontend `shared/definitieSleutel.js` (`vindDefinitie`, `sleutelVan`, `isGeldigeCode`),
  backend `zoekFormulierDefinitie` in `handlers/aanmelding_handler.go`.
- Een bestaande instantie krijgt de codes met `scripts/geef_definities_code.py`, dat een replay
  schrijft met een nieuwe meta-versie per definitie (op naam) en `nieuwFormulier`-id's omzet
  naar codes. Nieuwe instanties krijgen de codes via de init-replays.
- De kolom komt in een bestaande database vanzelf. Bij het opstarten voegt de API elke kolom toe
  die wel in het model staat maar nog niet in de tabel (`ensureNieuweKolommen` in
  `dbsetup/createmodeltables.go`). Alleen PK- en `notnull`-kolommen slaat hij over.

Maken en bewerken: in de Studio (formuliereditor / formulierprofiel op de diagram-motor), in de
inhoud-editor als gewone configuratie-entiteit, of als replay (`replay files/registraties-replay-init-formulierdefinitie-*.json`).

## 2. De layout (`layout_json`)

Een boom van elementen. Code: renderer `web/vite/src/components/editor/CustomFormulierRenderer.jsx`,
editor-model `web/vite/src/formuliereditor/layoutModel.js`, profiel `web/vite/src/diagramprofielen/formulier/`.

### 2.1 Elementen

| `type` | Eigenschappen | Betekenis |
|---|---|---|
| `formulier` | `elementen[]` | de wortel |
| `groep` | `label`, `context`, `elementen[]` | sectie met kop. Een groep zonder zichtbare inhoud wordt niet getoond. |
| `rij` | `richting`, `elementen[]` | velden naast elkaar; geef velden een `breedte` (`50%`, `33%`, …) |
| `veld` | zie §2.2 | één invoerveld |
| `conditioneel` | `conditie {veld, op, waarde}`, `dan[]` | toon de inhoud alleen als de conditie waar is. `op`: `nietleeg`, `leeg`, `==`, `!=`. (Oudere vorm: `als: "veld == 'x'"`.) |
| `lijst` | zie §2.3 | herhaalbare sectie voor een **meervoudig** GE of een relatie |

### 2.2 Veld

| Eigenschap | Betekenis |
|---|---|
| `veld` | **veldpad** `ENT.rol.veld`, bv. `Initiatief.producten.naam` (rol = JSON-rolnaam). Binnen een `lijst` relatief: alleen de veldnaam (`schaal`). |
| `label` | eigen label; leeg = de veldnaam uit het model. Vraagnummers horen hier (`"1. Naam van het initiatief"`). |
| `beschrijving` | helptekst onder het label |
| `uitleg`, `uitlegTekst`, `vormUitleg` | het (i)-rondje naast het label: een code uit de uitleglijst, een eigen tekst, en of de bediening van de vorm meekomt (§2.5). Ook op `groep` en `lijst`. |
| `breedte` | `50%`, `33%`, `25%`, `100%` (binnen een `rij`) |
| `widget` | zie §3; leeg = afgeleid uit het model |
| `readonly` | alleen lezen |
| `vasteWaarde` | het veld wordt **niet getoond**; de waarde gaat vast mee bij opvoeren. Binnen een lijst is het óók het **filter** van die lijst (§2.3). Voorbeeld: `Initiatief.aanmeldstatussen.status` = `nieuwe_aanmelding`. |
| `kopieerNaar` | één invoer, twee doelen: de waarde gaat ook naar dit volle pad. Voorbeeld: `Initiatief.planningen.startdatum` → `Initiatief.aanvang.datum` (de materiële aanvang). |
| `validatie` | eigen validatie van het veld, **aanvullend** op die van het datatype (§2.4): `{ pattern, minLength, maxLength, minimum, maximum, foutmelding, regels }`. Voor een bron zonder datatype, of om strenger te zijn dan het model; opheffen kan niet. |
| `nieuwFormulier` | alleen op de secundaire id van een **relatie naar een gewone entiteit** (bv. `organisatie_id`): de code of het id van een FormulierDefinitie waarmee de invuller een **nieuwe** doelentiteit aanmaakt, ingebed in dit formulier (§5). |

### 2.3 Lijst

| Eigenschap | Betekenis |
|---|---|
| `bron` | het meervoudige GE of de relatie, `ENT.rol` (bv. `Initiatief.bijdragen`, `Initiatief.initiatief_gemeenten`) |
| `label`, `beschrijving` | kop en helptekst |
| `elementen[]` | het sjabloon van één rij; velden relatief aan de bron |
| `min`, `max` | aantal rijen. `min` rijen worden altijd getoond; bij `max` verdwijnt *toevoegen*, bij `min` het verwijderkruisje. |
| `widget` | leeg = rijen; `meerkeuze` = zie §3 |

**Vaste waarde als filter.** Meerdere lijsten mogen dezelfde `bron` hebben. Elke lijst toont dan
alleen de rijen die bij haar vaste waarden passen, en voert nieuwe rijen op mét die waarden. Zo
worden:

- **vaste rijen**: drie lijsten op `Initiatief.bijdragen`, elk met `type_bijdrage` als vasteWaarde
  (*Wendbaarheid*, *Dienstverlening*, *Regie*) en `min = max = 1`;
- **dezelfde relatie per rol**: twee lijsten op `Initiatief.initiatief_gemeenten`, met `rol` =
  *Realiseert* resp. *Maakt gebruik van*.

Dit is dezelfde predicaattaal als het GraphQL-filter (`initiatief_gemeenten: { rol: { eq: "Realiseert" } }`).
Een rij waarin buiten de vaste waarden niets is ingevuld, wordt niet opgevoerd.

### 2.4 Validatie komt uit het datatype

Een veld wordt tijdens het invullen gecontroleerd volgens zijn **datatype** in het model: patroon,
lengte, normalisatie en regels (`checksum`, `formula`, `function`). Een BSN-veld doet dus de
11-proef, een IBAN-veld de mod-97-controle. Dat geldt overal: in inhoud, in een formulier en op
aanmelden. De server controleert hetzelfde (`model/validation.go`, `model/regels_eval.go`).

- **Code:** `shared/datatypeValidatie.js` roept de bestaande bibliotheek `umleditor/validatie`
  aan, die ook het paneel *Test invoer* van de metamodel-editor gebruikt. De datatypes komen van
  `/api/viz/schema/datatypes`; de koppeling zit in `validatieMeldingVoorVeld`.
- **Foutmelding:** de `foutmelding` van het datatype als die er is, anders de eerste fout.
- **Een `function` die de browser niet kent** keurt niets af: de server beslist.
- **Gedeelde testset:** `testdata/validatie/vectoren.json`. Go
  (`model/validatie_vectoren_test.go`) en JS (`shared/validatieVectoren.test.js`) halen dezelfde
  gevallen. Elk voorbeeld (`validatie.voorbeelden`) in het model telt als geldig geval.
  `testdata/validatie/datatypes.json` is een momentopname van de datatypes voor de JS-test;
  bijwerken met `UPDATE_GOLDEN=1 go test ./model -run TestValidatieDatatypesMomentopname`.
- **Normaliseren op de server** (sinds 27-09). De normalisatie van het datatype (bv.
  `uppercase_letters` bij NLPostcode) gebeurt ook op de server, vóór het controleren. De waarde
  wordt dan zo **opgeslagen**: `1234 ab` → `1234 AB` (`model/normalisatie.go`,
  `NormaliseerRepresentatie`). De browser toont de genormaliseerde vorm zodra je het veld verlaat.
  De testset bevat ook normalisatiegevallen.
- **Validatie-API.** `POST /api/valideer` normaliseert en controleert een waarde (of tot 200
  tegelijk) volgens een datatype, zonder te registreren. Dat is een vangnet voor clients die een
  regel niet zelf kunnen uitvoeren; zie `API_REFERENCE.md`.
- **Uniekheid.** Een veld kan in het model `uniek` zijn: `entiteit`, `domein` of `register`,
  gecontroleerd tegen de actuele stand. De `code` van formulier-, weergave- en lijstdefinities is
  uniek binnen de entiteit. Een botsing geeft een 422 met code `uniek`.

### 2.5 Uitleg bij een vraag: het (i)-rondje (sinds 28-09)

Naast het label van een vraag kan een **(i)** staan. Een klik (of Tab en Enter) toont de uitleg
eronder, en nog een klik (of Escape) sluit hem. De `beschrijving` is kort en altijd zichtbaar; de
uitleg is langer en verschijnt alleen op verzoek.

**Drie soorten uitleg, van drie eigenaren:**

| Soort | Waar | Voorbeeld |
|---|---|---|
| **Inhoud, herbruikbaar** | de **uitleglijst**: entiteit `Uitleg` (configuratiedomein). Het veld verwijst ernaar met `"uitleg": "<code>"`. | *Postcode: vier cijfers en twee letters.* Op elk formulier met een adres. |
| **Inhoud, alleen hier** | `"uitlegTekst": "…"` op het veld zelf. Gaat vóór de code. | *Alleen gemeenten die zelf meebouwen of meebetalen.* |
| **Bediening van de vorm** | ook de **uitleglijst**, als uitleg van **soort `vorm`** met code `vorm-<naam>` (bv. `vorm-nl-map`). Komt vanzelf mee bij elke vraag met die vorm; uitzetten met `"vormUitleg": false`. Ontbreekt hij in de lijst, dan de standaardtekst uit het vormenregister (`VORMEN[vorm].bediening`). | *Klik op een stip; pijltjes en spatie werken ook.* |

**De uitleglijst** (`/full/uitleggen`):
- **Meta:** `code` (uniek binnen de entiteit), `soort` (`inhoud` of `vorm`; leeg = inhoud), een
  interne `naam`, `beschrijving` en `status`. Alleen `actief` telt.
- **Soort `vorm`:** zo is ook de bediening content. Je kunt hem vertalen en aanpassen zonder de
  code te wijzigen, en hij heeft historie. De lijst wordt opgehaald zodra de layout een `uitleg`
  of een `vorm` bevat. Een vorm die alleen uit het datatype volgt (bv. `masked`) krijgt de
  standaardtekst.
- **Tekst**, één per taal: `taal` (nl, en, de, fr, fy), `titel` en `tekst`.

**Het adres is code + taal.**
- **Welke taal:** die van de pagina (`<html lang>`). Anders Nederlands, anders de eerste die er is.
- **Tekst:** eenvoudige markdown (vet, cursief, links, opsomming), veilig weergegeven
  (`publicatie/markdown.js`).
- **Schrijf voor de invuller (B1).**

**Waarom een losse lijst, en niet de beschrijving uit het model?** De beschrijving van een
attribuut in het model is de onderste laag (data), en vaak technisch. De uitleg is de vertaling
daarvan voor de invuller (inhoud). De lijst is herbruikbaar (hetzelfde adres op tien formulieren),
vertaalbaar, en **bitemporeel**: je ziet welke uitleg er stond toen iemand het formulier invulde.

**Een tekst wijzigen:** `Tekst` is meervoudig. Voer de oude tekst-rij af en een nieuwe op, in één
registratie. De oude versie blijft in de historie staan. Een `rel_id` op het opvoeren maakt bij
een meervoudig GE géén nieuwe versie van dezelfde rij, maar een extra rij (getest 28-09).

**Toegankelijk:** een echte knop met `aria-expanded` en `aria-controls`, met een label *Uitleg
bij <vraag>*. Het paneel staat in de gewone leesvolgorde. Het werkt op mobiel en in de iframe,
dus het is geen tooltip die alleen bij aanwijzen verschijnt.

**Beheren:**
- **In de formuliereditor:** een code (met suggesties uit de lijst en een waarschuwing bij een
  onbekende code), een eigen tekst, en het vinkje *Bediening van de vorm tonen*.
- **De lijst zelf:** in de inhoud-editor onder *configuratie → Uitleg*.

**Code:**
- `shared/uitleg.js` (puur, getest);
- `hooks/useUitleggen.js` (haalt de lijst één keer per pagina op, en alleen als de layout ernaar
  verwijst);
- `components/editor/Uitleg.jsx`;
- `CustomFormulierRenderer` (legendes van groep en lijst) en `SchemaFormField` (velden).

**Model:** `docs/Model files (V3)/configuratie 2026-09-28 Uitleg — v3-model.json`.

**Proberen:**
1. Speel de replay `registraties-replay-init-uitleg-en-voorbeeldformulier-2026-09-28.json` af:
   zes van soort inhoud en dertien van soort vorm (eerst gelijk aan het register; `vorm-nl-map`
   en twee inhoud-uitleggen ook in het Engels), plus het formulier `voorbeeld-uitleg`.
2. Open `inhoud.html#/t/initiatieven/nieuw?formulier=voorbeeld-uitleg`.

## 3. Widgets

Zonder `widget` kiest de renderer op basis van het model (`web/vite/src/components/editor/SchemaFormField.jsx`):

| Veld in het model | Standaardwidget |
|---|---|
| tekst / getal / datum | invoerveld (datum: datumkiezer); prefix/suffix uit het datatype (bv. €) |
| `LangeTekst`-datatype | tekstvak |
| enum | keuzelijst |
| enum met datatype `EnumLijst` (bv. `CG_laag`: `"Laag 1;Laag 2"`) | vinkjes: meer uit een lijst, opgeslagen in één veld (ook `image-map`, `button-group`) |
| boolean | radio *Ja / Nee / (leeg)* |
| verwijzing naar een **referentielijst-item** (Gemeente, Domein, ApiStandaard) | zoekende combobox, server-side (`RefCombobox`) |
| secundaire id van een relatie naar een **gewone entiteit** (Organisatie) | zoekende combobox over de bestaande records (`EntiteitCombobox`), met *＋ Nieuwe …* als `nieuwFormulier` gezet is |

Expliciet te kiezen op een **veld**:

| `widget` | Effect |
|---|---|
| `radio` | enum als radiogroep (schaal 1–4, producttype) |
| `textarea` | meerregelig tekstvak |
| `json`, `markdown` | code-editor met syntaxkleuring (voor configuratievelden) |

Op een **lijst**:

| `widget` | Sjabloonveld | Effect |
|---|---|---|
| *(leeg)* | willekeurig | een blok per rij, met *toevoegen* en ✕ |
| `meerkeuze` | één **enum**-veld | een checkbox per optie; elk vinkje is een rij |
| `meerkeuze` | één **referentielijst**-veld | chips met een zoekveld (`RefMeerkeuze`): typen, kiezen, ✕ haalt weg |

Bij `meerkeuze` telt het eerste sjabloonveld zonder vasteWaarde als het keuzeveld; vaste waarden
van de lijst gaan mee in elke rij (bv. `rol` = *Realiseert* + chips van gemeenten).

### 3.1 Vorm (opvolger van `widget`)

`widget` wordt **`vorm`** (+ `vormConfig`): de scheiding tussen de *inhoud* (invoersoort: één/meer
uit een lijst, tekst, …, volgt uit het model) en de *vorm* (hoe het eruitziet). Vormnamen zijn een
met Imprint gedeelde woordenlijst: `radio-group`, `text-area`, `checkbox-group`, `combobox`, en
nieuw `image-map` (klikbare gebieden op een afbeelding, op een veld én op een lijst) en
`rating-grid` (matrix: per rij één keuze uit dezelfde schaal, op een lijst) en `button-group`
(knoppenvlak, één of meer uit een lijst, met sorteerwissel).

Sinds 27-09 een bibliotheek van 22 vormen, elk met een configSchema:
- keuzekaarten, kaart van NL, schakelaar, schuif, draaiknop, stappenbalk;
- sorteren in manden;
- op een **groep**: `period` en `address-search`;
- alleen weergave: `scale-bars`, `chips`.

Bekijk ze op `vormen.html`. In de Studio kies je de vorm in de inspector (gefilterd op wat bij
het veld past), met de vormConfig als JSON die tegen het schema wordt gecontroleerd. Details:
ontwerp §7e. De oude
`widget`-waarden blijven als alias werken. Zie `docs/plans/2026-09-26 Invoersoort en vorm (ontwerp).md`.

## 4. Gebruik: bewerken en nieuw

| | Bewerken | Nieuw (ingelogd) | Nieuw (openbaar) |
|---|---|---|---|
| Waar | `inhoud.html#/t/<padnaam>/<id>` — de FD met `is_standaard`, of een andere actieve FD via `?formulier=<id of code>` (keuzelijst *Bewerken via*) | `inhoud.html#/t/<padnaam>/nieuw?formulier=<id of code>` (keuzelijst *Invoer via*) | `aanmelden.html?formulier=<id of code>` |
| Code | `EntiteitFormulier` + `customFormMapping.bouwCustomWijzigingen` | `NieuwFormulierPagina` + `nieuwFormulierMapping.bouwNieuwWijzigingen` | idem, `openbaar`-modus |
| Registratie | `POST /registratie/` met de gewijzigde GE's | `POST /registratie/`, één registratie: entiteit, aanvang, GE's, een opvoer per lijstrij | `POST /aanmelding/<id of code>` |
| Id | bestaand | plaatshouder `$nieuw.<entiteit>`; de server kent het id toe (`toegekendeIds`) | idem |
| Verplicht | direct gemeld | pas na aanraken of na een klik op *Verzenden* | idem |

**Openbaar indienen** (`handlers/aanmelding_handler.go`, `API_REFERENCE.md` §8) werkt alleen voor
FD's waarvan het id of de code in de omgevingsvariabele `OPENBARE_FORMULIEREN` staat: een formulier openbaar maken is een
besluit van de beheerder van de instantie, geen FD-instelling. De server dwingt af: alleen opvoeren,
alleen op plaatshouder-id's (nooit schrijven op bestaande records), alleen het doeltype en de
doeltypen van subformulieren, de `vasteWaarde`s uit de layout (een gemanipuleerde status wordt
overschreven), bron `aanmeldformulier`, rate-limit per IP. In een iframe (of met `&embed=1`)
verdwijnt de kop.

## 4a. LijstDefinitie: het overzicht vóór het formulier

Een FormulierDefinitie is het detail. Een **LijstDefinitie** (configuratiedomein, sinds 27-09)
is het overzicht in de inhoud-editor: welke kolommen, welke sortering, en met welk formulier een
rij opent. Zonder lijstdefinitie blijft het overzicht automatisch: ID, het weergaveveld per GE,
en aanvang/einde.

| GE | Velden | Betekenis |
|---|---|---|
| `Meta` | `naam`, `code`, `beschrijving`, `doeltype`, `status`, `is_standaard` | zoals bij de FormulierDefinitie; de actieve standaard wordt het overzicht van dat doeltype |
| `Lijstconfig` (enkelvoudig) | `lijst_config_json`, `formulier`, `formulier_kiesbaar`, `definitie_versie` | zie hieronder |

- **`lijst_config_json`** heeft hetzelfde formaat als de tabelconfig van een WeergaveDefinitie:
  `{ kolommen: [{ veldpad, label, breedte, sorteerbaar, filterbaar }], standaardSortering: { veld, richting }, rijenPerPagina }`.
  De veldpaden worden ook op dezelfde manier opgelost (`publicatie/publicatieData.js`
  `resolveVeldpad`).
- **`formulier`** is de code (of het id) van de FormulierDefinitie waarmee een rij opent, via
  `?formulier=`. Leeg betekent de standaard van het doeltype.
- **`formulier_kiesbaar`** (boolean) bepaalt of de gebruiker daarna via *Bewerken via* een ander
  actief formulier mag kiezen. Het formulier hierboven is dan alleen de standaardkeuze. Staat hij
  uit, dan verdwijnt de keuzelijst.
- **In de inhoud-editor** staat boven het overzicht een keuzelijst *Lijst*:
  - `?lijst=<code of id>` kiest een lijst;
  - `?lijst=automatisch` geeft het automatische overzicht;
  - een rij opent met `?formulier=<code>&lijst=<code>`.
- **Code:** `hooks/useLijstDefinitie.js`, `shared/lijstDefinities.js` (puur, getest),
  `RepresentatieTabel.jsx`, `EntiteitFormulier.jsx`.
- **Voorbeelden** in `replay files/registraties-replay-init-lijstdefinities-2026-09-27.json`:
  - Formulierdefinities, Weergavedefinities en Lijstdefinities: naam, code, doeltype, status en
    standaard, zonder de JSON;
  - Organisaties: opent met `nieuwe-organisatie`.
- **Model:** `docs/Model files (V3)/configuratie 2026-09-27 LijstDefinitie — v3-model.json`. De
  Studio haalt hem op via de API.
- **Later:** een WeergaveDefinitie kan naar een LijstDefinitie verwijzen in plaats van een eigen
  tabelconfig te hebben; het formaat is al gelijk.
- **Nog niet:** *+ Nieuw* vanuit een lijst gebruikt het formulier van de lijst nog niet.

## 5. Nieuwe doelentiteit vanuit een relatie (`nieuwFormulier`)

Op de secundaire id van een relatie naar een gewone entiteit, bv. `organisatie_id` in
`Initiatief.initiatief_organisaties`. De combobox toont onderaan *＋ Nieuwe organisatie "zoekterm"*.
Kiest de invuller die, dan verschijnt de sub-FD ingebed (de zoekterm is dan al de naam), en voert
de registratie de nieuwe organisatie met een plaatshouder-id vóór de relatie op
(`registration_plaatshouders.go`).

`nieuwFormulier` is de code (aanbevolen, bv. `"nieuwe-organisatie"`) of het id van de sub-FD, zie §1.1.

Regels:
- **Maak-diepte 1**: in een ingebed formulier kan de invuller relaties kiezen, maar niet zelf weer
  een nieuwe entiteit aanmaken.
- Alleen voor gewone entiteiten; referentielijst-items zijn beheerde lijsten en niet aanvulbaar.
- De sub-FD moet actief zijn en het juiste doeltype hebben; bij openbaar indienen worden alleen
  de doeltypen van zulke sub-FD's toegelaten.

## 6. Voorbeeld

Uit FD 2 *Aanmelding initiatief* (replay 16, 17, 19):

```json
{ "type": "formulier", "elementen": [
  { "type": "groep", "label": "Product", "elementen": [
    { "type": "veld", "veld": "Initiatief.producten.naam", "label": "1. Naam van het initiatief" },
    { "type": "veld", "veld": "Initiatief.producten.type", "widget": "radio", "label": "2. Type product" },
    { "type": "conditioneel", "conditie": { "veld": "Initiatief.producten.type", "op": "==", "waarde": "Toepassing" },
      "dan": [ { "type": "veld", "veld": "Initiatief.producten.pitch", "widget": "textarea", "label": "5. Pitch" } ] }
  ]},
  { "type": "lijst", "bron": "Initiatief.initiatief_gemeenten", "label": "8. Gemeenten die realiseren", "widget": "meerkeuze",
    "elementen": [ { "type": "veld", "veld": "rol", "vasteWaarde": "Realiseert" }, { "type": "veld", "veld": "gemeente_id" } ] },
  { "type": "lijst", "bron": "Initiatief.initiatief_organisaties", "label": "13. Contactorganisatie", "min": 1, "max": 1,
    "elementen": [ { "type": "veld", "veld": "rol", "vasteWaarde": "Contactorganisatie" },
                   { "type": "veld", "veld": "organisatie_id", "nieuwFormulier": "3" } ] },
  { "type": "lijst", "bron": "Initiatief.bijdragen", "label": "Regie", "min": 1, "max": 1,
    "elementen": [ { "type": "veld", "veld": "type_bijdrage", "vasteWaarde": "Regie" },
                   { "type": "veld", "veld": "schaal", "widget": "radio" },
                   { "type": "veld", "veld": "toelichting", "widget": "textarea" } ] },
  { "type": "groep", "label": "Aanmelding", "elementen": [
    { "type": "veld", "veld": "Initiatief.planningen.startdatum", "kopieerNaar": "Initiatief.aanvang.datum" },
    { "type": "veld", "veld": "Initiatief.aanmeldstatussen.status", "vasteWaarde": "nieuwe_aanmelding" }
  ]}
]}
```

## 7. Beperkingen (backlog)

- `min` op een lijst stuurt de weergave, maar dwingt niets af: een lege verplichte vaste rij wordt
  overgeslagen (B34).
- `EntiteitCombobox` laadt alle records van de doelentiteit (tot 2000); voor grote entiteiten is
  een zoekendpoint nodig (B36). Met `LEESTOEGANG=documenten` is die lijst anoniem dicht: vóór de
  leespoort dichtgaat is een publieke lookup nodig (plan §11).
- `Meta`/`Layout` meervoudig in plaats van enkelvoudig (zie §1).

## 8. Tests

`cd web/vite && npm test` — o.a. `nieuwFormulierMapping.test.js` (vaste waarden, vaste rijen,
lijsten per rol, `$nieuw`-subentiteiten), `customFormMapping.test.js` (relaties met secundaire id),
`diagramprofielen/formulier/adapter.test.js` (round-trip van alle layout-eigenschappen).
Backend: `go test ./handlers/ -run 'Aanmelding|Plaatshouder'`.
