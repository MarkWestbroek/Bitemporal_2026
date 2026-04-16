# Formele tijdreisqueries

Dit document beschrijft de huidige formele tijdreisqueries zoals ze in deze repository zijn uitgewerkt.

Scope:
- Dit gaat alleen over de formele tijdslijn (registratietijd).
- De materiele tijdslijn is nog niet geimplementeerd in dit register.

Belangrijke bronbestanden:
- Bitemp2026-PG/HRv4 01 - create table.sql
- Bitemp2026-PG/HRv4 02 - inserts.sql
- Bitemp2026-PG/HRv4 10 - vw- wijziging_plus_registratie_plus_ongedaanmaking.sql
- Bitemp2026-PG/HRv4 11 - vw- niet_ongedaan_gemaakte_wijziging.sql
- Bitemp2026-PG/HRv4 30 - nogw met peiltijdstip.sql
- Bitemp2026-PG/HRv4 40 wijziging met peiltijdstip en param tabel.sql
- Bitemp2026-PG/HRv4 41 nogw met peiltijdstip en param tabel.sql
- Bitemp2026-PG/HRv4 42 wijziging plus reg plus om met peiltijdstip en param tabel.sql
- Bitemp2026-PG/HRv4 20 - alle o met opvoer en afvoer.sql
- Bitemp2026-PG/HRv4 21b - actuele o met opvoer en afvoer.sql

Belangrijke implementatiebestanden in v04:
- bitemporal_go_API_v04/dbsetup/createviews.go
- bitemporal_go_API_v04/dbsetup/createtables.go
- bitemporal_go_API_v04/handlers/full_handlers.go

## 1. Uitleg van de principes (voor lezers nieuw in het domein)

## 1.1 Twee soorten tijd, maar nu alleen formeel

In bitemporele registratie zijn er normaal twee tijdslijnen:
- Formele tijd: wanneer iets is geregistreerd in het register.
- Materiele tijd: wanneer iets in de werkelijkheid geldig is.

In deze implementatie gebruiken we nu alleen formele tijd.
Praktisch betekent dit dat je terugkijkt naar een peiltijdstip op basis van registratie.tijdstip.

## 1.2 De kernentiteiten

- registratie
  - registratie_type: Registratie, Correctie, Ongedaanmaking.
  - tijdstip: formeel tijdstip van de handeling.
  - corrigeert_registratie_id: alleen gevuld bij Correctie.
  - maakt_ongedaan_registratie_id: alleen gevuld bij Ongedaanmaking.

- wijziging
  - wijziging_type: Opvoer of Afvoer.
  - registratie_id: verwijst naar de registratie die deze wijziging heeft veroorzaakt.
  - representatienaam + representatie_id: welke representatie-record is opgevoerd of afgevoerd.

## 1.3 Betekenis van opvoer en afvoer

- Opvoer: een representatie komt op de formele tijdslijn.
- Afvoer: een representatie gaat van de formele tijdslijn af.

Een representatie is formeel actueel op peiltijdstip P als:
- de opvoer op of voor P ligt,
- die opvoer niet ongedaan is gemaakt,
- en er geen geldige afvoer op of voor P is (of die afvoer is zelf weer ongedaan gemaakt).

## 1.4 Registratie, correctie en ongedaanmaking

- Registratie
  - Een gewone vastlegging van nieuwe wijzigingen (opvoer/afvoer).

- Correctie
  - Een nieuwe registratie die een eerdere registratie corrigeert.
  - De correctie heeft een eigen registratie_id en eigen wijzigingen.
  - De verwijzing naar de gecorrigeerde registratie staat in corrigeert_registratie_id.
  - In de huidige set wordt correctie in de tijdlijn vooral zichtbaar als extra opvoer/afvoer met een later registratie_tijdstip.

- Ongedaanmaking
  - Een nieuwe registratie die een eerdere registratie ongeldig maakt.
  - De verwijzing staat in maakt_ongedaan_registratie_id.
  - In het demo-script wordt bij ongedaanmaking geen nieuwe wijziging toegevoegd.
  - Effect: wijzigingen die aan de doelregistratie hangen, tellen niet meer mee als je niet-ongedaan-gemaakte wijzigingen selecteert.

## 1.5 Intuitief voorbeeld met t1..t5

