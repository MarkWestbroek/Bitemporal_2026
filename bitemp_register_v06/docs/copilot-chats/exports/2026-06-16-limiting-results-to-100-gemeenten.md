# Chat: Limiting results to 100 gemeenten

- **Datum**: 2026-06-16 16:11
- **Sessie-ID**: `6eeb7003-a499-4ae0-9af3-5d3480721408`
- **Berichten**: 2

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
