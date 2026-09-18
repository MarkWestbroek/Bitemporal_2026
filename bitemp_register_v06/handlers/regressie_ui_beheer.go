//go:build devtools

// regressie_ui_beheer.go — scenario's opslaan, verwijderen, herordenen en replay-import.
package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/gin-gonic/gin"
)

var regressieSlugRE = regexp.MustCompile(`[^a-z0-9]+`)

// slug maakt een bestandsnaam-veilige variant van een naam.
func slug(s string) string {
	s = strings.Trim(regressieSlugRE.ReplaceAllString(strings.ToLower(strings.TrimSpace(s)), "-"), "-")
	if len(s) > 60 {
		s = strings.Trim(s[:60], "-")
	}
	if s == "" {
		s = "scenario"
	}
	return s
}

// schrijfScenario schrijft een definitie naar <id>-<slug>.json (nette, stabiele JSON).
func schrijfScenario(def regressieScenarioDef) (string, error) {
	// Encoder i.p.v. MarshalIndent: zonder HTML-escaping blijft ">=5" leesbaar in het
	// bestand (anders wordt het een unicode-escape), wat handmatig bewerken prettiger maakt.
	var buf bytes.Buffer
	enc := json.NewEncoder(&buf)
	enc.SetEscapeHTML(false)
	enc.SetIndent("", "  ")
	if err := enc.Encode(def); err != nil {
		return "", err
	}
	dir := regressieScenarioDir()
	if err := os.MkdirAll(dir, 0o750); err != nil {
		return "", err
	}
	bestand := filepath.Join(dir, def.ID+"-"+slug(def.Naam)+".json")
	return filepath.Base(bestand), os.WriteFile(bestand, buf.Bytes(), 0o644)
}

// verwijderScenarioBestanden verwijdert alle bestanden van een scenario-id.
func verwijderScenarioBestanden(id string) int {
	n := 0
	for _, s := range leesDeclaratieveScenarios() {
		if s.ID == id {
			if os.Remove(filepath.Join(regressieScenarioDir(), s.Bestand)) == nil {
				n++
			}
		}
	}
	return n
}

// valideerScenario controleert vorm en verwijzingen van een definitie.
func valideerScenario(def *regressieScenarioDef) error {
	def.ID, def.Naam = strings.TrimSpace(def.ID), strings.TrimSpace(def.Naam)
	if !regressieIDPatroon.MatchString(def.ID) {
		return fmt.Errorf("id moet 2–3 cijfers zijn, optioneel gevolgd door een letter (bv. 20 of 21a)")
	}
	if def.ID == "00" {
		return fmt.Errorf("id 00 is gereserveerd voor de seed")
	}
	if def.Naam == "" {
		return fmt.Errorf("naam is verplicht")
	}
	// Een scenario met rollen (load.mix) speelt andere scenario's tegelijk af en mag zelf leeg zijn.
	var load struct {
		Mix []struct {
			Scenario string `json:"scenario"`
		} `json:"mix"`
	}
	if len(def.Load) > 0 {
		if err := json.Unmarshal(def.Load, &load); err != nil {
			return fmt.Errorf("load: ongeldige JSON (%v)", err)
		}
	}
	for i, m := range load.Mix {
		id := strings.TrimSpace(m.Scenario)
		if id == "" || id == def.ID {
			return fmt.Errorf("load.mix[%d]: 'scenario' moet het id van een ánder scenario zijn", i)
		}
		gevonden := false
		for _, s := range leesDeclaratieveScenarios() {
			if s.ID == id {
				gevonden = true
			}
		}
		if !gevonden {
			return fmt.Errorf("load.mix[%d]: scenario %q bestaat niet", i, id)
		}
	}
	if len(def.Stappen) == 0 && len(load.Mix) == 0 {
		return fmt.Errorf("minimaal één stap is verplicht (of rollen in load.mix)")
	}
	if def.Stappen == nil {
		def.Stappen = []json.RawMessage{} // schrijf "stappen": [] in plaats van null
	}
	for i, raw := range def.Stappen {
		var stap struct {
			Path   string `json:"path"`
			Replay string `json:"replay"`
			Actie  string `json:"actie"`
		}
		if err := json.Unmarshal(raw, &stap); err != nil {
			return fmt.Errorf("stap %d: moet een JSON-object zijn (%v)", i+1, err)
		}
		soorten := 0
		for _, v := range []string{stap.Path, stap.Replay, stap.Actie} {
			if strings.TrimSpace(v) != "" {
				soorten++
			}
		}
		if soorten != 1 {
			return fmt.Errorf("stap %d: geef precies één van 'path' (request), 'replay' of 'actie' op", i+1)
		}
		if r := strings.TrimSpace(stap.Replay); r != "" && !strings.Contains(r, "{{") {
			if _, err := os.Stat(filepath.Join(resolveAppDir(), r)); err != nil {
				return fmt.Errorf("stap %d: replay-bestand %q niet gevonden (pad relatief aan de app-map)", i+1, r)
			}
		}
		if a := strings.TrimSpace(stap.Actie); a != "" && a != "seed_admin" {
			return fmt.Errorf("stap %d: onbekende actie %q (bekend: seed_admin)", i+1, a)
		}
	}
	if len(def.Load) > 0 && string(def.Load) != "null" {
		var l map[string]any
		if err := json.Unmarshal(def.Load, &l); err != nil {
			return fmt.Errorf("load moet een JSON-object zijn: %v", err)
		}
	} else {
		def.Load = nil
	}
	return nil
}

