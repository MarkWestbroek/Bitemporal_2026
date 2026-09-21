# Ontwerp — Annotatie & Betwijfeling

> Datum: 2026-07-13
> Status: **PLAN — nog niet implementeren.** Wacht op een lopende backend-revisie die eerst
> getest en naar `main` gemerget moet worden. Dit document beschrijft het afgesproken ontwerp
> zodat we het daarna kunnen uitvoeren.
> Context: voortgekomen uit `docs/extern/analyse-ubb-bitemporal-stores-v0.1.md` (§5), n.a.v. de
> UBB-notitie "Bitemporal Stores v0.1", hoofdstuk 6 (*Doubt*). Model geschetst in Omnium Studio.

---

## 1. Kern van het besluit

**Betwijfeling (twijfel/onderzoek van een gegeven) is een annotatie, geen mutatie.** Een correctie
of ongedaanmaking verándert de geldende waarde; een betwijfeling láát de waarde staan en hangt er
een markering "onder onderzoek" aan. Daarom modelleren we het als een **`Annotatie`** — parallel aan
`Wijziging`, niet als een variant ervan.

Twee toevoegingen aan het datamodel:

1. **Nieuwe entiteit + tabel `Annotatie`**, als tweede soort kind onder de compositie van
   `Registratie` (naast `Wijziging`). Een annotatie wijst — net als een wijziging — naar een
   `Representatie`, maar muteert die niet.
2. **Nieuw `Registratietype`: `betwijfeling`** (naast `registratie`, `correctie`, `ongedaanmaking`).

```
Registratie ◆── Wijziging   ──▶ {Representatie}     (muteert: opvoer/afvoer)
            ◆── Annotatie   ──▶ {Representatie}     (annoteert: bv. twijfel)

Registratietype  : registratie | correctie | ongedaanmaking | betwijfeling   (+betwijfeling)
Wijzigingstype   : opvoer | afvoer                                            (ongewijzigd)
Annotatietype    : twijfel                                                    (nieuw, uitbreidbaar)
```

![Studio-schets: Annotatie parallel aan Wijziging onder de compositie van Registratie; Annotatietype `twijfel`, Registratietype `betwijfeling`, met Werkmap/Werkstap als drager van het onderzoek](Registratie-Wijziging-Annotatie.png)

*Schets in Omnium Studio: `Annotatie` hangt (net als `Wijziging`) onder de compositie van
`Registratie` en wijst naar een `{Representatie}`. Rechts draagt een `Werkstap` (onder een
`Werkmap`) de registratie — óók het onderzoek waarin de betwijfeling wordt onderzocht (zie §4).*

---

## 2. Datamodel

### 2.1 `Annotatie` (nieuwe plumbing-struct, handmatig — zoals `Wijziging`)

Spiegelt het adresseringsschema van `Wijziging` (entiteit + representatie + optionele versie), zodat
een annotatie exact één atoom kan aanwijzen.

| Veld | Type | Betekenis |
|------|------|-----------|
| `id` | int64 pk autoincrement | |
| `registratie_id` | int64 FK → registratie | de registratie waaronder deze annotatie valt |
| `annotatietype` | enum (`twijfel`) | soort annotatie; uitbreidbaar |
| `entiteitnaam` | string | type-naam van de (eventuele) bovenliggende entiteit |
| `entiteit_id` | string | ID van de entiteit |
| `representatienaam` | string | type-naam van de geannoteerde representatie |
| `representatie_id` | string | ID van de representatie |
| `versie` | *int64 (nullable) | versie bij data/aanvang/einde-representaties |
| `tijdstip` | time.Time | afgeleid van `registratie.tijdstip` |
| `is_ongedaangemaakt` | bool | afgeleid; true als de betwijfeling-registratie ongedaan is gemaakt |

**Bewust géén vrije-tekst-veld voor de reden.** UBB (H6.2/H6.3) waarschuwt: juristen willen geen vrij
tekstveld in het register (risico op onbedoeld "tainted" taalgebruik). De prozale beschrijving van
het onderzoek leeft in de **`Werkstap`/`Werkmap`** (het onderzoek als zaak, zie §4), buiten de
registerrijen. De annotatie zelf is puur *pointer + type*.

### 2.2 `Registratie` — nieuw registratietype en (mogelijk) een nieuwe relatie

