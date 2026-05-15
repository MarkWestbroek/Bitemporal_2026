// Package handlers — registration_core.go
//
// FASE 0 (refactor 2026-04-29):
// Pure registratie-engine zonder gin-afhankelijkheden. Wordt aangeroepen door
// de Gin-handler `RegistreerMetNieuweAanpak` (REST) en kan in fase 2/3 ook
// gebruikt worden door de PATCH/DELETE-handlers (CRUD per padnaam) en de
// GraphQL-mutaties.
//
// Contract:
//   - `req` MOET al genormaliseerd zijn met `NormaliseerWijzigingen`.
//   - `audit` levert request-metadata (raw body, path, method, optionele
//     entiteitID uit URL) — REST vult deze; GraphQL kan ze ook vullen.
//   - Op succes: `RegistreerResult` met response-payload + statuscode.
//   - Bij fout: `*RegistreerError` met HTTP-status + boodschap, transactie
//     gerollback. De gemonoteerde audit-velden (response_code, response_body)
//     worden alléén bij succes bijgewerkt; bij fout blijft de Registratie-
//     insert ook gerollback (binnen dezelfde tx).
package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
	"time"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
	"github.com/uptrace/bun"
)

// RegistreerError combineert een HTTP-status met een foutboodschap.
// Het transport (REST/GraphQL) vertaalt dit naar het juiste responseformaat.
// Bij validatiefouten wordt `Problem` gevuld zodat de REST-adapter een
// RFC 9457 (NL API Strategie) `application/problem+json`-response kan sturen.
type RegistreerError struct {
	Status  int
	Msg     string
	Problem *model.ProblemDetails
}

func (e *RegistreerError) Error() string { return e.Msg }

func newRegistreerErr(status int, format string, args ...any) *RegistreerError {
	return &RegistreerError{Status: status, Msg: fmt.Sprintf(format, args...)}
}

// AuditMeta bundelt request-metadata die in de Registratie-row terecht komt
// voor audittrail-doeleinden.
type AuditMeta struct {
	RawBody       []byte
	RequestPath   string
	RequestMethod string
	EntiteitID    string // optioneel: uit URL :id (REST) of GraphQL-argument
	// Strengheid bepaalt of validatiefouten blokkeren (strict) of slechts
	// gerapporteerd worden (lenient/warnings-only). Default = strict.
	Strengheid model.Validatiestrengheid
}

// RegistreerResult bevat het succesresultaat van RegistreerCore.
type RegistreerResult struct {
	Status        int
	Message       string
	RegistratieID int64
	Tijdstip      time.Time
	Wijzigingen   []model.WijzigingRequest
	ResponseBody  json.RawMessage
	DurationMs    int64
	// Validatie bevat de gevonden fouten/waarschuwingen op basis van
	// V3Datatype-regels (B.A.2). Bij StrengheidStrict en aanwezige fouten
	// wordt RegistreerCore al eerder afgebroken met een RegistreerError;
	// in lenient/warnings-only modus komt de inhoud hier terug.
	Validatie *model.ValidatieResultaat
}

