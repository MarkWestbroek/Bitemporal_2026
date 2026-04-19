package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
	"time"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
	"github.com/gin-gonic/gin"
)

func RegistreerMetNieuweAanpak() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		var request model.RegistreerRequest
		if err := c.ShouldBindJSON(&request); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		requestBodyJSON, err := json.Marshal(request)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to serialize request body for audit: %v", err)})
			return
		}
		requestPath := c.Request.URL.Path
		requestMethod := c.Request.Method
		request.Registratie.RequestBody = requestBodyJSON
		request.Registratie.RequestPath = &requestPath
		request.Registratie.RequestMethod = &requestMethod

		// Output request body for debugging as pretty JSON
		LogRequestBodyAsJSON(c)

		// Start transaction
		tx, err := DB.BeginTx(c.Request.Context(), nil)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to start transaction: %v", err)})
			return
		}
		committed := false
		defer func() {
			if !committed {
				_ = tx.Rollback()
			}
		}()

		/*
			tijdelijk voor testen: maak het registratietijdstip gelijk aan
			een tijdstip oplopende met het registratienummer.
			Dat vergt wel eerst een insert van de registratie zonder tijdstip,
			en dan een update met het tijdstip.
		*/

		// Step 1: Insert Registratie and get ID + Tijdstip
		_, err = tx.NewInsert().
			Model(&request.Registratie).
			Returning("id").
			Exec(c.Request.Context())
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to insert registratie: %v", err)})
			return
		}

		// TIJDELIJK: overwrite registratietijdstip met een tijdstip gebaseerd op de registratie ID, zodat we oplopende tijdstippen hebben voor testdoeleinden
		request.Registratie.Tijdstip = time.
			Date(2026, 1, 1, 0, 0, 0, 0, time.UTC).
			Add(time.Duration(request.Registratie.ID) * time.Hour).
			Add(time.Microsecond * time.Duration(request.Registratie.ID)) //gimmick: laatste cijfer van de tijd is het ID van de registratie...
		_, err = tx.NewUpdate().
			Model(&request.Registratie).
			Where("id = ?", request.Registratie.ID).
			Exec(c.Request.Context())
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to update registratie with tijdstip: %v", err)})
			return
		}

		// set twee variabelen voor verder gebruik in de fuctie: registratieID en registratieTijdstip
		registratieID := request.Registratie.ID
		registratieTijdstip := request.Registratie.Tijdstip

		/*
			CORRECTIE / ONGEDAANMAKING scenario's
			-------------------------------------
			CORRECTIE VOORWAARDEN:
			- Registratietype = Correctie
			- CorrigeertRegistratieID != nil
			- Het tijdstip van de correctie is later dan dat van de te corrigeren registratie.
			- Een entiteit zelf kan niet gewijzigd worden,
					-> BEHALVE de materiele tijden (aanvang, einde)

			N.B.:
			- een registratie kan nu meer dan één entiteit betreffen (niet strikt REST dus)
			- op zich zou hetzelfde formaat gebruikt kunnen worden voor correctie, zoals hieronder.
			-- het id van de entiteit betekent dan 'betreft entiteit met ID x'
			-- een correctie kan niet een opvoer in een afvoer veranderen ofzo: daar is ongedaanmaking voor.
			-- een correctie kan dus alleen een opvoer corrigeren naar een andere opvoer, of een afvoer naar een andere afvoer
			-- een correctie hoeft niet alle elementen in een registratie te corrigeren
			--> ISSUE? wat met verplichte velden in de structs? Hebben we andere structs nodig voor correcties?

			RESULTAAT:
			- er is minimaal één nieuwe wijziging bijgekomen voor dat wat gecorrigeerd is
			- het gecorrigeerde gegevenselement is afgevoerd (met een wijziging record van type 'afvoer' en het tijdstip van de correctie)
			- er is een nieuw gegevenselement opgevoerd met de gecorrigeerde data, maar met een nieuwe ID
			- het nieuwe ID moet worden terugggegeven in de response
			-> ISSUE: geven we dus de hele request ongeveer terug, maar met gegeneerde ID's?
			-> ISSUE: hoe weten we welk gegevenselement welke is bij meerdere. Maar misschien maakt dat niet uit.
			--- denkexperiment: DING bevat NAMEN. naam1, naam2, naam3.
			--- We corrigeren naam2 naar naam2b. naam2 wordt afgevoerd,
			--- en naam2b wordt opgevoerd met een nieuwe ID.
			--- In de response geven we naam2b terug met het nieuwe ID.

			Voorbeeld correctie request body:
			{
				"registratie": {
					"registratietype": "correctie",
					"tijdstip": "2026-01-12T11:00:00Z",
					"opmerking": "Corrigeer U3 van entiteit A2",
					"corrigeertRegistratieID": 1
				},
				"wijzigingen": [
					{
						"opvoer": {
							"a": {
								"id": 2,
								"us": [
									{
										"rel_id": 3,
										"aaa": "a2-correctie",
										//"bbb": false // stel dat we alleen aaa corrigeren, en bbb niet. Dan corrigeren we alleen aaa in de opvoer, en laten we bbb weg in de opvoer. In de database blijft bbb dan gelijk aan wat het was.
									}
								]
							}
						}
					}
				]
			}

			RESPONSE:
			{
				"message": "De registratie 2 is succesvol verwerkt op 2026-01-12T11:00:00Z in 123 ms",
				"wijzigingen": [
					{
						"opvoer": {
							"a": {
								"id": 2,
								"us": [
									{
										"rel_id": 4, // nieuwe ID voor de opgevoerde U3
										"aaa": "a2-correctie",
										//"bbb": false // stel dat we alleen aaa corrigeren, en bbb niet. Dan corrigeren we alleen aaa in de opvoer, en laten we bbb weg in de opvoer. In de database blijft bbb dan gelijk aan wat het was.
									}
								]
							}
						}
					}
				]
			}

			- in dit voorbeeld corrigeert de wijziging het gegevenselement U3 (id=3) van entiteit A2 (id=2)
			- de handler voor deze correctie moet dus:
			1. U3 afvoeren (op dezelfde manier als bij een normale afvoer, dus inclusief wijziging record) met registratietijdstip
			2. U3 opnieuw opvoeren met de gecorrigeerde data, maar met een nieuwe ID... Dat is nu even lastig zonder auto-increment ID,
			maar we zouden in de handler een nieuwe ID kunnen genereren (bijv. max bestaande ID + 1) voordat we de opvoer uitvoeren.
			Deze nieuwe ID wordt dan ook gebruikt in de wijziging record voor de opvoer.
			Een andere oplossing zou zijn om UUID's te gebruiken in plaats van auto-increment IDs,
			zodat we al een ID kunnen genereren voordat we de opvoer uitvoeren.

			In principe wil je ook een afgevoerd gegeven nog kunnen corrigeren. Dat lijkt raar (StUF sluit het bijv. uit),
			maar het kan als het materieel is iig wel. Voor alleen een formeel gegevens is het wel gek.

			Verder: wat bij een niet complete correctie van het gegevenselement?
			bijv. alleen het veld "aaa" van U3 corrigeren, en niet het veld "bbb"?
			Dan moet je dus eigenlijk ook de bestaande waarde van "bbb" ophalen en
			meenemen in de opvoer van U3.

			RECURSIE:
			- Een complexere correctie is eigenlijk een herhaling van zetten, maar dan
			met meerdere gegevenselementen betreffende één of meerdere entiteiten.


			ONGEDAANMAKING VOORWAARDEN:
			- Registratietype = Ongedaanmaking
			- MaaktOngedaanRegistratieID != nil
			- Het tijdstip van de ongedaanmaking is later dan dat van de ongedaan te maken registratie.

			ACTIES ONGEDAANMAKING:
			- Bij ongedaanmaking maken we een nieuwe registratie aan met type "Ongedaanmaking"
			en een verwijzing naar de te ongedaan maken registratie.
			- In principe zou dat genoeg zijn,
			maar we willen nog de afgeleide velden opvoer en afvoer in de ongedaangemaakte registratie opnieuw bepalen.
			Hier zit wel complexiteit, omdat we dan feitelijk moeten tijdsreizen naar een tijdstip nèt voor de ongedaan gemaakte registratie,
			en dan de toestand van opvoer/afvoer herstellen.
			N.B.: het kan dus zijn dat de representatie in de ongedaan gemaakte registratie werd opgevoerd, en dus daarvoor niet bestond.
			Dan moet gewoon de opvoer leeggemaakt worden.

			Maar een ongedaanmaking van een ongedaanmaking of van een correctie is lastiger. Moet ik even over nadenken.

			1 first things first: een ongedaanmaking van REG x:
			- zoek de wijzigingen onder reg x op in de database
			- voor elke wijziging: bepaal of het een opvoer of afvoer is, en welke representatie het betreft
			- als het een opvoer is, dan moet het opvoertijdstip weer worden verwijderd uit het representatie record.
				(let op: dit is NIET afvoeren, maar zoiets als ont-opvoeren!)
			- als het een afvoer is, dan moet deze afvoer worden leeggemaakt in het representatie record (ont-afvoeren?)
				(zo is het record weer geldig, of actueel geworden)

			2 N.B. er moeten wel een paar checks gedaan worden
			- check of de te ongedaan maken registratie niet al ongedaan is gemaakt. Dat kan geen twee keer. Indien zo: fout en transactie rollback.
			- check of er tussen het oorspronkelijke registratiemoment en het ongedaanmakingsmoment geen correcties of andere wijzigingen
				(correcties of een afvoer) zijn doorgevoerd op hetzelfde gegevenselement.
				Dus de ongedaanmaking moet de laatste wijziging op dat gegevenselement zijn.
				Als dat zo is: melden en rollback (ongedaanmaking wordt ook niet vastgelegd).
				--> optie: een pacman-ongedaanmaking toestaan, waarbij alles wijzigingen na de te ongedaan maken registratie worden ongedaan gemaakt.
					Dat is wel een stuk complexer, omdat je hele registraties ongedaan wilt maken. Dat wil je eigenlijk niet automatisch met allerlei zij-effecten.
			- de registratie die ongedaan gemaakt wordt, is zelf een ongedaanmaking.
				Dat is op zich te doen, want je doet dan gewoon weer het omgekeerde van de eerste ongedaanmaking. Een hergedaanmaking of zoiets :-).
				Niet meteen bouwen.

		*/

		/* ====== ONGEDAANMAKING scenario ====== */
		if request.Registratie.Registratietype == model.RegistratietypeOngedaanmaking {
			// check of MaaktOngedaanRegistratieID is meegegeven
			if request.Registratie.MaaktOngedaanRegistratieID == nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "De ongedaan te maken registratie moet worden meegegeven via 'maakt_ongedaan_registratie_id' (of alias 'MaaktOngedaanRegistratieID')"})
				return
			}

			// check of de te ongedaan maken registratie bestaat
			var ongedaanTeMakenRegistratie model.Registratie
			err = DB.NewSelect().
				Model(&ongedaanTeMakenRegistratie).
				Where("id = ?", *request.Registratie.MaaktOngedaanRegistratieID).
				Scan(c.Request.Context())
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("De te ongedaan maken registratie met ID %d bestaat niet", *request.Registratie.MaaktOngedaanRegistratieID)})
				return
			}

			// check op afgeleid veld: deze registratie is al eerder ongedaan gemaakt.
			if ongedaanTeMakenRegistratie.IsOngedaangemaakt {
				c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("De te ongedaan maken registratie met ID %d is al ongedaan gemaakt", ongedaanTeMakenRegistratie.ID)})
				return
			}

			/* check of er sinds de te ongedaan maken registratie latere wijzigingen zijn gedaan op exact dezelfde elementen.
			Als dat zo is, dan is ongedaanmaking niet toegestaan omdat de te ongedaan maken registratie dan niet meer de laatste wijziging is.
			*/
			var wijzigingenOnderTeOngedaanMakenRegistratie []model.Wijziging
			err = DB.NewSelect().
				Model(&wijzigingenOnderTeOngedaanMakenRegistratie).
				Where("registratie_id = ?", ongedaanTeMakenRegistratie.ID).
				Scan(c.Request.Context())
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Fout bij ophalen wijzigingen onder te ongedaan maken registratie: %v", err)})
				return
			}

			for _, doelWijziging := range wijzigingenOnderTeOngedaanMakenRegistratie {
				var latereWijzigingen []model.Wijziging
				err = DB.NewSelect().
					Model(&latereWijzigingen).
					Where("registratie_id <> ?", ongedaanTeMakenRegistratie.ID).
					Where("tijdstip > ?", ongedaanTeMakenRegistratie.Tijdstip).
					Where("tijdstip <= ?", request.Registratie.Tijdstip).
					Where("COALESCE(entiteitnaam, '') = ?", doelWijziging.Entiteitnaam).
					Where("COALESCE(entiteit_id, '') = ?", doelWijziging.EntiteitID).
					Where("COALESCE(representatienaam, '') = ?", doelWijziging.Representatienaam).
					Where("COALESCE(representatie_id, '') = ?", doelWijziging.RepresentatieID).
					Scan(c.Request.Context())
				if err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Fout bij controleren op latere wijzigingen na registratie %d: %v", ongedaanTeMakenRegistratie.ID, err)})
					return
				}

				if len(latereWijzigingen) > 0 {
					c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Er zijn latere wijzigingen op hetzelfde gegevenselement; ongedaanmaking van registratie %d is daarom niet toegestaan. Doelwijziging: %v, latere wijzigingen: %v", ongedaanTeMakenRegistratie.ID, doelWijziging, latereWijzigingen)})
					return
				}
			}

			/* ### TODO ###
			ONGEDAANMAKING VAN EEN ONGEDAANMAKING
			- check of de te ongedaan maken registratie zelf een ongedaanmaking is
			- dat is op zich te doen, want je doet dan gewoon weer het omgekeerde van de eerste ongedaanmaking. Een hergedaanmaking of zoiets :-).
			- check of er wijzigingen zijn doorgevoerd sinds de ongedaanmaking die we nu willen ongedaan maken. Dat kan namelijk niet, want dan zou je een ongedaanmaking van een ongedaanmaking hebben die niet meer klopt.
			*/
			if ongedaanTeMakenRegistratie.IsOngedaanmaking() {
				// voor nu: stop
				c.JSON(http.StatusBadRequest, gin.H{"error": "Ongedaan maken van een ongedaanmaking is nog niet mogelijk"})
				return
			}

			/* MAAK NU ONGEDAAN (het betreft een registratie of correctie, beide functioneel gelijk, denk ik)
			 zoek de wijzigingen onder reg x op in de database
			- voor elke wijziging: bepaal of het een opvoer of afvoer is, en welke representatie het betreft
			- als het een opvoer is, dan moet het opvoertijdstip weer worden verwijderd uit het representatie record.
				(let op: dit is NIET afvoeren, maar zoiets als ont-opvoeren!)
			- als het een afvoer is, dan moet deze afvoer worden leeggemaakt in het representatie record (ont-afvoeren?)
				(zo is het record weer geldig, of actueel geworden)
			*/

			for _, wijziging := range wijzigingenOnderTeOngedaanMakenRegistratie {
				// als opvoer, dan ont-opvoeren
				switch wijziging.Wijzigingstype {
				case model.WijzigingstypeOpvoer:
					if err := handleRepresentatieOntOpvoer(c, tx, wijziging); err != nil {
						c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Fout bij ont-opvoeren van representatie: %v", err)})
						return
					}
				case model.WijzigingstypeAfvoer:
					if err := handleRepresentatieOntAfvoer(c, tx, wijziging); err != nil {
						c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Fout bij ont-afvoeren van representatie: %v", err)})
						return
					}
				}
			}

			// Markeer de ongedaan gemaakte registratie en al haar wijzigingen als afgeleid "ongedaan gemaakt".
			if _, err = tx.NewUpdate().
				Table("registratie").
				Set("is_ongedaan_gemaakt = ?", true).
				Where("id = ?", ongedaanTeMakenRegistratie.ID).
				Exec(c.Request.Context()); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Fout bij markeren van registratie %d als ongedaan gemaakt: %v", ongedaanTeMakenRegistratie.ID, err)})
				return
			}

			if _, err = tx.NewUpdate().
				Table("wijziging").
				Set("is_ongedaan_gemaakt = ?", true).
				Where("registratie_id = ?", ongedaanTeMakenRegistratie.ID).
				Exec(c.Request.Context()); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Fout bij markeren van wijzigingen onder registratie %d als ongedaan gemaakt: %v", ongedaanTeMakenRegistratie.ID, err)})
				return
			}

		}

		/*
			// Registratie, Correctie, Ongedaanmaking
			type Registratie struct {
				ID                         int64                `bun:"id,pk,autoincrement"` // auto-increment ID van de registratie
				Registratietype            RegistratietypeEnum  // Registratie, Correctie, Ongedaanmaking
				Tijdstip                   time.Time            // Het tijdstip van de registratie, correctie of ongedaanmaking
				Opmerking                  *string              // optioneel veld voor extra informatie
				CorrigeertRegistratieID    *int64               // bij correcties: verwijzing naar de registratie die gecorrigeerd wordt
				MaaktOngedaanRegistratieID *int64               // bij ongedaanmakings: verwijzing naar de registratie die ongedaan wordt gemaakt
			}
		*/

		/* check of er een param "ID" is meegegeven in de URL
		dit is dan de ID van de entiteit waarop de registratie betrekking heeft,
		en die we kunnen gebruiken voor:
		- Afvoer van de gehele entiteit (in dat geval is deze ID gelijk aan de ID van de entiteit in de opvoer)
		- wijziging op een of meer van de gegevenselementen van de entiteit (in dat geval is deze ID ook gelijk aan de ID van de entiteit,
		en waarnaar het gegevenselement verwijst via haar (bijv.) a_ID of B_ID veld.
		In de database is dit de FK naar de entiteit-tabel.
		- Bij correctie van een bestaande registratie (in dat geval is deze ID ook gelijk aan de ID van de entiteit).
		*/
		if c.Param("id") != "" {
			// we slaan deze ID op in de context zodat we er later bij kunnen
			c.Set("entiteitID", c.Param("id"))
		}

		// TODO: hier komt de nieuwe aanpak van registratie, waarbij we de registratie en wijziging(en) in één endpoint verwerken
		// we kunnen hierbij gebruik maken van de "entiteitID" param in de URL (optioneel) en/of de IDs in de opvoer/afvoer van de wijziging(en)
		// om te bepalen op welke entiteit en/of gegevenselementen de registratie betrekking heeft

		// Step 2: Process each wijziging
		for wijzigingIdx, wijziging := range request.Wijzigingen {
			var rep *model.RepresentatiePlusNaam
			if wijziging.Opvoer != nil {
				rep = wijziging.Opvoer // geen specifieke representatie verwacht; daar dealen we later wel mee

			} else if wijziging.Afvoer != nil {
				rep = wijziging.Afvoer // geen specifieke representatie verwacht; daar dealen we later wel mee
			}
			// TEST: print recursief de representatie, inclusief onderliggende gegevenselementen/relaties
			if debugLogsEnabled() {
				if rep != nil && rep.Representatie != nil {
					fmt.Printf("HANDLER: representatienaam=%s veldnaam=%s\n%s", rep.Representatienaam, rep.Veldnaam, model.RepresentatieToString(rep.Representatie))
				} else {
					fmt.Println("HANDLER: geen representatie aanwezig in wijziging")
				}
			}

			if rep == nil || rep.Representatie == nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("wijziging[%d] bevat geen representatie", wijzigingIdx)})
				return
			}

			temporalRep, ok := rep.Representatie.(model.FormeleRepresentatie)
			if !ok {
				c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("wijziging[%d]: representatie %T (veldnaam=%s) ondersteunt geen opvoer/afvoer interface", wijzigingIdx, rep.Representatie, rep.Veldnaam)})
				return
			}

			// process de WIJZIGING
			// kijk naar het metatype van de representatie
			// als opvoer iets anders dan afvoer
			// indien correctie of ongedaanmaking ook andere logica

			// Handle REGISTRATIE / OPVOER scenario
			switch true {
			// OPVOER scenario's
			case wijziging.Opvoer != nil:
				if err := handleRepresentatieOpvoer(c, tx, request.Registratie,
					"", "", rep.Representatienaam, temporalRep); err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("wijziging[%d]: opvoer van %s (veldnaam=%s) mislukt: %v", wijzigingIdx, rep.Representatienaam, rep.Veldnaam, err)})
					return
				}
			// AFVOER scenario's
			case wijziging.Afvoer != nil:
				if err := handleRepresentatieAfvoer(c, tx, registratieID, registratieTijdstip,
					"", "", rep.Representatienaam, temporalRep); err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("wijziging[%d]: afvoer van %s (veldnaam=%s) mislukt: %v", wijzigingIdx, rep.Representatienaam, rep.Veldnaam, err)})
					return
				}
			}

		}

		// ── Afgeleide domeinen: verzamel unieke domeinen uit TypeMeta voor alle wijzigingen ──
		domeinSet := make(map[string]struct{})
		for _, w := range request.Wijzigingen {
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
		request.Registratie.Domeinen = domeinen

		elapsedMs := time.Since(start).Milliseconds()
		responseStatus := http.StatusCreated
		responsePayload := gin.H{
			"message":        fmt.Sprintf("De registratie %d is succesvol verwerkt op %s in %d ms", registratieID, registratieTijdstip, elapsedMs),
			"registratie_id": registratieID,
			"registratieId":  registratieID,
			"tijdstip":       registratieTijdstip,
			"wijzigingen":    request.Wijzigingen,
		}
		responseBodyJSON, err := json.Marshal(responsePayload)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to serialize response body for audit: %v", err)})
			return
		}

		request.Registratie.ResponseCode = &responseStatus
		request.Registratie.ResponseBody = responseBodyJSON
		request.Registratie.DurationMs = &elapsedMs
		if _, err = tx.NewUpdate().
			Model(&request.Registratie).
			Column("response_code", "response_body", "duration_ms", "domeinen").
			Where("id = ?", registratieID).
			Exec(c.Request.Context()); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to update registratie audit fields: %v", err)})
			return
		}

		// Commit transaction
		if err := tx.Commit(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to commit transaction: %v", err)})
			return
		}
		committed = true

		// Succes response inclusief de gewijzigde gegevens
		c.JSON(responseStatus, responsePayload)

	}

}
