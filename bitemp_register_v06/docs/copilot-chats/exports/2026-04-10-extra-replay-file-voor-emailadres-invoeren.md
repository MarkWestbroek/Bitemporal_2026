# Chat: Extra replay file voor emailadres invoeren

- **Datum**: 2026-04-10 21:14
- **Sessie-ID**: `7ab27910-6330-4fbf-be8e-5768d6973702`
- **Berichten**: 8

---

## 🧑 User

kun je van de antwoorden op de vraag ""Wat is het emailadres van de PO?" nog een extra replay file maken die Persoon.Contactgegevens.email invoert bij de juiste persoon?

Ik moet voor ik die afspeel nog wel telefoonnummer niet verplicht maken, maar dat komt goed.

---

## 🤖 Assistant

I'll write the replay file now that the person/e-mail mapping is confirmed.
```

```

```

```
## ✅ Klaar

Ik heb het extra replay-bestand aangemaakt:

- 

### Inhoud
- vult `Persoon.Contactgegevens.email`
- gekoppeld aan de juiste  uit replay 4
- bevat **1 registratie-entry** met **64 e-mailwijzigingen**

### Volgorde
Speel deze af **na**:

- 

en pas **nadat** `telefoonnummer` niet meer verplicht is.

### Documentatie
Ik heb ook `docs/ontwerpgedachten/CG PF/replay-mapping.md` bijgewerkt met deze extra stap.

> Verificatie: het bestand is gegenereerd en bevat `personen_met_email: 64`.

Als je wilt, kan ik hierna ook meteen een kleine check doen op eventuele dubieuze/placeholder e-mailadressen.

---

## 🧑 User

ja, graag

---

## 🤖 Assistant

I'll check the generated PO e-mail replay for obvious placeholder or dubious addresses now.## 🔎 Check gedaan

Verse controle op  geeft:

- `personen_totaal=66`
- `email_entries_in_replay=64`

### Al automatisch uitgesloten
Deze zaten **niet** in het replay-bestand omdat er geen echte e-mail in stond:

-  — naam `piet` — e-mail `piet`
-  — naam `y` — e-mail `y`

### Nog even handmatig nalopen
Dit zijn de duidelijkste twijfelgevallen:

| persoon_id | naam | e-mail | opmerking |
|---|---|---|---|
| `22` | `Er is een productowner... Ruub van der Klip en Rolf Jonker` | `r.vanderklip@rotterdam.nl en r.jonker@rotterdam.nl` | **twee e-mailadressen in één veld** |
| `53` | `po\iet` | `piet@piet.nl` | **placeholder/testachtig** |
| `15` | `Diverse gemeenten en leveranciers` | `dennis.vanaalst@yard.nl` | geen echte persoonsnaam |
| `23` | `Er is geen PO. Ruub van der klip is contactpersoon.` | `r.vanderklip@rotterdam.nl` | vrije tekst als naam |
| `33` | `Is nog niet eenduidig belegd...` | `a6.verhulst@nijmegen.nl` | vrije tekst als naam |

### Verder opvallend
Één e-mailadres hangt aan **twee naamvarianten**:

-  →  
  `David Bronsveld (PO ZGW API's) bij Decos`  
  `David Bronsveld namens Decos`

---

## Advies
Voor het afspelen zou minimaal dit opgeschoond moeten worden:

1.  splitsen of weglaten  
2.  weglaten  
3. eventueel de vrije-tekst-“namen” nalopen

Als gewenst kan ik meteen een **opgeschoonde v2 van die replay file** maken.

---

## 🧑 User

ja, of een correctie replay file? :-) Je kunt die twee Davids samenvoegen. Dat is: hij hangt als het goed is al aan de organisatie Decos. Is dat zo? Dan kan alles achter Bronsveld weg.
Dat kan via een correctie op 1 van de twee records (bijv. persoon 22)

Daarna mag de link of mogen de links naar persoon 53 naar 22. (Kan ook via een correctie.)

Dan mag persoon 53 afgevoerd worden via een afvoer.

Lukt dat?

---

## 🤖 Assistant

I'll inspect the existing person/contact links first and then make a correction replay for the merge and cleanup.
```

```
I'll verify the new correction replay now and then summarize exactly what it changes.## ✅ Gelukt

Ik heb een aparte correctie-replay gemaakt:

- 

### Wat erin zit
1. **Correctie** van de actieve David-recordnaam naar:
   - `David Bronsveld`
2. **Afvoer** van het dubbele David-record:
   - 
3. **Afvoer** van het test/pseudo-record:
   - 

---

## 🔎 Wat ik heb geverifieerd

Verse controle via de live API op `localhost:8082` laat zien:

- de twee David-records zijn in de huidige data ** en `13`**
- de **actieve** `contactpersoon`-koppeling hangt nu aan:
  -  = `OWC`
  - 
- dus **niet** aan `Decos`
- voor **** zijn momenteel **geen actieve links** gevonden

> Daarom heb ik **geen 53→22 relink** opgenomen: daar was in de huidige data niets om om te hangen.

### Validatie
Ik heb het bestand ook technisch gecontroleerd:

- 

---

## 📘 Documentatie
Ik heb ook  bijgewerkt met deze extra stap.

Als je wilt, kan ik nu ook nog **`5. PO email...` opschonen naar een v2** zodat die dubbele/test-mailregels er helemaal niet meer in staan.

---

## 🧑 User

ja, graag

---

## 🤖 Assistant

I'll make a cleaned `v2` of the PO-email replay now, excluding the dubious rows.
```

```
The cleaned `v2` replay is ready; I'm validating the counts now.## ✅ Klaar: opgeschoonde `v2` gemaakt

Nieuw bestand:

- 

## Wat deze variant doet
- vult alleen **betrouwbare** `Persoon.Contactgegevens.email`
- laat dubieuze/test/vrije-tekstgevallen bewust weg
- is nu de **voorkeursvariant** voor import

## Verificatie
Vers gecontroleerd:

- `personen_met_email = 56`
- `uitgesloten_personen = 10`

### Uitgesloten in `5b`
Onder andere:

-  — `Diverse gemeenten en leveranciers`
-  — twee e-mails in één veld
-  — vrije tekst als naam
-  — vrije tekst als naam
-  — `MapGallery`
-  — contactpersoon in haakjes
-  — waarnemend product owner in haakjes
- , `53`, `66` — test/placeholder

## Documentatie
Ik heb  ook bijgewerkt zodat nu staat:

1. replay `4`
2. daarna bij voorkeur replay `5b`
3. daarna optioneel replay `6`

> Mijn advies: gebruik nu gewoon `5b` + `6`.

---
