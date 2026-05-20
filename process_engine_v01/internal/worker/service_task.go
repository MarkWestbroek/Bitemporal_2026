// Package worker hosts de Operaton external-task workers die in Go draaien.
//
// Status v01: long-poll worker voor vier topics:
//   - "register-call"               — POST /registratie/ met NP-payload (oud, backwards compat)
//   - "check-locatie"               — GET /full/locatie/{locatie_id}; zet locatie_bestaat/actueel
//   - "check-np"                    — GET /full/natuurlijkpersoon/{np_id}; zet np_bestaat/actueel
//   - "registreer-np-bereikbaarheid"— POST /registratie/ met NP + bereikbaarheid (woonadres)
//   - "registreer-bereikbaarheid"   — POST /registratie/ met alleen bereikbaarheid (woonadres)
//
// Alle POST-aanroepen voegen bron="operaton" en bron_kenmerk=<process-instance-id> toe aan de
// registratie, zodat de registratie terug te traceren is naar de Operaton-procesinstantie.
package worker

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"time"
)

// Variable is de Operaton REST-vorm van een procesvariabele.
type Variable struct {
	Value any    `json:"value"`
	Type  string `json:"type"`
}

type fetchAndLockRequest struct {
	WorkerID string  `json:"workerId"`
	MaxTasks int     `json:"maxTasks"`
	Topics   []topic `json:"topics"`
}

type topic struct {
	TopicName    string `json:"topicName"`
	LockDuration int    `json:"lockDuration"`
}

type lockedTask struct {
	ID                string              `json:"id"`
	TopicName         string              `json:"topicName"`
	ProcessInstanceID string              `json:"processInstanceId"`
	ActivityID        string              `json:"activityId"`
	Variables         map[string]Variable `json:"variables"`
}

type completeRequest struct {
	WorkerID  string              `json:"workerId"`
	Variables map[string]Variable `json:"variables"`
}

type failureRequest struct {
	WorkerID     string `json:"workerId"`
	ErrorMessage string `json:"errorMessage"`
	ErrorDetails string `json:"errorDetails,omitempty"`
	Retries      int    `json:"retries"`
	RetryTimeout int    `json:"retryTimeout"`
}

// Config bepaalt waar de worker tegen praat.
type Config struct {
	OperatonBaseURL  string            // bv. http://localhost:8080/engine-rest
	WorkerID         string            // unieke id, bv. "go-worker-1"
	LockDuration     time.Duration     // hoe lang taken gelockt blijven
	PollInterval     time.Duration     // pauze tussen polls als geen werk
	MaxTasks         int               // batch-size per fetchAndLock
	RegisterBaseURLs map[string]string // register_id → base URL (bv. "hoofdregister" → "http://localhost:8082")
}

// allTopics zijn de topics die de worker afhandelt.
var allTopics = []string{
	"register-call",
	"check-locatie",
	"check-np",
	"registreer-locatie",
	"registreer-np-bereikbaarheid",
	"registreer-bereikbaarheid",
}

// Run start de external-task long-poll loop voor alle topics.
// Stopt bij ctx-cancel.
func Run(ctx context.Context, cfg Config, logger *slog.Logger) error {
	if cfg.OperatonBaseURL == "" {
		return fmt.Errorf("OperatonBaseURL is leeg")
	}
	if cfg.WorkerID == "" {
		cfg.WorkerID = "go-worker"
	}
	if cfg.LockDuration <= 0 {
		cfg.LockDuration = 30 * time.Second
	}
	if cfg.PollInterval <= 0 {
		cfg.PollInterval = 1 * time.Second
	}
	if cfg.MaxTasks <= 0 {
		cfg.MaxTasks = 5
	}
	if logger == nil {
		logger = slog.Default()
	}

	httpc := &http.Client{Timeout: 60 * time.Second}
	logger.Info("worker started",
		"operaton", cfg.OperatonBaseURL,
		"workerId", cfg.WorkerID,
		"topics", allTopics)

	for {
		select {
		case <-ctx.Done():
			logger.Info("worker stopped")
			return nil
		default:
		}

		tasks, err := fetchAndLock(ctx, httpc, cfg)
		if err != nil {
			logger.Warn("fetchAndLock mislukt", "err", err)
			sleep(ctx, cfg.PollInterval)
			continue
		}
		if len(tasks) == 0 {
			sleep(ctx, cfg.PollInterval)
			continue
		}
		for _, t := range tasks {
			dispatch(ctx, httpc, cfg, t, logger)
		}
	}
}

