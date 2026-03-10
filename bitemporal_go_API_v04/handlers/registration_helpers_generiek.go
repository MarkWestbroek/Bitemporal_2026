package handlers

import (
	"database/sql"
	"fmt"
	"reflect"
	"strconv"
	"strings"

	"time"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemporal_go_API_v04/model"
	"github.com/gin-gonic/gin"
	"github.com/uptrace/bun"
)

/*
===================== GENERIEK===========================
*/

// handleRepresentatieOpvoerMetReflectie inserts an opvoer representatie and creates a wijziging record.
// het gebruikt de vrij verbose reflectie code die Codex geschreven heeft...
func handleRepresentatieOpvoerMetReflectie(c *gin.Context, tx bun.Tx, registratie model.Registratie,
	representatienaam string, representatie model.FormeleRepresentatie) error {

	/*
		* Scenario 1: Opvoer van hele entiteit met eventueel onderliggende gegevenselementen en/of relaties
		- eerst entiteit opvoeren met het bijbehehorende wijziging record
		- itereren over onderliggende gegevenselementen/relaties en die ook opvoeren (met eigen wijziging records)
		- N.B. : refereren aan de ID van de entiteit (TODO method maken SetEntiteitID) in de gegevenselementen/relaties, zodat die automatisch goed komt te staan in de database

		* Scenario 2: Opvoer van individuele gegevenselementen/relaties
		- alleen dat gegevenselement/relatie opvoeren, zonder dat de hele entiteit wordt aangeraakt
		- ook hier moet een wijziging record worden gemaakt
	*/

	// dit is de basis insert van 1 element, maar relaties gaan niet vanzelf mee, dus die moeten we apart behandelen (zie handleOpvoerA en handleOpvoerB)
	// ook moet er per gegevenselement/relatie een wijziging record worden gemaakt,
	//  dus dat doen we ook niet automatisch in de database, maar apart in de code (zie handleOpvoerElement)
	representatie.SetOpvoer(&registratie.Tijdstip)

	// insert de top level representatie, dat moet namelijk sowieso
	// Interessant: autoincrement ID's worden automatisch teruggezet in de struct,
	// dus die kunnen we daarna gebruiken  voor de onderliggende gegevenselementen/relaties
	_, err := tx.NewInsert().
		Model(representatie).
		Exec(c.Request.Context())
	if err != nil {
		return fmt.Errorf("HANDLER: failed to insert %s: %v", representatienaam, err)
	}

	// indien entiteit, behandel ook alle onderliggende gegevenselementen/relaties
	if representatie.Metatype() == model.MetatypeEntiteit {
		// dit kinderen verzamelen gaat via reflectie
		kinderen, err := verzamelOnderliggendeRepresentatiesMbvReflectie(representatie)
		if err != nil {
			return fmt.Errorf("HANDLER: kon onderliggende representaties van %s niet bepalen: %v", representatienaam, err)
		}

		for _, kind := range kinderen {
			if err := handleRepresentatieOpvoerMetReflectie(c, tx, registratie, kind.Naam, kind.Representatie); err != nil {
				return err
			}
		}
	}

	// Maak wijziging record aan
	return persisteerWijziging(c, tx, model.WijzigingstypeOpvoer, registratie.ID,
		representatienaam, fmt.Sprint(representatie.GetID()), representatienaam, fmt.Sprint(representatie.GetID()), registratie.Tijdstip)
}

