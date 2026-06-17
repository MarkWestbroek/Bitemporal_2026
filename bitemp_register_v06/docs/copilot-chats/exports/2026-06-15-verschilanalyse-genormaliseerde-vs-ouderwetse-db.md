# Chat: Verschilanalyse genormaliseerde vs ouderwetse DB

- **Datum**: 2026-06-15 14:33
- **Sessie-ID**: `9e511f9e-8de5-4e3c-aa55-6aaa918d0487`
- **Berichten**: 12

---

## 🧑 User

We hebben in dit project de DB extreem genormaliseerd. Dit leidt tot uiterst precieze registraties, met tijdslijnen waar nodig. Je kunt bijvoorbeeld alleen een materieel aanvangsmoment corrigeren, of een einddatum ongedaan maken.

De ouderwetse methode is alle tijdslijninformatie in dezelfde tabel schrijven. Eventueel met een splitsing tussen de entiteit (1 tabel met enkel het ID) en de gegevens (1 andere tabel). Elke rij bevat ook de materiele (indien aanwezig) - aanvang en einde - en formele tijdsvelden - opvoer, afvoer.

Kun je een verschilanalyse maken tussen deze twee, en waar de ouderwetse methode je gaat 'bijten'?

---

## 🤖 Assistant

# Verschilanalyse: Extreem Genormaliseerd (v06) vs. Ouderwetse Één-Tabel Aanpak

## Samenvatting van de twee benaderingen

### Ouderwetse aanpak (gedenormaliseerd)

Eén tabel (of entiteit-tabel + data-tabel) waarin elke rij **alle** tijdsdimensies bevat:

| ent_id | voornaam | achternaam | aanvang | einde | opvoer | afvoer |
|--------|----------|------------|---------|-------|--------|--------|

Elke wijziging — of het nu om inhoud, aanvangsdatum, of einddatum gaat — produceert een **volledig nieuwe rij** met alle velden, en de oude rij wordt afgevoerd.

### v06 aanpak (extreem 

---

## 🧑 User

Dank. Zou je dit (precies zo, de tekst is goed) in een "bitemporele registers - vergelijking v0.1.md willen schrijven?

Zou je er daarna het voorbeeld in item 10 in tabelvorm (de rijen en klassiek en v06 formaat vergeleken) willen uitwerken? Zodat het visueel wordt.

---

## 🤖 Assistant

Het bestand is aangemaakt op:



Het bevat:

1. **De volledige analyse** (items 1–10) precies zoals besproken
2. **De uitgewerkte tabel** voor item 10 met:
   - Het scenario in een overzichtstabel (R1–R5 met formele tijdstippen)
   - De ouderwetse tabelweergave (5 rijen, alles gekopieerd, met annotaties wat er misgaat)
   - De v06-weergave in drie losse tabellen: `Registraties & Wijzigingen`, `np_persoon_hub`, `np_persoon_data`, `np_persoon_aanvang`
   - Een samenvattende tabel: "Wat zie je in v06 dat je in de ouderwetse niet ziet?"
3. **De conclusietabel** die de 8 aspecten vergelijkt

Het voorbeeld maakt visueel duidelijk hoe in de ouderwetse aanpak elke rij een volledige kopie is (met het risico dat je niet meer ziet wat er nu eigenlijk gewijzigd is), terwijl v06 precies laat zien welke laag geraakt wordt en waarom.

---

## 🧑 User

Dank. Het voorbeeld klopt qua logica, maar niet qua scope. Dat begint bij de inleiding (codeblok hieronder). Ik corrigeer met **vet**.

```
Registratie (formeel tijdstip)
  └─ Wijziging (wat is er gewijzigd?)
       └─ Representatie (opvoer/afvoer van specifieke records)

**Entiteit = de basis waar alles aan hangt, zonder gegevens: die zitten in gegevenslementen (GE-en) en/of Relaties (RELs, een speciaal soort GE)** 
**Indien een materiele entiteit: de tabellen Entiteit_Aanvang en Entiteit_Einde**
Entiteit_GE_Hub     ← stabiel anker **voor het GE, FK naar ENT**, afgeleide opvoer/afvoer
Entiteit_GE_Data    ← 1..* versie(s) van inhoudelijke velden (versie 1, 2, 3...)**, afgeleide opvoer/afvoer**
Entiteit_GE_Aanvang ← 0..* versie(s) van materiële aanvang (versie 1, 2, 3...)**, afgeleide opvoer/afvoer** **Alleen indien een materieel GE**
Entiteit_GE_Einde   ← 0..* versie(s) van materiële einde (versie 1, 2, 3...)**, afgeleide opvoer/afvoer** **Alleen indien een materieel GE**
```
In het voorbeeld:
Aanvang en einde van de ENT kunnen worden genegeerd. Maar er moet wel een NP (ENT) tabel bij.
De Hub heet dan NP_Naam en Data/Aanvang/Einde heten NP_Naam_Data, NP_Naam_Aanvang  en NP_Naam_Einde

---

## 🤖 Assistant

Ik ga de correcties nu doorvoeren. Er zijn drie gebieden om aan te passen: de architectuur-diagram, de voorbeeld-tabellen (met nieuwe naamgeving), en de verwijzingen in de Ik ga de correcties nu doorvoeren. Er zijn drie gebieden om aan te passen: de architectuur-diagram, de voorbeeld-tabellen (met nieuwe naamgeving), en de verwijzingen in de items.
```

```

```

```

```

```
Nu de generieke verwijzingen in items 1–9 corrigeren naar GE-niveau:
```

```

```

```

```

```

```

```

