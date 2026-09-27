package handlers

// ai_proxy.go — een kleine AI-proxy in de Omnium-API (27-09-2026), naar het voorbeeld van de
// MusicBrain-editor (tools/ai-proxy/server.mjs), met verbeteringen.
//
// Doel: anderen laten proberen met de sleutel van de eigenaar, zonder die sleutel weg te geven.
// Wie zelf een sleutel heeft (DeepSeek, Claude) gebruikt die rechtstreeks in de browser ("bring
// your own key"); de proxy is er voor toegangscodes.
//
//	POST /ai/v1/chat/completions        OpenAI-compatibel (DeepSeek); Authorization: Bearer <toegangscode>
//	POST   /api/ai/codes (admin)        { naam, dagen, perDag, maxTokensPerDag } → de code (alleen dan zichtbaar)
//	GET    /api/ai/codes (admin)        codes met verbruik vandaag (zonder de code zelf)
//	DELETE /api/ai/codes/:naam (admin)  intrekken
//
// Omgeving (.env):
//
//	AI_UPSTREAM_KEY    sleutel van de eigenaar (leeg = proxy uit, 503)
//	AI_UPSTREAM_URL    standaard https://api.deepseek.com/chat/completions
//	AI_UPSTREAM_MODEL  als gezet: dit model altijd (de client kan geen duur model kiezen)
//	AI_DATA_DIR        standaard ./data/ai (codes.json en usage.jsonl)
//
// Verbeteringen t.o.v. MusicBrain: codes verlopen; alleen een SHA-256-hash van de code wordt
// bewaard en vergeleken in constante tijd; een daglimiet op tokens naast die op aanroepen;
// tellen NA een geslaagde aanroep; een burst-limiet per IP; foutmeldingen van de upstream worden
// ingekort tot hun boodschap; codes worden alleen opnieuw gelezen als het bestand verandert.