// dispatch stuurt taken naar de juiste handler op basis van het topic.
func dispatch(ctx context.Context, httpc *http.Client, cfg Config, t lockedTask, logger *slog.Logger) {
	switch t.TopicName {
	case "check-locatie":
		// padnaam in metaregistry: "locaties"
		handleCheckEntiteit(ctx, httpc, cfg, t, "locatie_id", "locaties", "locatie", logger)
	case "check-np":
		// padnaam in metaregistry: "natuurlijk_personen"
		handleCheckEntiteit(ctx, httpc, cfg, t, "np_id", "natuurlijk_personen", "np", logger)
	case "registreer-locatie":
		// Sub-proces: maak nieuwe locatie aan (aangeroepen via CallActivity)
		handleRegistreer(ctx, httpc, cfg, t, "locatie", logger)
	case "registreer-np-bereikbaarheid":
		handleRegistreer(ctx, httpc, cfg, t, "np_bereikbaarheid", logger)
	case "registreer-bereikbaarheid":
		handleRegistreer(ctx, httpc, cfg, t, "bereikbaarheid", logger)
	default:
		// "register-call" (backwards compat) en onbekende topics
		handleRegistreer(ctx, httpc, cfg, t, "inwoner", logger)
	}
}

// ─────────────────────────────────────────────
//  CHECK-HANDLER (GET op register)
// ─────────────────────────────────────────────

// handleCheckEntiteit doet een GET op /full/{pad}/{id}, zet {prefix}_bestaat en {prefix}_actueel.
//
//   - idVar:  naam van de procesvariabele die het ID bevat (bv. "locatie_id")
//   - pad:    URL-pad-segment (bv. "locatie", "natuurlijkpersoon")
//   - prefix: prefix voor uitvoervariabelen (bv. "locatie" → locatie_bestaat, locatie_actueel)
func handleCheckEntiteit(ctx context.Context, httpc *http.Client, cfg Config, t lockedTask, idVar, pad, prefix string, logger *slog.Logger) {
	log := logger.With("taskId", t.ID, "pi", t.ProcessInstanceID, "activity", t.ActivityID, "topic", t.TopicName)
	registerID, _ := varString(t, "register_id")
	if registerID == "" {
		registerID = "hoofdregister"
	}
	baseURL, ok := cfg.RegisterBaseURLs[registerID]
	if !ok {
		fail(ctx, httpc, cfg, t.ID, fmt.Sprintf("onbekend register_id: %s", registerID), log)
		return
	}
	id, err := varInt64(t, idVar)
	if err != nil {
		fail(ctx, httpc, cfg, t.ID, fmt.Sprintf("%s ontbreekt of ongeldig: %v", idVar, err), log)
		return
	}

	url := fmt.Sprintf("%s/full/%s/%d", baseURL, pad, id)
	log.Info("check entiteit", "url", url)
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	resp, err := httpc.Do(req)
	if err != nil {
		fail(ctx, httpc, cfg, t.ID, fmt.Sprintf("GET %s mislukt: %v", url, err), log)
		return
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)

	bestaat := resp.StatusCode == http.StatusOK
	actueel := false

	if bestaat {
		var parsed map[string]any
		if jsonErr := json.Unmarshal(body, &parsed); jsonErr == nil {
			// Actueel = opvoer aanwezig (niet nil) EN afvoer afwezig/nil.
			_, heeftOpvoer := parsed["opvoer"]
			_, heeftAfvoer := parsed["afvoer"]
			actueel = heeftOpvoer && !heeftAfvoer
		}
	}

	vars := map[string]Variable{
		prefix + "_bestaat": {Value: bestaat, Type: "Boolean"},
		prefix + "_actueel": {Value: actueel, Type: "Boolean"},
	}
	log.Info("check resultaat", "bestaat", bestaat, "actueel", actueel, "status", resp.StatusCode)
	if err := complete(ctx, httpc, cfg, t.ID, vars); err != nil {
		log.Error("complete mislukt", "err", err)
	}
}

