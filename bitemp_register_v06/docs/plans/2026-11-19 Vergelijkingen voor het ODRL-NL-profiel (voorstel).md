# Vergelijkingen voor het ODRL-NL-profiel (voorstel)

**Voor:** werkgroep ODRL NL
**Van:** Omnium / Toegangsspraak (Mark Westbroek)
**Datum:** 19 november 2026
**Status:** voorstel ter bespreking

## Wat we voorstellen

Neem zeven vergelijkingen op in het profiel die ODRL 2.2 niet kent en die wij in de praktijk
nodig hadden. Voor één ervan bestaat in de FTV-voorbeelden al een tweede naam; dat is het
sterkste argument om ze in het profiel vast te leggen.

| Voorgestelde term | Label | Geldt als |
|---|---|---|
| `begintMet` | begint met | de tekst links begint met de tekst rechts |
| `eindigtOp` | eindigt op | de tekst links eindigt op de tekst rechts |
| `bevat` | bevat | de tekst rechts komt voor in de tekst links |
| `tussen` | ligt tussen | de waarde links ligt tussen twee grenzen, grenzen inbegrepen |
| `isBekend` | is bekend | de linkerterm heeft een waarde |
| `isOnbekend` | is onbekend | de linkerterm heeft geen waarde |
| `bestaat` | er is een … | een informatiepunt bevestigt dat het genoemde bestaat |

De namen zijn de namen die wij nu gebruiken. Ze zijn een startpunt: als de werkgroep andere
namen kiest, nemen wij die over.

## Waarom deze zeven

Ze komen uit Toegangsspraak, een gecontroleerde klare taal voor toegangsbeleid die wij naar
ODRL-AP-NL exporteren en er sinds kort ook uit terug kunnen lezen. Elke vergelijking in de taal
moet een term in ODRL hebben. Voor acht had ODRL die al; voor deze zeven niet, dus staan ze nu
in onze eigen woordenschat (`ts:`). Een eigen term werkt alleen binnen één implementatie: een
ander die ons beleid leest, kent hem niet en moet de voorwaarde laten vallen.

Dat is precies wat ons overkwam toen wij de FTV-voorbeelden inlazen. Het Vlierdam-voorbeeld
definieert drie eigen vergelijkingen:

| In Vlierdam | Betekenis daar | Bij ons |
|---|---|---|
| `vlierdam:aanwezig` ("is opgegeven") | de linkerterm komt in het verzoek voor; over de waarde zegt hij niets | hetzelfde begrip als `isBekend` |
| `vlierdam:nietOuderDan` | de datum links ligt niet verder terug dan de periode rechts (`xsd:duration`) | kennen wij niet |
| `vlierdam:binnen` | het tijdstip links valt in het benoemde tijdvenster rechts | kennen wij niet |

De eerste rij laat het probleem zien: twee implementaties, hetzelfde begrip, twee namen, en
geen van beide leest de ander. De andere twee zijn kandidaten die wíj zouden overnemen als het
profiel ze benoemt.

## De zeven, één voor één

In de voorbeelden is `apnl:` het profiel en `ex:` een willekeurig vocabulaire.

### `begintMet`, `eindigtOp`, `bevat`

- **Linkerterm:** tekst.
- **Rechterterm:** één tekst.
- **Betekenis:** de linkertekst begint met, eindigt op of bevat de rechtertekst. Wij vergelijken
  zonder onderscheid tussen hoofd- en kleine letters en zonder spaties aan begin en eind. Of
  dat in het profiel hoort, is een vraag voor de werkgroep (zie onderaan).
- **Heeft de linkerterm meer waarden**, dan geldt de voorwaarde als één ervan voldoet.

```turtle
ex:vw-achternaam a odrl:Constraint ;
    rdfs:label "de achternaam van de betrokkene begint met \"A\""@nl ;
    odrl:leftOperand ex:achternaam ;
    odrl:operator apnl:begintMet ;
    odrl:rightOperand "A" .
```

### `tussen`

- **Linkerterm:** getal of datum.
- **Rechterterm:** precies twee waarden, de onder- en de bovengrens, in die volgorde.
- **Betekenis:** ondergrens ≤ links ≤ bovengrens. Beide grenzen tellen mee.
- **Waarom niet twee voorwaarden met `gteq` en `lteq`?** Dat kan, en het is gelijkwaardig. Eén
  voorwaarde leest beter ("de leeftijd ligt tussen 18 en 67") en blijft bij elkaar in een
  viewer. Als de werkgroep de term niet wil, schrijven wij hem voortaan uit als twee
  voorwaarden.

```turtle
ex:vw-leeftijd a odrl:Constraint ;
    odrl:leftOperand ex:leeftijd ;
    odrl:operator apnl:tussen ;
    odrl:rightOperand ( 18 67 ) .
```