/*
==== STANDAARD OPVOER ROUTINE ======

handleRepresentatieOpvoerMeta verwerkt opvoer via de metaregistry, zonder reflectie.
*/
func handleRepresentatieOpvoerMeta(c *gin.Context, tx bun.Tx, registratie model.Registratie,
	entiteitnaam string, entiteitID string, representatienaam string, representatie model.FormeleRepresentatie) error {
	meta, ok := model.MetaRegistry.GetTypeMeta(representatienaam)
	if !ok {
		return fmt.Errorf("HANDLER: onbekend type voor opvoer: %s", representatienaam)
	}

	/*
		Eerste check moet zijn of het een correctie betreft. (N.B> dit is de opvoer routine)

		Indien correctie:
		- Indien Entiteit: dan betekent dat dit de betreffende entiteit is,
			waarvan onderliggende gegevenselementen/relaties worden gecorrigeerd,
			maar die zelf niet wordt gecorrigeerd (m.u.v. materiele tijd, maar dat zit nog niet in deze versie)
		- de gecorrigeeerde rep (altijd een GE of REL trouwens) opzoeken in de DB (op basis van ID in wijziging record)
		- reeds afgevoerd? (want dan mag er niet meer gecorrigeerd worden) -> foutmelding en transactie afbreken
		- de rep afvoeren en wijziging aanmaken voor de afvoer
		- N.B.: de gecorrigeerde rep teruggeven in de response is lastig en doen we nu niet
		- de nieuwe gecorrigeerde rep opvoeren (deze krijgt een nieuw ID!) en wijziging aanmaken voor de opvoer
		- verhaal over enkelvoudige voorgangers gaat ook niet op bij correctie!
	*/

	if debugLogsEnabled() {
		fmt.Printf("HANDLER (meta opvoer): registratietype: %s\n", registratie.Registratietype)
	}

	/* ==== CORRECTIE ---- */
	if registratie.IsCorrectie() && meta.Metatype != model.MetatypeEntiteit {
		// get huidige waarde van het gegevenselement op basis van ID in wijziging record
		huidigeRep, err := haalRepresentatieUitDB(c, tx, meta, representatie.GetID())
		if err != nil {
			return err
		}
		if debugLogsEnabled() {
			fmt.Printf("HANDLER (meta opvoer): correctie: opgehaalde te corrigeren representatie (type=%s, id=%v)\n%s", representatienaam, representatie.GetID(), model.RepresentatieToString(huidigeRep))
		}

		// indien al afgevoerd, dan mag er niet meer gecorrigeerd worden
		if huidigeRep.GetAfvoer() != nil {
			return fmt.Errorf("HANDLER: kan %s met ID %v niet corrigeren, want deze is al afgevoerd op %v", representatienaam, representatie.GetID(), huidigeRep.GetAfvoer())
		}
		// voer huidige representatie af en maak wijziging record aan
		if err := handleRepresentatieAfvoer(c, tx, registratie.ID, registratie.Tijdstip, entiteitnaam, entiteitID, representatienaam, huidigeRep); err != nil {
			return fmt.Errorf("HANDLER: failed to afvoer existing %s for correction: %v", representatienaam, err)
		}
		// voer nieuwe representatie op en maak wijziging record aan
		// -->>> code verderop wordt gebruikt!!!
		// maak wel eerst de ID leeg
		representatie.ClearID() // zorg dat er een nieuwe ID wordt toegekend bij het opvoeren van de gecorrigeerde versie
	}

	/* ======== GEWONE WIJZIGING, GEEN CORRECTIE ===========

	Indien geen entiteit:
	- indien ENKELVOUDIG:
	- 	zoek naar actieve (wel opvoer en geen afvoer) dezelfde gegevenselementen/relaties bij deze entiteit
		(op basis van de ID van de entiteit in het gegevenselement/relatie record)
	- 	als er één is: sluit deze af (update afvoer veld) en maak wijziging record aan
	- 	als er meer dan één is: dat is een fout, want er mag maar één actief gegevenselement/relatie zijn bij enkelvoudig voorkomen
	- -----> foutmelding geven en transactie afbreken.  <------

	- vinden: bovenliggende tabel...
	*/
	// Niet indien correctie
	if registratie.IsRegistratie() && meta.Metatype != model.MetatypeEntiteit && meta.Momentvoorkomen == model.Enkelvoudig {
		if err := sluitActieveEnkelvoudigeVoorgangersAf(c, tx, registratie.ID, registratie.Tijdstip, representatienaam, representatie, meta); err != nil {
			return err
		}
	}

	/* ===== BEIDE, MAAR SKIP DE ENTITEIT BIJ CORRECTIE ========
	Verder is de code voor registratie en correctie gelijk
	*/
	if !(registratie.IsCorrectie() && meta.Metatype == model.MetatypeEntiteit) {
		if meta.Metatype != model.MetatypeEntiteit {
			// Zorg dat we geen gegevenselement/relatie toevoegen aan een afgevoerde entiteit.
			var err error
			entiteitnaam, entiteitID, err = vindEntiteitContext(entiteitnaam, entiteitID, representatienaam, representatie, meta)
			if err != nil {
				return err
			}
			if err := checkBovenliggendeEntiteitActief(c, tx, entiteitnaam, entiteitID); err != nil {
				return err
			}
		}

		representatie.SetOpvoer(&registratie.Tijdstip)
		_, err := tx.NewInsert().
			Model(representatie).
			Exec(c.Request.Context())
		if err != nil {
			return fmt.Errorf("HANDLER: failed to insert %s: %v", representatienaam, err)
		}

		// ** entiteit **
		if meta.Metatype == model.MetatypeEntiteit {
			entiteitnaam = representatienaam
			entiteitID = fmt.Sprint(representatie.GetID())
			if err := persisteerWijziging(c, tx, model.WijzigingstypeOpvoer, registratie.ID,
				representatienaam, fmt.Sprint(representatie.GetID()), "", "", registratie.Tijdstip); err != nil {
				return err
			}
		} else {
			// ** Geen entiteit **
			if err := persisteerWijziging(c, tx, model.WijzigingstypeOpvoer, registratie.ID,
				entiteitnaam, entiteitID, representatienaam, fmt.Sprint(representatie.GetID()), registratie.Tijdstip); err != nil {
				return err
			}
		}
	}

	/*
		RECURSIE: Indien onderliggend gegevenselementen/relaties (typisch bij entiteiten):
	*/
	if meta.Metatype == model.MetatypeEntiteit {
		onderliggendeRepresentaties, ok := representatie.(model.HeeftOnderliggendeGegevenselementen)
		if !ok {
			return fmt.Errorf("HANDLER: voor type %s vind ik geen onderliggende gegevenselementen in de metamap", representatienaam)
		}

		for _, onderliggende := range onderliggendeRepresentaties.GeefOnderliggendeGegevenselementen() {
			if err := handleRepresentatieOpvoerMeta(c, tx, registratie, entiteitnaam, entiteitID, onderliggende.Typenaam, onderliggende.Representatie); err != nil {
				return err
			}
		}
	}
	return nil

}