```

```

```

```
Laat ik het eindresultaat nog even controleren:Alle correcties zijn doorgevoerd. Dit is wat er gewijzigd is:

1. **Architectuur-diagram** — Entiteit expliciet als lege basis, GE's/RELs als dragers van gegevens, Hub+_Data+_Aanvang+_Einde op GE-niveau (niet op entiteit-niveau), met `0..*` kardinaliteit voor _Aanvang/_Einde en de voorwaarde "Alleen indien een materieel GE"

2. **Voorbeeld (item 10)**:
   - **Entiteitstabel** `NatuurlijkPersoon` toegevoegd (alleen `np_id` + `opvoer`/`afvoer`)
   - Hub hernoemd: `np_persoon_hub` → `NP_Naam` (met `rel_id` kolom)
   - Data hernoemd: `np_persoon_data` → `NP_Naam_Data` (met `rel_id` kolom)
   - Aanvang hernoemd: `np_persoon_aanvang` → `NP_Naam_Aanvang`
   - Opmerking over `NP_Naam_Einde` toegevoegd (niet gebruikt in dit voorbeeld)
   - Records-count bijgewerkt: 7 → 8 (entiteit erbij)

3. **Generieke verwijzingen** in items 1, 3, 4, 7, 8, 9 geüniformeerd naar GE-notatie (`GE_Hub`, `GE_Data`, `GE_Aanvang`, `GE_Einde`)

---

## 🧑 User

over de GE_Hub: deze bundelt de informatie over een gegevenselement. In dit geval de naam. Alle correcties worden op gegevens onder dezelfde hub gedaan. Een echte wijziging maakt een nieuw GE = een nieuwe hub. Dat zou hier bij een naamswijziging zijn. Dus Jansen naar "le Déjeuner" o.i.d. In het voorbeeld corrigeren we alleen: het gaat dus allemaal over hetzelfde materiele gegeven. We proberen alleen de registratie goed te krijgen.

Misschien goed om dat ook te verwerken in een scenario 2? Een daadwerkelijke naamswijziging? In klassiek zie je daar geen verschil. In v06 ziet de data er echt anders uit, namelijk een nieuwe hub

---

## 🤖 Assistant

Ik ga nu de hub-beschrijving aanscherpen en Scenario 2 toevoegen. Eerst de hub-uitleg:
```

```
Voeg nu Scenario 2 toe, vlak voor de conclusie:
```

```
Nu nog de conclusietabel uitbreiden met het correctie-vs-wijziging inzicht:
```

```
Laat ik het resultaat nog even valideren:Alles staat erin. Dit is wat er is aangepast:

**Hub-beschrijving aangescherpt** — de `NP_Naam` hub-beschrijving legt nu uit:
- De hub bundelt informatie over **één materieel gegeven**
- Correcties (R2–R5) gebeuren *onder dezelfde hub* — we fixen alleen de registratie van hetzelfde feit
- Een echte naamswijziging zou een **nieuwe hub** (`rel_id=2`) opleveren

**Scenario 2 toegevoegd** — echte naamswijziging "Jansen" → "Jansen-de Vries" door huwelijk:
- **Ouderwets**: rij 6 ziet er exact hetzelfde uit als een correctie — je kunt correctie en echte wijziging niet onderscheiden
- **v06**: nieuwe hub (`rel_id=2`), oude hub (`rel_id=1`) afgevoerd, elk met eigen `_Data` versiegeschiedenis en `_Aanvang` tijdlijn
- De oude naam blijft historisch corrigeerbaar zonder de actuele naam te raken

**Conclusietabel** uitgebreid met twee nieuwe rijen:
- *Correctie vs. echte wijziging* — visueel identiek (ouderwets) vs. zelfde hub/nieuwe hub (v06)
- *Historische gegevens corrigeren* — overschreven door actuele rij (ouderwets) vs. oude hub+_Data blijft intact (v06)

---

## 🧑 User

Dank. Kun je het nog wel aanpassen naar Janssen-de Vries, anders wijzigen er twee dingen.

Ook een kleine opmerking bij het voorbeeld, dat in onze context van het BRP zo een huwelijk natuurlijk complexer geregistreerd zou worden (met een relatie en naamgebruik, enz.).

---

## 🤖 Assistant

Twee wijzigingen: alle "Jansen-de Vries" → "Janssen-de Vries", de typo-correctie fixen, en een BRP-noot toevoegen.
```

```

```

```

```

```

```

```

```

```

```

```

```

```
Alle 11 voorkomens van "Jansen-de Vries" zijn vervangen. Laat ik het eindresultaat nog even checken:

---

## 🧑 User

@agent Try Again

---

## 🤖 Assistant

Alles is verwerkt. De wijzigingen op een rij:

- **"Jansen" → "Janssen"** in de Scenario 2-intro — sluit aan bij de eindtoestand van Scenario 1 waar de naam "Janssen" is. Alleen de toevoeging "-de Vries" wijzigt nu, niet ook de basisnaam.
- **Alle 11 "Jansen-de Vries" → "Janssen-de Vries"** — consistent door het hele document.
- **Typo-voorbeeld gefixt** — stond foutief als `"Jansen-de Vries" → "Jansen-de Vries"` (zelfde tekst), nu `"Janssen-de Vries" → "Janssen-de Vreis"` — een realistische tikfout.
- **BRP-noot toegevoegd** — een blockquote direct onder de situatieschets die aangeeft dat een huwelijk in de BRP-praktijk complexer is (relatie, naamgebruik, partner-entiteit) en dat dit voorbeeld vereenvoudigd is.

---
