package handlers

// EA-import via de server (docs/plans/2026-10-07 Sparx EA-sync, §7.6–7.8): de Studio
// bedient de node-sidecar (web/vite/scripts/importeer-qea.mjs), die een .qea uit
// een git-checkout leest en het verschil als operaties in het operatielog van
// een project zet. Het model staat op git, de sidecar is de besturing, de UI
// stuurt de sidecar; daarna is het model van ons.
//
// In de UI kies je achtereenvolgens een repo, een .qea in die repo en een
// pakket. De server zoekt de repo's en de bestanden; de UI kan alleen kiezen uit
// wat de server aanbiedt, nooit zelf een pad opgeven.
//
//   GET  /api/studio/ea-import/repos                         repo's [{naam, branch, commit, wijzigingen}]
//   GET  /api/studio/ea-import/repos/:repo/bestanden          .qea/.qeax in die repo [{pad, grootte, gewijzigd}]
//   GET  /api/studio/ea-import/repos/:repo/pakketten?bestand= pakketten in dat bestand [{id, pad}]
//   POST /api/studio/projecten/:id/ea-import                  taak starten → 202 {taak}
//   GET  /api/studio/projecten/:id/ea-import[/:taak]          stand van de (laatste) taak
//
// Env (admin, per instantie):
//   STUDIO_EA_IMPORT_MAPPEN  "D:/Git;E:/Modellen" — per map: is het zelf een git-checkout,
//                            dan is het één repo; anders tellen de git-checkouts direct
//                            eronder. Zonder deze variabele is de functie uit.
//   STUDIO_EA_IMPORT_DIR     de web/vite-map met de sidecar (standaard <APP_DIR>/web/vite)
//   STUDIO_EA_IMPORT_NODE    node-binary (standaard "node")
//   STUDIO_EA_IMPORT_API     basis-URL waarop de sidecar deze api bereikt (standaard http://localhost:<PORT|8080>)
//   STUDIO_EA_IMPORT_PULL    "true" = de UI zet "eerst git pull" standaard aan (standaard uit:
//                            een werkbranch met lokale wijzigingen laat je liever met rust)
//
// De sidecar logt in als de gebruiker die de taak start: de api maakt daarvoor een
// JWT met dezelfde claims (OMNIUM_TOKEN in de omgeving van het proces), zodat de
// operaties in het log diens naam dragen. Taken leven in het geheugen van dit
// proces (één tegelijk per project); de uitkomst is het JSON-verslag van de sidecar.

import (
	"bytes"
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/middleware"
	"github.com/gin-gonic/gin"
)

// ── Configuratie ─────────────────────────────────────────────────────

type eaImportConfig struct {
	Mappen []string // STUDIO_EA_IMPORT_MAPPEN
	Dir    string   // web/vite met de sidecar
	Node   string
	API    string
	Pull   bool // standaard voor het vinkje "eerst git pull"
}

func splitsMappen(s string) []string {
	var uit []string
	for _, deel := range strings.Split(s, ";") {
		if deel = strings.TrimSpace(deel); deel != "" {
			uit = append(uit, filepath.Clean(deel))
		}
	}
	return uit
}

func leesEaImportConfig() eaImportConfig {
	dir := strings.TrimSpace(os.Getenv("STUDIO_EA_IMPORT_DIR"))
	if dir == "" {
		dir = filepath.Join(resolveAppDir(), "web", "vite")
	}
	node := strings.TrimSpace(os.Getenv("STUDIO_EA_IMPORT_NODE"))
	if node == "" {
		node = "node"
	}
	api := strings.TrimSpace(os.Getenv("STUDIO_EA_IMPORT_API"))
	if api == "" {
		poort := strings.TrimSpace(os.Getenv("PORT"))
		if poort == "" {
			poort = "8080"
		}
		api = "http://localhost:" + poort
	}
	return eaImportConfig{
		Mappen: splitsMappen(os.Getenv("STUDIO_EA_IMPORT_MAPPEN")),
		Dir:    dir,
		Node:   node,
		API:    api,
		Pull:   strings.EqualFold(strings.TrimSpace(os.Getenv("STUDIO_EA_IMPORT_PULL")), "true"),
	}
}

// ── Repo's en bestanden zoeken ───────────────────────────────────────

