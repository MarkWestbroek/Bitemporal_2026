# Vier contracten — UML-BPMN-DMN driehoek

Dit document beschrijft de vier expliciete contracten die de relatie tussen de Process Engine, Operaton en één of meer bitemporele registers vastleggen. Het is het fundament onder alle daaropvolgende fases. Wijzigingen aan deze contracten zijn breaking en moeten expliciet versioneerd worden.

> Status: ontwerp v0. Bedoeld als startpunt voor implementatie in Fase 1+; tijdens PoC-implementatie kunnen kleine bijstellingen volgen die hier worden teruggeschreven.

## Begrippen

| Term            | Betekenis                                                                                  |
|-----------------|--------------------------------------------------------------------------------------------|
| Register        | Een instantie van het bitemporele register (bijv. `bitemp_register_v06` op een base-URL). |
| Domein          | Een logische groep representatietypes binnen een register (bijv. `np_loc`, `cg`).         |
| REP             | Representatie: entiteit, gegevenselement of relatie uit de MetaRegistry van een register. |
| Handle          | Lichte verwijzing naar een REP zonder de inhoud mee te dragen.                            |
| Snapshot        | De volledige inhoud van een REP op een formeel tijdstip `t` (lazy gefetcht).              |

## Contract 1 — Procesvariabele

**Doel.** Vastleggen hoe een waarde uit een MetaRegistry-instantie als Operaton-procesvariabele wordt opgeslagen, zodat BPMN-expressies, DMN-input-bindings en script-tasks er op uniforme wijze mee kunnen werken zónder de inhoud onnodig in Operaton-history te dupliceren.

**Type.** Operaton ondersteunt typed variables. Wij gebruiken **één** Operaton-variabele-type voor alle MetaRegistry-gerelateerde waarden: `Json`. De inhoud van die JSON volgt onderstaand schema, met een verplichte discriminator `__kind`.

**Schema.**

```jsonc
// Een lazy verwijzing naar een REP — voorkeursvorm.
{
  "__kind": "rep_handle",
  "register_id": "hoofdregister",
  "typenaam": "NatuurlijkPersoon",
  "ent_id": "01HX...ULID",
  "t": "2026-05-19T12:00:00Z"   // optioneel; afwezig = "nu"
}

// Een geïnlinede REP-snapshot — alleen wanneer transport over engine-grens nodig is.
{
  "__kind": "rep_inline",
  "register_id": "hoofdregister",
  "typenaam": "NatuurlijkPersoon",
  "ent_id": "01HX...ULID",
  "t": "2026-05-19T12:00:00Z",
  "inhoud": { /* volledige snapshot zoals teruggegeven door /full/<padnaam>/:id */ }
}

// Een primitief / basistype of een MetaRegistry-datatype.
//
// `__typenaam` verwijst naar een entry in de DatatypeRegistry van het register
// (zie /api/viz/schema/datatypes). Het generieke gegevenstypen-domein heet
// `register` en bevat de MIM-aligned types: KorteTekst, LangeTekst, AN40,
// AN200, Geheel, Decimaal, Datum, Datumtijd, Boolean, e.d. Per-domein-
// uitbreidingen (CG: URL, Emailadres, Telefoonnummer, GitAdres; np_loc:
// BSN, NLPostcode; ...) worden additief geregistreerd via
// `init<Domein>DatatypeRegistry()`.
{
  "__kind": "scalar",
  "register_id": "hoofdregister",       // optioneel; verplicht als __typenaam niet uit "register" komt
  "__typenaam": "Datum",                // datatypenaam uit DatatypeRegistry
  "inhoud": "2026-05-19"
}

// Een enum-waarde van een MetaRegistry-enum.
// Codes zijn lowercase Nederlands (we zijn niet zo hoofdletterig als Engels/Duits).
{
  "__kind": "enum_value",
  "register_id": "hoofdregister",
  "__typenaam": "Geslacht",
  "inhoud": "man"
}

// Een verwijzing naar een referentielijst-item.
{
  "__kind": "reflist_item",
  "register_id": "hoofdregister",
  "__typenaam": "Land",
  "inhoud": "nl"          // de instantie-code; weergavetekst wordt via lookup opgehaald
}
```

**Regels.**