// ─────────────────────────────────────────────
//  REGISTREER-HANDLER (POST op register)
// ─────────────────────────────────────────────

// handleRegistreer bouwt een registratie-payload op basis van actie en POST't naar het register.
// actie: "inwoner" | "np_bereikbaarheid" | "bereikbaarheid"
func handleRegistreer(ctx context.Context, httpc *http.Client, cfg Config, t lockedTask, actie string, logger *slog.Logger) {
	log := logger.With("taskId", t.ID, "pi", t.ProcessInstanceID, "activity", t.ActivityID, "actie", actie)
	registerID, _ := varString(t, "register_id")
	if registerID == "" {
		registerID = "hoofdregister"
	}
	baseURL, ok := cfg.RegisterBaseURLs[registerID]
	if !ok {
		fail(ctx, httpc, cfg, t.ID, fmt.Sprintf("onbekend register_id: %s", registerID), log)
		return
	}

	var (
		payload map[string]any
		err     error
	)
	switch actie {
	case "locatie":
		payload, err = bouwLocatiePayload(t)
	case "np_bereikbaarheid":
		payload, err = bouwNPBereikbaarheidPayload(t)
	case "bereikbaarheid":
		payload, err = bouwBereikbaarheidPayload(t)
	default: // "inwoner" en register-call compat
		payload, err = bouwInwonerPayload(t)
	}
	if err != nil {
		fail(ctx, httpc, cfg, t.ID, err.Error(), log)
		return
	}

	// Voeg bron-tracing toe zodat de registratie terug te herleiden is naar Operaton.
	if reg, ok := payload["registratie"].(map[string]any); ok {
		bron := "operaton"
		reg["bron"] = bron
		reg["bron_kenmerk"] = t.ProcessInstanceID
	}

	body, _ := json.Marshal(payload)
	url := baseURL + "/registratie/"
	log.Info("registreer call", "url", url, "bytes", len(body))

	httpReq, _ := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	httpReq.Header.Set("Content-Type", "application/json")
	resp, err := httpc.Do(httpReq)
	if err != nil {
		fail(ctx, httpc, cfg, t.ID, fmt.Sprintf("HTTP-fout naar register: %v", err), log)
		return
	}
	defer resp.Body.Close()
	respBody, _ := io.ReadAll(resp.Body)

	if resp.StatusCode >= 300 {
		log.Warn("register-call faalde", "status", resp.StatusCode, "body", trunc(respBody, 500))
		fail(ctx, httpc, cfg, t.ID, fmt.Sprintf("register %d: %s", resp.StatusCode, trunc(respBody, 300)), log)
		return
	}

	var parsed map[string]any
	_ = json.Unmarshal(respBody, &parsed)
	registratieID, _ := parsed["registratieId"].(float64)

	vars := map[string]Variable{
		"bitemp_status":     {Value: resp.StatusCode, Type: "Integer"},
		"registratie_id":    {Value: int64(registratieID), Type: "Long"},
		"register_response": {Value: string(respBody), Type: "String"},
	}
	if err := complete(ctx, httpc, cfg, t.ID, vars); err != nil {
		log.Error("complete mislukt", "err", err)
		return
	}
	log.Info("register-call ok", "status", resp.StatusCode, "registratie_id", int64(registratieID))
}

