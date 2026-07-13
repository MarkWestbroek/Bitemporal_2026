# Analyse — UBB "Bitemporal Stores v0.1" tegen ons v06-register

> Datum: 2026-07-13
> Bron: *Towards better data stores within the Dutch government* — VNG Realisatie, project
> "Uit betrouwbare bron" (UBB), unfinished working draft, 13 juli 2026 (46 p.).
> Doel: dekking bepalen, gaten benoemen, en een API-voorstel formuleren vanuit ons bestaande
> ontwerp voor de Historie-werkgroep van de NL API Strategie.

Dit document is bedoeld als inbreng voor de (NL-talige) werkgroep. Het UBB-stuk is Engelstalig;
waar we hun termen aanhalen zetten we ze cursief. Een terminologiebrug staat in §2.

---

## 1. Managementsamenvatting

Het UBB-document beschrijft, vanuit de literatuur (Snodgrass, Date, Jensen, Böhlen), vijf
store-varianten (S1–S5) en een omringende architectuur **Capture → Process → Account → Publish**
(feitelijk CQRS + een lichte vorm van event sourcing), plus hoofdstukken over **provenance** en
**doubt** (twijfel/onderzoek). De inhoudelijke hoofdstukken 1–6 zijn "volle concepten"; 7–11
(bitemporale operaties, API's, ontwerp, uitgestelde onderwerpen) zijn nog **stubs**.

Kernconclusies:

1. **Onze dekking is hoog op de store zelf en op de operaties, en we zitten aan de "goede"
   kant van hun aanbeveling.** UBB raadt de interval-gebaseerde bitemporele vorm (**S4**) aan
   en ontraadt de punt-gebaseerde vorm (**S5**) voor nieuwe registers. Ons v06 is
   interval-gebaseerd op de materiële as (aparte `_Aanvang`/`_Einde`) en heeft de formele as
   al uit de datarij gehaald naar een **registratie/wijziging-journaal** — daarmee hebben we de
   *Account*-stap uit hun hoofdstuk 4 in de kern al gezet.
2. **De grootste gaten zitten aan de rand:** een functionele (business-function) commandolaag
   bovenop onze low-level operaties, volwaardige *provenance* (processor-/algoritmeversie, koppeling
   aan zaak/brondocument/wetgeving), persistente **projections** als aparte stores, en de
   **repeatable question** met het concurrency-/consistentiepunt.
3. **Twijfel (H6) past inderdaad als commandosoort naast correctie en ongedaanmaking** — met één
   belangrijke nuance: het is een *annotatie/overlay*, geen mutatie van de waarde. En: hun
   moeilijkste puzzel ("welk effect veroorzaakte wat de consument zag?") is bij ons **veel
   makkelijker** omdat het journaal elk atoom al aan zijn registratie koppelt. Zie §5.

---

## 2. Terminologiebrug

| UBB (Engels)            | Ons v06 (Nederlands)                          | Opmerking |
|-------------------------|-----------------------------------------------|-----------|
| *system time* (SQL:2011; lit.: *transaction time*) | **formele tijd** / registratietijd | `opvoer` / `afvoer` |
| *valid time*            | **materiële tijd** / geldigheidstijd          | `aanvang` / `einde` |
| *standing record* (open `system_until`) | actuele/actieve representatie (afgeleide `afvoer` = ∞) | |
| *command*               | **registratie** (+ intentie)                  | draagt `bron`, `bron_kenmerk` |
| *effect* (journal, append-only) | **wijziging** onder een registratie   | wij journaalen per atoom |
| *projection*            | (nog niet als aparte store) — nu: `full_*` views | zie §7 |
| *supersede*             | afvoeren oud + opvoeren nieuw (nieuwe `versie`)| |
| *marker row* (S5-workaround) | n.v.t. — wij hebben expliciete `_Einde`   | interval-vorm |
| *chronon* / *half-open [from,until)* | idem; wij hanteren dezelfde half-open semantiek | |

---

## 3. Dekkingsanalyse per hoofdstuk

Legenda: ✅ aanwezig/geïmplementeerd · 🟡 ontwerp/gedeeltelijk · ⬜ gat.

| UBB-hoofdstuk | Onderwerp | Ons v06 | Status |
|---------------|-----------|---------|--------|
| **3 The Store** — S1–S5 | vijf store-varianten; aanbeveling **S4**, ontraadt **S5** | interval op materiële as (`_Aanvang`/`_Einde`); formele as via journaal → voorbij een simpele S4-rij | ✅ (zie §4) |
| **4.1 Capture** | harmoniseren, partijen identificeren | buiten onze scope (client-/proceszijde) | ⬜ (bewust) |
| **4.2 Process** | van CRUD naar **business functions** in de server | registratie-API is nu low-level (opvoer/afvoer per representatie); functionele laag ontbreekt | 🟡 |
| **4.3 Account** | **effect**-journaal, append-only | `registratie` + `wijziging` = journaal per atoom; `bron`/`bron_kenmerk` | ✅ kern |
| **4.4 Publish** | **projections**, persistent i.v.m. herhaalbaarheid | `full_*` (REST/GraphQL) leest de store direct; geen aparte projectie-store | 🟡 |
| **4.5/4.6 Transition, Notes** | groeipad; "availability is geen derde as" | tweeassig ontwerp bevestigt dit; cross-register tijdreizen sluit aan op "één systeem z'n systeemtijd is het volgende z'n data" | ✅ conceptueel |
| **5 Provenance** | *lineage*: effect → command + **processorversie** → zaak/artefact/wet | alleen `bron` + `bron_kenmerk` op registratie (≈ transitiestap 1) | 🟡 begin |
| **6 Doubt** | feedbackrapport → onderzoek → markeren onder onderzoek → correctie-effecten | niet aanwezig — voorstel: annotatie + registratietype (§5) | ⬜ → voorstel |
| **7 Bitemporal operations** (stub) | Create/Change/Correct/End/Reinstate/Revive/Withdraw/Erase | grotendeels gedekt door opvoer/afvoer/correctie/ongedaanmaking (mapping §6) | ✅/🟡 |
| **8 APIs** (stub) | commands + publication | wij hebben een concreet patroon → **§8 voorstel** | 🟡 → voorstel |
| **9 Design I — concepts** (stub) | identiteit, **granulariteit tussen BCNF en 6NF**, gaps/overlaps, pattern-velden | Hub+_Data (instelbare granulariteit per GE); materiële plumbing op hub-niveau | ✅ sterk |
| **10 Design II — table patterns** (stub) | anchor, lifespan, single-value, relaties/multi-value, event records, referentielijsten | entiteit-anker, GE's, relaties (ASOC), referentielijsten; "event record" (happened_on i.p.v. valid-paar) niet expliciet | ✅/🟡 |
| **11 Deferred** (stub) | future-dated, concurrency & tijd, re-sync, schemaversioning | materieel tijdreizen naar de toekomst ✅; concurrency/repeatable ⬜; schemadiff/-versie ✅ | ✅/⬜ |
| **12 Terminology** | begrippenlijst | zie terminologiebrug §2 | — |

**Kern-observatie op de store-taxonomie:** ons ontwerp valt niet netjes in S1–S5, omdat we de
formele-tijdstempels *niet in de datarij* zetten maar in het journaal (afgeleide `opvoer`/`afvoer`).
Daarmee zitten we feitelijk al in hun **Account**-model uit hoofdstuk 4, terwijl we op de materiële
as de interval-vorm (S4) aanhouden. Dit is het waard om expliciet met de werkgroep te bevestigen,
want op het eerste gezicht oogt onze vorm afwijkend van de S1–S5-indeling.

---

## 4. Waar wij zitten in S1–S5 (en waarom dat gunstig is)

- **Materiële as = interval-gebaseerd (S4).** We bewaren zowel `aanvang` (`_Aanvang`) als `einde`
  (`_Einde`), elk als aparte, geversioneerde GE's op hub-niveau. Een open `einde` = nog geldig.
  Daarmee vermijden we de door UBB genoemde S5-tekortkomingen:
  - Date's *"still only semitemporal"* (een enkele "since"-stempel kan geen einde vastleggen) —
    wij hebben een expliciet einde.
  - Böhlen's merge-probleem (twee gelijke aangrenzende periodes vallen samen) — wij houden ze
    apart via hub-identiteit (`rel_id`) en expliciete `_Einde`.
  - Snodgrass' *nonsequenced constraint* (gap-vrije tijdlijn afdwingen) — niet nodig; wij staan
    gaten toe (bv. de emigratie-episode uit hun voorbeeld).
- **Formele as = journaal-afgeleid.** `opvoer`/`afvoer` worden afgeleid uit `wijziging` +
  `registratie`. Correcties zijn nieuwe versies (afvoer oud + opvoer nieuw); de audittrail blijft
  intact. Dit is precies de *"account"*-discipline die UBB in hoofdstuk 4 als groeistap voorstelt.

**Aandachtspunt (append-only-discipline).** UBB stelt scherp: het journaal wijzigt nóóit, en de
store heeft één gecontroleerde schrijfactie — het zetten van `system_until` (H4.6). Onze
**ongedaanmaking** zet echter `opvoer`/`afvoer` terug op `NULL` op het record (het journaal blijft,
gemarkeerd `is_ongedaan_gemaakt`). Dat is functioneel correct, maar conceptueel dichter bij
"nooit gebeurd" dan bij UBB's *withdraw* (soft delete die zichtbaar blijft voor herhaalbare vragen).
Het is de moeite waard dit met de werkgroep te leggen naast hun operatie-vocabulaire (§6): willen we
ongedaanmaking modelleren als een *nieuw* effect, of als het nullen van afgeleide velden?

---

## 5. Twijfel als vierde commandosoort — ja, met nuance

**Vraag:** past *doubt* (H6) als speciaal commando, parallel aan correctie en ongedaanmaking?

**Antwoord: ja — dat is een goede eerste snit, en het model nodigt er zelfs toe uit.** Onze
`RegistratietypeEnum` is nu exact `{registratie, correctie, ongedaanmaking}`. Een vierde waarde
`betwijfeling` (open onderzoek) — met een tegenhanger voor afronding — sluit naadloos aan. Twee
belangrijke verfijningen:

> **Verfijnd besluit (2026-07-13):** betwijfeling wordt gemodelleerd als een eigen **`Annotatie`**
> (parallel aan `Wijziging`, met een aparte tabel), gedragen door een registratie van het nieuwe
> type `betwijfeling`. Zie het uitgewerkte plan: `../ontwerp-annotatie-betwijfeling.md`
> (status: plan — wacht op een backend-revisie die eerst naar `main` gemerget moet worden).

### 5.1 Twijfel is een annotatie, geen mutatie

Correctie en ongedaanmaking *veranderen de geldende waarde*. Twijfel doet dat níét: de waarde
**blijft staan**, maar krijgt een markering "onder onderzoek". Pas de *afronding* van het onderzoek
leidt tot een echte mutatie — en dat is dan gewoon een **correctie** (of een "twijfel ongegrond"/
opheffing die niets aan de data verandert). Zie het uitgewerkte model in
`../ontwerp-annotatie-betwijfeling.md`: een registratie van type `betwijfeling` draagt één of meer
`Annotatie`-kinderen (type `twijfel`) die naar de betwijfelde representatie(s) wijzen zonder ze te
muteren. Afronding: onterecht → `ongedaanmaking`; terecht → opvolgende `correctie` die *naar
aanleiding van* de betwijfeling is gedaan (aparte trigger-relatie, niet `corrigeert`).

Dit is dus *parallel aan* correctie/ongedaanmaking qua plek in het commandomodel, maar *asymmetrisch*
qua effect: het produceert geen nieuwe standing record, maar een status op een bestaande.

### 5.2 Onze granulariteit lost hun moeilijkste puzzel grotendeels op

UBB benoemt als hardste probleem (H6.1, stappen 2–3): *"het kan lastig zijn te achterhalen welk
effect — of welke combinatie — verantwoordelijk is voor wat de consument zag"*, waardoor je "de
projectie moet markeren buiten de effecten om". **Bij ons is dat grotendeels opgelost:** het
`wijziging`-journaal koppelt elk atoom (`entiteitnaam`/`entiteit_id`/`representatienaam`/
`representatie_id`/`versie`) al aan zijn `registratie`. De weg van "betwijfeld gegeven" → "de
registratie(s)/wijziging(en) die het schreven" is een directe query, geen reconstructie. Dat is een
concreet voordeel van onze extreme normalisatie dat we in de werkgroep mogen inbrengen.

Wat resteert is de koppeling *projectie → store* zodra we echte projections krijgen (§7); zolang de
`full_*`-views rechtstreeks de store lezen, is er geen tussenlaag om kwijt te raken.

### 5.3 Conversational impact (UBB H8.1.2)

UBB koppelt twijfel aan regel-severity: een regel die data gebruikte die *onder onderzoek* staat,
moet in ernst omlaag (een harde regel wordt overrulebaar; de ambtenaar beslist). Dat past op onze
validatie-/afgeleide-velden-laag: als een markering "onder onderzoek" op een atoom staat, kan de
regelevaluatie dat meewegen. Dit vraagt een terugkoppelkanaal (geen enkelvoudig commando maar een
back-and-forth) — zie het API-voorstel §8, "conversational".

---

## 6. Operatie-vocabulaire (UBB H7) gemapt op v06

| UBB-operatie | Betekenis | v06-equivalent |
|--------------|-----------|----------------|
| **Create**   | eerste registratie | `opvoer` (registratie) |
| **Change**   | de wereld verandert: oud eindigt, nieuw begint | `opvoer` nieuw GE/hub + afvoer oud (echte wijziging = nieuwe hub) |
| **Correct**  | het register had het mis: geloof vervangen | `correctie` (afvoer oude versie + opvoer nieuwe `_Data`-versie) |
| **End**      | waarde houdt op te gelden | `afvoer` / materieel via `_Einde` |
| **Reinstate**| foute beëindiging ongedaan | `ongedaanmaking` van de afvoer (ont-afvoer) |
| **Revive**   | echte terugkeer na echt einde (modelkeuze) | nog niet expliciet onderscheiden van Reinstate |
| **Withdraw** | soft delete (blijft zichtbaar voor herhaalbare vraag) | deels: afvoer/ongedaanmaking — semantiek "blijft zichtbaar" nog te beleggen |
| **Erase**    | hard delete (uitzondering) | niet geïmplementeerd (bewust) |

Aandachtspunten voor de werkgroep: (a) **Reinstate vs. Revive** onderscheiden wij nog niet; (b)
**Withdraw vs. Erase** — UBB's soft-delete-die-zichtbaar-blijft (t.b.v. herhaalbare vragen met token,
H8.2.1) verschilt van onze ongedaanmaking-die-nulled. Beide punten raken de append-only-discipline
uit §4.

