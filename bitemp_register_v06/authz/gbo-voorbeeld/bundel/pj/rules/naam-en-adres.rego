# Regel "naam en adres" — gegenereerd uit beleid/gbo-persoon.odrl.json
# target: nlgov:register:Persoon.Naam
package rules["naam-en-adres"]

import rego.v1
import input.field
import input.subject
import data.autorisaties

covers_fields := {"Persoon.naam"}
covers_types := {"Naam"}

allow if {
	subject.id in autorisaties["naam-en-adres"]
}
