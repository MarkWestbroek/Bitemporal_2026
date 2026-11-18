package model

// v3_marks.go — de marks-bijlage bij een V3-model (besluit Mark 18-11-2026; plan
// docs/plans/2026-11-18 MARKs — markeringen op het model (plan).md).
//
// Een MARK is een markering op een modelelement voor iets dat orthogonaal op het model staat
// (MDA: een aanwijzing voor de transformatie). Marks staan daarom niet op het veld, maar als
// bijlage naast het model:
//
//	"marks": { "context": ["algemeen"],
//	           "marks": [ { "doel": {"soort": "veld", "uuid": "…"},
//	                        "soort": "register.zoeksleutel", "waarde": true } ] }
//
// De Studio levert alleen de marks die in de gekozen context gelden. Een V3 zonder `marks`
// blijft geldig. De transformatie naar een register (codegen) leest de soorten met naamruimte
// `register.`; andere soorten gaan ongelezen mee.
//
// M-niveaus: de marksoort hoort bij de transformatie (M2), de mark zelf bij het model (M1),
// los van de inhoud van dat model.

// Marksoorten die de codegen leest. Beide zijn een boolean op een veld.
const (
	// MarkZoeksleutel: op dit veld wordt gezocht (exact of op bereik): index op de kolom.
	MarkZoeksleutel = "register.zoeksleutel"
	// MarkSorteerbaar: op dit veld wordt gesorteerd: index op de kolom.
	MarkSorteerbaar = "register.sorteerbaar"
	// MarkTekstzoeken is gereserveerd (zoeken op een deel van een tekst, ander indextype);
	// nog niet gelezen.
	MarkTekstzoeken = "register.tekstzoeken"
)

// V3MarksBijlage is de bijlage `marks` naast het model.
type V3MarksBijlage struct {
	Context []string `json:"context,omitempty"` // de lagen waarvoor de marks gelden, in volgorde
	Marks   []V3Mark `json:"marks,omitempty"`
}

// V3Mark is één geldende mark.
type V3Mark struct {
	Doel   V3MarkDoel `json:"doel"`
	Soort  string     `json:"soort"`
	Waarde any        `json:"waarde"`
}

// V3MarkDoel wijst het gemarkeerde element aan op zijn uuid.
type V3MarkDoel struct {
	Soort string `json:"soort"` // "veld", "element", …
	UUID  string `json:"uuid"`
}

// PasRegisterMarksToe zet de marks met naamruimte `register.` op de velden van het model
// (V3Veld.Zoeksleutel, V3Veld.Sorteerbaar) en geeft meldingen terug voor wat niet geplaatst
// kon worden. Een melding is geen fout: de bouw gaat door.
//
//   - een mark op een uuid die niet in het model staat;
//   - een bekende marksoort op iets anders dan een veld;
//   - een waarde die geen boolean is.
//
// Andere marksoorten (een andere naamruimte, of register.tekstzoeken) worden overgeslagen.
func PasRegisterMarksToe(v3 *V3Model) []string {
	if v3 == nil || v3.Marks == nil || len(v3.Marks.Marks) == 0 {
		return nil
	}
	velden := map[string]*V3Veld{}
	for ei := range v3.Entiteiten {
		ent := &v3.Entiteiten[ei]
		for gi := range ent.Gegevenselementen {
			ge := &ent.Gegevenselementen[gi]
			for vi := range ge.Velden {
				if u := ge.Velden[vi].UUID; u != "" {
					velden[u] = &ge.Velden[vi]
				}
			}
		}
		for ri := range ent.Relaties {
			rel := &ent.Relaties[ri]
			for vi := range rel.Velden {
				if u := rel.Velden[vi].UUID; u != "" {
					velden[u] = &rel.Velden[vi]
				}
			}
		}
	}

	var meldingen []string
	for _, m := range v3.Marks.Marks {
		if m.Soort != MarkZoeksleutel && m.Soort != MarkSorteerbaar {
			continue
		}
		if m.Doel.Soort != "veld" {
			meldingen = append(meldingen, "mark "+m.Soort+" staat op een "+m.Doel.Soort+" ("+m.Doel.UUID+"); alleen een veld kan hem dragen")
			continue
		}
		aan, ok := m.Waarde.(bool)
		if !ok {
			meldingen = append(meldingen, "mark "+m.Soort+" op "+m.Doel.UUID+" heeft geen ja/nee-waarde; overgeslagen")
			continue
		}
		veld := velden[m.Doel.UUID]
		if veld == nil {
			meldingen = append(meldingen, "mark "+m.Soort+": geen veld met uuid "+m.Doel.UUID+" in dit model; overgeslagen")
			continue
		}
		switch m.Soort {
		case MarkZoeksleutel:
			veld.Zoeksleutel = aan
		case MarkSorteerbaar:
			veld.Sorteerbaar = aan
		}
	}
	return meldingen
}
