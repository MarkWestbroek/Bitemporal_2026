package model

// GeefOnderliggendeGegevenselementen returns all child representaties of A.
func (a *A) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0)

	for i := range a.Us {
		if a.Us[i].A_ID == 0 {
			a.Us[i].A_ID = a.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "A_U", Representatie: &a.Us[i]})
	}

	for i := range a.Vs {
		if a.Vs[i].A_ID == 0 {
			a.Vs[i].A_ID = a.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "A_V", Representatie: &a.Vs[i]})
	}

	for i := range a.Ws {
		if a.Ws[i].A_ID == 0 {
			a.Ws[i].A_ID = a.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "A_W", Representatie: &a.Ws[i]})
	}

	for i := range a.RelABs {
		if a.RelABs[i].A_ID == 0 {
			a.RelABs[i].A_ID = a.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "Rel_A_B", Representatie: &a.RelABs[i]})
	}

	// Materiële tijdlijn: aanvang/einde als onderliggende representaties meegeven,
	// zodat ze beschikbaar zijn voor de generieke opvoer/afvoer-handlers.
	for i := range a.Aanvang {
		if a.Aanvang[i].A_ID == 0 {
			a.Aanvang[i].A_ID = a.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "A_Aanvang", Representatie: &a.Aanvang[i]})
	}

	for i := range a.Einde {
		if a.Einde[i].A_ID == 0 {
			a.Einde[i].A_ID = a.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "A_Einde", Representatie: &a.Einde[i]})
	}

	return result
}

// GeefOnderliggendeGegevenselementen returns all child representaties of B.
func (b *B) GeefOnderliggendeGegevenselementen() []OnderliggendeRepresentatie {
	result := make([]OnderliggendeRepresentatie, 0)

	for i := range b.Xs {
		if b.Xs[i].B_ID == 0 {
			b.Xs[i].B_ID = b.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "B_X", Representatie: &b.Xs[i]})
	}

	for i := range b.Ys {
		if b.Ys[i].B_ID == 0 {
			b.Ys[i].B_ID = b.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "B_Y", Representatie: &b.Ys[i]})
	}

	// Materiële tijdlijn (zie toelichting bij A)
	for i := range b.Aanvang {
		if b.Aanvang[i].B_ID == 0 {
			b.Aanvang[i].B_ID = b.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "B_Aanvang", Representatie: &b.Aanvang[i]})
	}

	for i := range b.Einde {
		if b.Einde[i].B_ID == 0 {
			b.Einde[i].B_ID = b.ID
		}
		result = append(result, OnderliggendeRepresentatie{Typenaam: "B_Einde", Representatie: &b.Einde[i]})
	}

	return result
}