import (
	"bufio"
	"bytes"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

type aiCode struct {
	Naam            string    `json:"naam"`
	Hash            string    `json:"hash"`   // sha256(code), hex
	Prefix          string    `json:"prefix"` // eerste tekens, om te herkennen in lijsten
	PerDag          int       `json:"perDag"`
	MaxTokensPerDag int       `json:"maxTokensPerDag"`
	Verloopt        time.Time `json:"verloopt"`
	Actief          bool      `json:"actief"`
	Aangemaakt      time.Time `json:"aangemaakt"`
}

type aiVerbruik struct{ Aanroepen, Tokens int }

type aiProxyState struct {
	mu        sync.Mutex
	codes     []aiCode
	codesMod  time.Time
	dag       string
	verbruik  map[string]*aiVerbruik // naam → vandaag
	ipTijden  map[string][]time.Time
	opgestart bool
}

var aiState = &aiProxyState{verbruik: map[string]*aiVerbruik{}, ipTijden: map[string][]time.Time{}}

func aiDataDir() string {
	if d := os.Getenv("AI_DATA_DIR"); d != "" {
		return d
	}
	return filepath.Join("data", "ai")
}
func aiCodesPad() string { return filepath.Join(aiDataDir(), "codes.json") }
func aiUsagePad() string { return filepath.Join(aiDataDir(), "usage.jsonl") }

func hashCode(code string) string {
	h := sha256.Sum256([]byte(strings.TrimSpace(code)))
	return hex.EncodeToString(h[:])
}

// laadCodes leest codes.json opnieuw als het bestand veranderd is (intrekken werkt meteen).
func (s *aiProxyState) laadCodes() {
	st, err := os.Stat(aiCodesPad())
	if err != nil {
		s.codes = nil
		return
	}
	if st.ModTime().Equal(s.codesMod) {
		return
	}
	buf, err := os.ReadFile(aiCodesPad())
	if err != nil {
		return
	}
	var codes []aiCode
	if json.Unmarshal(buf, &codes) == nil {
		s.codes, s.codesMod = codes, st.ModTime()
	}
}

func (s *aiProxyState) bewaarCodes() error {
	if err := os.MkdirAll(aiDataDir(), 0o700); err != nil {
		return err
	}
	buf, _ := json.MarshalIndent(s.codes, "", "  ")
	tmp := aiCodesPad() + ".tmp"
	if err := os.WriteFile(tmp, buf, 0o600); err != nil {
		return err
	}
	if err := os.Rename(tmp, aiCodesPad()); err != nil {
		return err
	}
	if st, err := os.Stat(aiCodesPad()); err == nil {
		s.codesMod = st.ModTime()
	}
	return nil
}

// dagWissel: tellers op nul bij een nieuwe UTC-dag; bij de eerste keer het verbruik van
// vandaag uit usage.jsonl opbouwen (zodat een herstart geen quota teruggeeft).
func (s *aiProxyState) dagWissel(nu time.Time) {
	dag := nu.UTC().Format("2006-01-02")
	if s.dag == dag && s.opgestart {
		return
	}
	s.dag, s.verbruik = dag, map[string]*aiVerbruik{}
	if !s.opgestart {
		s.opgestart = true
		if f, err := os.Open(aiUsagePad()); err == nil {
			sc := bufio.NewScanner(f)
			for sc.Scan() {
				var r struct {
					Dag    string `json:"dag"`
					Naam   string `json:"naam"`
					Tokens int    `json:"tokens"`
				}
				if json.Unmarshal(sc.Bytes(), &r) == nil && r.Dag == dag {
					v := s.telling(r.Naam)
					v.Aanroepen++
					v.Tokens += r.Tokens
				}
			}
			f.Close()
		}
	}
}

func (s *aiProxyState) telling(naam string) *aiVerbruik {
	if s.verbruik[naam] == nil {
		s.verbruik[naam] = &aiVerbruik{}
	}
	return s.verbruik[naam]
}

// vindCode: de actieve, niet verlopen code bij deze sleutel (vergelijking in constante tijd).
func (s *aiProxyState) vindCode(code string, nu time.Time) (*aiCode, string) {
	h := []byte(hashCode(code))
	for i := range s.codes {
		c := &s.codes[i]
		if subtle.ConstantTimeCompare(h, []byte(c.Hash)) != 1 {
			continue
		}
		if !c.Actief {
			return nil, "deze toegangscode is ingetrokken"
		}
		if !c.Verloopt.IsZero() && nu.After(c.Verloopt) {
			return nil, "deze toegangscode is verlopen"
		}
		return c, ""
	}
	return nil, "onbekende toegangscode"
}

func (s *aiProxyState) ipToegestaan(ip string, nu time.Time) bool {
	recent := s.ipTijden[ip][:0]
	for _, t := range s.ipTijden[ip] {
		if nu.Sub(t) < time.Minute {
			recent = append(recent, t)
		}
	}
	if len(recent) >= 30 {
		s.ipTijden[ip] = recent
		return false
	}
	s.ipTijden[ip] = append(recent, nu)
	return true
}

func aiFout(c *gin.Context, status int, bericht string) {
	// OpenAI-achtige foutvorm, zodat een OpenAI-compatibele client hem leest.
	c.JSON(status, gin.H{"error": gin.H{"message": bericht}})
}

// MaakAIProxyHandler — POST /ai/v1/chat/completions.
func MaakAIProxyHandler() gin.HandlerFunc {
	client := &http.Client{Timeout: 120 * time.Second}
	return func(c *gin.Context) {
		sleutel := os.Getenv("AI_UPSTREAM_KEY")
		if sleutel == "" {
			aiFout(c, http.StatusServiceUnavailable, "de AI-proxy is op deze server niet ingesteld")
			return
		}
		code := strings.TrimSpace(strings.TrimPrefix(c.GetHeader("Authorization"), "Bearer "))
		nu := time.Now()

		aiState.mu.Lock()
		if !aiState.ipToegestaan(c.ClientIP(), nu) {
			aiState.mu.Unlock()
			aiFout(c, http.StatusTooManyRequests, "te veel aanroepen; wacht even")
			return
		}
		aiState.laadCodes()
		aiState.dagWissel(nu)
		gevonden, reden := aiState.vindCode(code, nu)
		if gevonden == nil {
			aiState.mu.Unlock()
			aiFout(c, http.StatusUnauthorized, reden)
			return
		}
		naam := gevonden.Naam
		v := aiState.telling(naam)
		if (gevonden.PerDag > 0 && v.Aanroepen >= gevonden.PerDag) || (gevonden.MaxTokensPerDag > 0 && v.Tokens >= gevonden.MaxTokensPerDag) {
			aiState.mu.Unlock()
			aiFout(c, http.StatusTooManyRequests, "de daglimiet van deze toegangscode is bereikt")
			return
		}
		aiState.mu.Unlock()

		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 512*1024)
		var body map[string]any
		if err := json.NewDecoder(c.Request.Body).Decode(&body); err != nil {
			aiFout(c, http.StatusBadRequest, "ongeldige JSON")
			return
		}
		delete(body, "stream") // geen streaming via de proxy
		if m := os.Getenv("AI_UPSTREAM_MODEL"); m != "" {
			body["model"] = m
		}
		upstream := os.Getenv("AI_UPSTREAM_URL")
		if upstream == "" {
			upstream = "https://api.deepseek.com/chat/completions"
		}
		buf, _ := json.Marshal(body)
		req, _ := http.NewRequestWithContext(c.Request.Context(), http.MethodPost, upstream, bytes.NewReader(buf))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+sleutel)
		resp, err := client.Do(req)
		if err != nil {
			aiFout(c, http.StatusBadGateway, "de AI-dienst is niet bereikbaar")
			return
		}
		defer resp.Body.Close()
		antwoord, _ := io.ReadAll(io.LimitReader(resp.Body, 4<<20))

		if resp.StatusCode/100 != 2 {
			// Alleen de boodschap doorgeven, niet de hele upstream-body.
			var f struct {
				Error struct {
					Message string `json:"message"`
				} `json:"error"`
			}
			_ = json.Unmarshal(antwoord, &f)
			msg := f.Error.Message
			if msg == "" {
				msg = fmt.Sprintf("de AI-dienst gaf status %d", resp.StatusCode)
			}
			aiFout(c, resp.StatusCode, msg)
			return
		}

		// Geslaagd: nu pas tellen, met de tokens uit de upstream-usage.
		var u struct {
			Usage struct {
				TotalTokens int `json:"total_tokens"`
			} `json:"usage"`
		}
		_ = json.Unmarshal(antwoord, &u)
		aiState.mu.Lock()
		v = aiState.telling(naam)
		v.Aanroepen++
		v.Tokens += u.Usage.TotalTokens
		aiState.mu.Unlock()
		if f, err := os.OpenFile(aiUsagePad(), os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o600); err == nil {
			regel, _ := json.Marshal(map[string]any{"dag": nu.UTC().Format("2006-01-02"), "t": nu.UTC().Format(time.RFC3339), "naam": naam, "tokens": u.Usage.TotalTokens})
			f.Write(append(regel, '\n'))
			f.Close()
		}
		c.Data(http.StatusOK, "application/json", antwoord)
	}
}

