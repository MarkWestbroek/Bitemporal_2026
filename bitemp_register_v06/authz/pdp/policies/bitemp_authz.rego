# Lokaal beleid voor de PDP (fallback vóór bundledistributie).
# Na bundledistributie worden policies van de Manager overgenomen.

package bitemp.authz

import rego.v1

default allow := false

# Sta alle publieke pagina's toe, ongeacht authenticatie.
allow if {
    input.action.name == "access"
    input.resource.type == "page"
    input.resource.id in {"index", "tijdlijn", "registraties", "universum", "swagger", "redoc", "graphiql", "publicatie", "docs", "version", "openapi"}
}

# Sta beschermde pagina's toe voor editor/admin.
allow if {
    input.action.name == "access"
    input.resource.type == "page"
    input.resource.id in {"editor-v2", "editor", "ide", "inhoud"}
    input.subject.properties.role in {"editor", "admin"}
}

# Sta API-lezen toe voor elke ingelogde gebruiker.
allow if {
    input.action.name == "read"
    input.resource.type == "api"
    input.subject.properties.role in {"viewer", "editor", "admin"}
}

# Sta API-schrijven toe voor editor/admin.
allow if {
    input.action.name == "write"
    input.resource.type == "api"
    input.subject.properties.role in {"editor", "admin"}
}

# Sta admin-acties toe voor admin.
allow if {
    input.action.name == "admin"
    input.resource.type == "api"
    input.subject.properties.role == "admin"
}