- `Registratietype` krijgt de waarde `betwijfeling`.
- **Invariant:** een registratie van type `betwijfeling` bevat één of meer `Annotatie`-kinderen en
  **geen** `Wijziging`-kinderen (ze muteert niets). Een gewone registratie mág daarnaast annotaties
  dragen (bv. tegelijk iets opvoeren én iets anders betwijfelen) — dit houden we flexibel maar de
  standaard-betwijfeling is annotatie-only.
- **Bestaande registratie→registratie-relaties** (`corrigeert_registratie_id`,
  `maakt_ongedaan_registratie_id`) blijven en worden hergebruikt/uitgebreid — zie §3.

---

## 3. Levenscyclus van een betwijfeling

### 3.1 Openen — `betwijfeling`

Een registratie van type `betwijfeling` (typisch "gedaan" door een `Werkstap` die het onderzoek is)
plaatst een `Annotatie` van type `twijfel` op de betwijfelde representatie(s). De waarde blijft
staan; consumenten kunnen de markering zien (§5).

### 3.2 Onterecht — `ongedaanmaking`

Blijkt de twijfel ongegrond, dan wordt de betwijfeling **ongedaan gemaakt**: een registratie van type
`ongedaanmaking` met `maakt_ongedaan_registratie_id` → de betwijfeling-registratie. Dit zet
`is_ongedaangemaakt = true` op de bijbehorende annotatie(s) en heft de markering op.

> Implementatie: de bestaande ongedaanmaking-logica itereert nu over `wijzigingen`. Die moet worden
> uitgebreid om óók `annotaties` op te heffen ("ont-annoteren"). Analoog aan `handleRepresentatieOnt…`.

### 3.3 Terecht — opvolgende `correctie`

Blijkt de twijfel gegrond, dan volgt een **correctie** van de oorspronkelijke data. Deze correctie
verwijst naar de betwijfeling — maar let op de semantiek:

- De correctie corrigeert de **oorspronkelijke data-registratie** (dat gaat via de normale
  `corrigeert_registratie_id`, wijzend naar de registratie die het feit opvoerde).
- De correctie is **naar aanleiding van** de betwijfeling — níét een correctie *ván* de betwijfeling
  (die kan niet gecorrigeerd worden, want ze wijzigt niets).

**Open ontwerppunt (aanbeveling):** voeg hiervoor een **aparte nullable FK** toe op `Registratie`,
bv. `naar_aanleiding_van_registratie_id` (of `volgt_op_betwijfeling_id`). Zo blijft
`corrigeert_registratie_id` schoon voor "welke data-registratie wordt gecorrigeerd", en drukken we
apart de trigger-relatie uit. Alternatief zou zijn `corrigeert_registratie_id` te overladen, maar dat
vertroebelt de semantiek en raden we af.

### 3.4 Status van de annotatie na afhandeling

Na een terechte correctie is de betwijfelde representatie/versie afgevoerd; de annotatie wees naar
een niet-langer-staande versie en is daarmee **historisch afgesloten**. We hoeven de "actief"-status
van een annotatie daarom niet apart op te slaan: hij is **afgeleid** uit
(a) betwijfeling niet ongedaan gemaakt, én (b) doel-representatie staat nog. Dit sluit aan op onze
filosofie dat `opvoer`/`afvoer` ook afgeleid zijn. Voor snelle bevraging kan optioneel een afgeleide
`afgehandeld_door_registratie_id` worden bijgehouden — te bepalen bij implementatie.

---

## 4. Werkmap / Werkstap (het onderzoek als zaak)

In het Studio-model hangt aan `Registratie` een `Werkstap` (die de registratie "doet"), en
`Werkstap` valt onder een `Werkmap` (compositie). Uit de notitie:

> "Een werkstap kan een stukje registratie uit een aanvraag zijn, maar ook het onderzoek waarin de
> betwijfeling wordt onderzocht."

