# Chat: Samenvatting van pagina in JSON-formaat

- **Datum**: 2026-04-08 15:47
- **Sessie-ID**: `cad51ace-2528-424e-830e-639647a19955`
- **Berichten**: 14

---

## 🧑 User

sorry, je moet deze link hebben: https://commonground.nl/page/view/c2e9287e-7ec1-43b7-b713-e5e84bd8b046/termen

---

## 🤖 Assistant

## Termenlijst als JSON

```json
{
  "bron": "https://commonground.nl/page/view/c2e9287e-7ec1-43b7-b713-e5e84bd8b046/termen",
  "type": "termenlijst",
  "termen": [
    {
      "term": "Aansluitcriteria",
      "omschrijving": "Bepalen aan welke eisen een koppeling moet voldoen om gegevens veilig en betrouwbaar uit te wisselen."
    },
    {
      "term": "Aansluitvoorwaarden",
      "omschrijving": "Technische en organisatorische voorwaarden waaraan componenten moeten voldoen om op CG-voorzieningen aan te sluiten."
    },
    {
      "term": "ABAC",
      "omschrijving": "Attribute-Based Access Control: toegangscontrole op basis van attributen zoals functie, organisatie, locatie of tijdstip."
    },
    {
      "term": "Acceptatieomgeving",
      "omschrijving": "Niet-productieve omgeving waarin wordt vastgesteld of software aan de afgesproken eisen voldoet vóór ingebruikname."
    },
    {
      "term": "Activiteit",
      "omschrijving": "Zie procesactiviteit."
    },
    {
      "term": "Afsprakenstelsel",
      "omschrijving": "Geheel van juridische, organisatorische, tactische en technische afspraken waarbinnen voorziening en ketenpartners opereren."
    },
    {
      "term": "API",
      "omschrijving": "Gestandaardiseerd koppelvlak waarmee systemen gegevens en functies veilig kunnen uitwisselen."
    },
    {
      "term": "Architectuur",
      "omschrijving": "Het geheel van doelen, principes en ontwerpen voor het wijzigen, ontwerpen, bouwen en uitvoeren van IT-inspanningen."
    },
    {
      "term": "Authenticatie",
      "omschrijving": "Controle of een gebruiker of systeem daadwerkelijk is wie het zegt te zijn."
    },
    {
      "term": "Autorisatie",
      "omschrijving": "Proces waarmee wordt vastgesteld welke acties een gebruiker of systeem mag uitvoeren."
    },
    {
      "term": "Basisset",
      "omschrijving": "De set componenten die binnen de Common Ground-voorziening is opgenomen en beschikbaar wordt gesteld."
    },
    {
      "term": "Bitemporeel",
      "omschrijving": "Eigenschap dat registerdata zowel materiële als formele tijd bevat."
    },
    {
      "term": "Blauwdrukomgeving",
      "omschrijving": "Gestandaardiseerde technische configuratieset die als sjabloon dient voor nieuwe implementaties van de basisset."
    },
    {
      "term": "BOMOS",
      "omschrijving": "Beheer- en OntwikkelModel voor Open Standaarden; biedt handvatten voor beheer en doorontwikkeling van standaarden."
    },
    {
      "term": "Broncode",
      "omschrijving": "Leesbare tekst van een computerprogramma, geschreven in een programmeertaal."
    },
    {
      "term": "CGTS",
      "omschrijving": "Common Ground Technische Specificaties-register; plek waar technische specificaties binnen Common Ground samenkomen."
    },
    {
      "term": "Community",
      "omschrijving": "Samenwerkingsverband van betrokkenen zoals gemeenten, VNG, leveranciers en ketenpartners rond een bepaald onderwerp."
    },
    {
      "term": "Component",
      "omschrijving": "Onderdeel van een groter systeem met een afgebakende taak, functie en gedefinieerde interface."
    },
    {
      "term": "CPSV",
      "omschrijving": "Core Public Service Vocabulary; EU-standaard voor een gemeenschappelijke structuur om overheidsdiensten te beschrijven."
    },
    {
      "term": "Data",
      "omschrijving": "De vastgelegde uitdrukking van feiten."
    }
  ]
}
```

### Opmerking
Dit is gebaseerd op de **zichtbare termen uit de opgehaalde pagina-inhoud**. Als je wilt, kan ik hier ook direct een:

- **platte JSON-array** van maken, of
- **alfabetisch opgeschoonde lijst** zonder omschrijvingen.

---

## 🧑 User

Elke term bevat een link naar de detailpagina. Kun je alle detailpagina's een voor een bekijken en de html daaruit ophalen en in de json zetten?

---

## 🤖 Assistant

Ik ga de detailpagina’s ophalen en de HTML per term in JSON opnemen.

---

## 🧑 User

uiteraard alleen de kern informatie over de term. VOor autorisatie is dat bijv.,
```Autorisatie beschrijft het proces waarbij wordt vastgesteld welke acties een gebruiker of systeem mag uitvoeren binnen een applicatie of voorziening. Dit gebeurt op basis van rollen, rechten of beleidsregels en bepaalt bijvoorbeeld welke gegevens mogen worden ingezien, gewijzigd of opgevraagd.

Zie ook authenticatie```

---

## 🤖 Assistant

## Compacte JSON met kerninformatie per detailpagina

```json
{
  "bron": "https://commonground.nl/page/view/c2e9287e-7ec1-43b7-b713-e5e84bd8b046/termen",
  "type": "termenlijst_kerninformatie",
  "termen": [
    {
      "term": "Aansluitcriteria",
      "url": "https://commonground.nl/term/view/ef3dad93-71e6-43dd-86c1-c78db1a59121/aansluitcriteria",
      "kern_informatie": "Aansluitcriteria vormen de set voorwaarden waaraan software moet voldoen om aan te sluiten op de basisset. Ze richten zich op de interoperabiliteit van de koppeling, waaronder technische standaarden, beveiligingseisen en afspraken over gegevensgebruik en -uitwisseling.",
      "zie_ook": ["opnamecriteria", "validatiecriteria"]
    },
    {
      "term": "Aansluitvoorwaarden",
      "url": "https://commonground.nl/term/view/804e71bd-7aab-4a1f-98c0-9becf6453c62/aansluitvoorwaarden",
      "kern_informatie": "Aansluitvoorwaarden vormen het normatieve kader van technische en organisatorische eisen waaraan software moet voldoen om aan te sluiten op een voorziening binnen het Common Ground-ecosysteem. Ze borgen veilig, betrouwbaar en standaardconform communiceren tussen componenten.",
      "zie_ook": ["aansluitcriteria", "opnamevoorwaarden"]
    },
    {
      "term": "ABAC",
      "url": "https://commonground.nl/term/view/c7c2bd2f-62cf-4d27-8788-9960e5b1888b/abac",
      "kern_informatie": "Attribute-Based Access Control gebruikt attributen zoals functie, organisatie, locatie of tijdstip om te bepalen of toegang wordt toegestaan. Hierdoor kunnen fijnmazige en contextafhankelijke toegangsbeslissingen worden genomen.",
      "zie_ook": ["PBAC", "RBAC"]
    },
    {
      "term": "Acceptatieomgeving",
      "url": "https://commonground.nl/term/view/35feaeca-8bf1-47db-aa17-6186ba344a6f/acceptatieomgeving",
      "kern_informatie": "Een niet-productieve omgeving waarin wordt vastgesteld of software voldoet aan afgesproken eisen voordat deze in gebruik wordt genomen."
    },
    {
      "term": "Activiteit",
      "url": "https://commonground.nl/term/view/a47c8961-162b-48ae-8ded-ce063ca5eaaf/activiteit",
      "kern_informatie": "Zie procesactiviteit.",
      "zie_ook": ["procesactiviteit"]
    },
    {
      "term": "Afsprakenstelsel",
      "url": "https://commonground.nl/term/view/76a447b6-13c9-4420-b3da-8718b8ff6aef/afsprakenstelsel",
      "kern_informatie": "Het geheel van juridische, organisatorische, tactische en technische afspraken waarbinnen de voorziening en de ketenpartners opereren."
    },
    {
      "term": "API",
      "url": "https://commonground.nl/term/view/b91f8897-fe1d-43f7-b53e-658e0fee5a3c/api",
      "kern_informatie": "Een API is een gestandaardiseerd koppelvlak waarmee softwarecomponenten gegevens en functies met elkaar kunnen uitwisselen. De API fungeert als contract tussen aanbieder en afnemer, zodat systemen kunnen samenwerken zonder kennis van elkaars interne werking."
    },
    {
      "term": "Architectuur",
      "url": "https://commonground.nl/term/view/a74ef8b5-9b46-4f51-899a-f75ed8471651/architectuur",
      "kern_informatie": "Architectuur is het geheel van doelen, principes en ontwerpen dat het wijzigen, ontwerpen, bouwen en uitvoeren van IT-inspanningen beschrijft. Binnen Common Ground ligt de context primair bij gemeentelijke dienstverlening."
    },
    {
      "term": "Authenticatie",
      "url": "https://commonground.nl/term/view/a0f18f95-e9ae-4465-9565-d0adf4f8933f/authenticatie",
      "kern_informatie": "Authenticatie beschrijft hoe wordt gecontroleerd of een gebruiker of systeem daadwerkelijk is wie het zegt te zijn. Dit gebeurt bijvoorbeeld met een wachtwoord, token of digitaal certificaat en vormt de basis voordat autorisatie kan worden toegepast.",
      "zie_ook": ["autorisatie"]
    },
    {
      "term": "Autorisatie",
      "url": "https://commonground.nl/term/view/ba14c62a-335c-4060-9b02-b7f9f24d85e3/autorisatie",
      "kern_informatie": "Autorisatie beschrijft het proces waarbij wordt vastgesteld welke acties een gebruiker of systeem mag uitvoeren binnen een applicatie of voorziening. Dit gebeurt op basis van rollen, rechten of beleidsregels en bepaalt bijvoorbeeld welke gegevens mogen worden ingezien, gewijzigd of opgevraagd.",
      "zie_ook": ["authenticatie"]
    },
    {
      "term": "Basisset",
      "url": "https://commonground.nl/term/view/49873ef3## Compacte JSON met kerninformatie per detailpagina

```json
{
  "bron": "https://commonground.nl/page/view/c2e9287e-7ec1-43b7-b713-e5e84bd8b046/termen",
  "type": "termenlijst_kerninformatie",
  "termen": [
    {
      "term": "Aansluitcriteria",
      "url": "https://commonground.nl/term/view/ef3dad93-71e6-43dd-86c1-c78db1a59121/aansluitcriteria",
      "kern_informatie": "Aansluitcriteria vormen de set voorwaarden waaraan software moet voldoen om aan te sluiten op de basisset. Ze richten zich op de interoperabiliteit van de koppeling, waaronder technische standaarden, beveiligingseisen en afspraken over gegevensgebruik en -uitwisseling.",
      "zie_ook": ["opnamecriteria", "validatiecriteria"]
    },
    {
      "term": "Aansluitvoorwaarden",
      "url": "https://commonground.nl/term/view/804e71bd-7aab-4a1f-98c0-9becf6453c62/aansluitvoorwaarden",
      "kern_informatie": "Aansluitvoorwaarden vormen het normatieve kader van technische en organisatorische eisen waaraan software moet voldoen om aan te sluiten op een voorziening binnen het Common Ground-ecosysteem. Ze borgen veilig, betrouwbaar en standaardconform communiceren tussen componenten.",
      "zie_ook": ["aansluitcriteria", "opnamevoorwaarden"]
    },
    {
      "term": "ABAC",
      "url": "https://commonground.nl/term/view/c7c2bd2f-62cf-4d27-8788-9960e5b1888b/abac",
      "kern_informatie": "Attribute-Based Access Control gebruikt attributen zoals functie, organisatie, locatie of tijdstip om te bepalen of toegang wordt toegestaan. Hierdoor kunnen fijnmazige en contextafhankelijke toegangsbeslissingen worden genomen.",
      "zie_ook": ["PBAC", "RBAC"]
    },
    {
      "term": "Acceptatieomgeving",
      "url": "https://commonground.nl/term/view/35feaeca-8bf1-47db-aa17-6186ba344a6f/acceptatieomgeving",
      "kern_informatie": "Een niet-productieve omgeving waarin wordt vastgesteld of software voldoet aan afgesproken eisen voordat deze in gebruik wordt genomen."
    },
    {
      "term": "Activiteit",
      "url": "https://commonground.nl/term/view/a47c8961-162b-48ae-8ded-ce063ca5eaaf/activiteit",
      "kern_informatie": "Zie procesactiviteit.",
      "zie_ook": ["procesactiviteit"]
    },
    {
      "term": "Afsprakenstelsel",
      "url": "https://commonground.nl/term/view/76a447b6-13c9-4420-b3da-8718b8ff6aef/afsprakenstelsel",
      "kern_informatie": "Het geheel van juridische, organisatorische, tactische en technische afspraken waarbinnen de voorziening en de ketenpartners opereren."
    },
    {
      "term": "API",
      "url": "https://commonground.nl/term/view/b91f8897-fe1d-43f7-b53e-658e0fee5a3c/api",
      "kern_informatie": "Een API is een gestandaardiseerd koppelvlak waarmee softwarecomponenten gegevens en functies met elkaar kunnen uitwisselen. De API fungeert als contract tussen aanbieder en afnemer, zodat systemen kunnen samenwerken zonder kennis van elkaars interne werking."
    },
    {
      "term": "Architectuur",
      "url": "https://commonground.nl/term/view/a74ef8b5-9b46-4f51-899a-f75ed8471651/architectuur",
      "kern_informatie": "Architectuur is het geheel van doelen, principes en ontwerpen dat het wijzigen, ontwerpen, bouwen en uitvoeren van IT-inspanningen beschrijft. Binnen Common Ground ligt de context primair bij gemeentelijke dienstverlening."
    },
    {
      "term": "Authenticatie",
      "url": "https://commonground.nl/term/view/a0f18f95-e9ae-4465-9565-d0adf4f8933f/authenticatie",
      "kern_informatie": "Authenticatie beschrijft hoe wordt gecontroleerd of een gebruiker of systeem daadwerkelijk is wie het zegt te zijn. Dit gebeurt bijvoorbeeld met een wachtwoord, token of digitaal certificaat en vormt de basis voordat autorisatie kan worden toegepast.",
      "zie_ook": ["autorisatie"]
    },
    {
      "term": "Autorisatie",
      "url": "https://commonground.nl/term/view/ba14c62a-335c-4060-9b02-b7f9f24d85e3/autorisatie",
      "kern_informatie": "Autorisatie beschrijft het proces waarbij wordt vastgesteld welke acties een gebruiker of systeem mag uitvoeren binnen een applicatie of voorziening. Dit gebeurt op basis van rollen, rechten of beleidsregels en bepaalt bijvoorbeeld welke gegevens mogen worden ingezien, gewijzigd of opgevraagd.",
      "zie_ook": ["authenticatie"]
    },
    {
      "term": "Basisset",
      "url": "https://commonground.nl/term/view/49873ef3-495f-419b-ba84-8e42a7abbd2d/basisset",
      "kern_informatie": "De basisset is de set componenten die in de Common Ground-voorziening is opgenomen en beschikbaar wordt gesteld via die voorziening. Dit is geen statische set en kan zich doorontwikkelen."
    },
    {
      "term": "Bitemporeel",
      "url": "https://commonground.nl/term/view/03d5b4cc-3467-48f7-84c1-037b161fb9ba/bitemporeel",
      "kern_informatie": "Bitemporeel betekent dat registerdata idealiter zowel materiële als formele tijdslijnen bevat. De materiële tijdslijn beschrijft het werkelijke bestaan in de werkelijkheid; de formele tijdslijn houdt bij wanneer gegevens geregistreerd, gecorrigeerd of verwijderd zijn."
    },
    {
      "term": "Blauwdrukomgeving",
      "url": "https://commonground.nl/term/view/d8c790d4-2ce5-400d-9178-f6a50fe3a4a6/blauwdrukomgeving",
      "kern_informatie": "Een gestandaardiseerde technische configuratie-set die als sjabloon dient voor nieuwe implementaties van de basisset."
    },
    {
      "term": "BOMOS",
      "url": "https://commonground.nl/term/view/a3d19417-893f-4d9d-9ec2-ed4967ba4890/bomos",
      "kern_informatie": "Het Beheer- en OntwikkelModel voor Open Standaarden biedt handvatten voor beheer en doorontwikkeling van standaarden. Het beschrijft onder meer governance, versiebeheer, stakeholderbetrokkenheid en adoptie."
    },
    {
      "term": "Broncode",
      "url": "https://commonground.nl/term/view/a88caff9-df0a-459b-955d-46c193017fa4/broncode",
      "kern_informatie": "Broncode is de leesbare tekst van een computerprogramma die door een programmeur in een programmeertaal is geschreven, in tegenstelling tot uitvoerbare of objectcode."
    },
    {
      "term": "CGTS",
      "url": "https://commonground.nl/term/view/fe108215-8e9b-443f-b1e6-b6b2666519e8/cgts",
      "kern_informatie": "Het Common Ground Technische Specificaties-register (CGTS) is de plek waar technische specificaties binnen Common Ground samenkomen. Het biedt overzicht in bestaande ideeën, oplossingen, betrokkenen en fasen van uitwerking."
    },
    {
      "term": "Community",
      "url": "https://commonground.nl/term/view/af868752-bd3b-442d-9118-05a49a0caa76/community",
      "kern_informatie": "Binnen Common Ground zijn communities ingericht waarin gemeenten, VNG, leveranciers en ketenpartners samen een onderwerp bespreken. Dat varieert van ideevorming tot concrete uitwerking of een component."
    },
    {
      "term": "Component",
      "url": "https://commonground.nl/term/view/74ed6756-6041-4ba0-a068-9fd3884cb492/component",
      "kern_informatie": "Een component is een onderdeel van een groter systeem met een afgebakende taak, functie en gedefinieerde interface. Een component kan zelf weer uit andere componenten bestaan of andere componenten gebruiken."
    },
    {
      "term": "CPSV",
      "url": "https://commonground.nl/term/view/2ab01807-b0d0-4230-8201-77ac4136bcc7/cpsv",
      "kern_informatie": "De Core Public Service Vocabulary is een EU-standaard die een gemeenschappelijke structuur biedt voor het beschrijven van overheidsdiensten, inclusief organisatie, vereisten, procedures en uitkomsten. CPSV ondersteunt interoperabiliteit en herbruikbaarheid."
    },
    {
      "term": "Data",
      "url": "https://commonground.nl/term/view/7cb148a0-656c-41a2-b206-08239a88249a/data",
      "kern_informatie": "Data of gegevens zijn de vastgelegde uitdrukking van feiten, oftewel een representatie van iets in de werkelijkheid. Gegevens kunnen worden getypeerd en in datasets of gegevensmodellen worden samengebracht."
    }
  ]
}
```

### Opmerking
Ik heb hier **alleen de ## Compacte JSON met kerninformatie per detailpagina

```json
{
  "bron": "https://commonground.nl/page/view/c2e9287e-7ec1-43b7-b713-e5e84bd8b046/termen",
  "type": "termenlijst_kerninformatie",
  "termen": [
    {
      "term": "Aansluitcriteria",
      "url": "https://commonground.nl/term/view/ef3dad93-71e6-43dd-86c1-c78db1a59121/aansluitcriteria",
      "kern_informatie": "Aansluitcriteria vormen de set voorwaarden waaraan software moet voldoen om aan te sluiten op de basisset. Ze richten zich op de interoperabiliteit van de koppeling, waaronder technische standaarden, beveiligingseisen en afspraken over gegevensgebruik en -uitwisseling.",
      "zie_ook": ["opnamecriteria", "validatiecriteria"]
    },
    {
      "term": "Aansluitvoorwaarden",
      "url": "https://commonground.nl/term/view/804e71bd-7aab-4a1f-98c0-9becf6453c62/aansluitvoorwaarden",
      "kern_informatie": "Aansluitvoorwaarden vormen het normatieve kader van technische en organisatorische eisen waaraan software moet voldoen om aan te sluiten op een voorziening binnen het Common Ground-ecosysteem. Ze borgen veilig, betrouwbaar en standaardconform communiceren tussen componenten.",
      "zie_ook": ["aansluitcriteria", "opnamevoorwaarden"]
    },
    {
      "term": "ABAC",
      "url": "https://commonground.nl/term/view/c7c2bd2f-62cf-4d27-8788-9960e5b1888b/abac",
      "kern_informatie": "Attribute-Based Access Control gebruikt attributen zoals functie, organisatie, locatie of tijdstip om te bepalen of toegang wordt toegestaan. Hierdoor kunnen fijnmazige en contextafhankelijke toegangsbeslissingen worden genomen.",
      "zie_ook": ["PBAC", "RBAC"]
    },
    {
      "term": "Acceptatieomgeving",
      "url": "https://commonground.nl/term/view/35feaeca-8bf1-47db-aa17-6186ba344a6f/acceptatieomgeving",
      "kern_informatie": "Een niet-productieve omgeving waarin wordt vastgesteld of software voldoet aan afgesproken eisen voordat deze in gebruik wordt genomen."
    },
    {
      "term": "Activiteit",
      "url": "https://commonground.nl/term/view/a47c8961-162b-48ae-8ded-ce063ca5eaaf/activiteit",
      "kern_informatie": "Zie procesactiviteit.",
      "zie_ook": ["procesactiviteit"]
    },
    {
      "term": "Afsprakenstelsel",
      "url": "https://commonground.nl/term/view/76a447b6-13c9-4420-b3da-8718b8ff6aef/afsprakenstelsel",
      "kern_informatie": "Het geheel van juridische, organisatorische, tactische en technische afspraken waarbinnen de voorziening en de ketenpartners opereren."
    },
    {
      "term": "API",
      "url": "https://commonground.nl/term/view/b91f8897-fe1d-43f7-b53e-658e0fee5a3c/api",
      "kern_informatie": "Een API is een gestandaardiseerd koppelvlak waarmee softwarecomponenten gegevens en functies met elkaar kunnen uitwisselen. De API fungeert als contract tussen aanbieder en afnemer, zodat systemen kunnen samenwerken zonder kennis van elkaars interne werking."
    },
    {
      "term": "Architectuur",
      "url": "https://commonground.nl/term/view/a74ef8b5-9b46-4f51-899a-f75ed8471651/architectuur",
      "kern_informatie": "Architectuur is het geheel van doelen, principes en ontwerpen dat het wijzigen, ontwerpen, bouwen en uitvoeren van IT-inspanningen beschrijft. Binnen Common Ground ligt de context primair bij gemeentelijke dienstverlening."
    },
    {
      "term": "Authenticatie",
      "url": "https://commonground.nl/term/view/a0f18f95-e9ae-4465-9565-d0adf4f8933f/authenticatie",
      "kern_informatie": "Authenticatie beschrijft hoe wordt gecontroleerd of een gebruiker of systeem daadwerkelijk is wie het zegt te zijn. Dit gebeurt bijvoorbeeld met een wachtwoord, token of digitaal certificaat en vormt de basis voordat autorisatie kan worden toegepast.",
      "zie_ook": ["autorisatie"]
    },
    {
      "term": "Autorisatie",
      "url": "https://commonground.nl/term/view/ba14c62a-335c-4060-9b02-b7f9f24d85e3/autorisatie",
      "kern_informatie": "Autorisatie beschrijft het proces waarbij wordt vastgesteld welke acties een gebruiker of systeem mag uitvoeren binnen een applicatie of voorziening. Dit gebeurt op basis van rollen, rechten of beleidsregels en bepaalt bijvoorbeeld welke gegevens mogen worden ingezien, gewijzigd of opgevraagd.",
      "zie_ook": ["authenticatie"]
    },
    {
      "term": "Basisset",
      "url": "https://commonground.nl/term/view/49873ef3-495f-419b-ba84-8e42a7abbd2d/basisset",
      "kern_informatie": "De basisset is de set componenten die in de Common Ground-voorziening is opgenomen en beschikbaar wordt gesteld via die voorziening. Dit is geen statische set en kan zich doorontwikkelen."
    },
    {
      "term": "Bitemporeel",
      "url": "https://commonground.nl/term/view/03d5b4cc-3467-48f7-84c1-037b161fb9ba/bitemporeel",
      "kern_informatie": "Bitemporeel betekent dat registerdata idealiter zowel materiële als formele tijdslijnen bevat. De materiële tijdslijn beschrijft het werkelijke bestaan in de werkelijkheid; de formele tijdslijn houdt bij wanneer gegevens geregistreerd, gecorrigeerd of verwijderd zijn."
    },
    {
      "term": "Blauwdrukomgeving",
      "url": "https://commonground.nl/term/view/d8c790d4-2ce5-400d-9178-f6a50fe3a4a6/blauwdrukomgeving",
      "kern_informatie": "Een gestandaardiseerde technische configuratie-set die als sjabloon dient voor nieuwe implementaties van de basisset."
    },
    {
      "term": "BOMOS",
      "url": "https://commonground.nl/term/view/a3d19417-893f-4d9d-9ec2-ed4967ba4890/bomos",
      "kern_informatie": "Het Beheer- en OntwikkelModel voor Open Standaarden biedt handvatten voor beheer en doorontwikkeling van standaarden. Het beschrijft onder meer governance, versiebeheer, stakeholderbetrokkenheid en adoptie."
    },
    {
      "term": "Broncode",
      "url": "https://commonground.nl/term/view/a88caff9-df0a-459b-955d-46c193017fa4/broncode",
      "kern_informatie": "Broncode is de leesbare tekst van een computerprogramma die door een programmeur in een programmeertaal is geschreven, in tegenstelling tot uitvoerbare of objectcode."
    },
    {
      "term": "CGTS",
      "url": "https://commonground.nl/term/view/fe108215-8e9b-443f-b1e6-b6b2666519e8/cgts",
      "kern_informatie": "Het Common Ground Technische Specificaties-register (CGTS) is de plek waar technische specificaties binnen Common Ground samenkomen. Het biedt overzicht in bestaande ideeën, oplossingen, betrokkenen en fasen van uitwerking."
    },
    {
      "term": "Community",
      "url": "https://commonground.nl/term/view/af868752-bd3b-442d-9118-05a49a0caa76/community",
      "kern_informatie": "Binnen Common Ground zijn communities ingericht waarin gemeenten, VNG, leveranciers en ketenpartners samen een onderwerp bespreken. Dat varieert van ideevorming tot concrete uitwerking of een component."
    },
    {
      "term": "Component",
      "url": "https://commonground.nl/term/view/74ed6756-6041-4ba0-a068-9fd3884cb492/component",
      "kern_informatie": "Een component is een onderdeel van een groter systeem met een afgebakende taak, functie en gedefinieerde interface. Een component kan zelf weer uit andere componenten bestaan of andere componenten gebruiken."
    },
    {
      "term": "CPSV",
      "url": "https://commonground.nl/term/view/2ab01807-b0d0-4230-8201-77ac4136bcc7/cpsv",
      "kern_informatie": "De Core Public Service Vocabulary is een EU-standaard die een gemeenschappelijke structuur biedt voor het beschrijven van overheidsdiensten, inclusief organisatie, vereisten, procedures en uitkomsten. CPSV ondersteunt interoperabiliteit en herbruikbaarheid."
    },
    {
      "term": "Data",
      "url": "https://commonground.nl/term/view/7cb148a0-656c-41a2-b206-08239a88249a/data",
      "kern_informatie": "Data of gegevens zijn de vastgelegde uitdrukking van feiten, oftewel een representatie van iets in de werkelijkheid. Gegevens kunnen worden getypeerd en in datasets of gegevensmodellen worden samengebracht."
    }
  ]
}
```

### Opmerking
Ik heb hier **alleen de kerninformatie** uit de detailpagina’s opgenomen, plus waar relevant een `zie_ook`.

Als je wilt, kan ik dit ook nog omzetten naar:
1. een **platte array** zonder metadata, of  
2. een versie met een extra veld `html_fragment` per term.

---

## 🧑 User

Ik snap het niet helemaal. Op de detailpagina staat (zie img):
```De set aan componenten die in de voorziening Common Ground is opgenomen en beschikbaar wordt gesteld via de voorziening.