func handleRepresentatieAfvoer(c *gin.Context, tx bun.Tx, registratieID int64, afvoerTijdstip time.Time,
	entiteitnaam string, entiteitID string, representatienaam string, representatie model.FormeleRepresentatie) error {

	/* Scenario 1: Afvoer van hele entiteit met eventueel onderliggende gegevenselementen en/of relaties
	- eerst 'de entiteit afvoeren' (i.e.: het afgeleide veld "afvoer" UPDATEN in de DB)
	- en het bijbehorende wijziging (afvoer) record maken
	- itereren over onderliggende gegevenselementen/relaties en die ook afvoeren (met eigen wijziging records)

	* Scenario 2: Afvoer van individuele gegevenselementen/relaties
	- alleen dat gegevenselement/relatie afvoeren, zonder dat de hele entiteit wordt aangeraakt
	- ook hier moet een wijziging record worden gemaakt

	- een reeds afgevoerde representatie mag niet nogmaals worden afgevoerd,
		dus eerst wordt gecheckt of deze al is afgevoerd, en indien ja, dan foutmelding en transactie afbreken.

	*/

	meta, ok := model.MetaRegistry.GetTypeMeta(representatienaam)
	if !ok {
		return fmt.Errorf("HANDLER: onbekend type voor afvoer: %s", representatienaam)
	}

	// een reeds afgevoerde representatie mag niet nogmaals worden afgevoerd, dus eerst checken of deze al is afgevoerd, en indien ja, dan foutmelding en transactie afbreken.
	huidigeRep, err := haalRepresentatieUitDB(c, tx, meta, representatie.GetID())
	if err != nil {
		return err
	}
	if huidigeRep.GetAfvoer() != nil {
		return fmt.Errorf("HANDLER: kan %s met ID %v niet afvoeren, want deze is al afgevoerd op %v", representatienaam, representatie.GetID(), huidigeRep.GetAfvoer())
	}

	if meta.Metatype != model.MetatypeEntiteit {
		if err := updateAfvoerByID(c, tx, meta, representatie.GetID(), afvoerTijdstip); err != nil {
			return err
		}

		// vind de bovenliggende entiteit en ID op basis van de representatie en de metamap voor in het wijziging record
		entiteitnaam, entiteitID, err = vindEntiteitContext(entiteitnaam, entiteitID, representatienaam, huidigeRep, meta)
		if err != nil {
			return err
		}

		return persisteerWijziging(c, tx, model.WijzigingstypeAfvoer, registratieID,
			entiteitnaam, entiteitID, representatienaam, fmt.Sprint(representatie.GetID()), afvoerTijdstip)
	}

	entiteitnaam = representatienaam
	entiteitID = fmt.Sprint(representatie.GetID())

	// ENTITEIT AFVOER
	if err := updateAfvoerByID(c, tx, meta, representatie.GetID(), afvoerTijdstip); err != nil {
		return err
	}
	if err := persisteerWijziging(c, tx, model.WijzigingstypeAfvoer, registratieID,
		entiteitnaam, entiteitID, "", "", afvoerTijdstip); err != nil {
		return err
	}

	// nodig omdat nu alle gegevenselementen/relaties van een entiteit een int ID_NAAR_ENTITEIT veld hebben?
	entiteitIDInt, ok := anyNaarInt(representatie.GetID()) // hulpfunctie om de ID als int te krijgen, ongeacht het type
	if !ok {
		return fmt.Errorf("HANDLER: entiteit ID is geen int voor %s", representatienaam)
	}

	// Doorloop onderliggende gegevenselementen/relaties en voer die ook af (recursief)
	for _, rel := range meta.OnderliggendeGegevenselementen {
		childMeta, ok := model.MetaRegistry.GetTypeMeta(rel.Doeltype)
		if !ok {
			return fmt.Errorf("HANDLER: unknown related type: %s", rel.Doeltype)
		}

		fkColumn := childMeta.EntiteitIDKolom
		if fkColumn == "" {
			return fmt.Errorf("HANDLER: no entity id column for %s", childMeta.Typenaam)
		}

		activeIDs, err := haalActieveIDsGegevenselementUitDB(c, tx, childMeta, fkColumn, entiteitIDInt)
		if err != nil {
			return err
		}

		for _, id := range activeIDs {
			if err := updateAfvoerByID(c, tx, childMeta, id, afvoerTijdstip); err != nil {
				return err
			}
			if err := persisteerWijziging(c, tx, model.WijzigingstypeAfvoer, registratieID,
				entiteitnaam, entiteitID, childMeta.Typenaam, fmt.Sprint(id), afvoerTijdstip); err != nil {
				return err
			}
		}
	}

	return nil

}

