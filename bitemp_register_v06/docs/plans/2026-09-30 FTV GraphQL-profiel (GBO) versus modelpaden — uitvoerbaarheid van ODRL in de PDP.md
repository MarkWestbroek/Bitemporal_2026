# FTV GraphQL-profiel (GBO) versus modelpaden — uitvoerbaarheid van ODRL in de PDP

**Datum:** 2026-09-30
**Status:** analyse (Claude-sessie), geen code gewijzigd; wel een reproduceerbare OPA-meting
**Bouwt op:** `docs/plans/ODRL-Register-Toegangsbeleid.md` (registerpad als Asset),
`docs/TOEGANGSSPRAAK.md`, `docs/plans/2026-08-18 ODRL 3.0 — W3C-workshop …`,
`docs/trusted-documents.md`, `authz/README.md` (OpenFTV-PDP, Rego)
**Aanleiding:** drie documenten van de werkgroep FTV / Programma GBO (Peter-Jan Karens):
- Intro GBO (slides, 2026-09-29) — `https://vng-realisatie.github.io/ftv/documents/20260929-intro-gbo.pdf`
- AuthZEN & GraphQL (slides, 2026-09-29) — `…/20260929-authzen-graphql.pdf`
- FTV GraphQL-profiel draft-01 (2026-09-28) — `…/20260928-ftv-graphql-profile.html`

Drie vragen stonden centraal:

1. Hoe verhoudt het GBO-voorstel (query platslaan tot veldrecords) zich tot ons idee
   (elk modelelement heeft een pad `ENT.GE.veld`; het beleid gebruikt dat pad)?
2. Hoe goed en snel is ODRL uit te voeren in een PDP, met name tegen een API — en is
   GraphQL daarbij ingewikkelder dan REST?
3. Kan ODRL omgaan met de nesting van GraphQL?

Kort antwoord: **de voorstellen zijn complementair, niet concurrerend.** GBO beschrijft het
*transport* (hoe een GraphQL-query een AuthZEN-request wordt); ons registerpad is de
*beleidslaag* (waarover een regel gaat). De GBO-veldsleutel `ParentType.field` is een
projectie van ons registerpad, en omdat ons GraphQL-schema uit het model wordt
gegenereerd is die projectie mechanisch. ODRL is **niet** rechtstreeks snel genoeg als
runtime-PDP, maar **gecompileerd naar Rego** wel (gemeten: ± 17 µs per veldrecord).
ODRL kent geen query-nesting en hoeft dat ook niet te kennen: modelnesting zit in
`partOf`, en de GBO-mapper vlakt de query-nesting al af.

---

## 1. Wat GBO precies voorstelt

De intro-slides gaan over het programma (één gestandaardiseerde bronontsluiting voor
EDI-wallet, OOTS en DvTP; bronhouder houdt regie; globaal ontwerp op
`https://ictu.github.io/GBO-GO/latest/`). Het autorisatie-inhoudelijke deel zit in het
GraphQL-profiel. De kern, feitelijk:

| Onderdeel | Voorstel |
|---|---|
| Plaats van de PDP | *Vóór* het endpoint: een standaard-PEP vraagt één beslissing per HTTP-request. Resolver-niveau en federatie zijn expliciet buiten scope (§1.1). |
| Mapper | Draait bij/in de PDP. Parseert de query met het **SDL uit de policybundel** (nooit live introspectie), valideert, en voegt een platte lijst `resource.properties.graphql.fields[]` toe. |
| Veldrecord | `{ path: ["persoon","adres","plaats"], parentType: "Adres", field: "plaats", leaf: true, args: {…, origin: literal\|variable\|schema-default}, on: … }` |
| Bindingssleutel | **`parentType.field`** (bv. `Adres.plaats`). `path` is alleen weergave/log en mag *niet* voor binding worden gebruikt, want de afnemer bepaalt aliassen (§8.3). |
| Regelmodel (informatief) | `{ rule_id, covers_fields: ["Query.persoon", …], covers_types: ["Adres"], conditions: engine-specifiek }`. Bladvelden zonder argumenten erven via `covers_types`; objectvelden, root-velden en velden met argumenten erven nooit. |
| Besluit | Gesloten wereld (veld zonder regel = deny), elk record apart beoordeeld, **AND** over alle records, alles-of-niets. Geen partiële resultaten (§15.2). |
| Argumenten | Conditie leest `field.args`; waarde uit een schema-default → deny (schema drift). |
| Transport | Alleen POST + `application/json` op één pad; **geen persisted documents / `documentId`**, geen batching, geen `@defer`. Mutaties en subscriptions → deny. |
| Engine | Vrij. Rego-voorbeeld meegeleverd; Cedar/OpenFGA hebben engine-specifieke lus-code nodig (§15.6). ODRL komt nergens voor. |

