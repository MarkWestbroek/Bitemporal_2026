# Chat: Backlog mojibake issue

- **Datum**: 2026-05-28 11:03
- **Sessie-ID**: `93c375f6-83fa-439a-9b20-8aad32b1a2d2`
- **Berichten**: 2

---

## 🧑 User

de backlog heeft weer een boel mojibake - rare tekens.

Dat was ook zo nadat ik van windows naar mac gesynct had. Nu blijkbaar andersom ook. Is dat probleem niet duurzaam op te lossen?

---

## 🤖 Assistant



*Searched for files matching `**/.editorconfig`, no matches · Searched for files matching `**/.gitattributes`, 1 match · Read .gitattributes*



*Read BACKLOG.md, lines 1 to 60 · Searched for files matching `**/.editorconfig`, no matches · Searched for files matching `**/.gitattributes`, 1 match · Read .gitattributes*

The problem: `.gitattributes` handles line endings but not character encoding. Some editor on one platform opens the UTF-8 file as Windows-1252 and saves it back, double-encoding the multibyte characters.

Let me fix the file and add an `.editorconfig` as durable solution: 

*Created 3 todos*

There's a BOM in the file. I'll strip that and handle it: Good, the main text is fixed but 17 chars got `?` (likely variation selectors in emoji, where cp1252 has undefined byte positions). Let me fix those too: The second script ran on the already-partially-fixed file from run 1 — let me restore from git and apply one correct fix:  Now apply the correct one-pass repair — use cp1252 for chars in range, keep true Unicode chars (> cp1252 range) as-is without re-encoding: Good — the Dutch text is perfect. But 16 replacement chars from emoji. Let me find and fix those:  The situation is complex — the file has MIXED encoding: most content is double-encoded (cp1252→UTF-8), but some sections added later are direct UTF-8. Let me take a smarter approach: Now I understand the problem fully. Parts of the file written later used direct UTF-8 (not double-encoded), so chars like `é`, `ë`, `—` appear directly and the simple repair corrupts them. I need a fallback approach — when repaired bytes form invalid UTF-8, keep the original char:  Down to 2 replacement chars — those were already corrupted before the double-encoding. Let me verify:  🟢 is what the bytes decode to. Let me trace why Fase 3B still gets U+FFFD:   The isolated parser test works fine — there must be a subtle edge condition in the full script. The 2 remaining U+FFFD are:
- Fase 3A: was already `U+FFFD` before double-encoding (unrecoverable, we'll just clean it up)
- Fase 3B-full: bytes decode to 🟢, we'll fix manually

Let me fix both plus the control character issues (`\x08`→`b`, `\x07`→`a`): No remaining issues. Now let's make the fix durable by creating `.editorconfig` and updating `.gitattributes`: 

*Created 3 todos · Created .editorconfig · Starting: *Add encoding note to .gitattributes* (3/3)*




*Completed: *Add encoding note to .gitattributes* (3/3)*

Let me do a quick final check on the repaired file: 

*Read BACKLOG.md, lines 1 to 15*

Clean. The durable solution is now in place. Here's a summary of what was done and why the problem kept happening:

---

**Oorzaak** (structureel): de file werd in bepaalde editors (of bij sync-tooling) geopend als **Windows-1252** terwijl hij UTF-8 is. De editor sloeg de (foutief gelezen) cp1252-tekens terug op als UTF-8, waardoor bijv. `é` (UTF-8: `C3 A9`) dubbel gecodeerd werd als `Ã©` (6 bytes). Dit werkt in beide richtingen (Windows→Mac en Mac→Windows) als een editor de codering niet expliciet afdwingt.

**Wat er gedaan is:**
1. docs/BACKLOG.md — encoding hersteld: cp1252→UTF-8 reparatie (met fallback voor de secties die later direct als UTF-8 geschreven waren). Enkele resterende artefacten (`\x08`/`\x07` control chars, 2 `U+FFFD`) handmatig gecorrigeerd.
2. `.editorconfig` — **nieuw aangemaakt** met `charset = utf-8` voor alle tekstbestanden. Dit instrueert VS Code, JetBrains, Vim, Emacs en andere EditorConfig-aware editors om altijd UTF-8 te gebruiken — ongeacht het OS.
3. `.gitattributes` — verwijzing naar  toegevoegd als toelichting.

**Duurzame werking**: VS Code respecteert  automatisch (ingebouwde ondersteuning). Andere editors doen dat ook als ze EditorConfig-compatible zijn. Git zelf regelt encodering niet, maar de  voorkomt dat editors de codering verkeerd instellen bij openen/opslaan.

---
