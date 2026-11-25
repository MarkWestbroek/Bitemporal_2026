package middleware

// schrijffilter.go — schrijffilter per account (besluit Mark 25-11-2026).
//
// Een serviceaccount (bv. het account van de inrichtingssite, omnium-koppelaar) heeft de rol
// bouwer nodig om te registreren, maar mag daarmee alleen een paar typen schrijven. De lijst
// staat in de omgevingsvariabele REGISTRATIE_SCHRIJFFILTER:
//
//	REGISTRATIE_SCHRIJFFILTER="omnium-koppelaar=koppeling*,component*,omgeving*,edienstversiekoppeling"
//
// Meerdere accounts scheid je met ';'. Een patroon is een typenaam (hoofdletterongevoelig) of
// een voorvoegsel met '*' aan het eind. Een account in deze lijst:
//   - mag alleen registreren via POST /registratie/ (ControleerRol weigert elke andere route die
//     meer dan de rol lezer vraagt: PATCH /registraties, de schema-routes, uploads, GraphQL-
//     mutaties, de gegenereerde POST/DELETE-routes, de EA-import, …);
//   - mag in een registratie alleen typen raken die op een patroon passen, bij opvoer, afvoer,
//     correctie én ongedaanmaking (handlers/registration_schrijffilter.go).
// Lezen blijft zoals de rol het toestaat. Accounts die niet in de lijst staan, merken niets.
// Wijzigen vraagt een herstart van de API. Zie docs/AUTH_DEVELOPER_GUIDE.md §Schrijffilter.

import (
	"context"
	"fmt"
	"os"
	"sort"
	"strings"
	"sync"
)

// SchrijffilterEnv is de naam van de omgevingsvariabele met het schrijffilter.
const SchrijffilterEnv = "REGISTRATIE_SCHRIJFFILTER"

// SchrijffilterRoute is de enige schrijfroute voor een account met een schrijffilter.
const SchrijffilterRoute = "/registratie/"

var (
	schrijffilterMu    sync.Mutex
	schrijffilterBron  string
	schrijffilterCache map[string][]string
	schrijffilterFout  error
)

// ParseSchrijffilter leest de waarde van REGISTRATIE_SCHRIJFFILTER: account → patronen (beide
// in kleine letters). Een fout (account zonder '=' of zonder patronen, leeg patroon, '*' midden
// in een patroon, een account dubbel) maakt het hele filter ongeldig.
func ParseSchrijffilter(waarde string) (map[string][]string, error) {
	uit := map[string][]string{}
	for _, deel := range strings.Split(waarde, ";") {
		deel = strings.TrimSpace(deel)
		if deel == "" {
			continue
		}
		account, lijst, ok := strings.Cut(deel, "=")
		account = strings.ToLower(strings.TrimSpace(account))
		if !ok || account == "" {
			return nil, fmt.Errorf("%s: %q is geen 'account=patroon,patroon'", SchrijffilterEnv, deel)
		}
		if _, dubbel := uit[account]; dubbel {
			return nil, fmt.Errorf("%s: account %q staat er twee keer in", SchrijffilterEnv, account)
		}
		var patronen []string
		for _, p := range strings.Split(lijst, ",") {
			p = strings.ToLower(strings.TrimSpace(p))
			if p == "" {
				continue
			}
			if i := strings.Index(p, "*"); i >= 0 && i != len(p)-1 {
				return nil, fmt.Errorf("%s: patroon %q: '*' mag alleen aan het eind", SchrijffilterEnv, p)
			}
			if p == "*" {
				return nil, fmt.Errorf("%s: patroon '*' voor %q laat alles toe; haal het account dan uit de lijst", SchrijffilterEnv, account)
			}
			patronen = append(patronen, p)
		}
		if len(patronen) == 0 {
			return nil, fmt.Errorf("%s: account %q heeft geen patronen", SchrijffilterEnv, account)
		}
		uit[account] = patronen
	}
	return uit, nil
}

