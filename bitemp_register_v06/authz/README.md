# Autorisatie — OpenFTV Sidecar

Dit directory bevat de configuratie voor de OpenFTV autorisatie-sidecar
die naast de bitemp_register_v06 API draait.

## Architectuur

```
Browser → Gin API (JWT cookie) → PEP middleware → OpenFTV PDP (AuthZEN)
                                                       ↓ bundles
                                                  OpenFTV Manager (PAP+PIP)
```

## Structuur

```
authz/
├── authzen_client.go           # AuthZEN HTTP-client (Go, package authz)
├── init-db.sh                  # PostgreSQL init voor ADL database
├── manager/                    # OpenFTV Manager (PAP + PIP)
│   ├── bundles/                # Bundleconfiguratie voor PDP-distributie
│   │   └── bitemp-pdp.yaml
│   ├── data/                   # Entiteiten en attributen (PIP)
│   │   └── entities/
│   │       ├── pages.json      # Pagina-definities met vereiste rollen
│   │       └── roles.json      # Roldefinities met hiërarchie
│   ├── policies/               # Rego-beleidsregels
│   │   └── bitemp_authz.rego   # Hoofdbeleid: rollen, pagina's, API-toegang
│   └── tags/                   # Tags voor bundlebeheer
│       └── tags.yaml
└── pdp/                        # OpenFTV PDP (Policy Decision Point)
    └── policies/               # Lokaal fallback-beleid
        └── bitemp_authz.rego
```

## PEP Middleware (Phase 3)

De PEP middleware (`middleware/authz_pep.go`) dwingt autorisatiebeslissingen af:

| Feature flag | Standaard | Effect |
|-------------|-----------|--------|
| `AUTH_ENABLED` | `false` | Auth geheel aan/uit |
| `AUTHZ_PDP_ENABLED` | `false` | PDP-evaluatie aan/uit (vereist AUTH_ENABLED) |
| `AUTHZ_DENY_ON_ERROR` | `false` | fail-open (false) of fail-closed (true) bij PDP-fouten |

De mapping van HTTP-requests naar AuthZEN-termen:

| HTTP-methode | AuthZEN actie | Pad-prefix | AuthZEN resource |
|-------------|---------------|------------|-----------------|
| GET/HEAD | `read` | `/admin/*` | `(api, admin)` |
| POST/PUT/PATCH/DELETE | `write` | `/api/schema/*` | `(api, schema)` |
| POST op `/admin/*` | `admin` | `/full/<pad>/*` | `(api, <pad>)` |
| OPTIONS | `read` | `/<pad>` | `(api, <pad>)` |

Publieke paden (OPTIONS, `/api/auth/*`, `/viz/*`, `/docs*`, `/`, `/version`, `/openapi*`, `/swagger`, `/redoc`, `/graphql/playground`) slaan de PDP over.

## Starten

```bash
# Start OpenFTV sidecar (vanuit bitemp_register_v06/)
docker compose -f docker-compose.auth.yml up --build

# Vereist: open-ftv repository in ../open-ftv (D:\Git\open-ftv)
```

## Endpoints (na starten)

| Service              | URL                          | Functie                    |
|----------------------|------------------------------|----------------------------|
| OpenFTV PDP          | http://localhost:9004        | AuthZEN evaluatie-endpoint |
| OpenFTV Manager      | http://localhost:9000        | PAP+PIP API               |
| OpenFTV MI           | http://localhost:8180        | Management Interface (UI)  |
| PDP Health           | http://localhost:8104/livez  | PDP health check           |
| Manager Health       | http://localhost:8100/healthz| Manager health check       |

## AuthZEN Evaluatie

De PEP middleware stuurt requests naar de PDP in AuthZEN-formaat:

```json
POST http://localhost:9004/authzen/v1/evaluation
{
  "subject": { "type": "user", "id": "jan", "properties": {"role": "editor"} },
  "action":  { "name": "access" },
  "resource": { "type": "page", "id": "editor-v2" },
  "context": {}
}
→ { "decision": true }
```

## Rollen

| Rol     | Pagina's                                   | API                    |
|---------|--------------------------------------------|------------------------|
| viewer  | publiek                                    | alleen lezen (GET)     |
| editor  | publiek + editor-v2, editor, ide, inhoud   | lezen + schrijven      |
| admin   | alles                                      | alles + admin-endpoints|

## Beleidstaal

Rego (OPA) is de standaard beleidstaal. OpenFTV ondersteunt ook Cedar,
Cerbos en OpenFGA — de beleidstaal is eenvoudig te wisselen via configuratie.

Er wordt samengewerkt met het OpenFTV-team aan een ODRL-gebaseerde
hogere-orde autorisatietaal die compileert naar Rego/Cedar/etc.

## Ontwikkelaarshandleiding

Zie [`docs/AUTH_DEVELOPER_GUIDE.md`](../docs/AUTH_DEVELOPER_GUIDE.md) voor:
- Woordenlijst (middleware, sidecar, token, JWT, PDP, PEP, etc.)
- Sequence-diagrammen van alle login/auth-scenario's
- Stap-voor-stap uitleg van de code en de middleware-keten
- Veelgestelde vragen
