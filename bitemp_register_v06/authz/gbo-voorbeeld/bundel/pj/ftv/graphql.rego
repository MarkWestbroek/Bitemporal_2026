# ftv/graphql.rego — het VASTE deel uit PJ's slides 17–18 (FTV GraphQL-profiel,
# draft-01). Voor elke bron gelijk; bevat geen domeinlogica. De regels staan
# in rules/*.rego en worden hier gekoppeld via covers_fields / covers_types.
#
# Enige toevoeging t.o.v. de slides: `client` (het eerste geweigerde veld),
# dat de slides wel gebruiken maar niet uitschrijven.
package ftv.graphql

import rego.v1

gql := input.resource.properties.graphql

# data-velden: zonder __typename en introspectie
data_fields contains i if {
	some i, f in gql.fields
	f.field != "__typename"
	not startswith(f.parentType, "__")
}

key(f) := concat(".", [f.parentType, f.field])

# alle sleutels die een regel noemt
field_keys contains k if {
	some k in data.rules[_].covers_fields
}

# de standaardnamen van de root-types
root_types := {"Query", "Mutation", "Subscription"}

# een regel met de sleutel van het veld geeft allow
allowed(f) if {
	some id
	key(f) in data.rules[id].covers_fields
	data.rules[id].allow with input.field as f
}

# of: een veld zonder subvelden, argumenten en eigen regel erft de regels van zijn type
allowed(f) if {
	f.leaf
	not f.args
	not key(f) in field_keys
	not f.parentType in root_types
	some id
	f.parentType in data.rules[id].covers_types
	data.rules[id].allow with input.field as f
}

denied contains i if {
	some i in data_fields
	not allowed(gql.fields[i])
}

default decision := false

decision if {
	gql.profile == "ftv-graphql/0.1"
	gql.unverifiable == null
	count(data_fields) > 0
	count(denied) == 0
}

client := {"code": "FIELD_NOT_PERMITTED", "field_id": concat(".", gql.fields[min(denied)].path)} if count(denied) > 0

# antwoord aan de PEP, via de AuthZEN-adapter
response := {"decision": true} if decision

response := {
	"decision": false,
	"context": {"graphql": {"client": client, "denied_fields": [concat(".", gql.fields[i].path) | some i in denied]}},
} if not decision
