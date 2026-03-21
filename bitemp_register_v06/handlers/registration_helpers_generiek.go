package handlers

import (
	"database/sql"
	"fmt"
	"reflect"
	"strconv"
	"strings"

	"time"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
	"github.com/gin-gonic/gin"
	"github.com/uptrace/bun"
)

// handleRepresentatieOntOpvoer maakt een eerdere opvoer ongedaan door opvoer weer leeg te maken.
// De Wijziging bevat string-ID's; daarom converteren we ID-waarden eerst naar het kolomtype uit de metaregistry/DBFactory.
func handleRepresentatieOntOpvoer(c *gin.Context, tx bun.Tx, wijziging model.Wijziging) error {
	typeName := wijziging.Representatienaam
	targetIDRaw := wijziging.RepresentatieID

	// Bij opvoer van een entiteit worden representatienaam/representatieID leeg opgeslagen;
	// gebruik dan entiteitnaam/entiteitID als verwijzing naar het te herstellen record.
	if typeName == "" {
		typeName = wijziging.Entiteitnaam
		targetIDRaw = wijziging.EntiteitID
	}

	if typeName == "" || targetIDRaw == "" {
		return fmt.Errorf("HANDLER: ont-opvoer mist type of ID in wijziging %d", wijziging.ID)
	}

	meta, ok := model.MetaRegistry.GetTypeMeta(typeName)
	if !ok {
		return fmt.Errorf("HANDLER: onbekend type voor ont-opvoer: %s", typeName)
	}

	typedID, err := parseStringNaarKolomType(meta, meta.IDKolom, targetIDRaw)
	if err != nil {
		return fmt.Errorf("HANDLER: ongeldige ID voor ont-opvoer (%s.%s=%q): %v", meta.Tabelnaam, meta.IDKolom, targetIDRaw, err)
	}

	query := tx.NewUpdate().
		Table(meta.Tabelnaam).
		Set("opvoer = NULL").
		Where(fmt.Sprintf("%s = ?", meta.IDKolom), typedID)

	// Voor typen met PFK is de ID vaak alleen uniek binnen de bovenliggende entiteit.
	if meta.HeeftPFK {
		if meta.EntiteitIDKolom == "" {
			return fmt.Errorf("HANDLER: type %s heeft PFK maar geen EntiteitIDKolom", meta.Typenaam)
		}
		if wijziging.EntiteitID == "" {
			return fmt.Errorf("HANDLER: ont-opvoer voor %s vereist entiteitID in wijziging", meta.Typenaam)
		}

		typedEntiteitID, err := parseStringNaarKolomType(meta, meta.EntiteitIDKolom, wijziging.EntiteitID)
		if err != nil {
			return fmt.Errorf("HANDLER: ongeldige entiteitID voor ont-opvoer (%s.%s=%q): %v", meta.Tabelnaam, meta.EntiteitIDKolom, wijziging.EntiteitID, err)
		}

		query = query.Where(fmt.Sprintf("%s = ?", meta.EntiteitIDKolom), typedEntiteitID)
	}

	result, err := query.Exec(c.Request.Context())
	if err != nil {
		return fmt.Errorf("HANDLER: ont-opvoer update mislukt voor %s: %v", meta.Typenaam, err)
	}

	rows, err := result.RowsAffected()
	if err == nil && rows == 0 {
		return fmt.Errorf("HANDLER: ont-opvoer vond geen record voor %s met sleutel uit wijziging %d", meta.Typenaam, wijziging.ID)
	}

	return nil
}

