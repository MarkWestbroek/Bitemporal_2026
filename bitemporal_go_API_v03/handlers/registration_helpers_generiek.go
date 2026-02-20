package handlers

import (
	"database/sql"
	"fmt"

	"time"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemporal_go_API_v03/model"
	"github.com/gin-gonic/gin"
	"github.com/uptrace/bun"
)

/*
===================== GENERIEK===========================
*/

// handleRepresentatieOpvoerMetReflectie inserts an opvoer representatie and creates a wijziging record.
// het gebruikt de vrij verbose reflectie code die Codex geschreven heeft...
func handleRepresentatieOpvoerMetReflectie(c *gin.Context, tx bun.Tx, registratieID int64, opvoerTijdstip time.Time,
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
	representatie.SetOpvoer(&opvoerTijdstip)

	// insert de top level representatie, dat moet namelijk sowieso
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
			if err := handleRepresentatieOpvoerMetReflectie(c, tx, registratieID, opvoerTijdstip, kind.Naam, kind.Representatie); err != nil {
				return err
			}
		}
	}

	// Maak wijziging record aan
	return persisteerWijziging(c, tx, model.WijzigingstypeOpvoer, registratieID,
		representatienaam, fmt.Sprint(representatie.GetID()), opvoerTijdstip)
}

// handleRepresentatieOpvoerMeta verwerkt opvoer via de metaregistry, zonder reflectie.
func handleRepresentatieOpvoerMeta(c *gin.Context, tx bun.Tx, registratieID int64, opvoerTijdstip time.Time,
	representatienaam string, representatie model.FormeleRepresentatie) error {
	meta, ok := model.MetaRegistry.GetTypeMeta(representatienaam)
	if !ok {
		return fmt.Errorf("HANDLER: onbekend type voor opvoer: %s", representatienaam)
	}

	representatie.SetOpvoer(&opvoerTijdstip)
	_, err := tx.NewInsert().
		Model(representatie).
		Exec(c.Request.Context())
	if err != nil {
		return fmt.Errorf("HANDLER: failed to insert %s: %v", representatienaam, err)
	}

	if err := persisteerWijziging(c, tx, model.WijzigingstypeOpvoer, registratieID,
		representatienaam, fmt.Sprint(representatie.GetID()), opvoerTijdstip); err != nil {
		return err
	}

	if meta.Metatype != model.MetatypeEntiteit {
		return nil
	}

	switch entiteit := representatie.(type) {
	case *model.Full_A:
		for i := range entiteit.Us {
			if entiteit.Us[i].A_ID == 0 {
				entiteit.Us[i].A_ID = entiteit.ID
			}
			if err := handleRepresentatieOpvoerMeta(c, tx, registratieID, opvoerTijdstip, "A_U", &entiteit.Us[i]); err != nil {
				return err
			}
		}
		for i := range entiteit.Vs {
			if entiteit.Vs[i].A_ID == 0 {
				entiteit.Vs[i].A_ID = entiteit.ID
			}
			if err := handleRepresentatieOpvoerMeta(c, tx, registratieID, opvoerTijdstip, "A_V", &entiteit.Vs[i]); err != nil {
				return err
			}
		}
		for i := range entiteit.RelABs {
			if entiteit.RelABs[i].A_ID == 0 {
				entiteit.RelABs[i].A_ID = entiteit.ID
			}
			if err := handleRepresentatieOpvoerMeta(c, tx, registratieID, opvoerTijdstip, "Rel_A_B", &entiteit.RelABs[i]); err != nil {
				return err
			}
		}
	case *model.Full_B:
		for i := range entiteit.Xs {
			if entiteit.Xs[i].B_ID == 0 {
				entiteit.Xs[i].B_ID = entiteit.ID
			}
			if err := handleRepresentatieOpvoerMeta(c, tx, registratieID, opvoerTijdstip, "B_X", &entiteit.Xs[i]); err != nil {
				return err
			}
		}
		for i := range entiteit.Ys {
			if entiteit.Ys[i].B_ID == 0 {
				entiteit.Ys[i].B_ID = entiteit.ID
			}
			if err := handleRepresentatieOpvoerMeta(c, tx, registratieID, opvoerTijdstip, "B_Y", &entiteit.Ys[i]); err != nil {
				return err
			}
		}
	case *model.A_basis, *model.B_basis:
		return nil
	default:
		return fmt.Errorf("HANDLER: unsupported entiteit type voor opvoer: %T", representatie)
	}

	return nil
}

