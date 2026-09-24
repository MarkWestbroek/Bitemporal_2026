package notificaties

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
)

func initiatiefMeta(t *testing.T) model.TypeMeta {
	m, ok := model.MetaRegistry.GetTypeMeta("Initiatief")
	if !ok {
		t.Skip("CG-model niet aanwezig")
	}
	return m
}

func voorbeeld(t *testing.T) (Gebeurtenis, Config) {
	cfg := Config{Source: "urn:nld:kvknr:12345678:omnium-pf", TypePrefix: "nl.commonground-portfolio", BasisURL: "https://pf.example.nl", Pogingen: 3, Backoff: []time.Duration{0, 0}}
	g := Gebeurtenis{RegistratieID: 864, Volgnummer: 0, Registratietype: "registratie", Tijdstip: time.Date(2026, 9, 25, 0, 12, 3, 0, time.UTC),
		Bron: "aanmeldformulier", Entiteit: initiatiefMeta(t), EntiteitID: "146", Wijzigingstypen: []string{"opvoer"}}
	return g, cfg
}

func TestCloudEvent_NLGovProfiel(t *testing.T) {
	g, cfg := voorbeeld(t)
	ce := BouwCloudEvent(g, cfg)
	if ce.ID != "reg-864-w0" || ce.Type != "nl.commonground-portfolio.initiatief.geregistreerd" || ce.Subject != "initiatief/146" {
		t.Fatalf("ce = %+v", ce)
	}
	if ce.Sequence != "000000000864" || ce.Time != "2026-09-25T00:12:03Z" || ce.DataRef != "https://pf.example.nl/full/initiatieven/146" {
		t.Fatalf("ce = %+v", ce)
	}
	if ce.Data["bron"] != "aanmeldformulier" || ce.DataSchema == "" {
		t.Fatalf("data = %v", ce.Data)
	}
	// Zonder prefix: nl.<domein>; correctie → gecorrigeerd.
	g.Registratietype = "correctie"
	if got := g.Type(Config{}); got != "nl.cg.initiatief.gecorrigeerd" {
		t.Fatalf("type zonder prefix = %s", got)
	}
	b, _ := json.Marshal(ce)
	if !strings.HasPrefix(string(b), `{"specversion":"1.0","id":"reg-864-w0","source":`) {
		t.Fatalf("volgorde/velden: %s", b)
	}
}

func TestDefinitiePast(t *testing.T) {
	g, _ := voorbeeld(t)
	d := Definitie{Doeltype: "Initiatief", Registratietype: "registratie", Bron: "aanmeldformulier"}
	if !d.Past(g) {
		t.Fatal("hoort te passen")
	}
	if (Definitie{Doeltype: "Organisatie"}).Past(g) || (Definitie{Doeltype: "Initiatief", Registratietype: "correctie"}).Past(g) || (Definitie{Doeltype: "Initiatief", Bron: "studio"}).Past(g) {
		t.Fatal("hoort niet te passen")
	}
	if !(Definitie{Doeltype: "initiatief", Registratietype: "alle"}).Past(g) {
		t.Fatal("alle + hoofdletterongevoelig")
	}
	if (Definitie{Doeltype: "Initiatief", Status: "actief"}).Actief() || !(Definitie{Doeltype: "Initiatief", Status: "actief", Abonnees: []Abonnee{{Kanaal: "email", Adres: "x@y"}}}).Actief() {
		t.Fatal("Actief vereist status actief én een abonnee")
	}
}

func TestGebeurtenissenUit_GroepeertPerEntiteit(t *testing.T) {
	initiatiefMeta(t)
	bron := "aanmeldformulier"
	reg := model.Registratie{ID: 864, Registratietype: model.RegistratietypeRegistratie, Tijdstip: time.Now(), Bron: &bron}
	rijen := []model.Wijziging{
		{Wijzigingstype: "opvoer", Representatienaam: "Initiatief", RepresentatieID: "146"},
		{Wijzigingstype: "opvoer", Entiteitnaam: "Initiatief", EntiteitID: "146", Representatienaam: "Initiatief_Product"},
		{Wijzigingstype: "opvoer", Representatienaam: "Organisatie", RepresentatieID: "139"},
		{Wijzigingstype: "afvoer", Entiteitnaam: "Initiatief", EntiteitID: "146", Representatienaam: "Initiatief_Bijdrage"},
	}
	gs := GebeurtenissenUit(rijen, reg)
	if len(gs) != 2 || gs[0].EntiteitID != "146" || gs[1].Entiteit.Typenaam != "Organisatie" || gs[1].Volgnummer != 1 {
		t.Fatalf("gs = %+v", gs)
	}
	if len(gs[0].Wijzigingstypen) != 2 || gs[0].Bron != "aanmeldformulier" {
		t.Fatalf("g0 = %+v", gs[0])
	}
}

