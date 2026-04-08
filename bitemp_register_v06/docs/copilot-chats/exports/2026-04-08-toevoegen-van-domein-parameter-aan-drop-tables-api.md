# Chat: Toevoegen van domein-parameter aan drop tables API

- **Datum**: 2026-04-08 11:20
- **Sessie-ID**: `0dd764a8-35ab-4a9d-9aa4-afb5abb96a2f`
- **Berichten**: 4

---

## 🧑 User

We hebben nu een mooie drop tables API, maar die zou eigenlijk een domein-parameter moeten hebben: alleen de tables uit een bepaald domein droppen. Kun je die parameter en functie er bij maken?

---

## 🤖 Assistant

Now let me understand the `Domein` field in the MetaRegistry: Now I have a clear picture. Let me also check the `SchemaDomein` model and the existing route registration, plus see the `Registratie`/`Wijziging` tables and their relationship to domains:  Now let me look at the existing  to see how it uses the MetaRegistry, to understand the pattern for domain filtering:  Now I have a complete picture. Let me also check the tests to understand them: Now let me look at the  function in  to understand the route registration: 
```

```
Now add the  function at the end of the file: 
```

```
Now update the handler to accept an optional  query parameter: 
```

```
Now add a test for the domain-specific drop. Let me check the existing test structure more carefully: The existing tests test with , which triggers the "database not initialized" error. I can add a similar test for the domain query param — it will also get 500 (DB not initialized), but it verifies the route accepts the parameter and goes past the auth checks correctly: 
```

```
Now update the README documentation:  
```

```
Build succeeds. Now run the tests:  Alle tests slagen. Hier is een samenvatting van de wijzigingen:

**Wat is er gewijzigd:**

1.  — Nieuwe functies  en  toegevoegd. Deze droppen alleen model-tabellen waarvan  matcht met de opgegeven parameter. Gedeelde plumbing-tabellen (registratie, wijziging) worden niet aangeraakt.

2.  —  handler uitgebreid met optionele query parameter . Met parameter: domein-specifiek droppen. Zonder: bestaand gedrag (alles droppen).

3.  — Twee nieuwe tests:  en .

4.  — Documentatie bijgewerkt met uitleg over de  query parameter en aangepaste curl/Postman voorbeelden.

**Gebruik:**
```bash
# Alles droppen (bestaand)
curl -X DELETE http://localhost:8080/admin/db/droptables/1234

# Alleen domein 'np-loc' droppen
curl -X DELETE "http://localhost:8080/admin/db/droptables/1234?domein=np-loc"
```

---

## 🧑 User

okee, dat werkt. 

Er gebeurt iets dat ik niet verwacht met ApiStandaard (RefLijstItem = ENT) - Naam (GE):
- in de db worden dat de apistandaard en naam en naam_data tabellen

Ik zou verwachten apistandaard_naam en apistandaard_naam_data.

Zoals bij de NP bijv. 

Domein doet hetzelfde .

We hebben iets gewijzigd aan het loskoppelen van Naam (klassenaam) en Typenaam, maar dit zou gebaseerd moeten zijn op het pad van ENT naar GE, zodat je nooit clashes krijgt tussen GE-en met dezelfde naam (bijv. "Naam"), maar onder een andere ENT.

Hoe zit dat nu in de code?

Ik zie in de MR: 
tabelnaam: naam

Dat komt daar in tijdens genereren?

---

## 🤖 Assistant

Helder. Het probleem zit in `geHubTypeName()` — die geeft voor referentielijst-items alleen de korte naam terug (bijv. ) i.p.v. `"ApiStandaard_Naam"`. Daardoor wordt de tabelnaam gewoon `"naam"` i.p.v. `"apistandaard_naam"`.

Laat me de exacte code bekijken en fixen: Nu snap ik het volledig. Laat me ook even kijken hoe  wordt aangeroepen in `gen_registry.go`:   Nu snap ik het volledig. Het probleem is dat  voor referentielijst-items (waar `EntiteitSubtype != ""`) de GE-naam ongeprefixt teruggeeft. De oorspronkelijke gedachte was dat referentielijst-GE's "al volledig gekwalificeerd" zouden zijn (zoals "Landcode"), maar dat klopt niet voor generieke namen als "Naam" of "DomeinGegevens".

Laat me ook even de V3 JSON bekijken om te zien wat de GE-namen zijn:  Nu ook de struct-generatie bekijken — hoe wordt  daar gebruikt: Het is duidelijk:  wordt overal gebruikt en stuurt alle naamgeving. De fix is simpel — voor referentielijst-items moet de entiteitsnaam ook als prefix worden gebruikt, net als bij normale entiteiten. Zo krijg je `ApiStandaard_Naam` → tabel `apistandaard_naam`.

De originele redenering "GE-namen zijn al volledig gekwalificeerd" was ongeldig voor generieke namen als "Naam". De veiligste aanpak is **altijd prefixen**, ongeacht entiteitsubtype. De  (korte naam) wordt al apart afgeleid in . 
```

```
Nu build + test:   Alles groen. Nu moeten we de gegenereerde code opnieuw genereren zodat de CG-metaregistry en structs de nieuwe tabelnamen krijgen. Laat me eerst kijken hoe de codegen wordt aangeroepen:   Nu moet ik de CG-gegenereerde code opnieuw genereren. Laat me kijken welk JSON-invoerbestand er voor CG is:    Laat me de top van  bekijken om de exacte codegen-parameters te achterhalen:  Ik moet kijken welk JSON-bestand als input werd gebruikt voor de CG-generatie. Laat me het meest recente bestand checken, en ook kijken of er een script of Makefile target is:   Geen codegen target in de Makefile. Laat me het meest recente CG JSON-bestand bekijken en de codegen gewoon handmatig draaien. Het laatste bestand is :     Nu verifiëren dat het compileert en de tests draaien:   Alles groen. Laat me verifiëren dat de tabelnamen nu correct zijn in de gegenereerde code:    De tabelnamen zijn nu correct:
-  → `"apistandaard_naam"` ✓
- `"naam_data"` → `"apistandaard_naam_data"` ✓
- `"domeingegevens"` → `"domein_domeingegevens"` ✓
- `"domeingegevens_data"` → `"domein_domeingegevens_data"` ✓

Laat me ook even checken dat de NP-loc code niet beïnvloed is (die was al correct):  NP-loc is ongewijzigd en was al correct. 

**Samenvatting van het probleem en de fix:**

**Probleem:**  in  had een speciale uitzondering voor referentielijst-items (): die kregen geen entiteits-prefix. Hierdoor werd `ApiStandaard` + GE  → tabel  i.p.v. `apistandaard_naam`, wat clashes geeft als meerdere entiteiten een GE met dezelfde naam hebben.

**Fix:** De uitzondering verwijderd. Nu krijgt *elke* GE altijd `Entiteit_GENaam` als Typenaam, ongeacht het entiteitsubtype. De korte weergavenaam () wordt al apart afgeleid in .

**Resultaat na regeneratie:**
| Was | Is nu |
|-----|-------|
|  | `apistandaard_naam` |
| `naam_data` | `apistandaard_naam_data` |
| `domeingegevens` | `domein_domeingegevens` |
| `domeingegevens_data` | `domein_domeingegevens_data` |

NB: de bestaande tabellen in de database hebben nog de oude namen. Na een drop+create (of domein-specifiek: ) worden de nieuwe tabelnamen aangemaakt.

---
