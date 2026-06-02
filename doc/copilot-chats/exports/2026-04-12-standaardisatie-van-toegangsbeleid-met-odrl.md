# Chat: Standaardisatie van Toegangsbeleid met ODRL

- **Datum**: 2026-04-12 19:06
- **Sessie-ID**: `84820960-2542-4614-be14-d12f9c2387e3`
- **Berichten**: 6

---

## 🧑 User

Ik heb met Claude (zie doc/ rtf) en Gemini gechat over ODRL en mijn behoefte daaromtrent binnen een werkgroep in FTV.

# ik: 
Een directe collega schreef:
"
Onze belangrijkste conclusie van vorig jaar was dat je niet kan of wil standaardiseren op een policytaal. Zowel XACML/ALFA, OPA, Cedar, CEL als OpenFGA zijn allemaal geldige keuzes voor een policytaal. Elke taal is goed in andere situaties en dus moet die keuze vrij ingevuld kunnen worden. Net zoals we binnen de overheid ook niet standaardiseren op Java bijvoorbeeld doen we dat dus ook niet voor policy talen.

Waar je wél op wil standaardiseren is de interface tussen de PEP en de PDP en dat hebben we vorig jaar neergezet in de vorm van NLGov AuthZEN. De ontwikkelaars van XACML/ALFA zijn trouwens co-sponsors en aktieve deelnemers aan de ontwikkeling van OpenID AuthZEN. Die delen dat beeld dus ook.

 Omdat er wel behoefte is aan inzicht in toegangsbeleid gaan we dit jaar toch werken aan de standaard Register Toegangsbeleid. Daarmee gaan we proberen een standaard neer te zetten, waarschijnlijk gebaseerd op ODRL, waarmee het toegangsbeleid in diverse talen wel omschreven kan worden in een generieke vorm. ODRL is Linked Data en koppelt dus ook met Linked Data/MIM informatiemodellen. Daar lijkt wel aansluiting te zitten met de metamodellen zoals je die hieronder omschrijft.
"

Kun je iets elaboreren over de vorm van de standaard die we zouden kunnen neerzetten? Ik ken odrl niet goed

# gemini:

Het bericht van je collega schechetst een heldere visie: vrijheid in uitvoering (talen), maar eenheid in uitwisseling (interfaces en registers).

De keuze voor ODRL (Open Digital Rights Language) als basis voor een "Register Toegangsbeleid" is logisch omdat ODRL niet probeert te dicteren hoe een computer de beslissing neemt (zoals OPA of Cedar dat doen), maar wat de afspraken zijn in een machineleesbare, semantische vorm.

Hier is een verdieping op de vorm die deze standaard zou kunnen aannemen:

1. Wat is ODRL in deze context?
ODRL is een W3C-standaard en een informatiemodel. Waar een taal als Rego (OPA) zich richt op de logica (if user has x then allow), richt ODRL zich op de expressie van rechten.

Het kernmodel van ODRL werkt met drie hoofdelementen:

Permissions (Toestemmingen): Wat mag je doen? (Bijvoorbeeld: read, write).

Prohibitions (Verbodsbepalingen): Wat mag absoluut niet?

Duties (Verplichtingen): Wat moet je doen om het recht te verkrijgen? (Bijvoorbeeld: logging, pseudonimiseren).

2. De vorm van de standaard: Een "Metataal"
De standaard die jullie neerzetten wordt waarschijnlijk een profiel op ODRL. Je definieert hiermee een gemeenschappelijk vocabulaire voor de overheid:

Mapping naar techniek: De standaard beschrijft hoe een Cedar-policy of een XACML-policy "vertaald" wordt naar een ODRL-record. Dit maakt het register taal-onafhankelijk.

Linked Data (RDF): Omdat ODRL gebaseerd is op JSON-LD/RDF, kun je beleid koppelen aan andere overheidsbronnen. Bijvoorbeeld: een policy in het register verwijst direct naar een begrip in een MIM-informatiemodel (Metadata Informatie Modellering).

3. Hoe ziet zo’n Register eruit?
In plaats van een enorme bak met code, wordt het register een catalogus van intenties.

