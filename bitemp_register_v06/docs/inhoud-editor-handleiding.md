# Inhoud Editor — Gebruikershandleiding

> Register v06 — Schema-gedreven content editor

---

## Wat is de Inhoud Editor?

De Inhoud Editor is een webpagina waarmee je de inhoud van het bitemporeel register kunt bekijken en bewerken. Je ziet tabeloverzichten van alle geregistreerde gegevens en kunt doorklikken naar formulieren om details te bekijken of nieuwe records aan te maken.

De editor past zich automatisch aan het datamodel aan: als er entiteittypen, gegevenselementen of relaties worden toegevoegd aan het register, verschijnen deze direct in de editor zonder codewijzigingen. In de zijbalk en op het startscherm wordt de inhoud nu bovendien **per domein gegroepeerd**, inclusief aparte secties voor **ENT-en** en **referentielijst-items**.

---

## De editor openen

1. Start de Go API-server (standaard poort `8082`)
2. Open in je browser: **`http://localhost:8082/viz/react/inhoud.html`**

> **Tip**: als je via een ander adres of poort werkt, pas het adres aan. De editor detecteert automatisch de juiste API-URL op basis van de hostnaam.

---

## Schermindeling

```
┌─────────────────────────────────────────────────────┐
│  [Logo]  Register — Inhoud Editor       (navigatie) │
├──────────┬──────────────────────────────────────────┤
│          │                                          │
│ Domeinen │  ← hier verschijnt de tabel of het       │
│ + typen  │    formulier                             │
│          │                                          │
│ CG       │                                          │
│ • ENT-en │                                          │
│ • Ref.   │                                          │
│          │                                          │
└──────────┴──────────────────────────────────────────┘
  zijbalk          hoofdvenster
```

- **Zijbalk** (links): toont de inhoud **per domein**. Binnen elk domein zie je aparte secties voor **ENT-en** en **Referentielijst-items**. Klik op een type om het overzicht te openen.
- **Hoofdvenster** (rechts): toont het tabeloverzicht of het formulier, afhankelijk van de navigatie. Op de startpagina zie je dezelfde domeinindeling als overzichtskaarten.

---

## Tabeloverzicht

Wanneer je een entiteittype selecteert in de zijbalk, verschijnt een tabeloverzicht met alle records van dat type.

### Sorteren

Klik op een **kolomkop** om te sorteren. Klik nogmaals om de richting om te draaien:

- ▲ = oplopend (A→Z, klein→groot, oud→nieuw)  
- ▼ = aflopend (Z→A, groot→klein, nieuw→oud)

### Filteren

Onder elke kolomkop staat een filterveld:

- **Tekstvelden**: typ een zoekterm — de tabel toont alleen rijen die de zoekterm bevatten
- **Enum-velden**: selecteer een waarde uit het dropdown — de tabel filtert op die waarde
- **Leeg filter**: wis het filterveld om alle records weer te tonen

Filters werken samen: als je meerdere kolommen filtert, worden alle filters gecombineerd.

### Paginering

Onderaan de tabel staan pagineringsknoppen:

- **← Vorige** / **Volgende →**: blader door de pagina's  
- Tussendoor zie je het huidige paginanummer en het totaal aantal records

### Doorklikken naar een record

Klik op een **rij** in de tabel om het detailformulier van dat record te openen.

### Nieuw record aanmaken

Klik op de knop **+ Nieuw** rechtsboven de tabel om een leeg formulier te openen voor een nieuw record.

---

## Formulieren

### Detailformulier (bestaand record)

Na het klikken op een rij verschijnt het detailformulier met:

1. **Hoofd-entiteit velden** — de directe velden van het record (bv. ID, naam)
2. **Onderliggende gegevenselementen** — per gerelateerd type een sectie:
   - *Enkelvoudig* (max 1 tegelijk): een formulier met de huidige waarden
   - *Meervoudig* (meerdere tegelijk): een tabel van de huidige records
3. **Formele tijd** — onderaan, als readonly metadata: wanneer het record is opgevoerd en eventueel afgevoerd

### Nieuw record formulier

Een leeg formulier met alle velden voor het gekozen type. Vul de waarden in en klik **Opslaan**.

### Veldtypen

De editor herkent automatisch het juiste invoertype:

| Veldtype | Invoer |
|---|---|
| Tekst | Tekstveld |
| Datum | Datumkiezer (JJJJ-MM-DD) |
| Datum + tijd | Datum-tijdkiezer |
| Geheel getal | Nummerinvoer (stappen van 1) |
| Decimaal getal | Nummerinvoer |
| Ja/Nee | Radiobuttons (Ja / Nee / leeg) |
| Keuzelijst (enum) | Dropdown met opties |

### Validatie

- **Verplichte velden** zijn gemarkeerd met een rode asterisk (*)
- **Type-validatie**: het invoerveld controleert of de waarde past bij het type (bv. alleen getallen in een nummerinvoer)
- **Foutmeldingen** verschijnen direct onder het veld in het rood

### Opslaan

Klik op **Opslaan** om het record te registreren. De editor maakt automatisch een bitemporele registratie aan met de ingevoerde waarden. Bij succes verschijnt een groen bericht "Opgeslagen!".

Bij een fout (bv. ontbrekend verplicht veld of server-fout) verschijnt een rood foutbericht.

### Terug navigeren

- Gebruik de knop **← Terug naar overzicht** bovenaan het formulier om terug te gaan naar het tabeloverzicht
- Of klik op een ander entiteittype in de zijbalk

---

## Tips

- **Alle gegevens komen uit het schema**: als een veld niet zichtbaar is, controleer dan of het correct is opgenomen in de MetaRegistry en schema-API
- **Readonly velden**: ID-velden en autoincrement-velden zijn altijd readonly (grijs weergegeven)
- **Toetsenbord**: je kunt met Tab door de tabel en formuliervelden navigeren. Druk Enter op een tabelrij om het detail te openen
- **Foutmelding bij openen**: als je "Schema fout" ziet, controleer of de API-server draait op poort 8082
- **URL-structuur**: de editor gebruikt hash-routing. Voorbeeld: `inhoud.html#/t/as` voor entiteittype "as"

---

## Veelvoorkomende vragen

**V: Ik zie geen entiteittypen in de zijbalk**  
A: Controleer of de API-server draait en of `/api/viz/schema` een response geeft. Open de browser-console (F12) voor foutmeldingen.

**V: Na het opslaan verandert er niets in de tabel**  
A: Ga terug naar het tabeloverzicht — de tabel wordt opnieuw geladen. De opgeslagen wijziging is een nieuwe registratie en wordt pas zichtbaar als de formele verwerking correct is verlopen.

**V: Kan ik records verwijderen?**  
A: In de huidige versie (Iteratie 1) is verwijderen nog niet beschikbaar via de editor. Gebruik hiervoor de API of de Postman-collectie.

**V: Kan ik tijdreizen in de editor?**  
A: Nog niet. Tijdreizen (formeel en materieel) is gepland voor een toekomstige iteratie.

**V: Hoe voeg ik een nieuw entiteittype toe?**  
A: Voeg het type toe aan de MetaRegistry in de Go-code en herstart de server. De editor pikt het nieuwe type automatisch op via de schema-API.
