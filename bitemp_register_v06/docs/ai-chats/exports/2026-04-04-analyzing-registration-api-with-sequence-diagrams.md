# Chat: Analyzing Registration API with Sequence Diagrams

- **Datum**: 2026-04-04 21:15
- **Sessie-ID**: `bb5cd8b6-5213-4a66-9eba-8dbf6cc2fcc4`
- **Berichten**: 2

---

## 🧑 User

Zou je het hart van de applicatie: de registratie API kunnen analyseren en weergeven als een sequence diagram? (mermaid)

Een seq. diagram geeft in principe één scenario weer (al kun je er meerdere in combineren, maar dat maakt het niet duidelijker).

Zou je een aantal scenario's kunnen uitwerken? Bijv.:
- opvoer van een nieuwe ENT
- opvoer van een enkelvoudig GE (zodat de vorige wordt afgevoerd)
- afvoer van een GE zonder vervanging door een nieuwe
- afover van een ENT
- correctie een paar varianten
- ongedaanmaking idem

in de swimlanes geef je de operaties (functions of methods) weer die elkaar aanroepen. Dat kan redelijk diep worden, maar geeft in die zin inzcht in de mechanica van de applicatie. Dat mag tot aan DB niveau (logische beschrijving van de DB (bun) actie is voldoende).

Wil je dat vastleggen in een registratie-patronen.md?

---

## 🤖 Assistant

Now let me read the actual source code of the key files to get the exact function signatures, flow details, and understand all the scenarios properly.  Now let me read the remaining helper functions: Now I have a comprehensive understanding of the entire registration flow. Let me create the document with sequence diagrams. Het document is aangemaakt in docs/registratie-patronen.md.

Het bevat **8 Mermaid sequence diagrams** die de volledige aanroepketen tonen van  tot aan DB-niveau:

| # | Scenario | Kernmechanisme |
|---|----------|----------------|
| 1 | **Opvoer nieuwe entiteit + GE's** | Recursieve INSERT van entiteit → hub → _Data/_Aanvang/_Einde |
| 2 | **Opvoer enkelvoudig GE** (vervanging) |  voert oude af, daarna INSERT nieuw |
| 3 | **Afvoer individueel GE** (hub) | Hub + alle actieve kinderen (_Data etc.) worden afgevoerd met compound scope |
| 4 | **Afvoer entiteit** (cascading) | Entiteit + alle onderliggende GE's/relaties worden recursief afgevoerd |
| 5 | **Correctie hub/data** | Entiteit+hub worden geskipt; alleen _Data wordt via voorgangers-mechanisme gewisseld |
| 6a | **Correctie legacy GE** |  → `ClearID()` → INSERT nieuw record |
| 7 | **Ongedaanmaking registratie** | Per wijziging: `ont-opvoer` (SET opvoer=NULL) of `ont-afvoer` (SET afvoer=NULL) |
| 8 | **Ongedaanmaking correctie** | Idem, maar toont hoe afvoer+opvoer van de correctie beide worden teruggedraaid |

Onderaan staat een samenvattende tabel met DB-operaties per scenario en een referentietabel naar de broncode.

---
