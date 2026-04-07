# Replay-mapping voor CG Portfolio Intake

Deze notitie beschrijft hoe [Intake Portfolio Common Ground 1.json](/Users/mark/Documents/GitHub/Bitemporal_2026/bitemp_register_v06/docs/ontwerpgedachten/CG%20PF/Intake%20Portfolio%20Common%20Ground%201.json) als bron wordt gebruikt voor een draft replay-bestand tegen het model in [cgpf 0.3.7.json](/Users/mark/Documents/GitHub/Bitemporal_2026/bitemp_register_v06/docs/ontwerpgedachten/CG%20PF/cgpf%200.3.7.json).

## Directe mapping

- `ID` -> `initiatief.id`
- `Wat is de naam van het initiatief dat je wilt aanmelden?` -> `product.naam`
- `Wat is een korte omschrijving van het product?` -> `product.omschrijving`
- `Indien een toepassing, pitch je product...` -> `product.pitch`
- `Op welke website kunnen we meer info...` -> `product.website`
- `Wat is de Gitlhub of Gitlab omgeving van het initiatief?` -> `product.git_repo`
- `Wat voor type product is het initiatief?` -> `product.type` na normalisatie
- `Op welke laag of op welke lagen bevindt dit initiatief zich` -> `product.CG_laag` als eerste herkenbare CG-laag
- `Wat is de startdatum van het initiatief` -> `initiatief_aanvang.datum` en `planning.startdatum`
- `Wanneer wordt verwacht dat het initiatief ready for use is...` -> `planning.ready_for_use`
- `Waar staat informatie over de planning?` -> `planning.planningsinfo`
- `Waar zijn jullie tegenaan gelopen...` -> `planning.waar_tegenaan_gelopen`
- `In welke fase bevindt het initiatief zich?` -> `planning.fase` na normalisatie
- De drie schaalvragen -> drie losse `bijdrage` records met `type_bijdrage`, `schaal`, `toelichting`
- `In welk domein(en) past het initiatief?` -> meerdere `initiatiefdomein` relaties
- Gemeentevelden -> meerdere `initiatiefgemeente` relaties
- `Welke API-standaarden zijn toegepast?` -> meerdere `initiatiefapistandaard` relaties

## Niet 1-op-1 in het huidige schema

- `Initiatief` heeft geen relatie naar `Organisatie` in `cgpf 0.3.7`. Daarom worden contactorganisaties en leveranciers alleen als losse seed-entiteiten aangemaakt, niet gekoppeld aan een initiatief.
- `Persoon` en `Organisatie` hebben allebei een gegevenselement met request-key `contactgegevens`. Omdat de registratie-parser generiek op `veldnaam` werkt, is dat op dit moment ambigu. De generator laat die contactgegevens daarom bewust weg.
- Bronwaarden voor `producttype`, `fase` en `CG-laag` zijn rijker dan de huidige enums. De generator reduceert die naar de best passende enumwaarde en bewaart de ruwe bronwaarde in `registratie.opmerking`.
- De intake bevat vrije tekst voor gemeenten, domeinen en API-standaarden. De generator splitst die heuristisch; dit levert een bruikbare eerste replay op, maar geen opgeschoonde referentielijst.

## Generator

De draft replay wordt gegenereerd met [scripts/maak_cgpf_portfolio_replay.py](/Users/mark/Documents/GitHub/Bitemporal_2026/bitemp_register_v06/scripts/maak_cgpf_portfolio_replay.py).

Voorbeeld:

```bash
cd /Users/mark/Documents/GitHub/Bitemporal_2026/bitemp_register_v06
python3 scripts/maak_cgpf_portfolio_replay.py \
  "docs/ontwerpgedachten/CG PF/Intake Portfolio Common Ground 1.json" \
  "docs/ontwerpgedachten/CG PF/cgpf 0.3.7.json" \
  "docs/ontwerpgedachten/CG PF/Intake Portfolio Common Ground 1.replay.json"
```

## Aanbevolen vervolgstappen

1. Maak de request-keys voor `Organisatie_Contactgegevens` en `Persoon_Contactgegevens` uniek.
2. Voeg een expliciete relatie `Initiatief` -> `Organisatie` toe als betrokken organisaties belangrijk zijn in het register.
3. Introduceer opgeschoonde referentielijsten of mappingtabellen voor gemeenten, domeinen en API-standaarden voordat de replay definitief wordt.