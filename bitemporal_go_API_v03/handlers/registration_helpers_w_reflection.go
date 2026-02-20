package handlers

import (
	"reflect"
	"strings"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemporal_go_API_v03/model"
)

type formeleRepresentatiePlusNaam struct {
	Naam          string
	Representatie model.FormeleRepresentatie
}

// codex gegenereerde code om alle onderliggende representaties van een entiteit te verzamelen,
// op basis van reflectie.
// input is wel alleen nog de formele representatie, dus niet materieel.
// maar misschien gooien we deze code wel weg...
// zie registration_helpers_w_reflection.md voor uitleg en overwegingen.
func verzamelOnderliggendeRepresentatiesMbvReflectie(entiteit model.FormeleRepresentatie) ([]formeleRepresentatiePlusNaam, error) {
	waarde := reflect.ValueOf(entiteit) //haalt de concrete struct uit de interface, zeg maar
	for waarde.Kind() == reflect.Ptr {
		if waarde.IsNil() {
			return nil, nil
		}
		waarde = waarde.Elem()
	}

	if waarde.Kind() != reflect.Struct {
		return nil, nil
	}

	resultaat := make([]formeleRepresentatiePlusNaam, 0)
	for i := 0; i < waarde.NumField(); i++ {
		veld := waarde.Field(i)
		if veld.Kind() != reflect.Slice && veld.Kind() != reflect.Array {
			continue
		}

		for j := 0; j < veld.Len(); j++ {
			kindWaarde := veld.Index(j)
			kindRep, ok := castWaardeNaarFormeleRepresentatie(kindWaarde)
			if !ok {
				continue
			}

			// zie functie: gaat eigenlijk maar toevallig goed.
			if err := zetEntiteitIDOpKindAlsLeeg(entiteit, kindRep); err != nil {
				return nil, err
			}

			resultaat = append(resultaat, formeleRepresentatiePlusNaam{
				Naam:          representatienaamVoor(kindRep),
				Representatie: kindRep,
			})

			// recursie: wel mooi!
			// al komt dit in de huidige metamodelstructuur niet voor
			// gegevenselementen hebben geen onderliggende gegevenselementen meer
			// maar misschien gaat dit toch wel nodig zijn. We gaan het zien.
			if kindRep.Metatype() == model.MetatypeEntiteit {
				nested, err := verzamelOnderliggendeRepresentatiesMbvReflectie(kindRep)
				if err != nil {
					return nil, err
				}
				resultaat = append(resultaat, nested...)
			}
		}
	}

	return resultaat, nil
}

func castWaardeNaarFormeleRepresentatie(waarde reflect.Value) (model.FormeleRepresentatie, bool) {
	if !waarde.IsValid() {
		return nil, false
	}

	if waarde.Kind() == reflect.Ptr && waarde.IsNil() {
		return nil, false
	}

	if waarde.CanInterface() {
		if rep, ok := waarde.Interface().(model.FormeleRepresentatie); ok {
			return rep, true
		}
	}

	// Second attempt: take the address of the value to check if *T implements the interface.
	// Covers types that use pointer receivers. See registration_helpers_w_reflection.md for full explanation.
	if waarde.Kind() != reflect.Ptr && waarde.CanAddr() {
		if rep, ok := waarde.Addr().Interface().(model.FormeleRepresentatie); ok {
			return rep, true
		}
	}

	return nil, false
}

// doet iets magisch met de entiteitnaam + _ID om de relatienaam naar de entiteit te construeren.
// eigenlijk is dit op dit punt nog niet relevant, omdat de struct die relatie ook helemaal niet nodig heeft
// de struct is eigenlijk het UML model, en daarin zitten geen FK's...
// Verder gaat dit eigenlijk maar toevallig goed omdat ik dat standaard zo doe (A_ID. B_ID).
// Dat is geen regel, dus misschien moeten we dit toch anders doen,
// bijvoorbeeld via struct tags of via de metamap.
func zetEntiteitIDOpKindAlsLeeg(entiteit model.FormeleRepresentatie, kind model.FormeleRepresentatie) error {
	entiteitID, ok := anyNaarInt(entiteit.GetID())
	if !ok {
		return nil
	}

	kindWaarde := reflect.ValueOf(kind)
	if kindWaarde.Kind() != reflect.Ptr || kindWaarde.IsNil() {
		return nil
	}

	kindElem := kindWaarde.Elem()
	if kindElem.Kind() != reflect.Struct {
		return nil
	}

	entiteitCode := strings.ToUpper(representatieCode(entiteit))
	fkVeld := kindElem.FieldByName(entiteitCode + "_ID")
	if !fkVeld.IsValid() || !fkVeld.CanSet() {
		return nil
	}

	switch fkVeld.Kind() {
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
		if fkVeld.Int() == 0 {
			fkVeld.SetInt(int64(entiteitID))
		}
	}

	return nil
}

func representatienaamVoor(rep model.FormeleRepresentatie) string {
	return representatieCode(rep)
}

func representatieCode(rep any) string {
	t := reflect.TypeOf(rep)
	for t.Kind() == reflect.Ptr {
		t = t.Elem()
	}
	naam := t.Name()
	if strings.HasPrefix(naam, "Full_") {
		return strings.TrimPrefix(naam, "Full_")
	}
	return naam
}
