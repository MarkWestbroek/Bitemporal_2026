# Aanmeldformulier CG Portfolio als formulierdefinitie — analyse

*22 september 2026 (Claude-sessie). Status: analyse, nog niets gebouwd.*

Bron: `docs/CG PF/2026-09-022 Aanmeldformulier PF voorbeeld.pdf` (MS Forms, 30 vragen) en
de replays `docs/CG PF/Replay files/1–7`. De vraag luidt: kan één aanmelding (één initiatief met de
informatie eromheen) via een FormulierDefinitie worden ingevoerd, zodat aan het eind precies de
wijzigingen worden opgevoerd die replay 4 per initiatief opvoert?

## 1. Wat replay 4 per initiatief doet

Replay 4 voert **per initiatief één `POST /registratie/`** uit met ongeveer 15 `opvoer`-wijzigingen:
`initiatief` → `initiatief_aanvang` → `planning` → `product` → 3× `bijdrage` →
`initiatiefdomein`/`anderdomein` → `initiatiefgemeente` (rol *Realiseert* / *Maakt gebruik van*) /
`andersdangemeente` → `initiatiefapistandaard`/`andereapistandaard` → `initiatieforganisatie`
(rol *Contactorganisatie* / *BetrokkenOrganisatie*) → n× `betrokkenorganisatie`.