// handleRepresentatieOntAfvoer maakt een eerdere afvoer ongedaan door afvoer weer leeg te maken.
func handleRepresentatieOntAfvoer(c *gin.Context, tx bun.Tx, wijziging model.Wijziging) error {
	typeName := wijziging.Representatienaam
	targetIDRaw := wijziging.RepresentatieID

	if typeName == "" {
		typeName = wijziging.Entiteitnaam
		targetIDRaw = wijziging.EntiteitID
	}

	if typeName == "" || targetIDRaw == "" {
		return fmt.Errorf("HANDLER: ont-afvoer mist type of ID in wijziging %d", wijziging.ID)
	}

	meta, ok := model.MetaRegistry.GetTypeMeta(typeName)
	if !ok {
		return fmt.Errorf("HANDLER: onbekend type voor ont-afvoer: %s", typeName)
	}

	typedID, err := parseStringNaarKolomType(meta, meta.IDKolom, targetIDRaw)
	if err != nil {
		return fmt.Errorf("HANDLER: ongeldige ID voor ont-afvoer (%s.%s=%q): %v", meta.Tabelnaam, meta.IDKolom, targetIDRaw, err)
	}

	query := tx.NewUpdate().
		Table(meta.Tabelnaam).
		Set("afvoer = NULL").
		Where(fmt.Sprintf("%s = ?", meta.IDKolom), typedID)

	if meta.HeeftPFK {
		if meta.EntiteitIDKolom == "" {
			return fmt.Errorf("HANDLER: type %s heeft PFK maar geen EntiteitIDKolom", meta.Typenaam)
		}
		if wijziging.EntiteitID == "" {
			return fmt.Errorf("HANDLER: ont-afvoer voor %s vereist entiteitID in wijziging", meta.Typenaam)
		}

		typedEntiteitID, err := parseStringNaarKolomType(meta, meta.EntiteitIDKolom, wijziging.EntiteitID)
		if err != nil {
			return fmt.Errorf("HANDLER: ongeldige entiteitID voor ont-afvoer (%s.%s=%q): %v", meta.Tabelnaam, meta.EntiteitIDKolom, wijziging.EntiteitID, err)
		}

		query = query.Where(fmt.Sprintf("%s = ?", meta.EntiteitIDKolom), typedEntiteitID)
	}

	result, err := query.Exec(c.Request.Context())
	if err != nil {
		return fmt.Errorf("HANDLER: ont-afvoer update mislukt voor %s: %v", meta.Typenaam, err)
	}

	rows, err := result.RowsAffected()
	if err == nil && rows == 0 {
		return fmt.Errorf("HANDLER: ont-afvoer vond geen record voor %s met sleutel uit wijziging %d", meta.Typenaam, wijziging.ID)
	}

	return nil
}

/*
===================== GENERIEK===========================
*/

