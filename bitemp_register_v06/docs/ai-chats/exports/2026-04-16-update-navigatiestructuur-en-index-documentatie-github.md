# Chat: Update navigatiestructuur en index documentatie GitHub

- **Datum**: 2026-04-16 08:37
- **Sessie-ID**: `1ba20078-0a44-424e-986e-dd712a3af401`
- **Berichten**: 2

---

## 🧑 User

Wil je de navigatiestructuur van de documentatie op github bijwerken?

Het begint bij deze readme, die hopeloos verouderd is.

**De focus ligt nu op bitemp_register_v06.**
De rest is 'de aanloop' daarnaartoe. Wil je dat laten reflecteren in de readme in de root van de repo?

Ook de index op web is denk ik erg verouderd. Zou je die ook willen nalopen?

---

## 🤖 Assistant

Nu heb ik het volledige beeld. Laat me de root README en de web/index.html bijwerken. 
```

```
Nu de web/index.html bijwerken met alle actuele pagina's (9 React páginas, correct port, etc.): 
```

```
Beide bestanden zijn bijgewerkt:

### 
- **v06 als primaire focus** — duidelijke kop met blockquote dat v06 de actieve versie is
- **Snelle navigatietabel** met links naar alle key docs (DEVLOOP, CODEGEN, OPENAPI, GraphQL, etc.)
- **Interactieve documentatie** sectie met Swagger/ReDoc/GraphiQL URLs op poort 8082
- **Korte "Wat is bitemporeel?"** intro
- **Overzicht mappen** opgesplitst in Actief / Archief (v01–v05) / SQL / Overig

### web/index.html
- **Alle 8 React-pagina's** toegevoegd (was 4): editor-v2, universum, IDE, publicatie, inhoud
- **API-documentatie** als aparte card: Swagger, ReDoc, GraphiQL, OpenAPI spec, Schema API
- **Diagnostiek** card: coverage, docs-endpoint
- **Poort gecorrigeerd** van 8080 naar 8082
- **Mobiel troubleshooting** ingekort (redundante links verwijderd)
- Verwijzing naar oude `editor.html` vervangen door `editor-v2.html`

---
