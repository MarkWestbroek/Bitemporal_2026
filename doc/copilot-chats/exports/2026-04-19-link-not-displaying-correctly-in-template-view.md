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



*Searched for regex `weergave_definitie|WeergaveDefinitie|template|markdown` (`**/bitemp_register_v06/web/vite/src/**`), 20 results · Searched for files matching `**/bitemp_register_v06/web/vite/src/**/*weergave*`, 3 matches · Searched for regex `weergave_definitie|WeergaveDefinitie|template.*render|renderTemplate|mustache|handlebars` (`**/bitemp_register_v06/web/vite/src/**`), 20 results · Read useWeergaveDefinitie.js, lines 1 to 100*



<details>
<summary><em>Semantic workspace search is not currently available</em> (+7 meer)</summary>

- Semantic workspace search is not currently available
- Searched for files matching `**/bitemp_register_v06/web/vite/src/**/*.{jsx,tsx,vue,js,ts}`, 20 matches
- Searched for regex `weergave_definitie|WeergaveDefinitie|template|markdown` (`**/bitemp_register_v06/web/vite/src/**`), 20 results
- Searched for files matching `**/bitemp_register_v06/web/vite/src/**/*weergave*`, 3 matches
- Searched for regex `weergave_definitie|WeergaveDefinitie|template.*render|renderTemplate|mustache|handlebars` (`**/bitemp_register_v06/web/vite/src/**`), 20 results
- Read useWeergaveDefinitie.js, lines 1 to 100
- Read PublicatieDetail.jsx, lines 1 to 200
- Read PublicatieDetail.jsx, lines 200 to 300
</details>

I can see the issue. The `markdownNaarHtml` function in `PublicatieDetail.jsx` handles headers, bold, italic, lists, and tables — but not markdown links `[text](url)`. I need to add link conversion. 

*Read PublicatieDetail.jsx, lines 110 to 155*


De fix is eenvoudig: `markdownNaarHtml` miste een stap voor markdown-links. Ik heb deze toegevoegd vóór bold/italic:

- **Pattern**: `\[([^\]]+)\]\(([^)]+)\)` → `<a href="..." target="_blank" rel="noopener noreferrer">...</a>`
- **Veiligheidscheck**: alleen `http:`, `https:`, `mailto:` en relatieve URLs (`/`) worden omgezet; `javascript:` en `data:` URLs worden als platte tekst gelaten

Na de save herlaadt Vite automatisch. Refresh de pagina op `http://localhost:5174/viz/react/inhoud.html#/t/weergave_definities/2` om het resultaat te zien.

---