// EaRepo is een git-checkout die de server aanbiedt.
type EaRepo struct {
	Naam        string `json:"naam"`
	Map         string `json:"-"` // absoluut pad; blijft binnen
	Branch      string `json:"branch,omitempty"`
	Commit      string `json:"commit,omitempty"`
	Wijzigingen int    `json:"wijzigingen"` // aantal regels in `git status --porcelain`
}

func isGitCheckout(map_ string) bool {
	st, err := os.Stat(filepath.Join(map_, ".git"))
	return err == nil && (st.IsDir() || st.Mode().IsRegular()) // .git is een bestand in een worktree
}

// zoekEaRepos: per ingestelde map de map zelf (als git-checkout) of de checkouts
// direct eronder. Namen zijn de mapnamen, bij botsing met een volgnummer. Zuiver
// op het bestandssysteem (testbaar met t.TempDir()).
func zoekEaRepos(mappen []string) []EaRepo {
	var uit []EaRepo
	gezien := map[string]int{}
	voegToe := func(pad string) {
		naam := filepath.Base(pad)
		gezien[naam]++
		if n := gezien[naam]; n > 1 {
			naam = fmt.Sprintf("%s-%d", naam, n)
		}
		uit = append(uit, EaRepo{Naam: naam, Map: pad})
	}
	for _, m := range mappen {
		if isGitCheckout(m) {
			voegToe(m)
			continue
		}
		items, err := os.ReadDir(m)
		if err != nil {
			continue
		}
		for _, it := range items {
			if it.IsDir() && isGitCheckout(filepath.Join(m, it.Name())) {
				voegToe(filepath.Join(m, it.Name()))
			}
		}
	}
	return uit
}

func vindEaRepo(cfg eaImportConfig, naam string) (EaRepo, bool) {
	for _, r := range zoekEaRepos(cfg.Mappen) {
		if r.Naam == naam {
			return r, true
		}
	}
	return EaRepo{}, false
}

// gitStand vult branch, commit en het aantal lokale wijzigingen (best effort).
func gitStand(ctx context.Context, r *EaRepo) {
	if uit, err := exec.CommandContext(ctx, "git", "-C", r.Map, "rev-parse", "--abbrev-ref", "HEAD").Output(); err == nil {
		r.Branch = strings.TrimSpace(string(uit))
	}
	if uit, err := exec.CommandContext(ctx, "git", "-C", r.Map, "rev-parse", "--short", "HEAD").Output(); err == nil {
		r.Commit = strings.TrimSpace(string(uit))
	}
	if uit, err := exec.CommandContext(ctx, "git", "-C", r.Map, "status", "--porcelain").Output(); err == nil {
		if t := strings.TrimSpace(string(uit)); t != "" {
			r.Wijzigingen = strings.Count(t, "\n") + 1
		} else {
			r.Wijzigingen = 0
		}
	}
}

// EaBestand is een EA-bestand in een repo.
type EaBestand struct {
	Pad       string    `json:"pad"` // relatief, met "/"
	Grootte   int64     `json:"grootte"`
	Gewijzigd time.Time `json:"gewijzigd"`
}

const (
	eaBestandenMax   = 500
	eaBestandenDiept = 8
)

var eaOverslaanMappen = map[string]bool{".git": true, "node_modules": true, ".venv": true, "__pycache__": true}

// zoekEaBestanden: .qea/.qeax in de repo (niet in .git/node_modules, tot 8 diep, max 500),
// nieuwste eerst. Zuiver op het bestandssysteem.
func zoekEaBestanden(repoMap string) []EaBestand {
	var uit []EaBestand
	_ = filepath.WalkDir(repoMap, func(pad string, d fs.DirEntry, err error) error {
		if err != nil {
			return nil
		}
		rel, _ := filepath.Rel(repoMap, pad)
		if d.IsDir() {
			if pad != repoMap && (eaOverslaanMappen[d.Name()] || strings.Count(rel, string(filepath.Separator)) >= eaBestandenDiept) {
				return filepath.SkipDir
			}
			return nil
		}
		ext := strings.ToLower(filepath.Ext(d.Name()))
		if ext != ".qea" && ext != ".qeax" {
			return nil
		}
		info, ierr := d.Info()
		if ierr != nil {
			return nil
		}
		uit = append(uit, EaBestand{Pad: filepath.ToSlash(rel), Grootte: info.Size(), Gewijzigd: info.ModTime()})
		if len(uit) >= eaBestandenMax {
			return fs.SkipAll
		}
		return nil
	})
	sort.SliceStable(uit, func(i, j int) bool { return uit[i].Gewijzigd.After(uit[j].Gewijzigd) })
	return uit
}

