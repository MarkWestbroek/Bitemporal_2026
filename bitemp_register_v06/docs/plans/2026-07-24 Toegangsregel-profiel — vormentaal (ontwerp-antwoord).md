# Toegangsregel-profiel — vormentaal (ontwerp-antwoord)

**Antwoord op:** `2026-07-23 Toegangsregel-profiel — designbrief vormentaal.md`
**Van:** design-sessie Omnium Studio (Claude, vormgevingssessie-artifact agendapunt 10)
**Datum:** 2026-07-24
**Visueel:** het sessie-artifact, agendapunt 10 — vormenkaarten, "de zin als
diagram"-mockup, lijnen-tabel en 16px-boom-iconen.

## Leidend idee: de zin als silhouetten

Het diagram ís de Toegangsspraak-zin. Elk zinsdeel krijgt daarom een vorm die
zijn rol naspeelt, zodat een beleidsmaker het diagram "leest" zoals de zin —
zonder kleurkennis en zonder UML:

| Elementtype | Vorm | Rationale (silhouet-herkenning) |
|---|---|---|
| **Policy** | kopkaart met **boekrug** (dikke gevulde linkerband + kopregel) | het beleid is de kaft om de regels; de rug is op elk formaat uniek |
| **Map** | **hangmap** (bestaande package-shape) | zelfde ordening als overal in de studio |
| **Toegangsregel** | afgeronde **kaart met modaliteitsband** links; *mag* = effen band + "mag", *mag niet* = **diagonaal gearceerde** band + ⃠ + "mag niet" | de kaart is de regel; arcering + icoon + tekst dragen het verbod — nooit alleen rood (besluit §7) |
| **Subject** | **naambadge**: afgeronde rechthoek met clip-inkeping middenboven + persoon-icoon | "wie" = een pasje; de clip maakt het silhouet uniek t.o.v. alle andere rechthoeken |
| **Handeling** | **pijlblok** (rechthoek met punt rechts) | het werkwoord duwt de zin vooruit; chevron is voor leken "actie/stap" |
| **Gegevensselectie** | **gegevenscilinder** + ▦-badge rechtsboven bij cross-profiel-verwijzing | cilinder = gegevens is de breedst bekende dataconventie |
| **Voorwaardepoort** | **ruit** (BPMN-taal) met symbool **+** (alle) / **○** (ten minste één) / **×** (precies één), tekstlabel eronder | BPMN-lezers herkennen de gateway; leken lezen het label — symbool én woord |
| **Voorwaarde** | **vergelijkingsstrook**: chip met links · teken · rechts | de vorm toont de vergelijking zelf ("leeftijd ≥ 18") |
| **Plicht** | **vaandel** (zwaluwstaart rechts) met ⚑ | de verplichting "hangt aan" de regel als een wimpel |
| **Begrip** | **label/tag** (punt + oogje links), gestippelde rand | een herbruikbare definitie is een etiket dat je ergens aan hangt; gestippeld = referentie |

Kleur blijft exact het tekst-ontledingspalet (tweede laag, één bron).

## Lijnen

| Connector | Stijl + markers | Label | Waarom |
|---|---|---|---|
| `omvat` | solid · **◇ open ruit** aan policy-zijde | — | herbruikbaar (aggregatie) = open |
| `bevat` | solid · **◆ dichte ruit** aan map-zijde | — | ordening; consistent met de rest van de studio |
| `wie` / `doet` / `op` | **solid 2px · ▶ pijl-dicht** | woordchip "wie"/"doet"/"op" in de zinsdeel-kleur | de kernzin is de ruggengraat: dikste lijn, leesbare woorden |
| `als` | dash-6-3 · pijl-open | "als" | conditioneel = gestippeld |
| `tak` | solid 1.2px · geen marker | — | boomtak onder de poort; structuur, geen betekenis |
| `waarbij` | dash-6-3 · **● bol** | "waarbij" | zelfde dash als "als" wás niet onderscheidend → de bol lost dat op |
| `verwijst naar` | dash-4-4 · pijl-open | *"verwijst naar"* cursief | studio-brede referentie-stijl ($ref/gebruik) |

Alle markers bestaan al in de motor (◇ ◆ ▶ ● open pijl) — de lijnen zijn puur
descriptor-configuratie.

## Boom-iconen (16px)

Elf mini-silhouetten (16-raster, stroke 1.3, currentColor, één gevuld accent):
boekrug-kaart, hangmap, kaart-met-band (mag), kaart-met-⃠ (verbod), badge,
chevron, cilinder, poort-ruit, vergelijkingschip, vaandel, gestippelde tag.
Uitgetekend in het artifact; registratie via `registreerTypeIcoon` in een
profiel-eigen `toegangsregel/iconen.jsx`.

## Kleurenblind-check

- **Kritiek**: de mag/mag-niet-band (`#16a34a` vs `#dc2626`) is onder
  deuteranopie/protanopie vrijwel één doffe tint → opgelost met vorm:
  arcering + ⃠ + tekst "mag niet" (effen + "mag" aan de andere kant).
- **Botsende pastels**: subject-groen ↔ plicht-zeegroen ↔ selectie-geel
  (rood-groenblind), indigo ↔ paars (tritanopie). Juist die paren kregen de
  sterkst verschillende silhouetten (badge / vaandel / cilinder; kaft / ruit).
- **Palet laten staan**: de kleuren zijn gekoppeld aan de tekst-ontleding —
  met de vormenlaag erbij is bijstellen niet nodig. Optioneel, alleen als de
  teksteditor ooit meebeweegt: plicht-zeegroen → cyaan (#cffafe).

## Implementatie-aanwijzing

- **Eigen shapes** in `diagramprofielen/toegangsregel/shapes.jsx` (zelfde
  conventie als `archimate/shapes.jsx`): kaft, regelkaart (band + arcering +
  ⃠), badge, pijlblok, cilinder, poort-ruit (symbool + label), vergelijkings-
  strook, vaandel, tag. **Map = bestaande `package`-shape.**
- De arcering van het verbod als SVG-`<pattern>` in de shape; de ▦-badge op
  de cilinder alleen renderen als het element een cross-profiel-verwijzing
  draagt (data-veld).
- Lijnen: alleen `edgePresentatie` in de descriptor (stijlen/markers bestaan);
  woordchips via de bestaande edge-labels ("constraint"-soort, kleur per
  zinsdeel).
- Leesbaarheids-ondergrens op de 180×60-kaart: banden/inkepingen ≥ 10px,
  poortsymbolen ≥ 12px, badge-clip ≥ 16px breed.
- De Typering-toggle (agendapunt 9) werkt hier automatisch mee zodra de
  shapes `NodeTypering`/`dc-stereotype` gebruiken — maar dit profiel heeft
  geen stereotypen nodig: de vorm ís het type, de default kan "geen" zijn.