func TestVulSjabloonEnHandtekening(t *testing.T) {
	g, cfg := voorbeeld(t)
	ce := BouwCloudEvent(g, cfg)
	uit := VulSjabloon("Nieuw: {{entiteit}} {{id}} via {{bron}} — {{link}} ({{type}})", g, ce, cfg)
	if uit != "Nieuw: Initiatief 146 via aanmeldformulier — https://pf.example.nl/viz/react/inhoud.html#/t/initiatieven/146 (nl.commonground-portfolio.initiatief.geregistreerd)" {
		t.Fatal(uit)
	}
	if Handtekening("geheim", []byte("abc")) != Handtekening("geheim", []byte("abc")) || Handtekening("geheim", []byte("abc")) == Handtekening("anders", []byte("abc")) {
		t.Fatal("HMAC")
	}
}

func TestVerwerk_WebhookMetHerpogingEnFilter(t *testing.T) {
	g, cfg := voorbeeld(t)
	var pogingen int32
	var ontvangen CloudEvent
	var sig, idem string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		n := atomic.AddInt32(&pogingen, 1)
		if n == 1 {
			w.WriteHeader(http.StatusInternalServerError) // eerste poging faalt → herpoging
			return
		}
		body, _ := io.ReadAll(r.Body)
		_ = json.Unmarshal(body, &ontvangen)
		sig, idem = r.Header.Get("X-Omnium-Signature"), r.Header.Get("Idempotency-Key")
		if r.Header.Get("Content-Type") != "application/cloudevents+json; charset=utf-8" {
			t.Errorf("content-type = %s", r.Header.Get("Content-Type"))
		}
		if sig != "sha256="+Handtekening("s3cret", body) {
			t.Errorf("handtekening klopt niet")
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	s := &Service{Cfg: cfg, Client: srv.Client(), Webhook: VerstuurWebhook, Nu: time.Now, Slaap: func(time.Duration) {}}
	filterAanroepen := 0
	s.Filter = func(_ context.Context, typenaam string, id int, filter string) (bool, error) {
		filterAanroepen++
		return filter == `{"aanmeldstatussen":{"status":{"eq":"nieuwe_aanmelding"}}}` && id == 146, nil
	}
	defs := []Definitie{
		{ID: 1, Doeltype: "Initiatief", Registratietype: "registratie", Filter: `{"aanmeldstatussen":{"status":{"eq":"nieuwe_aanmelding"}}}`, Status: "actief",
			Abonnees: []Abonnee{{Kanaal: "webhook", Adres: srv.URL, Geheim: "s3cret"}}},
		{ID: 2, Doeltype: "Initiatief", Registratietype: "alle", Filter: `{"aanmeldstatussen":{"status":{"eq":"geaccepteerd"}}}`, Status: "actief",
			Abonnees: []Abonnee{{Kanaal: "webhook", Adres: srv.URL}}}, // filter faalt → niets
	}
	if n := s.Verwerk(context.Background(), []Gebeurtenis{g}, defs); n != 1 {
		t.Fatalf("geslaagd = %d", n)
	}
	if atomic.LoadInt32(&pogingen) != 2 || ontvangen.ID != "reg-864-w0" || idem != "reg-864-w0" || filterAanroepen != 2 {
		t.Fatalf("pogingen=%d ontvangen=%+v idem=%s filter=%d", pogingen, ontvangen, idem, filterAanroepen)
	}
}

func TestVerwerk_EmailZonderSMTPWordtOpgegeven(t *testing.T) {
	g, cfg := voorbeeld(t)
	cfg.Pogingen = 2
	var mails []string
	s := &Service{Cfg: cfg, Nu: time.Now, Slaap: func(time.Duration) {}, Email: func(sc SMTPConfig, aan, onderwerp, tekst string) error {
		mails = append(mails, aan+"|"+onderwerp+"|"+tekst)
		return nil
	}}
	defs := []Definitie{{ID: 3, Doeltype: "Initiatief", Status: "actief", Onderwerp: "Nieuwe aanmelding {{id}}", Tekst: "Zie {{link}}",
		Abonnees: []Abonnee{{Kanaal: "email", Adres: "moderatie@example.nl"}}}}
	if n := s.Verwerk(context.Background(), []Gebeurtenis{g}, defs); n != 1 || len(mails) != 1 || !strings.HasPrefix(mails[0], "moderatie@example.nl|Nieuwe aanmelding 146|Zie https://pf.example.nl/") {
		t.Fatalf("n=%d mails=%v", n, mails)
	}
	// Echte SMTP-bezorger zonder host: fout → na Pogingen opgegeven, niet geslaagd.
	s.Email = VerstuurEmail
	if n := s.Verwerk(context.Background(), []Gebeurtenis{g}, defs); n != 0 {
		t.Fatalf("zonder SMTP hoort niets te slagen, n=%d", n)
	}
}

func TestCatalogus_BevatInitiatief(t *testing.T) {
	initiatiefMeta(t)
	cat := Catalogus(Config{TypePrefix: "nl.commonground-portfolio"})
	gevonden := 0
	for _, c := range cat {
		if c.Entiteit == "Initiatief" {
			gevonden++
		}
		if strings.Contains(c.Type, "omnium") {
			t.Fatalf("productnaam in type: %s", c.Type)
		}
	}
	if gevonden != 3 {
		t.Fatalf("Initiatief %d× in catalogus", gevonden)
	}
}