func updateAfvoerByID(c *gin.Context, tx bun.Tx, meta model.TypeMeta, id any, afvoerTijdstip time.Time) error {
	_, err := tx.NewUpdate().
		Table(meta.Tabelnaam).
		Set("afvoer = ?", afvoerTijdstip).
		Where(fmt.Sprintf("%s = ?", meta.IDKolom), id).
		Exec(c.Request.Context())
	if err != nil {
		return fmt.Errorf("HANDLER: failed to update %s afvoer: %v", meta.Typenaam, err)
	}

	return nil
}

func haalRepresentatieUitDB(c *gin.Context, tx bun.Tx, meta model.TypeMeta, id any) (model.FormeleRepresentatie, error) {
	if isZeroID(id) {
		return nil, fmt.Errorf("HANDLER: lege ID voor %s", meta.Typenaam)
	}
	if meta.DBFactory == nil {
		return nil, fmt.Errorf("HANDLER: DBFactory ontbreekt voor type %s", meta.Typenaam)
	}

	repAny := meta.DBFactory()
	rep, ok := repAny.(model.FormeleRepresentatie)
	if !ok {
		return nil, fmt.Errorf("HANDLER: DBFactory voor type %s levert geen FormeleRepresentatie (kreeg %T)", meta.Typenaam, repAny)
	}

	err := tx.NewSelect().
		Model(rep).
		Where(fmt.Sprintf("%s = ?", meta.IDKolom), id).
		Limit(1).
		Scan(c.Request.Context())
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("HANDLER: geen %s gevonden met %s=%v", meta.Typenaam, meta.IDKolom, id)
		}
		return nil, fmt.Errorf("HANDLER: ophalen van %s met %s=%v mislukt: %v", meta.Typenaam, meta.IDKolom, id, err)
	}

	return rep, nil
}

