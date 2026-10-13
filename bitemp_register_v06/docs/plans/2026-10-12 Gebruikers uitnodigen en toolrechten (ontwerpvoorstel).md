# Gebruikers uitnodigen en toolrechten (ontwerpvoorstel)

*2026-10-12. Aanleiding: Mark wil op een testomgeving mensen per mail uitnodigen. Ze kiezen zelf
een wachtwoord en krijgen rechten om te modelleren, meer om formulierdefinities te maken, of nog
meer om codegen te starten. Rechten liefst per map in de projectboom, gedefinieerd in de tool zelf
(dogfooding). Status: voorstel; nog niets gebouwd. Bouwt voort op
`2026-10-12 Toegang op beleid — PAP, PDP en PEP (plan).md` en
`gebruikersbeheer/2026-10-06 Gebruikersbeheer als bitemporeel model (voorstel).md`.*

## 1. Wat er al is

| Onderdeel | Stand | Bron |
|---|---|---|
| Gebruiker | bitemporele entiteit in domein `beheer`: identiteit (naam, e-mail), status, roltoewijzing; wachtwoord apart (bcrypt) | `gebruikers/aanmaken.go`, `stand.go` |
| Account aanmaken | beheerder maakt het aan en zet het wachtwoord (of laat er een genereren, één keer getoond) | `gebruikers/handlers.go:123` |
| Rollen | `viewer` < `editor` < `admin`; alleen roltoewijzingen zonder domein tellen | `stand.go:59-66` |
| Handhaving | `RequireRol("editor"/"admin")` per route; grof, geen rechten per actie of map | `routes/addroutes.go` |
| Mail | SMTP (`VerstuurEmail`, TLS/STARTTLS), nu alleen voor notificaties | `notificaties/bezorg.go:68`, `.env.example:125-131` |
| Aanmeldpagina | `aanmelden.html` | frontend |
| Uitnodigen / wachtwoord vergeten | **bestaat niet** (backlog: "later") | `BACKLOG.md:1844` |

## 2. Uitnodigen

1. **Uitnodiging maken** (beheerder, activiteit Gebruikers): e-mailadres, weergavenaam, **rol**
   (zie §3) en een geldigheid (standaard 7 dagen). De server maakt een willekeurige token
   (32 bytes), bewaart **alleen de hash**, en mailt een link
   `…/aanmelden.html?uitnodiging=<token>`.
2. **Accepteren**: de genodigde kiest gebruikersnaam en wachtwoord. De server controleert de token
   (geldig, niet gebruikt, niet verlopen), registreert de gebruiker met de rol uit de uitnodiging
   en zet het wachtwoord. De token vervalt.
3. **Wachtwoord vergeten** gebruikt hetzelfde mechanisme met een kortere geldigheid (1 uur). Het
   antwoord verklapt nooit of een e-mailadres bekend is.
4. **De uitnodiging is zelf een bitemporeel gegeven** (domein `beheer`, entiteit
   `uitnodiging`: e-mail, rol, uitgenodigd door, geldig tot, status open/geaccepteerd/ingetrokken).
   Zo is terug te zien wie wie wanneer uitnodigde.
5. **Per instantie aan of uit**: `UITNODIGEN_ENABLED` (standaard uit), plus de bestaande
   SMTP-instellingen. Op een testomgeving aan, op productie pas na besluit.
6. **Misbruik beperken**: rate limit op accepteren en wachtwoord vergeten; tokens eenmalig;
   beheerder kan een uitnodiging intrekken.

**Voorwaarde vóór testgebruikers:** het lek uit het toegangsplan (anoniem `GET /full/personen` op
pf geeft e-mailadressen) moet dicht zijn, want genodigden komen met hun e-mailadres in het systeem.

## 3. Toolrechten: rollen gedefinieerd in de tool

Mark (12-10): rechten moeten in de tool gedefinieerd worden, net als het model erachter, en
per map kunnen gelden ("gebruiker A mag alleen map X wijzigen, Mark alle mappen").

**De tool als resource.** Naast de registergegevens (het toegangsplan: per type en veld) krijgt
de PDP een tweede soort resource: de **tool zelf**.

| Resource | Voorbeelden van handelingen |
|---|---|
| `project` | lezen, wijzigen |
| `project/map/<pad>` | lezen, wijzigen (elementen, diagrammen, koppelingen in die map) |
| `actie/formulierdefinitie` | maken, publiceren |
| `actie/codegen` | starten |
| `actie/beleid` | toegangsregels publiceren |
| `beheer/gebruikers` | uitnodigen, rollen toekennen |