// regressieScenarioOpslaan schrijft een scenario. Body: {"scenario": {…}, "vorig_id": "…",
// "overschrijf": bool}; voor compatibiliteit mag de body ook direct het scenario zijn.
func regressieScenarioOpslaan(c *gin.Context) {
	if !eisRegressieMutatie(c) {
		return
	}
	var req struct {
		Scenario    *regressieScenarioDef `json:"scenario"`
		VorigID     string                `json:"vorig_id"`
		Overschrijf bool                  `json:"overschrijf"`
	}
	raw, err := c.GetRawData()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "kan body niet lezen"})
		return
	}
	if err := json.Unmarshal(raw, &req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ongeldige JSON: " + err.Error()})
		return
	}
	if req.Scenario == nil { // body is direct het scenario
		var def regressieScenarioDef
		if err := json.Unmarshal(raw, &def); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "ongeldige scenario-JSON: " + err.Error()})
			return
		}
		req.Scenario = &def
	}
	def := *req.Scenario
	if err := valideerScenario(&def); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	vorig := strings.TrimSpace(req.VorigID)
	maxVolgorde := 0
	for _, s := range leesDeclaratieveScenarios() {
		if s.Definitie != nil && s.Definitie.Volgorde > maxVolgorde {
			maxVolgorde = s.Definitie.Volgorde
		}
		if s.ID == def.ID && def.ID != vorig && !req.Overschrijf {
			c.JSON(http.StatusConflict, gin.H{"error": fmt.Sprintf("id %s bestaat al (%s); kies een ander id of vink 'overschrijven' aan", def.ID, s.Bestand)})
			return
		}
	}
	if def.Volgorde == 0 {
		def.Volgorde = maxVolgorde + 10
	}
	if vorig != "" {
		verwijderScenarioBestanden(vorig)
	}
	verwijderScenarioBestanden(def.ID)
	bestand, err := schrijfScenario(def)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "kan scenario niet schrijven: " + err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"bestand": bestand, "id": def.ID})
}

func regressieScenarioVerwijderen(c *gin.Context) {
	if !eisRegressieMutatie(c) {
		return
	}
	id := strings.TrimSpace(c.Param("id"))
	if !regressieIDPatroon.MatchString(id) || id == "00" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ongeldig id"})
		return
	}
	// Waarschuwen als andere scenario's dit scenario vereisen.
	var afhankelijk []string
	for _, s := range leesDeclaratieveScenarios() {
		if s.Definitie == nil || s.ID == id {
			continue
		}
		for _, v := range s.Definitie.Vereist {
			if v == id {
				afhankelijk = append(afhankelijk, s.ID)
			}
		}
	}
	if len(afhankelijk) > 0 && c.Query("forceer") != "1" {
		c.JSON(http.StatusConflict, gin.H{"error": fmt.Sprintf("scenario %s wordt vereist door %s; pas die eerst aan of verwijder met ?forceer=1", id, strings.Join(afhankelijk, ", "))})
		return
	}
	if verwijderScenarioBestanden(id) == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "scenario niet gevonden"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"verwijderd": id})
}