**Nuance op de samenvatting "Rego kan niet met nesting omgaan".** Dat staat er niet
letterlijk. §3.1 zegt: alleen OPA heeft GraphQL-builtins, de Rego-AST heeft **geen
type-informatie** (`{Alias, Name, Arguments, SelectionSet}`), en om het parenttype van een
genest veld te vinden moet je het schema langs het querypad "vouwen"; Rego kent geen
recursie, dus dat wordt één regel per diepteniveau. Rego kan geneste *data* prima aan
(`walk()`), het probleem is **typeresolutie zonder schema**. De mapper lost precies dát op
door het schema aan de PDP-kant te leggen. Dat is een sterk argument en het komt ons goed
uit (§3).

## 2. Ons ontwerp, en waar het schuurt

Wij hebben (ODRL-plan §4, `odrl.js`): het **registerpad** als Asset-identiteit —
`nlgov:register:brp/NatuurlijkPersoon.Naam.roepnaam` met `partOf` naar
`…/NatuurlijkPersoon.Naam` — en `nlgov:registerpad` als leftOperand. Toegangsspraak
resolvet "de achternaam van de naam van de betrokkene" via het metamodel naar dat pad.
Runtime hebben we een OpenFTV-PDP met handgeschreven Rego (`authz/`), en de
**vertaallaag ODRL → runtime** staat als open gap (prio hoog) in het ODRL-plan.

### 2.1 Type-lokaal (GBO) versus pad-globaal (wij)

| | GBO-sleutel `ParentType.field` | Registerpad `ENT.GE.veld` |
|---|---|---|
| Context | Context-vrij: `Locatie.plaats` geldt overal waar `Locatie` voorkomt | Context-gebonden: `NatuurlijkPersoon.woonlocatie.plaats` ≠ `Organisatie.vestiging.plaats` |
| Bron van waarheid | GraphQL-SDL in de bundel | Het metamodel (MetaRegistry); SDL is een projectie |
| Overerving | Per type (`covers_types`) | Per pad-prefix (`partOf`) |
| Aliassen/fragmenten | Onzichtbaar (goed) | Onzichtbaar (goed): het pad is een schema-pad, geen response-pad |

Het GBO-model kan **niet** onderscheiden langs welk pad een type bereikt is. Voor ons is
dat wezenlijk: `Locatie` en `Naam` zijn gedeelde GE-typen/relatiedoelen, en het beleid
"de woonlocatie van een natuurlijk persoon" mag niet automatisch ook "de vestiging van een
organisatie" vrijgeven. §8.3 verbiedt binding op `path` terecht — maar dat gaat over het
**response-pad** (aliassen). Een **schema-pad** (de reeks veldsleutels van root tot veld,
`Query.persoon → Persoon.woonlocatie → Locatie.plaats`) wordt niet door de afnemer gekozen
en is dus een legitieme bindingssleutel. Het profiel levert die reeks nu niet als
eigenschap, maar hij is uit de records af te leiden (de voorouder-records staan in
`fields`, §8.4). Netter: een `typePath`-eigenschap in het veldrecord. **Dit is het
punt om in de werkgroep in te brengen** (§7).

### 2.2 De projectie is mechanisch — omdat ons schema uit het model komt

`dynql` bouwt het GraphQL-schema uit de MetaRegistry: GE-typen heten
`<Entiteit>_<Klassenaam>` (bv. `Gemeente_GemeenteGegevens`), veldnamen zijn de JSON-rolnamen
(`gemeentegegevens`, meervoud `organisatienamen`). `web/vite/src/publicatie/graphqlPaden.js`
doet de omgekeerde vertaling al (klassenaam → veldnaam met typesuffix-match). Een
registerpad valt dus deterministisch uiteen in GBO-veldsleutels:

```
NatuurlijkPersoon.Naam.roepnaam
  → Query.natuurlijk_personen            (root, erft nooit → eigen regel)
  → NatuurlijkPersoon.namen              (objectveld/edge, erft nooit → eigen regel)
  → NatuurlijkPersoon_Naam.roepnaam      (blad)
```

Omdat wij het model **én** het schema **én** de policies uit één bron genereren, kan de
CODEGEN-pijplijn de complete GBO-policybundel opleveren: het SDL (met digest), de
`covers_fields`/`covers_types`-tabellen én de schema-check (H3) — "model als generieke,
canonieke waarheid" wordt zo iets concreets in plaats van een abstractie.

## 3. Is ODRL uitvoerbaar in een PDP?

