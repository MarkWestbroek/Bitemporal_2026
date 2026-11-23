package handlers

// De versiegraaf van de centrale projecten (plan "Sidecar-project" §10, stap 10; Mark 22-11):
// geen stamboom maar een graaf van uitgebrachte versies, liefst lineair, met **onderhoudslijnen**
// en **terugmergen**.
//
// Nummering (voorstel Claude 22-11): een versienummer is uniek per soort. Een nieuwe versie is
//   - **hoofdlijn**: hoger dan alle vorige. Ouder: de hoogste vorige. Alleen vanuit het project
//     dat de hoogste versie uitbracht (de centrale heeft één hoofdproject per soort);
//   - **onderhoud**: een patch op een oudere lijn X.Y die al een uitgebrachte versie heeft, hoger
//     dan de hoogste in die lijn (de hoofdlijn is op 0.5.0, op 0.4 is nog een reparatie nodig →
//     0.4.1). Ouder: de hoogste in die lijn. Mag vanuit een eigen project (een onderhoudsproject,
//     de Studio maakt het met "Onderhoudslijn starten").
// Een nieuwe minor of major onder de hoofdlijn bestaat niet: een lijn is X.Y, en alleen patches
// komen erbij.
//
// Terugmergen: een versie mag twee ouders noemen (de reparatie 0.4.1 gaat ook mee in 0.6.0, met
// ouders 0.5.0 en 0.4.1). Een ouder moet bestaan en lager zijn dan de nieuwe versie.

import "fmt"

const (
	LijnHoofd     = "hoofd"
	LijnOnderhoud = "onderhoud"
)

// lijnSleutel: "X.Y" van een versie.
func lijnSleutel(v string) string {
	p, _ := parseSemver(v)
	return fmt.Sprintf("%d.%d", p[0], p[1])
}

// beoordeelNieuweVersie: op welke lijn komt `nieuw`, en wat is zijn standaardouder. reden is
// leeg als het mag, anders "bestaat" of "versie_niet_hoger" (met een melding). Zuiver.
func beoordeelNieuweVersie(nieuw string, bestaand []string) (lijn, standaardOuder, reden, melding string) {
	for _, v := range bestaand {
		if v == nieuw {
			return "", "", "versie_niet_hoger", fmt.Sprintf("Versie %s is al uitgebracht.", nieuw)
		}
	}
	hoogste := hoogsteVersie(bestaand)
	if hoogste == "" || vergelijkSemver(nieuw, hoogste) > 0 {
		return LijnHoofd, hoogste, "", ""
	}
	lijnKey := lijnSleutel(nieuw)
	inLijn := []string{}
	for _, v := range bestaand {
		if lijnSleutel(v) == lijnKey {
			inLijn = append(inLijn, v)
		}
	}
	if len(inLijn) == 0 {
		return "", "", "versie_niet_hoger", fmt.Sprintf("Versie %s is niet hoger dan de laatst uitgebrachte (%s), en lijn %s.x heeft nog geen versie: een onderhoudslijn begint bij een uitgebrachte versie.", nieuw, hoogste, lijnKey)
	}
	top := hoogsteVersie(inLijn)
	if vergelijkSemver(nieuw, top) <= 0 {
		return "", "", "versie_niet_hoger", fmt.Sprintf("Versie %s is niet hoger dan de hoogste in lijn %s.x (%s).", nieuw, lijnKey, top)
	}
	return LijnOnderhoud, top, "", ""
}

// controleerOuders: bestaan ze, zijn ze lager dan de nieuwe versie, hooguit twee, geen dubbele.
// "" = goed. Zuiver.
func controleerOuders(nieuw string, ouders []string, bestaat map[string]bool) string {
	if len(ouders) > 2 {
		return "Hooguit twee ouders (een opvolger, of een merge van twee lijnen)."
	}
	gezien := map[string]bool{}
	for _, o := range ouders {
		if !bestaat[o] {
			return fmt.Sprintf("Ouder %q is geen uitgebrachte versie.", o)
		}
		if gezien[o] {
			return fmt.Sprintf("Ouder %q staat er twee keer.", o)
		}
		gezien[o] = true
		if vergelijkSemver(o, nieuw) >= 0 {
			return fmt.Sprintf("Ouder %s is niet lager dan %s.", o, nieuw)
		}
	}
	return ""
}
