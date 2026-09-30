# Regel "inkomens tot en met 2024" — gegenereerd uit beleid/gbo-persoon.odrl.json
# target: nlgov:register:Persoon.Inkomen
package rules["inkomens-tot-en-met-2024"]

import rego.v1
import input.field
import input.subject

covers_fields := {"Persoon.inkomens"}

allow if {
	subject.properties.role == "afnemer"
	jaren := field.args.jaren
	jaren.origin != "schema-default"
	every w in jaren.value { w <= 2024 }
}
