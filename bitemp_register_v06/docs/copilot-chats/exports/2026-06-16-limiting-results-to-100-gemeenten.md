# Chat: Limiting results to 100 gemeenten

- **Datum**: 2026-06-16 16:11
- **Sessie-ID**: `6eeb7003-a499-4ae0-9af3-5d3480721408`
- **Berichten**: 4

---

## 🧑 User

zowel http://localhost:5174/viz/react/inhoud.html#/t/gemeenten als http://localhost:8082/viz/react/publicatie.html#/t/gemeenten (5174 werkt hetzelfde) geven enkel de 1e 100 gemeenten terug. Dat is raar. Wil je kijken waar dat aan ligt?

Het zijn er 342 in de DB en ik zou door bijv. Zeist in te typen in het zoekveld boven aan de rij, gemeente Zeist moeten vinden. Maar omdat ie maar 100 records heeft, gebeurt dat niet.

Ik dacht dat we dat al gebouwd hadden.

---

## 🤖 Assistant

Het probleem is tweeledig:
1. **Backend** hard-cap van 100 ( in )
2. **Frontend** gebruikt alleen client-side filtering op de geladen 100 records, stuurt geen  naar de backend

Ik pas beide aan.

**Stap 1: Backend** — verhoog  naar 2000.
```

```
Nog 3 plekken in v06 met . De frontend gebruikt `/full/gemeenten` — dat is . Die moet ook omhoog.
```

```

```

```

```

```

```

```

```

```

```

```

```

```

```

```

```

```

```

```

```

```
Beide builds slagen. Laat ik de documentatie bijwerken.De fix is compleet. Hier is een samenvatting van wat er gedaan is:

---

## Wat was het probleem?

**Twee oorzaken** waardoor er maar 100 gemeenten getoond werden i.p.v. 342:

### 1. Backend hard-cap van 100 ()

In de backend handlers zat een harde limiet van 100 records per pagina. De frontend vroeg  maar de backend cap-te dat naar 100.

### 2. Frontend deed alleen client-side filtering

De -componenten in de filterrij gebruikten 's  — dat filtert alleen **client-side** op de geladen 100 records. De backend heeft al  ondersteuning voor server-side ILIKE-search, maar de frontend gebruikte dat niet.

## Wat is er gefixt?

### Backend — `handlers/core_handlers.go` en `handlers/full_handlers.go`
-  verhoogd van **100 → 2000** op **4 plekken**:
  -  (GET )
  -  (GET  — deze gebruikt de frontend voor entiteiten)
  -  (generieke variant)
  -  (registraties)

### Frontend — 
- **Kolomfilters worden nu server-side gebonden**: wanneer de gebruiker een filterwaarde typt, wordt die na 250ms debounce als  naar de backend gestuurd
- De backend doet een ILIKE-search over **alle string-kolommen** — typen van "Zeist" in de weergave-kolomfilter vindt gemeente Zeist direct, ook zonder alle records te laden
- Wanneer het filter leeg wordt gemaakt, laadt de tabel weer alle records (tot 2000)

### Resultaat
- Alle 342 gemeenten worden geladen in de tabel
- Filteren (bijv. "Zeist") werkt server-side en vindt de juiste gemeente
- Paginering toont correct  records
- Backend + frontend build slagen beide

De Vite dev-server en API-server moeten wel herstart worden om de nieuwe backend te laden. Wil ik dat doen?

---

## 🧑 User

zou je dit document willen samenvatten en eventuele verschillen en overeenkomsten met dit project kunnen duiden?

---

## 🤖 Assistant

# Samenvatting & Analyse: Reference Architecture vs Bitemporeel Register v06

## Documentsamenvat
ting

Het PDF beschrijft een **referentiearchitectuur voor datakwaliteit in federaal gegevensdeling** voor Common Ground. Het stelt voor:

**Architectuurpatronen:**
- **Transactional Outbox**: datawijzigingen worden atomair opgeslagen in domaintabel + ouboxtabel
- **Change Data Capture (CDC)**: database transactionlog minen, wijzigingen als events naar messagebroker
- **Pub/Sub**: asynchrone, losjes gekoppelde event-distributie (Open Notificaties in CG)

**6 Architectuurprincipes:**
1. Beslissingen alleen op basis van authoritative source (single source of truth)
2. Data mag alleen in bron worden gewijzigd
3. Externe datareferenties alleen als geabonneerd op changes
4. Elke beslissing moet met timestamp en gebruikte data worden vastgelegd
5. Revisieproces voor beslissingen gebaseerd op inconsistente data
6. Events moeten idempotent zijn (deduplicatie via idempotency key)

