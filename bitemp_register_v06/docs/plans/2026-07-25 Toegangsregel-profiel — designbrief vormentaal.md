# Designbrief: vormentaal voor het toegangsregel-profiel

**Voor:** design-agent (Omnium Studio-huisstijlcontext)
**Van:** werkgroep Register Toegangsbeleid / Toegangsspraak-team
**Datum:** 2026-07-25
**Context vooraf lezen:** `2026-07-24 Toegangsregel-profiel (ontwerp).md` (§2
elementtypen, §7 besluiten), `docs/diagrammen/Toegangsregel.svg` (metamodel),
`docs/TOEGANGSSPRAAK.md` (§1 wat de taal is).

---

## De vraag

Ontwerp een **vormentaal** voor de elementen en lijnen van het
toegangsregel-profiel op de Omnium Studio diagram-motor, zodat elementtypen
**zonder kleurkennis herkenbaar** zijn. Nu zijn alle elementen rechthoeken en
is kleur de enige onderscheiding — wie het palet niet uit het hoofd kent (of
kleurenblind is) kan de typen niet uit elkaar houden.

Voorkeur van de werkgroep: **onderscheidende vormen per elementtype**
(silhouet-herkenning); symbolen/iconen als aanvulling waar een eigen vorm te
zwaar is. Kleur blijft bestaan als tweede laag en moet blijven sporen met de
tekst-ontleding (zie palet hieronder).

## Wat het is (één alinea domein)

Een *policy* (toegangsbeleid) omvat *toegangsregels* in klare taal: "*een
schuldhulpverlener* (subject) **mag** *de inkomensgegevens* (gegevensselectie)
*bekijken* (handeling) **als** [voorwaardenboom met en/of-poorten] **waarbij**
[plichten]". Begrippen zijn herbruikbare definities; mappen ordenen; en
gegevensselecties *verwijzen* cross-profiel naar het canoniek datamodel.
Doelgroep van de diagrammen: beleidsmakers en auditors — geen UML-lezers.

## Te ontwerpen: 10 elementtypen

| Elementtype | Betekenis | Huidige kleur (= tekst-ontleding) | Hint/associatie |
|---|---|---|---|
| Policy | het beleid als geheel (top-level) | `#e0e7ff` indigo | document/kop |
| Map | ordening (package/folder) | `#f1f5f9` | folder-tab? |
| Toegangsregel | één regel; draagt **mag / mag niet** | wit + band `#16a34a` groen / `#dc2626` rood | kaart; verbod ⃠ |
| Subject | wie (rolgroep/kenmerken) | `#d3f2d4` groen | persoon |
| Handeling | bekijken/veranderen/exporteren… | `#ffe1c7` oranje | werkwoord/pijl |
| Gegevensselectie | welke gegevens (van-keten) | `#fdf0a8` geel | data; draagt ▦ cross-profiel-verwijzing |
| Voorwaardepoort | alle / ten minste één / precies één | `#ecdcf7` paars | poort (vgl. BPMN-gateway ◇) |
| Voorwaarde | één vergelijking (links-op-rechts) | `#ecdcf7` paars | conditie |
| Plicht | verplichting (loggen, pseudonimiseren) | `#d2f0ea` zeegroen | vlag ⚑ |
| Begrip | herbruikbare definitie | `#e2e8f0`, gestippelde rand | woordenboek |

## Te ontwerpen: 9 lijntypen

| Connector | Semantiek | Huidig |
|---|---|---|
| omvat | policy ◇→ regel (aggregatie, herbruikbaar) | open ruit, solid |
| bevat | map ◆→ inhoud (ordening, hiërarchie) | dichte ruit, solid |
| wie / doet / op | de kernzin-keten | solid, dichte pijl |
| als | regel → voorwaarden | dash-6-3 |
| tak | poort → kind | solid |
| waarbij | regel → plicht | dash-6-3 |
| verwijst naar | selectie/begrip → begrip of ander profiel | dash-4-4, open pijl |

Vraag hier: zijn deze lijnstijl-keuzes voldoende onderscheidend en conform
verwachting (UML/ArchiMate-lezers vs. leken), en welke **labels/markers**
horen erbij?

## Randvoorwaarden

1. **Betekenis nooit alleen in kleur** (kleurenblind-veilig). Het
   verbod ("mag niet") heeft al band + tekstlabel + ⃠; trek die lijn door.
2. **Consistentie met de tekst**: de kleuren zijn identiek aan de
   zinsontleding in de teksteditor (zelfde beleidsregel, twee weergaven).
   Vormen mogen dat versterken, niet vervangen.
3. **Technisch kader motor**: elementen hebben nu shape `rect`/`note`;
   profielen kunnen **eigen SVG-shapes** registreren (vgl.
   `diagramprofielen/archimate/shapes.jsx` — eigen vormenset per profiel is
   dus haalbaar). Lijnen: solid/dash-6-3/dash-4-3/dash-4-4; markers:
   driehoek/pijl-open/pijl-dicht/bol/ruit/ruit-open. Vormen moeten klein
   leesbaar blijven (±180×60 px op canvas) en een **16px boom-icoon**-variant
   hebben voor de projectboom.
4. **Huisstijl**: Omnium Studio (gradient `#60a5fa → #6366f1 → #22d3ee` als
   merkaccent; rustig, NL-overheids-nabij). Geen UML-jargon in labels.
5. Inspiratiebronnen die de doelgroep (deels) kent: BPMN-gateways (◇ voor de
   poorten?), ArchiMate-iconen rechtsboven in het element, DMN-beslistabellen.

## Gevraagde deliverables

1. **Vormvoorstel per elementtype** — schets/SVG-beschrijving + rationale
   (waarom herkenbaar, hoe het silhouet verschilt van de andere negen).
2. **Lijnen-tabel** — per connector: lijnstijl, markers, label-plaatsing.
3. **Boom-iconen** (16px) per elementtype, consistent met de vormen.
4. **Kleurenblind-check** — beoordeel het bestaande palet (deuteranopie/
   protanopie/tritanopie) en stel bij waar vorm+kleur samen nog niet
   onderscheidend genoeg zijn.
5. **Implementatie-aanwijzing** — mapping naar de shapes-conventie van de
   motor (welke vormen als custom SVG-shape, welke als icoon-in-rect).

Eén A4-antwoord per deliverable is genoeg; schetsen mogen ASCII/SVG. Bij
twijfel: kies leesbaarheid voor leken boven notatie-traditie.
