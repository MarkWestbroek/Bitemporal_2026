package handlers

// ai_lees_url.go — een webpagina ophalen als platte tekst, voor de AI-invulhulp (28-09-2026).
//
//	POST /api/ai/lees-url   { "url": "https://github.com/owner/repo" }  →  { url, titel, tekst, afgekapt }
//
// De meeste AI-diensten (DeepSeek, Qwen, …) kunnen zelf geen URL openen: hun chat-API heeft geen
// web-tool. Daarom haalt de server de pagina op en krijgt het model de TEKST. Zo werkt de
// invulhulp met elke dienst hetzelfde.
//
// Veiligheid (dit is een fetch namens de gebruiker, dus SSRF-gevoelig):
//   - alleen http(s), poort 80/443;
//   - elk IP-adres wordt bij het VERBINDEN gecontroleerd (net.Dialer.Control): geen loopback,
//     privé-, link-local-, multicast- of onbestemde adressen — ook niet na een redirect of via
//     DNS-rebinding;
//   - maximaal 5 redirects, 10 s, 2 MB; alleen tekst/HTML/Markdown/JSON;
//   - alleen voor ingelogde editors (main.go) en maximaal 20 per minuut per IP.
//
// GitHub: een repo-URL wordt de README (raw), een blob-URL het ruwe bestand.

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"golang.org/x/net/html"
)

const (
	leesURLMaxBytes = 2 << 20
	leesURLMaxTekst = 60000 // tekens naar het model
)

var (
	ghRepo = regexp.MustCompile(`^https://github\.com/([\w.-]+)/([\w.-]+?)(?:\.git)?/?$`)
	ghBlob = regexp.MustCompile(`^https://github\.com/([\w.-]+)/([\w.-]+)/blob/(.+)$`)
)

// herschrijfGitHub: repo → README (raw), blob → raw-bestand; anders ongewijzigd.
func herschrijfGitHub(u string) string {
	if m := ghRepo.FindStringSubmatch(u); m != nil {
		return fmt.Sprintf("https://raw.githubusercontent.com/%s/%s/HEAD/README.md", m[1], m[2])
	}
	if m := ghBlob.FindStringSubmatch(u); m != nil {
		return fmt.Sprintf("https://raw.githubusercontent.com/%s/%s/%s", m[1], m[2], m[3])
	}
	return u
}

// verbodenIP: adressen waar de server nooit namens een gebruiker heen mag.
func verbodenIP(ip net.IP) bool {
	return ip == nil || ip.IsLoopback() || ip.IsPrivate() || ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() ||
		ip.IsInterfaceLocalMulticast() || ip.IsMulticast() || ip.IsUnspecified() ||
		ip.Equal(net.ParseIP("169.254.169.254")) // cloud-metadata (valt al onder link-local; expliciet)
}

// veiligeClient: controleert het IP bij elke verbinding (dus ook na redirects en DNS-rebinding).
func veiligeClient() *http.Client {
	dialer := &net.Dialer{
		Timeout: 5 * time.Second,
		Control: func(_, adres string, _ syscall.RawConn) error {
			host, poort, err := net.SplitHostPort(adres)
			if err != nil {
				return err
			}
			if poort != "80" && poort != "443" {
				return fmt.Errorf("poort %s niet toegestaan", poort)
			}
			if verbodenIP(net.ParseIP(host)) {
				return fmt.Errorf("adres %s niet toegestaan", host)
			}
			return nil
		},
	}
	transport := &http.Transport{DialContext: dialer.DialContext, TLSHandshakeTimeout: 5 * time.Second, ResponseHeaderTimeout: 8 * time.Second}
	return &http.Client{
		Timeout:   10 * time.Second,
		Transport: transport,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) >= 5 {
				return errors.New("te veel redirects")
			}
			if req.URL.Scheme != "http" && req.URL.Scheme != "https" {
				return errors.New("alleen http(s)")
			}
			return nil
		},
	}
}