func handleRepresentatieAfvoer(c *gin.Context, tx bun.Tx, registratieID int64, afvoerTijdstip time.Time,
	representatienaam string, representatie model.FormeleRepresentatie) error {

	/* Scenario 1: Afvoer van hele entiteit met eventueel onderliggende gegevenselementen en/of relaties
	- eerst 'de entiteit afvoeren' (i.e.: het afgeleide veld "afvoer" UPDATEN in de DB)
	- en het bijbehorende wijziging (afvoer) record maken
	- itereren over onderliggende gegevenselementen/relaties en die ook afvoeren (met eigen wijziging records)

	* Scenario 2: Afvoer van individuele gegevenselementen/relaties
	- alleen dat gegevenselement/relatie afvoeren, zonder dat de hele entiteit wordt aangeraakt
	- ook hier moet een wijziging record worden gemaakt

	*/

	meta, ok := model.MetaRegistry.GetTypeMeta(representatienaam)
	if !ok {
		return fmt.Errorf("HANDLER: onbekend type voor afvoer: %s", representatienaam)
	}

	if meta.Metatype != model.MetatypeEntiteit {
		if err := updateAfvoerByID(c, tx, meta, representatie.GetID(), afvoerTijdstip); err != nil {
			return err
		}
		return persisteerWijziging(c, tx, model.WijzigingstypeAfvoer, registratieID,
			representatienaam, fmt.Sprint(representatie.GetID()), afvoerTijdstip)
	}

	if err := updateAfvoerByID(c, tx, meta, representatie.GetID(), afvoerTijdstip); err != nil {
		return err
	}
	if err := persisteerWijziging(c, tx, model.WijzigingstypeAfvoer, registratieID,
		representatienaam, fmt.Sprint(representatie.GetID()), afvoerTijdstip); err != nil {
		return err
	}

	// nodig omdat nu alle gegevenselementen/relaties van een entiteit een int ID_NAAR_ENTITEIT veld hebben?
	entiteitID, ok := anyNaarInt(representatie.GetID()) // hulpfunctie om de ID als int te krijgen, ongeacht het type
	if !ok {
		return fmt.Errorf("HANDLER: entiteit ID is geen int voor %s", representatienaam)
	}

	for _, rel := range meta.OnderliggendeGegevenselementen {
		childMeta, ok := model.MetaRegistry.GetTypeMeta(rel.Doeltype)
		if !ok {
			return fmt.Errorf("HANDLER: unknown related type: %s", rel.Doeltype)
		}

		fkColumn := childMeta.EntiteitIDKolom
		if fkColumn == "" {
			return fmt.Errorf("HANDLER: no entity id column for %s", childMeta.Typenaam)
		}

		activeIDs, err := haalActieveIDsGegevenselementUitDB(c, tx, childMeta, fkColumn, entiteitID)
		if err != nil {
			return err
		}

		for _, id := range activeIDs {
			if err := updateAfvoerByID(c, tx, childMeta, id, afvoerTijdstip); err != nil {
				return err
			}
			if err := persisteerWijziging(c, tx, model.WijzigingstypeAfvoer, registratieID,
				childMeta.Typenaam, fmt.Sprint(id), afvoerTijdstip); err != nil {
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
	registratieID int64, representatienaam string, representatieID string, registratietijdstip time.Time) error {
	wijziging := model.Wijziging{
		Wijzigingstype:    wijzigingstype,
		RegistratieID:     registratieID,
		Representatienaam: representatienaam,
		RepresentatieID:   representatieID,     // Now directly using string
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
