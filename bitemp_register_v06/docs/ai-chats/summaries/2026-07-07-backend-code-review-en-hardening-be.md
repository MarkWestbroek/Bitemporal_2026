# Chat Samenvatting

## Metadata

- Datum: 2026-07-07
- Titel: backend-code-review-en-hardening-be
- Bestandstamnaam: 2026-07-07-backend-code-review-en-hardening-be
- Gerelateerde export: ../exports/2026-07-07-backend-code-review-en-hardening-be.md
- Gerelateerde branch/commit: `chore/be-code-review` (sessie startte op `feat/studio05-afronding`; al het werk landde in de aparte worktree `d:\Git\Bitemporal_2026_be_review`)
- Gerelateerd rapport: `bitemp_register_v06/docs/reviews/2026-07-07-backend-code-review.md`

## Doel

Volledige code review van de v06 Go-backend met de vraag "is dit productiewaardig?", gevolgd door het uitvoeren van de hoogst geprioriteerde verbeterpunten uit die review. Het werk is bewust in een aparte git worktree/branch gezet omdat de gebruiker in de hoofdcheckout op een front-end-branch werkte.

## Beslissingen

- **Oordeel review:** nog niet productiewaardig, maar sterk fundament. Vier §3-blockers: synthetisch registratietijdstip, niet-afgedwongen autorisatie, onbeveiligde admin-/rebuild-endpoints, en een omzeilbare audit-trail. Volledig rapport + 13-punts actieplan in het reviewdocument.
- **Registratietijdstip (§3.1 / actiepunt 2):** het synthetische tijdstip (2026-01-01 + registratie-ID uren) blijft als **demo-modus** bestaan achter `REGISTRATIE_TIJD=synthetisch` (default) — de React-tijdlijnpagina's (t=1, t=2) hangen ervan af. Echte implementaties zoals het **CG-domein** zetten `REGISTRATIE_TIJD=klok` (echte UTC-kloktijd).
- **Autorisatie (§3.2/3.4 / actiepunt 3):** `RequireRol("editor")` op alle muterende routes, `RequireRol("admin")` op `/admin/*` en schema-activeren, `RequireAuth()` op `/graphql/query`; `JWT_SECRET` verplicht bij `AUTH_ENABLED=true` (dev-default geweigerd in productie); PDP fail-closed by default; onbekende vereiste rol = deny. Alles no-op zolang `AUTH_ENABLED=false`. OpenFTV/PDP-containers niet nodig voor de lokale rolchecks.
- **Audit-trail (§3.5):** `POST /{padnaam}` en `POST /full/{padnaam}` lopen nu via `RegistreerCore` (nieuwe `MakeAddEntityViaEngineHandler`); directe-insert handlers verwijderd; `POST /registraties` en `POST /wijzigingen` verwijderd (waren te vervalsen). Invariant: elke mutatie op modeltabellen loopt door `RegistreerCore`.
- **Admin-hardening (§3.3):** `/admin/*`-endpoints alleen in builds met `-tags devtools` (Dockerfile.devloop + entrypoint + in-container rebuild bouwen met die tag; productie-images niet → 404). Wachtwoordcheck constant-time, via header `X-Beheer-Wachtwoord` (padvariant blijft werken); dev-default "1234" geweigerd in productie; rebuild-mutex (409 bij samenloop).
- **Concurrency (§4.1):** ongedaanmaking-reads binnen de tx met `FOR UPDATE`; engine-reads die muteren locken hun rijen; enkelvoudig-invariant ook in de DB geborgd met partial unique indexes.
- **Foutafhandeling (§4.2/4.3):** onbekend ID → 404 (bun's `sql.ErrNoRows` gaf 500); interne DB-fouten gaan naar de log, client krijgt generieke tekst (`handlers/http_fouten.go`).
- **Performance (§4.4):** formele-tijdafleiding set-based (`laadFormeleTijdCache`, 1 query i.p.v. N+1). Nog open: gecorreleerde subquery in `applyFormeleTijdFilterVoorModel` (LATERAL-kandidaat, eerst EXPLAIN meten).
- **Schema-repository (§6):** vastgesteld dat gegenereerde migratie-SQL nergens wordt uitgevoerd/geadministreerd; voorstel voor een `schema_migraties`-tabel + transactioneel activeren + gefaseerd lostrekken van de schema-repository. (Nog niet uitgevoerd.)
- **Chat-export als patroon:** herbruikbaar script `scripts/export-claude-chats.py` toegevoegd (tegenhanger van `export-copilot-chats.py`), plus een instructie in `CLAUDE.md` om Claude-sessies met projectimpact te exporteren.

## Waarom deze keuze

De blockers zijn met voorrang aangepakt omdat ze het directe productierisico vormen (open database, vervalsbare historie, fictieve tijdlijn). De demo-modus voor het tijdstip is behouden achter een vlag i.p.v. verwijderd, omdat de bestaande FE-tijdlijnvisualisaties er functioneel van afhangen. Auth-changes zijn no-op bij `AUTH_ENABLED=false` zodat bestaande dev-flows ongemoeid blijven. De invariant "alle mutaties via `RegistreerCore`" en de partial unique indexes verplaatsen correctheidsgaranties naar plekken waar ze niet meer omzeild kunnen worden (engine + database).

## Gewijzigde onderdelen

- **Bestanden:** `handlers/registratie_tijd.go`, `handlers/opvoer_handlers.go`, `handlers/http_fouten.go`, `handlers/admin_wachtwoord.go`, `handlers/devtools_{enabled,disabled}.go` (nieuw); wijzigingen in `main.go`, `routes/addroutes*.go`, `middleware/auth*.go`, `handlers/{registration_core,registration_helpers_generiek,core_handlers,crud_handlers,full_handlers,admin_handler,rebuild_handler,diff_handler}.go`, `model/metaregistry_plumbing.go`, `dbsetup/createtables.go`; `scripts/export-claude-chats.py` (nieuw); docs bijgewerkt.
- **API routes:** `POST /{padnaam}`, `POST /full/{padnaam}` nu via de engine; `POST /registraties` + `POST /wijzigingen` verwijderd; `/admin/*` achter build-tag + rol "admin"; param-loze admin-varianten met header-wachtwoord.
- **DB/SQL:** partial unique indexes voor de enkelvoudig-invariant; `FOR UPDATE` op muterende reads; set-based query op `f_formele_wijziging_op_peil`.
- **Frontend:** geen wijzigingen; wel gedragswijziging waar de FE op moet letten (POST-per-padnaam geeft nu `registratie_id`; `REGISTRATIE_TIJD` blijft synthetisch voor de tijdlijnpagina's).

## Open punten

- §4.4 restant: `applyFormeleTijdFilterVoorModel` naar LATERAL JOIN na `EXPLAIN ANALYZE`-meting.
- P2-punten uit het rapport: duplicatie wegwerken, `slog` invoeren, `handlers/` opsplitsen, dependency-bumps (bun/gin), gqlgen-afweging, CDN-assets embedden.
- §6: schema-migratie-administratie (`schema_migraties`) + transactioneel activeren + schema-repository lostrekken.
- Branch `chore/be-code-review` is nog niet gemerged; FE-flows en replay-bestanden nog niet tegen de nieuwe engine-POST-routes gedraaid.

## Volgende stap

Branch `chore/be-code-review` reviewen/mergen en de replay- + FE-flows tegen de gewijzigde POST-per-padnaam-routes draaien; daarna P2 of §6 oppakken.
