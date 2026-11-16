# Referentielijst-instanties: richting, binding en domein (plan, 2026-11-07)

Aanleiding: bij het indelen van het model in domeinen (lagen) bleek dat het
domein `register` aan `np-loc` hangt via `AdellijkeTitelsTitel → AdellijkeTitel`
(CODEGEN §12). Mark (07-11): de ENT `Referentielijst` hoort qua afhankelijkheid
helemaal bovenaan, in een eigen domein, terwijl gegevenstypen onderaan staan.
Analyse van de docs (`Referentielijsten.md` §2, §12, §14, §98; het plan van
29-03-2026; CODEGEN §8 en §12) en de code gaf drie bevindingen, en Mark heeft
de richting op 07-11 bevestigd. Dit plan legt die vast. Uitvoering na de demo
van 09-11, naast de rebuild uit het Studio-project.

Claude-sessie, gesprek met Mark; zie `docs/ai-chats/` voor de export.

## 1. Wat er al besloten was (en blijft)

- **Eén klasse, lijsten zijn records.** `Referentielijst` is één ENT met subtype
  `referentielijst`; Landenlijst en AdellijkeTitels zijn records in zijn tabel.
  De variant "per lijst een eigen struct en tabel" was de eerste implementatie
  (27-03-2026) en is op 29-03 verworpen: dat geeft per lijst een tabel met
  altijd één record (het record dat zegt dat de lijst bestaat). Overerving per
  lijst zou daar weer naar terugkeren. Dit blijft zo.
- **Het subtype geeft gedrag, geen structuur.** Eigen routes per instantie
  (`/referentielijsten/{systeemnaam}`, `/full/…`), de opties-handler voor de
  RefCombobox, item-typen als veldtype met een «use» naar de items-relatie,
  `is_materieel` als klasse-eigenschap.
- **De items-relatie is aan één instantie gebonden** (`referentielijstInstantie`
  op de REL). Dat is de bijzondere relatie uit het EA-metamodel: "relateert
  alle elementen van een type aan één instantie van Referentielijst".

## 2. Drie bevindingen

### 2.1 De items-relaties staan bij de verkeerde eigenaar

In het hub+_Data-patroon hoort een relatie bij zijn **bron**entiteit: de
primaire sleutel van `LandenlijstLand` is `referentielijst_id + rel_id`,
`land_id` is een gewone verwijzing. De REL is dus een kind van
`Referentielijst`, krijgt diens domein (`register`) en wijst van daaruit naar
`Land` of `AdellijkeTitel`. Daardoor hangt register aan elk domein met een
item-type: de pijl wijst omlaag.

Het bedoelde ontwerp (§98, CODEGEN §8) is andersom: register levert alleen de
klasse en zijn systeem-GE's; REL, item-type en instantie horen bij het domein
dat de lijst bezit, en dat domein meldt zijn REL aan bij `Referentielijst` via
`VoegOnderliggendGEToe`. Dat is een runtime-lijmpje (drie regels in
`metaregistry_plumbing.go`: zoek een geregistreerd type op en hang er één kind
bij) dat compenseert voor de verkeerde eigenaar. Bovendien vuurt het niet: de
codegen filtert op het domein van de eigenaar-ENT (`main.go`, domeinfilter) en
leest `V3Relatie.Domein` niet, dus een REL onder `Referentielijst` komt nooit
in een np-loc-run terecht.

### 2.2 De instantie bestaat op M1, maar niet op M0

| Laag | Wat er is |
|---|---|
| M1 (V3, Studio) | elementsoort `referentielijstInstantie` met uuid, systeemnaam, naam, omschrijving; naam uniek per domein; de REL draagt `referentielijstInstantie` (de gestippelde «use» in het diagram) |
| codegen | `ReferentielijstInstantieRegistry[systeemnaam]` met naam, omschrijving, layout; de systeemnaam als string op de TypeMeta van de REL |
| runtime (M0) | de string gaat alleen mee in de schema-API en de V3-export. `Referentielijst` heeft geen `systeemnaam`-veld meer, de opstart-sync is weggehaald (`createtables.go`: "instanties worden aangemaakt via de registratie-flow of replay-bestanden"). Niets koppelt `referentielijst_id` in `landenlijstland` aan het record "Landenlijst". De bindingsregel uit de beslissingen van 29-03 (D5/R4 in de BACKLOG) wordt niet afgedwongen. |