// eaBestandInRepo: alleen een bestand dat de zoektocht zelf vindt, telt (geen eigen paden uit de UI).
func eaBestandInRepo(repo EaRepo, pad string) (string, bool) {
	pad = filepath.ToSlash(strings.TrimSpace(pad))
	if pad == "" {
		return "", false
	}
	for _, b := range zoekEaBestanden(repo.Map) {
		if b.Pad == pad {
			return filepath.Join(repo.Map, filepath.FromSlash(b.Pad)), true
		}
	}
	return "", false
}

// ── Taken ────────────────────────────────────────────────────────────

// EaImportTaak is de stand van één sidecar-run (in het geheugen van dit proces).
type EaImportTaak struct {
	ID                   string          `json:"id"`
	ProjectID            string          `json:"projectId"`
	Status               string          `json:"status"` // bezig | klaar | fout
	Repo                 string          `json:"repo"`
	Bestand              string          `json:"bestand"`
	Pakket               string          `json:"pakket"`
	Map                  string          `json:"map,omitempty"`
	Pull                 bool            `json:"pull"`
	VerdwenenVerwijderen bool            `json:"verdwenenVerwijderen"`
	Droog                bool            `json:"droog"`
	Actor                string          `json:"actor,omitempty"`
	Gestart              time.Time       `json:"gestart"`
	Klaar                *time.Time      `json:"klaar,omitempty"`
	Branch               string          `json:"branch,omitempty"`
	Commit               string          `json:"commit,omitempty"`
	Verslag              json.RawMessage `json:"verslag,omitempty"`
	Fout                 string          `json:"fout,omitempty"`
	Log                  string          `json:"log,omitempty"`
}

var (
	eaImportMu      sync.Mutex
	eaImportTaken   = map[string]*EaImportTaak{}
	eaImportLaatste = map[string]string{} // projectId → taak-id
	eaImportBezig   = map[string]bool{}   // projectId → loopt er een taak
)

const eaImportMaxTaken = 200

func nieuwEaImportTaakID() string {
	b := make([]byte, 8)
	if _, err := rand.Read(b); err != nil {
		return fmt.Sprintf("t-%d", time.Now().UnixNano())
	}
	return hex.EncodeToString(b)
}

// eaImportRunner voert de taak uit (injecteerbaar voor tests): git pull (optioneel) + node-sidecar.
// Geeft het JSON-verslag (stdout), de logtekst (stderr + git), branch en commit.
var eaImportRunner = voerEaImportUit

// eaImportProjectBestaat kijkt of het project op de server staat (injecteerbaar voor tests).
var eaImportProjectBestaat = func(ctx context.Context, id string) (bool, error) {
	_, err := leesStudioProject(ctx, DB, id)
	if errors.Is(err, sql.ErrNoRows) {
		return false, nil
	}
	return err == nil, err
}

const eaImportTimeout = 30 * time.Minute

func staartVan(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return "…" + s[len(s)-n:]
}

