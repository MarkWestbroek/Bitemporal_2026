# Chat: # Taal als fundementeel aspect van data of onderdeel van het model?  Ik worstel...

- **Datum**: 2026-04-29 18:08
- **Sessie-ID**: `11f132c4-654d-4c1d-a19f-49fd8e7d258d`
- **Berichten**: 9

---

## 🧑 User

# Taal als fundementeel aspect van data of onderdeel van het model?

Ik worstel met iets waarvan ik niet weet of het:
a. een basaal fundamenteel aspect van data (d.w.z. alle content data, dus tekst, uitleg, maar in feite ook landnamen en soms ook plaatsnamen (in Nederland zijn er in Friesland officieel 2 talen, in omringende landen ook: belgie, luxemburg, zwitserland, delen van Polen, enz.)) is, of
b. iets dat in elk register apart moet worden gemodelleerd op de manier die daar past.


## ad a
Aangezien ik in de stijl van het register data altijd vrij ver (eigenlijk meestal maximaal) uitnormaliseer, eindigt genoemde content data vaak als enige veld in een GE/REL.

### Toevoegen van een taal(-code) veld zou gemakkelijk zijn
Dan is de content per taal instelbaar (het zit in _data), en de hub blijft uniek.
Probleem is wel de multipliciteit: enkelvoudig zou dan moeten gaan betekenen: enkelvoudig in de tijd èn in de taal.
Zou dat een goede optie zijn om meertaligheid standaard (als het altijd volgens hetzelfde mechanisme gaat, is een standaard querystring parameter ook goed te doen)?

### Toevoegen van een `taligheid` of `content` aspect aan de core van het register
Bovenstaande nog meer formaliseren, is het toevoegen van het taal-aspect aan de core.
Vergelijk: `materieel` -> dat voegt een optionele aanvang en einde toe
`talige content` -> voegt een taal-veld toe naast de content. Multipliteit blijft wat ze is. Relaties zijn toch al formeel, UML-technisch, 0..* of 1..* (0..1 of 0..* kan eigenlijk niet, omdat er altijd formele versies mogelijk zijn), en alleen de `enkelvoudig` of `meervoudig` constraint zegt iets over de hoeveelheid GE's die er tegelijkertijd kunnen zijn.
Dat breidt dan uit naar: de hoeveelheid GE's die er tegelijkertijd en per taal kunnen zijn.


## ad b
In bijgaand diagram is het specifiek gemodelleerd. Dat kan soms voordelen hebben, bijv. hier, waar de Taalvariant een soort cluster is voor de verschillende Secties per taal. De Secties hebben geen taal meer nodig dan, omdat ze onder de Taalvariant vallen.

## a tegenover b
Maar met taal als filter over de data heen gelegd, zou je de hele Taalvariant niet nodig hebben, want het Kennisartikel kan dan 'talig' zijn. Klopt dat?


## De rest van de wereld
Hoe doet men dit 'in de rest van de wereld'?

Er zijn toch plenty applicaties, API's, CMS-en, die met dit zelfde probleem zitten of zaten. Is er lijn te ontdekken in hoe men dit doorgaans oplost?

Zijn er standaarden voor (behalve dan de land- of taalcodes), met name in het ontwerp en de architectuur?

Is er een standaard, of zijn er standaard taal-patronen (zoals design patterns of analysis patterns)?

Ik ben heel benieuwd!

---

## 🧑 User

@agent Try Again

---

## 🧑 User

@agent Try Again

---

## 🧑 User

@agent Try Again

---

## 🤖 Assistant

# Taal: aspect van de core, of modelkeuze per register?

Korte versie van mijn antwoord: **beide — en dat is precies wat de "rest van de wereld" ook doet.** Taal is in moderne data-architectuur een *cross-cutting concern* (zoals tijd, autorisatie, herkomst), maar er zijn situaties waarin een expliciete domeinmodellering (jouw `Taalvariant`) nodig blijft. Hieronder eerst de patronen uit de praktijk, dan terug naar jouw register.

---

## 1. Hoe doet de rest van de wereld het?

Er zijn grofweg **vier terugkerende patronen**. Ze zijn allemaal beschreven in literatuur over i18n/L10n en content-modellering (Fowler's *Analysis Patterns*, Hohpe's *EIP*, W3C ITS, Unicode CLDR/LDML, ISO 11179).

### Patroon 1 — *Translation Table* / *Sidecar* (= jouw "taal-veld in _Data")
Eén entiteit, één hub; vertalingen leven in een aparte rij met `(entity_id, lang_code, field_value)`. PK bevat de taalcode.

- **Voorbeelden**: Drupal `*_field_data` tabellen, WordPress WPML/Polylang, Django `django-modeltranslation` / `django-parler`, Rails `globalize`, Laravel `spatie/laravel-translatable`, Symfony Sonata Translation, Hibernate Envers + i18n bundles.
- **API-conventie**: HTTP `Accept-Language` header (RFC 9110), of `?lang=nl` querystring. GraphQL: `@translate(language: NL)` directive (Neo4j GraphQL doet dit), of een `language` argument op velden.
- **Pro**: minimale impact op het domein, taal echt orthogonaal.
- **Con**: "enkelvoudig" wordt inderdaad "enkelvoudig per taal" — exact het probleem dat jij ziet.

