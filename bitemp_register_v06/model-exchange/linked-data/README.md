# Linked data — testbestanden

Testbestanden voor de linked-data-profielen (SHACL, SKOS, OWL) van Omnium Studio. Zie het plan
[2026-11-06 Linked data als M2](../../docs/plans/2026-11-06%20Linked%20data%20als%20M2%20—%20SHACL,%20SKOS,%20OWL%20(plan).md).

| Bestand | Wat |
|---|---|
| `odrl22-kern.shacl.ttl` | kern van het [ODRL 2.2-informatiemodel](https://www.w3.org/TR/odrl-model/) als SHACL (een M1 in de taal SHACL) |
| `odrl22-kern.goed.ttl` | ODRL-beleid dat klopt; verwacht `conforms = true` |
| `odrl22-kern.fout.ttl` | negen gevallen met elk één bekende fout; de verwachte melding staat in het commentaar |

Voor OWL en SKOS dient de officiële vocabulaire [ODRL22.ttl](https://www.w3.org/ns/odrl/2/ODRL22.ttl)
(OWL, RDFS en SKOS in één bestand); die staat hier niet als kopie.

## Controleren

Met [pyshacl](https://github.com/RDFLib/pySHACL) (gecontroleerd met 0.40.2):

```sh
pyshacl -s odrl22-kern.shacl.ttl -m -a odrl22-kern.goed.ttl   # Conforms: True
pyshacl -s odrl22-kern.shacl.ttl -m -a odrl22-kern.fout.ttl   # Conforms: False, 10 meldingen
```

`-m` controleert ook de shapes zelf (meta-SHACL), `-a` zet `sh:sparql` aan. Het foute bestand
geeft negen overtredingen (F1–F5, F7 dubbel, F8, F9) en één waarschuwing (F6).

`sh:class` vraagt dat de data het `rdf:type` van een waarde kent. Voor vocabulairetermen
(`odrl:use`, `odrl:eq`, …) staan de typen in de testdata; bij echt beleid geef je ODRL22.ttl
mee als ontologie (`-e ODRL22.ttl`).