Uit het inserts-bestand:
- t1: opvoer van o_id=1 (waarde A).
- t2: afvoer van o_id=1 en opvoer van o_id=2 (waarde B).
- t3: ongedaanmaking van registratie 2.
- t4: afvoer van o_id=1 en opvoer van o_id=3 (waarde C).
- t5: correctie van registratie 4: afvoer van o_id=3 en opvoer van o_id=4 (waarde Zee).

Gevolg op hoofdlijnen:
- Na t2 zou o_id=2 actueel zijn.
- Door ongedaanmaking op t3 vervalt het effect van t2.
- Daarna legt t4 een nieuw pad vast.
- t5 corrigeert t4 met een nieuw correctiepad.

## 1.6 Wat een formele tijdreisquery doet

Een formele tijdreisquery beantwoordt:
- Welke wijzigingen waren bekend en geldig op peiltijdstip P?
- Welke representaties waren op dat moment formeel actueel?

Dus niet:
- Wat was in de werkelijkheid geldig op datum D? (materiele tijd, nog niet geimplementeerd)

## 2. Technische werking en query-structuur (DBA-perspectief)

## 2.1 Datamodel in functionele keten

Vanuit auditlogica:
1. registratie bevat het formele feit en het type handeling.
2. wijziging hangt wijzigingen aan registratie_id.
3. ongedaanmaking verwijst naar een eerdere registratie via maakt_ongedaan_registratie_id.
4. views combineren dit tot een as-of leesmodel.

## 2.2 View-laag 1: wijziging plus registratie plus mogelijke ongedaanmaking

Bestand:
- HRv4 10 - vw- wijziging_plus_registratie_plus_ongedaanmaking.sql

Doel:
- Verrijk elke wijziging met registratiemetadata.
- Hang er optioneel de ongedaanmaking aan met LEFT JOIN.

Conceptueel patroon:
~~~sql
SELECT
  w.*,
  reg.tijdstip AS registratie_tijdstip,
  reg.registratie_type,
  reg.corrigeert_registratie_id,
  (om.registratie_id IS NOT NULL) AS ongedaan_gemaakt,
  om.registratie_id AS registratie_ongedaan_gemaakt_door_registratie_id,
  om.tijdstip AS registratie_ongedaan_gemaakt_op_tijdstip
FROM wijziging w
JOIN registratie reg
  ON w.registratie_id = reg.registratie_id
LEFT JOIN registratie om
  ON om.maakt_ongedaan_registratie_id = reg.registratie_id;
~~~

Observatie:
- In de SQL staat een TODO over meer dan een ongedaanmaking op dezelfde registratie.
- Semantisch hoort dit meestal enkelvoudig te zijn; technisch is een constraint wenselijk als die regel hard is.

## 2.3 View-laag 2: filter op niet-ongedaan-gemaakte wijzigingen

Bestand:
- HRv4 11 - vw- niet_ongedaan_gemaakte_wijziging.sql

Doel:
- Haal alleen wijzigingen op waarvan de bronregistratie niet ongedaan is gemaakt.

Patroon:
~~~sql
SELECT ...
FROM wijziging_plus_registratie_plus_ongedaanmaking
WHERE registratie_ongedaan_gemaakt_door_registratie_id IS NULL;
~~~

Effect:
- Ongedaanmaking wordt gemodelleerd als uitsluiting in de leeslaag.
- Historie blijft fysiek intact (append-only gedachte), interpretatie gebeurt in querylogica.

## 2.4 View-laag 3: peiltijdstipfilter op formele tijd

Bestanden:
- HRv4 30 - nogw met peiltijdstip.sql
- HRv4 41 nogw met peiltijdstip en param tabel.sql

Doel:
- As-of selectie tot en met peiltijdstip P.

Patroon:
~~~sql
SELECT *
FROM niet_ongedaan_gemaakte_wijziging
WHERE registratie_tijdstip <= :peiltijdstip;
~~~

Variant met param-tabel:
~~~sql
SELECT *
FROM niet_ongedaan_gemaakte_wijziging, param
WHERE registratie_tijdstip <= param.peiltijdstip;
~~~

Opmerking:
- De variant met param-tabel werkt alleen robuust als param exact 1 relevante rij bevat.
- Bij meerdere param-rijen krijg je multiplicatie door cartesian effect.

## 2.5 Gecombineerde variant in een query

Bestand:
- HRv4 42 wijziging plus reg plus om met peiltijdstip en param tabel.sql

Doel:
- Alle lagen in een keer combineren met peiltijdstipvoorwaarden op zowel reg als om.