func voerEaImportUit(ctx context.Context, t *EaImportTaak, repo EaRepo, qeaPad string, cfg eaImportConfig, token string) (verslag []byte, logTekst, branch, commit string, err error) {
	var logb strings.Builder
	if t.Pull {
		pull := exec.CommandContext(ctx, "git", "-C", repo.Map, "pull", "--ff-only")
		uit, perr := pull.CombinedOutput()
		logb.WriteString("$ git pull --ff-only\n")
		logb.Write(uit)
		if perr != nil {
			return nil, logb.String(), "", "", fmt.Errorf("git pull mislukt: %w", perr)
		}
	}
	gitStand(ctx, &repo)
	branch, commit = repo.Branch, repo.Commit
	if repo.Wijzigingen > 0 {
		fmt.Fprintf(&logb, "(let op: %d lokale wijziging(en) in de checkout; gelezen zoals het bestand nu op schijf staat)\n", repo.Wijzigingen)
	}
	args := []string{"--import", "./test/register-aliases.mjs", "scripts/importeer-qea.mjs",
		"--qea", qeaPad, "--pakket", t.Pakket, "--project", t.ProjectID}
	if t.Map != "" {
		args = append(args, "--map", t.Map)
	}
	if t.VerdwenenVerwijderen {
		args = append(args, "--verdwenen-verwijderen")
	}
	if t.Droog {
		args = append(args, "--droog")
	}
	cmd := exec.CommandContext(ctx, cfg.Node, args...)
	cmd.Dir = cfg.Dir
	env := append(os.Environ(), "OMNIUM_API="+cfg.API, "OMNIUM_GEBRUIKER=", "OMNIUM_WACHTWOORD=")
	if token != "" {
		env = append(env, "OMNIUM_TOKEN="+token)
	}
	cmd.Env = env
	var stdout, stderr bytes.Buffer
	cmd.Stdout, cmd.Stderr = &stdout, &stderr
	rerr := cmd.Run()
	logb.WriteString("$ node importeer-qea.mjs …\n")
	logb.Write(stderr.Bytes())
	if rerr != nil {
		return nil, logb.String(), branch, commit, fmt.Errorf("sidecar mislukt: %w", rerr)
	}
	uit := bytes.TrimSpace(stdout.Bytes())
	if !json.Valid(uit) {
		return nil, logb.String() + "\n" + staartVan(string(uit), 2000), branch, commit, errors.New("sidecar gaf geen JSON-verslag")
	}
	return uit, logb.String(), branch, commit, nil
}

// startEaImportTaak registreert en start een taak; `false` als er al een loopt voor dit project.
func startEaImportTaak(t *EaImportTaak, repo EaRepo, qeaPad string, cfg eaImportConfig, token string) bool {
	eaImportMu.Lock()
	if eaImportBezig[t.ProjectID] {
		eaImportMu.Unlock()
		return false
	}
	eaImportBezig[t.ProjectID] = true
	t.ID = nieuwEaImportTaakID()
	t.Status = "bezig"
	t.Gestart = time.Now()
	eaImportTaken[t.ID] = t
	eaImportLaatste[t.ProjectID] = t.ID
	if len(eaImportTaken) > eaImportMaxTaken {
		var oudste *EaImportTaak
		for _, x := range eaImportTaken {
			if x.Status != "bezig" && (oudste == nil || x.Gestart.Before(oudste.Gestart)) {
				oudste = x
			}
		}
		if oudste != nil {
			delete(eaImportTaken, oudste.ID)
		}
	}
	eaImportMu.Unlock()

	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), eaImportTimeout)
		defer cancel()
		verslag, logTekst, branch, commit, err := eaImportRunner(ctx, t, repo, qeaPad, cfg, token)
		nu := time.Now()
		eaImportMu.Lock()
		t.Klaar = &nu
		t.Branch, t.Commit = branch, commit
		t.Log = staartVan(logTekst, 8000)
		if err != nil {
			t.Status = "fout"
			t.Fout = err.Error()
		} else {
			t.Status = "klaar"
			t.Verslag = verslag
		}
		delete(eaImportBezig, t.ProjectID)
		eaImportMu.Unlock()
	}()
	return true
}

// ── Invoer ───────────────────────────────────────────────────────────

type eaImportInvoer struct {
	Repo                 string `json:"repo"`
	Bestand              string `json:"bestand"`
	Pakket               string `json:"pakket"`
	Map                  string `json:"map"`
	Pull                 *bool  `json:"pull"`
	VerdwenenVerwijderen bool   `json:"verdwenenVerwijderen"`
	Droog                bool   `json:"droog"`
}

var eaArgVeilig = regexp.MustCompile(`^[^-\x00-\x1f]`)

