//go:build devtools

package handlers

// DevtoolsEnabled geeft aan of de dev-/beheerendpoints (droptables,
// createtables, rebuild, diff) zijn meegecompileerd. Deze variant is actief
// bij een build met `-tags devtools` (devloop-containers, lokale devloop).
//
// Productie-builds (Dockerfile, Dockerfile.api) bouwen zónder deze tag,
// waardoor de endpoints niet bestaan en dus ook niet per ongeluk aan kunnen
// staan (BE-review 2026-07-07, §3.3).
const DevtoolsEnabled = true
