# Zoekdefinities — zoektabellen als inrichting (ontwerp)

Datum: 18-11-2026. Status: **ontwerp, niet gebouwd.** Claude-sessie (BACKEND), op verzoek van
Mark. Hoort bij het indexwerk (`docs/INDEXEN.md`) en bij `dynql/sortering.go`.

## 1. Aanleiding

De loadtest van FUNDAMENT (register met zaken, 333.143 zaken, 100 zaaktypen, 16 gelijktijdige
gebruikers) na api 0.30.1:

| Vraag | Mediaan |
|---|---|
| alle zaken op startdatum, eerste 50 | 15,5 ms |
| zaken van één zaaktype op startdatum, eerste 50 | 801 ms |
| dezelfde vraag in Open Zaak 1.31.2 (154.505 zaken) | 234 ms |

De tweede vraag is traag omdat het zaaktype en de startdatum in twee tabellen staan: de relatie
Zaak → Zaaktype en het gegevenselement ZaakLooptijd. PostgreSQL moet alle zaken van het zaaktype
(ongeveer 3.400) met hun startdatum ophalen voordat het de eerste 50 kan kiezen. Met één
gebruiker kost dat 67 ms en 33.700 gelezen pagina's; onder belasting wordt dat 800 ms. Andere
database-instellingen helpen niet (gemeten door FUNDAMENT: 50 tot 72 ms). Een index kan het niet
oplossen, want een index beslaat één tabel.

## 2. Besluiten van Mark (18-11-2026)

- Een opgeslagen afgeleid veld op de relatie is een te grote ingreep voor dit doel: de relatie
  zou versies in de formele historie krijgen die niemand heeft geregistreerd.
- Wel proberen: een **zoektabel buiten de formele historie**, die de API bijhoudt en gebruikt
  bij een passende zoekvraag in plaats van de gewone weg.
- De zoektabel wordt ingesteld met een **definitie als registerdata**, zoals een opgeslagen
  query (`QueryDefinitie`), zodat er geen rebuild nodig is. Zo'n definitie is inrichting.
- Een **mark** kan later een aanvullende bron zijn die definities aanmaakt, ook
  querydefinities. Dat valt buiten dit ontwerp (§12).
- **Richting van de afhankelijkheid: zoektabel → register, niet andersom.** De zoektabel is
  een add-on. Het register weet er niets van; alleen de API weet het. Een zoektabel mag het
  gewone registreren nooit in de weg staan (§7).
- De namen `ZoekDefinitie` en "zoektabel" zijn akkoord.
- Registreren mag de beheerder. Het inrichtingsscript komt later en handelt dan namens een
  beheerder.
- Een zoektabel van een ingetrokken definitie wordt opgeruimd (§8).

## 3. Begrippen en metaniveaus

| Begrip | Wat | Niveau |
|---|---|---|
| `ZoekDefinitie` (het type) | een entiteit in het configuratiedomein van het register | M1 (het register-configuratiemodel) |
| een zoekdefinitie | één geregistreerde definitie: "zaken per zaaktype op startdatum" | M0 (registerdata, inrichting) |
| zoektabel | de tabel die de API bij één zoekdefinitie aanmaakt en bijhoudt | plumbing, zoals een index |
| `zoektabel_stand` | per zoektabel: bestaat hij, is hij gevuld, hoort hij nog bij de definitie | plumbing |

De zoektabel en de standtabel staan buiten het model: ze hebben geen `wijziging`-rijen en geen
registratie, en zijn altijd volledig herbouwbaar uit de brontabellen. De zoekdefinitie zelf is
gewone bitemporele registerdata: wie heeft haar wanneer aangezet of ingetrokken, staat in de
historie.

## 4. De zoekdefinitie

Een nieuw gereserveerd type in het configuratiedomein, naar het voorbeeld van `QueryDefinitie`
(`dynql/opgeslagen_documenten.go`):