// valideerEaImportVelden controleert pakket en map (repo en bestand komen uit de zoektocht). "" = goed.
func valideerEaImportVelden(in *eaImportInvoer) string {
	in.Pakket = strings.TrimSpace(in.Pakket)
	if in.Pakket == "" || len(in.Pakket) > 500 || !eaArgVeilig.MatchString(in.Pakket) {
		return "Veld 'pakket' ontbreekt of is ongeldig (Package_ID of pad zoals 'Model / Zandbak MW')."
	}
	in.Map = strings.TrimSpace(in.Map)
	if len(in.Map) > 500 || (in.Map != "" && !eaArgVeilig.MatchString(in.Map)) {
		return "Veld 'map' is te lang of ongeldig."
	}
	return ""
}

// ── Handlers ─────────────────────────────────────────────────────────

// MaakStudioEaImportReposHandler — GET /api/studio/ea-import/repos
func MaakStudioEaImportReposHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		cfg := leesEaImportConfig()
		repos := zoekEaRepos(cfg.Mappen)
		ctx, cancel := context.WithTimeout(c.Request.Context(), 20*time.Second)
		defer cancel()
		// Parallel: per repo drie git-aanroepen; na elkaar duurde dat bij 16 repo's seconden.
		var wg sync.WaitGroup
		for i := range repos {
			wg.Add(1)
			go func(r *EaRepo) {
				defer wg.Done()
				gitStand(ctx, r)
			}(&repos[i])
		}
		wg.Wait()
		if repos == nil {
			repos = []EaRepo{}
		}
		c.JSON(http.StatusOK, gin.H{"repos": repos, "pull": cfg.Pull, "ingericht": len(cfg.Mappen) > 0})
	}
}

// MaakStudioEaImportBestandenHandler — GET /api/studio/ea-import/repos/:repo/bestanden
func MaakStudioEaImportBestandenHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		repo, ok := vindEaRepo(leesEaImportConfig(), c.Param("repo"))
		if !ok {
			c.JSON(http.StatusNotFound, gin.H{"error": "Onbekende repo."})
			return
		}
		lijst := zoekEaBestanden(repo.Map)
		if lijst == nil {
			lijst = []EaBestand{}
		}
		c.JSON(http.StatusOK, lijst)
	}
}

type eaPakkettenCacheRij struct {
	mtime time.Time
	size  int64
	data  json.RawMessage
}

var (
	eaPakkettenCacheMu sync.Mutex
	eaPakkettenCache   = map[string]eaPakkettenCacheRij{}
)

// eaImportPakkettenLezer leest de pakketlijst van een bestand (injecteerbaar): node … --lijst-pakketten --json
var eaImportPakkettenLezer = func(ctx context.Context, qeaPad string, cfg eaImportConfig) (json.RawMessage, error) {
	cmd := exec.CommandContext(ctx, cfg.Node, "--import", "./test/register-aliases.mjs", "scripts/importeer-qea.mjs",
		"--qea", qeaPad, "--lijst-pakketten", "--json")
	cmd.Dir = cfg.Dir
	var stdout, stderr bytes.Buffer
	cmd.Stdout, cmd.Stderr = &stdout, &stderr
	if err := cmd.Run(); err != nil {
		return nil, fmt.Errorf("%w: %s", err, staartVan(stderr.String(), 500))
	}
	uit := bytes.TrimSpace(stdout.Bytes())
	if !json.Valid(uit) {
		return nil, errors.New("sidecar gaf geen JSON")
	}
	return uit, nil
}

// MaakStudioEaImportPakkettenHandler — GET /api/studio/ea-import/repos/:repo/pakketten?bestand=<pad>
func MaakStudioEaImportPakkettenHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		cfg := leesEaImportConfig()
		repo, ok := vindEaRepo(cfg, c.Param("repo"))
		if !ok {
			c.JSON(http.StatusNotFound, gin.H{"error": "Onbekende repo."})
			return
		}
		qeaPad, ok := eaBestandInRepo(repo, c.Query("bestand"))
		if !ok {
			c.JSON(http.StatusNotFound, gin.H{"error": "Dat EA-bestand staat niet in deze repo."})
			return
		}
		st, err := os.Stat(qeaPad)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "EA-bestand niet leesbaar."})
			return
		}
		eaPakkettenCacheMu.Lock()
		rij, hit := eaPakkettenCache[qeaPad]
		eaPakkettenCacheMu.Unlock()
		if hit && rij.mtime.Equal(st.ModTime()) && rij.size == st.Size() {
			c.Data(http.StatusOK, "application/json", rij.data)
			return
		}
		ctx, cancel := context.WithTimeout(c.Request.Context(), 2*time.Minute)
		defer cancel()
		data, lerr := eaImportPakkettenLezer(ctx, qeaPad, cfg)
		if lerr != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Pakketten lezen mislukt: " + lerr.Error()})
			return
		}
		eaPakkettenCacheMu.Lock()
		eaPakkettenCache[qeaPad] = eaPakkettenCacheRij{mtime: st.ModTime(), size: st.Size(), data: data}
		eaPakkettenCacheMu.Unlock()
		c.Data(http.StatusOK, "application/json", data)
	}
}