Kern:
- reg.tijdstip <= peiltijdstip
- om.tijdstip <= peiltijdstip (als om bestaat)

Dit is functioneel krachtig, maar leesbaarheid en onderhoudbaarheid zijn lager dan bij gelaagde views.
Voor productie verdient de view-opbouw doorgaans de voorkeur.

## 2.6 Van wijzigingen naar actuele records (opvoer/afvoer-resolutie)

Bestanden:
- HRv4 20 - alle o met opvoer en afvoer.sql
- HRv4 21b - actuele o met opvoer en afvoer.sql

Doel:
- Voor representatie o: combineer opvoer en optionele afvoer.
- Bepaal welke o-records formeel actueel zijn.

Kernidee:
- Join o naar zijn opvoer-wijziging.
- Left join naar eventuele afvoer-wijziging.
- Sluit ongedaan gemaakte opvoer/afvoer uit.
- Houd records over zonder geldige afvoer.

Patroon:
~~~sql
... JOIN ... opvoer ON opvoer.wijziging_type = 'Opvoer' AND NOT opvoer.ongedaan_gemaakt
LEFT JOIN ... afvoer ON afvoer.wijziging_type = 'Afvoer' AND NOT afvoer.ongedaan_gemaakt
WHERE registratietijdstip_afvoer IS NULL OR hersteld;
~~~

Interpretatie van hersteld:
- In deze queryset betekent hersteld dat de afvoer zelf ongedaan is gemaakt.

## 2.7 Technische aandachtspunten in de huidige set

1. Tijdstipdatatype
- registratie.tijdstip en wijziging.tijdstip zijn char(26) in het modelbestand.
- Vergelijkingen met <= zijn dan lexicografisch.
- Demowaarden t1, t2, ... werken voor illustratie, maar niet voor echte tijdordening.
- Voor productie: gebruik timestamptz en ISO-8601 invoer.

2. Joinstijl
- Enkele querys gebruiken comma joins gemengd met expliciete JOIN.
- Voor voorspelbaarheid en onderhoudbaarheid: consequent expliciete JOIN ... ON toepassen.

3. Naamconsistentie
- Er komen zowel niet_ongedaan_gemaakte_wijziging als niet_ongedaan_gemaakte_wijzigingen voor.
- Maak dit eenduidig om runtime-fouten te voorkomen.

4. Parametertabel
- param als tabel is handig voor snel testen.
- Voor API/DB-functies is bindparameter robuuster, of een CTE met 1 peiltijdstiprij.

5. Semantiek correctie
- Correctie is nu vooral zichtbaar als nieuwe registratie met nieuwe wijzigingen.
- Als je correctie later afwijkend wilt behandelen van gewone wijziging, moet dat expliciet in leesregels (bijvoorbeeld precedence of supersede-logica).

## 2.8 Aanbevolen indexen (formele tijdreispad)

Minimaal:
~~~sql
CREATE INDEX idx_registratie_tijdstip ON registratie(tijdstip);
CREATE INDEX idx_registratie_maakt_ongedaan ON registratie(maakt_ongedaan_registratie_id);
CREATE INDEX idx_wijziging_registratie ON wijziging(registratie_id);
CREATE INDEX idx_wijziging_rep_type ON wijziging(representatienaam, representatie_id, wijziging_type);
~~~

Optioneel, afhankelijk van queryprofiel:
~~~sql
CREATE INDEX idx_registratie_type_tijdstip ON registratie(registratie_type, tijdstip);
~~~

## 2.9 Referentieflow voor implementatie in de API

Aanbevolen leesflow:
1. Selecteer uit niet_ongedaan_gemaakte_wijziging.
2. Filter op registratie_tijdstip <= peiltijdstip.
3. Projecteer naar representatieniveau (opvoer/afvoer-resolutie).
4. Lever op als formele stand op peiltijdstip.

Deze flow sluit aan op de huidige SQL-opbouw en is later uitbreidbaar met materiele tijd.

## 3. Samenvatting

- De huidige formele tijdreisaanpak werkt met registratie als audit-as en wijziging als effect-as.
- Ongedaanmaking wordt niet fysiek verwijderd, maar logisch uitgefilterd in de leeslaag.
- Opvoer/afvoer bepaalt de formele zichtbaarheid van representaties.
- De queryset is functioneel bruikbaar, met duidelijke kansen voor standaardisatie (datatype, naming, joinstijl, indexering).
- Materiele tijd is bewust nog buiten scope en vraagt een apart redesign van model en queryregels.

