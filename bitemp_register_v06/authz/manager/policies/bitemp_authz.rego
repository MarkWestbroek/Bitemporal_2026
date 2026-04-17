# Bitemp Register — Autorisatiebeleid (Rego / OPA)
#
# Dit beleid definieert de toegangsregels voor het bitemporeel register.
# Het wordt geladen door de OpenFTV Manager en gedistribueerd naar de PDP.
#
# Rollen:
#   admin  — volledige toegang (inclusief admin-endpoints)
#   editor — lezen + schrijven (registratie, correctie, schema-publicatie)
#   viewer — alleen lezen
#
# Pagina's (frontend):
#   publiek:    index, tijdlijn, registraties, universum, swagger, redoc, graphiql
#   beschermd:  editor-v2, editor, ide (vereist editor of admin)

package authz

import rego.v1

default allow := false

# === Rolhiërarchie ===
# admin heeft alle rechten van editor, editor alle rechten van viewer.

rol_niveau := {
    "admin": 3,
    "editor": 2,
    "viewer": 1,
}

heeft_minimaal_rol(vereist) if {
    rol_niveau[input.subject.properties.role] >= rol_niveau[vereist]
}

# === Publieke pagina's — altijd toegestaan ===

publieke_paginas := {
    "index", "tijdlijn", "registraties", "universum",
    "swagger", "redoc", "graphiql", "publicatie",
    "docs", "version", "openapi",
}

allow if {
    input.action.name == "access"
    input.resource.type == "page"
    input.resource.id in publieke_paginas
}

# === Beschermde pagina's — editor of admin ===

beschermde_paginas := {
    "editor-v2", "editor", "ide", "inhoud",
}

allow if {
    input.action.name == "access"
    input.resource.type == "page"
    input.resource.id in beschermde_paginas
    heeft_minimaal_rol("editor")
}

# === API lezen — viewer of hoger ===

allow if {
    input.action.name == "read"
    input.resource.type == "api"
    heeft_minimaal_rol("viewer")
}

# === API schrijven (registratie, correctie) — editor of hoger ===

allow if {
    input.action.name == "write"
    input.resource.type == "api"
    heeft_minimaal_rol("editor")
}

# === Admin endpoints — alleen admin ===

allow if {
    input.action.name == "admin"
    input.resource.type == "api"
    heeft_minimaal_rol("admin")
}

# === Interne service-endpoints — altijd toegestaan ===
# De PDP haalt bundles op via GET /v1/bundle/... op de manager.
# Dit is een machine-to-machine verzoek zonder gebruikerscontext;
# principal.type is "invalid" (geen JWT). Sta dit toe op service-resources.

allow if {
    input.resource.type == "service"
    startswith(input.resource.id, "/v1/bundle/")
}
