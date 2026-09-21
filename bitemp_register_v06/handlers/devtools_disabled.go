//go:build !devtools

package handlers

// DevtoolsEnabled — zie devtools_enabled.go. Deze default-variant (zonder
// build-tag) laat de dev-/beheerendpoints weg uit de binary; main.go slaat de
// registratie van de /admin/*-routes dan over (BE-review 2026-07-07, §3.3).
const DevtoolsEnabled = false