## 4. Koppeling naar API v04 (endpoint -> tijdreislogica)

Deze sectie beschrijft hoe de formele tijdreisprincipes landen in de huidige Go API (v04).

Belangrijk onderscheid:
- De HRv4 SQL-bestanden tonen een klassieke view-opbouw (laag 1/2/3).
- De v04 API gebruikt nu een hybride aanpak:
  - metadata-afleiding in Go (metamap)
  - centrale SQL-objecten in PostgreSQL (view + peiltijd-functie)

## 4.1 Relevante endpoints

Lezen met formele tijdfilter:
- GET /full/as
- GET /full/as/:id
- GET /full/bs
- GET /full/bs/:id

Audit lezen:
- GET /full/registraties
- GET /full/registraties/:id

Schrijven van registratie/correctie/ongedaanmaking:
- POST /registratie/

## 4.2 Queryparameters voor formele tijd

In full handlers:
- peiltijdstip: RFC3339 of RFC3339Nano (heeft voorrang).
- t: integer, afgeleid naar 2026-01-01T00:00:00Z + t uur + t microseconde.
- toonafvoer=1: laat afvoer-velden in response staan; anders worden afvoer-velden verwijderd.

In registratie-overzicht:
- ta, tb: integer tijdvenster, inclusief grenzen.
- type: registratietypefilter (registratie, correctie, ongedaanmaking).
- peiltijdstip of t: bovengrens as-of voor registratie en onderliggende wijzigingen.

## 4.3 Hoe GET /full/as en /full/bs formele tijd toepassen

De kern zit in applyFormeleTijdFilterVoorModel (in handlers/full_handlers.go),
maar de feitelijke peiltijdlogica zit gecentraliseerd in de databasefunctie.

Database-objecten:
- vw_formele_wijziging_basis
  - basisprojectie van wijziging + registratie
- f_formele_wijziging_op_peil(p_peiltijdstip timestamptz)
  - filtert op registratie_tijdstip <= peiltijdstip
  - sluit ongedaan gemaakte registraties op peilmoment uit

Voor elk model (Full_A, Full_B, A_U, A_V, B_X, B_Y, Rel_A_B):
1. Zoek de laatste wijziging op of voor peiltijdstip.
2. Sluit registraties uit die op dat peiltijdstip al ongedaan zijn gemaakt.
3. Behoud alleen records waarvan die laatste wijzigingstype = Opvoer is.

Conceptueel patroon:
~~~sql
SELECT v.wijzigingstype
FROM f_formele_wijziging_op_peil(:peil) v
WHERE ... matching op entiteit/representatie ...
ORDER BY v.registratie_tijdstip DESC, v.wijziging_id DESC
LIMIT 1
~~~

En dan filter:
~~~sql
... = 'opvoer'
~~~

Dit is inhoudelijk equivalent aan de HRv4-opbouw:
- niet-ongedaan-gemaakte wijzigingen bepalen,
- vervolgens peiltijdstipfilter,
- en daarna opvoer/afvoer-resolutie.

Verschil met eerdere v04-versie:
- de NOT EXISTS-logica staat niet meer dubbel in meerdere handlerqueries,
- maar centraal in f_formele_wijziging_op_peil.

## 4.4 Afgeleide opvoer/afvoer in response

Na selectie op actueelheid wordt in v04 per representatie nog een afleiding gedaan:
- haalLaatsteNietOngedaanGemaakteWijzigingOpPeil(...)
- zetAfgeleideFormeleTijdVoorRepresentatie(...)

Resultaat:
- Laatste wijziging Opvoer -> opvoer = registratietijdstip, afvoer = NULL.
- Laatste wijziging Afvoer -> afvoer = registratietijdstip, opvoer = NULL.

Dus de response krijgt afgeleide formele tijdvelden op basis van auditdata, niet op basis van een directe begin/eindekolom in de representatie.

## 4.5 Hoe GET /full/registraties formele tijd toepast

GET /full/registraties laadt registratie + child wijzigingen via Relation("Wijzigingen").

Filtergedrag:
- Bij ta/tb: zowel registratie.tijdstip als wijziging.tijdstip binnen interval.
- Bij peiltijdstip/t: beide <= peiltijdstip.
- Zonder tijdfilter: alles.

