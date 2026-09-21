# Chat: Backlog encoding issue

- **Datum**: 2026-05-21 12:05
- **Sessie-ID**: `3800d61e-a768-447c-ab15-7e13d7ca0d6e`
- **Berichten**: 2

---

## 🧑 User

Er is iets raars met de backlog gebeurd
O.a.
```
| F19 | âœ… Betekenisvolle gegevenstypen (MIM): presentatie-datatypes + weergave-hints | F1-Q1Q2Q3 plan |
| F20 | âœ… API endpoint `/api/viz/schema/datatypes` | F1-Q1Q2Q3 plan |
| F21 | âœ… SchemaFormField: widget-rendering op basis van datatype weergave-hints | F1-Q1Q2Q3 plan |
| F22 | âœ… Custo
```

op veel plekken staat `âœ… `

Ik denk dat het een groen vinkje was, maar dat is nu dus deze volgorde van tekens.

Is ergens de encoding gewijzigd?

Ik ben nu van windows naar mac, maar dat was nooit een probleem. Iets in github? Iets met de versie van Visual Studio? Mermaid is nu ondersteund in markdown. Is er iets gewijzigd?

Hoe dit te herstellen? De groene vinkjes zijn belangrijke informatie! Ze betekenen dat een backlogitem is uitgevoerd, dus ze staan er niet alleen voor de sier!!

---

## 🤖 Assistant

Laat me eerst het bestand inspecteren om de omvang te bepalen. Duidelijk diagnose: het bestand heeft **mojibake** — UTF-8 tekst is op een moment als Windows-1252 ingelezen en vervolgens opnieuw als UTF-8 opgeslagen. Er zijn **156× `✅`**, **116× `—`**, **63× `→`**, en nog veel meer aangetast. Het bestand is gemengd: sommige tekens zijn al correct, andere zijn dubbel-gecodeerd.

Ik maak eerst een backup en herstel daarna alle bekende patronen: Het terminal-heredoc escapet de unicode tekens zelf ook. Ik schrijf het script eerst naar een bestand: Het probleem is dat mijn tool de "slechte" tekens zelf ook beschadigt. Ik gebruik een aanpak waarbij ik de mojibake mathematisch afleid: 509 vervangingen, uitstekend. Er is nog 1 mogelijk restant. Laat me dat controleren:  `GEÃ\x8fMPLEMENTEERD` moet `GEÏMPLEMENTEERD` zijn. De `Ï` (U+00CF) heeft een byte `0x8F` in Windows-1252 die niet bestaat — dat slip door mijn script heen. Ik fix het handmatig:  Alles hersteld. Laat me een laatste spot-check doen en de backup opruimen: Alles hersteld. Samenvatting:

**Wat er was:** classic *mojibake* — de UTF-8 bytes van het bestand zijn ooit door een editor ingelezen alsof het Windows-1252 was, en daarna opgeslagen als UTF-8. Resultaat: `✅` (3 bytes: `E2 9C 85`) werd `âœ…` (6 bytes als UTF-8-heropgeslagen Windows-1252-tekens).

**Waarschijnlijke oorzaak:** Git op Windows heeft soms `core.autocrlf` ingesteld en sommige editors (oudere Notepad++, bepaalde VS Code extensies) kunnen bij commit/checkout de encoding mis-detecteren — met name als het bestand geen BOM heeft. De overgang Windows→Mac zelf is onschuldig; de schade was al eerder aangericht.

**Resultaat herstel:**
- **167×** `✅` hersteld  
- **63×** `→`, **116×** `—`, **63×** `é` en tientallen andere tekens
- **510 vervangingen** in totaal, geen verdachte restanten meer

**Preventie voor de toekomst:** in VS Code staat linksonder de encoding vermeld. Als je `UTF-8` ziet, is het goed. Zorg dat je  bevat:
```
*.md text eol=lf
```
Dit voorkomt dat Git op Windows CRLF-conversies doorvoert die encoding-detectie kunnen  bevat:
```
*.md text eol=lf
```
Dit voorkomt dat Git op Windows CRLF-conversies doorvoert die encoding-detectie kunnen verstoren.

---
