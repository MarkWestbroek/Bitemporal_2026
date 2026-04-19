# Chat: Link not displaying correctly in template view

- **Datum**: 2026-04-19 22:51
- **Sessie-ID**: `92839cd5-d5d9-4fd5-b495-72a2bf9bdc29`
- **Berichten**: 2

---

## 🧑 User

in de detail weergave template op http://localhost:5174/viz/react/inhoud.html#/t/weergave_definities/2

wordt:

[Website]({{producten.website}}) 

niet als link weergegeven.

In de editor op http://localhost:5174/viz/react/inhoud.html#/t/weergave_definities/2 wel

---

## 🤖 Assistant

I can see the issue. The  function in  handles headers, bold, italic, lists, and tables — but not markdown links . I need to add link conversion. 
```

```
De fix is eenvoudig:  miste een stap voor markdown-links. Ik heb deze toegevoegd vóór bold/italic:

- **Pattern**: `\[([^\]]+)\]\(([^)]+)\)` → 
- **Veiligheidscheck**: alleen `http:`, `https:`, `mailto:` en relatieve URLs (`/`) worden omgezet; `javascript:` en  URLs worden als platte tekst gelaten

Na de save herlaadt Vite automatisch. Refresh de pagina op `http://localhost:5174/viz/react/inhoud.html#/t/weergave_definities/2` om het resultaat te zien.

---
