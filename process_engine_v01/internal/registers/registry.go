// Package registers houdt de configuratie en clients voor één of meerdere
// bitemporele registers bij. Een register is geadresseerd via een unieke ID
// en exposeert één of meer domeinen (bijv. np_loc, cg, configuratie).
package registers

import (
	"fmt"
	"os"
	"strings"
)

// Register beschrijft één register-instantie waar de Process Engine tegen
// kan praten.
type Register struct {
	ID       string
	BaseURL  string
	Auth     AuthConfig
	Domeinen []string
}

// AuthConfig beschrijft hoe de engine zich authenticeert tegen het register.
type AuthConfig struct {
	Type     string // "none" | "bearer"
	TokenEnv string // env-var naam voor bearer-token; alleen voor type=bearer
}

// Registry is de in-memory verzameling van geconfigureerde registers.
type Registry struct {
	registers map[string]Register
}

// Count geeft het aantal geregistreerde registers terug.
func (r *Registry) Count() int { return len(r.registers) }

// Get zoekt een register op ID.
func (r *Registry) Get(id string) (Register, bool) {
	reg, ok := r.registers[id]
	return reg, ok
}

// HasDomein controleert of een register-id een specifiek domein aanbiedt.
func (r *Registry) HasDomein(registerID, domein string) bool {
	reg, ok := r.registers[registerID]
	if !ok {
		return false
	}
	for _, d := range reg.Domeinen {
		if d == domein {
			return true
		}
	}
	return false
}

// Load leest een YAML-configuratiebestand en bouwt een Registry.
//
// In deze skeleton-fase is de parser bewust minimaal en hardcoded gericht op
// het verwachte formaat. Bij Fase 2 vervangen we dit door een echte YAML-parser
// (bijv. gopkg.in/yaml.v3) zodra dependencies worden vastgelegd.
func Load(path string) (*Registry, error) {
	if _, err := os.Stat(path); err != nil {
		// Skeleton-modus: ontbrekende config is geen fatale fout, we starten leeg.
		return &Registry{registers: map[string]Register{}}, nil
	}
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("config lezen: %w", err)
	}
	// TODO Fase 2: gebruik een echte YAML-parser.
	_ = strings.TrimSpace(string(raw))
	return &Registry{registers: map[string]Register{}}, nil
}