Dit is de plek voor de **prozale onderzoeksinformatie** en de koppeling naar de capture-zijde
(UBB's *case*). Het houdt vrije tekst en onderzoekscontext **buiten** de bitemporele registerrijen.

**Scope-afbakening:** `Werkmap`/`Werkstap` is een breder concept dan alleen betwijfeling (het draagt
óók gewone registraties uit een aanvraag). Voor de betwijfeling-MVP is strikt nodig: `Annotatie` +
`Annotatietype` + `Registratietype = betwijfeling` + de trigger-relatie. `Werkmap`/`Werkstap` kan als
eigen (parallel) spoor worden uitgewerkt; noteer of het in dezelfde iteratie meekomt of later.

---

## 5. Publicatie / frontend (afgeleid gedrag)

- **"Onder onderzoek"-markering:** de `full_*`-views (REST/GraphQL) exposen per representatie de
  actieve annotaties, zodat de frontend een badge "onder onderzoek" kan tonen. Dit is precies wat
  UBB (H6.1, stap 2) wil — en bij ons relatief eenvoudig, want het journaal koppelt annotatie aan
  atoom (geen projectie→effect-reconstructie nodig; zie analyse-doc §5.2).
- **Tijdlijn:** betwijfeling-registraties verschijnen in de registratie-tijdlijn naast
  registratie/correctie/ongedaanmaking.
- **Regel-severity (UBB H8.1.2):** een afgeleid veld / validatieregel die een atoom met actieve
  `twijfel`-annotatie gebruikt, kan zijn ernst verlagen (harde regel → overrulebaar). Toekomstig;
  raakt de validatie-/afgeleide-velden-laag.
- **Autorisatie:** annotaties kunnen autorisatiegevoelig zijn (wie mag zien dát er onderzoek loopt?).
  Sluit aan op `autoriseren/autoriseren.md` (PBAC) en de Trusted-Documents-PEP-laag.

---

## 6. Raakpunten in de code (checklist voor de uitvoering — NA de merge)

| Laag | Bestand(en) | Wijziging |
|------|-------------|-----------|
| Model (plumbing) | `model/model_plumbing.go` | `Annotatie`-struct + `AnnotatietypeEnum` (`twijfel`); `RegistratietypeBetwijfeling`; nullable FK `naar_aanleiding_van_registratie_id` op `Registratie`; `Registratie.Annotaties []Annotatie` (has-many) |
| DB | `dbsetup/createtables.go` | tabel `annotatie` aanmaken |
| Envelop/parsing | `model/REST request models.go` | `annotaties[]` naast `wijzigingen[]` in de registratie-envelop |
| Handler | `handlers/registration_handlers.go` | type `betwijfeling` afhandelen; annotaties persisteren; validatie-invariant (§2.2); ongedaanmaking uitbreiden naar annotaties |
| Handler-helpers | `handlers/registration_helpers_generiek.go` | `handleAnnotatie…` + `handleAnnotatieOntdoen` (analoog aan opvoer/ont-opvoer) |
| GraphQL | `dynql/` | mutation (bv. `betwijfel`, of `registreer` met type); annotaties exposen op `full_*` |
| Frontend | `web/vite/` | badge "onder onderzoek"; betwijfeling in tijdlijn |
| Docs | dit bestand + `registratie-patronen.md` | sequence diagram "betwijfeling" + "ongedaanmaking betwijfeling"; `.github/copilot-instructions.md` registratietype-lijst bijwerken |

---

## 7. Validatie tegen de Trillian/Arthur-casus (UBB)

De casus bevat twee volledige onderzoekssporen — ideaal als acceptatietest:

- **Huwelijk (e9–e11):** e9 rapport → e10 onderzoek geopend (**betwijfeling** op het huwelijk/de
  partnerschap) → e11 onderzoek afgerond, huwelijk nietig verklaard (**correctie naar aanleiding van**
  de betwijfeling; Trillian behoudt te goeder trouw de effecten, Zaphod niet).
- **Adres (e16–e18):** e16 rapport → e17 onderzoek geopend (**betwijfeling** op het adres a4) → e18
  onderzoek afgerond, retroactieve correctie (a4→a5, aanvang T40→T35) zonder de latere verhuizing
  naar a6 te raken (**correctie naar aanleiding van** de betwijfeling).

Als deze twee sporen één-op-één door het model lopen (betwijfeling → ongedaanmaking óf
correctie-naar-aanleiding-van), is het ontwerp gedekt.

---

## 8. Openstaande beslissingen (voor de uitvoeringssessie)

1. Naam van de trigger-relatie: `naar_aanleiding_van_registratie_id` vs. `volgt_op_betwijfeling_id`.
2. Annotatie-activiteit puur afleiden, of een afgeleide `afgehandeld_door_registratie_id` bijhouden?
3. Komt `Werkmap`/`Werkstap` in dezelfde iteratie mee, of als apart spoor?
4. GraphQL: aparte mutation `betwijfel` of hergebruik `registreer` met `registratietype`?
5. Mag een gewone (niet-betwijfeling) registratie annotaties dragen, of houden we betwijfeling
   annotatie-only? (Voorstel: flexibel toestaan, standaard annotatie-only.)
