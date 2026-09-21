//go:build devtools

// regressie_ui_load.go — loadtest-run vanuit de suite-editor.
//
// Start `go test -tags integration -run ^TestLoadNpLoc$` (regressie_load_test.go) voor één
// scenario, met LOAD_SCENARIO/LOAD_VUS/LOAD_ITERATIES, en leest het resultaat terug uit
// het LOAD_UIT-bestand. Draait tegen een eigen database (…_load) zodat een loadtest de
// regressie-database niet vervuilt.
package handlers

import (
	"bufio"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

type regressieLoadRun struct {
	Bezig     bool            `json:"bezig"`
	Scenario  string          `json:"scenario"`
	Gestart   *time.Time      `json:"gestart,omitempty"`
	Klaar     *time.Time      `json:"klaar,omitempty"`
	Commando  string          `json:"commando"`
	Resultaat json.RawMessage `json:"resultaat,omitempty"`
	Log       []string        `json:"log"`
	Fout      string          `json:"fout,omitempty"`
}

func regressieLoadStatus(c *gin.Context) {
	regressieMu.Lock()
	defer regressieMu.Unlock()
	if regressieLd == nil {
		c.JSON(http.StatusOK, gin.H{"bezig": false, "log": []string{}})
		return
	}
	c.JSON(http.StatusOK, regressieLd)
}

// loadDSN leidt een aparte database af voor loadtests (suffix _load).
func loadDSN(dsn string) string {
	u, err := url.Parse(dsn)
	if err != nil || u.Path == "" || strings.HasSuffix(u.Path, "_load") {
		return dsn
	}
	u.Path += "_load"
	return u.String()
}

func regressieLoadStart(c *gin.Context) {
	if !eisRegressieMutatie(c) {
		return
	}
	var req struct {
		ID        string `json:"id"`
		VUs       int    `json:"vus"`
		Iteraties int    `json:"iteraties"`
		DSN       string `json:"dsn"`
		Behoud    bool   `json:"behoud"` // database niet resetten/seeden (LOAD_BEHOUD)
		Vars      string `json:"vars"`   // "k=v;k=v" → LOAD_VARS
		Seed      int    `json:"seed"`   // LOAD_SEED
		Seeds     string `json:"seeds"`  // replay-bestanden voor de seed bij reset → REGRESSIE_SEEDS
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ongeldige body: " + err.Error()})
		return
	}
	id := strings.TrimSpace(req.ID)
	gevonden := false
	for _, s := range leesDeclaratieveScenarios() {
		if s.ID == id && s.Definitie != nil {
			gevonden = true
		}
	}
	if !gevonden {
		c.JSON(http.StatusNotFound, gin.H{"error": "scenario niet gevonden: " + id})
		return
	}
	if req.VUs > 200 || req.Iteraties > 10000 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "maximaal 200 vus en 10000 iteraties (dit is een in-process loadtest, geen stresstest-farm)"})
		return
	}
	// Seeds: alleen bestaande bestanden onder "replay files/", zonder "..".
	var seeds []string
	for _, s := range strings.Split(req.Seeds, ";") {
		s = strings.TrimSpace(s)
		if s == "" {
			continue
		}
		if strings.Contains(s, "..") || !strings.HasPrefix(filepath.ToSlash(s), "replay files/") {
			c.JSON(http.StatusBadRequest, gin.H{"error": "seed moet een pad onder \"replay files/\" zijn: " + s})
			return
		}
		if _, err := os.Stat(filepath.Join(resolveAppDir(), s)); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "seed-bestand niet gevonden: " + s + " (dik bestand maken: python scripts/genereer-load-seed.py --np 2000)"})
			return
		}
		seeds = append(seeds, s)
	}
	if strings.ContainsAny(req.Vars, "\r\n") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "vars: gebruik k=v;k=v op één regel"})
		return
	}

	dsn := strings.TrimSpace(req.DSN)
	if dsn == "" {
		dsn = defaultRegressieDSNUitEnv()
	}
	if strings.Contains(dsn, "bitemp_go_db_v06") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "weiger de dev-database; gebruik een dedicated database"})
		return
	}
	dsn = loadDSN(dsn)

	regressieMu.Lock()
	if ietsBezig() {
		regressieMu.Unlock()
		c.JSON(http.StatusConflict, gin.H{"error": "er loopt al een run (regressie of load)"})
		return
	}
	uit := filepath.Join(os.TempDir(), fmt.Sprintf("regressie-load-%d.json", time.Now().UnixNano()))
	cmd := exec.Command("go", "test", "-tags", "integration", "-run", "^"+regressieLoadTestNaam+"$", "-v", "-count=1", "-timeout", "60m", ".") // ruime timeout: een dikke seed afspelen duurt minuten
	cmd.Dir = resolveAppDir()
	cmd.Env = append(os.Environ(), "REGRESSIE_DATABASE_URL="+dsn, "LOAD_SCENARIO="+id, "LOAD_UIT="+uit)
	if req.VUs > 0 {
		cmd.Env = append(cmd.Env, "LOAD_VUS="+strconv.Itoa(req.VUs))
	}
	if req.Iteraties > 0 {
		cmd.Env = append(cmd.Env, "LOAD_ITERATIES="+strconv.Itoa(req.Iteraties))
	}
	if req.Behoud {
		cmd.Env = append(cmd.Env, "LOAD_BEHOUD=1")
	}
	if v := strings.TrimSpace(req.Vars); v != "" {
		cmd.Env = append(cmd.Env, "LOAD_VARS="+v)
	}
	if req.Seed > 0 {
		cmd.Env = append(cmd.Env, "LOAD_SEED="+strconv.Itoa(req.Seed))
	}
	if len(seeds) > 0 {
		cmd.Env = append(cmd.Env, "REGRESSIE_SEEDS="+strings.Join(seeds, ";"))
	}
	nu := time.Now()
	run := &regressieLoadRun{Bezig: true, Scenario: id, Gestart: &nu,
		Commando: fmt.Sprintf("LOAD_SCENARIO=%s go test -tags integration -run ^%s$ -v -count=1 .", id, regressieLoadTestNaam)}
	regressieLd = run
	regressieMu.Unlock()

	go func() {
		fout := ""
		stdout, err := cmd.StdoutPipe()
		if err == nil {
			cmd.Stderr = cmd.Stdout
			err = cmd.Start()
		}
		if err != nil {
			fout = "kan go test niet starten: " + err.Error()
		} else {
			scanner := bufio.NewScanner(stdout)
			scanner.Buffer(make([]byte, 1024*1024), 1024*1024)
			for scanner.Scan() {
				regel := scanner.Text()
				if strings.HasPrefix(strings.TrimSpace(regel), "[GIN]") {
					continue
				}
				regressieMu.Lock()
				run.Log = append(run.Log, regel)
				if len(run.Log) > 200 {
					run.Log = run.Log[len(run.Log)-200:]
				}
				regressieMu.Unlock()
			}
			if err := cmd.Wait(); err != nil {
				fout = err.Error() // ook bij overschreden drempels (test faalt dan bewust)
			}
		}
		resultaat, _ := os.ReadFile(uit)
		_ = os.Remove(uit)

		regressieMu.Lock()
		defer regressieMu.Unlock()
		klaar := time.Now()
		run.Bezig, run.Klaar = false, &klaar
		if json.Valid(resultaat) {
			run.Resultaat = resultaat
		}
		if fout != "" && len(run.Resultaat) == 0 {
			run.Fout = fout
		}
	}()

	c.JSON(http.StatusAccepted, gin.H{"gestart": true, "scenario": id, "commando": run.Commando})
}