1. `rep_handle` is de **voorkeursvorm**. Inhoud blijft bij de bron en wordt lazy gefetcht via de adapter.
2. `rep_inline` is alleen toegestaan wanneer de engine geen runtime-toegang tot het register heeft (bijv. message-correlation across systems — buiten scope PoC).
3. Het tripel `(register_id, typenaam, ent_id)` is wereldwijd uniek; binnen één PoC-deployment is `register_id` de enige bron van federatieve dubbelzinnigheid.
4. `t` is altijd ISO 8601 UTC. Afwezigheid betekent "nu" op het moment van resolutie.
5. Resolutie van een handle naar inhoud is een **side-effect-vrije** operatie: hij muteert het register niet.

**Caching.** Niet in deze laag. Eventuele caching gebeurt in een later toe te voegen GraphQL-laag (zie ook plan: "data bij de bron").

## Contract 2 — Service-task

**Doel.** Vastleggen hoe een BPMN service-task (of business-rule-task die niet-DMN aanroept) een bestaande register-handler aanspreekt, zonder Java-code in Operaton.

**Mechanisme.** Operaton's **external-task pattern**. De BPMN-modeler markeert een service-task als `External` en geeft een `topic` op. Een Go-worker abonneert op dat topic, voert de aanroep uit, en levert het resultaat terug aan Operaton.

**Topics in deze PoC.**

| Topic           | Beschrijving                                                       |
|-----------------|--------------------------------------------------------------------|
| `register-call` | Generieke aanroep naar een register-handler (REST of GraphQL).     |
| `cel-eval`      | Evalueer een CEL-expressie tegen de procesvariabele-context.       |
| `context-taak`  | Maak een ContextTaakInstantie aan in een register (Fase 6).        |

**Topic-config voor `register-call`.** Doorgegeven via Operaton procesvariabelen op de service-task (of via element-template in Fase 8):

```jsonc
{
  "register_id": "hoofdregister",
  "endpoint":    "rest",                 // "rest" | "graphql"
  "methode":     "GET",                  // alleen voor rest
  "padnaam":     "natuurlijk_persoon",   // bij rest: padnaam uit MetaRegistry
  "id_variable": "personId",              // procesvariabele die het ID levert
  "result_variable": "personSnapshot",    // waar het resultaat als rep_handle/inline landt
  "timeout_ms": 15000
}
```

**Resultaatregels.**

1. Bij succes wordt `result_variable` gevuld met een procesvariabele volgens Contract 1 (bij voorkeur `rep_handle`).
2. Bij HTTP 4xx delegeert de worker naar een BPMN-business-error met `errorCode = "register_4xx"`.
3. Bij HTTP 5xx of timeout faalt de worker met `failure` zodat Operaton-retries spelen.
4. De worker logt elke aanroep met correlatie-ID = Operaton processInstanceId + activityInstanceId.

## Contract 3 — DMN input/output

**Doel.** Vastleggen hoe DMN-tabellen typed input ontvangen vanuit MetaRegistry-velden en typed output produceren in alle MetaRegistry-types.

**Input.**

1. Een DMN-input-expression refereert óf aan een primitieve procesvariabele, óf aan een veld binnen een REP-handle/inline.
2. Voor handle-input voert de evaluator vóór DMN-aanroep een lazy-fetch uit en projecteert het gewenste pad (bijv. `persoon.geboortedatum`).
3. Veld-types worden afgedwongen tegen MetaRegistry: een veld dat in MetaRegistry een `Datum` is, mag in DMN niet als string-input gemodelleerd staan. Validatie gebeurt bij decision-deployment.

**Output.** DMN-output mag elke van de volgende typen zijn:

| Categorie       | Bron                                                                       | Voorbeeld DMN-output                |
|-----------------|----------------------------------------------------------------------------|-------------------------------------|
| Basistype       | OAS 3.1 primitieven                                                         | `string`, `integer`, `boolean`      |
| Gegevenstype    | `DatatypeRegistry` van het register (zie `/api/viz/schema/datatypes`)      | `Datum`, `KorteTekst`, `BSN`, `URL` |
| Enum            | MetaRegistry enum-registry                                                  | `Geslacht = "man"`                  |
| Reflistitem     | MetaRegistry referentielijst                                                | `Land = "nl"`                       |

