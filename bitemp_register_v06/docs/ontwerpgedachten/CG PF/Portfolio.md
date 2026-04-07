Kun je een V3 json maken met de volgende elementen:
- een ENT initiatief
- een GE planning met velden:
    - planningsinfo
    - startdatum: datum
    - ready for use: datum
    - waarTegenaanGelopen

- een GE product met velden (string indien anders specified)
   - naam
   - omschrijving
   - pitch
   - website: url
   - git-repo: git adres

- een paar REF LIJST ITEMs (= subtype van ENT)
    - Gemeente (naam, code)
    - Domein (naam, omschrijving)
- een paar enums:
   - organisatie type (gemeente, leverancier)
   - producttype (component toepassing)
   - fase (idee, ...)
   - schaal (1, 2, 3, 4)
   - bijdragetype (wendbaarheid, dienstverlening, regie)

- een ENT organisatie (GE's naam (naam) en contactgegevens (URL, email, telefoonnummer))
- een ENT persoon (met GE's naam (naam) en contactgegevens (email, telefoonnummer))

- een GE bijdrage met velden:
    - type bijdrage: enum bijdragetype
    - schaal: enum schaal
    - toelichting

## Uitwerking

De V3 JSON-uitwerking staat in [Portfolio.v3.json](/Users/mark/Documents/GitHub/Bitemporal_2026/bitemp_register_v06/docs/ontwerpgedachten/Portfolio.v3.json).

Gemaakte aannames in deze eerste versie:
- `Planning`, `Product` en `Bijdrage` zijn gegevenselementen onder `Initiatief`.
- `Gemeente` en `Domein` zijn uitgewerkt als `referentielijst_item` entiteiten.
- Voor `fase` zijn voorlopig de waarden `Idee`, `Verkenning`, `Realisatie` en `InGebruik` gekozen, omdat de vraag `idee, ...` nog open liet welke restwaarden gewenst zijn.
- Datum- en contactvelden zijn als datatype gemodelleerd, zodat formaat en validatie later centraal aangescherpt kunnen worden.