// RegistreerCore voert de registratie/correctie/ongedaanmaking transactioneel uit.
// Dit is de pure engine; alle gin-specifieke logica leeft in de wrapper-handler.
func RegistreerCore(ctx context.Context, db *bun.DB, req model.RegistreerRequest, audit AuditMeta) (RegistreerResult, *RegistreerError) {
	start := time.Now()

	// Audit-velden in de Registratie zetten zodat ze ge-insert worden.
	rawBody := audit.RawBody
	requestPath := audit.RequestPath
	requestMethod := audit.RequestMethod
	req.Registratie.RequestBody = rawBody
	if requestPath != "" {
		req.Registratie.RequestPath = &requestPath
	}
	if requestMethod != "" {
		req.Registratie.RequestMethod = &requestMethod
	}

	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return RegistreerResult{}, newRegistreerErr(http.StatusInternalServerError, "failed to start transaction: %v", err)
	}
	committed := false
	defer func() {
		if !committed {
			_ = tx.Rollback()
		}
	}()

	// Stap 1: Insert Registratie en haal ID op.
	if _, err := tx.NewInsert().Model(&req.Registratie).Returning("id").Exec(ctx); err != nil {
		return RegistreerResult{}, newRegistreerErr(http.StatusInternalServerError, "failed to insert registratie: %v", err)
	}

	// TIJDELIJK: oplopend testtijdstip op basis van ID, zoals in originele handler.
	req.Registratie.Tijdstip = time.
		Date(2026, 1, 1, 0, 0, 0, 0, time.UTC).
		Add(time.Duration(req.Registratie.ID) * time.Hour).
		Add(time.Microsecond * time.Duration(req.Registratie.ID))
	if _, err := tx.NewUpdate().Model(&req.Registratie).Where("id = ?", req.Registratie.ID).Exec(ctx); err != nil {
		return RegistreerResult{}, newRegistreerErr(http.StatusInternalServerError, "failed to update registratie with tijdstip: %v", err)
	}

	registratieID := req.Registratie.ID
	registratieTijdstip := req.Registratie.Tijdstip

	// B.A.2: valideer alle representaties op basis van V3Datatype-regels.
	// In strict-modus → eerste fout = HTTP 422 + rollback. In lenient/warnings-only
	// → fouten verzamelen en doorgeven via RegistreerResult.Validatie.
	validatie := valideerWijzigingen(req.Wijzigingen)
	strengheid := audit.Strengheid
	if strengheid == "" {
		strengheid = model.StrengheidStrict
	}
	if strengheid == model.StrengheidWarningsOnly {
		// alle fouten degraderen naar waarschuwingen
		validatie.Waarschuwingen = append(validatie.Waarschuwingen, validatie.Fouten...)
		validatie.Fouten = nil
	}
	if strengheid.IsBlokkerend() && validatie.HeeftFouten() {
		pd := model.BuildProblemDetails(validatie, audit.RequestPath)
		return RegistreerResult{}, &RegistreerError{
			Status: http.StatusUnprocessableEntity,
			Msg: fmt.Sprintf("validatie mislukt (%d fout(en)): %s",
				len(validatie.Fouten), beschrijfFouten(validatie.Fouten)),
			Problem: &pd,
		}
	}

	// ONGEDAANMAKING scenario.
	if req.Registratie.Registratietype == model.RegistratietypeOngedaanmaking {
		if rerr := verwerkOngedaanmaking(ctx, tx, db, &req); rerr != nil {
			return RegistreerResult{}, rerr
		}
	}

	// Stap 2: itereer over wijzigingen.
	for wijzigingIdx, wijziging := range req.Wijzigingen {
		var rep *model.RepresentatiePlusNaam
		if wijziging.Opvoer != nil {
			rep = wijziging.Opvoer
		} else if wijziging.Afvoer != nil {
			rep = wijziging.Afvoer
		}
		if debugLogsEnabled() {
			if rep != nil && rep.Representatie != nil {
				fmt.Printf("HANDLER: representatienaam=%s veldnaam=%s\n%s", rep.Representatienaam, rep.Veldnaam, model.RepresentatieToString(rep.Representatie))
			} else {
				fmt.Println("HANDLER: geen representatie aanwezig in wijziging")
			}
		}
		if rep == nil || rep.Representatie == nil {
			return RegistreerResult{}, newRegistreerErr(http.StatusBadRequest, "wijziging[%d] bevat geen representatie", wijzigingIdx)
		}
		temporalRep, ok := rep.Representatie.(model.FormeleRepresentatie)
		if !ok {
			return RegistreerResult{}, newRegistreerErr(http.StatusBadRequest, "wijziging[%d]: representatie %T (veldnaam=%s) ondersteunt geen opvoer/afvoer interface", wijzigingIdx, rep.Representatie, rep.Veldnaam)
		}

		switch {
		case wijziging.Opvoer != nil:
			if err := handleRepresentatieOpvoer(ctx, tx, req.Registratie,
				"", "", rep.Representatienaam, temporalRep); err != nil {
				return RegistreerResult{}, newRegistreerErr(http.StatusInternalServerError, "wijziging[%d]: opvoer van %s (veldnaam=%s) mislukt: %v", wijzigingIdx, rep.Representatienaam, rep.Veldnaam, err)
			}
		case wijziging.Afvoer != nil:
			if err := handleRepresentatieAfvoer(ctx, tx, registratieID, registratieTijdstip,
				"", "", rep.Representatienaam, temporalRep); err != nil {
				return RegistreerResult{}, newRegistreerErr(http.StatusInternalServerError, "wijziging[%d]: afvoer van %s (veldnaam=%s) mislukt: %v", wijzigingIdx, rep.Representatienaam, rep.Veldnaam, err)
			}
		}
	}

	// Afgeleide domeinen: verzamel unieke domeinen uit TypeMeta.
	domeinSet := make(map[string]struct{})
	for _, w := range req.Wijzigingen {
		repNaam := ""
		if w.Opvoer != nil {
			repNaam = w.Opvoer.Representatienaam
		} else if w.Afvoer != nil {
			repNaam = w.Afvoer.Representatienaam
		}
		if repNaam == "" {
			continue
		}
		if meta, ok := model.MetaRegistry.GetTypeMeta(repNaam); ok && meta.Domein != "" {
			domeinSet[meta.Domein] = struct{}{}
		}
	}
	domeinen := make([]string, 0, len(domeinSet))
	for d := range domeinSet {
		domeinen = append(domeinen, d)
	}
	sort.Strings(domeinen)
	req.Registratie.Domeinen = domeinen

	elapsedMs := time.Since(start).Milliseconds()
	responseStatus := http.StatusCreated
	message := fmt.Sprintf("De registratie %d is succesvol verwerkt op %s in %d ms", registratieID, registratieTijdstip, elapsedMs)

	// Response payload — identiek aan de oude `gin.H` (ook `registratieId`-alias).
	payload := map[string]any{
		"message":        message,
		"registratie_id": registratieID,
		"registratieId":  registratieID,
		"tijdstip":       registratieTijdstip,
		"wijzigingen":    req.Wijzigingen,
	}
	responseBodyJSON, jerr := json.Marshal(payload)
	if jerr != nil {
		return RegistreerResult{}, newRegistreerErr(http.StatusInternalServerError, "failed to serialize response body for audit: %v", jerr)
	}

	req.Registratie.ResponseCode = &responseStatus
	req.Registratie.ResponseBody = responseBodyJSON
	req.Registratie.DurationMs = &elapsedMs
	if _, err := tx.NewUpdate().
		Model(&req.Registratie).
		Column("response_code", "response_body", "duration_ms", "domeinen").
		Where("id = ?", registratieID).
		Exec(ctx); err != nil {
		return RegistreerResult{}, newRegistreerErr(http.StatusInternalServerError, "failed to update registratie audit fields: %v", err)
	}

	if err := tx.Commit(); err != nil {
		return RegistreerResult{}, newRegistreerErr(http.StatusInternalServerError, "failed to commit transaction: %v", err)
	}
	committed = true

	return RegistreerResult{
		Status:        responseStatus,
		Message:       message,
		RegistratieID: registratieID,
		Tijdstip:      registratieTijdstip,
		Wijzigingen:   req.Wijzigingen,
		ResponseBody:  responseBodyJSON,
		DurationMs:    elapsedMs,
		Validatie:     validatieOfNil(validatie),
	}, nil
}

