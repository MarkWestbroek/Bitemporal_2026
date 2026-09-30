# Regel "persoon op bsn" — gegenereerd uit beleid/gbo-persoon.odrl.json
# target: nlgov:register:Persoon
package rules["persoon-op-bsn"]

import rego.v1
import input.field
import input.subject

covers_fields := {"Query.persoon"}

allow if {
	subject.properties.role == "afnemer"
	bsn := field.args.bsn.value
	field.args.bsn.origin != "schema-default"
	bsn in data.toestemming[subject.id]
}