### Patroon 2 — *Language Variant Entity* (= jouw diagram b, `KennisartikelTaalvariant`)
Een expliciet domein-object dat alle talige content per taal clustert. Vaak gebruikt als er per taal **andere structuur** kan zijn (verschillend aantal secties, andere afbeeldingen, andere workflow-status per taal).

- **Voorbeelden**: AEM (Adobe Experience Manager) Language Copies, Sitecore Language Versions/Variants, Contentful Locales-with-fallback bij *entry-level* localization, Strapi locales, DITA `<topic xml:lang>`, TMX/XLIFF voor uitwisseling.
- **CMS-en met "echte" content** kiezen vrijwel altijd dit patroon zodra vertalingen *redactioneel onafhankelijk* moeten kunnen leven (eigen workflow, eigen publicatiemoment, eigen reviewer).
- **Pro**: per-taal lifecycle, per-taal structuurverschillen mogelijk, schoon UML-model.
- **Con**: verdubbeling van structuur, joins, en "welke is de canonieke?" vraag.

### Patroon 3 — *Field-level locale tag* op de waarde (= jouw "taal als core-aspect")
De waarde zelf is intrinsiek talig: `{ "@value": "Nederland", "@language": "nl" }`.

- **Voorbeelden**: **RDF/SKOS** `skos:prefLabel "Nederland"@nl`, **JSON-LD** `@language`, **Wikidata** monolingual text values, **schema.org** `inLanguage`, **CIDOC-CRM** `E33_Linguistic_Object`.
- Dit is de aanpak van vrijwel alle **semantische / linked-data** wereld (Getty AAT, GeoNames, EU Publications Office, BabelNet).
- **Pro**: meest zuiver. Een waarde *is* talig; meertaligheid is geen apart record maar een eigenschap van de waarde.
- **Con**: queries en joins worden iets ingewikkelder; de "single value" abstractie verdwijnt.

### Patroon 4 — *Locale = formele dimensie* (zoals tijd)
Een paar systemen behandelen taal écht als een eigen as, naast tijd. **Unicode CLDR/LDML** doet dit voor formatting; **ICU ResourceBundles**; en in de praktijk doen sommige multi-tenant SaaS-platformen dit voor *alle* user-facing strings.

- Dit is conceptueel het dichtst bij wat jij voorstelt onder "*talige content* aspect, vergelijkbaar met *materieel*".

---

## 2. Standaarden om te kennen

| Standaard | Waarvoor |
|---|---|
| **BCP 47 / RFC 5646** | Tagging van talen (`nl`, `nl-BE`, `fy-NL`, `nl-Latn-NL`). Dit is *de* standaard voor de taalcode zelf. |
| **ISO 639-1/2/3** | Taalcodes (BCP 47 bouwt hierop). |
| **ISO 3166** | Landcodes (regio-deel van BCP 47). |
| **Unicode CLDR / LDML** | Locale-data, formatting, plural rules, collation. |
| **W3C ITS 2.0** (*Internationalization Tag Set*) | Hoe je in XML/HTML markeert welke delen vertaalbaar zijn, welke niet, met welke 

---

## 🧑 User

ja, graag. Het mag zo uitgebreid als hierboven of uitgebreider. Alsjeblieft niet te staccato: het moet over een tijdje en door iemand anders ook goed te begrijpen zijn. Een collega architect of developer moet het kunnen snappen. Dank.

---

## 🤖 Assistant

Aangemaakt: .

Het document is opgezet in dezelfde stijl als  en , met 15 hoofdstukken die een collega-architect of -developer cold moeten kunnen oppakken:

1. Probleemstelling
2. Drie typen "taligheid" (vertaling / officiële naam / auteursvariant) — met expliciete keuzehulp
3. Patronen uit de praktijk + standaarden (BCP 47, RFC 9110, SKOS/JSON-LD, ITS 2.0, CLDR)
4. Kernvoorstel: `IsTalig` + `TaligheidsAard` op `TypeMeta`
5. Database-structuur (incl. concreet voorbeeld op `Trefwoord` uit het bijgevoegde kennis-model)
6. Semantiek: uniciteit, materieel × talig, fallback-keten, tijdreizen × taal (volgorde van toepassen)
7. MetaRegistry-impact (Go-snippets)
8. Codegen-impact + preflight-validatie
9. API-laag (REST, GraphQL, OpenAPI)
10. Frontend (schema-gedreven, UML-editor, 3D Universum)
11. Open ontwerpvragen (7 stuks, expliciet benoemd)
12. Wat de Taalvariant-modellering uit het kennis-model blijft doen
13. Vergelijking met bestaande v06-aspecten in een tabel
14. Roadmap in 6 fasen
15. Samenvatting

Belangrijkste ontwerpkeuzes die ik vooraf heb gemaakt (kunnen we nog wijzigen): plumbing op `_Data` (niet op de hub), `taal` opnemen in PK, autoincrement van `versie` per taal, `Taal` als centrale referentielijst die zelf `IsTalig` is (recursief), en het naast elkaar laten bestaan van `IsTalig` en `Taalvariant`-clusters voor verschillende use cases.

---

## 🧑 User

super. Dank, ik ga het lezen!

---

## 🤖 Assistant

Graag gedaan! Veel sterkte met het lezen — en mocht je na bestudering vragen hebben, aanpassingen willen maken, of aspecten willen uitwerken (bijvoorbeeld voor één van de open vragen in hoofdstuk 11), zeg het gerust. 

Succes! 🙌

---