---

## 7. Provenance en projections — het groeipad dat wij (deels) al lopen

UBB's *lineage* (H5): een effect draagt twee koppelingen — naar het **command** (intentie) en naar
de **processor met exacte versie** (welk algoritme, welke code). Daarachter: zaak, artefacten (DMS),
en geversioneerde wet/beleid. Hun transitie (H5.4): (1) documentverwijzingen → (2) documenten
verplichten → (3) *grounding* van de staat scheiden van de laatste operatie → (4) over naar effecten.

Waar wij staan:

- ✅ **Stap 1 (begin):** `registratie.bron` + `registratie.bron_kenmerk` (bv. Operaton
  process-instance-id) geven een lichte herkomst.
- ⬜ **Processorversie:** we koppelen nog niet naar de exacte versie van de codegen/regel-/
  afleidingslogica die een waarde produceerde. Dit is een reële uitbreiding en sluit aan op onze
  `SchemaVersie`/schemadiff-infrastructuur (we kennen modelversies al).
- ⬜ **Zaak/brondocument/wet:** geen koppeling naar DMS-artefacten of naar `wetten.overheid.nl`
  op peildatum. UBB's H5.3 (de dubbele *grounding* bij een reinstate — zowel "waarom deze waarde"
  als "wat raakte hem laatst") is precies wat ons journaal met een extra effect-koppeling zou kunnen
  dragen.
