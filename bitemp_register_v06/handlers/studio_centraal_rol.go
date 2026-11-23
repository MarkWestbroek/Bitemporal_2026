package handlers

// De rol ontwerper en de centrale projecten (plan "Sidecar-project" §10, stap 7; Mark 22/23-11).
//
// Een **centraal project** is het profielen- of weergaveproject waarvan op deze instantie een
// versie is uitgebracht (studio_project_uitgaven, zonder bron: hier uitgebracht). Zijn **MAIN**
// is van de beheerder: alleen die wijzigt het, voegt er een branch in samen en brengt uit.
// Ieder ander houdt op MAIN hooguit het recht lezen, ook de eigenaar of wie schrijven kreeg.
// Een **ontwerper** (of bouwer) maakt een branch van MAIN en werkt daarin: een concept. De
// branch is een gewoon project (de ontwerper is eigenaar), dus daar gelden de gewone regels.
//
// Zo werkt het overal tegelijk: projectRechtVan topt het recht af, dus PUT, POST …/ops,
// samenvoegen naar de ouder (studio_project_vergelijk.go) en verwijderen weigeren vanzelf, en
// de Studio ziet "lezen" in de meta. De lijst topt af met dezelfde regel.
//
// Waarom "een uitgebrachte versie" en niet de soort in de projectkop: de server kijkt niet in
// de blob (die kan 1,5 MB zijn en elke operatie gaat door deze controle). Vóór de eerste versie
// is er ook nog niets centraals om te beschermen.
//
// Een modelleur (niveau 2) kan geen branch van een centraal project maken (besluit Mark 16-10:
// profielen zijn alleen-lezen voor de modelleur).

import (
	"context"
	"net/http"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/middleware"
	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
	"github.com/gin-gonic/gin"
	"github.com/uptrace/bun"
)

// CentraalMeldingMain staat in de 403 als het recht door de centrale regel is afgetopt.
const CentraalMeldingMain = "Dit is een centraal project: alleen de beheerder wijzigt het. Maak een branch (rechtsklik op een map → Branch maken…) om er als ontwerper aan te werken; de beheerder voegt hem samen en brengt de versie uit."

// aftoppenCentraal is de regel, zuiver: op de MAIN van een centraal project houdt wie geen
// beheerder is hooguit lezen.
func aftoppenCentraal(r ProjectRecht, rol string, centraalMain bool) ProjectRecht {
	if centraalMain && !middleware.IsBeheerder(rol) && r > RechtLezen {
		return RechtLezen
	}
	return r
}

// magCentraalAfsplitsen: een branch van een centraal project vraagt minstens de rol ontwerper.
func magCentraalAfsplitsen(rol string) bool {
	return middleware.RolNiveau(rol) >= middleware.RolNiveau("ontwerper")
}

// isCentraalMain: geen branch, en er is hier een versie van uitgebracht.
func isCentraalMain(ctx context.Context, db bun.IDB, projectID, ouderProjectID string) (bool, error) {
	if ouderProjectID != "" {
		return false, nil
	}
	return db.NewSelect().Model((*model.StudioProjectUitgave)(nil)).
		Where("project_id = ? AND COALESCE(bron, '') = ''", projectID).Exists(ctx)
}

// centraleMainIDs: alle projecten met een hier uitgebrachte versie (voor de lijst; één query).
func centraleMainIDs(ctx context.Context, db bun.IDB) (map[string]bool, error) {
	var ids []string
	if err := db.NewSelect().Model((*model.StudioProjectUitgave)(nil)).ColumnExpr("DISTINCT project_id").
		Where("COALESCE(bron, '') = ''").Scan(ctx, &ids); err != nil {
		return nil, err
	}
	uit := make(map[string]bool, len(ids))
	for _, id := range ids {
		uit[id] = true
	}
	return uit, nil
}

// ouderVan: de ouder van een project ("" = geen branch, of het project bestaat niet).
func ouderVan(ctx context.Context, db bun.IDB, projectID string) (string, error) {
	var ouder []string
	err := db.NewSelect().Model((*model.StudioProject)(nil)).ColumnExpr("COALESCE(ouder_project_id, '')").
		Where("id = ?", projectID).Scan(ctx, &ouder)
	if err != nil || len(ouder) == 0 {
		return "", err
	}
	return ouder[0], nil
}

// weigerCentraalAfsplitsen schrijft de 403 als de gebruiker geen branch van dit centrale
// project mag maken; true = geweigerd.
func weigerCentraalAfsplitsen(c *gin.Context, ctx context.Context, db bun.IDB, ouder *model.StudioProject) bool {
	if !middleware.IsAuthEnabled() {
		return false
	}
	claims := middleware.GetClaims(c)
	rol := ""
	if claims != nil {
		rol = claims.Rol
	}
	if magCentraalAfsplitsen(rol) {
		return false
	}
	centraal, err := isCentraalMain(ctx, db, ouder.ID, ouder.OuderProjectID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Centrale versies lezen mislukt: " + err.Error()})
		return true
	}
	if !centraal {
		return false
	}
	c.JSON(http.StatusForbidden, gin.H{"reden": "centraal_ontwerper",
		"error": "Een branch van een centraal project maken vraagt de rol ontwerper (of hoger)."})
	return true
}

// isCentraalMainStil: isCentraalMain voor de meta; een fout telt als "nee" (alleen informatief).
func isCentraalMainStil(ctx context.Context, projectID, ouderProjectID string) bool {
	ja, err := isCentraalMain(ctx, DB, projectID, ouderProjectID)
	return err == nil && ja
}