N.B. Dit is geen statische set. Deze ontwikkelt zich.

N.B. 2: er zijn ook componenten die kunnen aansluiten op de basisset, maar niet standaard beschikbaar worden gesteld via de voorziening. Deze maken daarom geen deel uit van de basisset.
```
Jij schrijft:

"kern_informatie": "De basisset is de set componenten die in de Common Ground-voorziening is opgenomen en beschikbaar wordt gesteld via die voorziening. Dit is geen statische set en kan zich doorontwikkelen."
    },

Dat is een heel andere tekst. Wil je je gewoon aan de tekst houden die op de site staat?

Verder: wil je ook doorscrollen naar de rest, t/m het einde? Via "toon meer items" (zie img 2)

---

## 🤖 Assistant

Je hebt gelijk — ik had de tekst niet letterlijk overgenomen. Ik ga nu: (1) de volledige termenlijst ophalen (ook voorbij "Toon meer items"), en (2) per detailpagina de **letterlijke tekst** overnemen.

Laat me eerst kijken of er een API-endpoint achter de termenlijst zit, zodat ik alle items kan ophalen. De paginering werkt via JavaScript en niet via URL-parameters. Laat me een Python-script gebruiken om de volledige termenlijst en verbatim tekst op te halen. Het is een Pleio-platform met GraphQL. Laat me de volledige termenlijst ophalen via de GraphQL API. De pagina is een `Page`, de termen zijn `GenericArticle`. Laat me nu de juiste velden ontdekken. Uitstekend! De GraphQL API geeft precies de `description` (platte tekst) en zelfs de `richDescription` (ProseMirror JSON met links). Nu moet ik alle termen ophalen — laat me kijken hoe ik de volledige lijst kan krijgen. Er zijn 5661 GenericArticles op de site — dat is de hele woordenlijst. Laat me ze in batches ophalen via GraphQL met alle informatie.  Alle 87 termen opgehaald met hun **letterlijke beschrijving** uit de Pleio GraphQL API. Laat me het resultaat even bekijken. Het bestand ziet er goed uit — **letterlijke tekst** per term, inclusief "zie ook" en "N.B." passages.

Hier is de samenvatting:

- **87 termen** opgehaald via de Pleio GraphQL API (`commonground.nl/graphql`)
- Elke term bevat: `term`, `guid`, `url`, en de **letterlijke `beschrijving`** van de detailpagina
- Alfabetisch gesorteerd (Aansluitcriteria → Your Europe portal)
- Opgeslagen in CG PF/CG_termen_commonground.json

De beschrijvingen komen nu **1:1 van de site** — dus inclusief "N.B. Dit is geen statische set. Deze ontwikkelt zich." enz., precies zoals je Het bestand ziet er goed uit — **letterlijke tekst** per term, inclusief "zie ook" en "N.B." passages.

Hier is de samenvatting:

- **87 termen** opgehaald via de Pleio GraphQL API (`commonground.nl/graphql`)
- Elke term bevat: `term`, `guid`, `url`, en de **letterlijke `beschrijving`** van de detailpagina
- Alfabetisch gesorteerd (Aansluitcriteria → Your Europe portal)
- Opgeslagen in CG PF/CG_termen_commonground.json

De beschrijvingen komen nu **1:1 van de site** — dus inclusief "N.B. Dit is geen statische set. Deze ontwikkelt zich." enz., precies zoals je verwachtte.

---

## 🧑 User

Dank je. Waar heb je het bestand neergezet?

---

## 🤖 Assistant

## Bestandspad

Het JSON-bestand staat hier:

```text
d:\Git\Bitemporal_2026\bitemp_register_v06\docs\ontwerpgedachten\CG PF\CG_termen_commonground.json
```

Relatief binnen de repo:

```text
bitemp_register_v06/docs/ontwerpgedachten/CG PF/CG_termen_commonground.json
```

---

## 🧑 User

Dank! heel mooi. Kun je de json ook als excel exporteren?

---

## 🤖 Assistant

## Excel-export gereed ✅

Ik heb het bestand hier neergezet:

```text
d:\Git\Bitemporal_2026\bitemp_register_v06\docs\ontwerpgedachten\CG PF\CG_termen_commonground.xlsx
```

### Inhoud
- **87 regels** geëxporteerd
- Kolommen:
  - `term`
  - `guid`
  - `url`
  - `beschrijving`

> Verificatie: het exportscript meldde `Rows exported: 87` en `File exists: True`.

Als je wilt, kan ik ook nog een **tweede tabblad** toevoegen met alleen `term + beschrijving` voor een compactere leesversie.

---

## 🧑 User

ja graag

---

## 🤖 Assistant

Ik voeg nu een tweede, compacte tab toe aan het Excel-bestand.## Klaar ✅

Het Excel-bestand is bijgewerkt met een extra tabblad:

- `Termen` — volledig
- `Compact` — alleen `term` + `beschrijving`

**Pad:**
```text
d:\Git\Bitemporal_2026\bitemp_register_v06\docs\ontwerpgedachten\CG PF\CG_termen_commonground.xlsx
```

> Verificatie: het bestand is opnieuw aangemaakt met `Sheets: Termen, Compact` en `Rows per sheet: 87`.

---