Onderdeel	Functie
Het Asset	Waar gaat de toegang over? (Bijvoorbeeld: "Inkomensgegevens van burger X"). Dit linkt naar de bronhouder.
De Party	Wie is de actor? (Bijvoorbeeld: "Schuldhulpverlener"). Dit linkt naar rollen in een generieke voorziening.
De Constraint	Onder welke conditie? (Bijvoorbeeld: "Alleen tijdens een lopend dossier").
4. De link met AuthZEN (De "Runtime")
Het is belangrijk om het verschil te zien tussen wat je collega beschrijft:

AuthZEN: De stekkeraansluiting. Het regelt hoe een applicatie (PEP) de vraag stelt aan de beslis-engine (PDP). Dit is puur technisch en gebeurt in milliseconden.

Register Toegangsbeleid (ODRL): De administratieve bron. Hierin staat opgeslagen: "Wie heeft op basis van welke wet toegang tot wat?". Dit is bedoeld voor compliance, audit, en transparantie naar de burger (bijv. in een portaal "Wie heeft mijn gegevens ingezien?").

Waarom dit aansluit bij jouw metamodellen
Je collega noemt de aansluiting bij jouw metamodellen. Als jij bezig bent met het modelleren van data-entiteiten en hun relaties (bijv. in MIM), dan kan ODRL daar "bovenop" liggen.

Stel je voor:

Jij definieert in je metamodel wat een "Object: Paspoort" is.

De ODRL-standaard definieert wie de "Action: Inzien" mag uitvoeren op dat specifieke object.

Vertaalslag naar de praktijk:
De standaard wordt dus geen nieuwe programmeertaal, maar een formele manier om beleid te beschrijven zodat een toezichthouder of een andere afdeling kan begrijpen wat de regels zijn, zonder dat ze hoeven te kunnen programmeren in OPA of Cedar.

Zou het helpen als ik een simpel voorbeeld geef van hoe een juridische regel vertaald wordt naar een ODRL-structuur?

# vraag:

---

## 🤖 Assistant

Your message ends with "# vraag:" but no actual question follows. What would you like to know or do regarding ODRL and the Register Toegangsbeleid?

In the meantime, let me check if there's relevant documentation in your workspace.   

*Searched for files matching `**/*.rtf`, 1 match · Searched for files matching `**/ODRL*`, no matches · Searched for files matching `**/toegangsbeleid*`, no matches*



---

## 🧑 User

vraag:
Dit allemaal wetende, welke subset van ODRL zouden we dan nodig hebben om te beginnen met het neerzetten van een standaard "Register Toegangsbeleid" (zie eerste vraag)?

Als je die subset weet, zou je dan een UML class diagram kunnen tekenen (kan in mermaid of visueel), dat deze subset weergeeft?

Bijgaand het volledige model uit https://www.w3.org/TR/odrl-model/#intro
Misschien is het volledige model wel nodig, dat kan zijn.

Daarna: 
Het autorisatie register kan zelf ook bitemporeel opgezet zijn, dus kan ook heel goed gemaakt worden met dit project. Daarnaast is het metamodel dat elk register daarmee heeft, denk ik heel goed toepasbaar binnen zo een ODRL high level autorisatienotatie: je kunt dan namelijk heel goed:
- aangeven welke REP, en zelfs welk veld van een GE, precies het Asset is (met de notatie die we al gebruiken in de CEL expressies: NP.Bereikbaarheid.Locatie.Adres.straatnaam)
- gebruik makende van het metamodel (en veldtypen bijv.) een correcte dataset-expressie opstellen (bijv "naam begint met een letter tussen A en M")

Daarvoor is dit UML model nodig: om het register te kunnen bouwen.

Zie je nog gaps? Is er meer informatie nodig? Misschien is plannen wel de beste modus, maar ik startte met de Agent. Als ik omschakel, is dan de context weg of kan dat wel?

---

## 🤖 Assistant



*Read autoriseren · Searched for files matching `**/CEL*`, 3 matches · Fetched https://www.w3.org/TR/odrl-model/*



<details>
<summary><em>Created 5 todos</em> (+8 meer)</summary>

- Created 5 todos
- Read autoriseren
- Searched for files matching `**/CEL*`, 3 matches
- Fetched https://www.w3.org/TR/odrl-model/
- Starting: *Check existing autoriseren/ code* (2/5)
- Read autoriseren.md, lines 1 to 100
- Read CEL-evaluatie-js.md, lines 1 to 80
- Read autoriseren.md, lines 100 to 200
- Starting: *Identify ODRL subset for Register Toegangsbeleid* (3/5)
</details>

