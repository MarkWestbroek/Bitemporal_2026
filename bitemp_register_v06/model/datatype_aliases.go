package model

// custom_datatypes.go — basale Go alias-types voor domeinspecifieke datatypes.
//
// De codegenerator kan velden typen als `BSN` of `NLPostcode` wanneer een
// V3-model custom datatypes definieert. Deze aliases houden de runtime-representatie
// bewust eenvoudig (onderliggend `string`), terwijl de domeinbetekenis in de
// gegenereerde Go structs behouden blijft.
//
// Validatie- en weergaveregels blijven in `DatatypeRegistry` staan.

// NLPostcode representeert een Nederlandse postcode als domeinspecifiek stringtype.
type NLPostcode string

// BSN representeert een burgerservicenummer als domeinspecifiek stringtype.
type BSN string