// valideerWijzigingen valideert alle representaties in de request.
func valideerWijzigingen(wijzigingen []model.WijzigingRequest) model.ValidatieResultaat {
	var res model.ValidatieResultaat
	for idx, w := range wijzigingen {
		var rep *model.RepresentatiePlusNaam
		if w.Opvoer != nil {
			rep = w.Opvoer
		} else if w.Afvoer != nil {
			rep = w.Afvoer
		}
		if rep == nil || rep.Representatie == nil {
			continue
		}
		pad := fmt.Sprintf("wijzigingen[%d].%s", idx, rep.Veldnaam)
		fouten := model.ValideerRepresentatie(rep.Representatie, pad)
		for _, f := range fouten {
			if f.Severity == model.SeverityWarning {
				res.Waarschuwingen = append(res.Waarschuwingen, f)
			} else {
				res.Fouten = append(res.Fouten, f)
			}
		}
	}
	return res
}

// beschrijfFouten produceert een leesbare samenvatting voor in de errormessage.
func beschrijfFouten(fouten []model.ValidatieFout) string {
	parts := make([]string, 0, len(fouten))
	for _, f := range fouten {
		parts = append(parts, fmt.Sprintf("%s [%s]: %s", f.Veld, f.Code, f.Bericht))
	}
	return joinKort(parts, "; ", 5)
}

// joinKort beperkt het aantal getoonde items om de errormessage compact te houden.
func joinKort(items []string, sep string, max int) string {
	if len(items) <= max {
		return joinAll(items, sep)
	}
	head := items[:max]
	return joinAll(head, sep) + fmt.Sprintf("%s… (+%d meer)", sep, len(items)-max)
}

func joinAll(items []string, sep string) string {
	out := ""
	for i, it := range items {
		if i > 0 {
			out += sep
		}
		out += it
	}
	return out
}

func validatieOfNil(v model.ValidatieResultaat) *model.ValidatieResultaat {
	if len(v.Fouten) == 0 && len(v.Waarschuwingen) == 0 {
		return nil
	}
	return &v
}

