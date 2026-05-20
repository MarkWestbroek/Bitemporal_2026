package adapter

// Resolver vertaalt een rep_handle naar een volledige snapshot door het juiste
// register aan te roepen. Lazy fetch: data blijft bij de bron.
//
// Status: skeleton. Implementatie in Fase 3.
type Resolver struct{}

// Resolve haalt de inhoud op voor een handle-variabele.
func (r *Resolver) Resolve(_ Variable) (any, error) {
	return nil, nil
}