| Gegevenselement | Velden | Opmerking |
|---|---|---|
| naam | `naam`, `beschrijving` | uniek; bv. `zaken-per-zaaktype-op-startdatum` |
| pad | `binnen`, `sorteerveld` | niet materieel; zie hieronder |
| status | `status` (`actief` / `inactief`), `reden` | **materieel**, zoals bij `QueryDefinitie` |

Alleen de status is materieel: "actief vanaf 1 december" kan vooruit geregistreerd worden. Het
pad is niet materieel: een ander pad is een andere zoektabel, en dat is een correctie of een
nieuwe definitie. Wat de materiële status voor de zoektabel betekent, staat in §8.

- `binnen` is het pad van een relatie: `<Entiteit>.<rolnaam van de relatie>`, bv.
  `Zaak.zaak_zaaktypen`.
- `sorteerveld` is het pad van een veld: `<Entiteit>.<rolnaam van het GE>.<veld>`, bv.
  `Zaak.zaaklooptijd.startdatum`.
- De namen zijn die van het GraphQL-schema, dezelfde als in het filter en in `sorteer`. Een
  definitie verwijst dus op naam, niet op uuid, net als een opgeslagen query.

Voorwaarden in versie 1 (anders is de definitie ongeldig en wordt ze niet gebruikt):

1. De relatie en het gegevenselement hangen aan dezelfde entiteit.
2. Het gegevenselement is enkelvoudig en niet materieel (dezelfde grens als het sorteren op de
   waarde zelf, `docs/INDEXEN.md`).
3. De relatie is een eigen relatie van de entiteit, met de doel-id in de hub.

Omdat `ZoekDefinitie` een gewoon type in het configuratiedomein is, krijgt het vanzelf de
registratie-API, de REST-routes en GraphQL, zoals elk type. Een inrichtingstool kan
zoekdefinities dus lezen en registreren zonder eigen API (Mark, 18-11).

Controle: bij het registreren (422 met de reden) en bij elke start (regel in het log), zoals
`ValideerOpgeslagenDocumenten` dat voor opgeslagen queries doet. Een definitie die door een
modelwijziging ongeldig is geworden, staat dan in het log en wordt overgeslagen.

## 5. De zoektabel

Eén tabel per zoekdefinitie, met de naam `zk_<id van de zoekdefinitie>`. De id verandert niet
als de definitie een andere naam krijgt.

| Kolom | Inhoud | Voorbeeld |
|---|---|---|
| `doel_id` | de doel-id van de relatie | het zaaktype |
| `waarde` | de waarde van het sorteerveld, in het type van de bronkolom | de startdatum |
| `entiteit_id` | de entiteit | de zaak |
| `rel_id` | het voorkomen van de relatie | |
| `opvoer`, `afvoer` | de doorsnede van de geldigheid van de entiteit, het relatievoorkomen, de GE-hub en het datarecord | |

- Index: `(doel_id, waarde, entiteit_id)`, niet partieel. De eerste pagina van één doel komt
  dan rechtstreeks uit de index, in beide richtingen (waarde en id in dezelfde richting, de
  regel van api 0.30.1).
- Tweede index: `(entiteit_id)`, voor het bijhouden.
- Een rij staat er alleen als de waarde niet leeg is en de doorsnede niet leeg is.
- De tijdkolommen volgen dezelfde regel als elke tabel: een rij is actief op het leesmoment als
  `opvoer <= moment AND (afvoer IS NULL OR afvoer > moment)`. Een vraag met een peiltijdstip
  kan de zoektabel dus ook gebruiken.

De rijen van één entiteit volgen uit één query op de brontabellen:

```sql
SELECT r.<doel>, d.<waarde>, e.id, r.rel_id,
       GREATEST(e.opvoer, r.opvoer, h.opvoer, d.opvoer)        AS opvoer,
       LEAST(e.afvoer, r.afvoer, h.afvoer, d.afvoer)           AS afvoer   -- NULL telt niet mee
FROM <entiteit> e
JOIN <relatie-hub> r ON r.<ent> = e.id
JOIN <ge-hub> h      ON h.<ent> = e.id
JOIN <ge-data> d     ON d.<ent> = h.<ent> AND d.rel_id = h.rel_id
WHERE e.id = ANY(?) AND d.<waarde> IS NOT NULL
  AND (afvoer IS NULL OR afvoer > opvoer)                      -- de doorsnede is niet leeg
```

Dit zijn dezelfde kolommen `opvoer` en `afvoer` die het filter en de sortering van de gewone
weg lezen. De zoektabel kan daardoor niets anders zeggen dan de gewone weg, ook niet na een
correctie of een ongedaanmaking: die werken de kolommen van de bronrijen bij, en de zoektabel
wordt daaruit opnieuw afgeleid (§7).

## 6. De standtabel

`zoektabel_stand`, één rij per zoektabel:

| Kolom | Inhoud |
|---|---|
| `definitie_id` | de zoekdefinitie |
| `tabel` | `zk_<id>` |
| `definitie_hash` | hash van (`binnen`, `sorteerveld`, de brontabellen en -kolommen) |
| `status` | `vullen`, `gevuld`, `uitfaseren`, `fout` |
| `gevuld_tot_id` | voortgang van het vullen (hervatten na een herstart) |
| `gewijzigd_op`, `melding` | voor het log en voor beheer |

De definities komen uit het register (§4), de stand uit deze tabel. De API gebruikt een
zoektabel voor het lezen alleen bij status `gevuld` en een hash die bij de geldende definitie
past.

## 7. Bijhouden bij een registratie

Plaats: binnen de transactie van `RegistreerCore`, na het verwerken van de wijzigingen en vóór
de commit. Alle schrijfwegen (registratie, correctie, ongedaanmaking, replay) lopen daar langs.

