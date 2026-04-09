# Chat: Open source libraries for custom form definitions

- **Datum**: 2026-04-09 02:02
- **Sessie-ID**: `46d32eeb-fd34-4fd9-b806-b45d122a035b`
- **Berichten**: 2

---

## 🧑 User

in de backlog hebben we | F1 | Iteratie 2: custom formulierdefinities in JSON | Forms plan 02 |

1. Kun je een overzicht geven van wat er aan open source componenten / libraries zijn die custom formulierdefinities mogelijk maken?
- ik zou dit in de DB op willen slaan, net als de schema's. Ze moeten op een entiteit + onderliggende GE's en RELs werken, zoals nu de inhoud editor, maar dan is de layout vrij te bepalen.
- Er moet een formaat voor de te editen velden zijn (en enkel of meervoudige weergavestijlen).

2. Niet in de backlog (moet ergens nog een plaatsje krijgen):
- custom views op data ten behoeve van publicatie; dat is eigenlijk een kleine publicatie-site
  - een custom view tabel met gekozen velden (kiezen en volgorde veranderen; eventueel weergave format zelf bepalen)
  - zoeken en filteren binnen die velden (ook als de lijst lang is, dus niet alleen binnen de geladen rijen)
  - daarna door naar een detailpagina die ook customizable is: dat kan via html met veldinserts via logische paden in de beschikbare data. Een beetje zoals we de CEL expressies hebben opgebouwd: NatuurlijkPersoon.Bereikbaarheid.Locatie.Adres.straat (oid)

3. een voorwaarde om dit goed te kunnen doen is misschien nog om de gegevenstypen uit te breiden met meer betekenisvolle typen. BIjv. LangeTekst voor opmerkingen en KorteTekst voor namen e.d. AN40 (alfanumeriek max 40 tekens) heb ik ook wel gebruikt, maar is al wat dieper de techniek in. Zijn hier standaarden voor bedacht?

  Wil je dit documenteren in 1 de backlog 2 een uitgebreid plan?

---

## 🤖 Assistant

Let me first explore the existing plans and codebase to understand the current state, then research the open source landscape.  Now let me research the open source landscape for form builders and data publication/view components.  Now let me research data type standards and publication view patterns.  

---
