# Claude Code-sessie-export

> **Let op:** export van een **Claude Code**-sessie. Gebruiker- en assistentteksten zijn letterlijk overgenomen; tool-aanroepen staan als compacte `🔧`-annotaties (hun output niet); interne redeneerblokken weggelaten.
>
> - **Datum:** 2026-07-22
> - **Sessie-id:** `7826109e-ab4a-4e69-bece-03b5845659b3`
> - **Branch:** `main`

---

## 👤 Gebruiker (1)

@/d:/Git/Bitemporal_2026/bitemp_register_v06/docs/plans/ODRL-Register-Toegangsbeleid.md @/d:/Git/Bitemporal_2026/bitemp_register_v06/docs/plans/2026-04-12 ODRL based Autorisatie Register (Claude).rtf

Ik ben al een tijd aan het denken, samen met de werkgroep FTV / Register Toegangsbeleid, aan een menselijk leesbare policy taal, die de dekking van XACML/OPA/Cedar en ODRL heeft, maar dus wel te snappen is door leken.

Dat vergt een definitie en een soort interpreter. Je maakt in feite een klein policy-programmeertaaltje, zonder moeilijke woorden. Hoogstens de dingen als subject, object, activiteit of actie (bekijken, veranderen, registreren, opvoeren, afvoeren, corrigeren), gegevenstype, gegevens, en werkwoorden als mogen en ontkenning daarvan ('mag niet').

Over subjecten en objecten (= gegevens / -typen) kun je praten met behulp van hun eigenschappen (attributen, of dieper: natuurlijk-persoon.naam.achternaam).

Er moeten wat functies en operatoren beschikbaar zijn, als = <>, bevat, begint met. (In het geo-domein kunnen dat geo-functies zijn: valt deels of geheel binnen e.d.; in andere domeinen andere, dus uitbreidbaar).

Zou je daar over na willen denken een iets voorstellen dat aan deze requirements voldoet?

**🤖 Claude:**

Ik lees eerst de twee aangehaalde documenten om aan te sluiten bij wat er al ligt.
> 🔧 `Read` — d:\Git\Bitemporal_2026\bitemp_register_v06\docs\plans\ODRL-Register-Toegangsbeleid.md
> 🔧 `Bash` — List plans directory with file sizes
> 🔧 `Bash` — Scan RTF chat export for passages about human readability / policy language
> 🔧 `Grep` — leesbaar|leken|begrijpel|klare taal|natuurlijke taal
> 🔧 `Read` — d:\Git\Bitemporal_2026\bitemp_register_v06\docs\plans\Whitepaper-Register-Toegangsbeleid.md
> 🔧 `Write` — d:\Git\Bitemporal_2026\bitemp_register_v06\docs\plans\2026-07-22 Klare-taal Toegangsbeleid — Toegangsspraak...

**🤖 Claude:**

Ik heb er goed over nagedacht en een concreet voorstel uitgewerkt: **Toegangsspraak** (werktitel), een Nederlandstalige *gecontroleerde* beleidstaal die als leesbare laag bovenop jullie bestaande ODRL-ontwerp ligt. Het volledige ontwerp staat in [2026-07-22 Klare-taal Toegangsbeleid — Toegangsspraak (ontwerp).md](bitemp_register_v06/docs/plans/2026-07-22%20Klare-taal%20Toegangsbeleid%20—%20Toegangsspraak%20(ontwerp).md).

De kern van het voorstel:

**Geen vrije taal, maar een gecontroleerde taal (CNL).** Vrij Nederlands is ambigu ("en/of", zwevend "niet"). De oplossing: een klein aantal vaste zinspatronen waarbij elke zin precies één betekenis heeft en 1-op-1 afbeeldt op de ODRL-subset die je al hebt ontworpen. Eén kernzin draagt de hele taal:

> *\<wie\> **mag** \<gegevens\> \<actie\> — of **mag niet** — [ **als** \<voorwaarden\> ] [ **waarbij:** \<verplichtingen\> ]*