### 3.1 ODRL zelf heeft geen uitvoersemantiek

ODRL 2.2 is beschrijvend; een normatieve evaluatiesemantiek ontbreekt (dat is precies het
werk van FORCE/ODRL 3.0, zie ons workshop-verslag van 2026-08-18). Wie ODRL "uitvoert"
kiest dus altijd een interpretatie. Drie routes bestaan in de praktijk:

| Route | Voorbeelden | Snelheid | Geschikt als AuthZEN-PDP? |
|---|---|---|---|
| **A. Directe ODRL-evaluator** | SolidLab **ODRL-Evaluator** (Node, Notation3 + EYE-reasoner in WASM, compliance report); **ODRE**/pyodre (Python); ODRL Engine (Python) | ODRE gemeten: **33 ms** per evaluatie in-proces, **62 ms** via REST, "< 1 s" voor complexere policies; latency lineair met concurrency (CEUR OPAL 2025) | Beperkt: semantic-web-stack, geen PIP-model, geen AuthZEN-adapter, geen veld-fan-out. Wél waardevol voor **doorrekenen in de editor** (compliance report = *waarom*). |
| **B. Compileren naar een engine** | **ODRL-PAP** (FIWARE/DOME, Java): ODRL JSON-LD → Rego, geserveerd als OPA-bundles; `mapping.json` koppelt ODRL-klassen aan Rego-methoden; eigen profielen (DOME, Gaia-X, NGSI-LD) via extra mapping + Rego-packages | OPA: sub-milliseconde tot enkele ms (zie 3.2) | Ja — dit is het bewezen patroon en het sluit één-op-één aan op ons whitepaper-plaatje *beschrijvend register → vertaling → uitvoerend beleid* en op GBO's *PAP laadt bundel in PDP*. |
| **C. Hybride** | A in de editor (tab "Doorrekenen", plan 2026-08-18 §4.1), B in productie | — | Aanbevolen. |

**Advies: route B (met C voor de editor).** ODRL blijft ons *uitvoerformaat* van
Toegangsspraak en de *bron* voor de compiler; de PDP draait Rego. Dat is ook engine-neutraal
te houden: ODRL-PAP laat zien dat de vertaling grotendeels tabelgestuurd is.

### 3.2 Meting: GBO-referentiemodel in OPA

Reproduceerbaar experiment (OPA `latest` in Docker, `opa bench`, interpreter, geen WASM):
de vaste `ftv/graphql.rego` uit de slides, regels als **data** (540 regels: 60 entiteiten ×
8 GE's + 60 root-regels, met ODRL-achtige condities `{leftOperand, operator, rightOperand}`
op rol, doelbinding en `aanvraag:bsn` met origin-check), en een query van
20 entiteiten × 8 GE's × 6 velden = **1140 veldrecords**.

| Variant | 12 records | 1140 records | Per record |
|---|---|---|---|
| Naïef (`some id; key(f) in data.rules[id].covers_fields`) | 4,2 ms | **450 ms** | ± 0,4 ms |
| Geïndexeerd (`data.by_field[key]`, `data.by_type[type]` → regel-ids) | **0,5 ms** | **20 ms** | **± 17 µs** |
| Geïndexeerd, deny-pad (rol zonder rechten, 1120 geweigerd) | — | 17 ms | — |

Lessen:

- **De compiler moet indexeren.** De referentie-Rego van de slides itereert per record over
  alle regels (O(records × regels)); met een sleutel-index is de evaluatie lineair en
  ruim binnen budget, ook bij de profiel-limiet van 1000 records.
- Condities als **data-predicaten** (ODRL-triples) kosten niets extra; een handvol
  `cond(c, f)`-regels dekt de NLGov-leftOperands. Alleen `nlgov:bestaat:` (PIP) valt
  erbuiten en hoort onder `PIP_UNAVAILABLE`-semantiek.
- Niet gemeten maar vermoedelijk dominant: het **parsen en valideren** in de mapper
  (profiel-limiet 1 s validatietijd) en de HTTP-hop PEP → PDP. Rego is niet de bottleneck.

### 3.3 REST versus GraphQL

REST: één resource + één actie → één regel-lookup; de bestaande `authz/` Rego doet dat al.
GraphQL: N veldrecords → N lookups + AND, plus parse/validate per request. Kosten groeien
lineair met de query, niet met het beleid (mits geïndexeerd). GraphQL is dus **wel
ingewikkelder** (mapper, schema in de bundel, drift-check, argument-herkomst) maar niet
onbetaalbaar.

