package handlers

import (
	"net/http"
	"sort"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemporal_go_API_v04/model"
	"github.com/gin-gonic/gin"
)

type vizSchemaChildDTO struct {
	Rolnaam         string `json:"rolnaam"`
	JSONRolnaam     string `json:"jsonRolnaam,omitempty"`
	Doeltype        string `json:"doeltype"`
	Momentvoorkomen string `json:"momentvoorkomen"`
}

type vizSchemaTypeDTO struct {
	Typenaam                  string              `json:"typenaam"`
	Metatype                  model.Metatype      `json:"metatype"`
	Kleur                     string              `json:"kleur,omitempty"`
	Veldnaam                  string              `json:"veldnaam"`
	Tabelnaam                 string              `json:"tabelnaam"`
	IDKolom                   string              `json:"idKolom"`
	HeeftPFK                  bool                `json:"heeftPFK"`
	EntiteitIDKolom           string              `json:"entiteitIDKolom,omitempty"`
	SecondaireEntiteitIDKolom string              `json:"secondaireEntiteitIDKolom,omitempty"`
	Momentvoorkomen           string              `json:"momentvoorkomen,omitempty"`
	Onderliggende             []vizSchemaChildDTO `json:"onderliggende,omitempty"`
}

type vizSchemaResponse struct {
	Versie string             `json:"versie"`
	Types  []vizSchemaTypeDTO `json:"types"`
}

func momentvoorkomenNaarString(m model.Momentvoorkomen) string {
	if m == model.Enkelvoudig {
		return "enkelvoudig"
	}
	return "meervoudig"
}

func MaakVizSchemaHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		typeNamen := make([]string, 0, len(model.MetaRegistry))
		for typeNaam := range model.MetaRegistry {
			typeNamen = append(typeNamen, typeNaam)
		}
		sort.Strings(typeNamen)

		items := make([]vizSchemaTypeDTO, 0, len(typeNamen))
		for _, typeNaam := range typeNamen {
			meta, ok := model.MetaRegistry.GetTypeMeta(typeNaam)
			if !ok {
				continue
			}

			item := vizSchemaTypeDTO{
				Typenaam:                  meta.Typenaam,
				Metatype:                  meta.Metatype,
				Kleur:                     meta.Kleur,
				Veldnaam:                  meta.Veldnaam,
				Tabelnaam:                 meta.Tabelnaam,
				IDKolom:                   meta.IDKolom,
				HeeftPFK:                  meta.HeeftPFK,
				EntiteitIDKolom:           meta.EntiteitIDKolom,
				SecondaireEntiteitIDKolom: meta.SecondaireEntiteitIDKolom,
			}

			if meta.Metatype != model.MetatypeEntiteit {
				item.Momentvoorkomen = momentvoorkomenNaarString(meta.Momentvoorkomen)
			}

			if len(meta.OnderliggendeGegevenselementen) > 0 {
				children := make([]vizSchemaChildDTO, 0, len(meta.OnderliggendeGegevenselementen))
				for _, child := range meta.OnderliggendeGegevenselementen {
					children = append(children, vizSchemaChildDTO{
						Rolnaam:         child.Rolnaam,
						JSONRolnaam:     child.JSONRolnaam,
						Doeltype:        child.Doeltype,
						Momentvoorkomen: momentvoorkomenNaarString(child.Momentvoorkomen),
					})
				}
				item.Onderliggende = children
			}

			items = append(items, item)
		}

		c.JSON(http.StatusOK, vizSchemaResponse{
			Versie: "v1",
			Types:  items,
		})
	}
}