Nu heb ik alle context. Laat me de analyse uitwerken en het diagram maken. 

*Starting: *Create Mermaid UML class diagram* (4/5)*



*Starting: *Create Mermaid UML class diagram* (4/5) · Created ODRL-Register-Toegangsbeleid.md · Completed: *Create Mermaid UML class diagram* (4/5)*

Ik heb een volledig ontwerpdocument aangemaakt in docs/plans/ODRL-Register-Toegangsbeleid.md. Hier de kernpunten:

## ODRL-subset voor Register Toegangsbeleid

**Je hebt NIET het volledige model nodig.** De MVP-subset is:

| Nodig | Niet nodig (v1) |
|---|---|
| Policy (Set), Permission, Prohibition, Duty | Offer/Agreement subclasses |
| Asset + AssetCollection + refinement | Consequence/Remedy (complexe duty-chains) |
| Party + PartyCollection + refinement | Policy Inheritance |
| Action, Constraint, LogicalConstraint | Compact Policy, `implies`/`includedIn` |
| **Profile** (cruciaal: NLGov profiel) | `status` op Constraint (runtime) |

## Het Mermaid UML diagram staat in het document
Het toont alle klassen, hun properties, en de relaties (target, assigner, assignee, constraint, refinement, duty).

## Metamodel-koppeling — de echte kracht

Jullie MetaRegistry-paden zijn **direct** bruikbaar als ODRL Asset-identifiers:
- `NatuurlijkPersoon.Naam.roepnaam` → precies het Asset-granulariteitsniveau dat je nodig hebt
- CEL-expressies die je al hebt → dezelfde rol als ODRL Constraints
- Schema-API veldtypen → ODRL `dataType` annotaties

## Bitemporeel autorisatieregister: ja, dat kan
Het register kan zelf als bitemporeel register in v06 worden gebouwd. Policies worden entiteiten, rules worden GE's, en je krijgt formeel + materieel tijdreizen over je autorisatiebeleid gratis.

## Belangrijkste gaps
1. **NLGov ODRL Profiel formaliseren** (RDF/OWL — het werkgroep-deliverable)
2. **Vertaallaag ODRL → runtime** (hoe wordt een ODRL-policy OPA Rego / Cedar?)
3. **Cross-register policies** (assets over meerdere registers heen)

## Context bij omschakelen
Binnen hetzelfde gesprek blijft context behouden ongeacht modus. Bij een nieuw gesprek: gebruik dit document als startpunt.

---

## 🧑 User

Zou je, op basis van deze informatie, een Whitepaper kunnen schrijven dat de voor- (en eventueel nadelen) van deze aanpak beschrijft?

Doelgroep: zowel beleidsmensen als architecten / leveranciers van de op Common Ground aangesloten software.

---

## 🤖 Assistant



*Read ODRL-Register-Toegangsbeleid.md, lines 1 to 280*



*Read ODRL-Register-Toegangsbeleid.md, lines 280 to 350 · Read ODRL-Register-Toegangsbeleid.md, lines 350 to 400 · Read autoriseren.md, lines 1 to 105 · Read autoriseren.md, lines 105 to 200*

Now let me gather some additional context on Common Ground references and the broader project scope.  

<details>
<summary><em>Searched for regex `Common Ground|VNG|Haven|NLX|Zaakgericht|Haal Centraal`, 20 results</em> (+5 meer)</summary>

- Searched for regex `Common Ground|VNG|Haven|NLX|Zaakgericht|Haal Centraal`, 20 results
- Searched for regex `Common Ground|VNG|NLX|Haven|Haal Centraal`, 20 results
- Searched for regex `AVG|GDPR|Woo|BIO|security standard`, 20 results
- Searched for regex `zero.trust|ABAC|RBAC|access control`, 20 results
- Searched for regex `FSC|Federated Service Connectivity|API strategy|API strategie`, 20 results
- Read docs
</details>



<details>
<summary><em>Read autoriseren.md, lines 1 to 100</em> (+12 meer)</summary>

