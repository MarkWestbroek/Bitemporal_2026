package authz

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"
)

// === AuthZEN Client ===
//
// HTTP-client voor de OpenFTV PDP (Policy Decision Point).
// Stuurt autorisatieverzoeken in AuthZEN-formaat en ontvangt een beslissing.
//
// AuthZEN standaard: POST /authzen/v1/evaluation
//   Request:  { subject, action, resource, context }
//   Response: { decision: bool }

// EvaluatieVerzoek is het AuthZEN evaluatie-request.
type EvaluatieVerzoek struct {
	Subject  Subject        `json:"subject"`
	Action   Action         `json:"action"`
	Resource Resource       `json:"resource"`
	Context  map[string]any `json:"context,omitempty"`
}

// Subject identificeert de gebruiker in het AuthZEN-request.
type Subject struct {
	Type       string         `json:"type"`
	ID         string         `json:"id"`
	Properties map[string]any `json:"properties,omitempty"`
}

// Action beschrijft de gevraagde actie.
type Action struct {
	Name string `json:"name"`
}

// Resource beschrijft de resource waartoe toegang wordt gevraagd.
type Resource struct {
	Type string `json:"type"`
	ID   string `json:"id"`
}

// EvaluatieResultaat is het AuthZEN evaluatie-response.
type EvaluatieResultaat struct {
	Decision bool   `json:"decision"`
	Reason   string `json:"reason,omitempty"`
}

// Client is een HTTP-client voor de OpenFTV PDP.
type Client struct {
	pdpURL     string
	httpClient *http.Client
}

// NieuweClient maakt een nieuwe AuthZEN client aan.
// Leest de PDP-URL uit OPENFTV_PDP_URL (default: http://localhost:9004).
func NieuweClient() *Client {
	url := os.Getenv("OPENFTV_PDP_URL")
	if url == "" {
		url = "http://localhost:9004"
	}
	return &Client{
		pdpURL: url,
		httpClient: &http.Client{
			Timeout: 5 * time.Second,
			Transport: &http.Transport{
				MaxIdleConns:        20,
				MaxIdleConnsPerHost: 20,
				IdleConnTimeout:     90 * time.Second,
			},
		},
	}
}

// Evalueer stuurt een autorisatieverzoek naar de PDP en retourneert de beslissing.
func (c *Client) Evalueer(ctx context.Context, verzoek *EvaluatieVerzoek) (*EvaluatieResultaat, error) {
	body, err := json.Marshal(verzoek)
	if err != nil {
		return nil, fmt.Errorf("authzen: marshal verzoek mislukt: %w", err)
	}

	endpoint := c.pdpURL + "/authzen/v1/evaluation"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("authzen: request aanmaken mislukt: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("authzen: PDP niet bereikbaar (%s): %w", endpoint, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("authzen: PDP retourneerde status %d", resp.StatusCode)
	}

	var resultaat EvaluatieResultaat
	if err := json.NewDecoder(resp.Body).Decode(&resultaat); err != nil {
		return nil, fmt.Errorf("authzen: response decoderen mislukt: %w", err)
	}
	return &resultaat, nil
}

// EvalueerKort is een convenience-methode voor eenvoudige evaluaties.
func (c *Client) EvalueerKort(ctx context.Context, gebruiker, rol, actie, resourceType, resourceID string) (bool, error) {
	verzoek := &EvaluatieVerzoek{
		Subject: Subject{
			Type: "user",
			ID:   gebruiker,
			Properties: map[string]any{
				"role": rol,
			},
		},
		Action:   Action{Name: actie},
		Resource: Resource{Type: resourceType, ID: resourceID},
	}
	resultaat, err := c.Evalueer(ctx, verzoek)
	if err != nil {
		return false, err
	}
	return resultaat.Decision, nil
}
