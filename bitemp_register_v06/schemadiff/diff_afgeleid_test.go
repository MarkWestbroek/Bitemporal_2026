package schemadiff

import (
	"testing"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
)

func metAfgeleideWijk(m model.V3Model) model.V3Model {
	m.Entiteiten[0].Relaties = append(append([]model.V3Relatie{}, m.Entiteiten[0].Relaties...), model.V3Relatie{
		Naam: "Woonwijk", Meervoud: "woonwijk", Momentvoorkomen: "enkelvoudig", DoelEntiteit: "Adres",
		Afgeleid: true, AfleidingsregelTaal: "cel", Afleidingsregel: "rel-persoon-adressen",
	})
	return m
}

// Een afgeleide relatie erbij of eraf is metadata: geen DDL, geen breaking change.
func TestAfgeleideRelatie_ToegevoegdEnVerwijderdZonderMigratie(t *testing.T) {
	oud := maakBasisModel()
	nieuw := metAfgeleideWijk(maakBasisModel())

	for naam, rapport := range map[string]DeltaRapport{"toegevoegd": Vergelijk(oud, nieuw), "verwijderd": Vergelijk(nieuw, oud)} {
		if len(rapport.Items) != 1 || rapport.Items[0].Categorie != CategorieAfgeleideRelatie || rapport.Items[0].Ernst != Informatief {
			t.Fatalf("%s: verwacht één informatief afgeleide_relatie-item, kreeg %+v", naam, rapport.Items)
		}
		if rapport.HeeftDBMigratie() || rapport.IsBreaking() {
			t.Fatalf("%s: afgeleide relatie mag geen migratie of breaking change geven", naam)
		}
		if stmts := GenereerMigratie(rapport).Statements; len(stmts) != 0 {
			t.Fatalf("%s: verwacht geen SQL, kreeg %+v", naam, stmts)
		}
	}
}

func TestAfgeleideRelatie_RegelGewijzigdIsInformatief(t *testing.T) {
	oud := metAfgeleideWijk(maakBasisModel())
	nieuw := metAfgeleideWijk(maakBasisModel())
	nieuw.Entiteiten[0].Relaties[1].Afleidingsregel = "self"

	rapport := Vergelijk(oud, nieuw)
	if len(rapport.Items) != 1 || rapport.Items[0].Ernst != Informatief || rapport.Items[0].NieuweWaarde != "self" {
		t.Fatalf("verwacht één informatief item voor de regel, kreeg %+v", rapport.Items)
	}
}

// Opgeslagen → afgeleid: de relatietabel vervalt (destructief, DROP als commentaar).
// Afgeleid → opgeslagen: er komt een tabel bij (additief).
func TestAfgeleideRelatie_OmzettenRaaktDeTabel(t *testing.T) {
	opgeslagen := maakBasisModel()
	afgeleid := maakBasisModel()
	afgeleid.Entiteiten[0].Relaties[0].Afgeleid = true
	afgeleid.Entiteiten[0].Relaties[0].Afleidingsregel = "self"

	naarAfgeleid := Vergelijk(opgeslagen, afgeleid)
	if len(naarAfgeleid.Items) != 1 || naarAfgeleid.Items[0].Ernst != Destructief ||
		naarAfgeleid.Items[0].Categorie != CategorieRelatie || naarAfgeleid.Items[0].Actie != ActieVerwijderd {
		t.Fatalf("opgeslagen→afgeleid: verwacht één destructief verwijder-item, kreeg %+v", naarAfgeleid.Items)
	}
	naarOpgeslagen := Vergelijk(afgeleid, opgeslagen)
	if len(naarOpgeslagen.Items) != 1 || naarOpgeslagen.Items[0].Ernst != Additief ||
		naarOpgeslagen.Items[0].Actie != ActieToeGevoegd {
		t.Fatalf("afgeleid→opgeslagen: verwacht één additief toevoeg-item, kreeg %+v", naarOpgeslagen.Items)
	}
	if len(GenereerMigratie(naarOpgeslagen).Statements) == 0 {
		t.Fatal("afgeleid→opgeslagen: verwacht CREATE TABLE-statements")
	}
}