De instantie is nu een tekenafspraak met een naam. `V3ReferentielijstInstantie`
heeft ook geen veld `domein`, terwijl de Studio haar wel als domeingebonden
behandelt (`uniekeNamen.js`). Daarnaast legt het GE `ReferentielijstVisibility`
op M0 óók een `domein` vast op het record: twee plekken voor hetzelfde.

### 2.3 Referentielijst staat al bovenaan, maar om de verkeerde reden

`register` is verplicht in elke build (`bouw-domeinen.ps1`) en initialiseert
eerst. Na het omdraaien heeft het geen uitgaande afhankelijkheden meer: het
staat bovenaan omdat niets erboven zit, niet omdat het van alles afhangt. In
dependency-termen staat het daarmee op dezelfde plek als `gegevenstypen`: een
fundament waar anderen naar wijzen.

## 3. Besluit (Mark, 07-11-2026)

1. **Richting omdraaien.** De items-relatie loopt van het item-type naar de
   lijst: `Land → Referentielijst`, sleutel `land_id + rel_id`,
   `referentielijst_id` wijst omhoog naar het ene vaste record. De REL is een
   kind van het item-type en komt in diens domein.
2. **De instantie wordt echt.** Eén gemodelleerd record per lijst waar model en
   register het samen over eens zijn: vaste koppeling systeemnaam ↔ id,
   afgedwongen binding op de REL, `domein` op de instantie in V3.
3. **Meerdere lijsten per item-type moet kunnen.** Een wereld-landenlijst én
   een lijst EU-lidstaten over hetzelfde item-type `Land`. Dat worden twee
   RELs op `Land`: `LandenlijstLand → Landenlijst` en
   `EULidstatenLand → EULidstaten`, elk een eigen hub-tabel met een vaste
   `referentielijst_id`. De naamconventie `<Instantie><Item>` blijft.

### Wat hierdoor op zijn plek valt

- **Lidmaatschap is tijdelijk.** Zet de REL materieel: het Verenigd Koninkrijk
  krijgt aanvang en einde in `EULidstatenLand` en blijft in `Landenlijst`.
  Kan vandaag al (een REL mag materieel zijn).
- **Velden verwijzen naar de lijst, niet naar het item.** Dat is al zo:
  `Adres.land` wijst met `$ref` naar `LandenlijstLand`. Een veld "EU-land"
  wijst naar `EULidstatenLand` en de RefCombobox toont alleen leden. Het
  item-type is de waarde, de REL is de keuzelijst.
- **Per lijst enkelvoudig.** Richting één instantie is de REL per item en
  moment enkelvoudig; de EXCLUDE-invariant "één actief record per scope" dekt
  dat in de database.
- `VoegOnderliggendGEToe` wordt in het gewone geval overbodig. Het blijft nodig
  voor een tweede lijst over een gedeeld item-type uit een **ander** domein
  (Land in register, EU-lijst uit domein `eu`): dan is de REL een kind van Land
  in een lager domein, en wijst het lijmpje van laag naar hoog. Dat is de goede
  richting.

### Wat je verliest

De geneste lijst van items in `/full/referentielijsten/Landenlijst`. Items van
een lijst worden een query op de REL-tabel met vaste `referentielijst_id`. De
RefCombobox-handler (`viz_reflijst_opties_handler.go`) raakt dit niet: die
leest de velden van het item-type zelf.

## 4. Stappen

