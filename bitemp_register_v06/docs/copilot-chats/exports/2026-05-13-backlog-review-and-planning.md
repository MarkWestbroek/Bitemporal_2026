# Chat: Backlog review and planning

- **Datum**: 2026-05-13 19:00
- **Sessie-ID**: `8ed349c6-1c1e-473e-aafc-d85a12acc857`
- **Berichten**: 3

---

## 🧑 User

Can you look at the backlog and make a plan for what there still has to be done?

You may add : widgets for the FrontEnd view and edit data pages (if not there on the log)

If you can imagine features that are not covered, ot that would be logically interesting, please also let me know.

---

## 🤖 Assistant

I've read the backlog (~1180 lines, very rich). Let me draft a comprehensive prioritized plan and save it. ## Plan: Roadmap v06 — wat nog te doen

Op basis van docs/BACKLOG.md. Hier de scannable versie; volledige tekst staat in `/memories/session/plan.md`.

### Increment 2A — IDE verdiepen
1. **I1–I4** Multi-diagram (tabs, viewport per diagram) — *blokkeert grote modellen*
2. **I10** Kardinaliteit `[0..*]` op velden
3. **I52** Editor-v2 `removeChild` crash definitief oplossen *(acuut, 0.1)*
4. **I6, I7** Drag&drop ENT+kinderen, auto/custom order
5. **I8** CEL breakout-editor met highlighting + autocomplete *(parallel met F35)*
6. **I12, I18** Verplaatsbare toolbars
7. **I19** PB rechtsklik "Nieuw element per type"
8. **I28–I34** Edge-typen (rond/hoekig/knikbaar), edge-zoek, match-size
9. **DM2, DM5, DM7** Actief domein, boundary, domein verwijderen end-to-end
10. **0.8-A1/A2** ASOC label-regressie + lege-veld dubbele lijn
11. **C8-UI** Notes/constraints rendering (datalaag is klaar)

### Increment 2B — Codegen + DB
1. **C1** Fix de 9 codegen-gaps
2. **C3** Roundtrip-test np-loc
3. **C4** Codegen voor referentielijsten
4. **D1** `createmodeltables.go` generieker
5. **D2** Codegen-optie drop/migreer

### Increment 2C — Backend bitemporeel compleet
1. **B7** Materiële tijdreizen `?geldig_op=`
2. **B8/B9** Aanvang/einde voor GE's+REL volledige keten + validatie
3. **B4–B6** CEL-go evaluator → afgeleide velden in API + validatie bij opslaan
4. **B11** Ongedaanmaking²
5. **B14** Tijdsreizen nalopen (KVK)
6. **B1** API logging met logrotatie + redactie
7. **B2/B3** Validatie + singularity/plurality-constraints
8. **B10** Bun-upgrade + callback-filter

### Increment 2D — Content-editor + nieuwe widget-stroom

**D.1 Editor**: F6 tijdreis-kiezer · F7 audit-trail · F10 delete · F11 ongedaan-maken UI · F12 combobox >100 · F30 visuele form-builder · F35 CodeMirror · F37 export · F39 input-validatie

**D.2 Widget-registry (nieuw — vult F40 "edit widgets" en P8 in)**

Centrale `web/vite/src/components/widgets/WidgetRegistry.js` met `view`+`edit` paren;  raadpleegt de registry; nieuwe `SchemaViewField.jsx` voor publicatie.

Toe te voegen widgets: `datepicker`, `datetime-picker`, `bsn` (gemaskeerd + 11-proef), `nl-postcode`, `email`, `url`, `phone`, `iban`, `geo-point/polygon` (mini OSM), `file-upload`, `image` (thumbnail+lightbox), `kleurpicker`, `bedrag` (€), `percentage` (balkje), `slider`, `rating`, `lijst-tags` (chips), `lijst-items` (inline tabel + "A, B en C"), , , `code` (CodeMirror+taalkeuze), `cel-expressie` (live preview), `auto-link-url` (P17), `expandable-text`, `relatie-card` (mini-card doel-entiteit, doorklikken), `tijdreis-badge`, `verschil-highlight` (audit).

### Increment 2E — Publicatiesite
P1/P7/P11 meervoud + "A, B en C" · P4 tijdreis-kiezer (← B7) · P5 responsive · P6 WeergaveDef beheer-UI · P10 detail-varianten · P12 condities CEL · P13–P16 filters (uitsluit/sort/enum/range/lijst) · P17 auto-links · F36 code-splitting

