# Linked data — testbestanden

Testbestanden voor de linked-data-profielen (SHACL, SKOS, OWL) van Omnium Studio. Zie het plan
[2026-11-06 Linked data als M2](../../docs/plans/2026-11-06%20Linked%20data%20als%20M2%20—%20SHACL,%20SKOS,%20OWL%20(plan).md).

## Eerst: welk `.ttl`-bestand is wat?

Alle bestanden hier zijn **Turtle** (`.ttl`), maar Turtle is alleen het *schrift*. Welke taal erin
staat, zie je aan de woorden die het gebruikt (`owl:`, `skos:` of `sh:`). Zo is het met JSON ook:
een `.json` kan een OpenAPI-document zijn, een `package.json` of een V3-export.

| Taal | Zegt | Voorbeeld voor ODRL | In Omnium |
|---|---|---|---|
| **OWL / RDFS** | *wat er bestaat*: soorten dingen en hun eigenschappen | [`ODRL22.ttl`](https://www.w3.org/ns/odrl/2/ODRL22.ttl) (W3C, de vocabulaire) | het canonieke model: entiteiten, gegevenselementen, relaties, generalisatie |
| **SKOS** | *hoe de begrippen heten en samenhangen*: begrippenlijsten | [`odrl-core-profile-22.ttl`](https://github.com/w3c/odrl/blob/master/core-profile/odrl-core-profile-22.ttl) (W3C, alleen de lijst "deze termen horen bij de kern") | enumeraties, waardelijsten |
| **SHACL** | *wanneer het klopt*: regels voor de data | `odrl22-kern.shacl.ttl` (hier, zelf gemaakt) | kardinaliteiten en validatie (de 422 van het register) |
| **data** | de gevallen zelf | een ODRL-beleid, bv. de Toegangsspraak-export | M0: wat in het register staat |

In Omnium zitten die drie samen in één canoniek model; in linked data zijn het drie talen, vaak in
drie bestanden. W3C levert voor ODRL de vocabulaire (OWL) en de kernlijst (SKOS), maar **geen
SHACL**: de regels staan alleen als tekst in het [Information Model](https://www.w3.org/TR/odrl-model/).
Dat gat vult `odrl22-kern.shacl.ttl`.

Een beleid controleren vraagt dus: het beleid, `odrl22-kern.shacl.ttl` als shapes, en `ODRL22.ttl`
erbij als vocabulaire. Het core profile is daarvoor niet nodig. In de Studio krijgt elke taal zijn
eigen profiel: SHACL (klaar), SKOS (fase 4), OWL (fase 5). Een OWL- of SKOS-bestand in het
SHACL-profiel geeft daarom "geen enkele shape gevonden"; de triples blijven bewaard.

**Waarom beleid met SHACL controleren?** ODRL is een uitwisselformaat: een beleid gaat van het ene
systeem naar het andere (FTV, dataspaces) en wordt daar uitgevoerd. Een beleid dat niet aan het
model voldoet, kan elders anders uitgelegd worden. Valt bijvoorbeeld een constraint weg omdat de
`leftOperand` ontbreekt, dan geeft de permission meer dan bedoeld. SHACL is de standaardmanier
om dat vóór uitvoering vast te stellen, met dezelfde regels in elk hulpmiddel (pyshacl, SHACL Play,
Jena). Voor Omnium zelf toetst het onze eigen export (zie de proef hieronder, die vond de
`partOf`-fout). Wie beleid alleen in Omnium schrijft, heeft het minder nodig: de
Toegangsspraak-lezer controleert al bij het schrijven.

## Bestanden

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
diagram: 14 node shapes, vier klassen (`odrl:LeftOperand`, `odrl:Operator`, `odrl:RightOperand`, `odrl:Set`), drie
constraints (twee `sh:xone`, één `sh:sparql`), zes overervingspijlen en geen meldingen. Een
bestand met de valkuilen uit het plan (§11) geeft na het lezen een lijst meldingen.

De kern bevat ook de klassehiërarchie uit `ODRL22.ttl` (`odrl:Set rdfs:subClassOf odrl:Policy`,
`odrl:Permission rdfs:subClassOf odrl:Rule`, …). Voor de validatie doet die niets: SHACL volgt
`rdfs:subClassOf` alleen in de data, daarom staan de doelklassen bij elke shape expliciet. Hij is er
voor de lezer en het diagram. De operanden die alleen in een `sh:xone` stonden (`rightOperand`,
`rightOperandReference`, `or`/`xone`/`and`/`andSequence`) staan er ook als property shape
zonder eigen voorwaarde, zodat ze in de shape te zien zijn. `rightOperand` wijst daarbij, zoals
in het W3C-model, naar `odrl:RightOperand`, maar met `sh:deactivated true`: de waarde mag ook
een literal of een willekeurige IRI zijn, dus die regel keurt niets af en is alleen documentatie.
Aantal en klasse van `leftOperand` en `operator` staan in één property shape (één regel in het
diagram, één melding die beide noemt). RuleShape heeft ook `odrl:failure`
(de abstracte eigenschap tussen regels waar `remedy` en `consequence` onder vallen), met
`sh:class odrl:Rule`; dat vraagt ODRL22.ttl in de data, anders is een Duty geen Rule.

**Vier aanzichten.** Het ODRL-model is één grote "printplaat": bijna alles wijst naar Party, Asset,
Action en Constraint. W3C knipt het daarom in vier figuren (`w3c/poe`, `model/00Model` …
`03Shared`). Dezelfde indeling in de Studio, als vier diagrammen op dezelfde elementen: *00 Model —
overzicht*, *01 Constraint* (Rule, Action, Asset, Party en collecties, Constraint, LogicalConstraint,
LeftOperand, Operator, RightOperand), *02 Rule* (Policy, Rule, Permission, Prohibition, Duty) en *03 Shared*
(Policy, Rule, Action, Asset, Party).

*Exporteer SHACL (Turtle)…* schrijft het model terug. Lezen en weer schrijven geeft dezelfde
graaf (niet dezelfde tekst: commentaar en volgorde gaan verloren). Controle met rdflib:

```python
from rdflib import Graph
from rdflib.compare import isomorphic
a = Graph().parse("odrl22-kern.shacl.ttl"); b = Graph().parse("geexporteerd.ttl")
print(isomorphic(a, b))   # True
```

## ODRL 2.2 als UML

W3C publiceert voor ODRL geen XMI of ander UML-model: alleen de tekeningen in het
[Information Model](https://www.w3.org/TR/odrl-model/) (OmniGraffle-SVG's, 2017). De SHACL-kern
ligt het dichtst bij UML. Zo krijg je er een klassendiagram van:

1. Modelleren ▸ Transformeren ▸ *Importeren*: `odrl22-kern.shacl.ttl` met
   *SHACL (Turtle) → SHACL-model* in een map.
2. Op die map ▸ *Transformeren*: *SHACL-shapes → canoniek model (UML)*, met een doelmap.

Uitkomst: 18 entiteiten (Policy ▷ Set, Offer, Agreement; Rule ▷ Permission, Prohibition, Duty;
Asset, Party, hun collecties, Action, Constraint, LogicalConstraint, LeftOperand, Operator,
RightOperand), 31 relaties met kardinaliteit, de enumeratie PolicyConflict en de regels die niet in een
klassendiagram passen als constraint (`{precies één van rightOperand, rightOperandReference}`).
Een shape voor meer klassen (RuleShape) wordt een supertype. Definities uit `ODRL22.ttl` volgen
met het OWL-profiel.

**En terug.** *Canoniek model → SHACL-shapes* op die doelmap geeft de kern weer, als dezelfde graaf
(controle met rdflib zoals hierboven). Het CM onthoudt per onderdeel de oorspronkelijke SHACL;
wat je in het CM wijzigt (een kardinaliteit, een veld, een nieuwe entiteit), wordt opnieuw
afgeleid, de rest gaat letterlijk terug. Nieuwe termen komen in `ok:`, niet in `odrl:`. Een in
het CM gewijzigde constraint (xone, sparql) is niet terug te vertalen: de oorspronkelijke blijft.

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
ODRL-AP-NL-vocabulaire ontbreekt hier). De eerste is opgelost op 08-11: een registerpad met delen
eronder is nu `odrl:AssetCollection`. Wat overblijft, zijn termen uit ODRL-AP-NL zonder type
(`apnl:rolAanvrager`, `apnl:verwerkingsverzoek`, `apnl:conformsToPolicy`); die verdwijnen met
de AP-NL-vocabulaire erbij.
