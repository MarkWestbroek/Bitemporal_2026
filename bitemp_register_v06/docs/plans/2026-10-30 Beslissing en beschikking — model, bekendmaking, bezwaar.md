# Beslissing en beschikking: model, bekendmaking, bezwaar (voorstel, 2026-10-30)

Aanleiding: de GZAC-dossierbundel (TRANSFORMATIES §11.9) heeft behandelvelden
(`beoordeling`, `beoordelingToelichting`) die nu in de e-dienst staan. Mark
(30-10): "Zijn behandelvelden geen onderdeel van de beslissing? Die
onderliggend aan de beschikking is? Dan kan het een GPK-beslissing klasse zijn."

Dit plan stelt het canonieke model voor (M1, cg-test) en beschrijft wat het
betekent voor de transformaties. Het model wordt bijgehouden bij FUNDAMENT en
Mark. De open vragen uit de eerste versie heeft Mark op 30-10 beantwoord; die
antwoorden zijn verwerkt.

## 1. Uitgangspunten (Mark, 30-10)

1. **Beslissing en beschikking zijn apart.**
   - Een beslissing is de neerslag van een actie of een set acties binnen de
     uitvoering. Ze bestaat eerst intern.
   - Een beschikking is de communicatie van die beslissing naar de
     belanghebbende(n): een schriftelijk medegedeelde beslissing. Volgens de Awb
     is dat een besluit dat niet van algemene strekking is (art. 1:3).
   - Dat de beschikking medegedeeld is (of wordt), is essentieel.
2. **De beschikking moet bij de belanghebbende komen.** Voor zover wij de Awb
   lezen:
   - de bekendmaking van een besluit dat tot een of meer belanghebbenden is
     gericht, gaat door toezending of uitreiking **aan hen**, onder wie de
     aanvrager (art. 3:41);
   - het besluit treedt niet in werking voordat het bekendgemaakt is
     (art. 3:40);
   - de bezwaartermijn gaat in op de dag na die bekendmaking (art. 6:8).

   Juridisch nog na te lopen, ook wat er gebeurt als één belanghebbende hem niet
   kon krijgen. Het model legt de bekendmaking daarom per belanghebbende vast.
3. **Domein: `behandeling`.** Niet "afhandeling" (DiDo), want dat klinkt alsof je
   er vanaf wilt.
4. **Bezwaar en beroep zijn een ander domein**, bemand met andere mensen. De
   bezwaarzaak is een nieuwe zaak; de eerdere zaak wordt niet heropend.
   - De beschikking op bezwaar vervangt de eerdere **beschikking**.
   - Tussen de beslissingen komt geen relatie: dat koppelt de domeinen te strak.
5. **Correctie (formele tijd) is voor fouten in onderliggende gegevens:** een
   foutief bedrag, een datum of een andere waarde in een register. Zo'n correctie
   kan leiden tot een ambtshalve herziening, en die mag dan wel gecorrigeerd
   worden. Bezwaar is geen bitemporele correctie.
6. **Proces.**
   - Het generieke beoordeelproces vult alleen de basis van de beslissing
     (beoordelaar, uitkomst, motivering).
   - Daarna gaat het via een **call activity** naar het specifieke deel. Zo kunnen
     ook een bezwaarproces en een ambtshalve herziening dat deel aanroepen.
   - Waar de volgorde vrij is: een **ad-hoc subproces**. CMMN kan niet in GZAC.

## 2. Voorstel model (M1, domein `behandeling`)

Naar het patroon van `Aanvraag` / `GehandicaptenparkeerkaartAanvraag`: een
generieke entiteit met een specialisatie per regeling.

### Beslissing (generiek): de interne neerslag

| GE | Velden | Opmerking |
|---|---|---|
| BeslissingInhoud | uitkomst (referentielijst **Beslissingsuitkomst**), motivering (LangeTekst), beslistOp (DatumTijd) | wat nu `beoordeling` en `beoordelingToelichting` heet |
| BeslissingStatus | status (concept, vastgesteld, ingetrokken), reden | materieel: de geschiedenis van de status |
| BeslissingGrondslag | gebaseerdOpRegistratiemoment (DatumTijd) | het formele leesmoment van de gegevens waarop beslist is (zie §3) |

Relaties:
- `BeslissingOpAanvraag` → Aanvraag: waarover beslist is.
- `BeslissingBeslisser` → Partij: de medewerker, onder mandaat.

### GpkBeslissing erft Beslissing

| GE | Velden |
|---|---|
| GpkBeslissingKaart | toegekendeSoort (bestuurder, passagier, instelling), geldigVan, geldigTot (ten hoogste vijf jaar) |

Plus de relatie `GpkBeslissingMedischAdvies` → MedischAdvies, het advies
waarop beslist is. Een toekenning leidt tot een `Gehandicaptenparkeerkaart`
(die er al is), met een relatie `GpkKaartBeslissing` → GpkBeslissing naast de
bestaande relatie `GpkKaartAanvraag`.

### Beschikking (generiek): de communicatie naar de belanghebbenden