### Increment 2F — GraphQL
G3/G4 filtering+sorting · G5 DataLoader · G6 authz-middleware

---

### Nieuwe ideeën (niet op backlog)

| # | Idee |
|---|------|
| **N1** | Snapshot-diff-viewer: zelfde entiteit op twee peiltijdstippen, side-by-side |
| **N2** | , `code` (CodeMirror+taalkeuze), `cel-expressie` (live preview), `auto-link-url` (P17), `expandable-text`, `relatie-card` (mini-card doel-entiteit, doorklikken), `tijdreis-badge`, `verschil-highlight` (audit).

### Increment 2E — Publicatiesite
P1/P7/P11 meervoud + "A, B en C" · P4 tijdreis-kiezer (← B7) · P5 responsive · P6 WeergaveDef beheer-UI · P10 detail-varianten · P12 condities CEL · P13–P16 filters (uitsluit/sort/enum/range/lijst) · P17 auto-links · F36 code-splitting

### Increment 2F — GraphQL
G3/G4 filtering+sorting · G5 DataLoader · G6 authz-middleware

---

### Nieuwe ideeën (niet op backlog)

| # | Idee |
|---|------|
| **N1** | Snapshot-diff-viewer: zelfde entiteit op twee peiltijdstippen, side-by-side |
| **N2** | Webhooks/change-stream per registratie met domein-filter (sluit aan op B20–B23) |
| **N3** | Saved queries / named views per gebruiker (filter+sort+kolom+peil → URL) |
| **N4** | Bulk-importer met dry-run + delta-rapport (CSV/Excel/JSON → batch-registratie) |
| **N5** | Modeldoc-generator (Markdown/PDF/HTML uit MetaRegistry) |
| **N6** | Validatieregels als first-class element (CEL, scope, severity) — server- én client-side |
| **N7** | Notificaties/abonnementen op type/instantie/CEL-predicaat (vereist GB1/GB2) |
| **N8** | Replay-mode: scrub-bar door registratiehistorie, animeert ontstaan |
| **N9** | Schema-evolutie wizard met datamigratie-suggesties (bovenop ✅ DDL-diff) |
| **N10** | API-tab per ENT-detail: curl + GraphQL + OpenAPI snippet |
| **N11** | Read-only tijdreis-deep-link `/r/<type>/<id>?op=<t>` — bookmarkable bewijs |
| **N12** | CEL-cache laag voor afgeleide velden (memoization in PG) — performance B4/B5 |
| **N13** | Modelvergelijker tussen domeinen — harmonisatie-kandidaten zichtbaar |
| **N14** | Homepage "feed" laatste N registraties — onboarding |
| **N15** | Conflict-detectie parallelle correcties (ETag/If-Match al ontworpen) |

### Aannames / scope
- v06 is de enige actieve codebase
- Uitvoering: **2A → 2C → 2D parallel met 2E** is het hoogste-waarde-pad
- Horizon-items (I5/F8/F9/B18/G7-G8) blijven geparkeerd
- Widget-registry is een centralisatie-stap die F40 en P8 invult én F19/F21 datatype-hints verder benut

Wil je accenten verschuiven (bv. eerst de bitemporele backend-kern 2C, of juist eerst de widget-registry voor zichtbare vooruitgang in de UI), increments samenvoegen, of dieper inzoomen op één van de N-ideeën?

---

## 🧑 User

Zou je dit hele plan willen bewaren in een plan document naast de backlog (backlog uitvoering incrementen.md ofzo)?

# Met hieronder een brainstorm van mijn accenten en - terwijl ik brainstorm - ook nieuwe ideeen... Wil je die ook plaatsen op de backlog als ze er nog niet zijn?

## BE
Dan zou ik eerst het accent willen leggen op het verrijken van de backend.
- sterkere typering via uitbreiding van het aantal types (daarna linkt dat met de widgets en met validatie)
- validatieregels op alle typen (dat is op zich beide deels configuratie)
   - validatie van typen ook naar keuze uitvoeren in de registratie API