Bijvoorbeeld:

```
Een schuldhulpverlener mag de inkomensgegevens bekijken
als aan alle volgende voorwaarden is voldaan:
  - het doel van de aanvraag is "schuldhulpverlening";
  - er is een lopend dossier voor de betrokkene;
waarbij: elke raadpleging wordt vastgelegd in het logboek.
```

De belangrijkste ontwerpkeuzes:

- **En/of-ambiguïteit opgelost via het RegelSpraak-patroon**: bij meerdere voorwaarden is de opsommingsvorm verplicht ("aan alle / aan ten minste één van / aan precies één van de volgende voorwaarden is voldaan"), nestbaar voor elke boolese combinatie. Dit leen ik bewust van RegelSpraak/ALEF (Belastingdienst) — bewezen prior art voor Nederlandstalige CNL, samen met SBVR Structured Dutch en Catala.
- **Attribuutpaden met vaste ankerwoorden**: voorwaarden zijn `<pad of waarde> <vergelijking> <pad of waarde>`, met leesbare ankers *de aanvrager*, *de gegevens*, *de betrokkene*, *de aanvraag* (die netjes op de AuthZEN/XACML-categorieën mappen). Ook pad-tegen-pad kan: "de locatie van de gegevens valt binnen het werkgebied van de aanvrager".
- **Uitbreidbaar operator-register**: kernset (`is`, `is niet`, `bevat`, `begint met`, `ligt tussen`, …) plus domeinprofielen (geo: `valt geheel binnen`, `overlapt`, `ligt binnen … meter van`) — de grammatica kent alleen het slot "vergelijking", de invulling komt uit het register. Dit is jullie ODRL-Profile-mechanisme doorgetrokken naar de taal.
- **De MetaRegistry doet de typebewaking**: paden en veldtypen komen uit de schema-API, dus de interpreter weigert onzin als `geboortedatum begint met "A"` — met een foutmelding die zelf ook in klare taal is.
- **Round-trip als harde garantie**: de tekst is de bron, ODRL de canonieke schaduw (beide bitemporeel geregistreerd). Er komt ook een renderer ODRL → tekst, zodat *alles* in het register leesbaar is, ongeacht hoe het binnenkwam. De bestaande fase-3-vertalers (ODRL → Rego/Cedar) blijven ongewijzigd — de taal lift daar gratis op mee.
- **Schrijven gebeurt begeleid**: de bekende CNL-zwakte is dat schrijven moeilijker is dan lezen. Daarom een gestructureerde editor als Omnium Studio-activiteit — zinsjablonen met slots, autocomplete uit de schema-API. Leken lezen volzinnen; auteurs klikken en vullen in.
- **Conflictregel vast en zelf leesbaar**: "Wat niet uitdrukkelijk is toegestaan, mag niet; een verbod gaat altijd vóór een toestemming." Dat ene besluit schrapt de hele combinatie-algoritme-complexiteit die XACML onleesbaar maakt.

Het document bevat verder een compacte EBNF-grammatica (LL(1)-parseerbaar, dus goed te bouwen met bv. chevrotain in de v06-stack), een dekkingsmatrix tegen ODRL/XACML/OPA/Cedar, toetsvoorbeelden (geo, verbod-met-uitzondering, correctie-met-verantwoording), en wat bewust búiten v1 blijft (vrije rekenkunde, recursie, delegatie) met een gemarkeerd CEL-`expressie`-blok als expert-ontsnappingsluik.

Grootste openstaande punt om vroeg af te bakenen: existentie-voorwaarden zoals "er is een lopend dossier" — die vergen een PIP-bevraging en zijn de moeilijkste categorie voor v1. Als je wilt, werk ik als vervolgstap de parser + renderer met round-trip-tests uit als klein TS-pakket, of eerst de plicht-subgrammatica.