`Organisatie`, `Persoon` en `Contactpersoon` zijn in replay 4 **vooraf geseed** (de eerste drie
entries, met vaste id's). Replay 5 voegt het PO-e-mailadres toe; replay 7 (`beoordeling`) is
VNG-werk en hoort niet in het intakeformulier. Eén registratie met opvoeren voor meerdere
entiteiten wordt al ondersteund; de seed-entries doen dat ook.

## 2. Mapping van de vragen naar het model (CG v0.5.9.x)

| # | Vraag | Doel | Past? |
|---|-------|------|-------|
| 1 | naam | `Product.naam` | ✅ |
| 2 | type product | `Product.type` (enum Producttype) | ✅ (*Standaard* ontbreekt in de enum) |
| 3 | parallel te gebruiken? | — (replay: in `omschrijving` geplakt) | ❌ veld ontbreekt |
| 4 | componenten (indien toepassing) | — (replay: in `omschrijving`) | ❌ veld ontbreekt |
| 5 | pitch (indien toepassing) | `Product.pitch` | ✅ conditioneel |
| 6 | domein(en), meerkeuze + overig | n× `InitiatiefDomein` (reflijst) + `AnderDomein` | ⚠️ meerkeuze-widget |
| 7 | type betrokken organisaties | n× `BetrokkenOrganisatie.type` (enum) | ⚠️ meerkeuze-widget |
| 8 | gemeenten realisatie | n× `InitiatiefGemeente` rol=*Realiseert* + `AndersDanGemeente` | ⚠️ vaste rol per lijst |
| 9 | gemeenten gebruik | n× `InitiatiefGemeente` rol=*Maakt gebruik van* | ⚠️ idem |
| 10 | leveranciers | n× `InitiatiefOrganisatie` rol=*BetrokkenOrganisatie* → `Organisatie` | ❌ zoeken-of-aanmaken |
| 11 | startdatum | `Planning.startdatum` (+ `Initiatief_Aanvang.datum`) | ✅ (één waarde, twee doelen) |
| 12 | ready for use | `Planning.ready_for_use` | ✅ |
| 13 | contactorganisatie | `Organisatie` + `InitiatiefOrganisatie` rol=*Contactorganisatie* | ❌ zoeken-of-aanmaken |
| 14 | PO | `Persoon` + `Persoonnaam` + `Contactpersoon`(org, persoon, rol=PO) | ❌ zoeken-of-aanmaken, andere ENT |
| 15 | e-mail PO | `Persoonscontactgegevens.email` | ❌ via Persoon |
| 16 | website | `Product.website` | ✅ |
| 17 | git | `Product.git_repo` | ✅ |
| 18 | korte omschrijving | `Product.omschrijving` | ✅ |
| 19–24 | 3× schaal 1–4 + toelichting | 3× `Bijdrage` met vaste `type_bijdrage` | ⚠️ vaste waarden per lijstitem |
| 25 | planningsinfo | `Planning.planningsinfo` | ✅ |
| 26 | lagen (meerkeuze) | `Product.CG_laag` is **enkelvoudig** | ❌ modelkeuze |
| 27 | API-standaarden | n× `InitiatiefAPIStandaard` + `AndereAPIStandaard` | ⚠️ reflijst-meerkeuze + vrije tekst |
| 28 | fase | `Planning.fase` | ✅ |
| 29 | waar tegenaan gelopen | `Planning.waar_tegenaan_gelopen` | ✅ |
| 30 | vragen over het formulier | evt. `Initiatiefinfo.informatie` | ⚠️ |

**Modelopmerking:** de PO hangt via `Contactpersoon` aan de *organisatie* en niet aan het
*initiatief*. Heeft een organisatie meerdere initiatieven met verschillende PO's, dan is niet af te
leiden wie de PO van welk initiatief is. Overweeg een relatie `InitiatiefPersoon` (rol PO).

## 3. Wat de formulierdefinitie nu kan

- `CustomFormulierRenderer`: `groep`, `rij`, `veld` (vol pad `ENT.GE.veld`), `conditioneel`
  (`veld == 'x'`, `!veld`) en `lijst` (meervoudig GE, herhaalbare rijen).
- `bouwCustomWijzigingen` (`customFormMapping.js`) bouwt uit het formulier **één registratie met
  opvoeren over meerdere GE's**, inclusief opvoer/afvoer per lijstitem.
- Er is al een FD *Initiatief voorbeeldformulier* (product + planning).

Beperkingen:

1. **Alleen voor bestaande entiteiten.** De custom FD draait in `EntiteitFormulier` (`/t/…/:id`).
   `NieuwEntiteitPagina` gebruikt het generieke GE-voor-GE-formulier, niet de FD-layout.
2. **Eén hoofdentiteit.** Opvoeren voor `Organisatie`/`Persoon`/`Contactpersoon` vallen buiten het
   bereik: de mapping kent alleen onderliggende GE's/relaties van het doeltype.
3. **Id-toekenning aan de client** (max-id-endpoint + 1, `viz_entiteit_max_id_handler.go`). Voor een openbaar
   aanmeldformulier is dat racegevoelig, en per registratie zijn meerdere nieuwe id's nodig
   (initiatief, eventueel organisatie(s) en persoon).
4. Geen **vaste waarden** per veld of lijstitem (`type_bijdrage`, `rol`), geen **meerkeuze-widget**
   voor een enum- of reflijst-lijst, en geen **één invoer naar twee doelen** (startdatum).
5. Geen **anonieme indiening** (aangenomen, niet nagekeken: `/registratie/` zit achter de auth-middleware).

## 4. Wat er gebouwd moet worden (voorstel)

Het MS-formulier is **vraaggericht** en niet modelgericht. Vragen 19–24, 8/9 en 13–15 mappen niet
1-op-1. Het voorstel scheidt daarom de **vragen** (layout) van de **afbeelding naar wijzigingen**
(een *registratiesjabloon*) en neemt beide op in de FormulierDefinitie. Het sjabloon lijkt op een
replay-entry met verwijzingen naar antwoorden:

```jsonc
{ "wijzigingen": [
  { "opvoer": { "initiatief": { "id": "$nieuw.initiatief" } } },
  { "opvoer": { "product": { "initiatief_id": "$nieuw.initiatief", "naam": "$v.naam", … } } },
  { "voorElk": "$v.bijdragen", "opvoer": { "bijdrage": { "initiatief_id": "$nieuw.initiatief",
      "type_bijdrage": "$item.type", "schaal": "$item.schaal", "toelichting": "$item.toelichting" } } },
  { "voorElk": "$v.gemeenten_realisatie", "opvoer": { "initiatiefgemeente": {
      "initiatief_id": "$nieuw.initiatief", "gemeente_id": "$item", "rol": "Realiseert" } } },
  { "zoekOfMaak": "organisatie", "als": "$org.contact", "sleutel": "organisatienaam.naam", "waarde": "$v.contactorganisatie" },
  …
]}
```

Bouwstenen, in volgorde van noodzaak:

| # | Onderdeel | Waar | Omvang |
|---|-----------|------|--------|
| B1 | **Server-side placeholder-id's** (`"$nieuw.x"`) in `POST /registratie/`: nieuwe id's toekennen binnen de transactie en in de volgende wijzigingen invullen | backend `registration_helpers_generiek.go` | M, generiek en ook nuttig voor replays |
| B2 | **FD in nieuw-modus**: `CustomFormulierRenderer` zonder bestaande entiteit, zodat de submit één registratie bouwt | frontend | S–M |
| B3 | **Registratiesjabloon** in de FD (nieuw GE `FormulierDefinitie_Registratiesjabloon` of een uitbreiding van `layout_json`): vaste waarden, `voorElk`, één antwoord naar meerdere doelen | configuratiemodel + mapping | M |
| B4 | **Widgets**: meerkeuze-checkboxgroep voor enum/reflijst (domeinen, organisatietypen, lagen), multi-`RefCombobox` (gemeenten, API-standaarden), schaal 1–4 als radio | frontend | S–M |
| B5 | **Zoek-of-maak** voor Organisatie/Persoon: een bestaande kiezen via `RefCombobox`, of een nieuwe opvoeren met `$nieuw.org` | frontend + B1 | M |
| B6 | **Openbare indiening**: een apart endpoint of een servicerol die alleen dit sjabloon mag indienen, met rate limit/captcha, plus een status op de aanmelding (zie §6.4: niet via `Beoordeling`) | backend/auth | M, beleidskeuze |
| B7 | **Modelaanpassingen**: `Product.parallel_gebruik`, `Product.componenten`, `CG_laag` meervoudig (GE `ProductLaag`), enum `Producttype` + *Standaard*, eventueel `InitiatiefPersoon` | CG-model + codegen | S |
| B7a | ✅ **`Initiatief.Aanmeldstatus`** (24-09-2026): enkelvoudig, niet materieel; enum `Aanmeldstatus` = `nieuwe_aanmelding` / `in_behandeling` / `geaccepteerd` / `afgewezen`, plus `toelichting`. V3: `docs/Model files (V3)/CG 2026-09-24 Aanmeldstatus`. Replay voor de 85 bestaande initiatieven → geaccepteerd, en de QueryDefinitie `publieke-initiatieven` als replay (zie `VPS_DEPLOYMENT.md` §9). `CG_laag` meervoudig blijft liggen: het is een veld in `Product`, dus een apart GE plus migratie | CG-model + codegen | gedaan |

**Minimale eerste stap zonder nieuwe backend:** B2 + B4 met client-side id (`max-id`) voor alleen
het initiatiefdeel (vragen 1–12, 16–29), achter login. Organisatie en PO kiezen dan uit bestaande
records via `RefCombobox`. Het openbare formulier met aanmaken van nieuwe organisaties en personen
vereist B1, B5 en B6.

---

*Onderstaande paragrafen komen uit de ontwerpdiscussie van dezelfde dag (Claude-sessie). Ze
leggen de redenering vast vóórdat er een formulierdefinitie wordt gebouwd; er is nog niets
geïmplementeerd.*

## 5. Widgets modelgedreven afleiden

Uitgangspunt: de widget is een **afgeleide van de modelconstructie**; de formulierdefinitie
overschrijft hooguit. Een FD zegt dus *welk stuk model* een blok toont, niet hoe het eruitziet.

### 5.1 Afleidingstabel

| Constructie | Kardinaliteit | Standaardwidget | Zinvolle override |
|---|---|---|---|
| Compositie → GE | enkelvoudig | veldenblok (bestaat) | groep/rij-layout |
| Compositie → GE | meervoudig | herhaalbare rijen (bestaat) | meerkeuze, vaste rijen, tabel |
| Compositie → GE met precies één betekenisdragend veld | meervoudig | **meerkeuze** (vinkjes bij enum, chips bij reflijst) | herhaalbare rijen |
| Relatie → ENT, geen eigen velden | enkelvoudig | combobox op weergavenaam (`RefCombobox`, bestaat) | + "nieuwe aanmaken" |
| Relatie → ENT, geen eigen velden | meervoudig | **chips-multiselect** | rijen |
| Relatie → ENT, mét eigen velden (rol, toelichting) | beide | rij/subformulier per relatie | — |
| Veld → REF-lijst item (dependency) | enkelvoudig | combobox, maar als **waarde** (zie §6) | — |

**Meerkeuze is geen nieuw modelconstruct**, maar een compacte weergave van een meervoudige
compositie/relatie waarvan het item één betekenisdragend veld heeft. `BetrokkenOrganisatie`
(alleen `type`, enum) en `InitiatiefDomein` (alleen `domein_id`) voldoen daaraan en worden dus
automatisch vinkjes respectievelijk chips — afleidbaar uit de MetaRegistry, zonder FD-configuratie.

### 5.2 De widget staat op de relatie, niet op de doel-ENT

Bij `InitiatiefGemeente` bewerkt de widget de **relatie-hub** (rol + `gemeente_id`), niet de
gemeente. Vraag 8 en 9 zijn daarmee twee widgets op dezelfde relatie, elk met een vaste rol:

```jsonc
{ "type": "relatie", "bron": "Initiatief.initiatiefgemeente",
  "vast": { "rol": "Realiseert" }, "kies": "gemeente_id",
  "label": "Welke gemeenten realiseren mee?" }
```

> **Correctheidsregel:** `vast` werkt **zowel bij lezen als bij schrijven**. Filtert widget 8 de
> bestaande items niet op `rol = Realiseert`, dan staan gemeenten dubbel in beeld én voert de diff
> in `bouwLijstWijzigingen` bij opslaan de rijen van de andere widget af (ze ontbreken immers in
> zijn lijst). `vast` is dus tegelijk **filter op bestaande items** en **vaste waarde op nieuwe**.

Hetzelfde patroon als **vaste rijen** lost vraag 19–24 op (drie bijdragen met vaste
`type_bijdrage`); matching gebeurt dan op de vaste sleutel in plaats van op `rel_id`:

```jsonc
{ "type": "lijst", "bron": "Initiatief.bijdrage", "sleutel": "type_bijdrage",
  "items": [ { "vast": { "type_bijdrage": "Wendbaarheid" }, "label": "Wendbaarheid van gemeenten" },
             { "vast": { "type_bijdrage": "Dienstverlening" }, "label": "…" },
             { "vast": { "type_bijdrage": "Regie" }, "label": "…" } ],
  "elementen": [ { "veld": "schaal", "widget": "radio" }, { "veld": "toelichting" } ] }
```

### 5.3 Nieuwe doel-ENT aanmaken vanuit een relatie

Een ingebedde formulierdefinitie (embedded of modal, keuze in de definitie), met één harde regel
tegen oneindige diepte:

> Een ingebedde formulierdefinitie mag relaties **kiezen**, maar niet zelf weer een nieuwe ENT
> **aanmaken** (maak-diepte 1). Afdwingbaar bij het opslaan van de FD.

Voor het aanmeldformulier is dat genoeg: Organisatie aanmaken (naam + contactgegevens) en Persoon
aanmaken (naam + e-mail); de `Contactpersoon`-relatie ertussen legt het sjabloon zelf.

De widget is één ding, geen twee: een combobox waarin "**+ … toevoegen**" onderaan verschijnt zodra
niets matcht. Bij openbaar gebruik ontstaan duplicaten ("Paratmos BV" / "Paratmos b.v."), dus ruim
zoeken en bij aanmaken de bijna-treffers tonen. Technisch hangt dit aan B1: het subformulier levert
een fragment met `$nieuw.org`, dat de hoofdregistratie op twee plekken gebruikt
(`initiatieforganisatie.organisatie_id` en `contactpersoon.organisatie_id`).

### 5.4 Mag een relatie een nieuwe doel-ENT aanmaken?

Afleidbaar, met het **subtype** als scherpste signaal (scherper dan het domein):

| Doeltype | Afleiding | Aanvulbaar |
|---|---|---|
| `EntiteitSubtype = referentielijst_item` (Gemeente, Domein, ApiStandaard) | beheerde lijst met eigen levenscyclus | nee |
| ENT buiten het eigen domein | niet het eigen beheergebied | nee |
| ENT in het eigen domein (Organisatie, Persoon) | eigen gegevens | ja, mits er een ingebedde FD is |

In de praktijk drieledig: *kan niet* (model), *mag wel maar geen subformulier gedefinieerd* (geen
knop), *kan*.

> **Invariant:** de FD-instelling "nieuwe doel-ENT toestaan" mag alleen **beperken, nooit
> verruimen**. Een formulier is een openbaar oppervlak; verruimen hoort een model- of
> autorisatiebesluit te zijn, niet een FD-wijziging.

### 5.5 Op het formulierprofiel uit Studio gelegd (23-09-2026)

Het formulierprofiel (`web/vite/src/diagramprofielen/formulier/index.js`) modelleert de
`layout_json` als diagram en noemt zichzelf een *tweede control op hetzelfde model*. Dat is de
juiste lezing, in MVC-termen:

| MVC | Hier | Construct |
|---|---|---|
| **Model** | de registerdata: ENT, GE, relaties, bitemporeel | canoniek model |
| **Selectie** van het model | *welke* rijen | `QueryDefinitie` (§7.4), met het filter uit §7.6 |
| **View** | hoe je het ziet | `WeergaveDefinitie`, de visualisaties |
| **Control** | hoe je het bewerkt | `FormulierDefinitie` + widgets |

Dezelfde datamanipulatie kan dus op verschillende manieren worden vormgegeven; een widget
verandert de editor, niet de data. Het profiel kent nu:

- **elementtypen** `Formulier` (doeltype, status, standaard, definitie-versie), `Groep`
  (pad-context), `Rij` (richting), `Lijst` (bron ENT.GE meervoudig, min, max), `Conditioneel`
  (veld, operator, waarde) en `Notitie`, genest via de connector `bevat` (met `volgorde`);
- **veldtype** `veld` in het compartiment `velden`: veldpad, label, breedte, widget, alleen-lezen.

De voorstellen uit §5.1–5.4 passen daar grotendeels in **zonder nieuwe elementtypen**:

| Behoefte | Waar in het profiel | Wijziging |
|---|---|---|
| widget-afleiding (§5.1) | `veld.widget` bestaat al (vrije tekst) | leeg = afgeleid uit het model; waarden worden een vaste lijst |
| **meerkeuze** / chips (§5.1) | een meervoudig GE met één betekenisdragend veld = een `Lijst` | **`widget` ook op `Lijst`** (rijen / meerkeuze / chips): de control-dimensie bestaat op twee niveaus, per waarde én per verzameling |
| **`vast`** — filter én vaste waarde (§5.2) | een veld van het record met een vaste waarde | **`veld.vasteWaarde`**: niet als invoer getoond, geldt als filter bij lezen en als waarde bij opvoeren |
| **vaste rijen** (drie bijdragen, §5.2) | drie `Lijst`-elementen op `Initiatief.bijdrage`, elk met `vasteWaarde` op `type_bijdrage` en `min = max = 1` | geen: vaste rijen *zijn* lijsten van precies één, gefilterd op hun vaste waarde |
| vraag 8/9 (gemeenten per rol) | twee `Lijst`-elementen op `initiatief_gemeenten`, `vasteWaarde` op `rol` | geen, naast de `vasteWaarde` hierboven |
| nieuwe doel-ENT aanmaken (§5.3–5.4) | een `veld` op de secundaire id van een relatie | **`veld.nieuwFormulier`** (verwijzing naar een FD) + `nieuwModus` (ingebed / modal); leeg = niet toegestaan, en alleen beperkend t.o.v. het model |
| "indien toepassing" | `Conditioneel` | geen |

Twee gevolgen die het plan kleiner maken:

1. **Het registratiesjabloon (B3) krimpt sterk.** Met `vasteWaarde` en vaste rijen legt de layout
   zelf al de afbeelding naar wijzigingen vast: elk veld heeft een modelpad, elke lijst een bron
   en eventueel een vaste waarde. Wat overblijft voor een sjabloon is "één invoer naar twee
   doelen" (startdatum) en het cross-ENT-deel — en dat laatste loopt via `nieuwFormulier`.
2. **`vasteWaarde` en het API-filter zijn hetzelfde predicaat.** Een `Lijst` met
   `vasteWaarde: {rol: "Realiseert"}` selecteert precies wat het filter
   `initiatief_gemeenten: { rol: { eq: "Realiseert" } }` selecteert (§7.6). Het formulier gebruikt
   de gelijkheids-deelverzameling van dezelfde predicaattaal; het hoeft geen eigen taal te krijgen.

## 6. Referentielijsten, materiële tijd en het formulierregister

### 6.1 Twee onafhankelijke assen

- **As A — wáár de verwijzing staat:** als waarde in een veld, of als relatie met een eigen hub.
- **As B — hóe precies je verwijst:** alleen het item-id, item-id + peildatum, of een vastgepinde versie.

### 6.2 As B: het item-id alleen is niet genoeg

Twee soorten historie gedragen zich verschillend:

- **Naamswijziging — zelfde item.** Nieuwer-Amstel heet sinds 1964 Amstelveen: één entiteit, één
  id, twee materiële versies van `GemeenteGegevens`.
- **Fusie — ander item.** Haarlemmerliede en Spaarnwoude is per 2019 opgegaan in Haarlemmermeer:
  het item houdt materieel op te bestaan.

| Wat je opslaat | Lost op | Gaat mis |
|---|---|---|
| alleen item-id | identiteit staat vast | weergave onbepaald (Nieuwer-Amstel of Amstelveen?); keuzelijst kan alleen nu-geldige items aanbieden, dus een geboorte in 1950 is niet vast te leggen |
| **item-id + peildatum** (peildatum *afgeleid*, niet opgeslagen) | juiste naam op het juiste moment, juiste keuzelijst, correcties werken door | vraagt materiële reflijst-items + peildatum op de opties-API |
| item-id + vastgepinde versie | bevriest de weergave hard | bevriest ook **formele correcties**: een typefout in de gemeentenaam blijft voor eeuwig staan. Bitemporeel fout — materiële wijzigingen mogen van de peildatum afhangen, correcties moeten altijd doorwerken |

**Keuze: item-id + afgeleide peildatum.** Het id legt vast *wat je bedoelde*; de peildatum bepaalt
alleen *hoe je het toont en wat je mocht kiezen*. Niets extra's opslaan.

**Fusies zijn een vierde ding** en géén eigenschap van de verwijzing: de verwijzing naar
Haarlemmerliede en Spaarnwoude blijft correct voor een feit uit 2010. Wil je weten waar dat *nu*
onder valt, dan is een **opvolgrelatie tussen reflijst-items** nodig (`Gemeente` → `Gemeente`, rol
"opgegaan in", met datum) — in de referentielijst zelf, niet in het verwijzende gegeven.

### 6.3 As A: waar komt de peildatum vandaan?

| | Waarde in een veld | Relatie met eigen hub |
|---|---|---|
| Voorbeeld | geboortegemeente | `InitiatiefGemeente` (rol Realiseert) |
| Eigen duur | nee — die van het dragende gegeven | ja ("sinds 2024 aangesloten") |
| Eigen attributen | nee | ja (rol, toelichting) |
| **Peildatum** | **gratis**: de materiële tijd van het GE-record zelf (de geboortedatum) | die van de relatie zelf |
| Wijzigen | nieuwe versie van het GE-record | afvoer + opvoer van de relatie |
| Kosten bij lezen | kolom, geen join | join over hub + data |

Criterium: *draagt de koppeling eigen duur of eigen attributen?* Zo nee → waarde-referentie; zo ja →
relatie. "Dezelfde tijdscontext als het verwijzende gegeven" is dan geen extra regel, maar een
gevolg van waar de verwijzing staat.

**Stand in dit model:** het waarde-referentie-construct bestaat nog niet — elke reflijstverwijzing
is een relatie-hub met een `SecondaireEntiteitIDKolom`. Verder staat `Gemeente` op
`IsMaterieel: false` (`model/cg_metaregistry.go`), dus er is geen aanvang/einde om op te toetsen, en
`MaakVizReflijstOptiesHandler` levert alleen wat *nu* actief is (open data onder een actieve hub,
geen peildatum). Nodig voor tijdbewuste reflijsten: materiële tijd op de items (de CBS-bron levert
de indeling per jaar) + een peildatum-parameter op de opties-API. Het vangnet `AndersDanGemeente`
blijft nodig: geen enkele lijst dekt alles.

### 6.4 Formulierregister, logboek dataverwerking en moderatie

**Keuze: direct persisteren, niet eerst modereren.** Een leverancier die drie producten invoert,
voegt bij het eerste zijn bedrijf toe; bij het tweede moet dat al beschikbaar zijn. Modereren vóór
persisteren breekt dat. Dus wel meteen de database in, inclusief proefinvoer, maar niet meteen op de
publieke site.

**Het schrijf-logboek bestaat al.** `model.Registratie` heeft `bron`, `bron_kenmerk`, `request_body`,
`response_body`, `request_path`, `response_code` en `duration_ms`. Met
`bron = "aanmeldformulier"` en `bron_kenmerk = <inzending-id>` is elk binnengekomen formulier als
bericht bewaard én gekoppeld aan wat het registreerde. **Herkomst is daarmee afleidbaar zonder
modelwijziging**: welke organisaties/personen via een ongemodereerde aanmelding ontstonden, volgt
uit wijziging → registratie → `bron`. Precies wat nodig is om zulke items in de combobox te
markeren of achteraan te zetten.

**Wat ontbreekt:** opvragingen worden niet gelogd — de andere helft van het logboek dataverwerking.
Niet in dezelfde tabel onderbrengen: leesvolume is ordes van grootte groter dan schrijfvolume. Dat
is een eigen laag (het formulier-/berichtregister), naast het gegevensregister.

**Status: niet `Beoordeling` gebruiken.** De enum `CGPortfolioFase` (Brons, Zilver, Goud, Niet
gecontroleerd) verleidt daartoe, maar `Beoordeling` is een kwaliteitsdossier van VNG
(`datum_zilver`, `redenatie_goud`, `check_zilver`). Een initiatief kan gepubliceerd zijn en qua
kwaliteit nog niet gecontroleerd; die assen lopen uiteen. Voorstel: een eigen enkelvoudig GE
`Initiatief.Aanmeldstatus` (nieuwe aanmelding / geaccepteerd / afgewezen) — klein, en bitemporeel
betekenisvol (wanneer geaccepteerd, op grond waarvan).

> **Risico, harde voorwaarde vóór openstelling:** de publicatietabel filtert **niet op rijniveau**.
> `tabelConfig` kent `kolommen`, `standaardSortering` en filterbaarheid per kolom, maar geen
> rijselectie (`web/vite/src/publicatie/PublicatieTabel.jsx`). De filtersyntaxis `naam[veld=waarde]`
> bestaat wel in de weergavepaden (`publicatie/graphqlPaden.js`), dus de bouwsteen is er. Zolang er
> geen rijfilter is, verschijnt elke proefaanmelding meteen in de embed op commonground.nl.

**Afkeuren = ongedaanmaking.** Het register kent `RegistratietypeOngedaanmaking`; daarmee blijft
traceerbaar dat er iets is ingediend en afgewezen, zonder dat het data wordt. Met één voorbehoud:
dat kan alleen zolang er niets aan hangt. Heeft een volgende aanmelder dezelfde organisatie al
gekozen, dan het initiatief afvoeren en de organisatie laten staan.

### 6.5 Gevolgen voor de bouwstenen uit §4

| Bouwsteen | Bijstelling na deze ronde |
|---|---|
| B3 (registratiesjabloon) | `vast` is filter **én** vaste waarde; vaste-rijen-variant met `sleutel` |
| B4 (widgets) | grotendeels **afleidbaar** uit de MetaRegistry; FD overschrijft alleen |
| B5 (zoek-of-maak) | maak-diepte 1; aanvulbaarheid uit subtype/domein; FD mag alleen beperken |
| B6 (openbare indiening) | `bron`/`bron_kenmerk` volstaan voor het logboek; **rijfilter in de publicatie is de harde voorwaarde** |
| B7 (model) | + `Initiatief.Aanmeldstatus`; optioneel materiële tijd op reflijst-items + peildatum op de opties-API |

## 7. Rijfiltering: waarom niet in de handler, en wat dan wel

Vervolg op §6.4 (de publicatietabel toont elke proefaanmelding). Een eerdere versie van deze
notitie stelde voor om het filter in `MakeGetFullEntitiesByMetaHandler` te zetten. **Dat is fout:**
dan staat er een typenaam in een generieke handler, tegen `model/ontwerpkeuzen.md` §1 in
("handlers volledig generiek, geen model-referenties"). In een modelgedreven API hoort daar een
*mechanisme* dat een elders gedefinieerde regel uitvoert, geen regel.

### 7.1 Stand van zaken: drie deuren, geen selectiepredicaat

| Deur | Handler | Anoniem? |
|---|---|---|
| lijst | `MakeGetFullEntitiesByMetaHandler` (`handlers/full_handlers.go:1429`) | ja |
| detail op id | `MakeGetFullEntityByMetaHandler` (`:1538`) | ja |
| GraphQL-queries | `dynql.GraphQLHandler` (mutaties vereisen "editor") | ja |

Sinds 22-09-2026 is anoniem lezen een bewuste keuze (`main.go:214-220`): de publicatiepagina moet
zonder inlog werken. De pagina haalt daarbij **alles** op — `GET /full/{padnaam}?page=1&size=9999`
(`PublicatieTabel.jsx:150`, server kapt af op 2000) — en filtert in de browser.

**Er is geen selectiepredicaat in de API.** GraphQL-lijstqueries kennen alleen `limit` en `offset`
(`dynql/schema_builder.go:70-105`), detail-queries daarnaast `id`, `peiltijdstip` en `t`. Het
`initiatief_gemeenten[rol=Maakt gebruik van]` uit de weergavepaden is **client-side** filtering van
geneste lijsten ná het ophalen (`publicatie/publicatieUtils.js:11-30`) — aardig genoeg precies het
`vast`-patroon uit §5.2, maar het zegt niets over welke *rijen* de server teruggeeft.

### 7.2 Drie kandidaat-constructen

| | Idee | Oordeel |
|---|---|---|
| **Afgeleide klasse** | `GoedgekeurdInitiatief` = overerving van `Initiatief`, afgeleid met `aanmeldstatus = goedgekeurd` (backlog **B29 "Berekende klassen"**, 13-05-2026) | niet hiervoor — zie 7.3 |
| **API-construct** | aanvullende API-definitie als model: wijst canonieke elementen aan en transformeert | later, bij ontkoppeling van de publieke API — zie 7.5 |
| **Persisted queries** | trusted documents: opgeslagen, benoemde queries die de frontend aanroept | **eerste stap** — zie 7.4 |

### 7.3 Waarom de afgeleide klasse hier niet past

De intuïtie klopt — je wilt de deelverzameling een **naam** geven waar formulier, API en beleid naar
kunnen wijzen. Maar als *klasse* wringt het:

1. **Overerving is hier TPT**: `ParentTypenaam`, eigen tabel, eigen JSON-key. Een afgeleide klasse
   mag juist géén tabel hebben; het is dezelfde entiteit met een andere classificatie. Eén construct
   voor allebei vertroebelt het model.
2. **Het lidmaatschap flipflopt.** Goedgekeurd kan teruggedraaid worden. Een type waarvan de
   extensie van moment tot moment wisselt is een toestand, geen type — en bitemporeel wordt de vraag
   "in welke klasse zat dit vorige week" onnodig raar.
3. **Klasse-explosie**: `GoedgekeurdInitiatief`, `NieuweAanmelding`, `AfgewezenInitiatief`, …

Waar hij wél hoort: structurele deelverzamelingen met eigen betekenis of eigen velden — dan is het
een gewoon subtype. B29 blijft dus staan, maar niet voor statusfilters.

**De naam hoort op de beleids-/selectielaag.** Toegangsspraak heeft daar al een constructie voor:
`Begrippen` ("Inkomensgegevens zijn: …") plus rijcondities in de grammatica ("de achternaam van de
naam van de betrokkene begint met 'A'"). "Goedgekeurde initiatieven zijn: alle initiatieven waarvan
de aanmeldstatus 'geaccepteerd' is" is precies zo'n begrip — op de plek waar lidmaatschap *mag*
wisselen. Alleen: toegangsspraak is v0 (branch `feat/toegangsspraak`), zonder runtime-handhaving.

### 7.4 Persisted queries als `QueryDefinitie`

Dit is de eerste stap, en niet alleen als noodgreep:

- **Generiek in de backend.** `dynql.GraphQLHandler` (`dynql/handler.go:29-65`) is nu al typeloos:
  query-string erin, mutatieguard erop. Een `documentId` dat een opgeslagen document oplevert
  verandert daar niets wezenlijks aan.
- **Het drieluik wordt compleet**: `WeergaveDefinitie` = presentatie, `FormulierDefinitie` = invoer,
  `QueryDefinitie` = **selectie**. Daarmee zit het hek niet in de weergaveconfiguratie (die
  redacteuren bewerken), maar is het wél data.
- **Dogfooding**: `QueryDefinitie` is een uitbreiding van het **configuratie-domein**, getekend in de
  editor, via de V3-JSON-roundtrip gegenereerd naar `model/configuratie_*.go` en dbsetup — net als
  `WeergaveDefinitie` en `FormulierDefinitie`. Geen handgeschreven tabel.
- **Bitemporeel**: de opgeslagen queries zijn gewone registerdata. Je kunt terugzien wélk document de
  publieke site in juni uitvoerde, en een wijziging is een registratie met een reden. Voor een
  publiek portfolio is dat winst, niet alleen boekhouding.
- **De poort** (de tweede helft, zonder welke het cosmetica blijft): anoniem mag *alleen* opgeslagen
  documenten uitvoeren; ad-hoc GraphQL en de generieke REST-GET's vereisen een rol. Eén generieke
  regel in de routing, zonder typenaam.

Gevolg voor de frontend: de publicatietabel moet van `/full/{padnaam}` naar een opgeslagen
GraphQL-document. De detailpagina gaat al via GraphQL, dus het is een halve stap — en meteen de
oplossing voor de stille afkap op 2000 rijen, want dan kan er server-side gepagineerd worden.

#### 7.4.1 Het model (23-09-2026, tweede versie)

✅ **Model gebouwd**, tweede versie (branch `feat/querydefinitie-losse-ges`). V3-invoer:
`docs/Model files (V3)/configuratie 2026-09-23 QueryDefinitie v2 (losse GEs) — v3-model.json`,
gegenereerd met `--domein configuratie` (werkwijze: `docs/CODEGEN.md` §7.5). De eerste versie
van dezelfde dag (commit `e78c494`, een `Meta`-blob met vijf velden) is vervangen; instanties die
die versie hebben gedraaid: `scripts/sql/2026-09-23-querydefinitie-losse-ges-opruimen.sql`.
Nog **niet** gebouwd: uitvoeren op naam en de poort (7.4.2, 7.7 stap 2–3).

**Ontwerpregels** (uit de discussie van 23-09):

- **QueryDefinitie is een gereserveerd woord**, geen subtype uit het metamodel. De backend zoekt
  het bij naam op, zoals `Referentielijst` feitelijk ook (`routes/addroutes_helper.go`). Een
  startcontrole toetst de verwachte GE's en velden en zet uitvoeren-op-naam anders uit.
- **Eén GE per feit met een eigen tijdlijn.** Een `Meta`-blob kopieert bij elke statuswijziging
  alles mee; dat is precies wat het register niet wil. Materialiteit per GE, niet op de blob.
- **Enkelvoudig betekent al "0..* over de tijd, 1 tegelijk"** (`Momentvoorkomen` = het
  voorkomen op enig moment). `Layout`, `TabelConfig` en `DetailTemplate` van de andere
  definities zijn ten onrechte meervoudig (de frontend neemt `[0]`); dat wordt apart gerepareerd,
  want daar staat data op de NAS en de VPS en enkelvoudig voegt een exclusieconstraint toe.
- **Formeel** = in het register opgenomen; **materieel** = geldig in de buitenwereld, hier: de
  geldigheid van de persisted query. Materialiteit van de entiteit = levensduur als geheel (één
  keer starten, één keer stoppen); materialiteit van een GE = die wijziging is te **stagen**.

| GE | Velden | Materieel | Waarom |
|---|---|---|---|
| **QueryDefinitie** (ENT) | — | ja | levensduur van de definitie als geheel |
| `QuerydefinitieNaam` | `naam` | nee | het gepubliceerde contract (`documentId`); hernoemen is een nieuwe hub |
| `QuerydefinitieBeschrijving` | `beschrijving` | nee | hoog-over |
| `QuerydefinitieStatus` | `status` (concept / actief / inactief), `reden` | **ja** | "actief vanaf 1 oktober" stagen; `reden` vertelt de afnemer waarom de status is *geworden* wat hij is |
| `QuerydefinitieToegankelijkheid` | `toegankelijkheid` (publiek / intern) | **ja** | enum i.p.v. bool, zodat FTV er later een policy-verwijzing van kan maken; ontbreekt het GE, dan geldt intern |
| `QuerydefinitieDocument` | `graphql_document`, `definitie_versie`, `toelichting` | **ja** | nieuwe versie stagen; `toelichting` beschrijft déze versie |

Alle GE's enkelvoudig. `Doeltype` is vervallen: afleidbaar uit de root-velden van het document,
en een document kan er meer dan één hebben.

**Betekenis van de status.** Concept = klad, niet opvraagbaar. Actief = opvraagbaar. Inactief =
ingetrokken: bekend, maar niet meer opvraagbaar — een aanroep op die naam krijgt "ingetrokken"
(410) met de `reden`, in plaats van "onbekend" (404).

**Versienummer opvragen: nee.** De naam is het contract, de versie is informatief (zoals bij een
REST-pad). Twee versies naast elkaar in de lucht = twee namen. Een oude versie bekijk je via het
peiltijdstip. Daarom is `Document` enkelvoudig.

**Beschrijving in het GraphQL-document zelf: nee.** Executable documents kennen in de spec geen
description; `#`-commentaar gooien parsers weg, en het voorstel voor descriptions op operaties
kent graphql-go 0.8.1 niet. `Document.toelichting` is de betere plek: registerdata met historie.

**Naamgeving.** De GE's heten `QuerydefinitieNaam`, `QuerydefinitieBeschrijving`,
`QuerydefinitieStatus`, `QuerydefinitieToegankelijkheid` en `QuerydefinitieDocument` — PascalCase
met de entiteit als voorvoegsel, zoals `Organisatienaam` en `Persoonnaam` in CG. Dat is bewust: de
codegen leidt de `Veldnaam` (de sleutel in de registratie-API) af uit het laatste deel van de
typenaam, en `runtime.veldnaam` in de V3-JSON wordt niet gelezen. Een kaal `Naam` zou de veldnaam
`naam` krijgen, die in CG al bestaat; met het voorvoegsel zijn de sleutels uniek:
`querydefinitienaam`, `querydefinitiestatus`, `querydefinitiedocument`, … (tabellen:
`querydefinitie_querydefinitienaam` enz.). In GraphQL heten ze naar hun rolnaam: `query_definitie_namen`, `query_definitie_statussen`,
`query_definitie_toegankelijkheden`, `query_definitie_documenten`. De actieve, publieke documenten:

```graphql
{ full_query_definities_list(filter: {
    query_definitie_statussen:        { status: { eq: "actief" } }
    query_definitie_toegankelijkheden: { toegankelijkheid: { eq: "publiek" } } }) {
  id query_definitie_namen { naam } query_definitie_documenten { graphql_document definitie_versie } } }
```

Geverifieerd tegen een lege PostgreSQL: 19 tabellen bij de eerste start, registratie van twee
definities via `POST /registratie/`, en de filters hierboven geven de juiste rijen (ook `not:
{ query_definitie_toegankelijkheden: {} }` voor "zonder toegankelijkheid").

**Variabelen mogen alleen versmallen.** Een opgeslagen document met `filter: $filter` zou een
anonieme aanroeper elk filter laten meegeven — en dus het hek laten omzeilen. Het veilige patroon
vergt geen servercode, want GraphQL staat variabelen binnen een object-literal toe:

```graphql
query PubliekeInitiatieven($extra: InitiatiefFilter, $offset: Int) {
  initiatieven(filter: { and: [ { aanmeldstatus: { status: { eq: "geaccepteerd" } } }, $extra ] },
               limit: 25, offset: $offset) { id weergavenaam }
}
```

Het vaste deel staat in het document; de aanroeper kan via `$extra` alleen nog extra condities
toevoegen (EN), nooit iets weghalen. Dit werkt sinds 23-09-2026: graphql-go laat een optionele
variabele niet toe op een plek die een niet-nullable item verwacht, dus de items van `and`/`or`
zijn nullable gemaakt, en een null-item telt niet mee (in een `or` levert het géén "altijd waar"
op). Tegelijk opgelost: `or: []` gaf "geen conditie" (dus alles) en is nu nooit waar. Getest in
`TestFilter_OpgeslagenDocumentAanroeperVersmaltAlleen`, inclusief een poging tot verruimen met
een `or` in `$extra`. Dat is dezelfde invariant als bij §5.4: **definities mogen
beperken, aanroepers niet verruimen.** Bij het opslaan is dit te controleren (een filter-argument
dat als geheel een variabele is, wordt geweigerd voor `is_publiek`).

#### 7.4.2 Dynamische opbouw: geen herstart bij een nieuwe QueryDefinitie

Een QueryDefinitie is **data**, geen model. Dat is het verschil met een metamodelwijziging: die
geeft nieuwe structs, endpoints en tabellen en vraagt codegen plus herstart. Een persisted query
gebruikt het *bestaande* datamodel en het *al gebouwde* GraphQL-schema. Er hoeft dus niets
"gebouwd" te worden; er hoeft alleen iets **opgezocht** te worden.

Hoe een aanroep verloopt:

1. De frontend stuurt `documentId` (de `Naam`) en variabelen, geen query-tekst.
2. De handler zoekt de QueryDefinitie op **op het moment van de aanroep**: `Naam` = documentId,
   `Status` actief en `Toegankelijkheid` toereikend voor de aanroeper, en het `Document` — alle
   drie formeel actueel én materieel geldig op *nu*. Dit is één geïndexeerde query op het
   eigen register; de generieke filter uit §7.6 kan hem uitdrukken.
3. Het opgeslagen document gaat door dezelfde `graphql.Do` als een ad-hoc query, tegen het
   schema dat bij het opstarten uit de MetaRegistry is gebouwd.

Omdat stap 2 per aanroep gebeurt, werkt staging vanzelf: "actief vanaf 1 oktober" gaat op
1 oktober werken zonder dat iemand iets doet. Een eenmalige opbouw bij het opstarten zou dat juist
onmogelijk maken — en dat is de reden om de materialiteit níet in een statische set te vertalen.

Wat wél bij het opstarten en bij registratie gebeurt, is **valideren**:

- **Bij registratie** van een `Document`: het document parsen en valideren tegen het schema;
  ongeldig = geweigerd. (Een hook op het gereserveerde type; de registratie-engine kent al de
  `Domeinen` per wijziging.)
- **Bij het opstarten**: alle actuele documenten opnieuw valideren en afwijkingen loggen. Dat
  vangt het geval dat het metamodel onder een document vandaan is veranderd.
- **Cache** (later): de opzoekstap cachen op naam en ongeldig maken bij een registratie die het
  configuratie-domein raakt. Een optimalisatie, niet de waarheid; de database blijft de bron.

**Stand 24-09-2026 — gebouwd** (branch `feat/persisted-queries-uitvoeren`), zie
`docs/dynamische-graphql-laag.md` § Uitvoeren op naam:

- `documentId` op `/graphql/query` (POST en GET); 404/410/401-403/400/501 zoals hierboven;
  variabelen alleen versmallend. `POST /graphql/valideer` voor de frontend vóór het opslaan.
- Contractcontrole in `BuildSchema`, documentvalidatie bij het opstarten in `main.go` (log).
  Afdwingen in de registratie-engine is nog niet gebouwd.
- Getest: 13 scenario's tegen PostgreSQL, en end-to-end met de echte binary: registreren via
  `POST /registratie/`, meteen daarna uitvoeren op naam zonder herstart.

**Bevinding bij het bouwen — enkelvoudig op een materieel GE (Mark, 24-09):** enkelvoudig
hoort te betekenen *één materieel geldig record tegelijk*, met meerdere formeel actieve records
(de woongeschiedenis is actueel; je woont op één adres tegelijk). De exclusieconstraint
`ux_…_enkelvoudig_actief` dwingt nu "één formeel actieve hub" af, waardoor stagen naast de
huidige status niet kan: een nieuwe status met aanvang 1 oktober vervangt de vorige meteen en de
definitie is tot 1 oktober niet opvraagbaar. Backlog **B33**. De uitvoerder kiest al per GE het
materieel geldige record uit alle formeel actieve hubs (`kiesGeldigeHub`) en werkt dus in beide
werelden — de integratietest dekt het gestagede geval met twee formeel actieve hubs.

### 7.5 Het API-construct: later, en bovenop

Een publieke portfolio-API hoort niet de hub/`_Data`-structuur te tonen, en een eigen projectie per
gebruik is precies wat een API-profiel doet; het sluit ook aan op de bestaande OAS-generatie per
domein. Waarschuwing: "transformaties" is een hellend vlak. Projectie, hernoemen en een
selectiepredicaat zijn te overzien; komen samenvoegen, afleiden en aggregeren erbij, dan bouw je een
tweede querytaal naast de GraphQL-laag die er al is. Pas doen als het doel *ontkoppeling* is, en dan
bovenop 7.4.

### 7.6 De ontbrekende primitief: een generiek filter-argument

Alle drie de constructen stranden op hetzelfde: **je kunt een deelverzameling nog niet uitdrukken.**
Nodig is een `filter`-argument op de lijst-queries, gegenereerd uit de MetaRegistry zoals
`dynql/input_type_builder.go` nu al inputtypen genereert.

De vorm kan de GraphQL-schemavorm volgen, want **hub en `_Data` zijn daar al platgeslagen**
(`dynql/type_builder.go:219-221`: een hubtype toont ook de velden van zijn `_Data`):

```graphql
initiatieven(filter: { aanmeldstatus: { status: { eq: "geaccepteerd" } } }, limit: 25) { … }
```

Aandachtspunten, in volgorde van scherpte:

1. **SQL-vorm.** De entiteit heeft geen eigen *opgeslagen* velden (wel afgeleide, zie 7.6.1);
   filteren betekent dus altijd `EXISTS` over hub + `_Data`. Het patroon staat al in
   `handlers/viz_reflijst_opties_handler.go`: data telt alleen als de hub óók actief is.
2. **Actief-zijn is een filter op zichzelf.** `afvoer IS NULL` op zowel hub als data, tenzij er een
   peiltijdstip is. De lijst-queries kennen nu **geen** `peiltijdstip` (alleen de detail-queries),
   dus filter en formele tijd moeten in één keer goed: "geldt dit predicaat op peilmoment T".
3. **Meervoudige GE's**: `EXISTS` betekent "ten minste één actief record voldoet". Voor
   `betrokkenorganisatie.type = Gemeenten` is dat de bedoeling; wil je ooit "alle", dan is dat een
   ander kwantor en moet de syntaxis dat kunnen zeggen. Begin met `EXISTS` en documenteer het.
4. **Relaties en reflijsten**: filteren op `initiatiefgemeente.gemeente_id` is dezelfde `EXISTS`, maar
   op de relatie-hub. Filteren op de *naam* van de gemeente is een hop verder en kan in stap 1
   buiten scope blijven.
5. **Kosten**: een `EXISTS` per predicaat. Met ~120 initiatieven irrelevant; als het generiek wordt,
   is een index op `(entiteit_id, rel_id)` plus `afvoer IS NULL` de aandacht waard.

#### 7.6.1 Afgeleide velden zijn (nog) geen filterdoel

Een entiteit heeft wél afgeleide velden — `weergavenaam` bijvoorbeeld — en daar wil je logischerwijs
op kunnen filteren. Dat kan nu niet: afgeleide velden worden **in Go berekend ná het laden**
(`verrijkEigenAfgeleideVelden`, `dynql/query_resolvers.go:1056-1071`, over de al platgeslagen
entity-map). De database kent ze niet, dus SQL kan er niet op filteren.

| Route | Hoe | Prijs |
|---|---|---|
| na afloop filteren | laden, verrijken, dan in Go filteren | breekt paginering: je filtert ná `LIMIT`, dus "25 per pagina" klopt niet meer. Werkt alleen zolang je alles ophaalt (wat de publicatiepagina nu toevallig doet) |
| afleidingsregel naar SQL vertalen | concatenatie/vergelijking is uit te drukken | **twee implementaties van dezelfde regel** die uit elkaar lopen; `leeftijd(...)` is al grensgeval |
| materialiseren | bij registratie berekenen en als kolom opslaan | één implementatie, gewoon filteren én sorteren. Maar bij een gewijzigde afleidingsregel moet je herberekenen — en dan verandert de *historische* waarde |

Die laatste afweging is dezelfde als bij de reflijst-pinning (§6.2): bevriest een opgeslagen afgeleide
waarde de oude regel, of herschrijft herberekening het verleden? Voor een weergavenaam is
herberekenen prima; voor iets met juridische betekenis niet.

**Keuze:** stap 1 dekt alleen echte kolommen. Route 1 voor incidenteel gebruik, **materialiseren**
voor de velden waarop structureel gefilterd of gesorteerd wordt, en vertalen naar SQL alleen als de
afleidingstaal ooit een echte SQL-backend krijgt.

**Sorteren heeft exact hetzelfde probleem**: server-side sorteren op `weergavenaam` kan vandaag ook
niet. De bestaande work-around staat in de reflijst-combobox: die zoekt met `ILIKE` op de
onderliggende stringkolommen van de data-tabel, niet op de afgeleide naam.

### 7.7 Volgorde

1. **Generiek `filter`-argument** op de lijst-queries, gegenereerd uit de MetaRegistry (7.6).
   ✅ **Gebouwd** (22-09-2026, branch `feat/graphql-filter-argument`): `dynql/filter.go`, met
   `peiltijdstip`/`t` op de lijst-queries en een vaste volgorde op `id`. Gebruik en grenzen:
   `docs/dynamische-graphql-laag.md` § Filteren. Getest met sqlmock én tegen een echte
   PostgreSQL (`dynql/filter_pg_test.go`), inclusief de valkuil "363 gebruikt, 599 realiseert".
2. **`QueryDefinitie`** in het configuratie-domein via model + codegen; publicatietabel roept een
   opgeslagen document aan (7.4).
   ✅ Model (23-09), uitvoeren op naam (24-09), de QueryDefinities `publieke-initiatieven` en
   `publiek-initiatief-detail` als replay (filteren op `aanmeldstatus = geaccepteerd`, B7a) én de
   publicatiepagina omgezet (24-09): `tabel_config_json` krijgt `query`/`detailQuery`, lijst in
   pagina's van 100 via `documentId`, detail via `$id`; zonder die sleutels het oude gedrag
   (`docs/PUBLICATIE_TEMPLATES.md`). De detailselectie ligt nu vast in het document — het
   moet alle template-paden bevatten (voorproefje van de GV, §8).
3. **De poort**: anoniem alleen opgeslagen documenten; REST-GET's en ad-hoc GraphQL achter een rol.
   **Let op bij het ontwerpen (24-09):** de publicatiepagina heeft naast de data ook *metadata*
   ✅ **Voorbereid** (24-09, branch `feat/leestoegang-poort`, standaard uit): `LEESTOEGANG=open|documenten`
   (`middleware/leestoegang.go`, `routes/leestoegang.go`, vierde guard in `dynql.GraphQLHandler`).
   Open blijven: het configuratie-domein en referentielijsten (uit het model afgeleid),
   schema/metadata-endpoints, introspectie, publieke `documentId`. Dicht: REST-GET's op
   registerdata, `/registraties`, `/wijzigingen`, `/tests`, bestanden, `max-id`/`secondaire-ids`,
   ad-hoc GraphQL. Aanzetten pas na verificatie van de embed (`VPS_DEPLOYMENT.md` §9).
   anoniem nodig: `/api/viz/schema` (typeMeta), `/full/weergave_definities` (de WD zelf),
   GraphQL-introspectie (`normaliseerTemplatePaden`) en `/api/viz/reflijst/…/opties` (alleen de
   terugval-kolommen). De poort gaat dus over *registerdata*, niet over configuratie en schema —
   of de WD-lookup wordt zelf een opgeslagen document.
4. Later neemt **toegangsspraak** stap 3 over met echte rijcondities; de grammatica kan het al,
   alleen de handhaving ontbreekt.

Stap 1 en 2 zijn ook los van het aanmeldformulier nuttig (server-side paginering, benoemde queries
voor de embed). Stap 3 is de harde voorwaarde vóór het formulier opengaat.


## 8. GegevensVerzameling — de query als modelelement

*Uit de discussie van 23-09-2026; ontwerpidee, niets gebouwd.*

Een **GegevensVerzameling (GV)** is een benoemd deelmodel, getekend in termen van het canonieke
model: welke ENT's, GE's, relaties en referentielijsten, en van elk welke velden. Het is de
visuele, in het model te tekenen tegenhanger van een query. Omdat de GraphQL-laag een mechanische
afbeelding van het canonieke model is (typenaam → padnaam, hub + `_Data` platgeslagen, rolnaam
als veld), kan een GV door diezelfde afbeelding worden gehaald: **de GraphQL-representatie van een
GV is de persisted query.** `QueryDefinitie.Document` wordt dan een afgeleid veld ("gegenereerd
uit GV X plus selectie"), met de handgeschreven variant als terugval zolang de GV er niet is.

### 8.1 Wat een GV is en niet is

- **Aggregatie** van een hele ENT met onderliggende GE's; **«gebruikt»** voor een deel, met een
  veldenlijst en afgeleide velden (CEL) voor samenstellingen. Voorbeeld: `/NP-naam-geb-plaats` =
  een dunnere NP: samengestelde naam, geboortedatum, woonplaats; geen BSN, burgerschap of adres.
  Een GV kan zo'n persoon plus de gemeenteverzameling bevatten: de *ruimte* waarop te bevragen is.
- **Een GV definieert de ruimte, niet de selectie.** Het predicaat (welke rijen) hoort bij de
  QueryDefinitie, niet bij de GV; anders ontstaat "GV-op-predicaat" met dezelfde problemen als de
  afgeleide klasse in §7.3.
- **Alleen voor opvragen**: QueryDefinitie en WeergaveDefinitie, niet voor formulieren. Een
  formulier schrijft, en schrijven op afgeleide gegevens vergt het terugvolgen van de afleiding
  (de inverse functie). Formulieren blijven daarom op het canonieke model.
- **Plat of genest** is een weergave-eigenschap: genest is de natuurlijke GraphQL-vorm, plat is
  een projectie met afgeleide velden — wat de publicatietabel met veldpaden nu al doet.

### 8.2 Wat het samenbrengt

| Eerder in deze notitie | Wat de GV ermee doet |
|---|---|
| §7.5 API-construct ("transformaties zijn een hellend vlak") | begrenst het tot projectie, samenstelling en aggregatie: een deelmodel, geen tweede querytaal |
| §7.3 afgeleide klasse (B29) | een dunnere representatie is een projectie, geen subtype-op-predicaat — het legitieme deel van B29 |
| toegangsspraak `Begrippen` ("Inkomensgegevens zijn: …") | een begrip is een GV in woorden; een policy kan naar een GV wijzen |

Zo wordt de GV het gedeelde **vocabulaire**: QueryDefinitie selecteert eruit, WeergaveDefinitie
toont er kolommen van, toegangsspraak beschermt hem. Eén naam, drie gebruikers.

### 8.3 Wat een persisted query nog meer moet definiëren

Naast de GV (de vorm), van onmisbaar naar later:

1. **Selectie** — het vaste deel van het filter (§7.6).
2. **Variabelen** — welke, type, default; en de invariant dat ze alleen versmallen (§7.4.1).
3. **Paginering** — limiet en offset, met een maximum dat de definitie zet.
4. **Sortering** — nu alleen op id. Sorteren op een GE-veld vraagt dezelfde join-machinerie als
   het filter; afgeleide velden kunnen server-side niet (§7.6.1). De eerstvolgende primitief.
5. **Tijdcontext** — formeel peiltijdstip (vast op "nu" of als variabele); later de materiële
   peildatum als die op de lijst-queries komt.
6. **Identiteit en contract** — naam, versie, toelichting (de GE's van §7.4.1).
7. **Toegankelijkheid** — nu publiek/intern, later een policy.
8. **Cache-hint** — hoe lang de embed het antwoord mag bewaren; voor commonground.nl nuttig.

Wat de GV zelf nodig heeft als metamodelelement: benoemde afgeleide representaties (dik of dun),
«gebruikt» met veldenlijst, aggregatie van hele ENT's, multipliciteit van geneste verzamelingen,
afgeleide velden in CEL — en een eigen diagramprofiel, naast het formulierprofiel (§5.5).

## 9. Stap A gebouwd — het formulier voor een ingelogde gebruiker (24-09-2026)

Branch `feat/aanmeldformulier-stap-a`. Wat er nu is, tegen de bouwstenen uit §4/§5.5:

| Onderdeel | Waar | Wat |
|---|---|---|
| **Nieuw-modus** (B2) | `web/vite/src/components/editor/NieuwFormulierPagina.jsx` | rendert een FormulierDefinitie zonder entiteit; bij *Verzenden* haalt hij `max-id` op en stuurt één registratie: entiteit, `initiatief_aanvang`, enkelvoudige GE's, en per lijstrij een opvoer. Preview van de wijzigingen onderaan. |
| **Mapping** (B3, gekrompen) | `nieuwFormulierMapping.js` (+ test) | pure logica: `verzamelVasteWaarden`, `lijstenPerBron`, `bouwLijstItems`, `bouwNieuwWijzigingen` → `{ wijzigingen, ontbrekend }`. Een rij waarin buiten de vaste waarden niets is ingevuld, wordt niet opgevoerd; een deels ingevuld GE met een leeg verplicht veld blokkeert het verzenden. |
| **Ingang** | `NieuwRecordFormulier.jsx` (`/t/:typePad/nieuw?formulier=<id>`) | keuzelijst *Invoer via*: standaard (alle GE's) of een actieve FormulierDefinitie voor het doeltype (`useFormulierDefinities`). |
| **`veld.vasteWaarde`** (§5.2/5.5) | renderer, mapping, profiel, inspector | niet getoond; buiten een lijst een vaste waarde bij opvoeren (`aanmeldstatussen.status = nieuwe_aanmelding`), **in een lijst óók het filter** van die lijst. |
| **Vaste rijen** (§5.2) | lijst met `min = max = 1` + `vasteWaarde` | drie lijsten op `Initiatief.bijdragen` (Wendbaarheid/Dienstverlening/Regie) en twee op `initiatief_gemeenten` (rol) delen één array en tonen elk hun eigen rijen. Tot `min` worden virtuele rijen getoond die pas bij invoer in de array komen. |
| **`lijst.widget = meerkeuze`** (§5.1) | renderer | één enum-veld in het sjabloon → checkbox per optie; per vinkje een rij `{ ...vast, [veld]: optie }`. |
| **`veld.widget = radio`** | `SchemaFormField` | enum als radiogroep (schaal 1–4, producttype). |
| **`veld.kopieerNaar`** | renderer | één invoer, twee doelen: `planningen.startdatum` → `Initiatief.aanvang.datum` (materiële aanvang). |
| **Relaties in lijsten** | `customFormMapping.bronVeldenVoorChild` | de secundaire id (`gemeente_id`, `organisatie_id`) staat in het schema alleen op de hub; hij wordt nu als eerste bronveld toegevoegd met `ref` (referentielijst → `RefCombobox`) of `doelEntiteit` (gewone ENT → nieuw `EntiteitCombobox`, keuze uit bestaande records met zoekfilter). Geldt ook voor de bestaande bewerk-modus. |
| **Profiel/Studio** | `diagramprofielen/formulier/{index,adapter}.js`, `FormulierInspector.jsx`, `layoutModel.js` | `vasteWaarde`, `kopieerNaar` op *veld*; `widget`, `min`, `max` op *Lijst*; round-trip verliesvrij (test). Boomlabel toont *(vaste rij)* / *(meerkeuze)*. |
| **FormulierDefinitie 2 "Aanmelding initiatief"** | `replay files/registraties-replay-init-formulierdefinitie-aanmelding-initiatief-2026-09-24.json` (README stap 16) | 36 velden in zes groepen; de 30 vragen op de modelpaden uit §2. Pitch conditioneel op `producten.type == Toepassing` ("Indien een toepassing, pitch je product"). |

**Getest:** 582 frontend-unittests groen, `vite build` ok; e2e zonder browser tegen het lokale
schema (`scripts` in de sessie): alle 36 veldpaden resolven, een ingevuld formulier geeft
17 opvoeren, `POST /registratie/` 201 → initiatief 144 met aanvang, product, status
`nieuwe_aanmelding`, twee bijdragen (de lege vaste rij *Dienstverlening* niet), gemeenten per
rol, organisaties per rol, meerkeuze-typen, domein en API-standaard; `publiek-initiatief-detail`
geeft hem niet terug (niet geaccepteerd). Lokaal staat FD 2 nu in de dev-database.

**Bewust niet in stap A** (→ stap B/C):

- Vraag 3/4 (parallel, componenten): geen veld; toelichting bij de omschrijving.
- Vraag 14/15 (PO en e-mail): andere ENT (`Persoon`), zoek-of-maak; vraag 10/13 kiezen nu uit
  bestaande organisaties (`EntiteitCombobox`), aanmaken volgt met `veld.nieuwFormulier` (§5.3).
- Vraag 30 (vragen over het formulier): `Initiatiefinfo` vereist ook `PbiID`; hoort eerder in
  het logboek van de aanmelding (§6.4) dan in het initiatief.
- Verplichte lijsten (contactorganisatie *) worden nog niet afgedwongen: een lege vaste rij
  wordt gewoon overgeslagen. Formulier-niveau validatie (min-rijen) is een kleine vervolgstap.
- Het formulier staat achter de editor-login; de openbare indiening (bron = aanmeldformulier,
  server-side `$nieuw.x`-id's) is stap C.
