# ftv/graphql.rego — data-gedreven variant van PJ's vaste deel.
#
# Zelfde binding en aggregatie als bundel/pj/ftv/graphql.rego, maar de regels
# zijn géén Rego-modules: ze staan als data in data.rules (gecompileerd uit
# ODRL door scripts/compiler.py), met een index data.by_field / data.by_type
# zodat de evaluatie lineair is in het aantal veldrecords. De condities zijn
# ODRL-triples {leftOperand, operator, rightOperand}; nlgov/cond.rego kent de
# NLGov-leftOperands. Een nieuwe regel is dus nieuwe data, geen nieuwe Rego.
package ftv.graphql

import rego.v1

import data.nlgov.cond

gql := input.resource.properties.graphql

data_fields contains i if {
	some i, f in gql.fields
	f.field != "__typename"
	not startswith(f.parentType, "__")
}

key(f) := concat(".", [f.parentType, f.field])

field_keys := {k | data.by_field[k]}

root_types := {"Query", "Mutation", "Subscription"}

rule_allows(r, f) if {
	every c in r.conditions {
		cond.waar(c, f)
	}
}

allowed(f) if {
	some id in data.by_field[key(f)]
	rule_allows(data.rules[id], f)
}

allowed(f) if {
	f.leaf
	not f.args
	not key(f) in field_keys
	not f.parentType in root_types
	some id in data.by_type[f.parentType]
	rule_allows(data.rules[id], f)
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

response := {"decision": true} if decision

response := {
	"decision": false,
	"context": {"graphql": {"client": client, "denied_fields": [concat(".", gql.fields[i].path) | some i in denied]}},
} if not decision