// regressieVolgordeOpslaan legt de volgorde vast: body {"ids": ["01","03","02",…]}.
// Elk genoemd scenario krijgt volgorde 10, 20, 30, …; niet-genoemde sluiten achteraan aan.
func regressieVolgordeOpslaan(c *gin.Context) {
	if !eisRegressieMutatie(c) {
		return
	}
	var req struct {
		IDs []string `json:"ids"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || len(req.IDs) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "geef {\"ids\": [...]} op"})
		return
	}
	positie := map[string]int{}
	for i, id := range req.IDs {
		positie[strings.TrimSpace(id)] = (i + 1) * 10
	}
	volgende := (len(req.IDs) + 1) * 10
	bijgewerkt := 0
	for _, s := range leesDeclaratieveScenarios() {
		if s.Definitie == nil {
			continue
		}
		def := *s.Definitie
		nieuw, ok := positie[def.ID]
		if !ok {
			nieuw = volgende
			volgende += 10
		}
		if def.Volgorde == nieuw {
			continue
		}
		def.Volgorde = nieuw
		_ = os.Remove(filepath.Join(regressieScenarioDir(), s.Bestand))
		if _, err := schrijfScenario(def); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "kan volgorde niet schrijven: " + err.Error()})
			return
		}
		bijgewerkt++
	}
	c.JSON(http.StatusOK, gin.H{"bijgewerkt": bijgewerkt})
}

// regressieImportReplay zet een replay-bestand om in een bewerkbaar scenario: elke entry
// wordt een request-stap met body en verwachte status. Body: {"bestand","id","naam"}.
func regressieImportReplay(c *gin.Context) {
	if !eisRegressieMutatie(c) {
		return
	}
	var req struct {
		Bestand     string `json:"bestand"`
		ID          string `json:"id"`
		Naam        string `json:"naam"`
		Overschrijf bool   `json:"overschrijf"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ongeldige body: " + err.Error()})
		return
	}
	bestand := strings.TrimSpace(req.Bestand)
	if bestand == "" || strings.Contains(bestand, "..") || !strings.HasPrefix(filepath.ToSlash(bestand), "replay files/") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "bestand moet een pad onder \"replay files/\" zijn"})
		return
	}
	entries, _, err := leesReplayEntries(bestand)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if len(entries) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "replay-bestand bevat geen entries"})
		return
	}

	def := regressieScenarioDef{ID: req.ID, Naam: req.Naam, Tags: []string{"replay-import"},
		Beschrijving: fmt.Sprintf("Geïmporteerd uit %s (%d entries). Let op id-botsingen met de seed en andere scenario's.", bestand, len(entries))}
	if strings.TrimSpace(def.Naam) == "" {
		def.Naam = "import " + strings.TrimSuffix(filepath.Base(bestand), ".json")
	}
	for i, e := range entries {
		regtype, opmerking, delen := replayEntryKop(e)
		naam := opmerking
		if naam == "" {
			naam = fmt.Sprintf("entry %d: %s %s", i, regtype, strings.Join(delen, " "))
		}
		method := e.RequestMethod
		if method == "" {
			method = "POST"
		}
		pad := e.RequestPath
		if pad == "" {
			pad = "/registratie/"
		}
		status := 201
		if e.ExpectedResponseCode != nil {
			status = *e.ExpectedResponseCode
		}
		stap, _ := json.Marshal(map[string]any{
			"naam": kortTekst(naam, 80), "method": method, "path": pad,
			"body": e.RequestBody, "verwacht": map[string]any{"status": status},
		})
		def.Stappen = append(def.Stappen, stap)
	}
	if err := valideerScenario(&def); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	maxVolgorde := 0
	for _, s := range leesDeclaratieveScenarios() {
		if s.ID == def.ID && !req.Overschrijf {
			c.JSON(http.StatusConflict, gin.H{"error": fmt.Sprintf("id %s bestaat al (%s)", def.ID, s.Bestand)})
			return
		}
		if s.Definitie != nil && s.Definitie.Volgorde > maxVolgorde {
			maxVolgorde = s.Definitie.Volgorde
		}
	}
	def.Volgorde = maxVolgorde + 10
	verwijderScenarioBestanden(def.ID)
	naam, err := schrijfScenario(def)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"bestand": naam, "id": def.ID, "stappen": len(def.Stappen)})
}