Let op:
- Deze endpoint toont auditsporen binnen grenzen, maar berekent niet zelf de actuele stand van representaties.
- Voor actuele stand op peilmoment zijn /full/as en /full/bs de primaire leespaden.

## 4.6 Hoe POST /registratie/ hierbij aansluit

POST /registratie/ schrijft de auditlaag:
- registratie record (registratietype + tijdstip),
- wijziging records (opvoer/afvoer),
- bij ongedaanmaking ook markering van doelregistratie en bijbehorende wijzigingen als ongedaan gemaakt.

De leeskant (/full/*) rekent daar vervolgens as-of overheen.
Schrijven en lezen zijn dus ontkoppeld:
- schrijfpad legt feiten vast,
- leespad reconstrueert formele toestand op peiltijdstip.

## 4.7 Praktische endpoint-naar-logica matrix

- GET /full/as, GET /full/bs:
  - Formele actueelheidsselectie op basis van laatste niet-ongedaan-gemaakte wijziging <= peiltijdstip.
  - Inclusief relationele subrepresentaties (U/V/RelAB/X/Y) met dezelfde regel.

- GET /full/as/:id, GET /full/bs/:id:
  - Zelfde logica als lijstendpoint, maar gefilterd op 1 id.

- GET /full/registraties:
  - Auditlijst met optionele tijdvensters en typefilter.

- GET /full/registraties/:id:
  - 1 registratie inclusief wijzigingen, zonder as-of resolutie naar actuele stand.

- POST /registratie/:
  - Schrijft registratie/correctie/ongedaanmaking die de basis vormen voor alle latere tijdreisqueries.

## 4.8 Conclusie voor beheer en uitbreiding

Voor DBA-onderhoud is het handig om v04 te lezen als twee lagen:
1. Auditlaag (registratie/wijziging + ongedaanmakerelatie).
2. As-of resolutielaag in query's (laatste geldige wijziging op peiltijdstip).

Dat is semantisch dezelfde denklijn als in de HRv4 SQL-documenten,
maar technisch nu als combinatie van:
- metamap-afleiding in de applicatie,
- en centrale DB-objecten (view + functie) voor de peiltijdlogica.

## 4.9 Startup-aanmaak en performance

Bij startup (CreateTables) gebeurt nu in volgorde:
1. tabellen aanmaken,
2. indexen voor formele tijdreisquery's,
3. view en functie aanmaken/verversen.

Indexen die nu idempotent worden aangemaakt:
- idx_wijziging_formele_lookup
- idx_wijziging_registratie_id
- idx_registratie_ongedaan_peil
- idx_registratie_tijdstip

Doel van deze indexen:
- sneller filteren op entiteit/representatie-combinatie,
- sneller vinden van wijzigingen per registratie,
- sneller evalueren van ongedaanmaking-op-peilmoment,
- stabielere sortering op tijd/id in "laatste wijziging"-queries.

## 5. Runbook: formele tijdreis in de praktijk

Deze sectie geeft direct uitvoerbare voorbeelden voor lokale v04 API-tests.

Uitgangspunt:
- API draait lokaal op http://localhost:8080.
- Data is aanwezig (bijvoorbeeld via jullie demo-registraties).

## 5.1 Snelstart: check actuele stand van A op peilmoment

Met afgeleid peilmoment via t:
~~~bash
curl "http://localhost:8080/full/as?t=5"
~~~

Met expliciet peiltijdstip:
~~~bash
curl "http://localhost:8080/full/as?peiltijdstip=2026-01-01T05:00:00.000005Z"
~~~

Interpretatie:
- De response bevat alleen A-records waarvan de laatste niet-ongedaan-gemaakte wijziging op peilmoment een Opvoer is.
- Technisch loopt dit via f_formele_wijziging_op_peil(peiltijdstip) en niet meer via losse inline NOT EXISTS in elke query.
- Zonder toonafvoer=1 worden afvoer-velden uit de JSON verwijderd.

## 5.2 Detailopvraag van 1 entiteit op peilmoment

~~~bash
curl "http://localhost:8080/full/as/1?t=4"
~~~

Interpretatie:
- Je krijgt 1 full A inclusief Us/Vs/RelABs, gefilterd op dezelfde formele as-of logica.
- Als id niet (meer) actueel is op dit peilmoment, volgt een lege/404-achtige uitkomst afhankelijk van pad en data.

## 5.3 Zelfde query inclusief afvoer tonen

~~~bash
curl "http://localhost:8080/full/as?t=5&toonafvoer=1"
~~~

Interpretatie:
- Afvoer-attributen blijven in de payload zichtbaar.
- Handig voor analyse van levensloop in plaats van alleen actuele stand.

## 5.4 Formele tijdreis voor B

~~~bash
curl "http://localhost:8080/full/bs?t=5"
~~~

Interpretatie:
- Zelfde principe als bij A, inclusief Xs/Ys-relaties.

## 5.5 Auditweergave op peilmoment

~~~bash
curl "http://localhost:8080/full/registraties?t=5"
~~~

Interpretatie:
- Geeft registraties met onderliggende wijzigingen tot en met peilmoment.
- Dit is audit-inzicht, niet direct de actuele representatiestand.
- Dit endpoint gebruikt een eigen registratiefilterpad; de centrale peiltijd-functie wordt primair gebruikt in de full representatie-stand queries.

## 5.6 Auditweergave op interval

~~~bash
curl "http://localhost:8080/full/registraties?ta=2&tb=5"
~~~

Interpretatie:
- Zowel registratie.tijdstip als wijziging.tijdstip wordt binnen [ta, tb] gehouden.
- Geschikt om te analyseren wat er in een venster is gebeurd.

## 5.7 Filter op registratietype

Alleen ongedaanmakingen:
~~~bash
curl "http://localhost:8080/full/registraties?type=ongedaanmaking"
~~~

Combinatie van typen:
~~~bash
curl "http://localhost:8080/full/registraties?type=registratie,correctie"
~~~

Interpretatie:
- Typefilter werkt op registratie-niveau; wijzigingen worden als child meegeleverd.

## 5.8 Registratie schrijven (basispatroon)

Voorbeeld opvoer van A met 1 U:
~~~bash
curl -X POST "http://localhost:8080/registratie/" \
  -H "Content-Type: application/json" \
  -d '{
    "registratie": {
      "registratietype": "registratie",
      "opmerking": "initiele opvoer A"
    },
    "wijzigingen": [
      {
        "opvoer": {
          "a": {
            "id": "100",
            "us": [
              {
                "a_id": "100",
                "aaa": "waarde-aaa",
                "bbb": "waarde-bbb"
              }
            ]
          }
        }
      }
    ]
  }'
~~~

Interpretatie:
- De handler maakt registratie + wijziging(en) in een transactie.
- In v04 wordt registratietijdstip tijdelijk afgeleid uit registratie-id (testaanpak).

## 5.9 Ongedaanmaking schrijven (basispatroon)

~~~bash
curl -X POST "http://localhost:8080/registratie/" \
  -H "Content-Type: application/json" \
  -d '{
    "registratie": {
      "registratietype": "ongedaanmaking",
      "maakt_ongedaan_registratie_id": 12,
      "opmerking": "maak registratie 12 ongedaan"
    },
    "wijzigingen": []
  }'
~~~

Interpretatie:
- Alleen toegestaan als doelregistratie bestaat, nog niet ongedaan is, en er geen conflicterende latere wijzigingen zijn op dezelfde elementen.
- Daarna zal een as-of read die doelregistratie niet meer meenemen als geldige bron van wijzigingen.

## 5.10 Veelvoorkomende controles bij afwijkende uitkomst

1. Klopt je peilparameter?
- peiltijdstip moet RFC3339(RFC3339Nano) zijn.
- t, ta en tb moeten integers zijn.

2. Begrijp je lege resultaten?
- Leeg op peilmoment betekent vaak: laatste geldige wijziging is Afvoer, of Opvoer is ongedaan gemaakt.

3. Zie je onverwacht veel/weinige auditregels?
- Controleer combinatie van type-filter en interval (ta/tb of peiltijdstip).

4. Vergelijk leespad met schrijfpad.
- POST /registratie/ legt feiten vast.
- GET /full/as of /full/bs reconstrueert die feiten as-of.

## 5.11 Aanbevolen testvolgorde

1. Schrijf 1 registratie (opvoer).
2. Lees via /full/as?t=n en controleer zichtbaarheid.
3. Schrijf afvoer of correctie.
4. Lees opnieuw op oplopende t en vergelijk overgang.
5. Schrijf ongedaanmaking op de eerdere registratie.
6. Lees opnieuw en controleer dat de ongedaan gemaakte registratie geen effect meer heeft.
