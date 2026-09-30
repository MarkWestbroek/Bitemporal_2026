# Regel "adres" — gegenereerd uit beleid/gbo-persoon.odrl.json
# target: nlgov:register:Persoon.Adres
package rules["adres"]

import rego.v1
import input.field
import input.subject
import data.autorisaties

covers_fields := {"Persoon.adres"}
covers_types := {"Adres"}

allow if {
	subject.id in autorisaties["naam-en-adres"]
}