- Read autoriseren.md, lines 1 to 100
- Searched for regex `Haven\+|Haven |Haal.Centraal|NLX`, 20 results
- Read verschilanalyse.md, lines 1 to 100
- Read OPENAPI.md, lines 200 to 260
- Read ontwerpkeuzen.md, lines 110 to 170
- Read verschilanalyse.md, lines 100 to 350
- Read autoriseren.md, lines 100 to 300
- Searched for regex `AVG|GDPR|Woo\b|Wet open overheid|BIO\b|Baseline Informatiebeveiliging`, 30 results
- Searched for regex `zero.trust|ODRL|XACML|Cedar|ALFA|Keycloak|OPA`, 30 results
- Read ODRL-Register-Toegangsbeleid.md, lines 1 to 50
- Read extern
- Read ontwerpgedachten
- Read ODRL-Register-Toegangsbeleid.md, lines 50 to 403
</details>



<details>
<summary><em>Searched for regex `Common Ground|VNG|Haven|NLX|Zaakgericht|Haal Centraal`, 20 results</em> (+21 meer)</summary>

- Searched for regex `Common Ground|VNG|Haven|NLX|Zaakgericht|Haal Centraal`, 20 results
- Searched for regex `Common Ground|VNG|NLX|Haven|Haal Centraal`, 20 results
- Searched for regex `AVG|GDPR|Woo|BIO|security standard`, 20 results
- Searched for regex `zero.trust|ABAC|RBAC|access control`, 20 results
- Searched for regex `FSC|Federated Service Connectivity|API strategy|API strategie`, 20 results
- Read docs
- Read autoriseren.md, lines 1 to 100
- Searched for regex `Haven\+|Haven |Haal.Centraal|NLX`, 20 results
- Read verschilanalyse.md, lines 1 to 100
- Read OPENAPI.md, lines 200 to 260
- Read ontwerpkeuzen.md, lines 110 to 170
- Read verschilanalyse.md, lines 100 to 350
- Read autoriseren.md, lines 100 to 300
- Searched for regex `AVG|GDPR|Woo\b|Wet open overheid|BIO\b|Baseline Informatiebeveiliging`, 30 results
- Searched for regex `zero.trust|ODRL|XACML|Cedar|ALFA|Keycloak|OPA`, 30 results
- Read ODRL-Register-Toegangsbeleid.md, lines 1 to 50
- Read extern
- Read ontwerpgedachten
- Read ODRL-Register-Toegangsbeleid.md, lines 50 to 403
- Read verschilanalyse.md, lines 1 to 100
- Created 3 todos
- Read verschilanalyse.md, lines 100 to 200
</details>

Now I have all the context. Let me write the whitepaper. 

*Starting: *Create whitepaper document* (3/3)*



*Starting: *Create whitepaper document* (3/3) · Created Whitepaper-Register-Toegangsbeleid.md · Completed: *Create whitepaper document* (3/3)*

Het whitepaper staat in docs/plans/Whitepaper-Register-Toegangsbeleid.md.

**Opbouw:**

| Hoofdstuk | Doelgroep |
|-----------|-----------|
| 1. Het probleem | Beleid + architecten — fragmentatie, AVG/BIO-druk, keuzevrijheidswens |
| 2. Voorgestelde architectuur | Beide — de drie lagen (register → engine → AuthZEN) + PxP |
| 3. Waarom ODRL? | Beide — vergelijking met XACML/OPA/Cedar, Profile-mechanisme, concreet JSON-LD voorbeeld |
| 4. Waarom bitemporeel? | Beleid — vier scenario's (reguliere wijziging, correctie, audit, cross-register) |
| 5. Aansluiting Common Ground | Architecten — RA-CG mapping, MetaRegistry, FSC/Haven/Notificaties |
| 6. NLGov ODRL Profiel | Architecten — concrete termen (acties, voorwaarden, rollen) |
| 7. Voordelen | Gesplitst per doelgroep: beleidsmakers, architecten/leveranciers, CG-ecosysteem |
| 8. Risico's en aandachtspunten | Beide — vertaallaag, linked data complexiteit, adoptie, performance, governance |
| 9. Roadmap | Beide — vier fasen van profiel tot pilotproject |
| 10. Conclusie | Beide |
| Bijlage A–C | Architecten — UML diagram, ER-diagram, CG-stack positionering |

---
