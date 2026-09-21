# Chat: CEL expressie schrijven voor ingezetene check

- **Datum**: 2026-04-04 19:43
- **Sessie-ID**: `9da5c13c-1ee5-4595-a8d1-e0fd8d415709`
- **Berichten**: 9

---

## 🧑 User

ik denk een eenvoudige vraag: hoe schrijf je een CEL expressie om dit weer te geven:

`bsn + als ingezetene = true {" ingezetene"}`

---

## 🧑 User

okee. Ik heb deze via generatie in de np-loc metareg gezet, maar ook bij herstarten van alles, toont het niet in inhoud en index

in de tijdlijn lijkt ook alleen het oude afgeleide weergave veld van NP te zien te zijn

---

## 🤖 Assistant

Ik ga eerst nagaan waar de gegenereerde `weergave`-expressie voor `NatuurlijkPersoon`/`Persoonsidentificatie` wordt gelezen en waarom nog de oude afleiding zichtbaar blijft.
```

```

```

```

```

```

```

```
Ik heb de oorzaak scherp: de UI-evaluator las `bsn`/`ingezetene` nog niet direct uit het GE-item, waardoor hij terugviel op de oude samenvatting.
```

```
## ✅ Oorzaak en fix

Dit bleek **niet** aan de  metareg zelf te liggen, maar aan de frontend-CEL-evaluator in `web/vite/src/shared/celEvaluator.js`.

### Root cause
De UI kon voor GE/hub-weergave nog **niet goed omgaan met**:

- directe veldnamen zoals `bsn` en `ingezetene`
- boolean-logica zoals `true`, `&&`, `||`, `!`

Daardoor viel `Persoonsidentificatie` terug op de oude ruwe samenvatting:

```text
123456789 | true
```

in plaats van de afgeleide weergave.

---

## 🔧 Aangepast

In `web/vite/src/shared/celEvaluator.js` is nu toegevoegd:

- directe toegang tot platgeslagen itemvelden
- support voor `true` / `false`
- support voor `&&`, `||`, `!`
- robuustere lookup voor GE-/hub-expressies

Ook  is bijgewerkt met dit voorbeeld:

```cel
bsn + (ingezetene == true ? " ingezetene" : "")
```

of korter:

```cel
bsn + (ingezetene ? " ingezetene" : "")
```

---

## Verification

Vers geverifieerd met:

1. **self-check evaluator**
   ```text
   [
     "123456789 ingezetene",
     "Ingezetene",
     "ja"
   ]
   ```

2. **Vite build**
   ```text
   ✓ 276 modules transformed.
   ✓ built in 1.22s
   ```

---

## Wat nu

Doe even een **harde refresh** van de pagina (`Ctrl+F5`).  
Dan zou `Persoonsidentificatie` in **inhoud**, **index** en **tijdlijn** nu de nieuwe afgeleide tekst moeten tonen.

---

## 🧑 User

hoe moeilijk zou het zijn om een volledige CEL evaluator in de frontend te bouwen? Zijn daar geen libraries voor? Heeft dat grote nadelen boven deze zelfgebouwde subset evaluator?

---

## 🤖 Assistant

Goede vraag. Hier is de analyse:

## Beschikbare JS CEL-libraries

| Library | Bundle (min+gzip) | Dependencies | Downloads/week |
|---|---|---|---|
| `cel-js` | **41 kB** | 2 (chevrotain, lodash-es) | ~36k |
| `@marcbachmann/cel-js` | **24 kB** | 0 (zero deps) | ~466k |
| `@bufbuild/cel` | **24 kB** | 1 Goede vraag. Hier is de analyse:

## Beschikbare JS CEL-libraries

| Library | Bundle (min+gzip) | Dependencies | Downloads/week |
|---|---|---|---|
| `cel-js` | **41 kB** | 2 (chevrotain, lodash-es) | ~36k |
| `@marcbachmann/cel-js` | **24 kB** | 0 (zero deps) | ~466k |
| `@bufbuild/cel` | **24 kB** | 1 (@bufbuild/cel-spec) | ~832k |

Onze huidige  is **~14 kB ongecomprimeerd** (~3–4 kB gzipped).

## Trade-offs: library vs. zelfgebouwd

**Voordelen van een library:**
- Volledige CEL-spec (macros `all()`, `exists()`, , `map()`, `size()`, `has()`, list/map literals, etc.)
- Community-onderhoud, bugfixes, spec-compliance
- Minder eigen code om te testen

**Nadelen / risico's:**
- **Bundlegrootte**: 6–10× groter dan onze huidige evaluator. `@marcbachmann/cel-js` is de lichtste met 24 kB gzip, maar dat is nog steeds fors voor wat we nodig hebben
- **Overkill**: wij gebruiken alleen `+`, `==`, `!=`, `&&`, `||`, `!`, ternary, dot-access en literals. Dat is ~10% van de CEL-spec
- **Context-integratie**: we moeten sowieso custom code schrijven om de MetaRegistry-context (klassenaam-aliassen, platgeslagen GE-velden) op te bouwen — dat verandert niet met een library
- **Veiligheid**: onze evaluator is by design veilig (geen `eval`/`Function`). Libraries zijn dat ook, maar je vertrouwt op een derde partij
- **Maturiteit**: geen van deze libraries is >v1.0; `cel-js` is 0.8.2, `@bufbuild/cel` is 0.4.0
- **Lock-in**: als een library abandoned wordt, zit je met een dependency die je alsnog moet forken of vervangen

## Conclusie

**Niet moeilijk, maar niet nodig.** Overstappen naar een library is technisch eenvoudig (~1 uur werk), maar maakt je bundle 6–10× groter voor features die je niet gebruikt. De huidige zelfgebouwde evaluator dekt precies de subset die de MetaRegistry-expressies nodig hebben, is veilig, en is makkelijk incrementeel uit te breiden als er een nieuwe operator nodig is (zoals we net met booleans deden).

**Advies**: blijf bij de huidige aanpak tenzij je merkt dat je steeds complexere expressies nodig hebt (list comprehensions, macros, custom functions). Op dat moment is `@marcbachmann/cel-js` (zero deps, 24 kB) de beste kandidaat.

---

## 🧑 User

Wil je dit minstens even uitgebreid als hierboven opschrijven in een CEL-evaluatie-js.md?

---

## 🤖 Assistant

## ✅ Vastgelegd

Ik heb dit uitgewerkt in:

- 

Daarin staat nu uitgebreider beschreven:

- hoe lastig een **volledige eigen CEL-evaluator** echt is,
- welke **JavaScript-libraries** er bestaan,
- wat de **voor- en nadelen** zijn t.o.v. onze huidige subset-evaluator,
- en wat voor **dit project** de verstandigste koers lijkt.

Als je wilt, kan ik hierna ook nog een **korte verwijzing/link** opnemen vanuit `afgeleide-velden.md` naar dit nieuwe document.

---

## 🧑 User

ja, graag

---

## 🤖 Assistant

De verwijzing is bijna rond; ik zet hem nu op de juiste plek in het document.
```

```
## ✅ Verwijzing toegevoegd

Ik heb in  nu een extra sectie toegevoegd met een link naar:

- `CEL-evaluatie-js.md`

Zo zijn de **praktische CEL-uitleg** en de **technische afweging over de JS-evaluator/libraries** nu netjes aan elkaar gekoppeld.

---
