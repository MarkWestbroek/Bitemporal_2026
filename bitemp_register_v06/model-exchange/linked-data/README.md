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

## In de Studio

Het profiel *SHACL* (preview, via Modelleren en de instellingen bereikbaar, zoals GraphQL) ▸ menu *Importeer SHACL (Turtle)…* leest `odrl22-kern.shacl.ttl` als
diagram: 14 node shapes, twee klassen (`odrl:LeftOperand`, `odrl:Operator`), drie constraints
(twee `sh:xone`, één `sh:sparql`) en geen meldingen. Een bestand met de valkuilen uit het plan
(§11) geeft na het lezen een lijst meldingen.

*Exporteer SHACL (Turtle)…* schrijft het model terug. Lezen en weer schrijven geeft dezelfde
graaf (niet dezelfde tekst: commentaar en volgorde gaan verloren). Controle met rdflib:

```python
from rdflib import Graph
from rdflib.compare import isomorphic
a = Graph().parse("odrl22-kern.shacl.ttl"); b = Graph().parse("geexporteerd.ttl")
print(isomorphic(a, b))   # True
```

## Proef: Toegangsspraak → ODRL tegen de kern

Exporteer een beleid naar ODRL (Toegangsverlening), voeg de ODRL-vocabulaire toe en valideer:

```python
from rdflib import Graph
g = Graph(); g.parse("beleid.odrl.ttl"); g.parse("ODRL22.ttl"); g.serialize("beleid+vocab.ttl")
```

```sh
pyshacl -s odrl22-kern.shacl.ttl -a beleid+vocab.ttl
```

Stand 07-11: twee meldingen per beleid (zie het plan, fase 3): een `odrl:partOf` naar een
`odrl:Asset` die geen `odrl:AssetCollection` is, en `apnl:rolAanvrager` zonder type (de
ODRL-AP-NL-vocabulaire ontbreekt hier).
