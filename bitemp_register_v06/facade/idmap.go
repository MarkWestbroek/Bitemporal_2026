package facade

// idmap.go — afbeelding tussen de int-id's van Omnium en de uuid's van een register
// (technisch ontwerp fase 1 §6; verkenning §4.3a).
//
// De gegenereerde structs hebben int-id's; de registers werken met uuid's. Elke uuid die de
// façade leest, krijgt bij de eerste keer een vast id. Dat geldt voor entiteiten én voor elk
// voorkomen van een GE of relatie dat in het register een eigen uuid heeft (een rol, een status):
// eis "id per voorkomen" uit het zaakmodel-voorstel §3. De soort onderscheidt de reeksen (de
// typenaam van de entiteit of van het onderliggende element).
//
// Dit vervalt grotendeels als het platform uuid's als entiteit-id krijgt (BACKLOG; Mark 13-11).

import (
	"context"
	"fmt"
	"strings"
	"sync"
)

// IDMap kent int-id's toe aan (register, soort, uuid) en zoekt terug.
type IDMap interface {
	// ID geeft het id van een uuid; bestaat het nog niet, dan wordt het toegekend.
	ID(ctx context.Context, register, soort, uuid string) (int, error)
	// UUID zoekt de uuid bij een id. ok=false als het id onbekend is.
	UUID(ctx context.Context, soort string, id int) (register, uuid string, ok bool, err error)
}

// GeheugenIDMap is een IDMap in het geheugen (tests, en een façade zonder database). De id's
// overleven een herstart niet; gebruik in productie de databasevariant.
type GeheugenIDMap struct {
	mu      sync.Mutex
	volgend map[string]int       // per soort het volgende id
	heen    map[string]int       // soort|register|uuid → id
	terug   map[string][2]string // soort|id → (register, uuid)
}

// NieuweGeheugenIDMap maakt een lege afbeelding.
func NieuweGeheugenIDMap() *GeheugenIDMap {
	return &GeheugenIDMap{volgend: map[string]int{}, heen: map[string]int{}, terug: map[string][2]string{}}
}

func (m *GeheugenIDMap) ID(_ context.Context, register, soort, uuid string) (int, error) {
	if register == "" || soort == "" || uuid == "" {
		return 0, fmt.Errorf("idmap: register, soort en uuid zijn verplicht (%q, %q, %q)", register, soort, uuid)
	}
	uuid = strings.ToLower(uuid)
	m.mu.Lock()
	defer m.mu.Unlock()
	sleutel := soort + "|" + register + "|" + uuid
	if id, ok := m.heen[sleutel]; ok {
		return id, nil
	}
	m.volgend[soort]++
	id := m.volgend[soort]
	m.heen[sleutel] = id
	m.terug[fmt.Sprintf("%s|%d", soort, id)] = [2]string{register, uuid}
	return id, nil
}

func (m *GeheugenIDMap) UUID(_ context.Context, soort string, id int) (string, string, bool, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	t, ok := m.terug[fmt.Sprintf("%s|%d", soort, id)]
	return t[0], t[1], ok, nil
}
