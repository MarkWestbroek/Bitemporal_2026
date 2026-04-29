# Chat: # Taal als fundementeel aspect van data of onderdeel van het model?  Ik worstel...

- **Datum**: 2026-04-29 18:08
- **Sessie-ID**: `11f132c4-654d-4c1d-a19f-49fd8e7d258d`
- **Berichten**: 5

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
| **W3C ITS 2.0** (*Internationalization Tag Set*) | Hoe je in XML/HTML markeert welke delen vertaalbaar zijn, welke niet, met welke regels. |
| **XLIFF 2.x** (OASIS) | Uitwisselingsformaat voor vertaaltaken (CAT-tools). |
| **TMX** | Translation Memory eXchange. |
| **SKOS / RDF language-tagged literals** | Linked-data aanpak. |
| **Dublin Core `dc:language`** + **schema.org `inLanguage`** | Resource-niveau taalindicatie. |
| **HTTP `Accept-Language` / `Content-Language`** (RFC 9110) | Content negotiation. |
| **Java ResourceBundle / gettext .po / ICU MessageFormat** | Library-conventies voor app-strings (apart van content). |

Voor jouw *register*-context zijn met name relevant: **BCP 47** (waarden), **SKOS-stijl language-tagged literals** (modellering), **ITS 2.0** (welke velden zijn überhaupt vertaalbaar), en **Accept-Language** (API).

---

## 3. Belangrijke onderscheiden die je moet maken

De literatuur (en pijnlijke ervaring) leert dat het zelden *één* keuze is, maar dat je **drie soorten "taligheid"** moet scheiden:

1. **Translatable content** — vrije tekst die per taal *vertaald* wordt en *equivalente betekenis* heeft (artikel-titel, sectie-inhoud, een omschrijving). → Patroon 1 of 2.
2. **Locale-specific identity** — een naam die per taal *officieel anders is*, niet "vertaling" maar een eigen rechtsfeit (Friese plaatsnamen, Brusselse straatnamen NL/FR, Zwitserse kantonnamen DE/FR/IT/RM, EU-instellingen). → Patroon 3 (language-tagged literal), want het zijn *gelijkwaardige* officiële namen, geen vertalingen.
3. **Authored variants** — content die per taal redactioneel onafhankelijk leeft, met eigen structuur en lifecycle. → Patroon 2 (Taalvariant entity).

Veel ontwerpfouten ontstaan doordat (1) en (2) door elkaar gaan: # Taal: aspect van de core, of modelkeuze per register?

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
| **W3C ITS 2.0** (*Internationalization Tag Set*) | Hoe je in XML/HTML markeert welke delen vertaalbaar zijn, welke niet, met welke regels. |
| **XLIFF 2.x** (OASIS) | Uitwisselingsformaat voor vertaaltaken (CAT-tools). |
| **TMX** | Translation Memory eXchange. |
| **SKOS / RDF language-tagged literals** | Linked-data aanpak. |
| **Dublin Core `dc:language`** + **schema.org `inLanguage`** | Resource-niveau taalindicatie. |
| **HTTP `Accept-Language` / `Content-Language`** (RFC 9110) | Content negotiation. |
| **Java ResourceBundle / gettext .po / ICU MessageFormat** | Library-conventies voor app-strings (apart van content). |

Voor jouw *register*-context zijn met name relevant: **BCP 47** (waarden), **SKOS-stijl language-tagged literals** (modellering), **ITS 2.0** (welke velden zijn überhaupt vertaalbaar), en **Accept-Language** (API).

---

## 3. Belangrijke onderscheiden die je moet maken

De literatuur (en pijnlijke ervaring) leert dat het zelden *één* keuze is, maar dat je **drie soorten "taligheid"** moet scheiden:

1. **Translatable content** — vrije tekst die per taal *vertaald* wordt en *equivalente betekenis* heeft (artikel-titel, sectie-inhoud, een omschrijving). → Patroon 1 of 2.
2. **Locale-specific identity** — een naam die per taal *officieel anders is*, niet "vertaling" maar een eigen rechtsfeit (Friese plaatsnamen, Brusselse straatnamen NL/FR, Zwitserse kantonnamen DE/FR/IT/RM, EU-instellingen). → Patroon 3 (language-tagged literal), want het zijn *gelijkwaardige* officiële namen, geen vertalingen.
3. **Authored variants** — content die per taal redactioneel onafhankelijk leeft, met eigen structuur en lifecycle. → Patroon 2 (Taalvariant entity).

Veel ontwerpfouten ontstaan doordat (1) en (2) door elkaar gaan: "Nederland" / "Netherlands" / "Pays-Bas" is **geen vertaling** in de zin van CMS-vertaling, het zijn drie officiële namen — Wikidata's monolingual text + `P1448 official name` modelleert dit expliciet.

---

## 4. Jouw vraag a vs b

> *"Met taal als filter over de data heen gelegd, zou je de hele Taalvariant niet nodig hebben, want het Kennisartikel kan dan 'talig' zijn. Klopt dat?"*