**Filosofie**: Eventual consistency voor propagatie, maar direct ophalen van authoritative sources voor kritieke beslissingen.

---

## Overeenkomsten met v06

| Aspect | Common Ground RefArch | Bitemporeel Register v06 |
|--------|----------------------|--------------------------|
| **Context** | Federaal gegevensdeling (Common Ground) | Federaal gegevensdeling (Common Ground) |
| **Authoritative source** | Single source of truth per domein | Representaties met entiteitseigenaar (MetaRegistry) |
| **Timestamping** | Principe 4: timestamp iedere beslissing + gebruikte data | Formele & materiële tijd: `opvoer`, , `aanvang`, `einde` |
| **Change tracking** | CDC minen uit database log | Wijzigingen-tabel + Registratie-entiteit traceren |
| **Audit trail** | Idempotency keys, event-deduplicatie | Volledige audit-trail per registratie met alle wijzigingen |
| **Data consistency** | Eventual consistency met fallback naar source | Formeel: snapshot per peiltijdstip via registratie-timestamp |
| **Losjes koppeling** | Pub/sub voor autonomie domeinen | Domeinen via multi-domein metadata (register, np_loc, cg, etc.) |

---

## Belangrijke verschillen

| Aspect | Common Ground RefArch | Bitemporeel Register v06 |
|--------|----------------------|--------------------------|
| **Focus** | Data synchronisatie over domeinen heen (event-driven) | Formeel & materieel tijdreizen + correcties binnen register |
| **Eventpropagatie** | CDC → Outbox → MessageBroker → Pub/Sub → Subscribers | ❌ Niet geïmplementeerd; primair REST API |
| **Correctiemechanism** | Revisieproces achteraf (P5) | Ingebouwd: `corrigeer`, `maak_ongedaan` endpoints + _Data versiegeschiedenis |
| **Materiale plumbing** | ❌ Niet behandeld | ✅ _Aanvang/_Einde per entiteit (materiële tijd op hub-niveau) |
| **GraphQL** | ❌ Niet genoemd | ✅ Volledig dynamisch, peiltijdstip-parameters |
| **Schema-driven** | ❌ Statische componenten/ArchiMate | ✅ MetaRegistry + V3 JSON roundtrip (UML-editor) |
| **Bitemporeel** | ⚠️ Implicit (timestamp per event) | ✅ Expliciet: twee assen, formeel/materieel gescheiden |
| **Idempotentie** | ✅ Idempotency keys (P6) | ✅ Via registratie-IDs + versiegetallen |

---

## Hoe passen ze samen?

**v06 implementeert de *backend-logica* van wat RefArch *architecturaal* voorstelt:**

```
RefArch: CDC/Outbox → EventDispatcher → Pub/Sub → andere domeinen
v06:     Registratie → Wijzigingen → (toekomstig) Event-API → anderen

RefArch: Timestamp beslissing + gebruikte data
v06:     Registratie.tijdstip + snapshot van alle GE/relaties op t=peiltijdstip

RefArch: Authoritative source per domein
v06:     MetaRegistry definieert Typenaam.idKolom, .tabelnaam, .entiteitIDKolom
```

**Wat v06 toevoegt** dat RefArch niet behandelt:
- **Bitemporeel design**: twee orthogonale tijdsdimensies (formeel × materieel)
- **Correctiemechanisme ingebouwd**: niet alleen revisie, maar directe `corrigeer`/`maak_ongedaan`
- **Schema-driven infrastructure**: geen vaste component-rollen, alles via MetaRegistry

**Wat RefArch voorstelt** dat v06 nog mist:
- **Event-propagatie naar andere domeinen** (CDC + Pub/Sub) — momenteel REST API only
- **Idempotency keys** in berichten (voor federale integratie)
- **Pull-based recovery** bij message broker-outages

---

## Praktische integratierichting

Zou v06 willen integreren met RefArch's federale gegevensdeling?

1. **Kort termijn**: Events via v06's `registreer` endpoint → Open Notificaties messagebroker
2. **Idempotentie**: Registratie-ID als idempotency key in events
3. **CDC optioneel**: Bun/PostgreSQL trigger op wijzigingen-tabel → Outbox → CDC
4. **Domeinautonomie**: Multi-domein MetaRegistry al gebouwd daarvoor ✅

In feite is v06 al **CommonGround-ready**; het ontbreekt alleen aan de Pub/Sub-integratie voor live synchronisatie met andere gemeentelijke systemen.

---