// ─────────────────────────────────────────────
//  PAYLOAD BUILDERS
// ─────────────────────────────────────────────

// bouwInwonerPayload: alleen NP (backwards compat met "register-call" topic).
func bouwInwonerPayload(t lockedTask) (map[string]any, error) {
	npID, err := varInt64(t, "np_id")
	if err != nil {
		return nil, fmt.Errorf("np_id: %w", err)
	}
	bsn, _ := varString(t, "bsn")
	voorletters, _ := varString(t, "voorletters")
	roepnaam, _ := varString(t, "roepnaam")
	tussenvoegsel, _ := varString(t, "tussenvoegsel")
	achternaam, _ := varString(t, "achternaam")
	geboortedatum, _ := varString(t, "geboortedatum")
	eindeDatum, _ := varString(t, "einde_datum")
	if eindeDatum == "" {
		eindeDatum = "2099-12-31"
	}
	ingezetene, _ := varBool(t, "ingezetene")
	opmerking, _ := varString(t, "opmerking")

	return map[string]any{
		"registratie": registratieHeader("registratie", opmerking),
		"wijzigingen": []any{
			map[string]any{"opvoer": map[string]any{
				"natuurlijkpersoon": npOpvoer(npID, bsn, voorletters, roepnaam, tussenvoegsel, achternaam, geboortedatum, eindeDatum, ingezetene),
			}},
		},
	}, nil
}

// bouwNPBereikbaarheidPayload: nieuwe NP + direct een woonadres op locatie L.
func bouwNPBereikbaarheidPayload(t lockedTask) (map[string]any, error) {
	npID, err := varInt64(t, "np_id")
	if err != nil {
		return nil, fmt.Errorf("np_id: %w", err)
	}
	locatieID, err := varInt64(t, "locatie_id")
	if err != nil {
		return nil, fmt.Errorf("locatie_id: %w", err)
	}
	bsn, _ := varString(t, "bsn")
	voorletters, _ := varString(t, "voorletters")
	roepnaam, _ := varString(t, "roepnaam")
	tussenvoegsel, _ := varString(t, "tussenvoegsel")
	achternaam, _ := varString(t, "achternaam")
	geboortedatum, _ := varString(t, "geboortedatum")
	eindeDatum, _ := varString(t, "einde_datum")
	if eindeDatum == "" {
		eindeDatum = "2099-12-31"
	}
	ingezetene, _ := varBool(t, "ingezetene")
	opmerking, _ := varString(t, "opmerking")
	vandaag := time.Now().Format("2006-01-02")

	return map[string]any{
		"registratie": registratieHeader("registratie", opmerking),
		"wijzigingen": []any{
			map[string]any{"opvoer": map[string]any{
				"natuurlijkpersoon": npOpvoer(npID, bsn, voorletters, roepnaam, tussenvoegsel, achternaam, geboortedatum, eindeDatum, ingezetene),
			}},
			map[string]any{"opvoer": map[string]any{
				"bereikbaarheid": bereikbaarheidOpvoer(npID, locatieID, 1, vandaag),
			}},
		},
	}, nil
}

// bouwBereikbaarheidPayload: alleen bereikbaarheid (persoon bestaat al, historisch).
func bouwBereikbaarheidPayload(t lockedTask) (map[string]any, error) {
	npID, err := varInt64(t, "np_id")
	if err != nil {
		return nil, fmt.Errorf("np_id: %w", err)
	}
	locatieID, err := varInt64(t, "locatie_id")
	if err != nil {
		return nil, fmt.Errorf("locatie_id: %w", err)
	}
	opmerking, _ := varString(t, "opmerking")
	vandaag := time.Now().Format("2006-01-02")

	return map[string]any{
		"registratie": registratieHeader("registratie", opmerking),
		"wijzigingen": []any{
			map[string]any{"opvoer": map[string]any{
				"bereikbaarheid": bereikbaarheidOpvoer(npID, locatieID, 1, vandaag),
			}},
		},
	}, nil
}

