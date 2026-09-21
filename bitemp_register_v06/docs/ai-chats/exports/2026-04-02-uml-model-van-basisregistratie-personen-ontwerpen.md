# Chat: UML Model van Basisregistratie Personen Ontwerpen

- **Datum**: 2026-04-02 20:35
- **Sessie-ID**: `49bb9a57-56b2-4e17-bc36-dce162fc68a8`
- **Berichten**: 10

---

## 🧑 User

Een monnikenwerkje: zou je uit dit Logisch ontwerp van de BRP, de basisregistratie personen in NL, een UML model kunnen destilleren van de informatie die er in opgeslagen is. Ik vermoed dat het interessante deel hiervoor vanaf p 101 is (daarvoor zijn het beschrijvingen van berichten).

Het liefst door in gedachten te houden wat het concept van een entiteit is (komt overeen met iets of iemand in de werkelijke wereld, het kan ook een abstract iets zijn, zoals een huwelijk, dat slechts een enkele maal bestaat. Het heeft dus een materiele aanvang en einde (of 'leeft' nog, dan heeft het nog geen einde).

En van een GE: dat maakt integraal onderdeel uit van een ENT.

En van een REL: een relatie tussen twee entiteiten, waarbij er een de primaire is (de bezittende, zeg maar) en de ander secundair. Als er gelijkwaardigheid bestaat, is het meestal zo dat de relatie geen relatie is, maar een ENT: bijv. Huwelijk (of partnerrelatie). Dat is een op zichzelf staand 'ding' met twee personen waarmee het wel een REL heeft. Huwelijk is dus een ENT met 2 x een REL naar een andere ENT (namelijk natuurlijk persoon).

Het model zal iets lijken op wat ik in np-loc heb gemodelleerd, omdat dit op de BRP is gebaseerd. Waarschijnlijk is het materiele begin van een NP niet zozeer Aanvang, maar geboorte, en heeft dat nog speciale velden (geboorteplaats), die niet passen in de uniforme Aanvang. Aanvang bij een NP zal dan misschien niet bestaan of afgeleid moeten worden. Dat laat ik even in het midden. Het gaat nu vooral om de informatie (elementen noemt met het denk ik) die in het LO zijn benoemd en hun attributen en verhoudingen, weergegeven in UML.

Dat kan waarschijnlijk het beste in Mermaid, omdat dat hier inline te tonen is. Ik kan het altijd via de editor vertalen naar UML.

Wil je een plan maken om dit gedegen uit te voeren?

---

## 🤖 Assistant

Laat me eerst het BRP Logisch Ontwerp document en het bestaande np-loc model verkennen. Laat me eerst het BRP Logisch Ontwerp document en het bestaande np-loc model verkennen.  Ik heb het BRP LO document gevonden op `Source_material/BRP/LO BRP 2026.Q2.pdf` en het bestaande np-loc model verkend. Laat me kijken of ik online toegang tot het BRP LO kan krijgen om de structuur te analyseren, en een paar verduidelijkingen vragen.  

---

## 🧑 User

Kun je het als agent wel lezen? Wil je dan vanuit die rol het plan maken, of er al aan beginnen? Wat je wilt.

---

## 🤖 Assistant

Ik kan de PDF lezen. Laat me nu het Gegevenswoordenboek (hoofdstuk 4, vanaf p100) extraheren — dat is de kern voor het informatiemodel. Uitstekend, ik kan de PDF volledig lezen. Laat me nu de rest van de categorieën en de groepen/elementen ophalen. Nu heb ik voldoende inzicht in de categorieën en groepen. Laat me de elementen snel ophalen en dan het plan maken. Ik heb nu voldoende informatie uit de PDF gelezen. Laat me een gedegen plan opstellen. Ik kan de PDF volledig lezen en heb nu hoofdstuk 4 (het Gegevenswoordenboek, Ik kan de PDF volledig lezen en heb nu hoofdstuk 4 (het Gegevenswoordenboek, 743 pagina's) doorgenomen. Hier is het plan:

---

## Plan: UML informatiemodel BRP uit het Logisch Ontwerp

### Analyse van het bronmateriaal

Het BRP LO beschrijft een **persoonslijst** (PL) opgebouwd uit **categorieën**, elk met **groepen**, elk met **elementen**. Dit is een erg platte, administratieve structuur (genummerd: cat 01-17, groep 01-89, element xx.xx). Het is *geen* conceptueel model — het is een opslagmodel op een platte kaart. De uitdaging is om hier de werkelijke entiteiten, gegevenselementen en relaties uit te destilleren.

### Stap 1 — Entiteiten identificeren

Vanuit jouw definitie (iets/iemand in de werkelijkheid, met materieel bestaan):

| Entiteit | BRP-bron | Toelichting |
|---|---|---|
| **NatuurlijkPersoon** | Cat 01 Persoon | Centraal. Geboorte = materiële aanvang, Overlijden = materieel einde |
| **Huwelijk** (Verbintenis) | Cat 05 Huwelijk/GP | Zelfstandig 'ding' — twee gelijkwaardige partners → ENT, niet REL. Sluiting = aanvang, Ontbinding = einde |
| **Locatie** | Impliciet via BAG-koppeling in cat 08 | Vergelijkbaar met je bestaande np-loc model |

### Stap 2 — Gegevenselementen per entiteit

**NatuurlijkPersoon** (groepen uit cat 01, plus hergebruikte groepen):

| GE | BRP-groep | Momentvoorkomen | Elementen |
|---|---|---|---|
| Identificatie | 01 | enkelvoudig | a_nummer, bsn |
| Naam | 02 | enkelvoudig | voornamen, adellijke_titel, voorvoegsel, geslachtsnaam |
| Geboorte | 03 | enkelvoudig | geboortedatum, geboorteplaats, geboorteland |
| Geslacht | 04 | enkelvoudig | geslachtsaanduiding |
| Naamgebruik | 61 | enkelvoudig | aanduiding_naamgebruik |
| Overlijden | 08 (cat 06) | enkelvoudig | datum, plaats, land |
| Verblijfstitel | 39 (cat 10) | enkelvoudig | aanduiding, datum_einde, ingangsdatum |
| Gezagsverhouding | 32, 33 (cat 11) | enkelvoudig | indicatie_gezag, indicatie_curatele |
| Kiesrecht | 31, 38 (cat 13) | enkelvoudig | eu_kiesrecht, uitsluiting |
| Reisdocument | 35 (cat 12) | **meervoudig** | soort, nummer, datum_uitgifte, autoriteit, datum_einde, inhouding |
| Contactgegevens | 16, 17 (cat 17) | enkelvoudig | telefoon, email |

**Materieel begin/einde NatuurlijkPersoon:**
- Geboorte ≈ materiële aanvang (maar met extra velden: plaats, land)
- Overlijden ≈ materieel einde (maar met extra velden: plaats, land)
- Dit verschilt van de generieke Aanvang/Einde met alleen een datum — een modelleringskeuze die we expliciet moeten documenteren

**Huwelijk (Verbintenis):**

| GE | BRP-groep | Momentvoorkomen | Elementen |
|---|---|---|---|
| Sluiting | 06 | enkelvoudig | datum, plaats, land |
| Ontbinding | 07 | enkelvoudig | datum, plaats, land, reden |
| SoortVerbintenis | 15 | enkelvoudig | soort ("H" of "P") |

**Locatie:**
(Vergelijkbaar met je bestaande np-loc model)

| GE | BRP-groep | Momentvoorkomen | Elementen |
|---|---|---|---|
| Adres | 11 | enkelvoudig | straatnaam, naam_openbare_ruimte, huisnummer, huisletter, toevoeging, postcode, woonplaats |
| BAGlocatie | 11 (deel) | enkelvoudig | id_verblijfplaats, id_nummeraanduiding |
| AdresBuitenland | 13 | enkelvoudig | land, datum_aanvang, regel_1/2/3 |

### Stap 3 — Relaties

| Relatie | Primair → Secundair | Momentvoorkomen | BRP-bron | Toelichting |
|---|---|---|---|---|
| **Ouderschap** | NatuurlijkPersoon → NatuurlijkPersoon | meervoudig (max 2) | Cat 02/03 Ouder + cat 09 Kind | Ouder is primaire bezitter. NB: in BRP als vaste sleuven (ouder1, ouder2), conceptueel als relatie |
| **VerbintenisPartner** | Huwelijk → NatuurlijkPersoon | meervoudig (precies 2) | Cat 05 | Twee REL's per Huwelijk |
| **Nationaliteit** | NatuurlijkPersoon → (ref: Nationaliteitentabel) | meervoudig | Cat 04 | Met GE's: reden opname, reden beëindigen, bijzonder Nederlanderschap |
| **Bereikbaarheid** | NatuurlijkPersoon → Locatie | enkelvoudig / meervoudig | Cat 08 | Vergelijkbaar met je np-loc Bereikbaarheid |

### Stap 4 — Uitvoering: Mermaid diagrammen

Ik stel voor om **3 thematische diagrammen** te maken:

1. **Kern-Persoon** — NatuurlijkPersoon met al haar GE's
2. **Familierechtelijk** — Ouderschap, Huwelijk/Verbintenis, Kind
3. **Verblijf en Bereikbaarheid** — Locatie, Adres, Bereikbaarheid, Verblijfstitel

Plus een **overkoepelend overzichtsdiagram** (zonder velden, alleen de entiteiten en relaties).

### Stap 5 — Beslispunten

Voordat ik begin met de diagrammen, een paar punten:

1. **Geboorte als Aanvang**: In je bestaande model heeft elke ENT een generieke `Aanvang` (datum). Bij NatuurlijkPersoon is dat de Geboorte, maar die heeft extra velden (plaats, land). Wil je Geboorte als speciaal GE modelleren naast de standaard Aanvang?
2. **Overlijden als Einde**: idem — Overlijden heeft extra velden.
3. **Inschrijving/Administratie**: Cat 07 (Inschrijving) bevat puur administratieve gegevens (opschorting, blokkering, versienummer). Dit is geen inhoudelijke informatie over de persoon, maar over de registratie zelf. Meenemen in het UML model of weglaten?
4. **Reisdocument**: Dit is zakelijk gezien een meervoudig GE, maar je zou ook kunnen beargumenteren dat het een zelfstandige ENT is (een fysiek document). Voor nu als GE?
5. **Verwijzing** (cat 21): Puur administratief (doorverwijzing naar andere gemeente). Weglaten?

---

Zal ik doorgaan met de Mermaid diagrammen op basis van dit plan, of wil je eerst die beslispunten bespreken?

---

## 🧑 User

1.en 2. ja geboorte (en overlijden) zijn aparte GEs
3. misschien een klein apart modelletje van maken. Het is inderdaad eigenlijk metadata. (niet te verwarren met een metamodel)
4. Nee, dat is inderdaad een ENT. Het is een product dat volgens mij officieel zelfs eigendom van de gemeente of de staat is en blijft. Het wordt 'in bruikleen gegeven' aan de NP. Het bestaat ook maar één keer. Als het kwijt raakt en vervangen moet worden, komt er een nieuwe. Niet dezelfde. Met een ander nummer. (Dat hoort ook bij ENT: een identificerend nummer. (Dat wel pluriform kan zijn soms.)
5. Dat is meer een geobjectiveerd event. Het is wel interessant in die zin. Heeft het te maken met inschrijving of uitschrijving van / naar een andere gemeente? Anders daar ook een klein subdiagrammetje van maken.

Wil je de diagrammen nu maken?

---

## 🤖 Assistant

 Het document staat in docs/BRP-informatiemodel-UML.md. Het bevat 7 thematische Mermaid-diagrammen:

1. **Overzicht** — de 4 ENTs (NatuurlijkPersoon, Huwelijk, Reisdocument, Locatie) met hun onderlinge RELs
2. **NatuurlijkPersoon kern** — alle 13 GE's met velden (Identificatie t/m Contactgegevens)
3. **Familierechtelijk** — Ouderschap als REL (NP↔NP) + Huwelijk als ENT met 2× Partner-REL
4. **Verblijf en Bereikbaarheid** — Verblijfplaats-REL (NP→Locatie) + Locatie-GEs (Adres, BAG, Buitenland)
5. **Reisdocument** — als ENT met eigen GEs + Houderschap-REL
6. **Administratie/Metadata** — Inschrijving (cat 07) als apart meta-model
7. **Verwijzing** — als geobjectiveerd event bij uit/inschrijving

Plus een volledige mappingtabel (alle 17 BRP-categorieën → model-elementen) en een vergelijking met het bestaande np-loc model.

Kernkeuzes:
- **Geboorte** en **Overlijden** als aparte GE's (niet generiek Aanvang/Einde) — ze bevatten meer dan alleen een datum
- **Huwelijk** als ENT met twee gelijkwaardige Partner-RELs (niet als REL, want geen primair/secundair)
- **Reisdocument** als ENT (fysiek object, eigendom staat, uniek nummer)
- **Nationaliteit** als meervoudig materieel GE (geen REL, want nationaliteitentabel is codelijst, geen ENT)

---

## 🧑 User

Super! Zou je ook de referentielijsten eens willen analyseren die daar in genoemd staan? Het zijn misschien interne en externe lijsten. Klopt dat?

Ik zou ze allebei graag op een rijtje willen. Het mag wel in het document in een aparte sectie.

---

## 🤖 Assistant



Laat me de tabellenbeschrijvingen uit het LO extraheren — die staan verderop in §4.7. Nu heb ik alle tabelbeschrijvingen compleet. Laat me de sectie toevoegen aan het document. Nu voeg ik de referentielijsten-analyse toe als nieuwe sectie: Nu voeg ik de referentielijsten-analyse toe als nieuwe sectie: 
```

```
De sectie is toegevoegd. Hier de samenvatting:

---

Je hebt gelijk — er is een duidelijk onderscheid. Ik heb alle 15 tabellen geclassificeerd in drie categorieën:

**Extern** (5 De sectie is toegevoegd. Hier de samenvatting:

---

Je hebt gelijk — er is een duidelijk onderscheid. Ik heb alle 15 tabellen geclassificeerd in drie categorieën:

**Extern** (5 lijsten) — beschrijven dingen die buiten de BRP bestaan:
| Tabel | Bijzonderheid |
|---|---|
| 32 Nationaliteitentabel | Erkende nationaliteiten, temporeel |
| 33 Gemeententabel | Incl. doorverwijzing bij herindeling (`nieuwe_gemeentecode`) |
| 34 **Landentabel** | Rijkste tabel: 8 kolommen incl. 4× ISO 3166-crossrefs + fictieve einddatum-indicator |
| 59 BRP-deelnemerstabel | Organisaties De sectie is toegevoegd. Hier de samenvatting:

---

Je hebt gelijk — er is een duidelijk onderscheid. Ik heb alle 15 tabellen geclassificeerd in drie categorieën:

**Extern** (5 lijsten) — beschrijven dingen die buiten de BRP bestaan:
| Tabel | Bijzonderheid |
|---|---|
| 32 Nationaliteitentabel | Erkende nationaliteiten, temporeel |
| 33 Gemeententabel | Incl. doorverwijzing bij herindeling (`nieuwe_gemeentecode`) |
| 34 **Landentabel** | Rijkste tabel: 8 kolommen incl. 4× ISO 3166-crossrefs + fictieve einddatum-indicator |
| 59 BRP-deelnemerstabel | Organisaties in het stelsel |
| 60 RNI-deelnemerstabel | Bestuursorganen die aan RNI leveren |

**Intern** (9 lijsten) — BRP-specifieke juridische/administratieve codes:
| Tabel | Bijzonderheid |
|---|---|
| 36 Voorvoegseltabel | Simpelst: 1 kolom, geen temporaliteit |
| 37 Reden nationaliteit | Dubbelgebruik via `soort` (VK/OP/VL/BE) |
| 38 Adellijke titel/predicaat | Statisch, met soort (titel/predicaat) |
| 39 Akteaanduiding | Samengestelde 3-positie code |
| 41, 48, 49, 56, 61 | Allemaal zelfde basispatroon: code + omschrijving + geldigheidsperiode |

**Systeem** (1 lijst):
| Tabel | Bijzonderheid |
|---|---|
| 35 Autorisatietabel | Buitenbeentje: >25 kolommen, puur stelsel-metadata |

De sectie in docs/BRP-informatiemodel-UML.md bevat ook een Mermaid diagram met structuur per tabel, een flowchart die toont welk GE/REL welke tabel gebruikt, en een mapping naar het v06 referentielijstmodel.

---

## 🧑 User

mooi!

Zou je de referentielijsten en interne lijsten ook kunnen ophalen ergens? Dus de data, de waarden?

Misschien voor nu even in een eenvoudig formaat opslaan. Json of yaml of een spreadsheet ofzo.

Kan dat?

---

## 🤖 Assistant



 Let me first check what's actually in the PDF — some of these tables might have inline data, others might only be definitions. I'll also look for online sources. The PDF only contains the table *definitions* (structure), not the actual data values. The actual data is published by the RvIG (Rijksdienst voor Identiteitsgegevens). Let me find and download the data. Found the RvIG publication site. Let me get the full list of available tables and download the main ones. Alle CSV's staan op publicaties.rvig.nl. Ik ga ze allemaal downloaden. Alle 14 CSV's zijn gedownload. Laat me even de inhoud bekijken om het formaat te begrijpen: The files seem to be UTF-16 encoded. Let me read them properly: Nu begrijp ik het formaat. Laat me de rest ook even bekijken: Good - I now understand the format. All CSVs are UTF-16LE with BOM, comma-separated, quoted fields. Let me convert everything to clean JSON: Laat me even verifiëren dat de JSON er goed uitziet:  Laat me de index ook even verifiëren en het totaaloverzicht tonen: Klaar! Alle 14 landelijke tabellen zijn opgehaald en opgeslagen in twee formaten.

**Locatie:** 

| Formaat | Map | Bestanden |
|---------|-----|-----------|
| CSV (origineel, UTF-16) | `landelijke_tabellen/` | 14 `.csv` bestanden |
| JSON (schoon, UTF-8) | `landelijke_tabellen/json/` | 14 `.json` + `_index.json` |

**Totaal: 5.436 regels** verdeeld over:

| Tabel | Naam | Regels |
|-------|------|--------|
| 32 | Nationaliteiten | 217 |
| 33 | Gemeenten (incl. historisch) | 1.479 |
| 34 | Landen (incl. ISO-codes) | 398 |
| 36 | Voorvoegsels | 333 |
| 37 | Reden opnemen/beëindigen nationaliteit | 208 |
| 38 | Adellijke titel/predicaat | 13 |
| 39 | Akteaanduiding | 47 |
| 41 | Reden ontbinding huwelijk/GP | 7 |
| 48 | Nederlands reisdocument | 30 |
| 49 | Autoriteit van afgifte | 14 |
| 56 | Verblijfstitel | 50 |
| 59 | BRP-deelnemers | 2.619 |
| 60 | RNI-deelnemers | 15 |
| 61 | Gezagsverhouding | 6 |

In de JSON-bestanden zijn de kolomnamen genormaliseerd naar `code`, `omschrijving`, `datum_ingang`, `datum_einde` (plus tabel-specifieke velden zoals `soort`, `iso_alpha2`, `nieuwe_code`, etc.). Bron: [publicaties.rvig.nl](https://publicaties.rvig.nl/landelijke-tabellen-32-tm-61-excl-tabel-35), gedownload 2 april 2026.

---