- 🟡 **Projections (H4.4):** onze `full_*` (REST `/full/{padnaam}/:id`, GraphQL `full_<padnaam>`)
  leveren gedenormaliseerde, geneste antwoorden — maar ze **lezen de store rechtstreeks** en zijn
  niet-persistent. UBB's argument voor *persistente* projections is de **repeatable question**:
  een antwoord van jaren geleden moet je later exact kunnen reproduceren, ook als de afleidcode
  intussen veranderde. Ons `?t=` (formeel tijdreizen) geeft reproduceerbaarheid van de *store*, maar
  niet van *afgeleide* velden als de afleidlogica wijzigt. Dit is de sterkste reden om op termijn
  echte projection-stores te overwegen.

---

## 8. API-voorstel — ons ontwerp op het skelet van UBB H8

UBB H8 is een stub met een lijst potentiële onderwerpen. Hieronder presenteren we **ons bestaande
patroon** als concreet voorstel, gemapt op hun indeling. Statuslabels: ✅ werkend · 🟡 ontwerp ·
⬜ voorstel/nieuw.

### 8.0 Uitgangspunt: één schrijf-endpoint, journaal-gedreven

Alle schrijfacties lopen via één registratie-endpoint met een uniforme envelop:

```jsonc
POST /registratie/
{
  "registratie": {
    "registratietype": "registratie",      // | correctie | ongedaanmaking | betwijfeling
    "bron": "operaton",
    "bron_kenmerk": "pi-8f3c…",
    "opmerking": "…",
    "corrigeert_registratie_id": null,       // bij correctie
    "maakt_ongedaan_registratie_id": null    // bij ongedaanmaking
  },
  "wijzigingen": [
    { "opvoer": { "naam": { "natuurlijk_persoon_id": 5, "achternaam": "McMillan" } } },
    { "afvoer": { "naam": { "natuurlijk_persoon_id": 5, "rel_id": 1 } } }
  ]
}
```