Grote versneller die het profiel nu uitsluit: **trusted documents**
(`docs/trusted-documents.md`). Bij een geregistreerd document is de veldlijst constant; de
beslissing hangt dan alleen af van `(documentId, variabelen, subject)`, is bij registratie
vooraf te berekenen en cachebaar, en parse/validate vervalt per request. Het profiel eist
juist dat de bron *geen* `documentId` accepteert (H1: byte-gelijke uitvoering). Beide zijn
te verenigen als de mapper de geregistreerde tekst uit de bundel haalt (zelfde vertrouwde
bron als het SDL). Punt voor de werkgroep.

## 4. Kan ODRL met GraphQL-nesting omgaan?

Twee soorten nesting, twee antwoorden.

**Modelnesting — ja, dat is precies `partOf`.** ODRL kent `Asset`, `AssetCollection` en
`partOf`; ons registerpad is die hiërarchie. Een regel op `…/NatuurlijkPersoon.Naam` dekt
via `partOf` `…/NatuurlijkPersoon.Naam.roepnaam`. Dat is GBO's `covers_types`-overerving,
maar **padgebonden** in plaats van typegebonden (§2.1). De GBO-uitzonderingen (root-velden,
objectvelden en velden met argumenten erven nooit) zijn een *profielkeuze* die de compiler
oplegt, geen ODRL-beperking.

**Querynesting — nee, en dat hoeft niet.** ODRL heeft geen begrip van selectiesets,
aliassen of fragmenten. De GBO-mapper vlakt de query af tot records; per record is er dan
één ODRL-vraag: *bestaat er een Permission (en geen Prohibition) met target = dit
registerpad of een voorouder, action = `nlgov:view`, assignee ⊇ subject, en zijn de
constraints waar?* AND over de records, `conflict: prohibit` = deny-overrides. Dat is
één-op-één de GBO-aggregatie (§8.5).

**Constraints per soort:**

| Toegangsspraak / ODRL | GBO-context | Uitvoerbaar vóór het endpoint? |
|---|---|---|
| rol, organisatie (`nlgov:rol`, PartyCollection-refinement) | `subject` | ja |
| doel, grondslag (`nlgov:doelbinding`) | `context` / `resource` | ja |
| argumenten (`nlgov:aanvraag:bsn`, `jaren`) | `field.args` incl. `origin` | ja; compiler voegt de schema-default-deny toe |
| existentie (`nlgov:bestaat:…`) | PIP | ja, met `PIP_UNAVAILABLE` |
| **veldwaarde** ("de achternaam … begint met A", `nlgov:veldwaarde:…`) | — | **nee**: de PDP beslist vóór de bron iets ophaalt. Vereist resolver-niveau (GBO-optie 2), een response-filter (§15.2, raakt H1) of een PIP-lookup. |

Die laatste rij is de belangrijkste bevinding voor Toegangsspraak: de taal laat
waarde-afhankelijke voorwaarden toe die een *vóór-het-endpoint*-PDP niet kan beslissen.
De editor kan dat markeren (de typebewaking kent de operand-soort al): "deze voorwaarde
wordt in de bron afgedwongen, niet aan de poort".

## 5. Voorstel: compilerpijplijn (fase 3 uit de whitepaper, nu concreet)

```
Toegangsspraak ──parser──▶ AST ──odrl.js──▶ ODRL JSON-LD (NLGov)
                                                 │
                              MetaRegistry ──────┤  compiler (codegen)
                                                 ▼
   policybundel = { schema.graphql (+ sha256-digest)                ← uit het model
                    data/rules.json  (rule_id, covers_fields,
                                      covers_types|covers_paths,
                                      conditions als ODRL-triples)  ← uit ODRL + model
                    data/by_field.json, by_type.json (index)        ← afgeleid
                    ftv/graphql.rego (vast, ± 40 regels)
                    nlgov/cond.rego  (vast: leftOperand-predicaten) }
                                                 │
                              OpenFTV Manager ──▶ PDP (AuthZEN) ◀── PEP vóór /graphql
```

- **Vast Rego** (engine-deel, éénmalig): binding + aggregatie + antwoord, plus de
  NLGov-leftOperands als predicaten. Geen domeinlogica.
- **Data** (per beleid, gegenereerd): regels en index. Een nieuwe regel = nieuwe data, geen
  nieuwe Rego. Dat is exact ODRL-PAP's model en GBO's "een nieuwe regel is een nieuw bestand
  in `rules/`".
- **Padgebonden overerving**: `covers_paths` naast `covers_types`; het vaste Rego leidt het
  schema-pad van een record af uit de voorouder-records (of uit `typePath` zodra het
  profiel dat kent).
