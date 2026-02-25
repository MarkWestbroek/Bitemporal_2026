package handlers

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemporal_go_API_v03/model"
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

		// TIJDELIJK: OVERWRITE registratietijdstip met een tijdstip gebaseerd op de registratie ID, zodat we oplopende tijdstippen hebben voor testdoeleinden
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
			- // LATER // indien niet: zoek de eerste wijziging in de registratie, en kijk of die verwijst naar een gegevenselement dat gebruikt werd in andere registratie
			- Een entiteit zelf kan niet gewijzigd worden, BEHALVE de materiele tijden (aanvang, einde)

			PROBLEEM:
			- een registratie kan nu meer dan één entiteit betreffen
			- op zich zou hetzelfde formaat gebruikt kunnen worden voor correctie, bijv.:
			{
				"registratie": {
					"registratietype": "correctie",
					"tijdstip": "2026-01-12T11:00:00Z",
					"opmerking": "Corrigeer U3 van entiteit A2",
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
										"bbb": "b2-correctie"
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




		*/

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

		//Haal de "methode" query param op, die aangeeft of we de reflectie-based aanpak willen gebruiken
		// of de aanpak waarbij we de 'metamap' gebruiken
		// vermoedelijk is er verschil in afhandelingstijd, omdat reflectie meer overhead heeft,
		// maar moeten we wel de metamap inrichten.
		methode := strings.ToLower(c.Query("methode"))
		useReflectie := methode == "reflectie"

		// Step 2: Process each wijziging
		for _, wijziging := range request.Wijzigingen {
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
				c.JSON(http.StatusBadRequest, gin.H{"error": "wijziging bevat geen representatie"})
				return
			}

			temporalRep, ok := rep.Representatie.(model.FormeleRepresentatie)
			if !ok {
				c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("representatie %T ondersteunt geen opvoer/afvoer interface", rep.Representatie)})
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
				// ZONDER REFLECTIE
				handleOpvoer := handleRepresentatieOpvoerMeta
				// MET REFLECTIE
				if useReflectie {
					handleOpvoer = handleRepresentatieOpvoerMetReflectie
				}
				if err := handleOpvoer(c, tx, registratieID, registratieTijdstip,
					rep.Representatienaam, temporalRep); err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to handle opvoer van %s: %v", rep.Representatienaam, err)})
					return
				}
			// AFVOER scenario's
			case wijziging.Afvoer != nil:
				if err := handleRepresentatieAfvoer(c, tx, registratieID, registratieTijdstip,
					rep.Representatienaam, temporalRep); err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to handle afvoer van %s: %v", rep.Representatienaam, err)})
					return
				}
			}

		}

		// Commit transaction
		if err := tx.Commit(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to commit transaction: %v", err)})
			return
		}
		committed = true

		elapsedMs := time.Since(start).Milliseconds()
		// Succes response
		c.JSON(http.StatusCreated,
			gin.H{"message": fmt.Sprintf("De registratie %d is succesvol verwerkt op %s in %d ms", registratieID, registratieTijdstip, elapsedMs)})

	}

}

/*





===== HANDLER FUNCTIES NOG SPECIFIEK VOOR A OF B FLOW ======








*/
// DEPRECATED: deze functies worden vervangen door generieke functies
// die op basis van de representatienaam en het metatype van de representatie
// bepalen wat er precies moet gebeuren

// MakeRegisterFullEntityHandlerA handles bitemporal registration for Full_A entities
func MakeRegisterFullEntityHandlerA() gin.HandlerFunc {
	return func(c *gin.Context) {
		var request model.RegistreerRequest
		// Hier wordt de UnmarshalJSON method op RepresentatiePlusNaam aangeroepen,
		// die op zijn beurt de UnmarshalJSON (json.Unmarshal) method op Representatie aanroept,
		// waardoor de juiste struct (Full_A of Full_B) wordt geïnitialiseerd
		// op basis van het "type" veld in de JSON body
		if err := c.ShouldBindJSON(&request); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

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

		// Step 1: Insert Registratie and get ID + Tijdstip
		_, err = tx.NewInsert().
			Model(&request.Registratie).
			Returning("id").
			Exec(c.Request.Context())
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to insert registratie: %v", err)})
			return
		}
		registratieID := request.Registratie.ID
		registratieTijdstip := request.Registratie.Tijdstip

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

		// Step 2: Process each wijziging
		for _, wijziging := range request.Wijzigingen {
			if wijziging.Opvoer != nil {
				opvoerA, err := wijziging.Opvoer.AsA()
				if err != nil {
					c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("invalid opvoer for A flow: %v", err)})
					return
				}

				// Handle OPVOER scenario
				if err := handleOpvoerA(c, tx, opvoerA, registratieID, registratieTijdstip); err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to handle opvoer: %v", err)})
					return
				}
			} else if wijziging.Afvoer != nil {
				afvoerA, err := wijziging.Afvoer.AsA()
				if err != nil {
					c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("invalid afvoer for A flow: %v", err)})
					return
				}

				// Handle AFVOER scenario
				if err := handleAfvoerA(c, tx, afvoerA, registratieID, registratieTijdstip); err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to handle afvoer: %v", err)})
					return
				}
			}
		}

		// Commit transaction
		if err := tx.Commit(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to commit transaction: %v", err)})
			return
		}
		committed = true

		c.JSON(http.StatusCreated, gin.H{"message": "Registration completed successfully", "registratie_id": registratieID})
	}
}

// MakeRegisterFullEntityHandlerB handles bitemporal registration for Full_B entities
func MakeRegisterFullEntityHandlerB() gin.HandlerFunc {
	return func(c *gin.Context) {
		var request model.RegistreerRequest
		if err := c.ShouldBindJSON(&request); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

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

		// Step 1: Insert Registratie and get ID + Tijdstip
		_, err = tx.NewInsert().
			Model(&request.Registratie).
			Returning("id").
			Exec(c.Request.Context())
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to insert registratie: %v", err)})
			return
		}
		registratieID := request.Registratie.ID
		registratieTijdstip := request.Registratie.Tijdstip

		// Step 2: Process each wijziging
		for _, wijziging := range request.Wijzigingen {
			if wijziging.Opvoer != nil {
				opvoerB, err := wijziging.Opvoer.AsB()
				if err != nil {
					c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("invalid opvoer for B flow: %v", err)})
					return
				}

				// Handle OPVOER scenario
				if err := handleOpvoerB(c, tx, opvoerB, registratieID, registratieTijdstip); err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to handle opvoer: %v", err)})
					return
				}
			} else if wijziging.Afvoer != nil {
				afvoerB, err := wijziging.Afvoer.AsB()
				if err != nil {
					c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("invalid afvoer for B flow: %v", err)})
					return
				}

				// Handle AFVOER scenario
				if err := handleAfvoerB(c, tx, afvoerB, registratieID, registratieTijdstip); err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to handle afvoer: %v", err)})
					return
				}
			}
		}

		// Commit transaction
		if err := tx.Commit(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to commit transaction: %v", err)})
			return
		}
		committed = true

		c.JSON(http.StatusCreated, gin.H{"message": "Registration completed successfully", "registratie_id": registratieID})
	}
}