| # | Stap | Waar |
|---|---|---|
| 1 | **V3 en Studio.** Items-RELs onder het item-type (`Land.relaties`), doel `Referentielijst`, subtype `referentielijst_items`, eigen `referentielijstInstantie`. `V3ReferentielijstInstantie` krijgt `domein`. Canoniek-uml: verbindingsregel bron = `ref.lijst item`, doel = `referentielijst`; de «use» van instantie naar REL blijft. Delta-import en export mee. | `model/v3_format.go`, `diagramprofielen/canoniek-uml/{index,adapter,serialisatie}.js`, `dependencyEdges.js` |
| 2 | **Codegen.** REL-hub met `<item>_id + rel_id` als sleutel en `referentielijst_id` als verwijzing (dat is het gewone pad voor een REL van een ENT). Domeinfilter: een `referentielijst_items`-REL hoort bij het domein van zijn instantie (= doorgaans het item-type); `VoegOnderliggendGEToe` alleen nog als het item-type niet in de run zit. Instanties per domein genereren. | `cmd/codegen/main.go` (filter), `gen_registry.go` (`writeVoegOnderliggendGEToe`, `writeReferentielijstInstanties`) |
| 3 | **Instantie-seed.** Bij opstart per instantie uit de registry: bestaat er geen `Referentielijst`-record met deze systeemnaam, maak het aan **via de registratieflow** door een systeemactor (eigen wijziging + registratie per insert: hub, `Referentielijstnaam`, `Referentielijstomschrijving`, `ReferentielijstVisibility`). Idempotent. De systeemnaam komt terug op de tabel (of een vaste lookup op de naam-GE; voorkeur: kolom, want de naam-GE is bitemporeel en mag wijzigen). | `dbsetup/createtables.go` (vervanger van de verwijderde `syncReferentielijstRegister`), `registratie/` |
| 4 | **Binding afdwingen.** Bij registratie van een `referentielijst_items`-REL: `referentielijst_id` moet het id van de gebonden instantie zijn, anders 422. Daarna een DB CHECK (D5/R4) per REL-tabel met het vaste id uit de seed. | `registratie/`, `dbsetup/createmodeltables.go` |
| 5 | **Eén plek voor domein.** De instantie op M1 draagt `domein`; `ReferentielijstVisibility` op M0 wordt daaruit gevuld door de seed, niet andersom. Beslissen of het GE blijft (voor externe lijsten, §14.3) of vervalt. | `Referentielijsten.md` §14 |
| 6 | **Migratie en modelbesluit.** Bestaande tabellen `landenlijstland` en `adellijketitelstitel` krijgen een andere sleutel: migratie in `ensure…Migrated`-stijl, of een rebuild op een verse database (Fundament-reset-conventie). `AdellijkeTitel` hoeft dan niet meer naar register (CODEGEN §12). | `dbsetup/`, V3 van cg-test en np-loc |
| 7 | **Docs.** `Referentielijsten.md` §2, §9, §12/§13 bijwerken; CODEGEN §8 en §12; BACKLOG D5/R4 afvinken. | |

Volgorde: 1 en 2 samen (rondreis moet blijven sluiten), dan 3 en 4, dan 5 en 6.
Stap 1 raakt de Studio en moet vóór de rebuild uit het Studio-project op main
zijn, anders bouwt die een model met de oude richting.

## 5. Antwoorden op de open punten (Mark, 07-11)

1. **`systeemnaam` wordt een kolom** op `referentielijst`: uniek, onveranderlijk, in zekere
   zin betekenisloos, maar de enige sleutel die over modellen én registers heen gelijk is. Dat
   klopt voor reflijsten, want het zijn modelelementen die ook als record in elk register
   bestaan. De uuid blijft de identiteit in het Studio-project, de systeemnaam die in het
   register (vergelijk padnaam/meervoud). De naam-GE blijft de leesbare, bitemporele naam.
2. **`ReferentielijstVisibility` blijft** als GE naast `domein` op de instantie; de seed vult
   het GE vanuit de instantie (stap 5).
