package handlers

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

func aiTestRouter() *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.POST("/ai/v1/chat/completions", MaakAIProxyHandler())
	r.GET("/api/ai/codes", MaakAICodesLijstHandler())
	r.POST("/api/ai/codes", MaakAICodeAanmakenHandler())
	r.DELETE("/api/ai/codes/:naam", MaakAICodeIntrekkenHandler())
	return r
}

func aiDoe(r *gin.Engine, method, pad, body, code string) (int, map[string]any) {
	req := httptest.NewRequest(method, pad, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	if code != "" {
		req.Header.Set("Authorization", "Bearer "+code)
	}
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	var uit map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &uit)
	return w.Code, uit
}

func TestAIProxy(t *testing.T) {
	// Nep-upstream: onthoudt de laatste body; faalt als het model "faal" is.
	var laatste map[string]any
	var sleutelOntvangen string
	up := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		buf, _ := io.ReadAll(r.Body)
		laatste = nil
		_ = json.Unmarshal(buf, &laatste)
		sleutelOntvangen = r.Header.Get("Authorization")
		if laatste["messages"] == nil {
			w.WriteHeader(400)
			w.Write([]byte(`{"error":{"message":"messages ontbreekt","type":"x","extra":"geheim detail"}}`))
			return
		}
		w.Write([]byte(`{"choices":[{"message":{"content":"ok"}}],"usage":{"total_tokens":40}}`))
	}))
	defer up.Close()

	t.Setenv("AI_UPSTREAM_KEY", "sk-eigenaar")
	t.Setenv("AI_UPSTREAM_URL", up.URL)
	t.Setenv("AI_UPSTREAM_MODEL", "deepseek-chat")
	t.Setenv("AI_DATA_DIR", t.TempDir())
	aiState = &aiProxyState{verbruik: map[string]*aiVerbruik{}, ipTijden: map[string][]time.Time{}}
	r := aiTestRouter()

	// Code aanmaken: alleen nu zichtbaar.
	st, uit := aiDoe(r, "POST", "/api/ai/codes", `{"naam":"Collega","dagen":7,"perDag":2}`, "")
	code, _ := uit["code"].(string)
	if st != 201 || !strings.HasPrefix(code, "om-") {
		t.Fatalf("aanmaken: %d %v", st, uit)
	}
	if st, _ := aiDoe(r, "POST", "/api/ai/codes", `{"naam":"collega"}`, ""); st != 409 {
		t.Fatalf("dubbele naam: %d", st)
	}

	// Zonder of met een foute code: 401.
	if st, _ := aiDoe(r, "POST", "/ai/v1/chat/completions", `{}`, ""); st != 401 {
		t.Fatalf("zonder code: %d", st)
	}
	if st, _ := aiDoe(r, "POST", "/ai/v1/chat/completions", `{}`, "om-fout"); st != 401 {
		t.Fatalf("foute code: %d", st)
	}

	// Goed: doorgestuurd met de sleutel van de eigenaar, model afgedwongen, stream weg.
	st, uit = aiDoe(r, "POST", "/ai/v1/chat/completions", `{"model":"duur-model","stream":true,"messages":[{"role":"user","content":"hoi"}]}`, code)
	if st != 200 || laatste["model"] != "deepseek-chat" || laatste["stream"] != nil || sleutelOntvangen != "Bearer sk-eigenaar" {
		t.Fatalf("doorsturen: %d %v upstream=%v sleutel=%q", st, uit, laatste, sleutelOntvangen)
	}

	// Een mislukte aanroep telt niet mee, en de upstream-fout wordt ingekort tot de boodschap.
	st, uit = aiDoe(r, "POST", "/ai/v1/chat/completions", `{"model":"x"}`, code)
	fout, _ := uit["error"].(map[string]any)
	if st != 400 || fout["message"] != "messages ontbreekt" || fout["extra"] != nil {
		t.Fatalf("upstream-fout: %d %v", st, uit)
	}
	if st, _ := aiDoe(r, "POST", "/ai/v1/chat/completions", `{"messages":[]}`, code); st != 200 {
		t.Fatalf("tweede geslaagde aanroep (fout telde niet): %d", st)
	}
	// perDag = 2 bereikt.
	if st, _ := aiDoe(r, "POST", "/ai/v1/chat/completions", `{"messages":[]}`, code); st != 429 {
		t.Fatalf("daglimiet: %d", st)
	}
	_, lijst := aiDoe(r, "GET", "/api/ai/codes", "", "")
	eerste := lijst["codes"].([]any)[0].(map[string]any)
	vandaag := eerste["vandaag"].(map[string]any)
	if vandaag["aanroepen"].(float64) != 2 || vandaag["tokens"].(float64) != 80 || eerste["code"] != nil {
		t.Fatalf("lijst: %v", eerste)
	}

	// Intrekken werkt meteen; een verlopen code ook niet.
	if st, _ := aiDoe(r, "DELETE", "/api/ai/codes/Collega", "", ""); st != 200 {
		t.Fatalf("intrekken: %d", st)
	}
	if st, uit := aiDoe(r, "POST", "/ai/v1/chat/completions", `{"messages":[]}`, code); st != 401 || !strings.Contains(uit["error"].(map[string]any)["message"].(string), "ingetrokken") {
		t.Fatalf("na intrekken: %d %v", st, uit)
	}
	_, uit = aiDoe(r, "POST", "/api/ai/codes", `{"naam":"Oud","dagen":1}`, "")
	oud := uit["code"].(string)
	aiState.mu.Lock()
	for i := range aiState.codes {
		if aiState.codes[i].Naam == "Oud" {
			aiState.codes[i].Verloopt = time.Now().Add(-time.Hour)
		}
	}
	_ = aiState.bewaarCodes()
	aiState.mu.Unlock()
	if st, uit := aiDoe(r, "POST", "/ai/v1/chat/completions", `{"messages":[]}`, oud); st != 401 || !strings.Contains(uit["error"].(map[string]any)["message"].(string), "verlopen") {
		t.Fatalf("verlopen: %d %v", st, uit)
	}
}

func TestAIProxyUit(t *testing.T) {
	t.Setenv("AI_UPSTREAM_KEY", "")
	if st, _ := aiDoe(aiTestRouter(), "POST", "/ai/v1/chat/completions", `{}`, "om-x"); st != 503 {
		t.Fatalf("zonder sleutel: %d", st)
	}
}
