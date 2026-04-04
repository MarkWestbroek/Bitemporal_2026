# Chat: Created comparison document with examples

- **Datum**: 2026-04-02 01:53
- **Sessie-ID**: `5e4f7f30-35f6-4792-980a-77fa2f50aa29`
- **Berichten**: 2

---

## 🧑 User

Veel mensen (bedrijven, instellingen, architecten) gebruiken voor bitemporaliteit het platte patroon van opvoer, afvoer, aanvang en einde in de gegevensrij van de tabel (elke tabel die materiele (in inherent ook formele) data voorstelt).

Ik meen dat je daarmee geen duidelijk beeld meer van je data kunt recreeren bij formeel tijdreizen, in met name ongedaanmaak-situaties. Je gaat dan records moeten heropvoeren. Je kunt ook niet iets tweemaal corrigeren denk ik.

Misschien zijn er ook andere problemen die opduiken.

Ik denk dat het veel meer uitgesponnen model dat wij hier gebruiken perfect alle situaties aankan die er gebeuren en dat perfect kan reproduceren bij tijdreizen. Voor actuele toestanden hebben we de afgeleide opvoer en afvoer velden.

Zou je kunnen onderzoeken wat de mogelijkheden en onmogelijkheden zijn van beide aanpakken?

Graag met voorbeelden die aantonen waarom iets wel of niet werkt.

---

## 🤖 Assistant

Now I have a thorough understanding of both models. Let me create the analysis document. Het document staat in docs/vergelijking_plat_vs_gescheiden_patroon.md.

Hier de kernbevindingen:

### Waar het platte model faalt

**1. Ongedaanmaking (het cruciale probleem)**
Je hebt gelijk: in het platte model kun je een `afvoer` niet terugzetten naar `null` zonder de formele tijdreis te corrumperen — op het tussenliggende tijdstip zouden dan twee rijen tegelijk actief lijken. De enige uitweg is **kopieën** maken, maar die verliezen de audit trail en creëren ambiguïteit (§3.4, Poging A vs B).

**2. Gedeeltelijke ongedaanmaking is onmogelijk**  
Het platte model kent geen concept van "atomaire registratie". Als twee wijzigingen op hetzelfde moment zijn gedaan (naam + adres), kun je niet één daarvan ongedaan maken zonder handmatig cherry-picken (§3.6).

**3. Undo van undo = explosieve datagroei**  
Elke undo/redo-cyclus voegt een volledige kopie-rij toe. Na N cycli heb je N+1 rijen voor logisch één gegeven (§3.5).

**4. Identiteitsverlies**  
Bij elke correctie verandert het fysieke rij-ID, waardoor FK-verwijzingen vanuit andere tabellen breken (§3.2).

**5. Dataredundantie bij datumcorrecties**  
Een wijziging in alleen de aanvangsdatum dupliceert alle 50 inhoudsvelden (§3.3).

### Waar het platte model wél werkt
- Eenvoudige registratie + query ✅
- Voorwaartse correcties Het document staat in docs/vergelijking_plat_vs_gescheiden_patroon.md.

Hier de kernbevindingen:

### Waar het platte model faalt

**1. Ongedaanmaking (het cruciale probleem)**
Je hebt gelijk: in het platte model kun je een `afvoer` niet terugzetten naar `null` zonder de formele tijdreis te corrumperen — op het tussenliggende tijdstip zouden dan twee rijen tegelijk actief lijken. De enige uitweg is **kopieën** maken, maar die verliezen de audit trail en creëren ambiguïteit (§3.4, Poging A vs B).

**2. Gedeeltelijke ongedaanmaking is onmogelijk**  
Het platte model kent geen concept van "atomaire registratie". Als twee wijzigingen op hetzelfde moment zijn gedaan (naam + adres), kun je niet één daarvan ongedaan maken zonder handmatig cherry-picken (§3.6).

**3. Undo van undo = explosieve datagroei**  
Elke undo/redo-cyclus voegt een volledige kopie-rij toe. Na N cycli heb je N+1 rijen voor logisch één gegeven (§3.5).

**4. Identiteitsverlies**  
Bij elke correctie verandert het fysieke rij-ID, waardoor FK-verwijzingen vanuit andere tabellen breken (§3.2).

**5. Dataredundantie bij datumcorrecties**  
Een wijziging in alleen de aanvangsdatum dupliceert alle 50 inhoudsvelden (§3.3).

### Waar het platte model wél werkt
- Eenvoudige registratie + query ✅
- Voorwaartse correcties (zonder undo) ✅
- Formeel en materieel tijdreizen voor simpele gevallen ✅

### Waarom het gescheiden model deze problemen niet heeft
De scheiding van **registratie → wijzigingen** (formele waarheid) en **hub → data → aanvang/einde** (inhoud + geldigheid) maakt dat ongedaanmaking werkt via het omdraaien van wijzigingen — zonder kopieën, zonder identiteitsverlies, met volledige audit trail.

---