3. **Externe lijsten:** zie §6. Het `$ref`-punt vervalt, omdat een externe lijst een gewone
   reflijst met herkomst wordt.

## 6. Externe referentiedata (richting, nog geen besluit)

Mark (07-11): een externe lijst beheer je niet (gewascodes van RVO, de BGT, de
CBS-activiteitenlijst), maar je hebt er vrijwel altijd een kopie van, en je wilt code, naam en
omschrijving in je model kunnen gebruiken. Voor een gemeente zijn de gemeentecodelijst en de
landenlijst ook extern; van de landenlijst is de authentieke bron niet eens duidelijk. Vaak trek
je zo'n lijst je systeem in en zorg je voor replicatie vanuit de bron.

Dat draait `Referentielijsten.md` §14.3 om. Daar staat "extern = data leeft niet lokaal"; in de
praktijk leeft de data juist wél lokaal, alleen het gezag ligt buiten. Voorgestelde richting:

- **Een externe lijst is een gewone reflijst met herkomst.** Het item-type is normaal
  gemodelleerd (minimaal code, naam, omschrijving), de items-REL naar de instantie bestaat gewoon,
  velden verwijzen er met `$ref` naar. Geen aparte structuur.
- **De instantie draagt de herkomst.** `ReferentielijstInternetadres` (adres, URL/URN,
  organisatie) is daar al het begin van; erbij hoort de wijze van bijhouden (handmatig,
  periodiek, op afroep) en of de lijst in eigen beheer is of een kopie. "Extern" is daarmee een
  eigenschap van de instantie, geen derde visibility-niveau.
- **Replicatie = registraties door een systeemactor "bron X".** Dat past op het bitemporele
  model: formele tijd is wanneer wij het leerden, materiële tijd is wat de bron zegt over
  geldigheid. Een code die de bron met terugwerkende kracht intrekt is een gewone correctie.
- **Gradatie van externe afspraken:** een datatype is een externe afspraak als regel, stabiel
  en zonder waardenset (NL-postcode); een enum is een kleine vaste waardenset in het model; een
  reflijst is een waardenset in het register, in eigen beheer of als kopie.
- **Buiten scope:** lijsten die live worden opgevraagd zonder kopie. Die lijken eerder op een
  datatype met validatie door een dienst dan op een reflijst.

Uitwerking: §14.3 van `Referentielijsten.md` herschrijven langs deze lijn zodra stap 3 (seed)
er is, want de seed en de replicatie delen dezelfde systeemactor-registratie.

## 7. Afstemming met de andere sessies (07-11)

- **FUNDAMENT:** geen botsing met de uitrol voor 09-11; op cg-test zijn `referentielijst`,
  `landenlijstland`, `adellijketitelstitel`, `land` en `adellijketitel` leeg (0 rijen), dus een
  reset-met-replay is daar goedkoop. Het eerdere advies om `AdellijkeTitel` naar register te
  verhuizen is ingetrokken ten gunste van het omdraaien van de REL; dat lost ook de blokkade op
  die BACKEND zag voor de rebuild met expliciete domeinenlijst (`precies`).
  Aandachtspunten: (a) de wijziging in de Studio-projecten gaat als op (`patchElementen`),
  nooit met PUT (regel Mark); (b) in het aanvraag-domein is `Aanvraagtype` door Mark als
  reflijst-item benoemd en nu een REL `Aanvraag → Aanvraagtype` met doelkardinaliteit 1. Wordt
  `Aanvraagtype` een reflijst-item met instantie-binding, dan wil FUNDAMENT dat weten vóór de
  volgende generatie uit TRANSFORMATIES. **Antwoord Mark (07-11): ja, daar hoort een instantie
  bij.** Aanvraagtype wordt reflijst-item met instantie (bv. `Aanvraagtypen`) en een items-REL in
  het aanvraag-domein; `Aanvraag → Aanvraagtype` wordt een veldverwijzing naar die REL. Staat op
  het model-todo-lijstje van FUNDAMENT (punt 7). Raakt bij FUNDAMENT `uitrol.ps1`
  (leest nu `aanvraag_aanvraagtypen/aanvraagtype_id`), de GPK-generatie van TRANSFORMATIES en
  het migratiescript; FUNDAMENT past dat aan zodra het model het heeft en wil een melding
  wanneer stap 1 (V3 + Studio) op main staat.