func haalActieveIDsGegevenselementUitDB(c *gin.Context, tx bun.Tx, meta model.TypeMeta, fkColumn string, entiteitID int) ([]int, error) {
	ids := make([]int, 0)
	query := tx.NewSelect().
		Table(meta.Tabelnaam).
		Column(meta.IDKolom).
		Where(fmt.Sprintf("%s = ?", fkColumn), entiteitID).
		Where("afvoer IS NULL")
	if err := query.Scan(c.Request.Context(), &ids); err != nil && err != sql.ErrNoRows {
		return nil, fmt.Errorf("HANDLER: failed to query active %s records: %v", meta.Typenaam, err)
	}

	return ids, nil
}

/*
===== Maak wijziging aan in wijzigingstabel ======
*/
func persisteerWijziging(c *gin.Context, tx bun.Tx, wijzigingstype model.WijzigingstypeEnum,
	registratieID int64, entiteitnaam string, entiteitID string,
	representatienaam string, representatieID string, registratietijdstip time.Time) error {
	wijziging := model.Wijziging{
		Wijzigingstype:    wijzigingstype,
		RegistratieID:     registratieID,
		Entiteitnaam:      entiteitnaam,
		EntiteitID:        entiteitID,
		Representatienaam: representatienaam,
		RepresentatieID:   representatieID,
		Tijdstip:          registratietijdstip, //afgeleid van registratie tijdstip
	}

	_, err := tx.NewInsert().
		Model(&wijziging).
		Exec(c.Request.Context())
	if err != nil {
		return fmt.Errorf("failed to insert wijziging: %v", err)
	}

	return nil
}

func anyNaarInt(v any) (int, bool) {
	switch value := v.(type) {
	case int:
		return value, true
	case int8:
		return int(value), true
	case int16:
		return int(value), true
	case int32:
		return int(value), true
	case int64:
		return int(value), true
	case uint:
		return int(value), true
	case uint8:
		return int(value), true
	case uint16:
		return int(value), true
	case uint32:
		return int(value), true
	case uint64:
		return int(value), true
	default:
		return 0, false
	}
}

func vindEntiteitContext(entiteitnaam string, entiteitID string, representatienaam string,
	representatie model.FormeleRepresentatie, meta model.TypeMeta) (string, string, error) {
	if entiteitnaam == "" {
		bovenliggendeRelatieMeta, ok := model.MetaRegistry.GetBovenliggendeRelatieMeta(representatienaam)
		if !ok {
			return "", "", fmt.Errorf("HANDLER: geen bovenliggende entiteit gevonden voor type %s", representatienaam)
		}
		entiteitnaam = bovenliggendeRelatieMeta.ParentType.Typenaam
	}

	if entiteitID == "" {
		fkColumn := meta.EntiteitIDKolom
		if fkColumn == "" {
			return "", "", fmt.Errorf("HANDLER: geen entiteit FK-kolom geconfigureerd voor type %s", representatienaam)
		}
		afgeleideEntiteitID, err := haalIntWaardeVoorKolomUitRepresentatie(representatie, fkColumn)
		if err != nil {
			return "", "", fmt.Errorf("HANDLER: kon entiteitID niet afleiden voor %s: %v", representatienaam, err)
		}
		entiteitID = fmt.Sprint(afgeleideEntiteitID)
	}

	return entiteitnaam, entiteitID, nil
}

func checkBovenliggendeEntiteitActief(c *gin.Context, tx bun.Tx, entiteitnaam string, entiteitID string) error {
	entiteitMeta, ok := model.MetaRegistry.GetTypeMeta(entiteitnaam)
	if !ok {
		return fmt.Errorf("HANDLER: geen meta gevonden voor bovenliggende entiteit %s", entiteitnaam)
	}

	var entityIDAny any = entiteitID
	if intID, err := strconv.Atoi(entiteitID); err == nil {
		entityIDAny = intID
	}

	entiteitRep, err := haalRepresentatieUitDB(c, tx, entiteitMeta, entityIDAny)
	if err != nil {
		return err
	}
	if entiteitRep.GetAfvoer() != nil {
		return fmt.Errorf("HANDLER: kan %s niet opvoeren, want bovenliggende entiteit %s met ID %s is afgevoerd op %v", entiteitnaam, entiteitnaam, entiteitID, entiteitRep.GetAfvoer())
	}

	return nil
}

