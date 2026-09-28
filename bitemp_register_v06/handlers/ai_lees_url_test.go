package handlers

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestHerschrijfGitHub(t *testing.T) {
	gevallen := map[string]string{
		"https://github.com/MarkWestbroek/Bitemporal_2026": "https://raw.githubusercontent.com/MarkWestbroek/Bitemporal_2026/HEAD/README.md",
		"https://github.com/o/r.git":                       "https://raw.githubusercontent.com/o/r/HEAD/README.md",
		"https://github.com/o/r/blob/main/docs/X.md":       "https://raw.githubusercontent.com/o/r/main/docs/X.md",
		"https://example.com/pagina":                       "https://example.com/pagina",
	}
	for in, verwacht := range gevallen {
		if uit := herschrijfGitHub(in); uit != verwacht {
			t.Errorf("%s → %s, verwacht %s", in, uit, verwacht)
		}
	}
}

func TestHTMLNaarTekst(t *testing.T) {
	titel, tekst := htmlNaarTekst(strings.NewReader(`<html><head><title>Signalen</title><style>x{}</style></head>
<body><nav>menu</nav><h1>Signalen</h1><p>Meldingen   openbare ruimte.</p><script>kwaad()</script><ul><li>snel</li><li>open</li></ul><footer>voet</footer></body></html>`))
	if titel != "Signalen" || !strings.Contains(tekst, "Meldingen openbare ruimte.") || !strings.Contains(tekst, "snel") {
		t.Fatalf("titel=%q tekst=%q", titel, tekst)
	}
	for _, nooit := range []string{"kwaad", "menu", "voet", "x{}"} {
		if strings.Contains(tekst, nooit) {
			t.Errorf("%q hoort er niet in: %q", nooit, tekst)
		}
	}
}

func TestLeesURL(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/pagina":
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			w.Write([]byte("<html><head><title>T</title></head><body><p>Inhoud</p></body></html>"))
		case "/plaatje":
			w.Header().Set("Content-Type", "image/png")
			w.Write([]byte{1, 2, 3})
		default:
			w.WriteHeader(404)
		}
	}))
	defer srv.Close()
	ctx := context.Background()

	// Met een gewone client: ophalen en omzetten werkt.
	_, titel, tekst, _, err := leesURL(ctx, srv.Client(), srv.URL+"/pagina")
	if err != nil || titel != "T" || tekst != "Inhoud" {
		t.Fatalf("pagina: %v %q %q", err, titel, tekst)
	}
	if _, _, _, _, err := leesURL(ctx, srv.Client(), srv.URL+"/plaatje"); err == nil {
		t.Fatal("een plaatje hoort geweigerd te worden")
	}
	if _, _, _, _, err := leesURL(ctx, srv.Client(), srv.URL+"/weg"); err == nil || !strings.Contains(err.Error(), "404") {
		t.Fatalf("404: %v", err)
	}
	if _, _, _, _, err := leesURL(ctx, srv.Client(), "file:///etc/passwd"); err == nil {
		t.Fatal("file:// hoort geweigerd te worden")
	}
	// De veilige client weigert loopback (SSRF): de testserver draait op 127.0.0.1.
	if _, _, _, _, err := leesURL(ctx, veiligeClient(), srv.URL+"/pagina"); err == nil {
		t.Fatal("127.0.0.1 hoort geweigerd te worden")
	}
}