- **BACKEND** (feat/smal-bouwen, ongecommit, voor api 0.22.0 / devloop 0.25.0): geen botsing,
  drie raakvlakken.
  1. *Rebuild met `precies: true`* gooit de gegenereerde bestanden van niet-gekozen domeinen weg
     en weigert met 422 zolang iets naar een weggelaten domein wijst. Vandaag is de enige
     overgebleven verwijzing register → adellijketitel; stap 1 lost die op. BACKEND leest de
     domeinen uit de gegenereerde `*_metaregistry.go`; komt de REL in het bestand van het
     item-domein, dan werkt die controle zonder aanpassing.
  2. *Seed (stap 3)*: een register kan bewust een deel van de domeinen hebben; de gebouwde lijst
     staat in `schema_versies.gebouwde_domeinen` (JSONB `[{domein, prefix}]`). De seed mag alleen
     instanties registreren waarvan het domein gebouwd is; een instantie zonder domein hoort bij
     het standaardpakket (beheer/configuratie/financieel/gegevenstypen/ide_bestanden/register).
     Volgorde bij opstarten: eerst de startup-rebuild, dan de seed.
  3. *Migratie (stap 6)*: het nieuwe `/admin/wees-tabellen` (devtools) ruimt alleen tabellen op
     zonder MetaRegistry-type, leeg en zonder wijzigingen die ernaar wijzen. Een tabel die van
     domein verhuist met dezelfde naam valt daar niet onder en gaat via `ensure…Migrated`; krijgt
     de tabel een nieuwe naam en blijft de oude met data staan, dan weigert de opruiming. Neem de
     oude tabel dus in de migratie mee.

## 8. Stand 08-11: stap 1 al getekend; veldverwijzing en naamgeving

Mark heeft stap 1 op 07-11 al in de Studio getekend (project Inrichten, snapshot volgnummer
2548); de rebuild van cg-test ermee wacht tot na de demo. Stand uit de V3-export (FUNDAMENT):

| Item-type (domein) | items-REL | Instantie |
|---|---|---|
| `Land` (org-geo) | `LandenlijstLand` [referentielijst_items, doelKard 1..1] → Referentielijst | Landenlijst |
| `AanvraagtypeDefinitie` (aanvraag) | `Aanvraagtype` [referentielijst_items] → Referentielijst | "Aanvraagtypen", nog te maken |
| `AdellijkeTitelDefinitie` (np-loc) | `AdellijkeTitel` → Referentielijst, **subtype nog leeg** | AdellijkeTitels |

**Naamgeving Mark:** item-entiteit `<X>Definitie`, gegevens-GE `<X>Gegevens`, items-REL `<X>`
(het pseudo-gegevenstype waar velden naar verwijzen). Namen zijn vrij (`Referentielijsten.md`
§8). Kanttekening: bij meer lijsten over één item-type moet de REL-naam de lijst dragen
(`LandenlijstLand`, `EULidstatenLand`), niet alleen het item; `Aanvraagtype` werkt zolang er één
lijst is.

**Nog te doen in de Studio vóór de rebuild** (via `patchElementen`, nooit PUT):
- oude RELs op Referentielijst (hernoemd `…_VerkeerdOm`, typenaam ongewijzigd) weghalen: de
  codegen weigert dubbele typenamen (`LandenlijstLand`) en `AdellijkeTitel` wijst nu op een
  zwevend doel; ook de oude REL `AanvraagAanvraagtype` weg;
- `referentielijstInstantie` op de drie nieuwe RELs, subtype `referentielijst_items` op de
  AdellijkeTitel-REL, instantie `Aanvraagtypen` maken;
