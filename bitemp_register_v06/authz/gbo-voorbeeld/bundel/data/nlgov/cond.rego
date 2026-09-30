# nlgov/cond.rego — de NLGov-leftOperands als predicaten over de
# per-veld-evaluatiecontext (profiel §8.4: subject, field, resource, time).
#
# Elke conditie is een ODRL-triple, gecompileerd uit beleid/gbo-persoon.odrl.json:
#   { leftOperand, operator, rightOperand, ...extra }
# Extra sleutels komen uit de compiler: `arg` (welk veldargument de operand
# leest), `kwantor` ("elk" over een lijstargument), `voor` (betrokkene).
# Onbekende operand/operator -> geen regel waar -> deny (gesloten wereld).
package nlgov.cond

import rego.v1

# ── subject ──────────────────────────────────────────────────────────────────
waar(c, f) if {
	c.leftOperand == "nlgov:rol"
	c.operator == "eq"
	input.subject.properties.role == c.rightOperand
}

waar(c, f) if {
	c.leftOperand == "nlgov:autorisatie"
	c.operator == "eq"
	input.subject.id in data.autorisaties[c.rightOperand]
}

# ── PIP: bestaat er een toestemming van de betrokkene voor dit subject? ──────
# De betrokkene is het argument dat het root-veld identificeert (api-profiel).
waar(c, f) if {
	c.leftOperand == "nlgov:bestaat:toestemming"
	c.operator == "eq"
	c.rightOperand == true
	arg := f.args[c.arg]
	arg.origin != "schema-default"
	arg.value in data.toestemming[input.subject.id]
}

# ── argumenten van het veld zelf (profiel §8.4: nooit uit een ander record) ──
waar(c, f) if {
	startswith(c.leftOperand, "nlgov:aanvraag:")
	c.kwantor == "elk"
	arg := f.args[c.arg]
	arg.origin != "schema-default"
	every w in arg.value {
		vergelijk(c.operator, w, c.rightOperand)
	}
}

waar(c, f) if {
	startswith(c.leftOperand, "nlgov:aanvraag:")
	not c.kwantor
	arg := f.args[c.arg]
	arg.origin != "schema-default"
	vergelijk(c.operator, arg.value, c.rightOperand)
}

vergelijk("eq", l, r) if l == r
vergelijk("neq", l, r) if l != r
vergelijk("lt", l, r) if l < r
vergelijk("lteq", l, r) if l <= r
vergelijk("gt", l, r) if l > r
vergelijk("gteq", l, r) if l >= r
vergelijk("isAnyOf", l, r) if l in r