De hele registratie is **één DB-transactie** (BEGIN…COMMIT) — dus per definitie één *business
transaction* (voldoet aan UBB H8.1.3: correcties als één ondeelbare operatie in verwerking én
publicatie). GraphQL-equivalenten: mutations `registreer` / `corrigeer` / `maak_ongedaan`. ✅

### 8.1 Commands

- **8.1.1 Functional APIs** 🟡 — *Nu* bieden wij de **low-level** laag: opvoer/afvoer per
  representatie. Dat is precies UBB's uitweg uit H8.1.3 ("*offer direct access to bitemporal
  operations, only within a correction wrapper*"). *Voorstel:* een **business-function-laag**
  erbovenop (bv. `registreer_geboorte`, `corrigeer_adres`) die intern decomponeert naar wijzigingen.
  Provenance (H5) hangen we aan de registratie; per-subsectie afwijkende herkomst/ingangsdatum
  (UBB's "complexe commando's met subsecties") past op onze `wijzigingen[]`-structuur — elk element
  kan een eigen materiële `aanvang` en in de toekomst een eigen bron dragen.
- **8.1.2 Conversational APIs — impact van twijfel** ⬜ — nieuw `registratietype: "betwijfeling"`
  met `Annotatie`-kinderen (§5) plus een terugkoppelkanaal: het register meldt "regel X gebruikte
  data onder onderzoek → severity verlaagd"; de ambtenaar beslist over overrulen. Dit is een dialoog,
  geen enkel commando.
- **8.1.3 Business transactions — impact van correcties** ✅ (fundament) — onze registratie ís al de
  atomische transactie. Omdat we niet álle correcties vooraf kunnen kennen (UBB's punt), is onze
  low-level opvoer/afvoer-primitiven-set binnen een `correctie`-wrapper de generieke achterdeur.
- **8.1.4 Dry-run APIs** ⬜ — *voorstel:* `POST /registratie/?dryrun=true` dat de wijzigingen in een
  transactie uitvoert, de **resulterende projectie** teruggeeft, en dan rollbackt. Dit realiseert
  UBB's "langzaam een correctie opbouwen en zien hoe hij uitpakt" en is tevens conversational.
- **8.1.5 Bitemporal operations** ✅ — wij bieden de primitieven al; zie de mapping in §6.

### 8.2 Publication

- **8.2.1 Repeatable question** 🟡 — `?t=<ISO-8601>` geeft formeel tijdreizen en dus herhaalbaarheid
  van de store-toestand. **Gat:** het concurrency-/consistentiepunt (UBB: "vind het meest recente
  moment zonder actieve schrijvers", en geef een **token** terug i.p.v. het kale tijdstip — dat lost
  meteen een autorisatie-/soft-delete-vraag op). Dit hebben wij nog niet; sterke kandidaat voor de
  backlog en een mooi werkgroep-onderwerp (raakt hun H11 "concurrency and time").
- **8.2.2 Information products** 🟡 — onze dynamische GraphQL-laag + `full_*` leveren
  gedenormaliseerde producten. Volgende stap: projections *als aparte stores* (§7) i.p.v. de store
  direct exposen.
- **8.2.3 Notifications** ⬜ — UBB: notificaties zijn óók projections (autorisatiegevoelig: niet
  iedereen mag over een adoptie worden geïnformeerd, wél over een gewijzigde achternaam). Sluit aan
  op ons PBAC-ontwerp (`autoriseren/autoriseren.md`) en op Trusted Documents (`docs/trusted-documents.md`)
  als PEP-laag.

---

## 9. Overige observaties

1. **We zijn hun doelarchitectuur al deels.** De move van "systeemtijd in de rij" naar "journaal van
   effecten + afgeleide staat" (H4) is bij ons de kern, niet een groeistap. Goede boodschap voor de
   werkgroep; tegelijk goed om onze afwijkende plek in S1–S5 expliciet te duiden (§3/§4).
2. **"Availability is geen derde as" (H4.6)** bevestigt onze tweeassige keuze, en hun stelling *"één
   systeem z'n systeemtijd is het volgende z'n data"* onderbouwt precies onze ambitie om **over
   registers heen te tijdreizen** (mits gedeelde architectuur — zie copilot-instructions).
3. **Granulariteit "tussen BCNF en 6NF" (H9)** is bij ons een *instelbare* eigenschap: Hub+_Data kan
   fijn (één atoom per GE) of grover (meerdere velden per `_Data`). UBB koppelt provenance-precisie
   aan die granulariteit (H5.1, fig. 6.2) — wij kunnen dat per GE afwegen. Sterk verkooppunt.
4. **Multi-vendor client-risico (H4.2, GBA→BRP-conversie).** UBB waarschuwt dat low-level/CRUD-clients
   leverancier-specifieke patronen in de historische tabellen laten lekken. Onze huidige API is nog
   low-level; dit is een argument vóór de business-function-laag uit §8.1.1.
5. **Concreet voorstel: implementeer hun *worked example* (Trillian/Arthur, e1–e20) als testfixture.**
   Het is een rijk, gedeeld scenario (foundling, adoptie, emigratie-vergissing met gat, huwelijk +
   nietigverklaring, geslachtswijziging met terugwerkende naamlezing, retroactieve adrescorrectie op
   twee assen, brondocument dat een verklaring vervangt, overlijden). Als onze store dit één-op-één
   kan reproduceren, hebben we een krachtig bewijs van dekking én een gedeelde taal met de werkgroep.
   Let met name op e13 ("lees de records alsof ik altijd Arthur was") — dat is een niet-triviale
   projectie-keuze die ons materiële-tijd + afgeleide-velden-model op de proef stelt.
6. **e18 (retroactieve adrescorrectie op twee assen)** is precies waar onze scheiding van
   `_Aanvang`/`_Einde` van `_Data` glanst: aanvang corrigeren (T40→T35) én adres corrigeren (a4→a5)
   zonder de latere verhuizing (a6, T130) te raken — twee onafhankelijke lijnen. Goede casus om in de
   vergelijking `bitemporele-registers-vergelijking-v0.1.md` op te nemen.

---

## 10. Aanbevolen vervolgstappen

| # | Actie | Type |
|---|-------|------|
| 1 | Trillian/Arthur-voorbeeld (e1–e20) als integratietest/seed implementeren | bouw |
| 2 | `Annotatie` + `registratietype: "betwijfeling"` (zie `../ontwerp-annotatie-betwijfeling.md`) | ontwerp/bouw |
| 3 | Provenance uitbreiden: processor-/schemaversie-koppeling aan wijziging (§7) | ontwerp |
| 4 | Repeatable question: consistentiepunt + token (§8.2.1) op de backlog | onderzoek |
| 5 | Business-function-commandolaag boven de primitieven (§8.1.1) | ontwerp |
| 6 | Onze S1–S5-positionering + append-only-discipline in de werkgroep beleggen (§4) | afstemming |
| 7 | Dry-run-endpoint (`?dryrun=true`) (§8.1.4) | voorstel |

---

*Zie ook:* `../ontwerp-annotatie-betwijfeling.md` (Annotatie/betwijfeling-plan),
`../bitemporele-registers-vergelijking-v0.1.md` (genormaliseerd vs. één-tabel),
`../registratie-patronen.md` (sequence diagrams van de registratie-API),
`../trusted-documents.md` (PEP-laag voor mutations), `../autoriseren/autoriseren.md` (PBAC).
