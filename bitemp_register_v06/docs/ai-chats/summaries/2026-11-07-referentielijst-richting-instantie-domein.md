# Chat Samenvatting

## Metadata

- Datum: 2026-11-07
- Titel: Referentielijst: richting van de items-relatie, instantie en domein (Claude-sessie)
- Bestandstamnaam: 2026-11-07-referentielijst-richting-instantie-domein
- Gerelateerde export: exports/2026-11-07-referentielijst-richting-instantie-domein.md
- Gerelateerde branch/commit: docs/backend-structuur-review-2026-10-31 (ongecommit); plan `docs/plans/2026-11-07 Referentielijst-instanties — richting, binding en domein (plan).md`

## Doel

Mark wilde terugvinden waarom de huidige Referentielijst-constructie (één ENT met records per
lijst, subtypen `referentielijst`, `referentielijst_item`, `referentielijst_items`, losse
instantie-nodes) gekozen is, en toetsen of `Referentielijst` in de domeinlaag bovenaan hoort terwijl
het van alle domeinen met een reflijst afhangt.

## Beslissingen

- Eén klasse `Referentielijst` met records per lijst blijft; overerving per lijst is verworpen
  (dat was de implementatie van 27-03-2026 en geeft per lijst een tabel met één record).
- De items-relatie gaat **van het item-type naar de lijst** (`Land → Referentielijst`) en komt zo
  in het domein van het item. Register krijgt dan geen uitgaande afhankelijkheden meer.
- De referentielijst-instantie wordt een echt record: seed via de registratieflow (systeemactor,
  idempotent), systeemnaam ↔ id, binding op de REL afgedwongen (422, later DB CHECK), `domein` op de
  instantie in V3.
- Meerdere lijsten per item-type (Landenlijst én EULidstaten over `Land`) worden meerdere RELs op
  het item, elk aan een eigen instantie gebonden; materieel maakt lidmaatschap tijdelijk.

## Waarom deze keuze

In het hub+_Data-patroon hoort een REL bij zijn bronentiteit. Nu is de items-REL een kind van
`Referentielijst` (sleutel `referentielijst_id + rel_id`), krijgt domein `register` en wijst
omlaag naar `AdellijkeTitel` in np-loc (CODEGEN §12). `VoegOnderliggendGEToe` was bedoeld als
compensatie maar vuurt niet, want de codegen filtert op het domein van de eigenaar-ENT en leest
`V3Relatie.Domein` niet. De instantie bestaat alleen op M1: de struct heeft geen systeemnaam
meer, de opstart-sync is weggehaald en niets bindt `referentielijst_id` aan het instantierecord
(D5/R4 open). Omdraaien maakt de laag kloppend zonder lijm; de echte instantie maakt de singleton
waar model en register het over eens zijn.

## Gewijzigde onderdelen

- Bestanden: nieuw plan in `docs/plans/`; `Referentielijsten.md` §13 punt 5; `docs/BACKLOG.md` §41.
- API routes: geen (plan).
- DB/SQL: geen (plan; stap 6 voorziet een migratie van `landenlijstland` en `adellijketitelstitel`).
- Frontend: geen (plan; stap 1 raakt canoniek-uml: verbindingsregel en «use»).

## Open punten

- `systeemnaam` als kolom op `referentielijst` of de naam-GE als bron (voorkeur: kolom).
- Blijft `ReferentielijstVisibility` als GE naast `domein` op de instantie?
- Externe lijsten (§14.3) hebben geen item-type; `$ref`-pad daarvoor apart bekijken.

## Volgende stap

Na de demo van 09-11: stap 1 en 2 van het plan samen (V3 + Studio en codegen), vóór de rebuild
uit het Studio-project op main komt.
