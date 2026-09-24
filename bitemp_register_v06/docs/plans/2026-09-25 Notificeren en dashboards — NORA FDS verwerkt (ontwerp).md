# Notificeren en dashboards — NORA "Architectuur Notificeren in het Federatief Datastelsel" verwerkt

*Ontwerp, 25-09-2026 (Claude-sessie met Mark). Vervolg op het aanmeldformulier-plan
(`2026-09-22 Aanmeldformulier CG PF als formulierdefinitie (analyse).md` §11) — het modereren:
een moderator wil weten dát er een aanmelding is (notificatie) en wil de openstaande aanmeldingen
zien (dashboard). Bron: <https://www.noraonline.nl/wiki/Architectuur_Notificeren_in_het_Federatief_Datastelsel>
(FDS, beheerfase, laatst gewijzigd 30-07-2026) en de onderliggende pagina's.*

## 1. Wat NORA/FDS zegt — het relevante deel

**Begrippen.** *Notificeren* = "het door een aanbieder aan afnemers verstrekken van informatie over
binnen zijn domein plaatsgevonden gebeurtenissen". *Gebeurtenis* (event) = iets dat plaatsvindt op
een moment; *notificatie* = de bekendmaking ervan. Gebeurtenissen zijn levens-, business- of
**systeemgebeurtenissen** (in registratiesystemen). Rollen naar CloudEvents: *producer*,
*consumer*, *intermediary*; organisatorisch aanbieder, afnemer, intermediair. Notificaties zijn
**informatiearm** (afnemer haalt de details bij de bron) of informatierijk; verzendmodel push of pull.