// MaakAICodeAanmakenHandler — POST /api/ai/codes (admin).
func MaakAICodeAanmakenHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		var in struct {
			Naam            string `json:"naam"`
			Dagen           int    `json:"dagen"`
			PerDag          int    `json:"perDag"`
			MaxTokensPerDag int    `json:"maxTokensPerDag"`
		}
		if err := c.ShouldBindJSON(&in); err != nil || strings.TrimSpace(in.Naam) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "naam is verplicht"})
			return
		}
		if in.Dagen <= 0 {
			in.Dagen = 14
		}
		if in.PerDag <= 0 {
			in.PerDag = 100
		}
		ruw := make([]byte, 12)
		if _, err := rand.Read(ruw); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "kon geen code maken"})
			return
		}
		code := "om-" + base64.RawURLEncoding.EncodeToString(ruw)
		nu := time.Now().UTC()
		nieuw := aiCode{Naam: strings.TrimSpace(in.Naam), Hash: hashCode(code), Prefix: code[:6], PerDag: in.PerDag,
			MaxTokensPerDag: in.MaxTokensPerDag, Verloopt: nu.AddDate(0, 0, in.Dagen), Actief: true, Aangemaakt: nu}
		aiState.mu.Lock()
		defer aiState.mu.Unlock()
		aiState.laadCodes()
		for _, b := range aiState.codes {
			if strings.EqualFold(b.Naam, nieuw.Naam) && b.Actief {
				c.JSON(http.StatusConflict, gin.H{"error": "er is al een actieve code met deze naam"})
				return
			}
		}
		aiState.codes = append(aiState.codes, nieuw)
		if err := aiState.bewaarCodes(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "opslaan mislukt: " + err.Error()})
			return
		}
		// De code zelf is alleen nu zichtbaar; bewaard wordt alleen de hash.
		c.JSON(http.StatusCreated, gin.H{"naam": nieuw.Naam, "code": code, "verloopt": nieuw.Verloopt, "perDag": nieuw.PerDag, "maxTokensPerDag": nieuw.MaxTokensPerDag})
	}
}

// MaakAICodesLijstHandler — GET /api/ai/codes (admin).
func MaakAICodesLijstHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		aiState.mu.Lock()
		defer aiState.mu.Unlock()
		aiState.laadCodes()
		aiState.dagWissel(time.Now())
		uit := make([]gin.H, 0, len(aiState.codes))
		for _, k := range aiState.codes {
			v := aiState.telling(k.Naam)
			uit = append(uit, gin.H{"naam": k.Naam, "prefix": k.Prefix, "actief": k.Actief, "verloopt": k.Verloopt, "perDag": k.PerDag,
				"maxTokensPerDag": k.MaxTokensPerDag, "vandaag": gin.H{"aanroepen": v.Aanroepen, "tokens": v.Tokens}})
		}
		c.JSON(http.StatusOK, gin.H{"codes": uit, "proxyIngesteld": os.Getenv("AI_UPSTREAM_KEY") != ""})
	}
}

// MaakAICodeIntrekkenHandler — DELETE /api/ai/codes/:naam (admin).
func MaakAICodeIntrekkenHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		naam := c.Param("naam")
		aiState.mu.Lock()
		defer aiState.mu.Unlock()
		aiState.laadCodes()
		n := 0
		for i := range aiState.codes {
			if strings.EqualFold(aiState.codes[i].Naam, naam) && aiState.codes[i].Actief {
				aiState.codes[i].Actief = false
				n++
			}
		}
		if n == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "geen actieve code met deze naam"})
			return
		}
		if err := aiState.bewaarCodes(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"ingetrokken": n})
	}
}
