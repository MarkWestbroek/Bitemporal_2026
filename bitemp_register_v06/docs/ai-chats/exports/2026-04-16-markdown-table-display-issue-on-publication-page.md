# Chat: Markdown table display issue on publication page

- **Datum**: 2026-04-16 14:40
- **Sessie-ID**: `52835bce-3ff9-418b-8c50-5ac51c27cf86`
- **Berichten**: 10

---

## 🧑 User

Deze markdown

```
# {{producten.data.naam}}
## {{producten.data.type}}

|**Korte omschrijving**|**Fase initiatief**|**Common Ground La(a)g(en)|
| | |
|{{producten.data.omschrijving}}|{{planningen.data.fase}}|{{producten.data.CG_laag}}|
| | |

| Column 1 | Column 2 |
| -------- | -------- |
| Text | Text |

**Pitch:** {{producten.data.pitch}}
**Website:** {{producten.data.website}}
```

wordt op de publicatiepagina zo weergegeven: zie img

Ik zie de tabelweergave niet terug

---

## 🤖 Assistant

Ik ga nu eerst de rendering-keten van de publicatiepagina in v06 nalopen om te zien waarom deze markdown-tabel niet als tabel wordt geparsed, en daarna pas ik gericht de template of parser-config aan en verifieer ik in de 

---

## 🧑 User

ja, graag (de replay file aanpassen), en wil je de markdown in een codeblok geven, zodat ik het nu kan copy en pasten?

---

## 🤖 Assistant

Ik ga nu direct de replay-file aanpassen met de correcte tabelsyntax en daarna geef ik je dezelfde markdown in één copy/paste codeblok. Eerst zoek ik de exacte template-entry op in de replay JSON zodat ik heel gericht kan patchen.

---

## 🧑 User

die file is het niet....

---

## 🤖 Assistant

Helder, dan pak ik meteen de juiste bron: ik lees nu de zoekoutput uit en ga de exacte replayfile lokaliseren op basis van jouw specifieke template-string, daarna pas ik alleen die file aan.

---

## 🧑 User

deze is het wel

---

## 🤖 Assistant

Helder, dank voor de correctie. Ik pak nu direct het juiste spoor: ik zoek de exacte markdown-template in de replaybestanden onder bitemp_register_v06/replay files en patch daarna dat bestand, plus ik geef je meteen de copy/paste markdown in een codeblok.

---

## 🧑 User

in de weergave in publicatie wordt `API&#39;s &amp; opslag` getoond, terwijl er in de API repsonse gewoon `API's &` staat. Het moet natuurlijk gewoon als ' en & getoond worden

---

## 🤖 Assistant

Ik ga nu gericht de template-render in de publicatiepagina nalopen, want dit is typisch dubbele HTML-escaping; daarna patch ik de renderfunctie zodat placeholders met gewone tekst worden ingevuld en alsnog veilig blijven.Ik heb de oorzaak bevestigd: placeholders worden nu al ge-escaped vóór markdown-rendering en daardoor krijg je entity-tekst te zien. Ik ga één gerichte fix doen in de template-renderer zodat escaping maar één keer gebeurt.
```

```

```

```
Klopt, dat moest inderdaad niet zo zijn. Dit was dubbele escaping in de publicatie-render.

Ik heb het gefixt in:
- 

Wat aangepast is:
- In  worden placeholderwaarden nu als gewone tekst ingevoegd (geen extra  meer).
- Escaping blijft centraal in , dus het blijft veilig, maar zonder entity-tekst in beeld.

Resultaat:
- `API's &` wordt nu ook echt zo weergegeven op de publicatiepagina, in plaats van `API&#39;s &amp;`.

Daarnaast heb ik de wijziging gedocumenteerd in:
- 

Validatie:
- Frontend build (v06) draait succesvol zonder fouten.

---