/*
==== STANDAARD OPVOER ROUTINE ======

handleRepresentatieOpvoer verwerkt opvoer via de metaregistry.
*/
func handleRepresentatieOpvoer(c *gin.Context, tx bun.Tx, registratie model.Registratie,
	entiteitnaam string, entiteitID string, representatienaam string, representatie model.FormeleRepresentatie) error {
	meta, ok := model.MetaRegistry.GetTypeMeta(representatienaam)
	if !ok {
		return fmt.Errorf("HANDLER: onbekend type voor opvoer: %s", representatienaam)
	}

	/*
		HUB + _INPUT CONVERSIE (v06)
		Als het type een hub is (GESubtypeHub) en de representatie is een _Input struct
		(geen HeeftOnderliggendeGegevenselementen interface), dan converteren we de platte
		_Input naar een hub met gepopuleerde Data (en optioneel Aanvang/Einde).
		Dit is nodig voor individuele GE-registratie waar de API platte input accepteert.
		Bij entiteit-level registratie is de hub al correct gestructureerd uit de JSON.
	*/
	if meta.GESubtype == model.GESubtypeHub {
		if _, isHubStruct := representatie.(model.HeeftOnderliggendeGegevenselementen); !isHubStruct {
			hub, err := inputNaarHub(representatie, meta)
			if err != nil {
				return fmt.Errorf("HANDLER: inputNaarHub mislukt voor %s: %v", representatienaam, err)
			}
			representatie = hub
		}
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
	/*
		v06: Correctie wordt NIET uitgevoerd op hubs (hub blijft intact, alleen data wisselt)
		en NIET op data-subtypes (_Data/_Aanvang/_Einde), die worden via het enkelvoudig-
		voorgangers-mechanisme afgehandeld bij hub-recursie.
	*/
	if registratie.IsCorrectie() && meta.Metatype != model.MetatypeEntiteit &&
		meta.GESubtype != model.GESubtypeHub && !isDataSubtype(meta) {
		// Bij PFK-types: haal entiteitID uit de representatie voor de WHERE-clause.
		var pfkEntiteitID any
		if meta.HeeftPFK && meta.EntiteitIDKolom != "" {
			eid, err := haalIntWaardeVoorKolomUitRepresentatie(representatie, meta.EntiteitIDKolom)
			if err != nil {
				return fmt.Errorf("HANDLER: kon entiteit-ID niet bepalen voor correctie van %s: %v", representatienaam, err)
			}
			pfkEntiteitID = eid
		}
		// get huidige waarde van het gegevenselement op basis van ID in wijziging record
		huidigeRep, err := haalRepresentatieUitDB(c, tx, meta, representatie.GetID(), pfkEntiteitID)
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
	// v06: WEL voor data-subtypes bij correctie (hub-recursie: vorige data-versie afsluiten)
	if meta.Metatype != model.MetatypeEntiteit && meta.Momentvoorkomen == model.Enkelvoudig {
		if registratie.IsRegistratie() || isDataSubtype(meta) {
			if err := sluitActieveEnkelvoudigeVoorgangersAf(c, tx, registratie.ID, registratie.Tijdstip, representatienaam, representatie, meta); err != nil {
				return err
			}
		}
	}

	/* ===== BEIDE, MAAR SKIP DE ENTITEIT/HUB BIJ CORRECTIE ========
	Verder is de code voor registratie en correctie gelijk.
	v06: Ook hubs worden geskipt bij correctie (hub blijft intact, alleen data wisselt).
	*/
	if !(registratie.IsCorrectie() && (meta.Metatype == model.MetatypeEntiteit || meta.GESubtype == model.GESubtypeHub)) {
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

		// Alleen ClearID() als de DB het ID toekent via autoincrement (RelatieveAutoincrement=true).
		// Entiteiten hebben een door de gebruiker opgegeven ID en mogen niet worden leeggemaakt.
		if meta.RelatieveAutoincrement {
			representatie.ClearID()
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
		RECURSIE: Indien onderliggend gegevenselementen/relaties
		(typisch bij entiteiten, en bij hubs naar _Data/_Aanvang/_Einde):
	*/
	if meta.Metatype == model.MetatypeEntiteit || meta.GESubtype == model.GESubtypeHub {
		onderliggendeRepresentaties, ok := representatie.(model.HeeftOnderliggendeGegevenselementen)
		if !ok {
			return fmt.Errorf("HANDLER: voor type %s vind ik geen onderliggende gegevenselementen in de metamap", representatienaam)
		}

		for _, onderliggende := range onderliggendeRepresentaties.GeefOnderliggendeGegevenselementen() {
			if err := handleRepresentatieOpvoer(c, tx, registratie, entiteitnaam, entiteitID, onderliggende.Typenaam, onderliggende.Representatie); err != nil {
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

	// Bij PFK-types: haal entiteitID uit de representatie voor de WHERE-clause.
	var pfkEntiteitID any
	if meta.HeeftPFK && meta.EntiteitIDKolom != "" {
		eid, err := haalIntWaardeVoorKolomUitRepresentatie(representatie, meta.EntiteitIDKolom)
		if err != nil {
			return fmt.Errorf("HANDLER: kon entiteit-ID niet bepalen voor afvoer van %s: %v", representatienaam, err)
		}
		pfkEntiteitID = eid
	}

	// een reeds afgevoerde representatie mag niet nogmaals worden afgevoerd, dus eerst checken of deze al is afgevoerd, en indien ja, dan foutmelding en transactie afbreken.
	huidigeRep, err := haalRepresentatieUitDB(c, tx, meta, representatie.GetID(), pfkEntiteitID)
	if err != nil {
		return err
	}
	if huidigeRep.GetAfvoer() != nil {
		return fmt.Errorf("HANDLER: kan %s met ID %v niet afvoeren, want deze is al afgevoerd op %v", representatienaam, representatie.GetID(), huidigeRep.GetAfvoer())
	}

	if meta.Metatype != model.MetatypeEntiteit && meta.GESubtype != model.GESubtypeHub {
		// Eenvoudige afvoer voor non-hub, non-entiteit types (data, plumbing, legacy GE's)
		if err := updateAfvoerByID(c, tx, meta, representatie.GetID(), pfkEntiteitID, afvoerTijdstip); err != nil {
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

	/*
		HUB AFVOER (v06): afvoer de hub zelf + alle actieve onderliggende _Data/_Aanvang/_Einde.
		De hub scope is (entiteitIDKolom, rel_id). Kinderen worden gezocht met compound scope.
	*/
	if meta.GESubtype == model.GESubtypeHub {
		// vind de bovenliggende entiteit context
		entiteitnaam, entiteitID, err = vindEntiteitContext(entiteitnaam, entiteitID, representatienaam, huidigeRep, meta)
		if err != nil {
			return err
		}

		// Afvoer de hub zelf
		if err := updateAfvoerByID(c, tx, meta, representatie.GetID(), pfkEntiteitID, afvoerTijdstip); err != nil {
			return err
		}
		if err := persisteerWijziging(c, tx, model.WijzigingstypeAfvoer, registratieID,
			entiteitnaam, entiteitID, representatienaam, fmt.Sprint(representatie.GetID()), afvoerTijdstip); err != nil {
			return err
		}

		// Haal entiteitID en relID uit de hub voor compound scope
		hubEntiteitIDInt, err := haalIntWaardeVoorKolomUitRepresentatie(huidigeRep, meta.EntiteitIDKolom)
		if err != nil || hubEntiteitIDInt == 0 {
			// Als er geen entiteitIDKolom uitgehaald kan worden, zijn er ook geen kinderen
			return nil
		}
		hubRelIDInt, err := haalIntWaardeVoorKolomUitRepresentatie(huidigeRep, "rel_id")
		if err != nil || hubRelIDInt == 0 {
			return nil
		}

		// Doorloop onderliggende (Data, Aanvang, Einde) en voer die ook af
		for _, rel := range meta.OnderliggendeGegevenselementen {
			childMeta, childOK := model.MetaRegistry.GetTypeMeta(rel.Doeltype)
			if !childOK {
				return fmt.Errorf("HANDLER: onbekend child type %s bij hub afvoer", rel.Doeltype)
			}

			scope := hubScopeVoorChild(childMeta, hubEntiteitIDInt, hubRelIDInt)
			activeIDs, err := haalActieveIDsMetScope(c, tx, childMeta, scope)
			if err != nil {
				return err
			}

			for _, versie := range activeIDs {
				if err := updateAfvoerMetScope(c, tx, childMeta, versie, scope, afvoerTijdstip); err != nil {
					return err
				}
				if err := persisteerWijziging(c, tx, model.WijzigingstypeAfvoer, registratieID,
					entiteitnaam, entiteitID, childMeta.Typenaam, fmt.Sprint(versie), afvoerTijdstip); err != nil {
					return err
				}
			}
		}

		return nil
	}

	entiteitnaam = representatienaam
	entiteitID = fmt.Sprint(representatie.GetID())

	// ENTITEIT AFVOER
	if err := updateAfvoerByID(c, tx, meta, representatie.GetID(), nil, afvoerTijdstip); err != nil {
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
			if err := updateAfvoerByID(c, tx, childMeta, id, entiteitIDInt, afvoerTijdstip); err != nil {
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

// updateAfvoerByID zet het afvoer-tijdstip op een representatie.
// Bij PFK-types (HeeftPFK=true) is de IDKolom (versie) alleen uniek binnen de
// entiteit; entiteitID voegt dan een extra WHERE op EntiteitIDKolom toe zodat
// het juiste record wordt geraakt.
func updateAfvoerByID(c *gin.Context, tx bun.Tx, meta model.TypeMeta, id any, entiteitID any, afvoerTijdstip time.Time) error {
	query := tx.NewUpdate().
		Table(meta.Tabelnaam).
		Set("afvoer = ?", afvoerTijdstip).
		Where(fmt.Sprintf("%s = ?", meta.IDKolom), id)

	// PFK-types: versie is alleen uniek per entiteit; filter ook op EntiteitIDKolom.
	if meta.HeeftPFK && meta.EntiteitIDKolom != "" && entiteitID != nil {
		query = query.Where(fmt.Sprintf("%s = ?", meta.EntiteitIDKolom), entiteitID)
	}

	_, err := query.Exec(c.Request.Context())
	if err != nil {
		return fmt.Errorf("HANDLER: failed to update %s afvoer: %v", meta.Typenaam, err)
	}

	return nil
}

// haalRepresentatieUitDB haalt een representatie op uit de DB op basis van ID.
// Bij PFK-types voegt entiteitID een extra WHERE toe (zie updateAfvoerByID).
func haalRepresentatieUitDB(c *gin.Context, tx bun.Tx, meta model.TypeMeta, id any, entiteitID any) (model.FormeleRepresentatie, error) {
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
		Apply(func(q *bun.SelectQuery) *bun.SelectQuery {
			// PFK-types: versie is alleen uniek per entiteit; filter ook op EntiteitIDKolom.
			if meta.HeeftPFK && meta.EntiteitIDKolom != "" && entiteitID != nil {
				q = q.Where(fmt.Sprintf("%s = ?", meta.EntiteitIDKolom), entiteitID)
			}
			return q
		}).
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
		Where("opvoer IS NOT NULL").
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
		if ok {
			entiteitnaam = bovenliggendeRelatieMeta.ParentType.Typenaam
		} else if meta.BovenliggendTypenaam != "" {
			// Plumbing GE-types (bijv. A_Aanvang) zijn niet opgenomen in OnderliggendeGegevenselementen
			// maar hebben wel een directe bovenliggende entiteit.
			entiteitnaam = meta.BovenliggendTypenaam
		} else {
			return "", "", fmt.Errorf("HANDLER: geen bovenliggende entiteit gevonden voor type %s", representatienaam)
		}
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

	entiteitRep, err := haalRepresentatieUitDB(c, tx, entiteitMeta, entityIDAny, nil) // entiteiten hebben geen PFK
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

	// Bepaal de naam van de bovenliggende entiteit voor wijziging-records.
	var parentTypenaam string
	bovenliggendeRelatieMeta, ok := model.MetaRegistry.GetBovenliggendeRelatieMeta(meta.Typenaam)
	if ok {
		parentTypenaam = bovenliggendeRelatieMeta.ParentType.Typenaam
	} else if meta.BovenliggendTypenaam != "" {
		parentTypenaam = meta.BovenliggendTypenaam
	} else {
		return fmt.Errorf("HANDLER: geen bovenliggende entiteit gevonden voor type %s", representatienaam)
	}

	fkColumn := meta.EntiteitIDKolom
	if fkColumn == "" {
		return fmt.Errorf("HANDLER: geen entiteit FK-kolom geconfigureerd voor type %s", representatienaam)
	}

	entiteitID, err := haalIntWaardeVoorKolomUitRepresentatie(representatie, fkColumn)
	if err != nil {
		return fmt.Errorf("HANDLER: kon bovenliggende %s id niet bepalen voor %s: %v", parentTypenaam, representatienaam, err)
	}
	if entiteitID == 0 {
		return fmt.Errorf("HANDLER: bovenliggende %s id ontbreekt voor %s", parentTypenaam, representatienaam)
	}

	activeIDs, err := haalActieveIDsGegevenselementUitDB(c, tx, meta, fkColumn, entiteitID)

	// v06: Voor data-subtypes (_Data/_Aanvang/_Einde) is de scope compound: (entiteitID, rel_id).
	// Zonder rel_id filter zouden we data van ALLE hubs bij deze entiteit vinden.
	var relID int
	if isDataSubtype(meta) {
		relID, err = haalIntWaardeVoorKolomUitRepresentatie(representatie, "rel_id")
		if err != nil {
			return fmt.Errorf("HANDLER: kon rel_id niet bepalen voor %s: %v", representatienaam, err)
		}
		scope := map[string]any{fkColumn: entiteitID, "rel_id": relID}
		scopedIDs, scopeErr := haalActieveIDsMetScope(c, tx, meta, scope)
		if scopeErr != nil {
			return scopeErr
		}
		// Converteer int64 IDs naar int voor compatibiliteit
		activeIDsInt := make([]int, 0, len(scopedIDs))
		for _, id := range scopedIDs {
			activeIDsInt = append(activeIDsInt, int(id))
		}
		activeIDs = activeIDsInt
		err = nil // reset error van de eerste query (die is nu vervangen)
	}

	if err != nil {
		return err
	}

	if len(activeIDs) > 1 {
		return fmt.Errorf("HANDLER: meerdere actieve %s records gevonden voor %s=%d (enkelvoudig verwacht)",
			representatienaam, fkColumn, entiteitID)
	}

	for _, id := range activeIDs {
		// v06: data-subtypes gebruiken compound scope (entiteitID + rel_id) voor afvoer.
		if isDataSubtype(meta) && relID != 0 {
			scope := map[string]any{fkColumn: entiteitID, "rel_id": relID}
			if err := updateAfvoerMetScope(c, tx, meta, id, scope, registratietijdstip); err != nil {
				return fmt.Errorf("HANDLER: afvoer van voorganger %s id=%v mislukt: %v", representatienaam, id, err)
			}
		} else {
			// updateAfvoerByID voegt automatisch EntiteitIDKolom toe bij PFK-types.
			if err := updateAfvoerByID(c, tx, meta, id, entiteitID, registratietijdstip); err != nil {
				return fmt.Errorf("HANDLER: afvoer van voorganger %s id=%v mislukt: %v", representatienaam, id, err)
			}
		}
		if err := persisteerWijziging(c, tx, model.WijzigingstypeAfvoer, registratieID,
			parentTypenaam, fmt.Sprint(entiteitID), representatienaam, fmt.Sprint(id), registratietijdstip); err != nil {
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

func parseStringNaarKolomType(meta model.TypeMeta, kolomnaam string, raw string) (any, error) {
	if strings.TrimSpace(raw) == "" {
		return nil, fmt.Errorf("lege waarde")
	}

	kolomType, err := vindKolomTypeInDBModel(meta, kolomnaam)
	if err != nil {
		return nil, err
	}

	for kolomType.Kind() == reflect.Pointer {
		kolomType = kolomType.Elem()
	}

	switch kolomType.Kind() {
	case reflect.String:
		return raw, nil
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
		parsed, err := strconv.ParseInt(raw, 10, kolomType.Bits())
		if err != nil {
			return nil, err
		}
		v := reflect.New(kolomType).Elem()
		v.SetInt(parsed)
		return v.Interface(), nil
	case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
		parsed, err := strconv.ParseUint(raw, 10, kolomType.Bits())
		if err != nil {
			return nil, err
		}
		v := reflect.New(kolomType).Elem()
		v.SetUint(parsed)
		return v.Interface(), nil
	default:
		return raw, nil
	}
}

func vindKolomTypeInDBModel(meta model.TypeMeta, kolomnaam string) (reflect.Type, error) {
	if meta.DBFactory == nil {
		return nil, fmt.Errorf("DBFactory ontbreekt voor type %s", meta.Typenaam)
	}

	rep := meta.DBFactory()
	rv := reflect.ValueOf(rep)
	for rv.Kind() == reflect.Pointer {
		if rv.IsNil() {
			return nil, fmt.Errorf("lege DBFactory representatie voor type %s", meta.Typenaam)
		}
		rv = rv.Elem()
	}
	if rv.Kind() != reflect.Struct {
		return nil, fmt.Errorf("DBFactory voor type %s levert geen struct", meta.Typenaam)
	}

	rt := rv.Type()
	normalizedKolom := normalizeVeldnaam(kolomnaam)

	for i := 0; i < rt.NumField(); i++ {
		field := rt.Field(i)

		if normalizeVeldnaam(field.Name) == normalizedKolom ||
			normalizeVeldnaam(firstTagValue(field.Tag.Get("bun"))) == normalizedKolom ||
			normalizeVeldnaam(firstTagValue(field.Tag.Get("json"))) == normalizedKolom {
			return field.Type, nil
		}
	}

	return nil, fmt.Errorf("kolom %s niet gevonden in DB model voor type %s", kolomnaam, meta.Typenaam)
}

/* =============================================================================================
   HUB + DATA HELPERS — Fase 2 van het hub+data pattern (zie ONTWERP_DATA_PATTERN.md §10)
   =============================================================================================

   De onderstaande functies ondersteunen het splitsen van platte _Input structs naar
   hub + Data (en optioneel _Aanvang/_Einde) records, en het opvragen/afvoeren van
   records met samengestelde scope (entiteit_id + rel_id).
*/

// kopieerMatchendeVelden kopieert veldwaarden van src naar dst door JSON-tagnamen te matchen.
// Velden zonder JSON-tag of met tag "-" worden overgeslagen.
func kopieerMatchendeVelden(src, dst any) error {
	srcVal := reflect.ValueOf(src)
	for srcVal.Kind() == reflect.Ptr {
		srcVal = srcVal.Elem()
	}
	dstVal := reflect.ValueOf(dst)
	for dstVal.Kind() == reflect.Ptr {
		dstVal = dstVal.Elem()
	}

	if srcVal.Kind() != reflect.Struct || dstVal.Kind() != reflect.Struct {
		return fmt.Errorf("kopieerMatchendeVelden: both src and dst must be structs")
	}

	srcType := srcVal.Type()
	dstType := dstVal.Type()

	// Bouw index van dst JSON-tag → veldindex
	dstIndex := make(map[string]int, dstType.NumField())
	for j := 0; j < dstType.NumField(); j++ {
		tag := firstTagValue(dstType.Field(j).Tag.Get("json"))
		if tag != "" && tag != "-" {
			dstIndex[tag] = j
		}
	}

	for i := 0; i < srcType.NumField(); i++ {
		srcField := srcType.Field(i)
		if !srcField.IsExported() {
			continue
		}
		srcJSONTag := firstTagValue(srcField.Tag.Get("json"))
		if srcJSONTag == "" || srcJSONTag == "-" {
			continue
		}
		j, ok := dstIndex[srcJSONTag]
		if !ok {
			continue
		}
		dstFieldVal := dstVal.Field(j)
		srcFieldVal := srcVal.Field(i)
		if dstFieldVal.CanSet() && srcFieldVal.Type().AssignableTo(dstFieldVal.Type()) {
			dstFieldVal.Set(srcFieldVal)
		}
	}
	return nil
}

// inputNaarHub converteert een platte _Input struct naar een hub met gepopuleerde
// Data (en optioneel Aanvang/Einde bij materiële hubs).
//
// Velden worden gematcht op JSON-tag:
//   - Velden die in de hub bestaan → gekopieerd naar hub (a_id, rel_id, b_id, ...)
//   - Velden die in de _Data bestaan → gekopieerd naar data (aaa, bbb, soort, ...)
//   - "aanvang"/"einde" → materiële plumbing records (alleen bij materiële hubs)
func inputNaarHub(input model.FormeleRepresentatie, meta model.TypeMeta) (model.FormeleRepresentatie, error) {
	if meta.DBFactory == nil {
		return nil, fmt.Errorf("inputNaarHub: DBFactory ontbreekt voor %s", meta.Typenaam)
	}

	// Maak hub struct
	hubRep := meta.DBFactory()
	hub, ok := hubRep.(model.FormeleRepresentatie)
	if !ok {
		return nil, fmt.Errorf("inputNaarHub: DBFactory voor %s levert geen FormeleRepresentatie", meta.Typenaam)
	}

	// Kopieer structurele velden van _Input → hub
	if err := kopieerMatchendeVelden(input, hub); err != nil {
		return nil, fmt.Errorf("inputNaarHub: kopiëren naar hub mislukt: %v", err)
	}

	// Maak en populeer Data record (als DataTypenaam aanwezig)
	if meta.DataTypenaam != "" {
		dataMeta, dataOK := model.MetaRegistry.GetTypeMeta(meta.DataTypenaam)
		if !dataOK {
			return nil, fmt.Errorf("inputNaarHub: DataTypenaam %s niet gevonden in MetaRegistry", meta.DataTypenaam)
		}
		if dataMeta.DBFactory == nil {
			return nil, fmt.Errorf("inputNaarHub: DBFactory ontbreekt voor %s", dataMeta.Typenaam)
		}

		dataRep := dataMeta.DBFactory()
		if err := kopieerMatchendeVelden(input, dataRep); err != nil {
			return nil, fmt.Errorf("inputNaarHub: kopiëren naar data mislukt: %v", err)
		}

		// Zet Data slice op hub via reflection
		hubVal := reflect.ValueOf(hub).Elem()
		dataField := hubVal.FieldByName("Data")
		if dataField.IsValid() && dataField.CanSet() && dataField.Kind() == reflect.Slice {
			dataSlice := reflect.MakeSlice(dataField.Type(), 1, 1)
			dataSlice.Index(0).Set(reflect.ValueOf(dataRep).Elem())
			dataField.Set(dataSlice)
		}
	}

	// Materiële plumbing: Aanvang/Einde uit _Input overzetten (alleen als hub materieel is)
	if meta.IsMaterieel {
		inputVal := reflect.ValueOf(input)
		for inputVal.Kind() == reflect.Ptr {
			inputVal = inputVal.Elem()
		}
		hubVal := reflect.ValueOf(hub).Elem()

		for _, plumbing := range []struct {
			inputField string
			hubField   string
			typeName   string
		}{
			{"Aanvang", "Aanvang", ""},
			{"Einde", "Einde", ""},
		} {
			inputFld := inputVal.FieldByName(plumbing.inputField)
			if !inputFld.IsValid() || inputFld.IsNil() {
				continue
			}
			hubFld := hubVal.FieldByName(plumbing.hubField)
			if !hubFld.IsValid() || !hubFld.CanSet() || hubFld.Kind() != reflect.Slice {
				continue
			}
			// Zoek het juiste plumbing-type in de MetaRegistry via OnderliggendeGegevenselementen
			for _, child := range meta.OnderliggendeGegevenselementen {
				childMeta, cOK := model.MetaRegistry.GetTypeMeta(child.Doeltype)
				if !cOK {
					continue
				}
				if childMeta.GESubtype != model.GESubtypeAanvang && childMeta.GESubtype != model.GESubtypeEinde {
					continue
				}
				if child.Rolnaam != plumbing.hubField {
					continue
				}
				if childMeta.DBFactory == nil {
					continue
				}
				plumbingRec := childMeta.DBFactory()
				// Kopieer structurele velden (a_id, rel_id) van hub naar plumbing
				if err := kopieerMatchendeVelden(hub, plumbingRec); err != nil {
					continue
				}
				// Zet datum vanuit de _Input
				plumbVal := reflect.ValueOf(plumbingRec).Elem()
				datumFld := plumbVal.FieldByName("Datum")
				if datumFld.IsValid() && datumFld.CanSet() {
					datumFld.Set(inputFld)
				}
				// Voeg toe aan hub slice
				plumbSlice := reflect.MakeSlice(hubFld.Type(), 1, 1)
				plumbSlice.Index(0).Set(plumbVal)
				hubFld.Set(plumbSlice)
				break
			}
		}
	}

	return hub, nil
}

// isDataSubtype controleert of het meta-type een _Data, _Aanvang of _Einde subtype is.
func isDataSubtype(meta model.TypeMeta) bool {
	return meta.GESubtype == model.GESubtypeData ||
		meta.GESubtype == model.GESubtypeAanvang ||
		meta.GESubtype == model.GESubtypeEinde
}

// haalActieveIDsMetScope haalt actieve (opvoer IS NOT NULL, afvoer IS NULL) record-IDs
// (van meta.IDKolom) op, gefilterd door de meegegeven scope.
// Scope is een map van kolomnaam → waarde voor de WHERE-clausules.
func haalActieveIDsMetScope(c *gin.Context, tx bun.Tx, meta model.TypeMeta, scope map[string]any) ([]int64, error) {
	ids := make([]int64, 0)
	query := tx.NewSelect().
		Table(meta.Tabelnaam).
		ColumnExpr(fmt.Sprintf("CAST(%s AS BIGINT)", meta.IDKolom)).
		Where("opvoer IS NOT NULL").
		Where("afvoer IS NULL")
	for col, val := range scope {
		query = query.Where(fmt.Sprintf("%s = ?", col), val)
	}
	if err := query.Scan(c.Request.Context(), &ids); err != nil && err != sql.ErrNoRows {
		return nil, fmt.Errorf("HANDLER: failed to query active %s records: %v", meta.Typenaam, err)
	}
	return ids, nil
}

// updateAfvoerMetScope zet het afvoer-tijdstip op een record, gefilterd door ID + extra scope.
// Scope bevat aanvullende WHERE-clausules (bijv. entiteitIDKolom en rel_id).
func updateAfvoerMetScope(c *gin.Context, tx bun.Tx, meta model.TypeMeta, id any, scope map[string]any, afvoerTijdstip time.Time) error {
	query := tx.NewUpdate().
		Table(meta.Tabelnaam).
		Set("afvoer = ?", afvoerTijdstip).
		Where(fmt.Sprintf("%s = ?", meta.IDKolom), id)
	for col, val := range scope {
		query = query.Where(fmt.Sprintf("%s = ?", col), val)
	}
	_, err := query.Exec(c.Request.Context())
	if err != nil {
		return fmt.Errorf("HANDLER: failed to update %s afvoer: %v", meta.Typenaam, err)
	}
	return nil
}

// hubScopeVoorChild bouwt de scope map (entiteitIDKolom + rel_id) voor een kind-record
// van een hub. entiteitID is de waarde van de bovenliggende FK (bijv. a_id waarde),
// relID is de waarde van de hub's rel_id.
func hubScopeVoorChild(childMeta model.TypeMeta, entiteitID int, relID int) map[string]any {
	scope := map[string]any{}
	if childMeta.EntiteitIDKolom != "" {
		scope[childMeta.EntiteitIDKolom] = entiteitID
	}
	scope["rel_id"] = relID
	return scope
}