// MaakStudioEaImportStartHandler — POST /api/studio/projecten/:id/ea-import
func MaakStudioEaImportStartHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		if !studioProjectIDPatroon.MatchString(id) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Ongeldig project-id."})
			return
		}
		cfg := leesEaImportConfig()
		if len(cfg.Mappen) == 0 {
			c.JSON(http.StatusNotImplemented, gin.H{"error": "EA-import via de server is niet ingericht (STUDIO_EA_IMPORT_MAPPEN)."})
			return
		}
		var in eaImportInvoer
		if err := c.ShouldBindJSON(&in); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Ongeldige JSON: " + err.Error()})
			return
		}
		repo, ok := vindEaRepo(cfg, strings.TrimSpace(in.Repo))
		if !ok {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Onbekende repo '" + in.Repo + "'."})
			return
		}
		qeaPad, ok := eaBestandInRepo(repo, in.Bestand)
		if !ok {
			c.JSON(http.StatusBadRequest, gin.H{"error": "EA-bestand '" + in.Bestand + "' staat niet in repo '" + repo.Naam + "'."})
			return
		}
		if msg := valideerEaImportVelden(&in); msg != "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": msg})
			return
		}
		bestaat, berr := eaImportProjectBestaat(c.Request.Context(), id)
		if berr != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Project lezen mislukt: " + berr.Error()})
			return
		}
		if !bestaat {
			c.JSON(http.StatusNotFound, gin.H{"error": "Project niet gevonden op de server (stuur het eerst naar de server)."})
			return
		}
		// De sidecar werkt namens de gebruiker: zelfde claims, eigen token.
		token, actor := "", ""
		if claims := middleware.GetClaims(c); claims != nil {
			actor = claims.Gebruikersnaam
			tok, terr := middleware.GenereerJWT(claims.Gebruikersnaam, claims.Rol, claims.Email)
			if terr != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Kon geen token voor de sidecar maken: " + terr.Error()})
				return
			}
			token = tok
		}
		pull := cfg.Pull
		if in.Pull != nil {
			pull = *in.Pull
		}
		t := &EaImportTaak{ProjectID: id, Repo: repo.Naam, Bestand: filepath.ToSlash(strings.TrimSpace(in.Bestand)), Pakket: in.Pakket,
			Map: in.Map, Pull: pull, VerdwenenVerwijderen: in.VerdwenenVerwijderen, Droog: in.Droog, Actor: actor}
		if !startEaImportTaak(t, repo, qeaPad, cfg, token) {
			c.JSON(http.StatusConflict, gin.H{"error": "Er loopt al een EA-import voor dit project.", "taak": eaImportLaatste[id]})
			return
		}
		c.JSON(http.StatusAccepted, gin.H{"taak": t.ID, "status": t.Status})
	}
}

// MaakStudioEaImportTaakHandler — GET /api/studio/projecten/:id/ea-import[/:taak]
func MaakStudioEaImportTaakHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		if !studioProjectIDPatroon.MatchString(id) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Ongeldig project-id."})
			return
		}
		taakID := c.Param("taak")
		eaImportMu.Lock()
		if taakID == "" {
			taakID = eaImportLaatste[id]
		}
		t, ok := eaImportTaken[taakID]
		var kopie EaImportTaak
		if ok {
			kopie = *t
		}
		eaImportMu.Unlock()
		if !ok || kopie.ProjectID != id {
			c.JSON(http.StatusNotFound, gin.H{"error": "Geen (zo'n) EA-importtaak voor dit project."})
			return
		}
		c.JSON(http.StatusOK, kopie)
	}
}
