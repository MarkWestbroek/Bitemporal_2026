// Package operaton bevat een dunne HTTP-client tegen de Operaton REST API.
//
// Status: skeleton. Wordt in Fase 1/2 ingevuld met deploy, start-instance,
// list-tasks, complete-task en external-task fetch-and-lock endpoints.
package operaton

// Client zal de Operaton REST API encapsuleren.
type Client struct {
	BaseURL string
	// http client, auth, timeouts volgen in Fase 2.
}

// New maakt een Client tegen de gegeven Operaton-base-URL.
func New(baseURL string) *Client {
	return &Client{BaseURL: baseURL}
}