// bouwLocatiePayload: registreer een nieuwe locatie met optioneel een adres-GE.
// Variabelen uit procescontext:
//   - locatie_id  (Long)   — entity-ID voor de nieuwe locatie
//   - straatnaam  (String) — straatnaam voor het adres (optioneel, maar aanbevolen)
//   - huisnummer  (String) — huisnummer (optioneel)
//   - postcode    (String) — NL-postcode, bijv. "1234AB" (optioneel)
//   - gemeente_id (Long)   — ID uit de gemeentenlijst (default 0 als niet opgegeven)
//   - opmerking   (String) — toelichting op de registratie
//
// Let op: de landen-referentielijst is leeg in de PoC. Het veld land=0
// is een tijdelijke waarde; dit kan gecorrigeerd worden zodra land-data is geladen.
func bouwLocatiePayload(t lockedTask) (map[string]any, error) {
	locatieID, err := varInt64(t, "locatie_id")
	if err != nil {
		return nil, fmt.Errorf("locatie_id: %w", err)
	}
	straatnaam, _ := varString(t, "straatnaam")
	huisnummer, _ := varString(t, "huisnummer")
	postcode, _ := varString(t, "postcode")
	gemeenteID, _ := varInt64(t, "gemeente_id")
	opmerking, _ := varString(t, "opmerking")
	vandaag := time.Now().Format("2006-01-02")

	locatie := map[string]any{
		"id": int(locatieID),
		// Materieel: aanvang op vandaag (kan later gecorrigeerd worden)
		"aanvang": map[string]any{
			"locatie_id": int(locatieID),
			"datum":      vandaag,
		},
	}

	// Voeg adres-GE toe als straatnaam beschikbaar is
	if straatnaam != "" {
		adres := map[string]any{
			"locatie_id": int(locatieID),
			"rel_id":     1,
			"straatnaam": straatnaam,
			"huisnummer": huisnummer,
			"gemeente":   int(gemeenteID),
			// landen-tabel is leeg in PoC: land=0 als tijdelijke waarde
			"land": 0,
		}
		if postcode != "" {
			adres["postcode"] = postcode
		}
		locatie["adressen"] = []any{adres}
	}

	return map[string]any{
		"registratie": registratieHeader("registratie", opmerking),
		"wijzigingen": []any{
			map[string]any{"opvoer": map[string]any{
				"locatie": locatie,
			}},
		},
	}, nil
}

// ─────────────────────────────────────────────
//  HELPERS VOOR PAYLOAD
// ─────────────────────────────────────────────

func registratieHeader(registratietype, opmerking string) map[string]any {
	h := map[string]any{
		"registratietype": registratietype,
		"tijdstip":        time.Now().UTC().Format(time.RFC3339),
	}
	if opmerking != "" {
		h["opmerking"] = opmerking
	}
	return h
}

func npOpvoer(npID int64, bsn, voorletters, roepnaam, tussenvoegsel, achternaam, geboortedatum, eindeDatum string, ingezetene bool) map[string]any {
	return map[string]any{
		"id": npID,
		"persoonsidentificaties": map[string]any{
			"natuurlijkpersoon_id": npID, "rel_id": 1,
			"bsn": bsn, "ingezetene": ingezetene,
		},
		"namen": map[string]any{
			"natuurlijkpersoon_id": npID, "rel_id": 1,
			"voorletters": voorletters, "roepnaam": roepnaam,
			"tussenvoegsel": tussenvoegsel, "achternaam": achternaam,
		},
		"aanvang": map[string]any{"natuurlijkpersoon_id": npID, "datum": geboortedatum},
		"einde":   map[string]any{"natuurlijkpersoon_id": npID, "datum": eindeDatum},
	}
}

func bereikbaarheidOpvoer(npID, locatieID int64, relID int, aanvangDatum string) map[string]any {
	return map[string]any{
		"natuurlijkpersoon_id": npID,
		"rel_id":               relID,
		"locatie_id":           locatieID,
		"soort":                "Woonadres",
		"aanvang": map[string]any{
			"natuurlijkpersoon_id": npID,
			"datum":                aanvangDatum,
		},
	}
}