- verder doortesten modelvarianten
- afgeleide velden doortrekken naar afgeleide klassen: berekende klassen-concept introduceren
- afgeleide velden ook optioneel opnemen in de DB:
    - in feite zijn opvoer en afvoer al voorbeelden daarvan
    - tevens zou ik de actuele toestand van de materiele tijd (aanvang en einde) ook in de GE/REL of ENT willen plaatsen als afgeleid veld
    - eventuele andere afgeleide velden ook
    - dit vergt goed doordenken van de backend code bij wijzigingen: ook CEL expressies moeten dan eventueel worden afgevoerd, maar dat vraagt zoeken naar afhankelijke records: records die een gewijzigd record in een afgeleid veld hebben staan moeten dan opnieuw berekenen. De vraag is of dit wel wenselijk is.

- daarna materieel tijdreizen inbouwen, naast het bestaande formele

## Typering
- typering: bij content-types (types die een content-aspect hebben) zou meertaligheid (instelbaar per domein of dit mogelijk is) automatisch moeten kunnen worden toegevoegd als meta-data van de content
  - eventueel bestaat de metadata uit meer dingen: taal, taaltype = eigen vertaling, automatische vertaling, juridische vertaling (bijv. Friese plaatsnamen)
  - het betekent in de praktijk een extra dimensie in alle content bevattende _data records: de stapeling is nu op basis van de formele tijd; daar komt een taal-as bij. Geen extra tabellen, alleen meer kolommen in een talig veld bevattend _data record.
  - dat is dus op alle GE's/REL's die content velden bevatten die geconfigureerd worden als talig en indien taligheid voor het domein aangezet is.
  - letten op multipliciteit (indien enkelvoudig, kunnen er wel meer talen per instantie in de formele en materiele tijd zijn, maar nooit meer talen op hetzelfde moment; meervoudig heeft die constraint niet)

## FTV, autorisatie
Daarnaast:
- verder uitbreiden van FTV met PBAC is belangrijk: zorgen dat ook de FTV-policy editor aangesloten en gebruikt wordt
- experimenteren met verschillende policies en rollen en gebruikers
- opzetten van een organisatieregister (bitemporeel uiteraard) waarin gebruikers staan
- dat gebruiken in PBAC
- experimenteren met Authzen tokens

## ref lijsten
Referentielijsten beter uitwerken: het is een patroon, maar nu wat ingewikkeld tekenen en opvoeren. Misschien een aparte registreer-variant maken voor ref lijst items opvoeren:
- simpeler en en-masse
- verbergt de complexiteit van een replay file, zoals we die nu gebruiken
- wijzigen kan misschien standaard, maar misschien is het nodig het ook iets specifieker te doen
- materiele tijd in een ref lijst is doorgaans oneindig aan twee kanten (aanvang en einde), maar soms niet, bijv. Dat helder weergeven.

## zowel FE als BE
documentatie by example:
- aan een REP in het model ook voorbeelden toevoegen als element
- die ook roundtrippen
- beschrijf data-scenario's m.b.v. de klassen -> maak in feite object diagrammen ervan

## testdata generatie via de UI
- genereer testdata via de UI, hetzij de IDE (kies een groepje REPs, geef de eisen voor de variatie op en genereer)
- dit vereist implementatie van een MPC-koppeling denk ik, zodat AI gebruikt kan worden (lastig met betalen, authenticatie en begrenzen van kosten enz.)?
- andere mogelijkheden? Bij het genereren (rebuilden) vh register ook data-variaties binnenhalen t.b.v. datacreatie?
- data generatie heeft de data-scenario's nodig

# over jouw samenvatting backlog:
- ik zie dat de backlog niet helemaal up to date is: sommige open items zijn al gebouwd, maar niet afgevinkt.
- dat moet misschien eens met de hand gebeuren. Hoe doen we dat het beste?

- Widgets zijn zeker iets dat ik graag wil, na uitbreiding typen misschien, of iteratief stukje bij beetje

# Over je nieuwe ideeen N
zou je die elk iets meer willen uitleggen? Nu zijn ze redelijk staccato.


Dan tot slot:
- ik zou de code ook nog eens een ronde grondig willen doornemen. Een soort code review met de blik van een senior go resp. js/react developer resp. DBA.
Kun je dat ook in het plan opnemen?
- testen: ik zou wat meer end-to-end testen willen opnemen: het opvoeren van data, corrigeren, dat ongedaan maken, wijzigen, weggooien. UItdagende tests waarbij data-integriteit in het gedrang zou kunnen komen, enz.: idem wil je dat opnemen in het plan?

---
