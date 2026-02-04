package model

//Entiteiten
type A struct {
	id      string `json:"id"`
	_opvoer string `json:"opvoer"`
	_afvoer string `json:"afvoer"`
}

type B struct {
	id      string `json:"id"`
	_opvoer string `json:"opvoer"`
	_afvoer string `json:"afvoer"`
}

//Relaties
type Rel_AB struct {
	idA string `json:"idA"`
	idB string `json:"idB"`
}