func sluitActieveEnkelvoudigeVoorgangersAf(c *gin.Context, tx bun.Tx, registratieID int64, registratietijdstip time.Time,
	representatienaam string, representatie model.FormeleRepresentatie, meta model.TypeMeta) error {
	if meta.Metatype == model.MetatypeEntiteit || meta.Momentvoorkomen != model.Enkelvoudig {
		return nil
	}

	bovenliggendeRelatieMeta, ok := model.MetaRegistry.GetBovenliggendeRelatieMeta(meta.Typenaam)
	if !ok {
		return fmt.Errorf("HANDLER: geen bovenliggende entiteit gevonden voor type %s", representatienaam)
	}

	fkColumn := meta.EntiteitIDKolom
	if fkColumn == "" {
		return fmt.Errorf("HANDLER: geen entiteit FK-kolom geconfigureerd voor type %s", representatienaam)
	}

	entiteitID, err := haalIntWaardeVoorKolomUitRepresentatie(representatie, fkColumn)
	if err != nil {
		return fmt.Errorf("HANDLER: kon bovenliggende %s id niet bepalen voor %s: %v", bovenliggendeRelatieMeta.ParentType.Typenaam, representatienaam, err)
	}
	if entiteitID == 0 {
		return fmt.Errorf("HANDLER: bovenliggende %s id ontbreekt voor %s", bovenliggendeRelatieMeta.ParentType.Typenaam, representatienaam)
	}

	activeIDs, err := haalActieveIDsGegevenselementUitDB(c, tx, meta, fkColumn, entiteitID)
	if err != nil {
		return err
	}

	if len(activeIDs) > 1 {
		return fmt.Errorf("HANDLER: meerdere actieve %s records gevonden voor %s=%d (enkelvoudig verwacht)",
			representatienaam, fkColumn, entiteitID)
	}

	for _, id := range activeIDs {
		if err := updateAfvoerByID(c, tx, meta, id, registratietijdstip); err != nil {
			return err
		}
		if err := persisteerWijziging(c, tx, model.WijzigingstypeAfvoer, registratieID,
			bovenliggendeRelatieMeta.ParentType.Typenaam, fmt.Sprint(entiteitID), representatienaam, fmt.Sprint(id), registratietijdstip); err != nil {
			return err
		}
	}

	return nil
}

func haalIntWaardeVoorKolomUitRepresentatie(representatie any, kolomnaam string) (int, error) {
	value := reflect.ValueOf(representatie)
	for value.Kind() == reflect.Pointer {
		if value.IsNil() {
			return 0, fmt.Errorf("lege representatie")
		}
		value = value.Elem()
	}
	if value.Kind() != reflect.Struct {
		return 0, fmt.Errorf("representatie is geen struct")
	}

	typeInfo := value.Type()
	normalizedKolom := normalizeVeldnaam(kolomnaam)

	for i := 0; i < typeInfo.NumField(); i++ {
		fieldType := typeInfo.Field(i)
		fieldValue := value.Field(i)
		if !fieldValue.CanInterface() {
			continue
		}

		if normalizeVeldnaam(fieldType.Name) == normalizedKolom ||
			normalizeVeldnaam(firstTagValue(fieldType.Tag.Get("json"))) == normalizedKolom ||
			normalizeVeldnaam(firstTagValue(fieldType.Tag.Get("bun"))) == normalizedKolom {

			result, ok := anyNaarInt(fieldValue.Interface())
			if !ok {
				return 0, fmt.Errorf("veld %s is geen integer", fieldType.Name)
			}
			return result, nil
		}
	}

	return 0, fmt.Errorf("kolom %s niet gevonden in representatie", kolomnaam)
}

func firstTagValue(tag string) string {
	if tag == "" {
		return ""
	}
	parts := strings.Split(tag, ",")
	return parts[0]
}

func normalizeVeldnaam(veld string) string {
	return strings.ReplaceAll(strings.ToLower(strings.TrimSpace(veld)), "_", "")
}