**Negen functies** (met eisen): gebeurtenistypes definiëren en publiceren (catalogus, versies);
aanbieders publiceren; abonneren (geautomatiseerd, filtercriteria, wijzigen/opzeggen, endpoint);
versturen (sync/async, dosering, garanties voor ontvangst en volgorde); **raadplegen van gegevens
zoals zij bestonden bij de gebeurtenis**; authenticeren/autoriseren van abonnees (granulair per
gebeurtenistype); maskeren/versleutelen; foutsituaties (inzicht, heruitzending, herstel vanaf een
moment); traceerbaarheid (auditlog, trace-id's, bewijs van ontvangst).

**Drie basispatronen.** (1) consumer vraagt (pull/polling); (2) **producer notificeert** (push,
eigen mechanisme; incidentele gebeurtenissen, vertrouwde partners); (3) tussenliggend component
(broker; veel partijen, centrale governance). Uitwisseltechnieken: API-calls/webhooks (aanbevolen
over organisatiegrenzen), queueing, streaming. Abonneerstandaarden: webhooks (informeel), WebSub
(W3C, volwassen, alleen op topic, geen inhoudsfilter), CloudEvents Subscription API (te pril);
advies: een eigen profiel op bestaande open standaarden. Protocol: Digikoppeling REST API's.

**Zestien aanbevelingen**, de voor ons bepalende: asynchroon; publish-subscribe; tempo-aanpassing
(backpressure); wijzigingsmanagement/versies; privacy vroeg (grondslag, doelbinding,
dataminimalisatie); **geen persoonsgegevens in notificaties → informatiearm**; **filtering door
consumers**; versleutel payload waar nodig; **NL GOV profile for CloudEvents**; gestructureerde
(zelfbeschrijvende) notificaties; gebeurtenistypes in een catalogus; **geen afhankelijkheid van
volgorde**; **minimaal eenmalige aflevering + idempotente verwerking**; contract-first; de producer
definieert de gebeurtenissen.

**Afleverbetrouwbaarheid.** At-least-once met idempotentie: `Idempotency-Key` per notificatie;
beperkt aantal herpogingen (hoog niveau: exponential backoff, afgesproken frequentie/duur);
`sequence`-eigenschap als volgorde ertoe doet; consumer bevestigt met HTTP 200 pas als verdere
verwerking gegarandeerd is; **consumer haalt gemiste gebeurtenissen zelf op — producer biedt een
API om gebeurtenissen vanaf een moment op te halen**; schemaversie in de notificatie (semver);
429 + `Retry-After` bij overbelasting, producer buffert; out-of-band contact (e-mail) als bezorging
of schema blijvend faalt; JAdES-handtekening bij onweerlegbaarheid.

**CloudEvents (NL GOV-profiel).** Verplicht `id`, `source`, `specversion`, `type`; optioneel
`datacontenttype`, `dataschema`, `subject`, `time`, `data`; extensies mogelijk; FDS kiest
informatiearm.

## 2. Wat dat betekent voor dit register

De kernobservatie: **het register is al een gebeurtenislog**. Elke `POST /registratie/` levert na
commit precies de gebeurtenis die NORA bedoelt — een *systeemgebeurtenis* met registratietype
(registratie/correctie/ongedaanmaking), tijdstip, bron en de geraakte entiteiten per wijziging.
Er hoeft geen tweede waarheid te komen: een **event is een afgeleide van de registratie**. Drie
FDS-functies krijgen we daardoor gratis:

| FDS-functie | in het register |
|---|---|
| raadplegen zoals gegevens bestonden bij de gebeurtenis (functie 5) | `peiltijdstip`/`t` op elke leesroute en in GraphQL: het bitemporele model *is* deze functie |
| herstel vanaf een moment / gemiste gebeurtenissen ophalen (functie 8, richtlijn) | `registratie` + `wijziging` zijn het log; een pull-endpoint "gebeurtenissen vanaf registratie N / tijdstip T" is een projectie daarvan |
| volgorde (`sequence`) | het registratie-id is monotoon |

Het patroon is (2) **producer notificeert**: één instantie, incidentele gebeurtenissen, bekende
afnemers (moderatoren, straks commonground.nl). Geen broker. Uitwisseltechniek: API-calls
(webhook) en e-mail als kanaal voor mensen.

### 2.1 Gebeurtenistypes — uit het model, gepubliceerd als catalogus

`type` = `nl.omnium.<domein>.<entiteit>.<gebeurtenis>` met gebeurtenis ∈ `geregistreerd`,
`gecorrigeerd`, `ongedaangemaakt` (het registratietype) — bv. `nl.omnium.cg.initiatief.geregistreerd`.
De catalogus (functie 1, aanbeveling 12) wordt **gegenereerd uit de MetaRegistry** en gepubliceerd op
`GET /notificaties/gebeurtenistypes` (en in de OpenAPI). Versie: het model heeft al een versie
(schema-versies); die gaat mee als `dataschema`.

### 2.2 Het bericht — NL GOV profile for CloudEvents (Logius, draft mei 2026), informatiearm

De Logius-specificatie (<https://logius-standaarden.github.io/NL-GOV-profile-for-CloudEvents/>)
scherpt de CloudEvents-attributen aan. Toegepast op het register:

| attribuut | NL GOV-regel | invulling hier |
|---|---|---|
| `specversion` | verplicht `1.0` | `1.0` |
| `id` | verplicht; `source`+`id` uniek; **persistent id boven random UUID**; beperkingen documenteren in het dataschema | `reg-<registratieId>-w<wijzigingIdx>` — afgeleid van het log, dus reproduceerbaar en idempotent |
| `source` | verplicht; URN met namespace `nld`: organisatie-id (OIN / KvK / eIDAS) + bronsysteem; **niet** voor de datalocatie; duurzaam abstractieniveau | `urn:nld:oin:<OIN>:systeem:<instantie>` of `urn:nld:kvknr:<KvK>:<instantie>`, per instantie geconfigureerd (`NOTIFICATIE_SOURCE`); pf: KvK van de beherende organisatie + `omnium-pf` |
| `type` | verplicht; reverse-DNS; hiërarchie *databron > domein > wet*; **geen organisatienamen**; versie alleen als `v<n>`-suffix, en bij niet-compatibele wijziging oud én nieuw type produceren | `nl.<databron>.<entiteit>.<gebeurtenis>` met databron uit de instantie/het domein (pf: `nl.commonground-portfolio.initiatief.geregistreerd`); `gebeurtenis` ∈ `geregistreerd` / `gecorrigeerd` / `ongedaangemaakt`; geen productnaam in het type |
| `time` | optioneel; RFC 3339; **het moment van vastleggen**, niet het moment in de werkelijkheid; betekenis documenteren | het **registratietijdstip** (formele tijd) — precies de NLgov-keuze; de materiële tijd zit in de gegevens zelf |
| `subject` | optioneel; onderwerp in de context van de producer (NLgov: besluit uitgesteld) | `<entiteit>/<id>` (bv. `initiatief/146`); geen BSN-achtige sleutels in onze domeinen |
| `dataref` | optioneel; verwijzing naar de payload elders; **het mechanisme voor informatiearm notificeren**; lang genoeg beschikbaar | de REST-URL van de entiteit (`https://…/full/initiatieven/146`); door de bitemporaliteit blijft die ook na correcties opvraagbaar (met `t=`) |
| `data` | optioneel | minimaal: `registratieId`, `registratietype`, `bron`, `entiteit`, `id`, `wijzigingstypen`, en de GraphQL-verwijzing (`documentId` + variabelen) — geen veldwaarden |
| `datacontenttype` | JSON aanbevolen | `application/json` |
| `dataschema` | URI van het schema van `data`; voorkom meerdere schema's voor dezelfde data | `https://<instantie>/notificaties/schema/gebeurtenis-v1.json` (gepubliceerd door de API) |
| `sequence` | extensie; lexicografisch ordenbaar; monotoon en aaneengesloten aanbevolen; bij `sequencetype: Integer` **moet** hij bij 1 beginnen en met 1 stijgen | het registratie-id, **nul-opgevuld tot 12 cijfers** en zónder `sequencetype`: het id is monotoon maar door teruggedraaide transacties niet gegarandeerd aaneengesloten |
| grootte | intermediairs ≥ 64 KB doorgeven; consumers ≥ 64 KB accepteren | informatiearm blijft ver daaronder |
| beveiliging | geen gevoelige data in contextattributen; protocolbeveiliging | geen persoonsgegevens in het bericht; TLS; HMAC-handtekening op de body |

Voorbeeld voor pf:

```json
{
  "specversion": "1.0",
  "id": "reg-864-w0",
  "source": "urn:nld:kvknr:<KvK>:omnium-pf",
  "type": "nl.commonground-portfolio.initiatief.geregistreerd",
  "subject": "initiatief/146",
  "time": "2026-09-25T00:12:03Z",
  "sequence": "000000000864",
  "datacontenttype": "application/json",
  "dataschema": "https://pf.common-ground-lab.nl/notificaties/schema/gebeurtenis-v1.json",
  "dataref": "https://pf.common-ground-lab.nl/full/initiatieven/146",
  "data": {
    "registratieId": 864, "registratietype": "registratie", "bron": "aanmeldformulier",
    "entiteit": "Initiatief", "id": 146, "wijzigingstypen": ["opvoer"],
    "graphql": { "documentId": "publiek-initiatief-detail", "variables": { "id": 146 } }
  }
}
```

Informatiearm (NORA-aanbeveling 7, NLgov `dataref`): id's en verwijzingen, **geen veldwaarden en
geen persoonsgegevens**. De afnemer haalt de inhoud bij de bron onder zijn eigen autorisatie (de
leespoort, publieke of interne QueryDefinities) — dataminimalisatie en autorisatie vallen daarmee
samen met wat er al is. Gestructureerde vorm (`application/cloudevents+json`, JSON event format),
HTTP-binding en webhook volgens de CloudEvents-specificaties waarnaar het profiel verwijst.

Eén correctie bij een eerdere gedachte: het `type` bevat **geen** productnaam (`nl.omnium…`) — het
profiel wil databron/domein, geen organisatie- of productnaam; de instantie zit in `source`.

### 2.3 Abonnement = NotificatieDefinitie (EYODF, configuratiedomein)

Zelfde werkwijze als QueryDefinitie (V3 + codegen, gereserveerd woord, losse GE's, materieel):

| GE | inhoud |
|---|---|
| `NotificatiedefinitieNaam` | naam, beschrijving |
| `NotificatiedefinitieGebeurtenis` | gebeurtenistype (uit de catalogus: registratietype × doeltype, of `*`), optioneel `bron` (bv. `aanmeldformulier`), optioneel **filter in de GraphQL-filtertaal** van §7.6 (`aanmeldstatussen: { status: { eq: "nieuwe_aanmelding" } }`) — geen nieuwe predicaattaal |
| `NotificatiedefinitieAbonnee` (meervoudig) | kanaal `webhook` / `email`, adres (URL of e-mailadres), geheim (HMAC-sleutel voor webhooks), betrouwbaarheidsniveau `standaard` / `hoog` |
| `NotificatiedefinitieInhoud` | voor e-mail: onderwerp + tekst met `{{type}}`, `{{subject}}`, `{{id}}`, `{{registratieId}}`, `{{link}}`, óf een QueryDefinitie-naam waarvan het resultaat (informatiearm gehouden: id + weergavenaam) in de mail komt |
| `NotificatiedefinitieStatus` | actief / inactief + reden, materieel |

Over "filtering door consumers" (aanbeveling 8): het filter in de definitie is een *producer-zijdige*
keuze van de beheerder van deze instantie (de definitie is van de aanbieder, niet van een externe
afnemer) — dat is toegestaan: "de producer bepaalt welke gebeurtenissen ingewonnen kunnen worden"
(aanbeveling 16). Voor externe afnemers geldt straks: abonneren op gebeurtenistype, zelf filteren.

### 2.4 Bezorging en betrouwbaarheid (richtlijnen FDS)

- **Asynchroon** na de commit; een mislukte bezorging raakt de registratie nooit.
- **At-least-once**: `Idempotency-Key: <event id>` (= `id`); een consumer moet dubbele bezorging kunnen negeren.
- **Herpogingen**: standaard 5 pogingen met exponential backoff (1 m, 5 m, 30 m, 2 u, 12 u); `429` + `Retry-After` gerespecteerd; 2xx = bevestiging.
- **Bezorglog** (functie 9): `notificatie_bezorging` — event id, definitie, abonnee, poging, tijdstip, HTTP-status/fout, bevestigd op. Zichtbaar in de Studio; **heruitzending** vanuit het log (functie 8).
- **Pull/herstel**: `GET /notificaties/gebeurtenissen?vanaf=<registratieId|tijdstip>&type=…` als projectie van `registratie`/`wijziging` (CloudEvents-batch). Dat dekt het pull-patroon én "gemiste gebeurtenissen zelf ophalen".
- **Beveiliging**: webhook-handtekening `X-Omnium-Signature: sha256=<HMAC(geheim, body)>`; e-mail alleen naar adressen uit de definitie (beheerders); geen persoonsgegevens in het bericht.
- **Out-of-band**: blijft een abonnee falen (na alle pogingen), dan een e-mail naar het beheeradres van de instantie (richtlijn "alternatieve communicatie").
- **Versie**: `dataschema` verwijst naar het gepubliceerde schema van `data`; het `type` krijgt pas een `v<n>`-suffix bij een niet-compatibele wijziging, en dan worden oud én nieuw type een tijd naast elkaar geproduceerd (NLgov).

### 2.5 Waar we van NORA afwijken, bewust

- Abonnementen zijn in fase 1 **definities van de beheerder**, geen self-service voor afnemers
  (geen abonnements-API). Reden: één instantie, bekende afnemers; een Subscriptions-profiel
  (WebSub-achtig of CloudEvents Subscription API) kan later bovenop dezelfde definities.
- Geen intermediair/broker (patroon 3): de bezorger zit in de API (patroon 2).
- E-mail is een kanaal voor *mensen*, niet voor systemen; het bericht blijft informatiearm.

## 3. DashboardDefinitie (kort)

"Beperkte view op een of meer entiteiten" is in MVC-termen (aanmeldformulier-plan §5.5): de
**selectie** is een QueryDefinitie, de **view** een WeergaveDefinitie; een dashboard is de
**compositie**. `DashboardDefinitie` (configuratiedomein): naam, beschrijving, status, en een
meervoudig GE `DashboarddefinitieTegel` (titel, QueryDefinitie-naam, weergave `aantal` / `tabel` /
`lijst`, optioneel WeergaveDefinitie, volgorde). Een pagina `dashboard.html?dashboard=<naam>` (en
Studio-activiteit) rendert de tegels; toegang volgt de toegankelijkheid van de QD's (intern →
login). De modereeractie is de bestaande bewerking van `aanmeldstatus` op het initiatief.

**Eerste stap is gezet (25-09):** QueryDefinitie 3 `nieuwe-aanmeldingen` (intern; status
`nieuwe_aanmelding` of `in_behandeling`), replay 21. Dat is de tegel van straks én de inhoud van
de moderator-mail.

## 4. Fasering

| Fase | Wat | Omvang |
|---|---|---|
| 1 | event-afleiding na commit; catalogus `/notificaties/gebeurtenistypes`; `NotificatieDefinitie` (V3 + codegen); bezorger webhook (CloudEvents NL GOV, HMAC, Idempotency-Key, retry/backoff) en e-mail (SMTP uit `.env`); bezorglog | M |
| 2 | pull-endpoint `gebeurtenissen?vanaf`; heruitzending vanuit de Studio; 429/Retry-After en buffering; out-of-band melding | S–M |
| 3 | `DashboardDefinitie` + dashboardpagina; self-service abonnements-API als profiel op WebSub/CloudEvents Subscriptions | M |

Eerste concrete definitie: *"`nl.omnium.cg.initiatief.geregistreerd` met bron `aanmeldformulier` →
e-mail aan de moderatoren met onderwerp, id en link naar de Studio"*. Vereist: een SMTP-relay dat de
VPS mag gebruiken (`SMTP_HOST/PORT/USER/PASS/FROM`).
