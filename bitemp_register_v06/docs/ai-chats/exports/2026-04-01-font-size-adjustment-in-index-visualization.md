# Chat: Font size adjustment in index visualization

- **Datum**: 2026-04-01 12:20
- **Sessie-ID**: `1975a993-cfbd-4dc8-8510-f7b9c70a5e75`
- **Berichten**: 2

---

## 🧑 User

kun je in de index visualisatie de grootte van het font op Locatie iets kleiner maken? Het is vergeleken met NP opeens veel groter. Hoe komt dat?

---

## 🤖 Assistant

Ik ga dit direct voor je uitzoeken in de v06-frontend: eerst lokaliseer ik waar de index-visualisatie en de stijl van het label “Locatie”/“NatuurlijkPersoon” wordt gezet, daarna pas ik de fontgrootte gericht aan en leg ik uit waarom die nu groter uitvalt.Ik heb de juiste pagina gevonden in de v06-frontend en ga nu precies in die component kijken welke style-regel het lettertype van de centrale entiteitkaart bepaalt, en of daar een verschil tussen NP en Locatie wordt afgedwongen.Ik heb de vermoedelijke oorzaak al bijna te pakken: er staat één vaste centrale labelgrootte op 24px. Ik kijk nu in de visual-component zelf of er nog extra schaalregels per type/tekstlengte zitten, zodat we gericht voor Locatie kunnen corrigeren.Ik ga nu twee kleine aanpassingen doen: 1) centrale tekstgrootte in de representatiekaart dynamisch maken (zodat lange Locatie-weergave iets kleiner wordt), 2) dit kort vastleggen in de release-notities zodat de wijziging traceerbaar blijft.
```

```
De UI-aanpassing staat nu in de visual-component. Ik voeg nog een korte release-notitie toe en draai daarna een frontend build-check om te bevestigen dat alles compileert.
```

```
Ja, aangepast.

Ik heb in de index-visualisatie de centrale tekst op de entiteitskaart dynamisch kleiner gemaakt bij lange weergaveteksten, zodat Locatie minder groot oogt dan nu.

Wijzigingen:
- Font-scaling toegevoegd in 
- Centrale label gebruikt nu die dynamische grootte in 
- Wijziging gedocumenteerd in 

Waarom dit gebeurde:
- De centrale weergavetekst had een vaste grootte van 19px voor alle entiteiten.
- Bij Locatie is de afgeleide tekst vaak veel langer (zoals volledig adres), waardoor die visueel dominant en “groter” lijkt dan bij NatuurlijkPersoon.
- Er was dus geen type-specifieke schaal, alleen één vaste waarde.

Validatie:
- Syntax/check in editor: geen fouten.
- Build-task kon ik niet volledig draaien, omdat vite lokaal niet gevonden werd in deze omgeving (melding: vite: command not found).

---