De registratiecode kent de zoektabellen niet. Ze biedt één haak aan ("vlak voor de commit, met
de transactie en de wijziging-rijen"), naar het voorbeeld van `NaRegistratie` voor de
notificaties. Een eigen pakket voor de zoektabellen meldt zich bij de start op die haak aan.
Zonder aanmelding, of zonder zoekdefinities, doet de haak niets. Het pakket van de zoektabellen
gebruikt het register; het register gebruikt dat pakket niet.

Waarom binnen de transactie en niet erna: alleen zo ziet een lezer de bronrijen en de
zoektabelrijen van een registratie tegelijk (§10). De prijs is dat de haak tijd kost in de
registratie; de grenzen daaraan staan onderaan deze paragraaf.

1. Lees de rijen van `zoektabel_stand` met status `vullen`, `gevuld` of `uitfaseren`. Dat is
   één vraag op een tabel met een handvol rijen, in de transactie zelf. Er is geen lijst in het
   geheugen die achter kan lopen, ook niet met meer dan één API-proces.
2. Bepaal per zoektabel welke entiteiten deze registratie heeft geraakt: de entiteit zelf, een
   voorkomen van de relatie of een voorkomen van het gegevenselement. De wijziging-rijen van de
   registratie leveren die id's.
3. Per geraakte entiteit: neem een slot (`pg_advisory_xact_lock` op zoektabel en entiteit-id),
   verwijder de rijen van die entiteit uit de zoektabel en voeg de rijen uit de query van §5
   opnieuw toe.

Er is dus één code voor alle gevallen: opvoer, afvoer, correctie, ongedaanmaking en replay
leiden allemaal tot "reken de rijen van deze entiteit opnieuw uit". Verwijderen mag hier: de
zoektabel is geen formele historie.

**De zoektabel staat het registreren niet in de weg** (besluit Mark, 18-11):

- Mislukt het bijhouden, dan slaagt de registratie toch. De haak draait in een savepoint; bij
  een fout wordt alleen dat stuk teruggedraaid, de fout wordt gelogd en de zoektabel gaat naar
  status `fout`. Lezen gaat dan via de gewone weg tot de zoektabel opnieuw is gevuld.
- Het bijhouden wacht niet onbeperkt op een slot: na een korte grens (voorstel: 200 ms) geldt
  het als mislukt, met hetzelfde gevolg.
- Het vullen werkt in kleine groepen, zodat het een slot nooit lang vasthoudt.
- Een zoektabel in status `fout` wordt bij het eerstvolgende afstemmen opnieuw gevuld. Blijft
  dat mislukken, dan blijft hij `fout` met de melding in de standtabel en in het log.

Kosten: per registratie één kleine leesvraag, en per geraakte entiteit een verwijdering en een
invoeging van een paar rijen. Te meten op "zaak aanmaken" (nu 79 ms).

## 8. Levenscyclus

| Gebeurtenis | Wat de API doet |
|---|---|
| een zoekdefinitie wordt actief (registratie of start) | tabel en indexen aanmaken, stand `vullen`, vullen op de achtergrond |
| vullen klaar | stand `gevuld`; vanaf nu gebruikt het lezen de zoektabel |
| de definitie wijzigt (ander pad) | de hash klopt niet meer: als intrekken, daarna opnieuw aanmaken en vullen |
| de status is nu inactief, maar er is een latere actieve periode geregistreerd | lezen stopt; de tabel blijft staan en wordt bijgehouden, zodat hij op de ingangsdatum klaar is |
| de status wordt pas later actief (vooruit geregistreerd) | tabel alvast aanmaken en vullen; lezen begint op de ingangsdatum |
| de definitie is afgevoerd, of er is geen huidige of latere actieve periode meer | stand `uitfaseren`: lezen stopt, bijhouden gaat nog door; na een wachttijd de tabel weggooien en de standrij verwijderen |
| het model wijzigt onder de definitie vandaan | bij de start: melding in het log, als intrekken |
| herstart tijdens het vullen | hervatten vanaf `gevuld_tot_id` |

**Vullen terwijl er geschreven wordt.** Het vullen loopt in groepen entiteiten op id en doet
per groep precies de stap van §7 (slot, verwijderen, opnieuw afleiden), elke groep in een eigen
transactie. Vanaf status `vullen` houden registraties de zoektabel al bij. Het slot per
entiteit zorgt dat het vullen en een gelijktijdige registratie elkaar niet overschrijven: wie
het slot als tweede krijgt, leidt af uit de stand na de commit van de eerste.

**Uitfaseren.** Een ander API-proces kan de zoektabel nog een korte tijd voor het lezen
gebruiken. Daarom gaat het bijhouden door tot de wachttijd om is (langer dan de verversing van
§9).

**Opmerken van een nieuwe of gewijzigde definitie.** Een registratie die een `ZoekDefinitie`
raakt, start het afstemmen direct na de commit (dezelfde plek als de hook `NaRegistratie`).
Daarnaast stemt de API bij de start en periodiek af (voorstel: elke minuut), voor een vooruit
geregistreerde status en voor een tweede API-proces. Er is dus geen herstart nodig.

## 9. Gebruik bij het lezen

Plaats: `dbLader.LaadLijst` in `dynql/lader.go`, vóór de huidige sorteervormen. De zoektabel
wordt gebruikt als alles geldt:

1. Het filter is precies één voorwaarde: de doel-id van de relatie `binnen` is gelijk aan één
   waarde (`eq`).
2. Er is precies één sorteersleutel en dat is `sorteerveld`.
3. Er is geen actief toegangsbeleid voor het subject. Met beleid geldt de gewone weg, zoals
   bij het laden op selectie.
4. De zoektabel heeft status `gevuld` en de hash past.
5. De noodrem `GRAPHQL_KLASSIEK_LADEN` staat uit.

Dan:

```sql
SELECT entiteit_id FROM zk_<id>
WHERE doel_id = ? AND opvoer <= :moment AND (afvoer IS NULL OR afvoer > :moment)
ORDER BY waarde <richting>, entiteit_id <richting>
LIMIT ? OFFSET ?
```

Daarna laadt de lader die entiteiten op id en zet ze in deze volgorde, zoals bij het sorteren
op de waarde zelf. Entiteiten zonder waarde staan niet in de zoektabel; is de pagina niet vol,
dan vult het bestaande tweede deel (`NOT EXISTS`, op id) haar aan.

In elk ander geval volgt de gewone weg. Een vraag gaat dus nooit fout door een zoektabel; ze
wordt hooguit niet versneld.

De lijst van bruikbare zoektabellen staat voor het lezen in het geheugen en wordt ververst bij
het afstemmen (§8). Loopt die lijst achter, dan gebruikt het lezen een zoektabel iets te laat
(veilig) of nog even een zoektabel in `uitfaseren` (ook veilig: die wordt nog bijgehouden).

## 10. Tijd en leesconsistentie

- Het bijhouden gebeurt in de transactie van de registratie. Een lezer ziet de bronrijen en de
  zoektabelrijen van een registratie dus tegelijk, of geen van beide.
- De zoektabel draagt `opvoer` en `afvoer`. Het leesmoment van de vraag geldt daardoor op
  dezelfde manier als op de brontabellen, ook met een peiltijdstip.
- De id's komen uit de zoektabel en de entiteiten worden daarna geladen, in twee vragen op
  hetzelfde leesmoment. Dat is hetzelfde als bij het sorteren op de waarde zelf. Het bestaande
  open punt over leesconsistentie van `/full` (BACKLOG §32) wordt hier niet groter of kleiner
  van.
- Een entiteit die tussen de twee vragen is afgevoerd, komt wel uit de zoektabel maar niet uit
  het laden. De pagina kan dan een rij korter zijn. Dat kan in de huidige vorm ook.

## 11. Grenzen van versie 1

- Eén relatie en één sorteerveld per definitie. Geen tweede sorteersleutel.
- Alleen `eq` op één doel. `in`, en een filter met extra voorwaarden, volgen de gewone weg.
- Alleen een enkelvoudig, niet-materieel gegevenselement.
- Twee voorkomens van de relatie naar hetzelfde doel geven twee rijen voor dezelfde entiteit.
  De leesvraag moet dat ontdubbelen. **Uit te zoeken bij de bouw:** of dat in de query kan
  zonder de index te verliezen, of dat de afleiding de voorkomens moet samenvoegen.
- Alleen GraphQL-lijsten. REST kan nog niet filteren of sorteren op een GE-veld.
- Geen telling: een vraag naar het totaal aantal treffers gebruikt de zoektabel niet.

Niet in dit ontwerp, wel mogelijk met dezelfde tabel: "de eerste 50 van een zaaktype" zonder
sortering (nu 105 ms) en "de tiende pagina" (nu 402 ms). Die zouden de index `(doel_id, …)` ook
kunnen gebruiken. Pas doen als een meting het vraagt.

## 12. Marks als bron van definities (later)

Mark, 18-11: een mark kan definities aanmaken, ook querydefinities; die definities zijn
inrichting. De gedachte voor later:

- Een mark in het model (bv. `register.sorteerbaarBinnen` op het veld, met de relatie in de
  waarde) is de wens op M1-niveau.
- Bij "Register bouwen" of bij de exportstap voor inrichtingsartefacten wordt de mark omgezet
  in een registratie van een `ZoekDefinitie` (of een `QueryDefinitie`), net als andere
  inrichting.
- De API kent alleen de definitie. Of die met de hand is geregistreerd of uit een mark komt,
  maakt voor de API niet uit.

Dit ontwerp bouwt alleen de definitie en de zoektabel. De mark en de omzetting zijn een eigen
stap, af te stemmen met OMNIUM-UI (het markspaneel kent nu alleen ja/nee-waarden voor de
register-marks).

## 13. Bewijs

- **Gelijkheid:** een vergelijkingstest (tag `integration`), zoals `TestSorterenOpWaarde`: elke
  passende vraag met en zonder zoektabel, de antwoorden letterlijk gelijk. De reeks dekt
  oplopend en aflopend, paginering, een pagina over de grens met de entiteiten zonder waarde,
  een peiltijdstip, en de stand na een correctie, een afvoer en een ongedaanmaking van elk van
  de drie bronnen (entiteit, relatie, gegevenselement).
- **Levenscyclus:** aanmaken, vullen terwijl er geregistreerd wordt, intrekken, een gewijzigd
  pad, een herstart tijdens het vullen.
- **Herbouwbaarheid:** de zoektabel leegmaken en opnieuw vullen geeft dezelfde rijen.
- **Snelheid:** het queryplan op nagebouwde tabellen met een scheve verdeling (veel gelijke
  waarden, een smal doel), en daarna de meting van FUNDAMENT op de teststack: "zaaktype op
  startdatum" en "zaak aanmaken", voor en na.

Verwachting, geen meting: "zaaktype op startdatum" leest 50 rijen uit de index in plaats van
ongeveer 3.400 zaken en komt in de orde van "alle zaken op startdatum" (15 ms onder belasting).

## 14. Uitrol

- **Eenmalig een release van de API**: het type `ZoekDefinitie` komt in het standaardpakket
  (configuratiedomein). Schemawijziging: ja, automatisch (de tabellen van het nieuwe type en
  `zoektabel_stand`). Rebuild uit het Studio-project: nee.
- **Daarna per definitie niets**: registreren is genoeg, zonder rebuild en zonder herstart.
- Zonder zoekdefinities verandert er niets aan het gedrag.
- Noodrem: `GRAPHQL_KLASSIEK_LADEN=1` zet het lezen via zoektabellen uit. Het bijhouden gaat
  dan door, zodat de zoektabellen kloppen als de noodrem er weer af gaat.

## 15. Bouwstappen

1. Het type `ZoekDefinitie` in het configuratiedomein, met het contract en de controle bij de
   start (naar `initOpgeslagenContract`).
2. De afleiding van §5 als één functie "reken de rijen van deze entiteiten uit", met tests op
   de doorsnede van de tijdvakken.
3. `zoektabel_stand`, het afstemmen en het vullen (§6, §8).
4. Het bijhouden in `RegistreerCore` (§7).
5. Het lezen in `LaadLijst` (§9) met de vergelijkingstest (§13).
6. Documentatie in `docs/INDEXEN.md` en `docs/dynamische-graphql-laag.md`; daarna de meting
   door FUNDAMENT.

## 16. Beantwoorde vragen (Mark, 18-11-2026)

| Vraag | Besluit |
|---|---|
| Naam | `ZoekDefinitie` en "zoektabel" |
| Wie mag registreren | de beheerder; het inrichtingsscript later, namens een beheerder |
| Fout bij het bijhouden | de registratie slaagt altijd; de zoektabel is een add-on en het register weet er niets van (§2, §7) |
| Opruimen | ja, na het uitfaseren (§8) |
| Is de definitie materieel | alleen de status (§4); de gevolgen voor aanmaken en opruimen staan in §8 |

## 17. Open

- De regel van §8 voor een vooruit geregistreerde status (alvast vullen) en voor een tijdelijk
  inactieve status (laten staan) is een voorstel; nog niet door Mark bevestigd.
- De grens van 200 ms voor het wachten op een slot (§7) is een voorstel; bij de bouw te toetsen
  met de meting van "zaak aanmaken".