- `Aanvraag.Aanvraagtype.type` is nu `string` zonder verwijzing, omdat de Studio-keuzelijst
  alleen item-entiteiten biedt (gemeld aan OMNIUM-UI).

### Veldverwijzing: wat `$ref` noemt

Vandaag lopen twee vormen door elkaar: `Adres.gemeente` heeft `ref:Gemeente` (item-entiteit),
`Adres.land` heeft `ref:LandenlijstLand` (items-REL). De codegen schrijft de naam ongecontroleerd
in de tag `schema:"ref:…"`; de schema-API geeft hem door als `veld.ref`; de RefCombobox stuurt
hem onveranderd naar `/api/viz/reflijst/{typenaam}/opties`, en **die handler eist een
`referentielijst_item`-entiteit** (`viz_reflijst_opties_handler.go`). Een `$ref` naar de REL
geeft dus nu 400 in formulieren. Dat de Landenlijst nooit gebruikt is (BACKLOG PE16, `land=0`),
verklaart waarom dat niet opviel.

**Afspraak (08-11):**
- **Doelvorm:** `$ref` noemt de **items-REL** (`"Aanvraagtype"`, `"LandenlijstLand"`): de REL is
  de keuzelijst, het item-type de waarde. Alleen zo kan één item-type in meer lijsten zitten.
  Het veld blijft een `integer` met het **item-id** als waarde (niet het `rel_id`); de REL
  bepaalt welke items toegestaan zijn.
- **Overgang:** `$ref` naar een `referentielijst_item`-entiteit blijft werken en betekent "alle
  items van dit type, zonder lijst" (Gemeente, ArtefactFormaat, ArtefactSoort, Partijrol,
  ApiStandaard, Domein, Trefwoord hebben nog geen items-REL). Een item-type zonder REL is in het
  nieuwe ontwerp een item-type zonder lijst; dat mag, maar dan is er geen instantie en geen
  herkomst.
- **Backend (bij stap 2/4):** de opties-handler en de verwijzingscontrole (BACKLOG 33.4)
  herkennen een REL van subtype `referentielijst_items`, nemen zijn bron-entiteit als item-type
  en filteren op `referentielijst_id` van de gebonden instantie (lidmaatschap, materieel op het
  leesmoment). De codegen controleert dan ook dat `$ref` een item-entiteit of een items-REL
  noemt.
- **Instantie-binding:** `referentielijstInstantie` blijft op de REL (dat is de binding); de
  instantie zelf staat in `referentielijstInstanties` met systeemnaam en, nieuw, `domein`.
- **Studio (OMNIUM-UI):** de keuzelijst voor een veldtype biedt naast item-entiteiten ook de
  items-RELs aan, met de REL als voorkeur; de «use» loopt dan van het veld naar de REL, zoals
  `Adres.land` nu.

`Land` staat nu in org-geo in plaats van register. Voor de laag is dat goed (org-geo → register);
`Adres.land` in np-loc hangt dan aan org-geo, wat via `Gebiedsligging → Gemeentedeel` al zo was.

### Bevestiging OMNIUM-UI (08-11, alleen gelezen) en voorgestelde verdeling

OMNIUM-UI bevestigt dat "velden verwijzen naar de items-REL" nog nergens werkt:
- **Studio:** de veldtypekiezer (`canoniek-uml/index.js`, referenceType `refitem`, filter
  `isRefLijstItem`) biedt alleen ENT's met subtype `referentielijst_item`; een keuze wordt via
  `parseTypeLabel` altijd `{type: integer, refItemNaam}` → `$ref` naar de entiteit. Een bestaand
  `$ref` naar een REL (Adres.land) toont als "integer" en gaat verloren zodra iemand het type
  aanraakt. `synchroniseerGebruik` en de handmatige «gebruikt» kennen alleen item-entiteiten.