// huidigSchrijffilter geeft het filter uit de omgeving (gecachet per waarde). Bij een ongeldige
// waarde: de fout. Wie in een ongeldig filter staat, mag dan niets schrijven (fail-closed), zie
// SchrijffilterVoor.
func huidigSchrijffilter() (map[string][]string, string, error) {
	waarde := os.Getenv(SchrijffilterEnv)
	schrijffilterMu.Lock()
	defer schrijffilterMu.Unlock()
	if schrijffilterCache == nil || waarde != schrijffilterBron {
		schrijffilterBron = waarde
		schrijffilterCache, schrijffilterFout = ParseSchrijffilter(waarde)
		if schrijffilterCache == nil {
			schrijffilterCache = map[string][]string{}
		}
	}
	return schrijffilterCache, waarde, schrijffilterFout
}

// SchrijffilterVoor geeft de patronen van een account en of het een schrijffilter heeft. Is de
// omgevingsvariabele ongeldig, dan heeft een account dat er (letterlijk) in genoemd wordt een
// filter zonder patronen: het mag niets schrijven tot de waarde is hersteld.
func SchrijffilterVoor(gebruikersnaam string) ([]string, bool) {
	naam := strings.ToLower(strings.TrimSpace(gebruikersnaam))
	if naam == "" {
		return nil, false
	}
	filter, ruw, err := huidigSchrijffilter()
	if err != nil {
		if strings.Contains(strings.ToLower(ruw), naam+"=") {
			return []string{}, true
		}
		return nil, false
	}
	p, ok := filter[naam]
	return p, ok
}

// TypeToegestaan zegt of een typenaam op een van de patronen past (hoofdletterongevoelig;
// 'koppeling*' = elk type dat met koppeling begint).
func TypeToegestaan(patronen []string, typenaam string) bool {
	t := strings.ToLower(typenaam)
	for _, p := range patronen {
		if strings.HasSuffix(p, "*") {
			if strings.HasPrefix(t, strings.TrimSuffix(p, "*")) {
				return true
			}
		} else if t == p {
			return true
		}
	}
	return false
}

// SchrijffilterUitContext geeft het schrijffilter van de ingelogde aanroeper. Geen filter bij
// auth uit (dev), een systeemaanroep of een account dat niet in de lijst staat.
func SchrijffilterUitContext(ctx context.Context) (account string, patronen []string, beperkt bool) {
	if !IsAuthEnabled() {
		return "", nil, false
	}
	if systeem, _ := ctx.Value(systeemSleutel{}).(bool); systeem {
		return "", nil, false
	}
	claims := ClaimsUitContext(ctx)
	if claims == nil {
		return "", nil, false
	}
	p, ok := SchrijffilterVoor(claims.Gebruikersnaam)
	return claims.Gebruikersnaam, p, ok
}

// BeschrijfSchrijffilter is de opstartregel: welke accounts welk filter hebben, of de fout.
// typen (de typenamen van het model; mag leeg zijn) dient om patronen te melden waar geen type op past.
func BeschrijfSchrijffilter(typen []string) string {
	filter, ruw, err := huidigSchrijffilter()
	if strings.TrimSpace(ruw) == "" {
		return ""
	}
	if err != nil {
		return fmt.Sprintf("FOUT schrijffilter: %v — genoemde accounts mogen niets schrijven", err)
	}
	accounts := make([]string, 0, len(filter))
	for a := range filter {
		accounts = append(accounts, a)
	}
	sort.Strings(accounts)
	var regels []string
	for _, a := range accounts {
		regel := fmt.Sprintf("schrijffilter: %s mag alleen %s schrijven (via %s)", a, strings.Join(filter[a], ", "), SchrijffilterRoute)
		var leeg []string
		for _, p := range filter[a] {
			past := false
			for _, t := range typen {
				if TypeToegestaan([]string{p}, t) {
					past = true
					break
				}
			}
			if !past {
				leeg = append(leeg, p)
			}
		}
		if len(typen) > 0 && len(leeg) > 0 {
			regel += fmt.Sprintf("; LET OP: geen type in het model past op %s", strings.Join(leeg, ", "))
		}
		regels = append(regels, regel)
	}
	return strings.Join(regels, "\n")
}
