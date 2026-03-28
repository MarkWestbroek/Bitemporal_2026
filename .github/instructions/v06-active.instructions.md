---
description: "Use when working in the active v06 codebase under bitemp_register_v06. Reinforce that v06 is the main target, v05 is reference only, and changes should preserve the MetaRegistry-driven and schema-driven architecture."
applyTo: "bitemp_register_v06/**"
---

# v06 actieve context

- `bitemp_register_v06/` is de primaire ontwikkelversie.
- Gebruik `bitemporal_go_API_v05/` alleen als referentie of vergelijking, tenzij de gebruiker expliciet om v05 vraagt.
- Behoud de dynamische opzet via MetaRegistry, generieke handlers/routes en schema-gedreven frontend.
- Bij modelwijzigingen horen ook de bijbehorende metadata, onderliggende relaties, database-setup en documentatie te worden bijgewerkt.
- Houd domeintermen in het Nederlands aan in code, comments en documentatie, behalve waar Go- of HTTP-conventies anders sturen.
- Gebruik waar passend de bestaande workspace taken voor verificatie, vooral de v06 Go-test- en Vite-buildtaken.