- **Backend:** codegen schrijft `ref:` ongecontroleerd en valideert het doel niet; de
  opties-handler eist een item-entiteit (dus 400 voor een REL); `validation_walker.go` slaat
  ref-waarden over bij registratie (33.4 open).
- **Tests en fixtures:** geen enkele test of fixture met veld → items-REL, behalve één veld in
  het demo-model np-loc-org+geo.

**Volgorde (besluit Mark 08-11):** eerst deel 1 door OMNIUM-UI, dan de release van BACKEND
(api 0.22.0 / feat/smal-bouwen), daarna de rest van dit plan; wie dat doet beslist Mark dan.

Verdeling:
1. **OMNIUM-UI** (worktree `_tekenaar`): kiezer biedt items-RELs aan met de REL als voorkeur,
   `typeLabel`/`parseTypeLabel` bewaren een `$ref` naar een REL in de rondreis, «gebruikt» en
   `synchroniseerGebruik` accepteren een REL als doel; verbindingsregel bron = item, doel =
   referentielijst.
2. **Backend (BACKEND of REFLIJST):** opties-handler vertaalt een items-REL naar zijn
   bron-entiteit en filtert op leden van de gebonden instantie; codegen valideert het
   `$ref`-doel (item-entiteit of items-REL); controle bij registratie (33.4) dat het item lid is
   van de lijst. Dit is onderdeel van stap 2 en 4 van dit plan.
3. **Fixtures en tests:** cg-test en demoV3Model krijgen minstens één veld → items-REL;
   rondreis-, codegen-, opties-route- en registratietest.

### Deel 1 gebouwd door OMNIUM-UI (08-11, ongecommit, branch `feat/assistent-velden`, worktree `_tekenaar`; Mark test op 5177)

Alles onder `web/vite/src/diagramprofielen/canoniek-uml/`:
- **Kiezer:** nieuw referenceType `reflijst`, groep "Referentielijsten" (label
  `LandenlijstLand (items: Land)`, ongeacht aan welke kant het item staat), vóór
  "Referentielijst-items (zonder lijst)" (`refitem`, overgang). `TYPE_REFS` = basistype,
  gegevenstype, enumeratie, reflijst, refitem. Helpers `isRefLijst`, `isRefLijstItems` in
  `index.js`.
- **Rondreis:** `typeLabel` toont `refItemNaam` in plaats van "integer"; `parseTypeLabel`
  herkent een items-REL → `{type: integer, refItemNaam}`; het oude label "integer" in een
  bestaand project telt als niet aangeraakt, zodat `$ref` niet verloren gaat. Migratie
  `herstelRefTypeLabels` (`afgeleideConnectoren.js`, in `migreerModel` vóór GEBR-1) zet bestaande
  `$ref`-velden om naar de verwijzingsnaam; daardoor verschijnen bij het laden ook afgeleide
  «gebruikt»-lijnen (vaste ids `gebr_<bron>__<doel>`, idempotent).
- **«gebruikt»:** `synchroniseerGebruik` leidt een lijn af naar de items-REL;
  `gebruik.magVerbinden` laat een items-REL als doel toe, een gewone relatie niet.
- **Verbindingsregel:** `controleerItemsRichting` waarschuwt bij lijst → item ("draai de
  richting om"); het demo-model np-loc staat nog zo (beide items-RELs).
- **Tests:** `reflijstVeld.test.js` op het demo-model (Adres.land → LandenlijstLand,
  Adres.gemeente → Gemeente): heenreis, terugreis, omhangen, legacy-label, kiezer, «gebruikt»,
  migratie, richting. 1480 unittests groen; e2e 121 groen (3 falen alleen onder parallelle last).
- **Docs:** STUDIO.md (onder GEBR-1) en CHANGELOG; backend-stappen daar als "volgt na api 0.22.0".

Volgende: release BACKEND (api 0.22.0), daarna de backend-kant (§8 verdeling, punt 2) en het
omdraaien van de items-RELs in het demo-model np-loc.

