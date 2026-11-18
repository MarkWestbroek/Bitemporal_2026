package facade

// client.go — lezen uit een register-API (Zaken/Catalogi met JWT-ZGW, Objecten met Token).
//
// Veiligheid: de client haalt alleen URL's op die onder de basis van zijn eigen register vallen.
// URL's komen ook uit antwoorden (zaaktype, next-links, zaakobject.object); zo kan een register of
// een afnemer de façade nooit naar een ander adres laten bellen.

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync/atomic"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// ErrNietGevonden: het register kent het object niet (404).
var ErrNietGevonden = errors.New("niet gevonden in het register")

// Client leest uit één register.
type Client struct {
	naam  string
	cfg   RegisterCfg
	http  *http.Client
	nu    func() time.Time
	calls atomic.Int64 // aantal HTTP-verzoeken (meting, ontwerp §8)
}

// NieuweClient maakt een client voor een register uit de binding.
func NieuweClient(naam string, cfg RegisterCfg, hc *http.Client) *Client {
	if hc == nil {
		hc = &http.Client{Timeout: 15 * time.Second}
	}
	return &Client{naam: naam, cfg: cfg, http: hc, nu: time.Now}
}

// Calls geeft het aantal verzoeken sinds de start.
func (c *Client) Calls() int64 { return c.calls.Load() }

// Basis geeft de basis-URL (eindigt op /).
func (c *Client) Basis() string { return c.cfg.Basis }

// Hoort zegt of een URL onder dit register valt.
func (c *Client) Hoort(u string) bool { return strings.HasPrefix(u, c.cfg.Basis) }

// autorisatie zet de Authorization-header volgens de binding.
func (c *Client) autorisatie(req *http.Request) error {
	switch c.cfg.Auth {
	case "jwt-zgw":
		// JWT-ZGW: HS256 met de client-id als issuer en client_id. De eindgebruiker (user_id)
		// komt in fase 2 mee (besluit Mark 13-11: de eindgebruiker staat in het logboek).
		tok := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
			"iss":                 c.cfg.ClientID,
			"client_id":           c.cfg.ClientID,
			"iat":                 c.nu().Unix(),
			"user_id":             "",
			"user_representation": "",
		})
		s, err := tok.SignedString([]byte(c.cfg.Secret))
		if err != nil {
			return fmt.Errorf("jwt-zgw tekenen: %w", err)
		}
		req.Header.Set("Authorization", "Bearer "+s)
	case "token":
		req.Header.Set("Authorization", "Token "+c.cfg.Token)
	}
	return nil
}

// HaalJSON haalt één URL op als JSON-object.
func (c *Client) HaalJSON(ctx context.Context, u string) (map[string]any, error) {
	var uit map[string]any
	if err := c.haal(ctx, u, &uit); err != nil {
		return nil, err
	}
	return uit, nil
}

// Lijst haalt een lijst-resource op met query-parameters en volgt de paginering tot max items
// (max <= 0: alles). Werkt met een kale JSON-array en met {count, next, results}.
func (c *Client) Lijst(ctx context.Context, resource string, params url.Values, max int) ([]map[string]any, error) {
	u := c.cfg.Basis + strings.Trim(resource, "/")
	if len(params) > 0 {
		u += "?" + params.Encode()
	}
	var alles []map[string]any
	for u != "" {
		var ruw json.RawMessage
		if err := c.haal(ctx, u, &ruw); err != nil {
			return nil, err
		}
		var pagina struct {
			Next    *string          `json:"next"`
			Results []map[string]any `json:"results"`
		}
		if len(ruw) > 0 && ruw[0] == '[' {
			var lijst []map[string]any
			if err := json.Unmarshal(ruw, &lijst); err != nil {
				return nil, fmt.Errorf("%s: lijst parsen: %w", c.naam, err)
			}
			pagina.Results = lijst
		} else if err := json.Unmarshal(ruw, &pagina); err != nil {
			return nil, fmt.Errorf("%s: pagina parsen: %w", c.naam, err)
		}
		alles = append(alles, pagina.Results...)
		if max > 0 && len(alles) >= max {
			return alles[:max], nil
		}
		u = ""
		if pagina.Next != nil && *pagina.Next != "" {
			u = *pagina.Next
		}
	}
	return alles, nil
}

func (c *Client) haal(ctx context.Context, u string, doel any) error {
	if !c.Hoort(u) {
		return fmt.Errorf("%s: %q valt buiten het register; niet opgehaald", c.naam, u)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Accept", "application/json")
	if c.cfg.Soort == "zgw" {
		// De Zaken-API eist Accept-Crs op resources met geometrie (zaakgeometrie).
		req.Header.Set("Accept-Crs", "EPSG:4326")
	}
	if err := c.autorisatie(req); err != nil {
		return err
	}
	c.calls.Add(1)
	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("%s: %w", c.naam, err)
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, 32<<20))
	if err != nil {
		return fmt.Errorf("%s: antwoord lezen: %w", c.naam, err)
	}
	switch {
	case resp.StatusCode == http.StatusNotFound:
		return ErrNietGevonden
	case resp.StatusCode >= 300:
		kort := string(body)
		if len(kort) > 300 {
			kort = kort[:300] + "…"
		}
		return fmt.Errorf("%s: %s gaf %d: %s", c.naam, req.URL.Path, resp.StatusCode, kort)
	}
	if err := json.Unmarshal(body, doel); err != nil {
		return fmt.Errorf("%s: JSON parsen: %w", c.naam, err)
	}
	return nil
}

// uuidUitURL geeft het laatste padsegment als dat een uuid is.
func uuidUitURL(u string) (string, bool) {
	u = strings.TrimRight(strings.SplitN(u, "?", 2)[0], "/")
	i := strings.LastIndex(u, "/")
	if i < 0 {
		return "", false
	}
	s := strings.ToLower(u[i+1:])
	return s, uuidPatroon.MatchString(s)
}