| GE | Velden | Opmerking |
|---|---|---|
| BeschikkingIdentificatie | kenmerk, datum | |
| BeschikkingDocument | documentUrl | het document in het documentregister (informatieobjecttype "Beschikking" van zaaktype GPK) |
| BeschikkingStatus | status (concept, verzonden, bekendgemaakt, vervangen, ingetrokken), reden | materieel |
| BeschikkingBekendmaking (meervoudig) | belanghebbende (→ Partij), verzondenOp, kanaal (post, Berichtenbox, e-mail, uitreiking), ontvangenOp, mislukt + reden, bewijs (documentUrl) | per belanghebbende; zonder bekendmaking is de beschikking niet in werking |

Relaties:
- `BeschikkingVan` → Beslissing: welke beslissing ze meedeelt.
- `BeschikkingVervangt` → Beschikking: een beschikking op bezwaar of een
  herziening vervangt een eerdere. De link naar de bezwaarzaak zelf ligt in het
  domein bezwaar en beroep, niet hier.

ZGW: de beschikking komt overeen met een besluit in Open Zaak (Besluiten API:
besluittype, verzenddatum, ingangsdatum). Een besluittype bij zaaktype GPK
volgt dan uit deze entiteit (FUNDAMENT pakt het zetten van het besluit in GZAC
op).

### Referentielijst Beslissingsuitkomst

| Code | Omschrijving | Resultaattype (zaaktype) |
|---|---|---|
| toegekend | Toegekend | Verleend |
| afgewezen | Afgewezen | Geweigerd |
| buitenBehandeling | Buiten behandeling gesteld | (nog niet in GPK) |
| ingetrokken | Ingetrokken door aanvrager | Ingetrokken |

De kolom resultaattype maakt de koppeling met het zaaktype expliciet. De
regelset kan dat toetsen of afleiden, zodat de twee lijsten niet uit elkaar
lopen.

## 3. Tijd: wat bitemporeel is en wat niet

- **Bezwaar, beroep, ambtshalve herziening:** een nieuwe beslissing, meestal in
  een nieuwe zaak, en een nieuwe **beschikking** die de eerdere vervangt
  (`BeschikkingVervangt`). De eerdere beschikking krijgt de status `vervangen`
  (materiële tijd). Er is geen formele correctie: de eerdere was op haar moment
  juist geregistreerd.
- **Correctie (formele tijd):** alleen een fout in de registratie zelf. Een
  correctie in een onderliggend register laat beslissing en beschikking staan,
  maar kan aanleiding zijn voor een herziening.
- **`gebaseerdOpRegistratiemoment`** legt het formele leesmoment vast waarop de
  beslissing de gegevens las. Zo vind je na een correctie welke beslissingen op
  de foute gegevens gebaseerd zijn: leesmoment vóór de correctie, en de
  gecorrigeerde gegevens geraakt. Dat leunt op de leesconsistentie op het
  formele leesmoment (BACKLOG §32).

## 4. Proces

```
Aanvraag beoordelen (generiek)          ── call activity ──▶  GPK beoordelen (specifiek, evt. ad-hoc subproces)
  beoordelaar, uitkomst, motivering                            medisch advies, kaartgegevens
  → Beslissing (concept → vastgesteld)                         → GpkBeslissingKaart
Bezwaar behandelen (ander domein) ───── call activity ──┘
Ambtshalve herziening ───────────────── call activity ──┘
Beschikken en bekendmaken (generiek): document, verzenden, ontvangst/retour → Beschikking, BeschikkingBekendmaking
```

Mislukte bezorging (retour) is een pad: opnieuw verzenden via een ander kanaal.
Pas daarna gaat de bezwaartermijn in.

## 5. Gevolgen voor de transformaties

| Artefact | Nu | Met dit model |
|---|---|---|
| dossierschema (§11.9) | behandelvelden uit de e-dienst, plat | `beslissing: {uitkomst, motivering, …}` geprojecteerd uit GpkBeslissing; de e-dienst noemt alleen `beslissing: "GpkBeslissing"` |
| dossierformulier aanvraag-beoordelen | radio uit enum in de e-dienst | radio uit de referentielijst Beslissingsuitkomst (M0, op peiltijdstip), labels uit de omschrijving |
| zaaktype GPK (§11.7) | resultaattypen letterlijk | toets (of afleiding) uitkomst ↔ resultaattype; een besluittype uit Beschikking |
| BPMN (artefacten 6, 7) | handgemaakt; nu ook uit de regelset (bpmn-naar-gzac, §11.10) | generiek beoordeelproces + call activity; variabelen uit het model (`beslissing.uitkomst`) |

De variabele `beoordeling` wordt dus `beslissing.uitkomst`. Dat raakt het
taakformulier en artefact 6 tegelijk.

## 6. Nog open

1. Bekendmaking: wat als één van meer belanghebbenden de beschikking niet kon
   krijgen? Juridisch na te lopen (Awb 3:40, 3:41, 6:8). Het model legt het al
   per belanghebbende vast, dus het antwoord vraagt geen modelwijziging.
2. De relatie tussen een beslissing en een eerdere beslissing komt niet in dit
   domein. Of het domein bezwaar en beroep een verwijzing naar de bestreden
   beschikking nodig heeft (`BezwaarTegen` → Beschikking), is aan dat domein.
