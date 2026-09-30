# Regel "inkomen velden" — gegenereerd uit beleid/gbo-persoon.odrl.json
# target: nlgov:register:Persoon.Inkomen (alle gegevens)
package rules["inkomen-velden"]

import rego.v1
import input.field
import input.subject
import data.autorisaties

covers_types := {"Inkomen"}

allow if {
	subject.id in autorisaties["naam-en-adres"]
}