Wij schrijven de twee grenzen nu als twee losse waarden (`odrl:rightOperand 18 , 67`). RDF kent
daar geen volgorde in; een lijst zoals hierboven is beter en zouden wij overnemen.

### `isBekend`, `isOnbekend`

- **Linkerterm:** elk gegeven of kenmerk.
- **Rechterterm:** `true`. De vergelijking heeft er geen nodig; ODRL eist er wel een.
- **Betekenis:** `isBekend` geldt als de linkerterm een waarde heeft die niet leeg is.
  `isOnbekend` geldt als hij er geen heeft.
- **Let op het verschil tussen "leeg" en "niet te beoordelen".** Kan het beslispunt de linkerterm
  helemaal niet zien, dan is `isOnbekend` bij ons *onbepaald* en niet *waar*. Anders zou een
  beslispunt dat iets niet kan opvragen, concluderen dat het er niet is.
- **Verhouding tot Vlierdam:** `vlierdam:aanwezig` is `isBekend` voor een kenmerk van het verzoek.

```turtle
ex:vw-titel a odrl:Constraint ;
    odrl:leftOperand ex:aanspreektitel ;
    odrl:operator apnl:isBekend ;
    odrl:rightOperand true .
```

### `bestaat`

- **Linkerterm:** wat er moet bestaan, als begrip ("lopend dossier", "toestemming").
- **Rechterterm:** `true` (het bestaat) of `false` (het bestaat niet).
- **Betekenis:** een bestaansvraag aan een informatiepunt. Het beleid zegt wát er moet bestaan en
  voor wie; de uitvoering beantwoordt de vraag. Dit is geen vergelijking van twee waarden, en
  daarom past geen van de operatoren van ODRL.
- **Open:** "voor wie" (de betrokkene, de aanvrager) staat bij ons alleen in het label van de
  linkerterm. In het profiel zou dat een eigen eigenschap moeten zijn.

```turtle
ex:vw-toestemming a odrl:Constraint ;
    rdfs:label "er is een toestemming voor de betrokkene"@nl ;
    odrl:leftOperand ex:toestemming ;
    odrl:operator apnl:bestaat ;
    odrl:rightOperand true .
```

## Wat wij van ODRL zelf gebruiken

Ter vergelijking, zodat duidelijk is waar het profiel níets hoeft toe te voegen.

| ODRL 2.2 | Bij ons | |
|---|---|---|
| `eq`, `neq`, `gt`, `gteq`, `lt`, `lteq` | is, is niet, is groter dan, is ten minste, is kleiner dan, is ten hoogste | in gebruik |
| `isAnyOf` | is een van (…) | in gebruik |
| `isPartOf` | is onderdeel van | in de taal, nog niet in onze uitvoering |
| `isA`, `hasPart`, `isAllOf`, `isNoneOf` | geen woord in de taal | niet in gebruik |

## Vragen aan de werkgroep

1. **Hoofdletters bij tekst.** Vergelijken `begintMet`, `eindigtOp` en `bevat` met of zonder
   onderscheid tussen hoofd- en kleine letters? Wij doen het zonder. Zonder afspraak kunnen twee
   beslispunten op hetzelfde beleid verschillend beslissen.
2. **Eén term of twee voor aanwezigheid.** Is "het kenmerk staat in het verzoek" (Vlierdam)
   hetzelfde als "het gegeven heeft een waarde" (wij)? Wij denken van wel, met de linkerterm als
   het enige verschil.
3. **Niet te beoordelen.** Legt het profiel vast wat een beslispunt doet als het een linkerterm
   niet kan zien? Wij behandelen dat als onbepaald: een toestemming geldt dan niet, een verbod
   wel.
4. **`tussen` als term of als twee voorwaarden.** Zie hierboven.
5. **Tijd.** `nietOuderDan` en `binnen` uit Vlierdam lijken ons algemeen bruikbaar (opleidingen,
   bewaartermijnen, werktijden). Horen die in dezelfde eerste lijst?

## Wat wij doen als het profiel ze benoemt

- Onze export schrijft de naam van het profiel waar die bestaat, en houdt `ts:` alleen voor wat
  er nog niet in staat.
- Onze import herkent de vergelijkingen van het profiel naast die van ODRL. Nu laat hij een
  voorwaarde met een vergelijking uit een ander vocabulaire vallen, en daarmee de toestemming
  waar ze bij hoort, omdat het beleid anders ruimer zou worden dan de bron.

Achtergrond bij onze kant: `docs/TRANSFORMATIES.md` §8 (de export, de import en wat er bij ODRL
van anderen overkomt) en `docs/TOEGANGSSPRAAK.md` (de taal).