- **Toetsbaarheid**: de FORCE/ODRL-Evaluator in de editor (route C) en dezelfde
  testvectoren (profiel Appendix A) tegen de gecompileerde bundel.

Reproduceren van de meting: de bestanden staan in de sessie-scratchpad
(`opabench/`: `graphql.rego`, `graphql_idx.rego`, generator voor `data.json`/`input.json`);
de essentie van het geïndexeerde deel:

```rego
allowed(f) if { some id in data.by_field[key(f)];       rule_allows(data.rules[id], f) }
allowed(f) if { f.leaf; not f.args; not key(f) in field_keys
                not f.parentType in root_types
                some id in data.by_type[f.parentType];   rule_allows(data.rules[id], f) }
rule_allows(r, f) if { every c in r.conditions { cond(c, f) } }
```

## 6. Wat GBO ons oplevert en wat wij GBO kunnen bieden

**Overnemen van GBO:** de mapper en het veldrecord (incl. `origin` van argumenten), SDL in
de bundel + digest + drift-check, gesloten wereld met AND-aggregatie, de foutcodes en het
403-antwoord in GraphQL-vorm, de transportbeperkingen. Dit vervangt eigen knutselwerk.

**Inbrengen bij GBO / de werkgroep:**

1. **Schema-pad als bindingssleutel** (`typePath` of `covers_paths`): nodig zodra typen
   worden hergebruikt via meerdere relaties — in elk canoniek model het geval.
2. **Het regelformaat is niet vrij genoeg**: het referentiemodel is een goed
   *compilatiedoel*, maar de *bron* hoort NLGov-ODRL te zijn (register, bitemporeel,
   klare taal), anders krijgt elke bron zijn eigen policy-dialect. ODRL-PAP is het
   bestaansbewijs.
3. **Trusted documents** toelaten als vertrouwde bron in de bundel (§3.3): goedkoper en
   veiliger dan vrije query's, en Imprint/Omnium gebruiken ze al.
4. **Veldwaarde-condities** expliciet buiten scope verklaren én verwijzen naar optie 2
   (resolvers) — anders denken beleidsauteurs dat "begint met A" aan de poort werkt.
5. **Model als bron van SDL én regels**: één codegen die schema, bundel en drift-check
   oplevert. Dat is de "generieke, canonieke waarheid" waar het GBO-voorstel omheen
   loopt.

## 7. Vervolgstappen (voorstel voor BACKLOG)

| # | Stap | Omvang |
|---|---|---|
| 1 | Reactie aan Peter-Jan / werkgroep met punten §6 (typePath, ODRL als bron, trusted documents, veldwaarde-condities) | klein |
| 2 | `odrl.js` → compiler-prototype: ODRL JSON-LD + schema-API → `rules.json` + index in GBO-referentievorm; registerpad → veldsleutels via de `dynql`-naamgeving (hergebruik `graphqlPaden.js`-logica in omgekeerde richting) | middel |
| 3 | Vaste `ftv/graphql.rego` + `nlgov/cond.rego` in `authz/manager/policies/`, testvectoren uit profiel Appendix A | middel |
| 4 | Mapper-keuze: de referentie-mapper van de werkgroep afwachten of een kleine Go-middleware vóór de OpenFTV-PDP (parse + validate met `graphql-go`, SDL uit de bundel) | middel/groot |
| 5 | Editor: markeer veldwaarde-condities als "afdwinging in de bron"; tab Doorrekenen op de ODRL-Evaluator (plan 2026-08-18 §4.1) | middel |

## Bronnen

- FTV GraphQL-profiel draft-01 — <https://vng-realisatie.github.io/ftv/documents/20260928-ftv-graphql-profile.html>
- Slides AuthZEN & GraphQL en Intro GBO — <https://vng-realisatie.github.io/ftv/documents/>
- OPA GraphQL-builtins — <https://www.openpolicyagent.org/docs/policy-reference/builtins/graphql>; GraphQL-autorisatie — <https://www.openpolicyagent.org/docs/graphql-api-authorization>
- ODRL-PAP (ODRL → Rego, FIWARE/DOME) — <https://github.com/wistefan/odrl-pap>
- SolidLab ODRL-Evaluator (FORCE) — <https://github.com/SolidLabResearch/ODRL-Evaluator>; FORCE-spec — <https://spec.knows.idlab.ugent.be/force/latest/>
- ODRE-PDS, Martín-Núñez et al., OPAL 2025 (CEUR Vol-3977) — <https://ceur-ws.org/Vol-3977/OPAL2025-5.pdf> (metingen: 33 ms pyodre, 62 ms via REST)
- ODRL Landscape — <https://w3c.github.io/odrl/landscape/>