// ─────────────────────────────────────────────
//  OPERATON REST HELPERS
// ─────────────────────────────────────────────

func fetchAndLock(ctx context.Context, httpc *http.Client, cfg Config) ([]lockedTask, error) {
	topics := make([]topic, len(allTopics))
	for i, name := range allTopics {
		topics[i] = topic{TopicName: name, LockDuration: int(cfg.LockDuration / time.Millisecond)}
	}
	body, _ := json.Marshal(fetchAndLockRequest{
		WorkerID: cfg.WorkerID,
		MaxTasks: cfg.MaxTasks,
		Topics:   topics,
	})
	req, _ := http.NewRequestWithContext(ctx, http.MethodPost, cfg.OperatonBaseURL+"/external-task/fetchAndLock", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := httpc.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("fetchAndLock %d: %s", resp.StatusCode, string(b))
	}
	var tasks []lockedTask
	if err := json.NewDecoder(resp.Body).Decode(&tasks); err != nil {
		return nil, err
	}
	return tasks, nil
}

func complete(ctx context.Context, httpc *http.Client, cfg Config, taskID string, vars map[string]Variable) error {
	body, _ := json.Marshal(completeRequest{WorkerID: cfg.WorkerID, Variables: vars})
	req, _ := http.NewRequestWithContext(ctx, http.MethodPost, cfg.OperatonBaseURL+"/external-task/"+taskID+"/complete", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := httpc.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("complete %d: %s", resp.StatusCode, string(b))
	}
	return nil
}

func fail(ctx context.Context, httpc *http.Client, cfg Config, taskID, msg string, log *slog.Logger) {
	body, _ := json.Marshal(failureRequest{
		WorkerID: cfg.WorkerID, ErrorMessage: msg, Retries: 0, RetryTimeout: 0,
	})
	req, _ := http.NewRequestWithContext(ctx, http.MethodPost, cfg.OperatonBaseURL+"/external-task/"+taskID+"/failure", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := httpc.Do(req)
	if err != nil {
		log.Error("failure-call mislukt", "err", err, "msg", msg)
		return
	}
	resp.Body.Close()
	log.Warn("task gefaald", "msg", msg)
}

func sleep(ctx context.Context, d time.Duration) {
	t := time.NewTimer(d)
	defer t.Stop()
	select {
	case <-ctx.Done():
	case <-t.C:
	}
}

// ─────────────────────────────────────────────
//  PROCESVARIABELEN HELPERS
// ─────────────────────────────────────────────

func varString(t lockedTask, key string) (string, bool) {
	v, ok := t.Variables[key]
	if !ok {
		return "", false
	}
	if s, ok := v.Value.(string); ok {
		return s, true
	}
	return fmt.Sprintf("%v", v.Value), true
}

func varBool(t lockedTask, key string) (bool, bool) {
	v, ok := t.Variables[key]
	if !ok {
		return false, false
	}
	if b, ok := v.Value.(bool); ok {
		return b, true
	}
	return false, false
}

func varInt64(t lockedTask, key string) (int64, error) {
	v, ok := t.Variables[key]
	if !ok {
		return 0, fmt.Errorf("variabele %s ontbreekt", key)
	}
	switch x := v.Value.(type) {
	case float64:
		return int64(x), nil
	case int64:
		return x, nil
	case int:
		return int64(x), nil
	case string:
		var n int64
		if _, err := fmt.Sscan(x, &n); err != nil {
			return 0, fmt.Errorf("variabele %s niet-numeriek: %s", key, x)
		}
		return n, nil
	}
	return 0, fmt.Errorf("variabele %s onverwacht type %T", key, v.Value)
}

func trunc(b []byte, n int) string {
	if len(b) <= n {
		return string(b)
	}
	return string(b[:n]) + "..."
}