**Rollen zijn regels in Toegangsspraak**, beheerd met het toegangsregelprofiel in de Studio en
uitgevoerd door dezelfde Go-uitvoerder als het registerbeleid (B4 in het toegangsplan). Een
voorbeeld:

```
modelleur:     mag lezen project; mag wijzigen project/map/* behalve map "Beleid"
ontwerper:     als modelleur; mag maken actie/formulierdefinitie
bouwer:        als ontwerper; mag starten actie/codegen
beheerder:     alles
```

Een uitnodiging wijst één zo'n rol toe, eventueel beperkt tot een map ("modelleur voor map
*Zaken*").

**Handhaving:**

- **Server** (de echte grens): de projectsync ontvangt operaties per map (`STRUCTUUR_OPS`,
  `MODEL_OPS`) en kan per operatie de map bepalen en de PDP vragen. Codegen-, formulier- en
  beleidsroutes krijgen een PEP-check op hun actie.
- **Studio** (gemak): wat niet mag, toont de UI alleen-lezen (geen bewerkknoppen, slot-icoon op
  de map). Het koppeldiagram gebruikt dit voor elementen uit mappen van anderen.

**Overgang:** tot de uitvoerder er is, vertalen we de bestaande drie rollen: `viewer` = lezen,
`editor` = modelleur + ontwerper, `admin` = alles. Uitnodigen kan dus al met de oude rollen;
fijnere rollen komen er vanzelf bij als de beleidsbundel (toegangsplan fase 1a/1c) er is.

## 4. Gefaseerd bouwen

| Fase | Inhoud | Afhankelijk van |
|---|---|---|
| 1 | Uitnodiging (entiteit, token, mail, accepteerpagina), wachtwoord vergeten, `UITNODIGEN_ENABLED`; rollen viewer/editor/admin | SMTP op de instantie; het pf-lek dicht |
| 2 | Toolresources en -handelingen in de beleidsbundel; rollen als Toegangsspraak-regels; uitnodiging met zo'n rol | toegangsplan 1a (bundel + uitvoerder) |
| 3 | Rechten per map: servercheck in de projectsync, alleen-lezen in de Studio | fase 2 |

## 5. Besluiten en voorstellen (Mark, 13-10)

**Besloten:**

1. **Testomgeving:** app (app.omnium-ide.nl).
2. **De genodigde kiest zelf een gebruikersnaam**: die verschijnt in de lijst "wie is actief".

**Rollen (voorstel, nog te bevestigen).** Het verschil zit in de impact van wat je maakt:

| Rol | Mag | Gevolg van fouten |
|---|---|---|
| lezer | project openen, bekijken, documenten genereren | geen |
| **modelleur** | modellen bewerken (elementen, diagrammen, mappen, koppelingen), eventueel per map | blijft in het model |
| **ontwerper** | als modelleur, plus artefacten die anderen gebruiken: formulierdefinities, documentsjablonen, huisstijl/vormregels van het project | zichtbaar voor gebruikers van formulieren en documenten |
| **bouwer** | als ontwerper, plus wat het draaiende systeem verandert: codegeneratie, schema publiceren, EA-import via de server | verandert database en API |
| beheerder | gebruikers uitnodigen, rollen toekennen, toegangsbeleid publiceren, project verwijderen | — |

Nu een vaste keuzelijst (enum). Later een **referentielijst** in domein `beheer`, bitemporeel en
zelf gemodelleerd; de **PIP** levert de rollen van een subject aan de PDP. De beleidsbundel
verwijst alleen naar rolcodes, dus die overgang breekt niets (Mark, 13-10).

**Toolrechten (voorstel).** Datarechten (het toegangsplan) gaan over wie welke registergegevens
ziet; toolrechten over wat je in de werkbank mag. Zes groepen, oplopend in impact:

1. **Lezen** — project openen, diagrammen bekijken, documenten genereren.
2. **Modelleren** — wijzigen in een map (elementen, diagrammen, koppelingen); per map te beperken.
3. **Ontwerpen** — formulierdefinities, documentsjablonen, vormregels/huisstijl van het project.
4. **Taal wijzigen** — profielen en M2 aanpassen (profiel-ontwerper); raakt elk model in die taal.
   Bij de bouwer, of een eigen rol als de taal strenger bewaakt moet worden dan de code (open).
5. **Bouwen en publiceren** — codegeneratie, schema publiceren naar het register, EA-import via de
   server.
6. **Beheer** — gebruikers uitnodigen en rollen toekennen, toegangsbeleid publiceren, een project
   verwijderen of een serverversie overschrijven.

**Nog open:**

3. Rolnamen en indeling hierboven: akkoord, en krijgt "taal wijzigen" (4) een eigen rol?
4. Deny-by-default ook voor toolrechten (alleen wat expliciet mag)?