De `DatatypeRegistry` is opgesplitst per domein: het generieke domein `register` levert de MIM-aligned types (KorteTekst, LangeTekst, AN40, AN200, Geheel, Decimaal, Datum, Datumtijd, Boolean, ...). Domeinspecifieke registries (CG, np_loc, etc.) voegen er additief aan toe (URL, Emailadres, Telefoonnummer, BSN, NLPostcode, GitAdres, ...). Een DMN-`typeRef` met prefix `datatype:` resolveert dus tegen de **samengevoegde** registry van het opgegeven register.

**Output-binding.** De decision-output draagt per kolom een `output type`-annotatie die naar het MetaRegistry-typesysteem verwijst. We gebruiken een `prefix:register_id:Naam` conventie:

```xml
<output id="o1" name="land"          typeRef="reflist:hoofdregister:Land"/>
<output id="o2" name="datum_geldig"  typeRef="datatype:hoofdregister:Datum"/>
<output id="o3" name="categorie"     typeRef="enum:hoofdregister:RisicoCategorie"/>
<output id="o4" name="score"         typeRef="number"/>
```

Geldige prefixen:

- `datatype:<register_id>:<naam>` — een `V3Datatype` uit de `DatatypeRegistry` van het register
- `enum:<register_id>:<naam>` — een enum uit de `EnumRegistry` van het register
- `reflist:<register_id>:<naam>` — een referentielijst-type uit het register
- één van de OAS 3.1 basistypen: `string`, `integer`, `number`, `boolean`

De gateway-evaluator parseert deze `typeRef`, evalueert de DMN, en converteert elk outputveld naar de bijbehorende `Variable` volgens Contract 1. Onbekende `typeRef`-prefixen leiden tot een deployment-error.

**Validatie bij deployment.**

1. Alle input-velden bestaan in MetaRegistry van het opgegeven register.
2. Alle output `typeRef`s resolveren naar bekende basistypen, datatypes, enums of reflists.
3. Elke geretourneerde enum-waarde komt voor in de enum-registry van het register.
4. Elke reflistitem-code resolveert naar een bestaand item.

## Contract 4 — Script-task / CEL

**Doel.** Eén scripttaal door de hele driehoek: dezelfde CEL-evaluator die afgeleide velden in het register evalueert, evalueert ook BPMN script-tasks en (later) formulier-expressies.

**Mechanisme.** External-task pattern, topic `cel-eval`. Geen JVM-CEL.

**Input.** De script-task krijgt twee variabelen mee:

```jsonc
{
  "expressie": "persoon.geboortedatum < datum('2000-01-01') ? 'volwassen' : 'minderjarig'",
  "context_variabelen": ["persoon", "registratie_t"],
  "result_variable": "leeftijdscategorie",
  "result_kind": "scalar",
  "result_typenaam": "string"
}
```

**Evaluatieregels.**

1. De worker bouwt een CEL-omgeving met (a) alle variabelen genoemd in `context_variabelen`, met handles eerst lazy-geresolved waar nodig, en (b) de standaard helper-functies die ook in afgeleide velden beschikbaar zijn (`datum(...)`, `nu()`, `dagen_tussen(...)`).
2. De expressie moet *zuiver* zijn: geen side-effects, geen IO. Worker-config bewaakt dit door alleen lees-functies in de omgeving te exposeren.
3. Resultaat wordt verpakt als procesvariabele volgens Contract 1, in de `Kind` aangegeven door `result_kind` en `__typenaam` uit `result_typenaam`.
4. Bij parse- of evaluatiefout: `failure` met de CEL-foutmelding in de external-task-error message; geen retries op syntax-fouten.

**Type-coherentie.** Gegevenstypen uit de `DatatypeRegistry` van het register (Datum, KorteTekst, BSN, NLPostcode, URL, ...) zijn als CEL-types gedeclareerd, met de basistype-mapping uit hun `V3Datatype.Basistype`/`Format`. Een expressie die een `Datum` vergelijkt met een string mislukt bij parse — net als in afgeleide velden.

## Versionering van deze contracten

- Wijzigingen aan een contract verhogen een interne versie (`v0`, `v1`, ...) en worden gemeld in de release-notes van de Process Engine.
- Een Operaton-deployment dat met contract-versie `vN` is gedeployed, moet door de gateway worden geweigerd als de runtime contract-versie hoger is en breaking changes bevat.