// htmlNaarTekst: zichtbare tekst uit HTML (zonder script/style/nav/footer), met regeleinden bij blokken.
func htmlNaarTekst(r io.Reader) (titel, tekst string) {
	doc, err := html.Parse(r)
	if err != nil {
		return "", ""
	}
	var sb strings.Builder
	overslaan := map[string]bool{"script": true, "style": true, "noscript": true, "nav": true, "footer": true, "svg": true, "head": true}
	blok := map[string]bool{"p": true, "div": true, "br": true, "li": true, "h1": true, "h2": true, "h3": true, "h4": true, "tr": true, "section": true, "article": true}
	var loop func(n *html.Node)
	loop = func(n *html.Node) {
		if n.Type == html.ElementNode && overslaan[n.Data] {
			return
		}
		if n.Type == html.TextNode {
			if t := strings.TrimSpace(n.Data); t != "" {
				sb.WriteString(t)
				sb.WriteByte(' ')
			}
		}
		for c := n.FirstChild; c != nil; c = c.NextSibling {
			loop(c)
		}
		if n.Type == html.ElementNode && blok[n.Data] {
			sb.WriteByte('\n')
		}
	}
	// De titel staat in <head>; die slaan we verder over.
	var zoekTitel func(n *html.Node)
	zoekTitel = func(n *html.Node) {
		if n.Type == html.ElementNode && n.Data == "title" && n.FirstChild != nil {
			titel = strings.TrimSpace(n.FirstChild.Data)
			return
		}
		for c := n.FirstChild; c != nil && titel == ""; c = c.NextSibling {
			zoekTitel(c)
		}
	}
	zoekTitel(doc)
	loop(doc)
	regels := strings.Split(sb.String(), "\n")
	uit := make([]string, 0, len(regels))
	for _, r := range regels {
		if r = strings.Join(strings.Fields(r), " "); r != "" {
			uit = append(uit, r)
		}
	}
	return titel, strings.Join(uit, "\n")
}

var leesURLLimiet = struct {
	sync.Mutex
	tijden map[string][]time.Time
}{tijden: map[string][]time.Time{}}

func leesURLToegestaan(ip string) bool {
	leesURLLimiet.Lock()
	defer leesURLLimiet.Unlock()
	nu := time.Now()
	recent := leesURLLimiet.tijden[ip][:0]
	for _, t := range leesURLLimiet.tijden[ip] {
		if nu.Sub(t) < time.Minute {
			recent = append(recent, t)
		}
	}
	if len(recent) >= 20 {
		leesURLLimiet.tijden[ip] = recent
		return false
	}
	leesURLLimiet.tijden[ip] = append(recent, nu)
	return true
}

// leesURL haalt de pagina op als tekst (los van gin, zodat hij te testen is).
func leesURL(ctx context.Context, client *http.Client, ruw string) (bron, titel, tekst string, afgekapt bool, err error) {
	u, perr := url.Parse(strings.TrimSpace(ruw))
	if perr != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" {
		return "", "", "", false, errors.New("geen geldige http(s)-URL")
	}
	bron = herschrijfGitHub(u.String())
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, bron, nil)
	req.Header.Set("User-Agent", "Omnium-invulhulp/1.0 (+https://omnium-ide.nl)")
	req.Header.Set("Accept", "text/html,text/plain,text/markdown,application/json;q=0.8,*/*;q=0.1")
	resp, err := client.Do(req)
	if err != nil {
		return bron, "", "", false, fmt.Errorf("ophalen mislukt: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode/100 != 2 {
		return bron, "", "", false, fmt.Errorf("de pagina gaf status %d", resp.StatusCode)
	}
	ct := strings.ToLower(resp.Header.Get("Content-Type"))
	if !(strings.Contains(ct, "text/") || strings.Contains(ct, "json") || strings.Contains(ct, "markdown") || ct == "") {
		return bron, "", "", false, fmt.Errorf("dit is geen tekst (%s)", ct)
	}
	body := io.LimitReader(resp.Body, leesURLMaxBytes)
	if strings.Contains(ct, "html") {
		titel, tekst = htmlNaarTekst(body)
	} else {
		buf, _ := io.ReadAll(body)
		tekst = string(buf)
	}
	if r := []rune(tekst); len(r) > leesURLMaxTekst {
		tekst, afgekapt = string(r[:leesURLMaxTekst]), true
	}
	return bron, titel, tekst, afgekapt, nil
}

// MaakAILeesURLHandler — POST /api/ai/lees-url.
func MaakAILeesURLHandler() gin.HandlerFunc {
	client := veiligeClient()
	return func(c *gin.Context) {
		if !leesURLToegestaan(c.ClientIP()) {
			c.JSON(http.StatusTooManyRequests, gin.H{"error": "te veel pagina's opgehaald; wacht even"})
			return
		}
		var in struct {
			URL string `json:"url"`
		}
		if err := c.ShouldBindJSON(&in); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "url ontbreekt"})
			return
		}
		bron, titel, tekst, afgekapt, err := leesURL(c.Request.Context(), client, in.URL)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": err.Error(), "url": bron})
			return
		}
		if strings.TrimSpace(tekst) == "" {
			c.JSON(http.StatusUnprocessableEntity, gin.H{"error": "de pagina bevat geen leesbare tekst (misschien vult JavaScript hem pas in)", "url": bron})
			return
		}
		c.JSON(http.StatusOK, gin.H{"url": bron, "titel": titel, "tekst": tekst, "afgekapt": afgekapt})
	}
}