**Gedeeltelijk.** Het klopt voor categorie (1) en (2) hierboven. Het klopt **niet** zodra de talen redactioneel onafhankelijk moeten kunnen leven (categorie 3): dan heb je een Taalvariant nodig omdat:

- Sectie-aantallen per taal kunnen verschillen (NL heeft 5 secties, EN heeft 4).
- Publicatiestatus per taal verschilt (NL gepubliceerd, DE in review).
- Auteursrechten/verantwoordelijken per taal verschillen.
- Een Taalvariant "afgevoerd" kan worden zonder de andere talen te raken.

Jouw diagram is dus **niet "fout"** — het is de juiste keuze als deze redactionele onafhankelijkheid bestaat. Als die er niet is, kan je inklappen.

---

## 5. Past taal in de core van *jouw* register? Mijn analyse

Je vergelijking met `materieel` is heel scherp. Laten we hem doortrekken:

| Aspect | `materieel` toevoegt | hypothetisch `talig` zou toevoegen |
|---|---|---|
| Extra plumbing-GE's | `_Aanvang`, `_Einde` op hub | (niets — taal zit in _Data) |
| Extra veld in _Data | nee | `taal` (BCP 47, FK naar `Taal`-referentielijst) |
| Uniciteit / multipliciteit | "enkelvoudig op tijdstip *t*" | "enkelvoudig op tijdstip *t* **en taal *l***" |
| Tijdreis-parameter (API) | `?t=` | `?lang=` (of `Accept-Language`) |
| Default | n.v.t. (geen aanvang/einde) | per-register configureerbare default-taal + fallback-keten |
| MetaRegistry-vlag | `IsMaterieel` | `IsTalig` |

**Dit past architectonisch heel mooi in jouw model**, en wel om dezelfde reden waarom `materieel` past: het is een **orthogonaal aspect** dat consistent op _Data-niveau leeft, met afgeleide semantiek voor uniciteit.

### Wat er goed te overdenken is voordat je het promoveert tot core-aspect

1. **Fallback-keten**: vrijwel alle systemen hebben dit. `nl-BE → nl → en → *` (Accept-Language wildcards). Dit moet de query-laag doen, niet de opslag. → ontwerpkeuze: per-register default + per-request override.
2. **Wat is "enkelvoudig per taal"?** Twee subvarianten:
   - *Strict*: per `(ent_id, taal)` één actuele `_Data`. Goed voor namen/titels.
   - *Loose*: een record kan voor meerdere talen tegelijk gelden (taal = `null` betekent "alle talen"). Goed voor numerieke/code-velden die toevallig in een vertaalbare GE zitten.
3. **Niet alle velden in een _Data zijn vertaalbaar** (vgl. ITS 2.0 `translate="no"`). Als een GE meerdere velden heeft waarvan sommige wél en sommige niet talig zijn, wordt opslag per-taal duur (duplicatie van de niet-talige velden). Drupal lost dit op met *field-level translatability*. Bij jouw maximale uitnormalisatie speelt dit minder, omdat een GE vaak één veld heeft — wat juist een **argument vóór** jouw aanpak is.
4. **Identity vs translation** (zie sectie 3): zorg dat het MetaRegistry-veld iets als `TaligheidsAard: vertaling | officieleNaam | variant` kan onderscheiden. Anders ga je later spijt krijgen als de Friese officiële plaatsnamen ineens als "vertalingen" van de Nederlandse worden behandeld.
5. **Tijdreizen × taal**: prima orthogonaal, maar de URL/GraphQL-API krijgt een derde dimensie naast `t` (formeel) en peil (materieel). Documenteer expliciet de volgorde van toepassen: eerst formele snapshot → dan materiële filter → dan taal-fallback.
6. **Diagram b blijft toegestaan**: zelfs met `IsTalig` in de core moet je de Taalvariant-modellering kunnen blijven doen voor categorie (3) gevallen. Het zijn complementaire mechanismen.

---

## 6. Mijn aanbeveling

**Voer een core-aspect `Talig` in (parallel aan `Materieel`)**, met deze invulling:

- `TypeMeta.IsTalig bool` — zoals `IsMaterieel`.
- Bij `IsTalig: true` voegt codegen automatisch een `taal` veld toe in `_Data` (FK naar een `Taal`-referentielijst, BCP 47 als waarde).
- Uniciteit/multipliciteit-semantiek wordt **"per moment per taal"**.
- `TypeMeta.TaligheidsAard enum {Vertaling, OfficieleNaam, Variant}` om (1)/(2)/(3) te onderscheiden — dit stuurt UI en validatie.
- API-conventie: zowel `?lang=fy-NL` als `Accept-Language` header; fallback-keten configureerbaar per register, default `[request → register-default → *]`.
- Per-register default-taal in een nieuwe configuratie-entry.
- **Diagram b blijft een geldige modelkeuze** voor authored variants met eigen lifecycle (categorie 3). Je zet hem in waar dat nodig is, niet als standaard-oplossing voor "ik heb tekst".

Dit volgt het patroon van de **linked-data wereld** 

---
