# Chat Instructies

Deze map bevat aanvullende, gerichte instructies voor GitHub Copilot Chat.

De hoofdinstructies blijven staan in [.github/copilot-instructions.md](../copilot-instructions.md). Die file is leidend voor de hele workspace. De bestanden in deze map zijn aanvullend en zijn bedoeld om sneller de juiste context te laden voor het deel van de repo waar je in werkt.

## Huidige indeling

- `v06-active.instructions.md`: extra context voor werk in `bitemp_register_v06/`
- `v05-reference.instructions.md`: extra context voor werk in `bitemporal_go_API_v05/`

## Aanbevolen chat-start

Voor een nieuwe chat werkt deze volgorde het best:

1. Open eerst een bestand in het deel van de repo waar je aan werkt.
2. Start daarna pas de chat, zodat file-scoped instructies meteen relevant zijn.
3. Noem in je eerste bericht expliciet het doel, het doelpad en of je alleen analyse of ook codewijzigingen wilt.

Compact startvoorbeeld voor v06:

```text
Werk in bitemp_register_v06 met v05 alleen als referentie.
Lees eerst de relevante code en noem daarna kort je plan.
Houd rekening met de MetaRegistry, dynamische schema/API-aanpak en documentatieplicht.
```

## Bestaande bronnen met extra chatcontext

- `prompts.txt`
- `bitemp_register_v06/docs/copilot-chats/`
- `bitemp_register_v06/json/instructies schrijven code voor registratie handler (1).txt`
- `bitemporal_go_API_v05/json/instructies schrijven code voor registratie handler (1).txt`

Als later meer herbruikbare startprompts nodig zijn, is `.github/prompts/` de logische volgende stap.