# Chat: Verwijderen van testdata en gerelateerde records

- **Datum**: 2026-04-16 13:15
- **Sessie-ID**: `63bb508c-db7c-4d78-ac14-e0ba608d7d74`
- **Berichten**: 4

---

## 🧑 User

ik heb zojuist uit deze file de initiatief-registraties voor id's 84 en 89 t/n 92 weggehaald, omdat dat testdata was. Maar nu is er nog gerelateerde data die daar naar verwijst. Wil je die ook weghalen?

Verder graag ook record (initiatief) 73 weghalen incl. gerelateerd spul.

---

## 🤖 Assistant

Let me read the actual entry blocks to understand the structure: Now let me check if there are afvoer-wijzigingen referencing these IDs in other registraties: Geen afvoer-entries. Nu gebruik ik een Python-script om de 6 registratie-blokken te verwijderen: 6 entries verwijderd (initiatieven 73, 84, 89, 90, 91, 92), inclusief al hun gerelateerde wijzigingen. Het bestand heeft nu 88 entries en bevat geen referenties meer naar die ID's.

---

## 🧑 User

in de backlog zit geen onderdeel voor de publicatie site, noch voor het data-universum. Klopt dat? Wil je die toevoegen? Bij de publicatie mag als backlogitem alvast "tonen meervoudige items in de tabelweergave"

---

## 🤖 Assistant

Nu heb ik de volledige structuur. Ik voeg twee nieuwe categorietabellen toe in de samenvatting én een nieuw increment in het plan. 
```

```
Toegevoegd:

**Publicatie site** (prefix P, 6 items):
- P1 meervoudige items in tabelweergave — het expliciete verzoek
- P2–P6 aanvullend: zoek/filter, doorklikken, tijdreis-kiezer, responsive, WeergaveDefinitie beheer-UI
- Met een toelichting dat het fundament (F22–F33) al ✅ staat
- Increment 2E aangemaakt in Visie & Plan

**Data-universum** (prefix DU, 5 items):
- DU1 dashboard Toegevoegd:

**Publicatie site** (prefix P, 6 items):
- P1 meervoudige items in tabelweergave — het expliciete verzoek
- P2–P6 aanvullend: zoek/filter, doorklikken, tijdreis-kiezer, responsive, WeergaveDefinitie beheer-UI
- Met een toelichting dat het fundament (F22–F33) al ✅ staat
- Increment 2E aangemaakt in Visie & Plan

**Data-universum** (prefix DU, 5 items):
- DU1 dashboard met aantallen per entiteitstype
- DU2–DU5 cross-entity zoeken, tijdreis register-breed, export, graaf-visualisatie
- DU2–DU5 bewust naar de Horizon verplaatst (pas waardevol bij voldoende data)

---