// verwerkOngedaanmaking voert de ONGEDAANMAKING-scenario-logica uit.
// Wordt alleen aangeroepen wanneer req.Registratie.Registratietype = Ongedaanmaking.
func verwerkOngedaanmaking(ctx context.Context, tx bun.Tx, db *bun.DB, req *model.RegistreerRequest) *RegistreerError {
	if req.Registratie.MaaktOngedaanRegistratieID == nil {
		return newRegistreerErr(http.StatusBadRequest, "De ongedaan te maken registratie moet worden meegegeven via 'maakt_ongedaan_registratie_id' (of alias 'MaaktOngedaanRegistratieID')")
	}

	var ongedaanTeMakenRegistratie model.Registratie
	if err := db.NewSelect().
		Model(&ongedaanTeMakenRegistratie).
		Where("id = ?", *req.Registratie.MaaktOngedaanRegistratieID).
		Scan(ctx); err != nil {
		return newRegistreerErr(http.StatusBadRequest, "De te ongedaan maken registratie met ID %d bestaat niet", *req.Registratie.MaaktOngedaanRegistratieID)
	}

	if ongedaanTeMakenRegistratie.IsOngedaangemaakt {
		return newRegistreerErr(http.StatusBadRequest, "De te ongedaan maken registratie met ID %d is al ongedaan gemaakt", ongedaanTeMakenRegistratie.ID)
	}

	var wijzigingenOnderTeOngedaanMakenRegistratie []model.Wijziging
	if err := db.NewSelect().
		Model(&wijzigingenOnderTeOngedaanMakenRegistratie).
		Where("registratie_id = ?", ongedaanTeMakenRegistratie.ID).
		Scan(ctx); err != nil {
		return newRegistreerErr(http.StatusInternalServerError, "Fout bij ophalen wijzigingen onder te ongedaan maken registratie: %v", err)
	}

	for _, doelWijziging := range wijzigingenOnderTeOngedaanMakenRegistratie {
		var latereWijzigingen []model.Wijziging
		if err := db.NewSelect().
			Model(&latereWijzigingen).
			Where("registratie_id <> ?", ongedaanTeMakenRegistratie.ID).
			Where("tijdstip > ?", ongedaanTeMakenRegistratie.Tijdstip).
			Where("tijdstip <= ?", req.Registratie.Tijdstip).
			Where("COALESCE(entiteitnaam, '') = ?", doelWijziging.Entiteitnaam).
			Where("COALESCE(entiteit_id, '') = ?", doelWijziging.EntiteitID).
			Where("COALESCE(representatienaam, '') = ?", doelWijziging.Representatienaam).
			Where("COALESCE(representatie_id, '') = ?", doelWijziging.RepresentatieID).
			Scan(ctx); err != nil {
			return newRegistreerErr(http.StatusInternalServerError, "Fout bij controleren op latere wijzigingen na registratie %d: %v", ongedaanTeMakenRegistratie.ID, err)
		}
		if len(latereWijzigingen) > 0 {
			return newRegistreerErr(http.StatusBadRequest, "Er zijn latere wijzigingen op hetzelfde gegevenselement; ongedaanmaking van registratie %d is daarom niet toegestaan. Doelwijziging: %v, latere wijzigingen: %v", ongedaanTeMakenRegistratie.ID, doelWijziging, latereWijzigingen)
		}
	}

	// TODO: ondersteuning voor ongedaanmaking van een ongedaanmaking ("hergedaanmaking").
	if ongedaanTeMakenRegistratie.IsOngedaanmaking() {
		return newRegistreerErr(http.StatusBadRequest, "Ongedaan maken van een ongedaanmaking is nog niet mogelijk")
	}

	// Voer per wijziging de ont-opvoer / ont-afvoer uit.
	for _, wijziging := range wijzigingenOnderTeOngedaanMakenRegistratie {
		switch wijziging.Wijzigingstype {
		case model.WijzigingstypeOpvoer:
			if err := handleRepresentatieOntOpvoer(ctx, tx, wijziging); err != nil {
				return newRegistreerErr(http.StatusInternalServerError, "Fout bij ont-opvoeren van representatie: %v", err)
			}
		case model.WijzigingstypeAfvoer:
			if err := handleRepresentatieOntAfvoer(ctx, tx, wijziging); err != nil {
				return newRegistreerErr(http.StatusInternalServerError, "Fout bij ont-afvoeren van representatie: %v", err)
			}
		}
	}

	// Markeer de ongedaan gemaakte registratie en haar wijzigingen.
	if _, err := tx.NewUpdate().
		Table("registratie").
		Set("is_ongedaan_gemaakt = ?", true).
		Where("id = ?", ongedaanTeMakenRegistratie.ID).
		Exec(ctx); err != nil {
		return newRegistreerErr(http.StatusInternalServerError, "Fout bij markeren van registratie %d als ongedaan gemaakt: %v", ongedaanTeMakenRegistratie.ID, err)
	}
	if _, err := tx.NewUpdate().
		Table("wijziging").
		Set("is_ongedaan_gemaakt = ?", true).
		Where("registratie_id = ?", ongedaanTeMakenRegistratie.ID).
		Exec(ctx); err != nil {
		return newRegistreerErr(http.StatusInternalServerError, "Fout bij markeren van wijzigingen onder registratie %d als ongedaan gemaakt: %v", ongedaanTeMakenRegistratie.ID, err)
	}

	return nil
}
