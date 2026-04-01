# Chat: in de http://localhost:5174/viz/react/editor-v2.html zorgt laden van api/schema/...

- **Datum**: 2026-03-30 22:08
- **Sessie-ID**: `14fd219b-1bbe-41a9-9b14-9a0d1dd71b52`
- **Berichten**: 21

---

## 🧑 User

in de http://localhost:5174/viz/react/editor-v2.html zorgt laden van api/schema/model/code?domein=np-loc opeens niet meer voor een subset (het domein) van de in de code zittende metadata.

Wat is er mis geraakt?

---

## 🤖 Assistant

Ik heb de instructies binnen en ga nu de exacte codepaden naar `api/schema/model/code` en de domeinfiltering opzoeken, zodat we de regressie direct kunnen pinpointen.Ik heb de vermoedelijke oorzaak gevonden: de frontend-call voor `editor-v2` lijkt de `domein`-query helemaal niet meer mee te sturen. Ik check nu nog snel de omliggende code om te bevestigen dat dit pad echt door die pagina gebruikt wordt.Ik zie nu ook dat `editor-v2` standaard juist de DB-versie laadt ( → ), niet de code-export. Ik controleer nog of ergens in de editor de URL met `?domein=...` wordt genegeerd of overschreven.Ik heb net live geverifieerd dat de backendfilter nog werkt, maar nauwelijks: `73` types zonder domein versus `71` met . Ik ga nu de filterlogica zelf lezen; waarschijnlijk worden types zonder domeinlabel alsnog meegenomen.Ik zie nu de kern: het overgrote deel van de types heeft  en de huidige filterlogica laat lege domeinen expliciet door. Ik check nog welke MetaRegistry-bestanden dit veroorzaken, zodat we precies kunnen aanwijzen wat is misgeraakt.

---

## 🧑 User

hij moet recursief kijken: domein staat niet in elk metamodel element maar in de root entiteiten

---

## 🤖 Assistant


```

```

```

```

```

```
Ik heb de patch en regressietest gezet; nu run ik alleen de relevante handler-testen om te bevestigen dat de recursive domeinfiltering werkt zoals bedoeld.Klopt, dit was precies het probleem.  
De filter keek niet recursief vanaf root-entiteiten, maar per individueel type. Daardoor kwamen heel veel types met leeg domein toch mee.

**Wat er mis was**
1. In  filterde BouwFlatTypeRegistry alleen op meta.Domein van elk los type.
2. De oude conditie liet types met leeg domein impliciet door, dus je kreeg geen echte domeinsubset.

**Wat ik heb aangepast**
1. Nieuwe recursive selectie toegevoegd in :
   
2. Deze start bij root-entiteiten met:
   - Domein == gevraagd domein
   - of Domein == register
3. Daarna loopt hij recursief via OnderliggendeGegevenselementen en neemt alle bereikbare child-typen mee, ook zonder eigen Domein-label.
4. BouwFlatTypeRegistry gebruikt nu die allowed set in plaats van losse per-type domeincheck:
   

**Regressietest toegevoegd**
-   
  TestBouwFlatTypeRegistry_DomeinFilterIsRecursiefVanafRootEntiteiten

**Documentatie bijgewerkt**
- 

**Validatie**
- Relevante testfile gedraaid: 2 tests, 0 failures.

Als je de API-server nog draait op oude binary/process: even herstarten, anders zie je de nieuwe filterlogica nog niet in [http://localhost:8082/api/schema/model/code?domein=np-loc](http://localhost:8082/api/schema/model/code?domein=np-loc).

---

## 🧑 User

dit is wat ik krijg op /api/schema/model/code?domein=np-loc

{
    "bron": "code",
    "build_versie": "",
    "go_module": "",
    "id": null,
    "indiener": "",
    "model": {
        "versie": "v3",
        "datatypes": [
            {
                "naam": "NLPostcode",
                "basistype": "string",
                "format": "nl-postcode",
                "validatie": {
                    "pattern": "^[1-9][0-9]{3}\\s?[A-Za-z]{2}$",
                    "minLength": 6,
                    "maxLength": 7,
                    "voorbeelden": [
                        "1234 AB",
                        "9999ZZ"
                    ],
                    "foutmelding": "Voer een geldige postcode in (bijv. 1234 AB)"
                },
                "normalisatie": "uppercase_letters",
                "weergave": {
                    "placeholder": "1234 AB",
                    "inputMask": "0000 AA"
                }
            },
            {
                "naam": "BSN",
                "basistype": "string",
                "format": "bsn",
                "validatie": {
                    "pattern": "^[0-9]{9}$",
                    "minLength": 9,
                    "maxLength": 9,
                    "voorbeelden": [
                        "123456782"
                    ],
                    "foutmelding": "Voer een geldig BSN in (9 cijfers, 11-proef)",
                    "regels": [
                        {
                            "naam": "11-proef",
                            "type": "checksum",
                            "expressie": "(9*d1 + 8*d2 + 7*d3 + 6*d4 + 5*d5 + 4*d6 + 3*d7 + 2*d8 - 1*d9) % 11 == 0"
                        }
                    ]
                },
                "weergave": {
                    "placeholder": "123456782",
                    "inputMask": "000000000"
                }
            },
            {
                "naam": "NLPostcode",
                "description": "Nederlandse postcode (4 cijfers + 2 letters)",
                "basistype": "string",
                "format": "nl-postcode",
                "domein": "register",
                "positie": {
                    "x": 750,
                    "y": 345
                },
                "validatie": {
                    "pattern": "^[1-9][0-9]{3}\\s?[A-Za-z]{2}$",
                    "minLength": 6,
                    "maxLength": 7,
                    "voorbeelden": [
                        "1234 AB",
                        "9999ZZ"
                    ],
                    "foutmelding": "Voer een geldige postcode in (bijv. 1234 AB)"
                },
                "normalisatie": "uppercase_letters",
                "weergave": {
                    "placeholder": "1234 AB",
                    "inputMask": "0000 AA"
                }
            },
            {
                "naam": "BSN",
                "description": "Burgerservicenummer (9 cijfers, 11-proef)",
                "basistype": "string",
                "format": "bsn",
                "domein": "register",
                "positie": {
                    "x": -480,
                    "y": 165
                },
                "validatie": {
                    "pattern": "^[0-9]{9}$",
                    "minLength": 9,
                    "maxLength": 9,
                    "voorbeelden": [
                        "123456782"
                    ],
                    "foutmelding": "Voer een geldig BSN in (9 cijfers, 11-proef)",
                    "regels": [
                        {
                            "naam": "11-proef",
                            "type": "checksum",
                            "expressie": "(9*d1 + 8*d2 + 7*d3 + 6*d4 + 5*d5 + 4*d6 + 3*d7 + 2*d8 - 1*d9) % 11 == 0"
                        }
                    ]
                },
                "weergave": {
                    "placeholder": "123456782",
                    "inputMask": "000000000"
                }
            }
        ],
        "enums": [
            {
                "goType": "Naamgebruiksoort",
                "baseType": "string",
                "positie": {
                    "x": 285,
                    "y": 405
                },
                "waarden": [
                    {
                        "constNaam": "NaamgebruiksoortEigenNaam",
                        "waarde": "EigenNaam"
                    },
                    {
                        "constNaam": "NaamgebruiksoortPartnerNaam",
                        "waarde": "PartnerNaam"
                    },
                    {
                        "constNaam": "NaamgebruiksoortEigenNaamPartnerNaam",
                        "waarde": "EigenNaam-PartnerNaam"
                    },
                    {
                        "constNaam": "NaamgebruiksoortPartnerNaamEigenNaam",
                        "waarde": "PartnerNaam-EigenNaam"
                    }
                ]
            },
            {
                "goType": "Bereikbaarheidssoort",
                "baseType": "string",
                "positie": {
                    "x": 330,
                    "y": 60
                },
                "waarden": [
                    {
                        "constNaam": "BereikbaarheidssoortWoonadres",
                        "waarde": "Woonadres"
                    },
                    {
                        "constNaam": "BereikbaarheidssoortBriefadres",
                        "waarde": "Briefadres"
                    },
                    {
                        "constNaam": "BereikbaarheidssoortCorrespondentieadres",
                        "waarde": "Correspondentieadres"
                    }
                ]
            },
            {
                "goType": "ReferentielijstAdrestype",
                "baseType": "string",
                "positie": {
                    "x": 1890,
                    "y": 120
                },
                "waarden": [
                    {
                        "constNaam": "ReferentielijstAdrestypeURL",
                        "waarde": "URL"
                    },
                    {
                        "constNaam": "ReferentielijstAdrestypeURN",
                        "waarde": "URN"
                    }
                ]
            }
        ],
        "referentielijstInstanties": [
            {
                "systeemnaam": "AdellijkeTitels",
                "naam": "AdellijkeTitels",
                "omschrijving": "Adellijke titels in Nederland"
            },
            {
                "systeemnaam": "Landenlijst",
                "naam": "Landenlijst",
                "omschrijving": "Alle landen van de wereld",
                "positie": {
                    "x": 1065,
                    "y": -90
                }
            }
        ],
        "entiteiten": [
            {
                "typenaam": "AdellijkeTitel",
                "description": "Referentielijst-item: adellijke titel.",
                "entiteitSubtype": "referentielijst_item",
                "kleur": "#c4b5fd",
                "meervoud": "adellijke_titels",
                "runtime": {
                    "veldnaam": "adellijketitel",
                    "padnaam": "adellijke_titels",
                    "tabelnaam": "adellijketitel",
                    "idKolom": "id",
                    "klassenaam": "AdellijkeTitel"
                },
                "gegevenselementen": [
                    {
                        "naam": "AdellijkeTitelTitel",
                        "description": "Enkelvoudig gegevenselement titel van AdellijkeTitel.",
                        "meervoud": "adellijke_titel_titels",
                        "momentvoorkomen": "enkelvoudig",
                        "runtime": {
                            "veldnaam": "adellijketiteltitel",
                            "padnaam": "adellijke_titel_titels",
                            "tabelnaam": "adellijketiteltitel",
                            "idKolom": "rel_id",
                            "heeftPFK": true,
                            "entiteitIDKolom": "adellijketitel_id",
                            "klassenaam": "AdellijkeTitelTitel",
                            "relatieveAutoincrement": true
                        },
                        "velden": [
                            {
                                "naam": "titel",
                                "goType": "string",
                                "type": "string",
                                "verplicht": true
                            }
                        ]
                    }
                ]
            },
            {
                "typenaam": "Land",
                "description": "Referentielijst-item: individueel land.",
                "entiteitSubtype": "referentielijst_item",
                "isMaterieel": true,
                "kleur": "#fde68a",
                "meervoud": "landen",
                "positie": {
                    "x": 1215,
                    "y": 345
                },
                "runtime": {
                    "veldnaam": "land",
                    "padnaam": "landen",
                    "tabelnaam": "land",
                    "idKolom": "id",
                    "klassenaam": "Land"
                },
                "gegevenselementen": [
                    {
                        "naam": "Landcode",
                        "description": "Enkelvoudig gegevenselement landcode van Land.",
                        "meervoud": "landcodes",
                        "momentvoorkomen": "enkelvoudig",
                        "positie": {
                            "x": 1095,
                            "y": 555
                        },
                        "id": "edge_1774646153149_10",
                        "sourceHandle": "bottom",
                        "targetHandle": "top",
                        "runtime": {
                            "veldnaam": "landcode",
                            "padnaam": "landcodes",
                            "tabelnaam": "landcode",
                            "idKolom": "rel_id",
                            "heeftPFK": true,
                            "entiteitIDKolom": "land_id",
                            "klassenaam": "Landcode",
                            "relatieveAutoincrement": true
                        },
                        "velden": [
                            {
                                "naam": "code",
                                "goType": "string",
                                "type": "string",
                                "verplicht": true
                            }
                        ]
                    },
                    {
                        "naam": "Landnaam",
                        "description": "Enkelvoudig gegevenselement landnaam van Land.",
                        "meervoud": "landnamen",
                        "momentvoorkomen": "enkelvoudig",
                        "positie": {
                            "x": 1335,
                            "y": 555
                        },
                        "id": "edge_1774646072605_7",
                        "sourceHandle": "bottom",
                        "targetHandle": "top",
                        "runtime": {
                            "veldnaam": "landnaam",
                            "padnaam": "landnamen",
                            "tabelnaam": "landnaam",
                            "idKolom": "rel_id",
                            "heeftPFK": true,
                            "entiteitIDKolom": "land_id",
                            "klassenaam": "Landnaam",
                            "relatieveAutoincrement": true
                        },
                        "velden": [
                            {
                                "naam": "naam",
                                "goType": "string",
                                "type": "string",
                                "verplicht": true
                            }
                        ]
                    }
                ]
            },
            {
                "typenaam": "Locatie",
                "description": "Fysiek bezoekbare locatie gelegen op het aardoppervlak.",
                "isMaterieel": true,
                "kleur": "#fecaca",
                "meervoud": "locaties",
                "positie": {
                    "x": 720,
                    "y": -135
                },
                "runtime": {
                    "veldnaam": "locatie",
                    "padnaam": "locaties",
                    "tabelnaam": "locatie",
                    "idKolom": "id",
                    "klassenaam": "Locatie"
                },
                "afgeleideVelden": [
                    {
                        "naam": "weergaveadres",
                        "description": "Samengesteld weergaveadres, afgeleid uit straatnaam, huisnummer, postcode en plaats.",
                        "goType": "string",
                        "afleidingsregelTaal": "cel",
                        "afleidingsregel": "Adres.straatnaam + ' ' + Adres.huisnummer + ', ' + Adres.postcode + ' ' + Adres.plaats",
                        "isWeergaveVeld": true
                    }
                ],
                "gegevenselementen": [
                    {
                        "naam": "Adres",
                        "description": "Binnenlands adres: een aanduiding van een binnenlandse locatie, uitgegeven door de gemeente en geregistreerd in de BAG.",
                        "meervoud": "adressen",
                        "momentvoorkomen": "enkelvoudig",
                        "positie": {
                            "x": 780,
                            "y": 60
                        },
                        "id": "Locatie->Locatie_Adres",
                        "runtime": {
                            "veldnaam": "adres",
                            "padnaam": "adressen",
                            "tabelnaam": "locatie_adres",
                            "idKolom": "rel_id",
                            "heeftPFK": true,
                            "entiteitIDKolom": "locatie_id",
                            "klassenaam": "Adres",
                            "relatieveAutoincrement": true
                        },
                        "velden": [
                            {
                                "naam": "straatnaam",
                                "goType": "string",
                                "type": "string",
                                "verplicht": true
                            },
                            {
                                "naam": "huisnummer",
                                "goType": "string",
                                "type": "string",
                                "verplicht": true
                            },
                            {
                                "naam": "postcode",
                                "goType": "string",
                                "type": "string",
                                "verplicht": true,
                                "datatype": "NLPostcode"
                            },
                            {
                                "naam": "plaats",
                                "goType": "string",
                                "type": "string",
                                "verplicht": true
                            },
                            {
                                "naam": "land",
                                "goType": "int",
                                "type": "integer",
                                "verplicht": true,
                                "$ref": "LandenlijstLand"
                            }
                        ]
                    },
                    {
                        "naam": "BAGlocatie",
                        "description": "Unieke identificatie van het adresseerbaar object (verblijfsobject, stand- of ligplaats) uitgegeven door het bevoegd gemeentelijke orgaan.",
                        "meervoud": "baglocaties",
                        "momentvoorkomen": "enkelvoudig",
                        "positie": {
                            "x": 585,
                            "y": 90
                        },
                        "id": "Locatie->Locatie_BAG-locatie",
                        "runtime": {
                            "veldnaam": "baglocatie",
                            "padnaam": "baglocaties",
                            "tabelnaam": "locatie_baglocatie",
                            "idKolom": "rel_id",
                            "heeftPFK": true,
                            "entiteitIDKolom": "locatie_id",
                            "klassenaam": "BAGlocatie",
                            "relatieveAutoincrement": true
                        },
                        "velden": [
                            {
                                "naam": "adresaanduiding",
                                "goType": "string",
                                "type": "string",
                                "verplicht": true
                            }
                        ]
                    }
                ]
            },
            {
                "typenaam": "NatuurlijkPersoon",
                "description": "Een mens voor zover deze door Nederlandse wetgeving met rechten en plichten wordt bekleed.",
                "isMaterieel": true,
                "kleur": "#bfdbfe",
                "meervoud": "natuurlijk_personen",
                "positie": {
                    "x": -90,
                    "y": -135
                },
                "runtime": {
                    "veldnaam": "natuurlijkpersoon",
                    "padnaam": "natuurlijk_personen",
                    "tabelnaam": "natuurlijkpersoon",
                    "idKolom": "id",
                    "klassenaam": "NatuurlijkPersoon"
                },
                "afgeleideVelden": [
                    {
                        "naam": "weergavenaam",
                        "description": "Samengestelde weergavenaam van de persoon, afgeleid uit voornaam/tussenvoegsel/achternaam.",
                        "goType": "string",
                        "afleidingsregelTaal": "cel",
                        "afleidingsregel": "(Naam.roepnaam != null ? Naam.roepnaam : Naam.voorletters) + (Naam.tussenvoegsel != null ? ' ' + Naam.tussenvoegsel : '') + ' ' + Naam.achternaam",
                        "isWeergaveVeld": true
                    }
                ],
                "gegevenselementen": [
                    {
                        "naam": "Persoonsidentificatie",
                        "description": "Identificerende gegevens van de natuurlijk persoon (BSN, ingezetene).",
                        "meervoud": "persoonsidentificaties",
                        "momentvoorkomen": "enkelvoudig",
                        "positie": {
                            "x": -450,
                            "y": -30
                        },
                        "id": "NatuurlijkPersoon->NatuurlijkPersoon_PersoonsIdentificatie",
                        "sourceHandle": "left",
                        "runtime": {
                            "veldnaam": "persoonsidentificatie",
                            "padnaam": "persoonsidentificaties",
                            "tabelnaam": "natuurlijkpersoon_persoonsidentificatie",
                            "idKolom": "rel_id",
                            "heeftPFK": true,
                            "entiteitIDKolom": "natuurlijkpersoon_id",
                            "klassenaam": "Persoonsidentificatie",
                            "relatieveAutoincrement": true
                        },
                        "velden": [
                            {
                                "naam": "bsn",
                                "goType": "string",
                                "type": "string",
                                "verplicht": true,
                                "datatype": "BSN"
                            },
                            {
                                "naam": "ingezetene",
                                "goType": "*bool",
                                "type": "boolean"
                            }
                        ]
                    },
                    {
                        "naam": "Naam",
                        "description": "Naamgegevens van de natuurlijk persoon (voorletters, roepnaam, tussenvoegsel, achternaam).",
                        "meervoud": "namen",
                        "momentvoorkomen": "enkelvoudig",
                        "positie": {
                            "x": -105,
                            "y": 255
                        },
                        "id": "NatuurlijkPersoon->NatuurlijkPersoon_Naam",
                        "runtime": {
                            "veldnaam": "naam",
                            "padnaam": "namen",
                            "tabelnaam": "natuurlijkpersoon_naam",
                            "idKolom": "rel_id",
                            "heeftPFK": true,
                            "entiteitIDKolom": "natuurlijkpersoon_id",
                            "klassenaam": "Naam",
                            "relatieveAutoincrement": true
                        },
                        "velden": [
                            {
                                "naam": "voorletters",
                                "goType": "string",
                                "type": "string",
                                "verplicht": true
                            },
                            {
                                "naam": "roepnaam",
                                "goType": "*string",
                                "type": "string"
                            },
                            {
                                "naam": "tussenvoegsel",
                                "goType": "*string",
                                "type": "string"
                            },
                            {
                                "naam": "achternaam",
                                "goType": "string",
                                "type": "string",
                                "verplicht": true
                            }
                        ]
                    },
                    {
                        "naam": "Burgerschap",
                        "description": "Nationaliteitsgegevens (burgerschap) van de natuurlijk persoon.",
                        "meervoud": "burgerschappen",
                        "momentvoorkomen": "meervoudig",
                        "isMaterieel": true,
                        "positie": {
                            "x": -285,
                            "y": 450
                        },
                        "id": "NatuurlijkPersoon->NatuurlijkPersoon_Burgerschap",
                        "runtime": {
                            "veldnaam": "burgerschap",
                            "padnaam": "burgerschappen",
                            "tabelnaam": "natuurlijkpersoon_burgerschap",
                            "idKolom": "rel_id",
                            "heeftPFK": true,
                            "entiteitIDKolom": "natuurlijkpersoon_id",
                            "klassenaam": "Burgerschap",
                            "relatieveAutoincrement": true
                        },
                        "afgeleideVelden": [
                            {
                                "naam": "weergaveburgerschap",
                                "description": "Samengestelde weergave van nationaliteit en landcode.",
                                "goType": "string",
                                "afleidingsregelTaal": "cel",
                                "afleidingsregel": "Burgerschap_Data.nationaliteit + ' (' + Burgerschap_Data.landcode + ')'",
                                "isWeergaveVeld": true
                            }
                        ],
                        "velden": [
                            {
                                "naam": "landcode",
                                "goType": "string",
                                "type": "string",
                                "verplicht": true
                            },
                            {
                                "naam": "nationaliteit",
                                "goType": "string",
                                "type": "string",
                                "verplicht": true
                            }
                        ]
                    },
                    {
                        "naam": "Partnernaam",
                        "description": "Achternaam van de partner van de natuurlijk persoon.",
                        "meervoud": "partnernamen",
                        "momentvoorkomen": "enkelvoudig",
                        "positie": {
                            "x": 60,
                            "y": 450
                        },
                        "id": "edge_1774209110136_2",
                        "sourceHandle": "bottom",
                        "targetHandle": "top",
                        "runtime": {
                            "veldnaam": "partnernaam",
                            "padnaam": "partnernamen",
                            "tabelnaam": "natuurlijkpersoon_partnernaam",
                            "idKolom": "rel_id",
                            "heeftPFK": true,
                            "entiteitIDKolom": "natuurlijkpersoon_id",
                            "klassenaam": "Partnernaam",
                            "relatieveAutoincrement": true
                        },
                        "velden": [
                            {
                                "naam": "achternaam",
                                "goType": "string",
                                "type": "string",
                                "verplicht": true
                            }
                        ]
                    },
                    {
                        "naam": "Naamgebruik",
                        "description": "Wijze waarop de geslachtsnaam wordt gebruikt.",
                        "meervoud": "naamgebruiken",
                        "momentvoorkomen": "enkelvoudig",
                        "positie": {
                            "x": 195,
                            "y": 255
                        },
                        "id": "edge_1774209240752_5",
                        "sourceHandle": "bottom",
                        "targetHandle": "top",
                        "runtime": {
                            "veldnaam": "naamgebruik",
                            "padnaam": "naamgebruiken",
                            "tabelnaam": "natuurlijkpersoon_naamgebruik",
                            "idKolom": "rel_id",
                            "heeftPFK": true,
                            "entiteitIDKolom": "natuurlijkpersoon_id",
                            "klassenaam": "Naamgebruik",
                            "relatieveAutoincrement": true
                        },
                        "velden": [
                            {
                                "naam": "naamgebruik",
                                "goType": "Naamgebruiksoort",
                                "type": "string",
                                "verplicht": true,
                                "enum": "Naamgebruiksoort"
                            }
                        ]
                    }
                ],
                "relaties": [
                    {
                        "naam": "Bereikbaarheid",
                        "description": "Koppeling van een natuurlijk persoon aan een locatie als bereikbaarheidsadres.",
                        "meervoud": "bereikbaarheden",
                        "momentvoorkomen": "enkelvoudig",
                        "isMaterieel": true,
                        "doelEntiteit": "Locatie",
                        "positie": {
                            "x": 330,
                            "y": -120
                        },
                        "id": "edge_1774201942583_1",
                        "sourceHandle": "right",
                        "targetHandle": "left",
                        "doelId": "edge_1774201991984_2",
                        "doelSourceHandle": "right",
                        "doelTargetHandle": "left",
                        "runtime": {
                            "veldnaam": "bereikbaarheid",
                            "padnaam": "bereikbaarheden",
                            "tabelnaam": "bereikbaarheid",
                            "idKolom": "rel_id",
                            "heeftPFK": true,
                            "entiteitIDKolom": "natuurlijkpersoon_id",
                            "klassenaam": "Bereikbaarheid",
                            "relatieveAutoincrement": true
                        },
                        "velden": [
                            {
                                "naam": "soort",
                                "goType": "Bereikbaarheidssoort",
                                "type": "string",
                                "verplicht": true,
                                "enum": "Bereikbaarheidssoort"
                            }
                        ]
                    }
                ]
            },
            {
                "typenaam": "Referentielijst",
                "description": "Generieke referentielijst-entiteit. Individuele lijsten (Landenlijst, EULidstaten, etc.) zijn records.",
                "entiteitSubtype": "referentielijst",
                "isMaterieel": true,
                "kleur": "#fef3c7",
                "meervoud": "referentielijsten",
                "positie": {
                    "x": 1260,
                    "y": -240
                },
                "runtime": {
                    "veldnaam": "referentielijst",
                    "padnaam": "referentielijsten",
                    "tabelnaam": "register_referentielijst",
                    "idKolom": "id",
                    "klassenaam": "Referentielijst"
                },
                "gegevenselementen": [
                    {
                        "naam": "Referentielijstnaam",
                        "description": "Leesbare naam van een referentielijst.",
                        "meervoud": "referentielijstnamen",
                        "momentvoorkomen": "enkelvoudig",
                        "positie": {
                            "x": 1590,
                            "y": -255
                        },
                        "id": "Referentielijst->Referentielijst_Referentielijstnaam",
                        "sourceHandle": "right",
                        "targetHandle": "left",
                        "runtime": {
                            "veldnaam": "referentielijstnaam",
                            "padnaam": "referentielijstnamen",
                            "tabelnaam": "referentielijstnaam",
                            "idKolom": "rel_id",
                            "heeftPFK": true,
                            "entiteitIDKolom": "referentielijst_id",
                            "klassenaam": "Referentielijstnaam",
                            "relatieveAutoincrement": true
                        },
                        "velden": [
                            {
                                "naam": "naam",
                                "goType": "string",
                                "type": "string",
                                "verplicht": true
                            }
                        ]
                    },
                    {
                        "naam": "Referentielijstomschrijving",
                        "description": "Omschrijving van een referentielijst.",
                        "meervoud": "referentielijstomschrijvingen",
                        "momentvoorkomen": "enkelvoudig",
                        "positie": {
                            "x": 1590,
                            "y": -135
                        },
                        "id": "Referentielijst->Referentielijst_Referentielijstomschrijving",
                        "sourceHandle": "right",
                        "targetHandle": "left",
                        "runtime": {
                            "veldnaam": "referentielijstomschrijving",
                            "padnaam": "referentielijstomschrijvingen",
                            "tabelnaam": "referentielijstomschrijving",
                            "idKolom": "rel_id",
                            "heeftPFK": true,
                            "entiteitIDKolom": "referentielijst_id",
                            "klassenaam": "Referentielijstomschrijving",
                            "relatieveAutoincrement": true
                        },
                        "velden": [
                            {
                                "naam": "omschrijving",
                                "goType": "string",
                                "type": "string",
                                "verplicht": true
                            }
                        ]
                    },
                    {
                        "naam": "ReferentielijstVisibility",
                        "description": "Domeinzichtbaarheid van een referentielijst (register, modelspecifiek, extern).",
                        "meervoud": "visibilities",
                        "momentvoorkomen": "enkelvoudig",
                        "positie": {
                            "x": 1590,
                            "y": -15
                        },
                        "id": "Referentielijst->Referentielijst_ReferentielijstVisibility",
                        "sourceHandle": "right",
                        "targetHandle": "left",
                        "runtime": {
                            "veldnaam": "visibility",
                            "padnaam": "visibilities",
                            "tabelnaam": "referentielijstvisibility",
                            "idKolom": "rel_id",
                            "heeftPFK": true,
                            "entiteitIDKolom": "referentielijst_id",
                            "klassenaam": "Visibility",
                            "relatieveAutoincrement": true
                        },
                        "velden": [
                            {
                                "naam": "domein",
                                "goType": "string",
                                "type": "string",
                                "verplicht": true,
                                "description": "Domeinzichtbaarheid: 'register', modelspecifiek domein, of 'extern'."
                            }
                        ]
                    },
                    {
                        "naam": "ReferentielijstInternetadres",
                        "description": "Internetadres (URL/URN) van een referentielijst.",
                        "meervoud": "internetadressen",
                        "momentvoorkomen": "meervoudig",
                        "positie": {
                            "x": 1590,
                            "y": 85
                        },
                        "id": "Referentielijst->Referentielijst_ReferentielijstInternetadres",
                        "sourceHandle": "right",
                        "targetHandle": "left",
                        "runtime": {
                            "veldnaam": "internetadres",
                            "padnaam": "internetadressen",
                            "tabelnaam": "referentielijstinternetadres",
                            "idKolom": "rel_id",
                            "heeftPFK": true,
                            "entiteitIDKolom": "referentielijst_id",
                            "klassenaam": "Internetadres",
                            "relatieveAutoincrement": true
                        },
                        "velden": [
                            {
                                "naam": "adrestype",
                                "goType": "ReferentielijstAdrestype",
                                "type": "string",
                                "verplicht": true,
                                "enum": "ReferentielijstAdrestype",
                                "description": "Type adres: URL of URN."
                            },
                            {
                                "naam": "adres",
                                "goType": "string",
                                "type": "string",
                                "verplicht": true,
                                "description": "Het volledige internet-adres (URL of URN)."
                            },
                            {
                                "naam": "organisatie",
                                "goType": "string",
                                "type": "string",
                                "verplicht": true,
                                "description": "Verantwoordelijke organisatie voor dit adres."
                            }
                        ]
                    }
                ],
                "relaties": [
                    {
                        "naam": "LandenlijstLand",
                        "description": "Koppeling van een land aan referentielijst-instantie Landenlijst (referentielijst-items relatie).",
                        "relatieSubtype": "referentielijst_items",
                        "referentielijstInstantie": "Landenlijst",
                        "meervoud": "landenlijst_landen",
                        "momentvoorkomen": "meervoudig",
                        "doelEntiteit": "Land",
                        "positie": {
                            "x": 1215,
                            "y": 165
                        },
                        "id": "Referentielijst->LandenlijstLand",
                        "doelId": "LandenlijstLand->Land",
                        "runtime": {
                            "veldnaam": "landenlijst_land",
                            "padnaam": "landenlijst_landen",
                            "tabelnaam": "landenlijst_land",
                            "idKolom": "rel_id",
                            "heeftPFK": true,
                            "entiteitIDKolom": "referentielijst_id",
                            "klassenaam": "LandenlijstLand",
                            "relatieveAutoincrement": true
                        }
                    },
                    {
                        "naam": "AdellijkeTitelsTitel",
                        "description": "Koppeling van een adellijke titel aan referentielijst-instantie AdellijkeTitels (referentielijst-items relatie).",
                        "relatieSubtype": "referentielijst_items",
                        "referentielijstInstantie": "AdellijkeTitels",
                        "meervoud": "adellijke_titels_titels",
                        "momentvoorkomen": "meervoudig",
                        "doelEntiteit": "AdellijkeTitel",
                        "runtime": {
                            "veldnaam": "adellijketitelstitel",
                            "padnaam": "adellijke_titels_titels",
                            "tabelnaam": "adellijketitelstitel",
                            "idKolom": "rel_id",
                            "heeftPFK": true,
                            "entiteitIDKolom": "referentielijst_id",
                            "klassenaam": "AdellijkeTitelsTitel",
                            "relatieveAutoincrement": true
                        }
                    }
                ]
            }
        ]
    },
    "model_beschrijving": "",
    "model_bron": "code",
    "model_naam": "",
    "model_versie": "v3",
    "opmerking": "",
    "status": "code",
    "tijdstip": null,
    "types": [
        {
            "typenaam": "AdellijkeTitel",
            "klassenaam": "AdellijkeTitel",
            "description": "Referentielijst-item: adellijke titel.",
            "metatype": "entiteit",
            "entiteitSubtype": "referentielijst_item",
            "domein": "np-loc",
            "kleur": "#c4b5fd",
            "veldnaam": "adellijketitel",
            "padnaam": "adellijke_titels",
            "meervoud": "adellijke titels",
            "velden": [
                {
                    "naam": "id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "adellijke_titel_titels",
                    "type": "AdellijkeTitelTitel",
                    "format": "array",
                    "verplicht": false
                }
            ],
            "tabelnaam": "adellijketitel",
            "idKolom": "id",
            "heeftPFK": false,
            "onderliggende": [
                {
                    "rolnaam": "AdellijkeTitelTitels",
                    "jsonRolnaam": "adellijke_titel_titels",
                    "doeltype": "AdellijkeTitelTitel",
                    "momentvoorkomen": "enkelvoudig"
                }
            ]
        },
        {
            "typenaam": "AdellijkeTitelTitel",
            "klassenaam": "AdellijkeTitelTitel",
            "description": "Enkelvoudig gegevenselement titel van AdellijkeTitel.",
            "metatype": "gegevenselement",
            "ge_subtype": "hub",
            "kleur": "#c4b5fd",
            "veldnaam": "adellijketiteltitel",
            "padnaam": "adellijke_titel_titels",
            "meervoud": "adellijke_titel_titels",
            "velden": [
                {
                    "naam": "adellijketitel_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "rel_id",
                    "type": "integer",
                    "verplicht": true,
                    "autoIncrement": true
                },
                {
                    "naam": "titel",
                    "type": "string",
                    "verplicht": true
                }
            ],
            "tabelnaam": "adellijketiteltitel",
            "idKolom": "rel_id",
            "idAutoIncrement": true,
            "heeftPFK": true,
            "entiteitIDKolom": "adellijketitel_id",
            "momentvoorkomen": "enkelvoudig",
            "onderliggende": [
                {
                    "rolnaam": "Data",
                    "jsonRolnaam": "data",
                    "doeltype": "AdellijkeTitelTitel_Data",
                    "momentvoorkomen": "enkelvoudig"
                }
            ]
        },
        {
            "typenaam": "AdellijkeTitelTitel_Data",
            "klassenaam": "Data",
            "description": "Geversioned inhoud van gegevenselement AdellijkeTitelTitel.",
            "metatype": "gegevenselement",
            "ge_subtype": "data",
            "kleur": "#c4b5fd",
            "veldnaam": "adellijketiteltitel_data",
            "padnaam": "adellijketiteltitel_data",
            "meervoud": "adellijketiteltitel_data",
            "velden": [
                {
                    "naam": "adellijketitel_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "rel_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "versie",
                    "type": "integer",
                    "verplicht": false,
                    "autoIncrement": true
                },
                {
                    "naam": "titel",
                    "type": "string",
                    "verplicht": true
                }
            ],
            "tabelnaam": "adellijketiteltitel_data",
            "idKolom": "versie",
            "idAutoIncrement": true,
            "heeftPFK": true,
            "entiteitIDKolom": "adellijketitel_id",
            "bovenliggendTypenaam": "AdellijkeTitelTitel",
            "momentvoorkomen": "enkelvoudig"
        },
        {
            "typenaam": "AdellijkeTitelsTitel",
            "klassenaam": "AdellijkeTitelsTitel",
            "description": "Koppeling van een adellijke titel aan referentielijst-instantie AdellijkeTitels (referentielijst-items relatie).",
            "metatype": "relatie",
            "ge_subtype": "hub",
            "relatieSubtype": "referentielijst_items",
            "referentielijstInstantie": "AdellijkeTitels",
            "doelEntiteit": "AdellijkeTitel",
            "veldnaam": "adellijketitelstitel",
            "padnaam": "adellijke_titels_titels",
            "meervoud": "adellijke_titels_titels",
            "velden": [
                {
                    "naam": "referentielijst_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "rel_id",
                    "type": "integer",
                    "verplicht": true,
                    "autoIncrement": true
                },
                {
                    "naam": "adellijketitel_id",
                    "type": "integer",
                    "verplicht": true
                }
            ],
            "tabelnaam": "adellijketitelstitel",
            "idKolom": "rel_id",
            "idAutoIncrement": true,
            "heeftPFK": true,
            "entiteitIDKolom": "referentielijst_id",
            "secondaireEntiteitIDKolom": "adellijketitel_id",
            "momentvoorkomen": "meervoudig",
            "onderliggende": [
                {
                    "rolnaam": "Data",
                    "jsonRolnaam": "data",
                    "doeltype": "AdellijkeTitelsTitel_Data",
                    "momentvoorkomen": "enkelvoudig"
                }
            ]
        },
        {
            "typenaam": "AdellijkeTitelsTitel_Data",
            "klassenaam": "Data",
            "description": "Geversioned inhoud van AdellijkeTitelsTitel.",
            "metatype": "gegevenselement",
            "ge_subtype": "data",
            "kleur": "#fef3c7",
            "veldnaam": "adellijketitelstitel_data",
            "padnaam": "adellijketitelstitel_data",
            "meervoud": "adellijketitelstitel_data",
            "velden": [
                {
                    "naam": "referentielijst_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "rel_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "versie",
                    "type": "integer",
                    "verplicht": false,
                    "autoIncrement": true
                }
            ],
            "tabelnaam": "adellijketitelstitel_data",
            "idKolom": "versie",
            "idAutoIncrement": true,
            "heeftPFK": true,
            "entiteitIDKolom": "referentielijst_id",
            "bovenliggendTypenaam": "AdellijkeTitelsTitel",
            "momentvoorkomen": "enkelvoudig"
        },
        {
            "typenaam": "Bereikbaarheid",
            "klassenaam": "Bereikbaarheid",
            "description": "Koppeling van een natuurlijk persoon aan een locatie als bereikbaarheidsadres.",
            "metatype": "relatie",
            "ge_subtype": "hub",
            "isMaterieel": true,
            "doelEntiteit": "Locatie",
            "veldnaam": "bereikbaarheid",
            "padnaam": "bereikbaarheden",
            "meervoud": "bereikbaarheden",
            "velden": [
                {
                    "naam": "natuurlijkpersoon_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "rel_id",
                    "type": "integer",
                    "verplicht": true,
                    "autoIncrement": true
                },
                {
                    "naam": "locatie_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "soort",
                    "type": "string",
                    "enum": [
                        "Woonadres",
                        "Briefadres",
                        "Correspondentieadres"
                    ],
                    "verplicht": true
                }
            ],
            "tabelnaam": "bereikbaarheid",
            "idKolom": "rel_id",
            "idAutoIncrement": true,
            "heeftPFK": true,
            "entiteitIDKolom": "natuurlijkpersoon_id",
            "secondaireEntiteitIDKolom": "locatie_id",
            "momentvoorkomen": "enkelvoudig",
            "onderliggende": [
                {
                    "rolnaam": "Data",
                    "jsonRolnaam": "data",
                    "doeltype": "Bereikbaarheid_Data",
                    "momentvoorkomen": "enkelvoudig"
                },
                {
                    "rolnaam": "Aanvang",
                    "jsonRolnaam": "aanvang",
                    "doeltype": "Bereikbaarheid_Aanvang",
                    "momentvoorkomen": "enkelvoudig"
                },
                {
                    "rolnaam": "Einde",
                    "jsonRolnaam": "einde",
                    "doeltype": "Bereikbaarheid_Einde",
                    "momentvoorkomen": "enkelvoudig"
                }
            ]
        },
        {
            "typenaam": "Bereikbaarheid_Aanvang",
            "klassenaam": "Aanvang",
            "description": "Aanvangsdatum van Bereikbaarheid.",
            "metatype": "gegevenselement",
            "ge_subtype": "aanvang",
            "kleur": "#bfdbfe",
            "veldnaam": "bereikbaarheid_aanvang",
            "padnaam": "bereikbaarheid_aanvang",
            "meervoud": "bereikbaarheid_aanvang",
            "velden": [
                {
                    "naam": "natuurlijkpersoon_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "rel_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "versie",
                    "type": "integer",
                    "verplicht": false,
                    "autoIncrement": true
                },
                {
                    "naam": "datum",
                    "type": "string",
                    "format": "date",
                    "verplicht": false
                }
            ],
            "tabelnaam": "bereikbaarheid_aanvang",
            "idKolom": "versie",
            "idAutoIncrement": true,
            "heeftPFK": true,
            "entiteitIDKolom": "natuurlijkpersoon_id",
            "bovenliggendTypenaam": "Bereikbaarheid",
            "momentvoorkomen": "enkelvoudig"
        },
        {
            "typenaam": "Bereikbaarheid_Data",
            "klassenaam": "Data",
            "description": "Geversioned inhoud van Bereikbaarheid.",
            "metatype": "gegevenselement",
            "ge_subtype": "data",
            "kleur": "#bfdbfe",
            "veldnaam": "bereikbaarheid_data",
            "padnaam": "bereikbaarheid_data",
            "meervoud": "bereikbaarheid_data",
            "velden": [
                {
                    "naam": "natuurlijkpersoon_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "rel_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "versie",
                    "type": "integer",
                    "verplicht": false,
                    "autoIncrement": true
                },
                {
                    "naam": "soort",
                    "type": "string",
                    "enum": [
                        "Woonadres",
                        "Briefadres",
                        "Correspondentieadres"
                    ],
                    "verplicht": true
                }
            ],
            "tabelnaam": "bereikbaarheid_data",
            "idKolom": "versie",
            "idAutoIncrement": true,
            "heeftPFK": true,
            "entiteitIDKolom": "natuurlijkpersoon_id",
            "bovenliggendTypenaam": "Bereikbaarheid",
            "momentvoorkomen": "enkelvoudig"
        },
        {
            "typenaam": "Bereikbaarheid_Einde",
            "klassenaam": "Einde",
            "description": "Einddatum van Bereikbaarheid.",
            "metatype": "gegevenselement",
            "ge_subtype": "einde",
            "kleur": "#bfdbfe",
            "veldnaam": "bereikbaarheid_einde",
            "padnaam": "bereikbaarheid_einde",
            "meervoud": "bereikbaarheid_einde",
            "velden": [
                {
                    "naam": "natuurlijkpersoon_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "rel_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "versie",
                    "type": "integer",
                    "verplicht": false,
                    "autoIncrement": true
                },
                {
                    "naam": "datum",
                    "type": "string",
                    "format": "date",
                    "verplicht": false
                }
            ],
            "tabelnaam": "bereikbaarheid_einde",
            "idKolom": "versie",
            "idAutoIncrement": true,
            "heeftPFK": true,
            "entiteitIDKolom": "natuurlijkpersoon_id",
            "bovenliggendTypenaam": "Bereikbaarheid",
            "momentvoorkomen": "enkelvoudig"
        },
        {
            "typenaam": "Land",
            "klassenaam": "Land",
            "description": "Referentielijst-item: individueel land.",
            "metatype": "entiteit",
            "isMaterieel": true,
            "entiteitSubtype": "referentielijst_item",
            "domein": "register",
            "kleur": "#fde68a",
            "veldnaam": "land",
            "padnaam": "landen",
            "meervoud": "landen",
            "velden": [
                {
                    "naam": "id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "landcodes",
                    "type": "Landcode",
                    "format": "array",
                    "verplicht": false
                },
                {
                    "naam": "landnamen",
                    "type": "Landnaam",
                    "format": "array",
                    "verplicht": false
                }
            ],
            "tabelnaam": "land",
            "idKolom": "id",
            "heeftPFK": false,
            "onderliggende": [
                {
                    "rolnaam": "Landcodes",
                    "jsonRolnaam": "landcodes",
                    "doeltype": "Landcode",
                    "momentvoorkomen": "enkelvoudig"
                },
                {
                    "rolnaam": "Landnamen",
                    "jsonRolnaam": "landnamen",
                    "doeltype": "Landnaam",
                    "momentvoorkomen": "enkelvoudig"
                },
                {
                    "rolnaam": "Aanvang",
                    "jsonRolnaam": "aanvang",
                    "doeltype": "Land_Aanvang",
                    "momentvoorkomen": "enkelvoudig"
                },
                {
                    "rolnaam": "Einde",
                    "jsonRolnaam": "einde",
                    "doeltype": "Land_Einde",
                    "momentvoorkomen": "enkelvoudig"
                }
            ]
        },
        {
            "typenaam": "Land_Aanvang",
            "klassenaam": "Aanvang",
            "description": "Aanvangsdatum van referentielijst-item Land.",
            "metatype": "gegevenselement",
            "ge_subtype": "aanvang",
            "kleur": "#fde68a",
            "veldnaam": "land_aanvang",
            "padnaam": "land_aanvang",
            "meervoud": "land_aanvang",
            "velden": [
                {
                    "naam": "land_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "versie",
                    "type": "integer",
                    "verplicht": false,
                    "autoIncrement": true
                },
                {
                    "naam": "datum",
                    "type": "string",
                    "format": "date",
                    "verplicht": false
                }
            ],
            "tabelnaam": "land_aanvang",
            "idKolom": "versie",
            "idAutoIncrement": true,
            "heeftPFK": true,
            "entiteitIDKolom": "land_id",
            "bovenliggendTypenaam": "Land",
            "momentvoorkomen": "enkelvoudig"
        },
        {
            "typenaam": "Land_Einde",
            "klassenaam": "Einde",
            "description": "Einddatum van referentielijst-item Land.",
            "metatype": "gegevenselement",
            "ge_subtype": "einde",
            "kleur": "#fde68a",
            "veldnaam": "land_einde",
            "padnaam": "land_einde",
            "meervoud": "land_einde",
            "velden": [
                {
                    "naam": "land_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "versie",
                    "type": "integer",
                    "verplicht": false,
                    "autoIncrement": true
                },
                {
                    "naam": "datum",
                    "type": "string",
                    "format": "date",
                    "verplicht": false
                }
            ],
            "tabelnaam": "land_einde",
            "idKolom": "versie",
            "idAutoIncrement": true,
            "heeftPFK": true,
            "entiteitIDKolom": "land_id",
            "bovenliggendTypenaam": "Land",
            "momentvoorkomen": "enkelvoudig"
        },
        {
            "typenaam": "Landcode",
            "klassenaam": "Landcode",
            "description": "Enkelvoudig gegevenselement landcode van Land.",
            "metatype": "gegevenselement",
            "ge_subtype": "hub",
            "kleur": "#fde68a",
            "veldnaam": "landcode",
            "padnaam": "landcodes",
            "meervoud": "landcodes",
            "velden": [
                {
                    "naam": "land_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "rel_id",
                    "type": "integer",
                    "verplicht": true,
                    "autoIncrement": true
                },
                {
                    "naam": "code",
                    "type": "string",
                    "verplicht": true
                }
            ],
            "tabelnaam": "landcode",
            "idKolom": "rel_id",
            "idAutoIncrement": true,
            "heeftPFK": true,
            "entiteitIDKolom": "land_id",
            "momentvoorkomen": "enkelvoudig",
            "onderliggende": [
                {
                    "rolnaam": "Data",
                    "jsonRolnaam": "data",
                    "doeltype": "Landcode_Data",
                    "momentvoorkomen": "enkelvoudig"
                }
            ]
        },
        {
            "typenaam": "Landcode_Data",
            "klassenaam": "Data",
            "description": "Geversioned inhoud van gegevenselement Landcode.",
            "metatype": "gegevenselement",
            "ge_subtype": "data",
            "kleur": "#fde68a",
            "veldnaam": "landcode_data",
            "padnaam": "landcode_data",
            "meervoud": "landcode_data",
            "velden": [
                {
                    "naam": "land_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "rel_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "versie",
                    "type": "integer",
                    "verplicht": false,
                    "autoIncrement": true
                },
                {
                    "naam": "code",
                    "type": "string",
                    "verplicht": true
                }
            ],
            "tabelnaam": "landcode_data",
            "idKolom": "versie",
            "idAutoIncrement": true,
            "heeftPFK": true,
            "entiteitIDKolom": "land_id",
            "bovenliggendTypenaam": "Landcode",
            "momentvoorkomen": "enkelvoudig"
        },
        {
            "typenaam": "LandenlijstLand",
            "klassenaam": "LandenlijstLand",
            "description": "Koppeling van een land aan referentielijst-instantie Landenlijst (referentielijst-items relatie).",
            "metatype": "relatie",
            "ge_subtype": "hub",
            "relatieSubtype": "referentielijst_items",
            "referentielijstInstantie": "Landenlijst",
            "doelEntiteit": "Land",
            "kleur": "#fcd34d",
            "veldnaam": "landenlijst_land",
            "padnaam": "landenlijst_landen",
            "meervoud": "landenlijst_landen",
            "velden": [
                {
                    "naam": "referentielijst_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "rel_id",
                    "type": "integer",
                    "verplicht": true,
                    "autoIncrement": true
                },
                {
                    "naam": "land_id",
                    "type": "integer",
                    "verplicht": true
                }
            ],
            "tabelnaam": "landenlijst_land",
            "idKolom": "rel_id",
            "idAutoIncrement": true,
            "heeftPFK": true,
            "entiteitIDKolom": "referentielijst_id",
            "secondaireEntiteitIDKolom": "land_id",
            "momentvoorkomen": "meervoudig",
            "onderliggende": [
                {
                    "rolnaam": "Data",
                    "jsonRolnaam": "data",
                    "doeltype": "LandenlijstLand_Data",
                    "momentvoorkomen": "enkelvoudig"
                }
            ]
        },
        {
            "typenaam": "LandenlijstLand_Data",
            "klassenaam": "Data",
            "description": "Geversioned inhoud van relatie LandenlijstLand.",
            "metatype": "gegevenselement",
            "ge_subtype": "data",
            "kleur": "#fcd34d",
            "veldnaam": "landenlijst_land_data",
            "padnaam": "landenlijst_land_data",
            "meervoud": "landenlijst_land_data",
            "velden": [
                {
                    "naam": "referentielijst_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "rel_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "versie",
                    "type": "integer",
                    "verplicht": false,
                    "autoIncrement": true
                }
            ],
            "tabelnaam": "landenlijst_land_data",
            "idKolom": "versie",
            "idAutoIncrement": true,
            "heeftPFK": true,
            "entiteitIDKolom": "referentielijst_id",
            "bovenliggendTypenaam": "LandenlijstLand",
            "momentvoorkomen": "enkelvoudig"
        },
        {
            "typenaam": "Landnaam",
            "klassenaam": "Landnaam",
            "description": "Enkelvoudig gegevenselement landnaam van Land.",
            "metatype": "gegevenselement",
            "ge_subtype": "hub",
            "kleur": "#fde68a",
            "veldnaam": "landnaam",
            "padnaam": "landnamen",
            "meervoud": "landnamen",
            "velden": [
                {
                    "naam": "land_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "rel_id",
                    "type": "integer",
                    "verplicht": true,
                    "autoIncrement": true
                },
                {
                    "naam": "naam",
                    "type": "string",
                    "verplicht": true
                }
            ],
            "tabelnaam": "landnaam",
            "idKolom": "rel_id",
            "idAutoIncrement": true,
            "heeftPFK": true,
            "entiteitIDKolom": "land_id",
            "momentvoorkomen": "enkelvoudig",
            "onderliggende": [
                {
                    "rolnaam": "Data",
                    "jsonRolnaam": "data",
                    "doeltype": "Landnaam_Data",
                    "momentvoorkomen": "enkelvoudig"
                }
            ]
        },
        {
            "typenaam": "Landnaam_Data",
            "klassenaam": "Data",
            "description": "Geversioned inhoud van gegevenselement Landnaam.",
            "metatype": "gegevenselement",
            "ge_subtype": "data",
            "kleur": "#fde68a",
            "veldnaam": "landnaam_data",
            "padnaam": "landnaam_data",
            "meervoud": "landnaam_data",
            "velden": [
                {
                    "naam": "land_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "rel_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "versie",
                    "type": "integer",
                    "verplicht": false,
                    "autoIncrement": true
                },
                {
                    "naam": "naam",
                    "type": "string",
                    "verplicht": true
                }
            ],
            "tabelnaam": "landnaam_data",
            "idKolom": "versie",
            "idAutoIncrement": true,
            "heeftPFK": true,
            "entiteitIDKolom": "land_id",
            "bovenliggendTypenaam": "Landnaam",
            "momentvoorkomen": "enkelvoudig"
        },
        {
            "typenaam": "Locatie",
            "klassenaam": "Locatie",
            "description": "Fysiek bezoekbare locatie gelegen op het aardoppervlak.",
            "metatype": "entiteit",
            "isMaterieel": true,
            "domein": "np-loc",
            "kleur": "#fecaca",
            "veldnaam": "locatie",
            "padnaam": "locaties",
            "meervoud": "locaties",
            "velden": [
                {
                    "naam": "id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "adressen",
                    "type": "Locatie_Adres",
                    "format": "array",
                    "verplicht": false
                },
                {
                    "naam": "baglocaties",
                    "type": "Locatie_BAGlocatie",
                    "format": "array",
                    "verplicht": false
                }
            ],
            "tabelnaam": "locatie",
            "idKolom": "id",
            "heeftPFK": false,
            "onderliggende": [
                {
                    "rolnaam": "Adressen",
                    "jsonRolnaam": "adressen",
                    "doeltype": "Locatie_Adres",
                    "momentvoorkomen": "enkelvoudig"
                },
                {
                    "rolnaam": "Baglocaties",
                    "jsonRolnaam": "baglocaties",
                    "doeltype": "Locatie_BAGlocatie",
                    "momentvoorkomen": "enkelvoudig"
                },
                {
                    "rolnaam": "Aanvang",
                    "jsonRolnaam": "aanvang",
                    "doeltype": "Locatie_Aanvang",
                    "momentvoorkomen": "enkelvoudig"
                },
                {
                    "rolnaam": "Einde",
                    "jsonRolnaam": "einde",
                    "doeltype": "Locatie_Einde",
                    "momentvoorkomen": "enkelvoudig"
                }
            ],
            "afgeleideVelden": [
                {
                    "naam": "weergaveadres",
                    "description": "Samengesteld weergaveadres, afgeleid uit straatnaam, huisnummer, postcode en plaats.",
                    "goType": "string",
                    "afleidingsregelTaal": "cel",
                    "afleidingsregel": "Adres.straatnaam + ' ' + Adres.huisnummer + ', ' + Adres.postcode + ' ' + Adres.plaats",
                    "isWeergaveVeld": true
                }
            ]
        },
        {
            "typenaam": "Locatie_Aanvang",
            "klassenaam": "Aanvang",
            "description": "Aanvangsdatum van Locatie.",
            "metatype": "gegevenselement",
            "ge_subtype": "aanvang",
            "kleur": "#fecaca",
            "veldnaam": "locatie_aanvang",
            "padnaam": "locatie_aanvang",
            "meervoud": "locatie_aanvang",
            "velden": [
                {
                    "naam": "locatie_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "versie",
                    "type": "integer",
                    "verplicht": false,
                    "autoIncrement": true
                },
                {
                    "naam": "datum",
                    "type": "string",
                    "format": "date",
                    "verplicht": false
                }
            ],
            "tabelnaam": "locatie_aanvang",
            "idKolom": "versie",
            "idAutoIncrement": true,
            "heeftPFK": true,
            "entiteitIDKolom": "locatie_id",
            "bovenliggendTypenaam": "Locatie",
            "momentvoorkomen": "enkelvoudig"
        },
        {
            "typenaam": "Locatie_Adres",
            "klassenaam": "Adres",
            "description": "Binnenlands adres: een aanduiding van een binnenlandse locatie, uitgegeven door de gemeente en geregistreerd in de BAG.",
            "metatype": "gegevenselement",
            "ge_subtype": "hub",
            "kleur": "#fecaca",
            "veldnaam": "adres",
            "padnaam": "adressen",
            "meervoud": "adressen",
            "velden": [
                {
                    "naam": "locatie_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "rel_id",
                    "type": "integer",
                    "verplicht": true,
                    "autoIncrement": true
                },
                {
                    "naam": "straatnaam",
                    "type": "string",
                    "verplicht": true
                },
                {
                    "naam": "huisnummer",
                    "type": "string",
                    "verplicht": true
                },
                {
                    "naam": "postcode",
                    "type": "string",
                    "verplicht": true
                },
                {
                    "naam": "plaats",
                    "type": "string",
                    "verplicht": true
                },
                {
                    "naam": "land",
                    "type": "integer",
                    "verplicht": true
                }
            ],
            "tabelnaam": "locatie_adres",
            "idKolom": "rel_id",
            "idAutoIncrement": true,
            "heeftPFK": true,
            "entiteitIDKolom": "locatie_id",
            "momentvoorkomen": "enkelvoudig",
            "onderliggende": [
                {
                    "rolnaam": "Data",
                    "jsonRolnaam": "data",
                    "doeltype": "Locatie_Adres_Data",
                    "momentvoorkomen": "enkelvoudig"
                }
            ]
        },
        {
            "typenaam": "Locatie_Adres_Data",
            "klassenaam": "Data",
            "description": "Geversioned inhoud van Locatie_Adres.",
            "metatype": "gegevenselement",
            "ge_subtype": "data",
            "kleur": "#fecaca",
            "veldnaam": "locatie_adres_data",
            "padnaam": "locatie_adres_data",
            "meervoud": "locatie_adres_data",
            "velden": [
                {
                    "naam": "locatie_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "rel_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "versie",
                    "type": "integer",
                    "verplicht": false,
                    "autoIncrement": true
                },
                {
                    "naam": "straatnaam",
                    "type": "string",
                    "verplicht": true
                },
                {
                    "naam": "huisnummer",
                    "type": "string",
                    "verplicht": true
                },
                {
                    "naam": "postcode",
                    "type": "string",
                    "verplicht": true,
                    "datatype": "NLPostcode"
                },
                {
                    "naam": "plaats",
                    "type": "string",
                    "verplicht": true
                },
                {
                    "naam": "land",
                    "type": "integer",
                    "verplicht": true,
                    "ref": "LandenlijstLand"
                }
            ],
            "tabelnaam": "locatie_adres_data",
            "idKolom": "versie",
            "idAutoIncrement": true,
            "heeftPFK": true,
            "entiteitIDKolom": "locatie_id",
            "bovenliggendTypenaam": "Locatie_Adres",
            "momentvoorkomen": "enkelvoudig"
        },
        {
            "typenaam": "Locatie_BAGlocatie",
            "klassenaam": "BAGlocatie",
            "description": "Unieke identificatie van het adresseerbaar object (verblijfsobject, stand- of ligplaats) uitgegeven door het bevoegd gemeentelijke orgaan.",
            "metatype": "gegevenselement",
            "ge_subtype": "hub",
            "kleur": "#fecaca",
            "veldnaam": "baglocatie",
            "padnaam": "baglocaties",
            "meervoud": "baglocaties",
            "velden": [
                {
                    "naam": "locatie_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "rel_id",
                    "type": "integer",
                    "verplicht": true,
                    "autoIncrement": true
                },
                {
                    "naam": "adresaanduiding",
                    "type": "string",
                    "verplicht": true
                }
            ],
            "tabelnaam": "locatie_baglocatie",
            "idKolom": "rel_id",
            "idAutoIncrement": true,
            "heeftPFK": true,
            "entiteitIDKolom": "locatie_id",
            "momentvoorkomen": "enkelvoudig",
            "onderliggende": [
                {
                    "rolnaam": "Data",
                    "jsonRolnaam": "data",
                    "doeltype": "Locatie_BAGlocatie_Data",
                    "momentvoorkomen": "enkelvoudig"
                }
            ]
        },
        {
            "typenaam": "Locatie_BAGlocatie_Data",
            "klassenaam": "Data",
            "description": "Geversioned inhoud van Locatie_BAGlocatie.",
            "metatype": "gegevenselement",
            "ge_subtype": "data",
            "kleur": "#fecaca",
            "veldnaam": "locatie_baglocatie_data",
            "padnaam": "locatie_baglocatie_data",
            "meervoud": "locatie_baglocatie_data",
            "velden": [
                {
                    "naam": "locatie_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "rel_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "versie",
                    "type": "integer",
                    "verplicht": false,
                    "autoIncrement": true
                },
                {
                    "naam": "adresaanduiding",
                    "type": "string",
                    "verplicht": true
                }
            ],
            "tabelnaam": "locatie_baglocatie_data",
            "idKolom": "versie",
            "idAutoIncrement": true,
            "heeftPFK": true,
            "entiteitIDKolom": "locatie_id",
            "bovenliggendTypenaam": "Locatie_BAGlocatie",
            "momentvoorkomen": "enkelvoudig"
        },
        {
            "typenaam": "Locatie_Einde",
            "klassenaam": "Einde",
            "description": "Einddatum van Locatie.",
            "metatype": "gegevenselement",
            "ge_subtype": "einde",
            "kleur": "#fecaca",
            "veldnaam": "locatie_einde",
            "padnaam": "locatie_einde",
            "meervoud": "locatie_einde",
            "velden": [
                {
                    "naam": "locatie_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "versie",
                    "type": "integer",
                    "verplicht": false,
                    "autoIncrement": true
                },
                {
                    "naam": "datum",
                    "type": "string",
                    "format": "date",
                    "verplicht": false
                }
            ],
            "tabelnaam": "locatie_einde",
            "idKolom": "versie",
            "idAutoIncrement": true,
            "heeftPFK": true,
            "entiteitIDKolom": "locatie_id",
            "bovenliggendTypenaam": "Locatie",
            "momentvoorkomen": "enkelvoudig"
        },
        {
            "typenaam": "NatuurlijkPersoon",
            "klassenaam": "NatuurlijkPersoon",
            "description": "Een mens voor zover deze door Nederlandse wetgeving met rechten en plichten wordt bekleed.",
            "metatype": "entiteit",
            "isMaterieel": true,
            "domein": "np-loc",
            "kleur": "#bfdbfe",
            "veldnaam": "natuurlijkpersoon",
            "padnaam": "natuurlijk_personen",
            "meervoud": "natuurlijk personen",
            "velden": [
                {
                    "naam": "id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "persoonsidentificaties",
                    "type": "NatuurlijkPersoon_Persoonsidentificatie",
                    "format": "array",
                    "verplicht": false
                },
                {
                    "naam": "namen",
                    "type": "NatuurlijkPersoon_Naam",
                    "format": "array",
                    "verplicht": false
                },
                {
                    "naam": "burgerschappen",
                    "type": "NatuurlijkPersoon_Burgerschap",
                    "format": "array",
                    "verplicht": false
                },
                {
                    "naam": "partnernamen",
                    "type": "NatuurlijkPersoon_Partnernaam",
                    "format": "array",
                    "verplicht": false
                },
                {
                    "naam": "naamgebruiken",
                    "type": "NatuurlijkPersoon_Naamgebruik",
                    "format": "array",
                    "verplicht": false
                },
                {
                    "naam": "bereikbaarheden",
                    "type": "Bereikbaarheid",
                    "format": "array",
                    "verplicht": false
                }
            ],
            "tabelnaam": "natuurlijkpersoon",
            "idKolom": "id",
            "heeftPFK": false,
            "onderliggende": [
                {
                    "rolnaam": "Persoonsidentificaties",
                    "jsonRolnaam": "persoonsidentificaties",
                    "doeltype": "NatuurlijkPersoon_Persoonsidentificatie",
                    "momentvoorkomen": "enkelvoudig"
                },
                {
                    "rolnaam": "Namen",
                    "jsonRolnaam": "namen",
                    "doeltype": "NatuurlijkPersoon_Naam",
                    "momentvoorkomen": "enkelvoudig"
                },
                {
                    "rolnaam": "Burgerschappen",
                    "jsonRolnaam": "burgerschappen",
                    "doeltype": "NatuurlijkPersoon_Burgerschap",
                    "momentvoorkomen": "meervoudig"
                },
                {
                    "rolnaam": "Partnernamen",
                    "jsonRolnaam": "partnernamen",
                    "doeltype": "NatuurlijkPersoon_Partnernaam",
                    "momentvoorkomen": "enkelvoudig"
                },
                {
                    "rolnaam": "Naamgebruiken",
                    "jsonRolnaam": "naamgebruiken",
                    "doeltype": "NatuurlijkPersoon_Naamgebruik",
                    "momentvoorkomen": "enkelvoudig"
                },
                {
                    "rolnaam": "Bereikbaarheden",
                    "jsonRolnaam": "bereikbaarheden",
                    "doeltype": "Bereikbaarheid",
                    "momentvoorkomen": "enkelvoudig"
                },
                {
                    "rolnaam": "Aanvang",
                    "jsonRolnaam": "aanvang",
                    "doeltype": "NatuurlijkPersoon_Aanvang",
                    "momentvoorkomen": "enkelvoudig"
                },
                {
                    "rolnaam": "Einde",
                    "jsonRolnaam": "einde",
                    "doeltype": "NatuurlijkPersoon_Einde",
                    "momentvoorkomen": "enkelvoudig"
                }
            ],
            "afgeleideVelden": [
                {
                    "naam": "weergavenaam",
                    "description": "Samengestelde weergavenaam van de persoon, afgeleid uit voornaam/tussenvoegsel/achternaam.",
                    "goType": "string",
                    "afleidingsregelTaal": "cel",
                    "afleidingsregel": "(Naam.roepnaam != null ? Naam.roepnaam : Naam.voorletters) + (Naam.tussenvoegsel != null ? ' ' + Naam.tussenvoegsel : '') + ' ' + Naam.achternaam",
                    "isWeergaveVeld": true
                }
            ]
        },
        {
            "typenaam": "NatuurlijkPersoon_Aanvang",
            "klassenaam": "Aanvang",
            "description": "Aanvangsdatum van NatuurlijkPersoon.",
            "metatype": "gegevenselement",
            "ge_subtype": "aanvang",
            "kleur": "#bfdbfe",
            "veldnaam": "natuurlijkpersoon_aanvang",
            "padnaam": "natuurlijkpersoon_aanvang",
            "meervoud": "natuurlijkpersoon_aanvang",
            "velden": [
                {
                    "naam": "natuurlijkpersoon_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "versie",
                    "type": "integer",
                    "verplicht": false,
                    "autoIncrement": true
                },
                {
                    "naam": "datum",
                    "type": "string",
                    "format": "date",
                    "verplicht": false
                }
            ],
            "tabelnaam": "natuurlijkpersoon_aanvang",
            "idKolom": "versie",
            "idAutoIncrement": true,
            "heeftPFK": true,
            "entiteitIDKolom": "natuurlijkpersoon_id",
            "bovenliggendTypenaam": "NatuurlijkPersoon",
            "momentvoorkomen": "enkelvoudig"
        },
        {
            "typenaam": "NatuurlijkPersoon_Burgerschap",
            "klassenaam": "Burgerschap",
            "description": "Nationaliteitsgegevens (burgerschap) van de natuurlijk persoon.",
            "metatype": "gegevenselement",
            "ge_subtype": "hub",
            "isMaterieel": true,
            "kleur": "#bfdbfe",
            "veldnaam": "burgerschap",
            "padnaam": "burgerschappen",
            "meervoud": "burgerschappen",
            "velden": [
                {
                    "naam": "natuurlijkpersoon_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "rel_id",
                    "type": "integer",
                    "verplicht": true,
                    "autoIncrement": true
                },
                {
                    "naam": "landcode",
                    "type": "string",
                    "verplicht": true
                },
                {
                    "naam": "nationaliteit",
                    "type": "string",
                    "verplicht": true
                }
            ],
            "tabelnaam": "natuurlijkpersoon_burgerschap",
            "idKolom": "rel_id",
            "idAutoIncrement": true,
            "heeftPFK": true,
            "entiteitIDKolom": "natuurlijkpersoon_id",
            "momentvoorkomen": "meervoudig",
            "onderliggende": [
                {
                    "rolnaam": "Data",
                    "jsonRolnaam": "data",
                    "doeltype": "NatuurlijkPersoon_Burgerschap_Data",
                    "momentvoorkomen": "enkelvoudig"
                },
                {
                    "rolnaam": "Aanvang",
                    "jsonRolnaam": "aanvang",
                    "doeltype": "NatuurlijkPersoon_Burgerschap_Aanvang",
                    "momentvoorkomen": "enkelvoudig"
                },
                {
                    "rolnaam": "Einde",
                    "jsonRolnaam": "einde",
                    "doeltype": "NatuurlijkPersoon_Burgerschap_Einde",
                    "momentvoorkomen": "enkelvoudig"
                }
            ],
            "afgeleideVelden": [
                {
                    "naam": "weergaveburgerschap",
                    "description": "Samengestelde weergave van nationaliteit en landcode.",
                    "goType": "string",
                    "afleidingsregelTaal": "cel",
                    "afleidingsregel": "Burgerschap_Data.nationaliteit + ' (' + Burgerschap_Data.landcode + ')'",
                    "isWeergaveVeld": true
                }
            ]
        },
        {
            "typenaam": "NatuurlijkPersoon_Burgerschap_Aanvang",
            "klassenaam": "Aanvang",
            "description": "Aanvangsdatum van NatuurlijkPersoon_Burgerschap.",
            "metatype": "gegevenselement",
            "ge_subtype": "aanvang",
            "kleur": "#bfdbfe",
            "veldnaam": "natuurlijkpersoon_burgerschap_aanvang",
            "padnaam": "natuurlijkpersoon_burgerschap_aanvang",
            "meervoud": "natuurlijkpersoon_burgerschap_aanvang",
            "velden": [
                {
                    "naam": "natuurlijkpersoon_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "rel_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "versie",
                    "type": "integer",
                    "verplicht": false,
                    "autoIncrement": true
                },
                {
                    "naam": "datum",
                    "type": "string",
                    "format": "date",
                    "verplicht": false
                }
            ],
            "tabelnaam": "natuurlijkpersoon_burgerschap_aanvang",
            "idKolom": "versie",
            "idAutoIncrement": true,
            "heeftPFK": true,
            "entiteitIDKolom": "natuurlijkpersoon_id",
            "bovenliggendTypenaam": "NatuurlijkPersoon_Burgerschap",
            "momentvoorkomen": "enkelvoudig"
        },
        {
            "typenaam": "NatuurlijkPersoon_Burgerschap_Data",
            "klassenaam": "Data",
            "description": "Geversioned inhoud van NatuurlijkPersoon_Burgerschap.",
            "metatype": "gegevenselement",
            "ge_subtype": "data",
            "kleur": "#bfdbfe",
            "veldnaam": "natuurlijkpersoon_burgerschap_data",
            "padnaam": "natuurlijkpersoon_burgerschap_data",
            "meervoud": "natuurlijkpersoon_burgerschap_data",
            "velden": [
                {
                    "naam": "natuurlijkpersoon_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "rel_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "versie",
                    "type": "integer",
                    "verplicht": false,
                    "autoIncrement": true
                },
                {
                    "naam": "landcode",
                    "type": "string",
                    "verplicht": true
                },
                {
                    "naam": "nationaliteit",
                    "type": "string",
                    "verplicht": true
                }
            ],
            "tabelnaam": "natuurlijkpersoon_burgerschap_data",
            "idKolom": "versie",
            "idAutoIncrement": true,
            "heeftPFK": true,
            "entiteitIDKolom": "natuurlijkpersoon_id",
            "bovenliggendTypenaam": "NatuurlijkPersoon_Burgerschap",
            "momentvoorkomen": "enkelvoudig"
        },
        {
            "typenaam": "NatuurlijkPersoon_Burgerschap_Einde",
            "klassenaam": "Einde",
            "description": "Einddatum van NatuurlijkPersoon_Burgerschap.",
            "metatype": "gegevenselement",
            "ge_subtype": "einde",
            "kleur": "#bfdbfe",
            "veldnaam": "natuurlijkpersoon_burgerschap_einde",
            "padnaam": "natuurlijkpersoon_burgerschap_einde",
            "meervoud": "natuurlijkpersoon_burgerschap_einde",
            "velden": [
                {
                    "naam": "natuurlijkpersoon_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "rel_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "versie",
                    "type": "integer",
                    "verplicht": false,
                    "autoIncrement": true
                },
                {
                    "naam": "datum",
                    "type": "string",
                    "format": "date",
                    "verplicht": false
                }
            ],
            "tabelnaam": "natuurlijkpersoon_burgerschap_einde",
            "idKolom": "versie",
            "idAutoIncrement": true,
            "heeftPFK": true,
            "entiteitIDKolom": "natuurlijkpersoon_id",
            "bovenliggendTypenaam": "NatuurlijkPersoon_Burgerschap",
            "momentvoorkomen": "enkelvoudig"
        },
        {
            "typenaam": "NatuurlijkPersoon_Einde",
            "klassenaam": "Einde",
            "description": "Einddatum van NatuurlijkPersoon.",
            "metatype": "gegevenselement",
            "ge_subtype": "einde",
            "kleur": "#bfdbfe",
            "veldnaam": "natuurlijkpersoon_einde",
            "padnaam": "natuurlijkpersoon_einde",
            "meervoud": "natuurlijkpersoon_einde",
            "velden": [
                {
                    "naam": "natuurlijkpersoon_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "versie",
                    "type": "integer",
                    "verplicht": false,
                    "autoIncrement": true
                },
                {
                    "naam": "datum",
                    "type": "string",
                    "format": "date",
                    "verplicht": false
                }
            ],
            "tabelnaam": "natuurlijkpersoon_einde",
            "idKolom": "versie",
            "idAutoIncrement": true,
            "heeftPFK": true,
            "entiteitIDKolom": "natuurlijkpersoon_id",
            "bovenliggendTypenaam": "NatuurlijkPersoon",
            "momentvoorkomen": "enkelvoudig"
        },
        {
            "typenaam": "NatuurlijkPersoon_Naam",
            "klassenaam": "Naam",
            "description": "Naamgegevens van de natuurlijk persoon (voorletters, roepnaam, tussenvoegsel, achternaam).",
            "metatype": "gegevenselement",
            "ge_subtype": "hub",
            "kleur": "#bfdbfe",
            "veldnaam": "naam",
            "padnaam": "namen",
            "meervoud": "namen",
            "velden": [
                {
                    "naam": "natuurlijkpersoon_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "rel_id",
                    "type": "integer",
                    "verplicht": true,
                    "autoIncrement": true
                },
                {
                    "naam": "voorletters",
                    "type": "string",
                    "verplicht": true
                },
                {
                    "naam": "roepnaam",
                    "type": "string",
                    "verplicht": false
                },
                {
                    "naam": "tussenvoegsel",
                    "type": "string",
                    "verplicht": false
                },
                {
                    "naam": "achternaam",
                    "type": "string",
                    "verplicht": true
                }
            ],
            "tabelnaam": "natuurlijkpersoon_naam",
            "idKolom": "rel_id",
            "idAutoIncrement": true,
            "heeftPFK": true,
            "entiteitIDKolom": "natuurlijkpersoon_id",
            "momentvoorkomen": "enkelvoudig",
            "onderliggende": [
                {
                    "rolnaam": "Data",
                    "jsonRolnaam": "data",
                    "doeltype": "NatuurlijkPersoon_Naam_Data",
                    "momentvoorkomen": "enkelvoudig"
                }
            ]
        },
        {
            "typenaam": "NatuurlijkPersoon_Naam_Data",
            "klassenaam": "Data",
            "description": "Geversioned inhoud van NatuurlijkPersoon_Naam.",
            "metatype": "gegevenselement",
            "ge_subtype": "data",
            "kleur": "#bfdbfe",
            "veldnaam": "natuurlijkpersoon_naam_data",
            "padnaam": "natuurlijkpersoon_naam_data",
            "meervoud": "natuurlijkpersoon_naam_data",
            "velden": [
                {
                    "naam": "natuurlijkpersoon_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "rel_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "versie",
                    "type": "integer",
                    "verplicht": false,
                    "autoIncrement": true
                },
                {
                    "naam": "voorletters",
                    "type": "string",
                    "verplicht": true
                },
                {
                    "naam": "roepnaam",
                    "type": "string",
                    "verplicht": false
                },
                {
                    "naam": "tussenvoegsel",
                    "type": "string",
                    "verplicht": false
                },
                {
                    "naam": "achternaam",
                    "type": "string",
                    "verplicht": true
                }
            ],
            "tabelnaam": "natuurlijkpersoon_naam_data",
            "idKolom": "versie",
            "idAutoIncrement": true,
            "heeftPFK": true,
            "entiteitIDKolom": "natuurlijkpersoon_id",
            "bovenliggendTypenaam": "NatuurlijkPersoon_Naam",
            "momentvoorkomen": "enkelvoudig"
        },
        {
            "typenaam": "NatuurlijkPersoon_Naamgebruik",
            "klassenaam": "Naamgebruik",
            "description": "Wijze waarop de geslachtsnaam wordt gebruikt.",
            "metatype": "gegevenselement",
            "ge_subtype": "hub",
            "kleur": "#bfdbfe",
            "veldnaam": "naamgebruik",
            "padnaam": "naamgebruiken",
            "meervoud": "naamgebruiken",
            "velden": [
                {
                    "naam": "natuurlijkpersoon_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "rel_id",
                    "type": "integer",
                    "verplicht": true,
                    "autoIncrement": true
                },
                {
                    "naam": "naamgebruik",
                    "type": "string",
                    "enum": [
                        "EigenNaam",
                        "PartnerNaam",
                        "EigenNaam-PartnerNaam",
                        "PartnerNaam-EigenNaam"
                    ],
                    "verplicht": true
                }
            ],
            "tabelnaam": "natuurlijkpersoon_naamgebruik",
            "idKolom": "rel_id",
            "idAutoIncrement": true,
            "heeftPFK": true,
            "entiteitIDKolom": "natuurlijkpersoon_id",
            "momentvoorkomen": "enkelvoudig",
            "onderliggende": [
                {
                    "rolnaam": "Data",
                    "jsonRolnaam": "data",
                    "doeltype": "NatuurlijkPersoon_Naamgebruik_Data",
                    "momentvoorkomen": "enkelvoudig"
                }
            ]
        },
        {
            "typenaam": "NatuurlijkPersoon_Naamgebruik_Data",
            "klassenaam": "Data",
            "description": "Geversioned inhoud van NatuurlijkPersoon_Naamgebruik.",
            "metatype": "gegevenselement",
            "ge_subtype": "data",
            "kleur": "#bfdbfe",
            "veldnaam": "natuurlijkpersoon_naamgebruik_data",
            "padnaam": "natuurlijkpersoon_naamgebruik_data",
            "meervoud": "natuurlijkpersoon_naamgebruik_data",
            "velden": [
                {
                    "naam": "natuurlijkpersoon_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "rel_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "versie",
                    "type": "integer",
                    "verplicht": false,
                    "autoIncrement": true
                },
                {
                    "naam": "naamgebruik",
                    "type": "string",
                    "enum": [
                        "EigenNaam",
                        "PartnerNaam",
                        "EigenNaam-PartnerNaam",
                        "PartnerNaam-EigenNaam"
                    ],
                    "verplicht": true
                }
            ],
            "tabelnaam": "natuurlijkpersoon_naamgebruik_data",
            "idKolom": "versie",
            "idAutoIncrement": true,
            "heeftPFK": true,
            "entiteitIDKolom": "natuurlijkpersoon_id",
            "bovenliggendTypenaam": "NatuurlijkPersoon_Naamgebruik",
            "momentvoorkomen": "enkelvoudig"
        },
        {
            "typenaam": "NatuurlijkPersoon_Partnernaam",
            "klassenaam": "Partnernaam",
            "description": "Achternaam van de partner van de natuurlijk persoon.",
            "metatype": "gegevenselement",
            "ge_subtype": "hub",
            "kleur": "#bfdbfe",
            "veldnaam": "partnernaam",
            "padnaam": "partnernamen",
            "meervoud": "partnernamen",
            "velden": [
                {
                    "naam": "natuurlijkpersoon_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "rel_id",
                    "type": "integer",
                    "verplicht": true,
                    "autoIncrement": true
                },
                {
                    "naam": "achternaam",
                    "type": "string",
                    "verplicht": true
                }
            ],
            "tabelnaam": "natuurlijkpersoon_partnernaam",
            "idKolom": "rel_id",
            "idAutoIncrement": true,
            "heeftPFK": true,
            "entiteitIDKolom": "natuurlijkpersoon_id",
            "momentvoorkomen": "enkelvoudig",
            "onderliggende": [
                {
                    "rolnaam": "Data",
                    "jsonRolnaam": "data",
                    "doeltype": "NatuurlijkPersoon_Partnernaam_Data",
                    "momentvoorkomen": "enkelvoudig"
                }
            ]
        },
        {
            "typenaam": "NatuurlijkPersoon_Partnernaam_Data",
            "klassenaam": "Data",
            "description": "Geversioned inhoud van NatuurlijkPersoon_Partnernaam.",
            "metatype": "gegevenselement",
            "ge_subtype": "data",
            "kleur": "#bfdbfe",
            "veldnaam": "natuurlijkpersoon_partnernaam_data",
            "padnaam": "natuurlijkpersoon_partnernaam_data",
            "meervoud": "natuurlijkpersoon_partnernaam_data",
            "velden": [
                {
                    "naam": "natuurlijkpersoon_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "rel_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "versie",
                    "type": "integer",
                    "verplicht": false,
                    "autoIncrement": true
                },
                {
                    "naam": "achternaam",
                    "type": "string",
                    "verplicht": true
                }
            ],
            "tabelnaam": "natuurlijkpersoon_partnernaam_data",
            "idKolom": "versie",
            "idAutoIncrement": true,
            "heeftPFK": true,
            "entiteitIDKolom": "natuurlijkpersoon_id",
            "bovenliggendTypenaam": "NatuurlijkPersoon_Partnernaam",
            "momentvoorkomen": "enkelvoudig"
        },
        {
            "typenaam": "NatuurlijkPersoon_Persoonsidentificatie",
            "klassenaam": "Persoonsidentificatie",
            "description": "Identificerende gegevens van de natuurlijk persoon (BSN, ingezetene).",
            "metatype": "gegevenselement",
            "ge_subtype": "hub",
            "kleur": "#bfdbfe",
            "veldnaam": "persoonsidentificatie",
            "padnaam": "persoonsidentificaties",
            "meervoud": "persoonsidentificaties",
            "velden": [
                {
                    "naam": "natuurlijkpersoon_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "rel_id",
                    "type": "integer",
                    "verplicht": true,
                    "autoIncrement": true
                },
                {
                    "naam": "bsn",
                    "type": "string",
                    "verplicht": true
                },
                {
                    "naam": "ingezetene",
                    "type": "boolean",
                    "verplicht": false
                }
            ],
            "tabelnaam": "natuurlijkpersoon_persoonsidentificatie",
            "idKolom": "rel_id",
            "idAutoIncrement": true,
            "heeftPFK": true,
            "entiteitIDKolom": "natuurlijkpersoon_id",
            "momentvoorkomen": "enkelvoudig",
            "onderliggende": [
                {
                    "rolnaam": "Data",
                    "jsonRolnaam": "data",
                    "doeltype": "NatuurlijkPersoon_Persoonsidentificatie_Data",
                    "momentvoorkomen": "enkelvoudig"
                }
            ]
        },
        {
            "typenaam": "NatuurlijkPersoon_Persoonsidentificatie_Data",
            "klassenaam": "Data",
            "description": "Geversioned inhoud van NatuurlijkPersoon_Persoonsidentificatie.",
            "metatype": "gegevenselement",
            "ge_subtype": "data",
            "kleur": "#bfdbfe",
            "veldnaam": "natuurlijkpersoon_persoonsidentificatie_data",
            "padnaam": "natuurlijkpersoon_persoonsidentificatie_data",
            "meervoud": "natuurlijkpersoon_persoonsidentificatie_data",
            "velden": [
                {
                    "naam": "natuurlijkpersoon_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "rel_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "versie",
                    "type": "integer",
                    "verplicht": false,
                    "autoIncrement": true
                },
                {
                    "naam": "bsn",
                    "type": "string",
                    "verplicht": true,
                    "datatype": "BSN"
                },
                {
                    "naam": "ingezetene",
                    "type": "boolean",
                    "verplicht": false
                }
            ],
            "tabelnaam": "natuurlijkpersoon_persoonsidentificatie_data",
            "idKolom": "versie",
            "idAutoIncrement": true,
            "heeftPFK": true,
            "entiteitIDKolom": "natuurlijkpersoon_id",
            "bovenliggendTypenaam": "NatuurlijkPersoon_Persoonsidentificatie",
            "momentvoorkomen": "enkelvoudig"
        },
        {
            "typenaam": "Referentielijst",
            "klassenaam": "Referentielijst",
            "description": "Generieke referentielijst-entiteit. Individuele lijsten (Landenlijst, EULidstaten, etc.) zijn records.",
            "metatype": "entiteit",
            "isMaterieel": true,
            "entiteitSubtype": "referentielijst",
            "domein": "register",
            "kleur": "#fef3c7",
            "veldnaam": "referentielijst",
            "padnaam": "referentielijsten",
            "meervoud": "referentielijsten",
            "velden": [
                {
                    "naam": "id",
                    "type": "integer",
                    "verplicht": true,
                    "autoIncrement": true
                },
                {
                    "naam": "systeemnaam",
                    "type": "string",
                    "verplicht": true
                },
                {
                    "naam": "referentielijstnamen",
                    "type": "Referentielijstnaam",
                    "format": "array",
                    "verplicht": false
                },
                {
                    "naam": "referentielijstomschrijvingen",
                    "type": "Referentielijstomschrijving",
                    "format": "array",
                    "verplicht": false
                },
                {
                    "naam": "visibilities",
                    "type": "ReferentielijstVisibility",
                    "format": "array",
                    "verplicht": false
                },
                {
                    "naam": "internetadressen",
                    "type": "ReferentielijstInternetadres",
                    "format": "array",
                    "verplicht": false
                },
                {
                    "naam": "landenlijst_landen",
                    "type": "LandenlijstLand",
                    "format": "array",
                    "verplicht": false
                },
                {
                    "naam": "adellijke_titels_titels",
                    "type": "AdellijkeTitelsTitel",
                    "format": "array",
                    "verplicht": false
                }
            ],
            "tabelnaam": "register_referentielijst",
            "idKolom": "id",
            "heeftPFK": false,
            "onderliggende": [
                {
                    "rolnaam": "Referentielijstnamen",
                    "jsonRolnaam": "referentielijstnamen",
                    "doeltype": "Referentielijstnaam",
                    "momentvoorkomen": "enkelvoudig"
                },
                {
                    "rolnaam": "Referentielijstomschrijvingen",
                    "jsonRolnaam": "referentielijstomschrijvingen",
                    "doeltype": "Referentielijstomschrijving",
                    "momentvoorkomen": "enkelvoudig"
                },
                {
                    "rolnaam": "Visibilities",
                    "jsonRolnaam": "visibilities",
                    "doeltype": "ReferentielijstVisibility",
                    "momentvoorkomen": "enkelvoudig"
                },
                {
                    "rolnaam": "Internetadressen",
                    "jsonRolnaam": "internetadressen",
                    "doeltype": "ReferentielijstInternetadres",
                    "momentvoorkomen": "meervoudig"
                },
                {
                    "rolnaam": "Aanvang",
                    "jsonRolnaam": "aanvang",
                    "doeltype": "Referentielijst_Aanvang",
                    "momentvoorkomen": "enkelvoudig"
                },
                {
                    "rolnaam": "Einde",
                    "jsonRolnaam": "einde",
                    "doeltype": "Referentielijst_Einde",
                    "momentvoorkomen": "enkelvoudig"
                },
                {
                    "rolnaam": "LandenlijstLanden",
                    "jsonRolnaam": "landenlijst_landen",
                    "doeltype": "LandenlijstLand",
                    "momentvoorkomen": "meervoudig"
                },
                {
                    "rolnaam": "AdellijkeTitelsTitels",
                    "jsonRolnaam": "adellijke_titels_titels",
                    "doeltype": "AdellijkeTitelsTitel",
                    "momentvoorkomen": "meervoudig"
                }
            ]
        },
        {
            "typenaam": "ReferentielijstInternetadres",
            "klassenaam": "Internetadres",
            "description": "Internetadres (URL/URN) van een referentielijst.",
            "metatype": "gegevenselement",
            "ge_subtype": "hub",
            "kleur": "#fef3c7",
            "veldnaam": "internetadres",
            "padnaam": "internetadressen",
            "meervoud": "internetadressen",
            "velden": [
                {
                    "naam": "referentielijst_id",
                    "description": "ID van de Referentielijst-entiteit",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "rel_id",
                    "type": "integer",
                    "verplicht": true,
                    "autoIncrement": true
                },
                {
                    "naam": "data",
                    "type": "ReferentielijstInternetadres_Data",
                    "format": "array",
                    "verplicht": false
                }
            ],
            "tabelnaam": "referentielijstinternetadres",
            "idKolom": "rel_id",
            "idAutoIncrement": true,
            "heeftPFK": true,
            "entiteitIDKolom": "referentielijst_id",
            "bovenliggendTypenaam": "Referentielijst",
            "momentvoorkomen": "meervoudig",
            "onderliggende": [
                {
                    "rolnaam": "Data",
                    "jsonRolnaam": "data",
                    "doeltype": "ReferentielijstInternetadres_Data",
                    "momentvoorkomen": "enkelvoudig"
                }
            ]
        },
        {
            "typenaam": "ReferentielijstInternetadres_Data",
            "klassenaam": "Data",
            "description": "Geversioned inhoud van ReferentielijstInternetadres.",
            "metatype": "gegevenselement",
            "ge_subtype": "data",
            "kleur": "#fef3c7",
            "veldnaam": "referentielijstinternetadres_data",
            "padnaam": "referentielijstinternetadres_data",
            "meervoud": "referentielijstinternetadres_data",
            "velden": [
                {
                    "naam": "referentielijst_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "rel_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "versie",
                    "type": "integer",
                    "verplicht": false,
                    "autoIncrement": true
                },
                {
                    "naam": "adrestype",
                    "description": "Type adres: URL of URN.",
                    "type": "string",
                    "enum": [
                        "URL",
                        "URN"
                    ],
                    "verplicht": true
                },
                {
                    "naam": "adres",
                    "description": "Het volledige internet-adres (URL of URN).",
                    "type": "string",
                    "verplicht": true
                },
                {
                    "naam": "organisatie",
                    "description": "Verantwoordelijke organisatie voor dit adres.",
                    "type": "string",
                    "verplicht": true
                }
            ],
            "tabelnaam": "referentielijstinternetadres_data",
            "idKolom": "versie",
            "idAutoIncrement": true,
            "heeftPFK": true,
            "entiteitIDKolom": "referentielijst_id",
            "bovenliggendTypenaam": "ReferentielijstInternetadres",
            "momentvoorkomen": "enkelvoudig"
        },
        {
            "typenaam": "ReferentielijstVisibility",
            "klassenaam": "Visibility",
            "description": "Domeinzichtbaarheid van een referentielijst (register, modelspecifiek, extern).",
            "metatype": "gegevenselement",
            "ge_subtype": "hub",
            "kleur": "#fef3c7",
            "veldnaam": "visibility",
            "padnaam": "visibilities",
            "meervoud": "visibilities",
            "velden": [
                {
                    "naam": "referentielijst_id",
                    "description": "ID van de Referentielijst-entiteit",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "rel_id",
                    "type": "integer",
                    "verplicht": true,
                    "autoIncrement": true
                },
                {
                    "naam": "data",
                    "type": "ReferentielijstVisibility_Data",
                    "format": "array",
                    "verplicht": false
                }
            ],
            "tabelnaam": "referentielijstvisibility",
            "idKolom": "rel_id",
            "idAutoIncrement": true,
            "heeftPFK": true,
            "entiteitIDKolom": "referentielijst_id",
            "bovenliggendTypenaam": "Referentielijst",
            "momentvoorkomen": "enkelvoudig",
            "onderliggende": [
                {
                    "rolnaam": "Data",
                    "jsonRolnaam": "data",
                    "doeltype": "ReferentielijstVisibility_Data",
                    "momentvoorkomen": "enkelvoudig"
                }
            ]
        },
        {
            "typenaam": "ReferentielijstVisibility_Data",
            "klassenaam": "Data",
            "description": "Geversioned inhoud van ReferentielijstVisibility.",
            "metatype": "gegevenselement",
            "ge_subtype": "data",
            "kleur": "#fef3c7",
            "veldnaam": "referentielijstvisibility_data",
            "padnaam": "referentielijstvisibility_data",
            "meervoud": "referentielijstvisibility_data",
            "velden": [
                {
                    "naam": "referentielijst_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "rel_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "versie",
                    "type": "integer",
                    "verplicht": false,
                    "autoIncrement": true
                },
                {
                    "naam": "domein",
                    "description": "Domeinzichtbaarheid: 'register', modelspecifiek domein, of 'extern'.",
                    "type": "string",
                    "verplicht": true
                }
            ],
            "tabelnaam": "referentielijstvisibility_data",
            "idKolom": "versie",
            "idAutoIncrement": true,
            "heeftPFK": true,
            "entiteitIDKolom": "referentielijst_id",
            "bovenliggendTypenaam": "ReferentielijstVisibility",
            "momentvoorkomen": "enkelvoudig"
        },
        {
            "typenaam": "Referentielijst_Aanvang",
            "klassenaam": "Aanvang",
            "description": "Aanvangsdatum van referentielijst.",
            "metatype": "gegevenselement",
            "ge_subtype": "aanvang",
            "kleur": "#fef3c7",
            "veldnaam": "referentielijst_aanvang",
            "padnaam": "referentielijst_aanvang",
            "meervoud": "referentielijst_aanvang",
            "velden": [
                {
                    "naam": "referentielijst_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "versie",
                    "type": "integer",
                    "verplicht": false,
                    "autoIncrement": true
                },
                {
                    "naam": "datum",
                    "type": "string",
                    "format": "date",
                    "verplicht": false
                }
            ],
            "tabelnaam": "referentielijst_aanvang",
            "idKolom": "versie",
            "idAutoIncrement": true,
            "heeftPFK": true,
            "entiteitIDKolom": "referentielijst_id",
            "bovenliggendTypenaam": "Referentielijst",
            "momentvoorkomen": "enkelvoudig"
        },
        {
            "typenaam": "Referentielijst_Einde",
            "klassenaam": "Einde",
            "description": "Einddatum van referentielijst.",
            "metatype": "gegevenselement",
            "ge_subtype": "einde",
            "kleur": "#fef3c7",
            "veldnaam": "referentielijst_einde",
            "padnaam": "referentielijst_einde",
            "meervoud": "referentielijst_einde",
            "velden": [
                {
                    "naam": "referentielijst_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "versie",
                    "type": "integer",
                    "verplicht": false,
                    "autoIncrement": true
                },
                {
                    "naam": "datum",
                    "type": "string",
                    "format": "date",
                    "verplicht": false
                }
            ],
            "tabelnaam": "referentielijst_einde",
            "idKolom": "versie",
            "idAutoIncrement": true,
            "heeftPFK": true,
            "entiteitIDKolom": "referentielijst_id",
            "bovenliggendTypenaam": "Referentielijst",
            "momentvoorkomen": "enkelvoudig"
        },
        {
            "typenaam": "Referentielijstnaam",
            "klassenaam": "Referentielijstnaam",
            "description": "Leesbare naam van een referentielijst.",
            "metatype": "gegevenselement",
            "ge_subtype": "hub",
            "kleur": "#fef3c7",
            "veldnaam": "referentielijstnaam",
            "padnaam": "referentielijstnamen",
            "meervoud": "referentielijstnamen",
            "velden": [
                {
                    "naam": "referentielijst_id",
                    "description": "ID van de Referentielijst-entiteit",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "rel_id",
                    "type": "integer",
                    "verplicht": true,
                    "autoIncrement": true
                },
                {
                    "naam": "data",
                    "type": "Referentielijstnaam_Data",
                    "format": "array",
                    "verplicht": false
                }
            ],
            "tabelnaam": "referentielijstnaam",
            "idKolom": "rel_id",
            "idAutoIncrement": true,
            "heeftPFK": true,
            "entiteitIDKolom": "referentielijst_id",
            "bovenliggendTypenaam": "Referentielijst",
            "momentvoorkomen": "enkelvoudig",
            "onderliggende": [
                {
                    "rolnaam": "Data",
                    "jsonRolnaam": "data",
                    "doeltype": "Referentielijstnaam_Data",
                    "momentvoorkomen": "enkelvoudig"
                }
            ]
        },
        {
            "typenaam": "Referentielijstnaam_Data",
            "klassenaam": "Data",
            "description": "Geversioned inhoud van Referentielijstnaam.",
            "metatype": "gegevenselement",
            "ge_subtype": "data",
            "kleur": "#fef3c7",
            "veldnaam": "referentielijstnaam_data",
            "padnaam": "referentielijstnaam_data",
            "meervoud": "referentielijstnaam_data",
            "velden": [
                {
                    "naam": "referentielijst_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "rel_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "versie",
                    "type": "integer",
                    "verplicht": false,
                    "autoIncrement": true
                },
                {
                    "naam": "naam",
                    "type": "string",
                    "verplicht": true
                }
            ],
            "tabelnaam": "referentielijstnaam_data",
            "idKolom": "versie",
            "idAutoIncrement": true,
            "heeftPFK": true,
            "entiteitIDKolom": "referentielijst_id",
            "bovenliggendTypenaam": "Referentielijstnaam",
            "momentvoorkomen": "enkelvoudig"
        },
        {
            "typenaam": "Referentielijstomschrijving",
            "klassenaam": "Referentielijstomschrijving",
            "description": "Omschrijving van een referentielijst.",
            "metatype": "gegevenselement",
            "ge_subtype": "hub",
            "kleur": "#fef3c7",
            "veldnaam": "referentielijstomschrijving",
            "padnaam": "referentielijstomschrijvingen",
            "meervoud": "referentielijstomschrijvingen",
            "velden": [
                {
                    "naam": "referentielijst_id",
                    "description": "ID van de Referentielijst-entiteit",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "rel_id",
                    "type": "integer",
                    "verplicht": true,
                    "autoIncrement": true
                },
                {
                    "naam": "data",
                    "type": "Referentielijstomschrijving_Data",
                    "format": "array",
                    "verplicht": false
                }
            ],
            "tabelnaam": "referentielijstomschrijving",
            "idKolom": "rel_id",
            "idAutoIncrement": true,
            "heeftPFK": true,
            "entiteitIDKolom": "referentielijst_id",
            "bovenliggendTypenaam": "Referentielijst",
            "momentvoorkomen": "enkelvoudig",
            "onderliggende": [
                {
                    "rolnaam": "Data",
                    "jsonRolnaam": "data",
                    "doeltype": "Referentielijstomschrijving_Data",
                    "momentvoorkomen": "enkelvoudig"
                }
            ]
        },
        {
            "typenaam": "Referentielijstomschrijving_Data",
            "klassenaam": "Data",
            "description": "Geversioned inhoud van Referentielijstomschrijving.",
            "metatype": "gegevenselement",
            "ge_subtype": "data",
            "kleur": "#fef3c7",
            "veldnaam": "referentielijstomschrijving_data",
            "padnaam": "referentielijstomschrijving_data",
            "meervoud": "referentielijstomschrijving_data",
            "velden": [
                {
                    "naam": "referentielijst_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "rel_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "versie",
                    "type": "integer",
                    "verplicht": false,
                    "autoIncrement": true
                },
                {
                    "naam": "omschrijving",
                    "type": "string",
                    "verplicht": true
                }
            ],
            "tabelnaam": "referentielijstomschrijving_data",
            "idKolom": "versie",
            "idAutoIncrement": true,
            "heeftPFK": true,
            "entiteitIDKolom": "referentielijst_id",
            "bovenliggendTypenaam": "Referentielijstomschrijving",
            "momentvoorkomen": "enkelvoudig"
        }
    ]
}

---

## 🧑 User

datatypes dubbel en de FE klaagt over ongeldige json

---

## 🤖 Assistant

Helder, ik ga nu de V3-exporter nalopen op datatype-opbouw en direct fixen dat namen uniek worden (geen dubbele `NLPostcode`/`BSN`), plus checken waarom de FE die response als ongeldig markeert.Ik zie de oorzaak nu scherp:  wordt dubbel gevuld (legacy + ), waardoor `BSN`/`NLPostcode` dubbel in JSON komen. Ik ga dit in de exporter robuust oplossen met domeinbewuste deduplicatie op datatypenaam, plus test erbij.

---

## 🧑 User

het is np-loc en register door elkaar, geen AB dan misschien

---

## 🤖 Assistant

 mix stukmaakt.Ik ga nu een kleine, gerichte fix in de exporter zetten: datatypes filteren + dedupliceren op naam met voorkeur voor expliciet gelabelde entries (/`register`) boven legacy lege domeinwaarden. Daarna draai ik de modeltests.
```

```

```

```
De testtool pakt dit Go-testbestand hier niet op, dus ik valideer nu via `go test` in de model-package en check daarna direct de endpoint-output op dubbele datatypes.De live API draait nog oude code; ik start nu de v06 API opnieuw en check meteen opnieuw op  zodat je het verschil direct ziet.De vorige start mislukte omdat hij in de workspace-root liep; ik start de API nu expliciet vanuit de v06-map en verifieer daarna opnieuw het endpoint.Ik maak nog een extra FE-veiligheidsfix: de editor gaat dubbele datatype-namen nu defensief dedupliceren, zodat ook oudere opgeslagen modellen de UI niet breken.
```

```
Ja, dit beeld klopt nu inhoudelijk grotendeels:

1. np-loc + register samen is verwacht gedrag.
2. AB ontbreekt nu, dus de recursive domeinfilter werkt zoals bedoeld.
3. Je extra probleem zat in dubbele datatypes (BSN/NLPostcode), en dat heb ik nu gefixt.

Wat ik heb aangepast:

1. Backend dedupe op datatypes in V3 export:




2. Regressietest toegevoegd:


3. Frontend defensief gemaakt tegen dubbele datatype-namen (voorkomt dubbele node-id in editor):



Validatie:

1. Go test geslaagd op model-exporter.
2. Vite build geslaagd.
3. Export via cmd/export_v3 met domein np-loc geeft nu 2 datatypes en geen duplicates.

Belangrijk voor wat jij nu ziet op de live endpoint:
de API op poort 8082 draaide nog oude code tijdens jouw call, daarom zag je daar nog 4 datatypes met dubbels.  
Na herstart van de API zou /api/schema/model/code?domein=np-loc de dubbele datatypes niet meer moeten bevatten.

---

## 🧑 User

Ik zie nu nog wel 4x "domein": "register"
- voor 2 datatypen
- land
- nog iets

Hoe kan dat? Die komen ook uit de register generatie, dus dat gaat elkaar bijten, toch?

{
    "bron": "code",
    "build_versie": "",
    "go_module": "",
    "id": null,
    "indiener": "",
    "model": {
        "versie": "v3",
        "datatypes": [
            {
                "naam": "NLPostcode",
                "description": "Nederlandse postcode (4 cijfers + 2 letters)",
                "basistype": "string",
                "format": "nl-postcode",
                "domein": "register",
                "positie": {
                    "x": 750,
                    "y": 345
                },
                "validatie": {
                    "pattern": "^[1-9][0-9]{3}\\s?[A-Za-z]{2}$",
                    "minLength": 6,
                    "maxLength": 7,
                    "voorbeelden": [
                        "1234 AB",
                        "9999ZZ"
                    ],
                    "foutmelding": "Voer een geldige postcode in (bijv. 1234 AB)"
                },
                "normalisatie": "uppercase_letters",
                "weergave": {
                    "placeholder": "1234 AB",
                    "inputMask": "0000 AA"
                }
            },
            {
                "naam": "BSN",
                "description": "Burgerservicenummer (9 cijfers, 11-proef)",
                "basistype": "string",
                "format": "bsn",
                "domein": "register",
                "positie": {
                    "x": -480,
                    "y": 165
                },
                "validatie": {
                    "pattern": "^[0-9]{9}$",
                    "minLength": 9,
                    "maxLength": 9,
                    "voorbeelden": [
                        "123456782"
                    ],
                    "foutmelding": "Voer een geldig BSN in (9 cijfers, 11-proef)",
                    "regels": [
                        {
                            "naam": "11-proef",
                            "type": "checksum",
                            "expressie": "(9*d1 + 8*d2 + 7*d3 + 6*d4 + 5*d5 + 4*d6 + 3*d7 + 2*d8 - 1*d9) % 11 == 0"
                        }
                    ]
                },
                "weergave": {
                    "placeholder": "123456782",
                    "inputMask": "000000000"
                }
            }
        ],
        "enums": [
            {
                "goType": "Naamgebruiksoort",
                "baseType": "string",
                "positie": {
                    "x": 285,
                    "y": 405
                },
                "waarden": [
                    {
                        "constNaam": "NaamgebruiksoortEigenNaam",
                        "waarde": "EigenNaam"
                    },
                    {
                        "constNaam": "NaamgebruiksoortPartnerNaam",
                        "waarde": "PartnerNaam"
                    },
                    {
                        "constNaam": "NaamgebruiksoortEigenNaamPartnerNaam",
                        "waarde": "EigenNaam-PartnerNaam"
                    },
                    {
                        "constNaam": "NaamgebruiksoortPartnerNaamEigenNaam",
                        "waarde": "PartnerNaam-EigenNaam"
                    }
                ]
            },
            {
                "goType": "Bereikbaarheidssoort",
                "baseType": "string",
                "positie": {
                    "x": 330,
                    "y": 60
                },
                "waarden": [
                    {
                        "constNaam": "BereikbaarheidssoortWoonadres",
                        "waarde": "Woonadres"
                    },
                    {
                        "constNaam": "BereikbaarheidssoortBriefadres",
                        "waarde": "Briefadres"
                    },
                    {
                        "constNaam": "BereikbaarheidssoortCorrespondentieadres",
                        "waarde": "Correspondentieadres"
                    }
                ]
            },
            {
                "goType": "ReferentielijstAdrestype",
                "baseType": "string",
                "positie": {
                    "x": 1890,
                    "y": 120
                },
                "waarden": [
                    {
                        "constNaam": "ReferentielijstAdrestypeURL",
                        "waarde": "URL"
                    },
                    {
                        "constNaam": "ReferentielijstAdrestypeURN",
                        "waarde": "URN"
                    }
                ]
            }
        ],
        "referentielijstInstanties": [
            {
                "systeemnaam": "AdellijkeTitels",
                "naam": "AdellijkeTitels",
                "omschrijving": "Adellijke titels in Nederland"
            },
            {
                "systeemnaam": "Landenlijst",
                "naam": "Landenlijst",
                "omschrijving": "Alle landen van de wereld",
                "positie": {
                    "x": 1065,
                    "y": -90
                }
            }
        ],
        "entiteiten": [
            {
                "typenaam": "AdellijkeTitel",
                "description": "Referentielijst-item: adellijke titel.",
                "entiteitSubtype": "referentielijst_item",
                "kleur": "#c4b5fd",
                "meervoud": "adellijke_titels",
                "runtime": {
                    "veldnaam": "adellijketitel",
                    "padnaam": "adellijke_titels",
                    "tabelnaam": "adellijketitel",
                    "idKolom": "id",
                    "klassenaam": "AdellijkeTitel"
                },
                "gegevenselementen": [
                    {
                        "naam": "AdellijkeTitelTitel",
                        "description": "Enkelvoudig gegevenselement titel van AdellijkeTitel.",
                        "meervoud": "adellijke_titel_titels",
                        "momentvoorkomen": "enkelvoudig",
                        "runtime": {
                            "veldnaam": "adellijketiteltitel",
                            "padnaam": "adellijke_titel_titels",
                            "tabelnaam": "adellijketiteltitel",
                            "idKolom": "rel_id",
                            "heeftPFK": true,
                            "entiteitIDKolom": "adellijketitel_id",
                            "klassenaam": "AdellijkeTitelTitel",
                            "relatieveAutoincrement": true
                        },
                        "velden": [
                            {
                                "naam": "titel",
                                "goType": "string",
                                "type": "string",
                                "verplicht": true
                            }
                        ]
                    }
                ]
            },
            {
                "typenaam": "Land",
                "description": "Referentielijst-item: individueel land.",
                "entiteitSubtype": "referentielijst_item",
                "isMaterieel": true,
                "kleur": "#fde68a",
                "meervoud": "landen",
                "positie": {
                    "x": 1215,
                    "y": 345
                },
                "runtime": {
                    "veldnaam": "land",
                    "padnaam": "landen",
                    "tabelnaam": "land",
                    "idKolom": "id",
                    "klassenaam": "Land"
                },
                "gegevenselementen": [
                    {
                        "naam": "Landcode",
                        "description": "Enkelvoudig gegevenselement landcode van Land.",
                        "meervoud": "landcodes",
                        "momentvoorkomen": "enkelvoudig",
                        "positie": {
                            "x": 1095,
                            "y": 555
                        },
                        "id": "edge_1774646153149_10",
                        "sourceHandle": "bottom",
                        "targetHandle": "top",
                        "runtime": {
                            "veldnaam": "landcode",
                            "padnaam": "landcodes",
                            "tabelnaam": "landcode",
                            "idKolom": "rel_id",
                            "heeftPFK": true,
                            "entiteitIDKolom": "land_id",
                            "klassenaam": "Landcode",
                            "relatieveAutoincrement": true
                        },
                        "velden": [
                            {
                                "naam": "code",
                                "goType": "string",
                                "type": "string",
                                "verplicht": true
                            }
                        ]
                    },
                    {
                        "naam": "Landnaam",
                        "description": "Enkelvoudig gegevenselement landnaam van Land.",
                        "meervoud": "landnamen",
                        "momentvoorkomen": "enkelvoudig",
                        "positie": {
                            "x": 1335,
                            "y": 555
                        },
                        "id": "edge_1774646072605_7",
                        "sourceHandle": "bottom",
                        "targetHandle": "top",
                        "runtime": {
                            "veldnaam": "landnaam",
                            "padnaam": "landnamen",
                            "tabelnaam": "landnaam",
                            "idKolom": "rel_id",
                            "heeftPFK": true,
                            "entiteitIDKolom": "land_id",
                            "klassenaam": "Landnaam",
                            "relatieveAutoincrement": true
                        },
                        "velden": [
                            {
                                "naam": "naam",
                                "goType": "string",
                                "type": "string",
                                "verplicht": true
                            }
                        ]
                    }
                ]
            },
            {
                "typenaam": "Locatie",
                "description": "Fysiek bezoekbare locatie gelegen op het aardoppervlak.",
                "isMaterieel": true,
                "kleur": "#fecaca",
                "meervoud": "locaties",
                "positie": {
                    "x": 720,
                    "y": -135
                },
                "runtime": {
                    "veldnaam": "locatie",
                    "padnaam": "locaties",
                    "tabelnaam": "locatie",
                    "idKolom": "id",
                    "klassenaam": "Locatie"
                },
                "afgeleideVelden": [
                    {
                        "naam": "weergaveadres",
                        "description": "Samengesteld weergaveadres, afgeleid uit straatnaam, huisnummer, postcode en plaats.",
                        "goType": "string",
                        "afleidingsregelTaal": "cel",
                        "afleidingsregel": "Adres.straatnaam + ' ' + Adres.huisnummer + ', ' + Adres.postcode + ' ' + Adres.plaats",
                        "isWeergaveVeld": true
                    }
                ],
                "gegevenselementen": [
                    {
                        "naam": "Adres",
                        "description": "Binnenlands adres: een aanduiding van een binnenlandse locatie, uitgegeven door de gemeente en geregistreerd in de BAG.",
                        "meervoud": "adressen",
                        "momentvoorkomen": "enkelvoudig",
                        "positie": {
                            "x": 780,
                            "y": 60
                        },
                        "id": "Locatie->Locatie_Adres",
                        "runtime": {
                            "veldnaam": "adres",
                            "padnaam": "adressen",
                            "tabelnaam": "locatie_adres",
                            "idKolom": "rel_id",
                            "heeftPFK": true,
                            "entiteitIDKolom": "locatie_id",
                            "klassenaam": "Adres",
                            "relatieveAutoincrement": true
                        },
                        "velden": [
                            {
                                "naam": "straatnaam",
                                "goType": "string",
                                "type": "string",
                                "verplicht": true
                            },
                            {
                                "naam": "huisnummer",
                                "goType": "string",
                                "type": "string",
                                "verplicht": true
                            },
                            {
                                "naam": "postcode",
                                "goType": "string",
                                "type": "string",
                                "verplicht": true,
                                "datatype": "NLPostcode"
                            },
                            {
                                "naam": "plaats",
                                "goType": "string",
                                "type": "string",
                                "verplicht": true
                            },
                            {
                                "naam": "land",
                                "goType": "int",
                                "type": "integer",
                                "verplicht": true,
                                "$ref": "LandenlijstLand"
                            }
                        ]
                    },
                    {
                        "naam": "BAGlocatie",
                        "description": "Unieke identificatie van het adresseerbaar object (verblijfsobject, stand- of ligplaats) uitgegeven door het bevoegd gemeentelijke orgaan.",
                        "meervoud": "baglocaties",
                        "momentvoorkomen": "enkelvoudig",
                        "positie": {
                            "x": 585,
                            "y": 90
                        },
                        "id": "Locatie->Locatie_BAG-locatie",
                        "runtime": {
                            "veldnaam": "baglocatie",
                            "padnaam": "baglocaties",
                            "tabelnaam": "locatie_baglocatie",
                            "idKolom": "rel_id",
                            "heeftPFK": true,
                            "entiteitIDKolom": "locatie_id",
                            "klassenaam": "BAGlocatie",
                            "relatieveAutoincrement": true
                        },
                        "velden": [
                            {
                                "naam": "adresaanduiding",
                                "goType": "string",
                                "type": "string",
                                "verplicht": true
                            }
                        ]
                    }
                ]
            },
            {
                "typenaam": "NatuurlijkPersoon",
                "description": "Een mens voor zover deze door Nederlandse wetgeving met rechten en plichten wordt bekleed.",
                "isMaterieel": true,
                "kleur": "#bfdbfe",
                "meervoud": "natuurlijk_personen",
                "positie": {
                    "x": -90,
                    "y": -135
                },
                "runtime": {
                    "veldnaam": "natuurlijkpersoon",
                    "padnaam": "natuurlijk_personen",
                    "tabelnaam": "natuurlijkpersoon",
                    "idKolom": "id",
                    "klassenaam": "NatuurlijkPersoon"
                },
                "afgeleideVelden": [
                    {
                        "naam": "weergavenaam",
                        "description": "Samengestelde weergavenaam van de persoon, afgeleid uit voornaam/tussenvoegsel/achternaam.",
                        "goType": "string",
                        "afleidingsregelTaal": "cel",
                        "afleidingsregel": "(Naam.roepnaam != null ? Naam.roepnaam : Naam.voorletters) + (Naam.tussenvoegsel != null ? ' ' + Naam.tussenvoegsel : '') + ' ' + Naam.achternaam",
                        "isWeergaveVeld": true
                    }
                ],
                "gegevenselementen": [
                    {
                        "naam": "Persoonsidentificatie",
                        "description": "Identificerende gegevens van de natuurlijk persoon (BSN, ingezetene).",
                        "meervoud": "persoonsidentificaties",
                        "momentvoorkomen": "enkelvoudig",
                        "positie": {
                            "x": -450,
                            "y": -30
                        },
                        "id": "NatuurlijkPersoon->NatuurlijkPersoon_PersoonsIdentificatie",
                        "sourceHandle": "left",
                        "runtime": {
                            "veldnaam": "persoonsidentificatie",
                            "padnaam": "persoonsidentificaties",
                            "tabelnaam": "natuurlijkpersoon_persoonsidentificatie",
                            "idKolom": "rel_id",
                            "heeftPFK": true,
                            "entiteitIDKolom": "natuurlijkpersoon_id",
                            "klassenaam": "Persoonsidentificatie",
                            "relatieveAutoincrement": true
                        },
                        "velden": [
                            {
                                "naam": "bsn",
                                "goType": "string",
                                "type": "string",
                                "verplicht": true,
                                "datatype": "BSN"
                            },
                            {
                                "naam": "ingezetene",
                                "goType": "*bool",
                                "type": "boolean"
                            }
                        ]
                    },
                    {
                        "naam": "Naam",
                        "description": "Naamgegevens van de natuurlijk persoon (voorletters, roepnaam, tussenvoegsel, achternaam).",
                        "meervoud": "namen",
                        "momentvoorkomen": "enkelvoudig",
                        "positie": {
                            "x": -105,
                            "y": 255
                        },
                        "id": "NatuurlijkPersoon->NatuurlijkPersoon_Naam",
                        "runtime": {
                            "veldnaam": "naam",
                            "padnaam": "namen",
                            "tabelnaam": "natuurlijkpersoon_naam",
                            "idKolom": "rel_id",
                            "heeftPFK": true,
                            "entiteitIDKolom": "natuurlijkpersoon_id",
                            "klassenaam": "Naam",
                            "relatieveAutoincrement": true
                        },
                        "velden": [
                            {
                                "naam": "voorletters",
                                "goType": "string",
                                "type": "string",
                                "verplicht": true
                            },
                            {
                                "naam": "roepnaam",
                                "goType": "*string",
                                "type": "string"
                            },
                            {
                                "naam": "tussenvoegsel",
                                "goType": "*string",
                                "type": "string"
                            },
                            {
                                "naam": "achternaam",
                                "goType": "string",
                                "type": "string",
                                "verplicht": true
                            }
                        ]
                    },
                    {
                        "naam": "Burgerschap",
                        "description": "Nationaliteitsgegevens (burgerschap) van de natuurlijk persoon.",
                        "meervoud": "burgerschappen",
                        "momentvoorkomen": "meervoudig",
                        "isMaterieel": true,
                        "positie": {
                            "x": -285,
                            "y": 450
                        },
                        "id": "NatuurlijkPersoon->NatuurlijkPersoon_Burgerschap",
                        "runtime": {
                            "veldnaam": "burgerschap",
                            "padnaam": "burgerschappen",
                            "tabelnaam": "natuurlijkpersoon_burgerschap",
                            "idKolom": "rel_id",
                            "heeftPFK": true,
                            "entiteitIDKolom": "natuurlijkpersoon_id",
                            "klassenaam": "Burgerschap",
                            "relatieveAutoincrement": true
                        },
                        "afgeleideVelden": [
                            {
                                "naam": "weergaveburgerschap",
                                "description": "Samengestelde weergave van nationaliteit en landcode.",
                                "goType": "string",
                                "afleidingsregelTaal": "cel",
                                "afleidingsregel": "Burgerschap_Data.nationaliteit + ' (' + Burgerschap_Data.landcode + ')'",
                                "isWeergaveVeld": true
                            }
                        ],
                        "velden": [
                            {
                                "naam": "landcode",
                                "goType": "string",
                                "type": "string",
                                "verplicht": true
                            },
                            {
                                "naam": "nationaliteit",
                                "goType": "string",
                                "type": "string",
                                "verplicht": true
                            }
                        ]
                    },
                    {
                        "naam": "Partnernaam",
                        "description": "Achternaam van de partner van de natuurlijk persoon.",
                        "meervoud": "partnernamen",
                        "momentvoorkomen": "enkelvoudig",
                        "positie": {
                            "x": 60,
                            "y": 450
                        },
                        "id": "edge_1774209110136_2",
                        "sourceHandle": "bottom",
                        "targetHandle": "top",
                        "runtime": {
                            "veldnaam": "partnernaam",
                            "padnaam": "partnernamen",
                            "tabelnaam": "natuurlijkpersoon_partnernaam",
                            "idKolom": "rel_id",
                            "heeftPFK": true,
                            "entiteitIDKolom": "natuurlijkpersoon_id",
                            "klassenaam": "Partnernaam",
                            "relatieveAutoincrement": true
                        },
                        "velden": [
                            {
                                "naam": "achternaam",
                                "goType": "string",
                                "type": "string",
                                "verplicht": true
                            }
                        ]
                    },
                    {
                        "naam": "Naamgebruik",
                        "description": "Wijze waarop de geslachtsnaam wordt gebruikt.",
                        "meervoud": "naamgebruiken",
                        "momentvoorkomen": "enkelvoudig",
                        "positie": {
                            "x": 195,
                            "y": 255
                        },
                        "id": "edge_1774209240752_5",
                        "sourceHandle": "bottom",
                        "targetHandle": "top",
                        "runtime": {
                            "veldnaam": "naamgebruik",
                            "padnaam": "naamgebruiken",
                            "tabelnaam": "natuurlijkpersoon_naamgebruik",
                            "idKolom": "rel_id",
                            "heeftPFK": true,
                            "entiteitIDKolom": "natuurlijkpersoon_id",
                            "klassenaam": "Naamgebruik",
                            "relatieveAutoincrement": true
                        },
                        "velden": [
                            {
                                "naam": "naamgebruik",
                                "goType": "Naamgebruiksoort",
                                "type": "string",
                                "verplicht": true,
                                "enum": "Naamgebruiksoort"
                            }
                        ]
                    }
                ],
                "relaties": [
                    {
                        "naam": "Bereikbaarheid",
                        "description": "Koppeling van een natuurlijk persoon aan een locatie als bereikbaarheidsadres.",
                        "meervoud": "bereikbaarheden",
                        "momentvoorkomen": "enkelvoudig",
                        "isMaterieel": true,
                        "doelEntiteit": "Locatie",
                        "positie": {
                            "x": 330,
                            "y": -120
                        },
                        "id": "edge_1774201942583_1",
                        "sourceHandle": "right",
                        "targetHandle": "left",
                        "doelId": "edge_1774201991984_2",
                        "doelSourceHandle": "right",
                        "doelTargetHandle": "left",
                        "runtime": {
                            "veldnaam": "bereikbaarheid",
                            "padnaam": "bereikbaarheden",
                            "tabelnaam": "bereikbaarheid",
                            "idKolom": "rel_id",
                            "heeftPFK": true,
                            "entiteitIDKolom": "natuurlijkpersoon_id",
                            "klassenaam": "Bereikbaarheid",
                            "relatieveAutoincrement": true
                        },
                        "velden": [
                            {
                                "naam": "soort",
                                "goType": "Bereikbaarheidssoort",
                                "type": "string",
                                "verplicht": true,
                                "enum": "Bereikbaarheidssoort"
                            }
                        ]
                    }
                ]
            },
            {
                "typenaam": "Referentielijst",
                "description": "Generieke referentielijst-entiteit. Individuele lijsten (Landenlijst, EULidstaten, etc.) zijn records.",
                "entiteitSubtype": "referentielijst",
                "isMaterieel": true,
                "kleur": "#fef3c7",
                "meervoud": "referentielijsten",
                "positie": {
                    "x": 1260,
                    "y": -240
                },
                "runtime": {
                    "veldnaam": "referentielijst",
                    "padnaam": "referentielijsten",
                    "tabelnaam": "register_referentielijst",
                    "idKolom": "id",
                    "klassenaam": "Referentielijst"
                },
                "gegevenselementen": [
                    {
                        "naam": "Referentielijstnaam",
                        "description": "Leesbare naam van een referentielijst.",
                        "meervoud": "referentielijstnamen",
                        "momentvoorkomen": "enkelvoudig",
                        "positie": {
                            "x": 1590,
                            "y": -255
                        },
                        "id": "Referentielijst->Referentielijst_Referentielijstnaam",
                        "sourceHandle": "right",
                        "targetHandle": "left",
                        "runtime": {
                            "veldnaam": "referentielijstnaam",
                            "padnaam": "referentielijstnamen",
                            "tabelnaam": "referentielijstnaam",
                            "idKolom": "rel_id",
                            "heeftPFK": true,
                            "entiteitIDKolom": "referentielijst_id",
                            "klassenaam": "Referentielijstnaam",
                            "relatieveAutoincrement": true
                        },
                        "velden": [
                            {
                                "naam": "naam",
                                "goType": "string",
                                "type": "string",
                                "verplicht": true
                            }
                        ]
                    },
                    {
                        "naam": "Referentielijstomschrijving",
                        "description": "Omschrijving van een referentielijst.",
                        "meervoud": "referentielijstomschrijvingen",
                        "momentvoorkomen": "enkelvoudig",
                        "positie": {
                            "x": 1590,
                            "y": -135
                        },
                        "id": "Referentielijst->Referentielijst_Referentielijstomschrijving",
                        "sourceHandle": "right",
                        "targetHandle": "left",
                        "runtime": {
                            "veldnaam": "referentielijstomschrijving",
                            "padnaam": "referentielijstomschrijvingen",
                            "tabelnaam": "referentielijstomschrijving",
                            "idKolom": "rel_id",
                            "heeftPFK": true,
                            "entiteitIDKolom": "referentielijst_id",
                            "klassenaam": "Referentielijstomschrijving",
                            "relatieveAutoincrement": true
                        },
                        "velden": [
                            {
                                "naam": "omschrijving",
                                "goType": "string",
                                "type": "string",
                                "verplicht": true
                            }
                        ]
                    },
                    {
                        "naam": "ReferentielijstVisibility",
                        "description": "Domeinzichtbaarheid van een referentielijst (register, modelspecifiek, extern).",
                        "meervoud": "visibilities",
                        "momentvoorkomen": "enkelvoudig",
                        "positie": {
                            "x": 1590,
                            "y": -15
                        },
                        "id": "Referentielijst->Referentielijst_ReferentielijstVisibility",
                        "sourceHandle": "right",
                        "targetHandle": "left",
                        "runtime": {
                            "veldnaam": "visibility",
                            "padnaam": "visibilities",
                            "tabelnaam": "referentielijstvisibility",
                            "idKolom": "rel_id",
                            "heeftPFK": true,
                            "entiteitIDKolom": "referentielijst_id",
                            "klassenaam": "Visibility",
                            "relatieveAutoincrement": true
                        },
                        "velden": [
                            {
                                "naam": "domein",
                                "goType": "string",
                                "type": "string",
                                "verplicht": true,
                                "description": "Domeinzichtbaarheid: 'register', modelspecifiek domein, of 'extern'."
                            }
                        ]
                    },
                    {
                        "naam": "ReferentielijstInternetadres",
                        "description": "Internetadres (URL/URN) van een referentielijst.",
                        "meervoud": "internetadressen",
                        "momentvoorkomen": "meervoudig",
                        "positie": {
                            "x": 1590,
                            "y": 85
                        },
                        "id": "Referentielijst->Referentielijst_ReferentielijstInternetadres",
                        "sourceHandle": "right",
                        "targetHandle": "left",
                        "runtime": {
                            "veldnaam": "internetadres",
                            "padnaam": "internetadressen",
                            "tabelnaam": "referentielijstinternetadres",
                            "idKolom": "rel_id",
                            "heeftPFK": true,
                            "entiteitIDKolom": "referentielijst_id",
                            "klassenaam": "Internetadres",
                            "relatieveAutoincrement": true
                        },
                        "velden": [
                            {
                                "naam": "adrestype",
                                "goType": "ReferentielijstAdrestype",
                                "type": "string",
                                "verplicht": true,
                                "enum": "ReferentielijstAdrestype",
                                "description": "Type adres: URL of URN."
                            },
                            {
                                "naam": "adres",
                                "goType": "string",
                                "type": "string",
                                "verplicht": true,
                                "description": "Het volledige internet-adres (URL of URN)."
                            },
                            {
                                "naam": "organisatie",
                                "goType": "string",
                                "type": "string",
                                "verplicht": true,
                                "description": "Verantwoordelijke organisatie voor dit adres."
                            }
                        ]
                    }
                ],
                "relaties": [
                    {
                        "naam": "LandenlijstLand",
                        "description": "Koppeling van een land aan referentielijst-instantie Landenlijst (referentielijst-items relatie).",
                        "relatieSubtype": "referentielijst_items",
                        "referentielijstInstantie": "Landenlijst",
                        "meervoud": "landenlijst_landen",
                        "momentvoorkomen": "meervoudig",
                        "doelEntiteit": "Land",
                        "positie": {
                            "x": 1215,
                            "y": 165
                        },
                        "id": "Referentielijst->LandenlijstLand",
                        "doelId": "LandenlijstLand->Land",
                        "runtime": {
                            "veldnaam": "landenlijst_land",
                            "padnaam": "landenlijst_landen",
                            "tabelnaam": "landenlijst_land",
                            "idKolom": "rel_id",
                            "heeftPFK": true,
                            "entiteitIDKolom": "referentielijst_id",
                            "klassenaam": "LandenlijstLand",
                            "relatieveAutoincrement": true
                        }
                    },
                    {
                        "naam": "AdellijkeTitelsTitel",
                        "description": "Koppeling van een adellijke titel aan referentielijst-instantie AdellijkeTitels (referentielijst-items relatie).",
                        "relatieSubtype": "referentielijst_items",
                        "referentielijstInstantie": "AdellijkeTitels",
                        "meervoud": "adellijke_titels_titels",
                        "momentvoorkomen": "meervoudig",
                        "doelEntiteit": "AdellijkeTitel",
                        "runtime": {
                            "veldnaam": "adellijketitelstitel",
                            "padnaam": "adellijke_titels_titels",
                            "tabelnaam": "adellijketitelstitel",
                            "idKolom": "rel_id",
                            "heeftPFK": true,
                            "entiteitIDKolom": "referentielijst_id",
                            "klassenaam": "AdellijkeTitelsTitel",
                            "relatieveAutoincrement": true
                        }
                    }
                ]
            }
        ]
    },
    "model_beschrijving": "",
    "model_bron": "code",
    "model_naam": "",
    "model_versie": "v3",
    "opmerking": "",
    "status": "code",
    "tijdstip": null,
    "types": [
        {
            "typenaam": "AdellijkeTitel",
            "klassenaam": "AdellijkeTitel",
            "description": "Referentielijst-item: adellijke titel.",
            "metatype": "entiteit",
            "entiteitSubtype": "referentielijst_item",
            "domein": "np-loc",
            "kleur": "#c4b5fd",
            "veldnaam": "adellijketitel",
            "padnaam": "adellijke_titels",
            "meervoud": "adellijke titels",
            "velden": [
                {
                    "naam": "id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "adellijke_titel_titels",
                    "type": "AdellijkeTitelTitel",
                    "format": "array",
                    "verplicht": false
                }
            ],
            "tabelnaam": "adellijketitel",
            "idKolom": "id",
            "heeftPFK": false,
            "onderliggende": [
                {
                    "rolnaam": "AdellijkeTitelTitels",
                    "jsonRolnaam": "adellijke_titel_titels",
                    "doeltype": "AdellijkeTitelTitel",
                    "momentvoorkomen": "enkelvoudig"
                }
            ]
        },
        {
            "typenaam": "AdellijkeTitelTitel",
            "klassenaam": "AdellijkeTitelTitel",
            "description": "Enkelvoudig gegevenselement titel van AdellijkeTitel.",
            "metatype": "gegevenselement",
            "ge_subtype": "hub",
            "kleur": "#c4b5fd",
            "veldnaam": "adellijketiteltitel",
            "padnaam": "adellijke_titel_titels",
            "meervoud": "adellijke_titel_titels",
            "velden": [
                {
                    "naam": "adellijketitel_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "rel_id",
                    "type": "integer",
                    "verplicht": true,
                    "autoIncrement": true
                },
                {
                    "naam": "titel",
                    "type": "string",
                    "verplicht": true
                }
            ],
            "tabelnaam": "adellijketiteltitel",
            "idKolom": "rel_id",
            "idAutoIncrement": true,
            "heeftPFK": true,
            "entiteitIDKolom": "adellijketitel_id",
            "momentvoorkomen": "enkelvoudig",
            "onderliggende": [
                {
                    "rolnaam": "Data",
                    "jsonRolnaam": "data",
                    "doeltype": "AdellijkeTitelTitel_Data",
                    "momentvoorkomen": "enkelvoudig"
                }
            ]
        },
        {
            "typenaam": "AdellijkeTitelTitel_Data",
            "klassenaam": "Data",
            "description": "Geversioned inhoud van gegevenselement AdellijkeTitelTitel.",
            "metatype": "gegevenselement",
            "ge_subtype": "data",
            "kleur": "#c4b5fd",
            "veldnaam": "adellijketiteltitel_data",
            "padnaam": "adellijketiteltitel_data",
            "meervoud": "adellijketiteltitel_data",
            "velden": [
                {
                    "naam": "adellijketitel_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "rel_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "versie",
                    "type": "integer",
                    "verplicht": false,
                    "autoIncrement": true
                },
                {
                    "naam": "titel",
                    "type": "string",
                    "verplicht": true
                }
            ],
            "tabelnaam": "adellijketiteltitel_data",
            "idKolom": "versie",
            "idAutoIncrement": true,
            "heeftPFK": true,
            "entiteitIDKolom": "adellijketitel_id",
            "bovenliggendTypenaam": "AdellijkeTitelTitel",
            "momentvoorkomen": "enkelvoudig"
        },
        {
            "typenaam": "AdellijkeTitelsTitel",
            "klassenaam": "AdellijkeTitelsTitel",
            "description": "Koppeling van een adellijke titel aan referentielijst-instantie AdellijkeTitels (referentielijst-items relatie).",
            "metatype": "relatie",
            "ge_subtype": "hub",
            "relatieSubtype": "referentielijst_items",
            "referentielijstInstantie": "AdellijkeTitels",
            "doelEntiteit": "AdellijkeTitel",
            "veldnaam": "adellijketitelstitel",
            "padnaam": "adellijke_titels_titels",
            "meervoud": "adellijke_titels_titels",
            "velden": [
                {
                    "naam": "referentielijst_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "rel_id",
                    "type": "integer",
                    "verplicht": true,
                    "autoIncrement": true
                },
                {
                    "naam": "adellijketitel_id",
                    "type": "integer",
                    "verplicht": true
                }
            ],
            "tabelnaam": "adellijketitelstitel",
            "idKolom": "rel_id",
            "idAutoIncrement": true,
            "heeftPFK": true,
            "entiteitIDKolom": "referentielijst_id",
            "secondaireEntiteitIDKolom": "adellijketitel_id",
            "momentvoorkomen": "meervoudig",
            "onderliggende": [
                {
                    "rolnaam": "Data",
                    "jsonRolnaam": "data",
                    "doeltype": "AdellijkeTitelsTitel_Data",
                    "momentvoorkomen": "enkelvoudig"
                }
            ]
        },
        {
            "typenaam": "AdellijkeTitelsTitel_Data",
            "klassenaam": "Data",
            "description": "Geversioned inhoud van AdellijkeTitelsTitel.",
            "metatype": "gegevenselement",
            "ge_subtype": "data",
            "kleur": "#fef3c7",
            "veldnaam": "adellijketitelstitel_data",
            "padnaam": "adellijketitelstitel_data",
            "meervoud": "adellijketitelstitel_data",
            "velden": [
                {
                    "naam": "referentielijst_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "rel_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "versie",
                    "type": "integer",
                    "verplicht": false,
                    "autoIncrement": true
                }
            ],
            "tabelnaam": "adellijketitelstitel_data",
            "idKolom": "versie",
            "idAutoIncrement": true,
            "heeftPFK": true,
            "entiteitIDKolom": "referentielijst_id",
            "bovenliggendTypenaam": "AdellijkeTitelsTitel",
            "momentvoorkomen": "enkelvoudig"
        },
        {
            "typenaam": "Bereikbaarheid",
            "klassenaam": "Bereikbaarheid",
            "description": "Koppeling van een natuurlijk persoon aan een locatie als bereikbaarheidsadres.",
            "metatype": "relatie",
            "ge_subtype": "hub",
            "isMaterieel": true,
            "doelEntiteit": "Locatie",
            "veldnaam": "bereikbaarheid",
            "padnaam": "bereikbaarheden",
            "meervoud": "bereikbaarheden",
            "velden": [
                {
                    "naam": "natuurlijkpersoon_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "rel_id",
                    "type": "integer",
                    "verplicht": true,
                    "autoIncrement": true
                },
                {
                    "naam": "locatie_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "soort",
                    "type": "string",
                    "enum": [
                        "Woonadres",
                        "Briefadres",
                        "Correspondentieadres"
                    ],
                    "verplicht": true
                }
            ],
            "tabelnaam": "bereikbaarheid",
            "idKolom": "rel_id",
            "idAutoIncrement": true,
            "heeftPFK": true,
            "entiteitIDKolom": "natuurlijkpersoon_id",
            "secondaireEntiteitIDKolom": "locatie_id",
            "momentvoorkomen": "enkelvoudig",
            "onderliggende": [
                {
                    "rolnaam": "Data",
                    "jsonRolnaam": "data",
                    "doeltype": "Bereikbaarheid_Data",
                    "momentvoorkomen": "enkelvoudig"
                },
                {
                    "rolnaam": "Aanvang",
                    "jsonRolnaam": "aanvang",
                    "doeltype": "Bereikbaarheid_Aanvang",
                    "momentvoorkomen": "enkelvoudig"
                },
                {
                    "rolnaam": "Einde",
                    "jsonRolnaam": "einde",
                    "doeltype": "Bereikbaarheid_Einde",
                    "momentvoorkomen": "enkelvoudig"
                }
            ]
        },
        {
            "typenaam": "Bereikbaarheid_Aanvang",
            "klassenaam": "Aanvang",
            "description": "Aanvangsdatum van Bereikbaarheid.",
            "metatype": "gegevenselement",
            "ge_subtype": "aanvang",
            "kleur": "#bfdbfe",
            "veldnaam": "bereikbaarheid_aanvang",
            "padnaam": "bereikbaarheid_aanvang",
            "meervoud": "bereikbaarheid_aanvang",
            "velden": [
                {
                    "naam": "natuurlijkpersoon_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "rel_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "versie",
                    "type": "integer",
                    "verplicht": false,
                    "autoIncrement": true
                },
                {
                    "naam": "datum",
                    "type": "string",
                    "format": "date",
                    "verplicht": false
                }
            ],
            "tabelnaam": "bereikbaarheid_aanvang",
            "idKolom": "versie",
            "idAutoIncrement": true,
            "heeftPFK": true,
            "entiteitIDKolom": "natuurlijkpersoon_id",
            "bovenliggendTypenaam": "Bereikbaarheid",
            "momentvoorkomen": "enkelvoudig"
        },
        {
            "typenaam": "Bereikbaarheid_Data",
            "klassenaam": "Data",
            "description": "Geversioned inhoud van Bereikbaarheid.",
            "metatype": "gegevenselement",
            "ge_subtype": "data",
            "kleur": "#bfdbfe",
            "veldnaam": "bereikbaarheid_data",
            "padnaam": "bereikbaarheid_data",
            "meervoud": "bereikbaarheid_data",
            "velden": [
                {
                    "naam": "natuurlijkpersoon_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "rel_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "versie",
                    "type": "integer",
                    "verplicht": false,
                    "autoIncrement": true
                },
                {
                    "naam": "soort",
                    "type": "string",
                    "enum": [
                        "Woonadres",
                        "Briefadres",
                        "Correspondentieadres"
                    ],
                    "verplicht": true
                }
            ],
            "tabelnaam": "bereikbaarheid_data",
            "idKolom": "versie",
            "idAutoIncrement": true,
            "heeftPFK": true,
            "entiteitIDKolom": "natuurlijkpersoon_id",
            "bovenliggendTypenaam": "Bereikbaarheid",
            "momentvoorkomen": "enkelvoudig"
        },
        {
            "typenaam": "Bereikbaarheid_Einde",
            "klassenaam": "Einde",
            "description": "Einddatum van Bereikbaarheid.",
            "metatype": "gegevenselement",
            "ge_subtype": "einde",
            "kleur": "#bfdbfe",
            "veldnaam": "bereikbaarheid_einde",
            "padnaam": "bereikbaarheid_einde",
            "meervoud": "bereikbaarheid_einde",
            "velden": [
                {
                    "naam": "natuurlijkpersoon_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "rel_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "versie",
                    "type": "integer",
                    "verplicht": false,
                    "autoIncrement": true
                },
                {
                    "naam": "datum",
                    "type": "string",
                    "format": "date",
                    "verplicht": false
                }
            ],
            "tabelnaam": "bereikbaarheid_einde",
            "idKolom": "versie",
            "idAutoIncrement": true,
            "heeftPFK": true,
            "entiteitIDKolom": "natuurlijkpersoon_id",
            "bovenliggendTypenaam": "Bereikbaarheid",
            "momentvoorkomen": "enkelvoudig"
        },
        {
            "typenaam": "Land",
            "klassenaam": "Land",
            "description": "Referentielijst-item: individueel land.",
            "metatype": "entiteit",
            "isMaterieel": true,
            "entiteitSubtype": "referentielijst_item",
            "domein": "register",
            "kleur": "#fde68a",
            "veldnaam": "land",
            "padnaam": "landen",
            "meervoud": "landen",
            "velden": [
                {
                    "naam": "id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "landcodes",
                    "type": "Landcode",
                    "format": "array",
                    "verplicht": false
                },
                {
                    "naam": "landnamen",
                    "type": "Landnaam",
                    "format": "array",
                    "verplicht": false
                }
            ],
            "tabelnaam": "land",
            "idKolom": "id",
            "heeftPFK": false,
            "onderliggende": [
                {
                    "rolnaam": "Landcodes",
                    "jsonRolnaam": "landcodes",
                    "doeltype": "Landcode",
                    "momentvoorkomen": "enkelvoudig"
                },
                {
                    "rolnaam": "Landnamen",
                    "jsonRolnaam": "landnamen",
                    "doeltype": "Landnaam",
                    "momentvoorkomen": "enkelvoudig"
                },
                {
                    "rolnaam": "Aanvang",
                    "jsonRolnaam": "aanvang",
                    "doeltype": "Land_Aanvang",
                    "momentvoorkomen": "enkelvoudig"
                },
                {
                    "rolnaam": "Einde",
                    "jsonRolnaam": "einde",
                    "doeltype": "Land_Einde",
                    "momentvoorkomen": "enkelvoudig"
                }
            ]
        },
        {
            "typenaam": "Land_Aanvang",
            "klassenaam": "Aanvang",
            "description": "Aanvangsdatum van referentielijst-item Land.",
            "metatype": "gegevenselement",
            "ge_subtype": "aanvang",
            "kleur": "#fde68a",
            "veldnaam": "land_aanvang",
            "padnaam": "land_aanvang",
            "meervoud": "land_aanvang",
            "velden": [
                {
                    "naam": "land_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "versie",
                    "type": "integer",
                    "verplicht": false,
                    "autoIncrement": true
                },
                {
                    "naam": "datum",
                    "type": "string",
                    "format": "date",
                    "verplicht": false
                }
            ],
            "tabelnaam": "land_aanvang",
            "idKolom": "versie",
            "idAutoIncrement": true,
            "heeftPFK": true,
            "entiteitIDKolom": "land_id",
            "bovenliggendTypenaam": "Land",
            "momentvoorkomen": "enkelvoudig"
        },
        {
            "typenaam": "Land_Einde",
            "klassenaam": "Einde",
            "description": "Einddatum van referentielijst-item Land.",
            "metatype": "gegevenselement",
            "ge_subtype": "einde",
            "kleur": "#fde68a",
            "veldnaam": "land_einde",
            "padnaam": "land_einde",
            "meervoud": "land_einde",
            "velden": [
                {
                    "naam": "land_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "versie",
                    "type": "integer",
                    "verplicht": false,
                    "autoIncrement": true
                },
                {
                    "naam": "datum",
                    "type": "string",
                    "format": "date",
                    "verplicht": false
                }
            ],
            "tabelnaam": "land_einde",
            "idKolom": "versie",
            "idAutoIncrement": true,
            "heeftPFK": true,
            "entiteitIDKolom": "land_id",
            "bovenliggendTypenaam": "Land",
            "momentvoorkomen": "enkelvoudig"
        },
        {
            "typenaam": "Landcode",
            "klassenaam": "Landcode",
            "description": "Enkelvoudig gegevenselement landcode van Land.",
            "metatype": "gegevenselement",
            "ge_subtype": "hub",
            "kleur": "#fde68a",
            "veldnaam": "landcode",
            "padnaam": "landcodes",
            "meervoud": "landcodes",
            "velden": [
                {
                    "naam": "land_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "rel_id",
                    "type": "integer",
                    "verplicht": true,
                    "autoIncrement": true
                },
                {
                    "naam": "code",
                    "type": "string",
                    "verplicht": true
                }
            ],
            "tabelnaam": "landcode",
            "idKolom": "rel_id",
            "idAutoIncrement": true,
            "heeftPFK": true,
            "entiteitIDKolom": "land_id",
            "momentvoorkomen": "enkelvoudig",
            "onderliggende": [
                {
                    "rolnaam": "Data",
                    "jsonRolnaam": "data",
                    "doeltype": "Landcode_Data",
                    "momentvoorkomen": "enkelvoudig"
                }
            ]
        },
        {
            "typenaam": "Landcode_Data",
            "klassenaam": "Data",
            "description": "Geversioned inhoud van gegevenselement Landcode.",
            "metatype": "gegevenselement",
            "ge_subtype": "data",
            "kleur": "#fde68a",
            "veldnaam": "landcode_data",
            "padnaam": "landcode_data",
            "meervoud": "landcode_data",
            "velden": [
                {
                    "naam": "land_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "rel_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "versie",
                    "type": "integer",
                    "verplicht": false,
                    "autoIncrement": true
                },
                {
                    "naam": "code",
                    "type": "string",
                    "verplicht": true
                }
            ],
            "tabelnaam": "landcode_data",
            "idKolom": "versie",
            "idAutoIncrement": true,
            "heeftPFK": true,
            "entiteitIDKolom": "land_id",
            "bovenliggendTypenaam": "Landcode",
            "momentvoorkomen": "enkelvoudig"
        },
        {
            "typenaam": "LandenlijstLand",
            "klassenaam": "LandenlijstLand",
            "description": "Koppeling van een land aan referentielijst-instantie Landenlijst (referentielijst-items relatie).",
            "metatype": "relatie",
            "ge_subtype": "hub",
            "relatieSubtype": "referentielijst_items",
            "referentielijstInstantie": "Landenlijst",
            "doelEntiteit": "Land",
            "kleur": "#fcd34d",
            "veldnaam": "landenlijst_land",
            "padnaam": "landenlijst_landen",
            "meervoud": "landenlijst_landen",
            "velden": [
                {
                    "naam": "referentielijst_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "rel_id",
                    "type": "integer",
                    "verplicht": true,
                    "autoIncrement": true
                },
                {
                    "naam": "land_id",
                    "type": "integer",
                    "verplicht": true
                }
            ],
            "tabelnaam": "landenlijst_land",
            "idKolom": "rel_id",
            "idAutoIncrement": true,
            "heeftPFK": true,
            "entiteitIDKolom": "referentielijst_id",
            "secondaireEntiteitIDKolom": "land_id",
            "momentvoorkomen": "meervoudig",
            "onderliggende": [
                {
                    "rolnaam": "Data",
                    "jsonRolnaam": "data",
                    "doeltype": "LandenlijstLand_Data",
                    "momentvoorkomen": "enkelvoudig"
                }
            ]
        },
        {
            "typenaam": "LandenlijstLand_Data",
            "klassenaam": "Data",
            "description": "Geversioned inhoud van relatie LandenlijstLand.",
            "metatype": "gegevenselement",
            "ge_subtype": "data",
            "kleur": "#fcd34d",
            "veldnaam": "landenlijst_land_data",
            "padnaam": "landenlijst_land_data",
            "meervoud": "landenlijst_land_data",
            "velden": [
                {
                    "naam": "referentielijst_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "rel_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "versie",
                    "type": "integer",
                    "verplicht": false,
                    "autoIncrement": true
                }
            ],
            "tabelnaam": "landenlijst_land_data",
            "idKolom": "versie",
            "idAutoIncrement": true,
            "heeftPFK": true,
            "entiteitIDKolom": "referentielijst_id",
            "bovenliggendTypenaam": "LandenlijstLand",
            "momentvoorkomen": "enkelvoudig"
        },
        {
            "typenaam": "Landnaam",
            "klassenaam": "Landnaam",
            "description": "Enkelvoudig gegevenselement landnaam van Land.",
            "metatype": "gegevenselement",
            "ge_subtype": "hub",
            "kleur": "#fde68a",
            "veldnaam": "landnaam",
            "padnaam": "landnamen",
            "meervoud": "landnamen",
            "velden": [
                {
                    "naam": "land_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "rel_id",
                    "type": "integer",
                    "verplicht": true,
                    "autoIncrement": true
                },
                {
                    "naam": "naam",
                    "type": "string",
                    "verplicht": true
                }
            ],
            "tabelnaam": "landnaam",
            "idKolom": "rel_id",
            "idAutoIncrement": true,
            "heeftPFK": true,
            "entiteitIDKolom": "land_id",
            "momentvoorkomen": "enkelvoudig",
            "onderliggende": [
                {
                    "rolnaam": "Data",
                    "jsonRolnaam": "data",
                    "doeltype": "Landnaam_Data",
                    "momentvoorkomen": "enkelvoudig"
                }
            ]
        },
        {
            "typenaam": "Landnaam_Data",
            "klassenaam": "Data",
            "description": "Geversioned inhoud van gegevenselement Landnaam.",
            "metatype": "gegevenselement",
            "ge_subtype": "data",
            "kleur": "#fde68a",
            "veldnaam": "landnaam_data",
            "padnaam": "landnaam_data",
            "meervoud": "landnaam_data",
            "velden": [
                {
                    "naam": "land_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "rel_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "versie",
                    "type": "integer",
                    "verplicht": false,
                    "autoIncrement": true
                },
                {
                    "naam": "naam",
                    "type": "string",
                    "verplicht": true
                }
            ],
            "tabelnaam": "landnaam_data",
            "idKolom": "versie",
            "idAutoIncrement": true,
            "heeftPFK": true,
            "entiteitIDKolom": "land_id",
            "bovenliggendTypenaam": "Landnaam",
            "momentvoorkomen": "enkelvoudig"
        },
        {
            "typenaam": "Locatie",
            "klassenaam": "Locatie",
            "description": "Fysiek bezoekbare locatie gelegen op het aardoppervlak.",
            "metatype": "entiteit",
            "isMaterieel": true,
            "domein": "np-loc",
            "kleur": "#fecaca",
            "veldnaam": "locatie",
            "padnaam": "locaties",
            "meervoud": "locaties",
            "velden": [
                {
                    "naam": "id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "adressen",
                    "type": "Locatie_Adres",
                    "format": "array",
                    "verplicht": false
                },
                {
                    "naam": "baglocaties",
                    "type": "Locatie_BAGlocatie",
                    "format": "array",
                    "verplicht": false
                }
            ],
            "tabelnaam": "locatie",
            "idKolom": "id",
            "heeftPFK": false,
            "onderliggende": [
                {
                    "rolnaam": "Adressen",
                    "jsonRolnaam": "adressen",
                    "doeltype": "Locatie_Adres",
                    "momentvoorkomen": "enkelvoudig"
                },
                {
                    "rolnaam": "Baglocaties",
                    "jsonRolnaam": "baglocaties",
                    "doeltype": "Locatie_BAGlocatie",
                    "momentvoorkomen": "enkelvoudig"
                },
                {
                    "rolnaam": "Aanvang",
                    "jsonRolnaam": "aanvang",
                    "doeltype": "Locatie_Aanvang",
                    "momentvoorkomen": "enkelvoudig"
                },
                {
                    "rolnaam": "Einde",
                    "jsonRolnaam": "einde",
                    "doeltype": "Locatie_Einde",
                    "momentvoorkomen": "enkelvoudig"
                }
            ],
            "afgeleideVelden": [
                {
                    "naam": "weergaveadres",
                    "description": "Samengesteld weergaveadres, afgeleid uit straatnaam, huisnummer, postcode en plaats.",
                    "goType": "string",
                    "afleidingsregelTaal": "cel",
                    "afleidingsregel": "Adres.straatnaam + ' ' + Adres.huisnummer + ', ' + Adres.postcode + ' ' + Adres.plaats",
                    "isWeergaveVeld": true
                }
            ]
        },
        {
            "typenaam": "Locatie_Aanvang",
            "klassenaam": "Aanvang",
            "description": "Aanvangsdatum van Locatie.",
            "metatype": "gegevenselement",
            "ge_subtype": "aanvang",
            "kleur": "#fecaca",
            "veldnaam": "locatie_aanvang",
            "padnaam": "locatie_aanvang",
            "meervoud": "locatie_aanvang",
            "velden": [
                {
                    "naam": "locatie_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "versie",
                    "type": "integer",
                    "verplicht": false,
                    "autoIncrement": true
                },
                {
                    "naam": "datum",
                    "type": "string",
                    "format": "date",
                    "verplicht": false
                }
            ],
            "tabelnaam": "locatie_aanvang",
            "idKolom": "versie",
            "idAutoIncrement": true,
            "heeftPFK": true,
            "entiteitIDKolom": "locatie_id",
            "bovenliggendTypenaam": "Locatie",
            "momentvoorkomen": "enkelvoudig"
        },
        {
            "typenaam": "Locatie_Adres",
            "klassenaam": "Adres",
            "description": "Binnenlands adres: een aanduiding van een binnenlandse locatie, uitgegeven door de gemeente en geregistreerd in de BAG.",
            "metatype": "gegevenselement",
            "ge_subtype": "hub",
            "kleur": "#fecaca",
            "veldnaam": "adres",
            "padnaam": "adressen",
            "meervoud": "adressen",
            "velden": [
                {
                    "naam": "locatie_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "rel_id",
                    "type": "integer",
                    "verplicht": true,
                    "autoIncrement": true
                },
                {
                    "naam": "straatnaam",
                    "type": "string",
                    "verplicht": true
                },
                {
                    "naam": "huisnummer",
                    "type": "string",
                    "verplicht": true
                },
                {
                    "naam": "postcode",
                    "type": "string",
                    "verplicht": true
                },
                {
                    "naam": "plaats",
                    "type": "string",
                    "verplicht": true
                },
                {
                    "naam": "land",
                    "type": "integer",
                    "verplicht": true
                }
            ],
            "tabelnaam": "locatie_adres",
            "idKolom": "rel_id",
            "idAutoIncrement": true,
            "heeftPFK": true,
            "entiteitIDKolom": "locatie_id",
            "momentvoorkomen": "enkelvoudig",
            "onderliggende": [
                {
                    "rolnaam": "Data",
                    "jsonRolnaam": "data",
                    "doeltype": "Locatie_Adres_Data",
                    "momentvoorkomen": "enkelvoudig"
                }
            ]
        },
        {
            "typenaam": "Locatie_Adres_Data",
            "klassenaam": "Data",
            "description": "Geversioned inhoud van Locatie_Adres.",
            "metatype": "gegevenselement",
            "ge_subtype": "data",
            "kleur": "#fecaca",
            "veldnaam": "locatie_adres_data",
            "padnaam": "locatie_adres_data",
            "meervoud": "locatie_adres_data",
            "velden": [
                {
                    "naam": "locatie_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "rel_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "versie",
                    "type": "integer",
                    "verplicht": false,
                    "autoIncrement": true
                },
                {
                    "naam": "straatnaam",
                    "type": "string",
                    "verplicht": true
                },
                {
                    "naam": "huisnummer",
                    "type": "string",
                    "verplicht": true
                },
                {
                    "naam": "postcode",
                    "type": "string",
                    "verplicht": true,
                    "datatype": "NLPostcode"
                },
                {
                    "naam": "plaats",
                    "type": "string",
                    "verplicht": true
                },
                {
                    "naam": "land",
                    "type": "integer",
                    "verplicht": true,
                    "ref": "LandenlijstLand"
                }
            ],
            "tabelnaam": "locatie_adres_data",
            "idKolom": "versie",
            "idAutoIncrement": true,
            "heeftPFK": true,
            "entiteitIDKolom": "locatie_id",
            "bovenliggendTypenaam": "Locatie_Adres",
            "momentvoorkomen": "enkelvoudig"
        },
        {
            "typenaam": "Locatie_BAGlocatie",
            "klassenaam": "BAGlocatie",
            "description": "Unieke identificatie van het adresseerbaar object (verblijfsobject, stand- of ligplaats) uitgegeven door het bevoegd gemeentelijke orgaan.",
            "metatype": "gegevenselement",
            "ge_subtype": "hub",
            "kleur": "#fecaca",
            "veldnaam": "baglocatie",
            "padnaam": "baglocaties",
            "meervoud": "baglocaties",
            "velden": [
                {
                    "naam": "locatie_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "rel_id",
                    "type": "integer",
                    "verplicht": true,
                    "autoIncrement": true
                },
                {
                    "naam": "adresaanduiding",
                    "type": "string",
                    "verplicht": true
                }
            ],
            "tabelnaam": "locatie_baglocatie",
            "idKolom": "rel_id",
            "idAutoIncrement": true,
            "heeftPFK": true,
            "entiteitIDKolom": "locatie_id",
            "momentvoorkomen": "enkelvoudig",
            "onderliggende": [
                {
                    "rolnaam": "Data",
                    "jsonRolnaam": "data",
                    "doeltype": "Locatie_BAGlocatie_Data",
                    "momentvoorkomen": "enkelvoudig"
                }
            ]
        },
        {
            "typenaam": "Locatie_BAGlocatie_Data",
            "klassenaam": "Data",
            "description": "Geversioned inhoud van Locatie_BAGlocatie.",
            "metatype": "gegevenselement",
            "ge_subtype": "data",
            "kleur": "#fecaca",
            "veldnaam": "locatie_baglocatie_data",
            "padnaam": "locatie_baglocatie_data",
            "meervoud": "locatie_baglocatie_data",
            "velden": [
                {
                    "naam": "locatie_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "rel_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "versie",
                    "type": "integer",
                    "verplicht": false,
                    "autoIncrement": true
                },
                {
                    "naam": "adresaanduiding",
                    "type": "string",
                    "verplicht": true
                }
            ],
            "tabelnaam": "locatie_baglocatie_data",
            "idKolom": "versie",
            "idAutoIncrement": true,
            "heeftPFK": true,
            "entiteitIDKolom": "locatie_id",
            "bovenliggendTypenaam": "Locatie_BAGlocatie",
            "momentvoorkomen": "enkelvoudig"
        },
        {
            "typenaam": "Locatie_Einde",
            "klassenaam": "Einde",
            "description": "Einddatum van Locatie.",
            "metatype": "gegevenselement",
            "ge_subtype": "einde",
            "kleur": "#fecaca",
            "veldnaam": "locatie_einde",
            "padnaam": "locatie_einde",
            "meervoud": "locatie_einde",
            "velden": [
                {
                    "naam": "locatie_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "versie",
                    "type": "integer",
                    "verplicht": false,
                    "autoIncrement": true
                },
                {
                    "naam": "datum",
                    "type": "string",
                    "format": "date",
                    "verplicht": false
                }
            ],
            "tabelnaam": "locatie_einde",
            "idKolom": "versie",
            "idAutoIncrement": true,
            "heeftPFK": true,
            "entiteitIDKolom": "locatie_id",
            "bovenliggendTypenaam": "Locatie",
            "momentvoorkomen": "enkelvoudig"
        },
        {
            "typenaam": "NatuurlijkPersoon",
            "klassenaam": "NatuurlijkPersoon",
            "description": "Een mens voor zover deze door Nederlandse wetgeving met rechten en plichten wordt bekleed.",
            "metatype": "entiteit",
            "isMaterieel": true,
            "domein": "np-loc",
            "kleur": "#bfdbfe",
            "veldnaam": "natuurlijkpersoon",
            "padnaam": "natuurlijk_personen",
            "meervoud": "natuurlijk personen",
            "velden": [
                {
                    "naam": "id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "persoonsidentificaties",
                    "type": "NatuurlijkPersoon_Persoonsidentificatie",
                    "format": "array",
                    "verplicht": false
                },
                {
                    "naam": "namen",
                    "type": "NatuurlijkPersoon_Naam",
                    "format": "array",
                    "verplicht": false
                },
                {
                    "naam": "burgerschappen",
                    "type": "NatuurlijkPersoon_Burgerschap",
                    "format": "array",
                    "verplicht": false
                },
                {
                    "naam": "partnernamen",
                    "type": "NatuurlijkPersoon_Partnernaam",
                    "format": "array",
                    "verplicht": false
                },
                {
                    "naam": "naamgebruiken",
                    "type": "NatuurlijkPersoon_Naamgebruik",
                    "format": "array",
                    "verplicht": false
                },
                {
                    "naam": "bereikbaarheden",
                    "type": "Bereikbaarheid",
                    "format": "array",
                    "verplicht": false
                }
            ],
            "tabelnaam": "natuurlijkpersoon",
            "idKolom": "id",
            "heeftPFK": false,
            "onderliggende": [
                {
                    "rolnaam": "Persoonsidentificaties",
                    "jsonRolnaam": "persoonsidentificaties",
                    "doeltype": "NatuurlijkPersoon_Persoonsidentificatie",
                    "momentvoorkomen": "enkelvoudig"
                },
                {
                    "rolnaam": "Namen",
                    "jsonRolnaam": "namen",
                    "doeltype": "NatuurlijkPersoon_Naam",
                    "momentvoorkomen": "enkelvoudig"
                },
                {
                    "rolnaam": "Burgerschappen",
                    "jsonRolnaam": "burgerschappen",
                    "doeltype": "NatuurlijkPersoon_Burgerschap",
                    "momentvoorkomen": "meervoudig"
                },
                {
                    "rolnaam": "Partnernamen",
                    "jsonRolnaam": "partnernamen",
                    "doeltype": "NatuurlijkPersoon_Partnernaam",
                    "momentvoorkomen": "enkelvoudig"
                },
                {
                    "rolnaam": "Naamgebruiken",
                    "jsonRolnaam": "naamgebruiken",
                    "doeltype": "NatuurlijkPersoon_Naamgebruik",
                    "momentvoorkomen": "enkelvoudig"
                },
                {
                    "rolnaam": "Bereikbaarheden",
                    "jsonRolnaam": "bereikbaarheden",
                    "doeltype": "Bereikbaarheid",
                    "momentvoorkomen": "enkelvoudig"
                },
                {
                    "rolnaam": "Aanvang",
                    "jsonRolnaam": "aanvang",
                    "doeltype": "NatuurlijkPersoon_Aanvang",
                    "momentvoorkomen": "enkelvoudig"
                },
                {
                    "rolnaam": "Einde",
                    "jsonRolnaam": "einde",
                    "doeltype": "NatuurlijkPersoon_Einde",
                    "momentvoorkomen": "enkelvoudig"
                }
            ],
            "afgeleideVelden": [
                {
                    "naam": "weergavenaam",
                    "description": "Samengestelde weergavenaam van de persoon, afgeleid uit voornaam/tussenvoegsel/achternaam.",
                    "goType": "string",
                    "afleidingsregelTaal": "cel",
                    "afleidingsregel": "(Naam.roepnaam != null ? Naam.roepnaam : Naam.voorletters) + (Naam.tussenvoegsel != null ? ' ' + Naam.tussenvoegsel : '') + ' ' + Naam.achternaam",
                    "isWeergaveVeld": true
                }
            ]
        },
        {
            "typenaam": "NatuurlijkPersoon_Aanvang",
            "klassenaam": "Aanvang",
            "description": "Aanvangsdatum van NatuurlijkPersoon.",
            "metatype": "gegevenselement",
            "ge_subtype": "aanvang",
            "kleur": "#bfdbfe",
            "veldnaam": "natuurlijkpersoon_aanvang",
            "padnaam": "natuurlijkpersoon_aanvang",
            "meervoud": "natuurlijkpersoon_aanvang",
            "velden": [
                {
                    "naam": "natuurlijkpersoon_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "versie",
                    "type": "integer",
                    "verplicht": false,
                    "autoIncrement": true
                },
                {
                    "naam": "datum",
                    "type": "string",
                    "format": "date",
                    "verplicht": false
                }
            ],
            "tabelnaam": "natuurlijkpersoon_aanvang",
            "idKolom": "versie",
            "idAutoIncrement": true,
            "heeftPFK": true,
            "entiteitIDKolom": "natuurlijkpersoon_id",
            "bovenliggendTypenaam": "NatuurlijkPersoon",
            "momentvoorkomen": "enkelvoudig"
        },
        {
            "typenaam": "NatuurlijkPersoon_Burgerschap",
            "klassenaam": "Burgerschap",
            "description": "Nationaliteitsgegevens (burgerschap) van de natuurlijk persoon.",
            "metatype": "gegevenselement",
            "ge_subtype": "hub",
            "isMaterieel": true,
            "kleur": "#bfdbfe",
            "veldnaam": "burgerschap",
            "padnaam": "burgerschappen",
            "meervoud": "burgerschappen",
            "velden": [
                {
                    "naam": "natuurlijkpersoon_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "rel_id",
                    "type": "integer",
                    "verplicht": true,
                    "autoIncrement": true
                },
                {
                    "naam": "landcode",
                    "type": "string",
                    "verplicht": true
                },
                {
                    "naam": "nationaliteit",
                    "type": "string",
                    "verplicht": true
                }
            ],
            "tabelnaam": "natuurlijkpersoon_burgerschap",
            "idKolom": "rel_id",
            "idAutoIncrement": true,
            "heeftPFK": true,
            "entiteitIDKolom": "natuurlijkpersoon_id",
            "momentvoorkomen": "meervoudig",
            "onderliggende": [
                {
                    "rolnaam": "Data",
                    "jsonRolnaam": "data",
                    "doeltype": "NatuurlijkPersoon_Burgerschap_Data",
                    "momentvoorkomen": "enkelvoudig"
                },
                {
                    "rolnaam": "Aanvang",
                    "jsonRolnaam": "aanvang",
                    "doeltype": "NatuurlijkPersoon_Burgerschap_Aanvang",
                    "momentvoorkomen": "enkelvoudig"
                },
                {
                    "rolnaam": "Einde",
                    "jsonRolnaam": "einde",
                    "doeltype": "NatuurlijkPersoon_Burgerschap_Einde",
                    "momentvoorkomen": "enkelvoudig"
                }
            ],
            "afgeleideVelden": [
                {
                    "naam": "weergaveburgerschap",
                    "description": "Samengestelde weergave van nationaliteit en landcode.",
                    "goType": "string",
                    "afleidingsregelTaal": "cel",
                    "afleidingsregel": "Burgerschap_Data.nationaliteit + ' (' + Burgerschap_Data.landcode + ')'",
                    "isWeergaveVeld": true
                }
            ]
        },
        {
            "typenaam": "NatuurlijkPersoon_Burgerschap_Aanvang",
            "klassenaam": "Aanvang",
            "description": "Aanvangsdatum van NatuurlijkPersoon_Burgerschap.",
            "metatype": "gegevenselement",
            "ge_subtype": "aanvang",
            "kleur": "#bfdbfe",
            "veldnaam": "natuurlijkpersoon_burgerschap_aanvang",
            "padnaam": "natuurlijkpersoon_burgerschap_aanvang",
            "meervoud": "natuurlijkpersoon_burgerschap_aanvang",
            "velden": [
                {
                    "naam": "natuurlijkpersoon_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "rel_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "versie",
                    "type": "integer",
                    "verplicht": false,
                    "autoIncrement": true
                },
                {
                    "naam": "datum",
                    "type": "string",
                    "format": "date",
                    "verplicht": false
                }
            ],
            "tabelnaam": "natuurlijkpersoon_burgerschap_aanvang",
            "idKolom": "versie",
            "idAutoIncrement": true,
            "heeftPFK": true,
            "entiteitIDKolom": "natuurlijkpersoon_id",
            "bovenliggendTypenaam": "NatuurlijkPersoon_Burgerschap",
            "momentvoorkomen": "enkelvoudig"
        },
        {
            "typenaam": "NatuurlijkPersoon_Burgerschap_Data",
            "klassenaam": "Data",
            "description": "Geversioned inhoud van NatuurlijkPersoon_Burgerschap.",
            "metatype": "gegevenselement",
            "ge_subtype": "data",
            "kleur": "#bfdbfe",
            "veldnaam": "natuurlijkpersoon_burgerschap_data",
            "padnaam": "natuurlijkpersoon_burgerschap_data",
            "meervoud": "natuurlijkpersoon_burgerschap_data",
            "velden": [
                {
                    "naam": "natuurlijkpersoon_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "rel_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "versie",
                    "type": "integer",
                    "verplicht": false,
                    "autoIncrement": true
                },
                {
                    "naam": "landcode",
                    "type": "string",
                    "verplicht": true
                },
                {
                    "naam": "nationaliteit",
                    "type": "string",
                    "verplicht": true
                }
            ],
            "tabelnaam": "natuurlijkpersoon_burgerschap_data",
            "idKolom": "versie",
            "idAutoIncrement": true,
            "heeftPFK": true,
            "entiteitIDKolom": "natuurlijkpersoon_id",
            "bovenliggendTypenaam": "NatuurlijkPersoon_Burgerschap",
            "momentvoorkomen": "enkelvoudig"
        },
        {
            "typenaam": "NatuurlijkPersoon_Burgerschap_Einde",
            "klassenaam": "Einde",
            "description": "Einddatum van NatuurlijkPersoon_Burgerschap.",
            "metatype": "gegevenselement",
            "ge_subtype": "einde",
            "kleur": "#bfdbfe",
            "veldnaam": "natuurlijkpersoon_burgerschap_einde",
            "padnaam": "natuurlijkpersoon_burgerschap_einde",
            "meervoud": "natuurlijkpersoon_burgerschap_einde",
            "velden": [
                {
                    "naam": "natuurlijkpersoon_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "rel_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "versie",
                    "type": "integer",
                    "verplicht": false,
                    "autoIncrement": true
                },
                {
                    "naam": "datum",
                    "type": "string",
                    "format": "date",
                    "verplicht": false
                }
            ],
            "tabelnaam": "natuurlijkpersoon_burgerschap_einde",
            "idKolom": "versie",
            "idAutoIncrement": true,
            "heeftPFK": true,
            "entiteitIDKolom": "natuurlijkpersoon_id",
            "bovenliggendTypenaam": "NatuurlijkPersoon_Burgerschap",
            "momentvoorkomen": "enkelvoudig"
        },
        {
            "typenaam": "NatuurlijkPersoon_Einde",
            "klassenaam": "Einde",
            "description": "Einddatum van NatuurlijkPersoon.",
            "metatype": "gegevenselement",
            "ge_subtype": "einde",
            "kleur": "#bfdbfe",
            "veldnaam": "natuurlijkpersoon_einde",
            "padnaam": "natuurlijkpersoon_einde",
            "meervoud": "natuurlijkpersoon_einde",
            "velden": [
                {
                    "naam": "natuurlijkpersoon_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "versie",
                    "type": "integer",
                    "verplicht": false,
                    "autoIncrement": true
                },
                {
                    "naam": "datum",
                    "type": "string",
                    "format": "date",
                    "verplicht": false
                }
            ],
            "tabelnaam": "natuurlijkpersoon_einde",
            "idKolom": "versie",
            "idAutoIncrement": true,
            "heeftPFK": true,
            "entiteitIDKolom": "natuurlijkpersoon_id",
            "bovenliggendTypenaam": "NatuurlijkPersoon",
            "momentvoorkomen": "enkelvoudig"
        },
        {
            "typenaam": "NatuurlijkPersoon_Naam",
            "klassenaam": "Naam",
            "description": "Naamgegevens van de natuurlijk persoon (voorletters, roepnaam, tussenvoegsel, achternaam).",
            "metatype": "gegevenselement",
            "ge_subtype": "hub",
            "kleur": "#bfdbfe",
            "veldnaam": "naam",
            "padnaam": "namen",
            "meervoud": "namen",
            "velden": [
                {
                    "naam": "natuurlijkpersoon_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "rel_id",
                    "type": "integer",
                    "verplicht": true,
                    "autoIncrement": true
                },
                {
                    "naam": "voorletters",
                    "type": "string",
                    "verplicht": true
                },
                {
                    "naam": "roepnaam",
                    "type": "string",
                    "verplicht": false
                },
                {
                    "naam": "tussenvoegsel",
                    "type": "string",
                    "verplicht": false
                },
                {
                    "naam": "achternaam",
                    "type": "string",
                    "verplicht": true
                }
            ],
            "tabelnaam": "natuurlijkpersoon_naam",
            "idKolom": "rel_id",
            "idAutoIncrement": true,
            "heeftPFK": true,
            "entiteitIDKolom": "natuurlijkpersoon_id",
            "momentvoorkomen": "enkelvoudig",
            "onderliggende": [
                {
                    "rolnaam": "Data",
                    "jsonRolnaam": "data",
                    "doeltype": "NatuurlijkPersoon_Naam_Data",
                    "momentvoorkomen": "enkelvoudig"
                }
            ]
        },
        {
            "typenaam": "NatuurlijkPersoon_Naam_Data",
            "klassenaam": "Data",
            "description": "Geversioned inhoud van NatuurlijkPersoon_Naam.",
            "metatype": "gegevenselement",
            "ge_subtype": "data",
            "kleur": "#bfdbfe",
            "veldnaam": "natuurlijkpersoon_naam_data",
            "padnaam": "natuurlijkpersoon_naam_data",
            "meervoud": "natuurlijkpersoon_naam_data",
            "velden": [
                {
                    "naam": "natuurlijkpersoon_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "rel_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "versie",
                    "type": "integer",
                    "verplicht": false,
                    "autoIncrement": true
                },
                {
                    "naam": "voorletters",
                    "type": "string",
                    "verplicht": true
                },
                {
                    "naam": "roepnaam",
                    "type": "string",
                    "verplicht": false
                },
                {
                    "naam": "tussenvoegsel",
                    "type": "string",
                    "verplicht": false
                },
                {
                    "naam": "achternaam",
                    "type": "string",
                    "verplicht": true
                }
            ],
            "tabelnaam": "natuurlijkpersoon_naam_data",
            "idKolom": "versie",
            "idAutoIncrement": true,
            "heeftPFK": true,
            "entiteitIDKolom": "natuurlijkpersoon_id",
            "bovenliggendTypenaam": "NatuurlijkPersoon_Naam",
            "momentvoorkomen": "enkelvoudig"
        },
        {
            "typenaam": "NatuurlijkPersoon_Naamgebruik",
            "klassenaam": "Naamgebruik",
            "description": "Wijze waarop de geslachtsnaam wordt gebruikt.",
            "metatype": "gegevenselement",
            "ge_subtype": "hub",
            "kleur": "#bfdbfe",
            "veldnaam": "naamgebruik",
            "padnaam": "naamgebruiken",
            "meervoud": "naamgebruiken",
            "velden": [
                {
                    "naam": "natuurlijkpersoon_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "rel_id",
                    "type": "integer",
                    "verplicht": true,
                    "autoIncrement": true
                },
                {
                    "naam": "naamgebruik",
                    "type": "string",
                    "enum": [
                        "EigenNaam",
                        "PartnerNaam",
                        "EigenNaam-PartnerNaam",
                        "PartnerNaam-EigenNaam"
                    ],
                    "verplicht": true
                }
            ],
            "tabelnaam": "natuurlijkpersoon_naamgebruik",
            "idKolom": "rel_id",
            "idAutoIncrement": true,
            "heeftPFK": true,
            "entiteitIDKolom": "natuurlijkpersoon_id",
            "momentvoorkomen": "enkelvoudig",
            "onderliggende": [
                {
                    "rolnaam": "Data",
                    "jsonRolnaam": "data",
                    "doeltype": "NatuurlijkPersoon_Naamgebruik_Data",
                    "momentvoorkomen": "enkelvoudig"
                }
            ]
        },
        {
            "typenaam": "NatuurlijkPersoon_Naamgebruik_Data",
            "klassenaam": "Data",
            "description": "Geversioned inhoud van NatuurlijkPersoon_Naamgebruik.",
            "metatype": "gegevenselement",
            "ge_subtype": "data",
            "kleur": "#bfdbfe",
            "veldnaam": "natuurlijkpersoon_naamgebruik_data",
            "padnaam": "natuurlijkpersoon_naamgebruik_data",
            "meervoud": "natuurlijkpersoon_naamgebruik_data",
            "velden": [
                {
                    "naam": "natuurlijkpersoon_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "rel_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "versie",
                    "type": "integer",
                    "verplicht": false,
                    "autoIncrement": true
                },
                {
                    "naam": "naamgebruik",
                    "type": "string",
                    "enum": [
                        "EigenNaam",
                        "PartnerNaam",
                        "EigenNaam-PartnerNaam",
                        "PartnerNaam-EigenNaam"
                    ],
                    "verplicht": true
                }
            ],
            "tabelnaam": "natuurlijkpersoon_naamgebruik_data",
            "idKolom": "versie",
            "idAutoIncrement": true,
            "heeftPFK": true,
            "entiteitIDKolom": "natuurlijkpersoon_id",
            "bovenliggendTypenaam": "NatuurlijkPersoon_Naamgebruik",
            "momentvoorkomen": "enkelvoudig"
        },
        {
            "typenaam": "NatuurlijkPersoon_Partnernaam",
            "klassenaam": "Partnernaam",
            "description": "Achternaam van de partner van de natuurlijk persoon.",
            "metatype": "gegevenselement",
            "ge_subtype": "hub",
            "kleur": "#bfdbfe",
            "veldnaam": "partnernaam",
            "padnaam": "partnernamen",
            "meervoud": "partnernamen",
            "velden": [
                {
                    "naam": "natuurlijkpersoon_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "rel_id",
                    "type": "integer",
                    "verplicht": true,
                    "autoIncrement": true
                },
                {
                    "naam": "achternaam",
                    "type": "string",
                    "verplicht": true
                }
            ],
            "tabelnaam": "natuurlijkpersoon_partnernaam",
            "idKolom": "rel_id",
            "idAutoIncrement": true,
            "heeftPFK": true,
            "entiteitIDKolom": "natuurlijkpersoon_id",
            "momentvoorkomen": "enkelvoudig",
            "onderliggende": [
                {
                    "rolnaam": "Data",
                    "jsonRolnaam": "data",
                    "doeltype": "NatuurlijkPersoon_Partnernaam_Data",
                    "momentvoorkomen": "enkelvoudig"
                }
            ]
        },
        {
            "typenaam": "NatuurlijkPersoon_Partnernaam_Data",
            "klassenaam": "Data",
            "description": "Geversioned inhoud van NatuurlijkPersoon_Partnernaam.",
            "metatype": "gegevenselement",
            "ge_subtype": "data",
            "kleur": "#bfdbfe",
            "veldnaam": "natuurlijkpersoon_partnernaam_data",
            "padnaam": "natuurlijkpersoon_partnernaam_data",
            "meervoud": "natuurlijkpersoon_partnernaam_data",
            "velden": [
                {
                    "naam": "natuurlijkpersoon_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "rel_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "versie",
                    "type": "integer",
                    "verplicht": false,
                    "autoIncrement": true
                },
                {
                    "naam": "achternaam",
                    "type": "string",
                    "verplicht": true
                }
            ],
            "tabelnaam": "natuurlijkpersoon_partnernaam_data",
            "idKolom": "versie",
            "idAutoIncrement": true,
            "heeftPFK": true,
            "entiteitIDKolom": "natuurlijkpersoon_id",
            "bovenliggendTypenaam": "NatuurlijkPersoon_Partnernaam",
            "momentvoorkomen": "enkelvoudig"
        },
        {
            "typenaam": "NatuurlijkPersoon_Persoonsidentificatie",
            "klassenaam": "Persoonsidentificatie",
            "description": "Identificerende gegevens van de natuurlijk persoon (BSN, ingezetene).",
            "metatype": "gegevenselement",
            "ge_subtype": "hub",
            "kleur": "#bfdbfe",
            "veldnaam": "persoonsidentificatie",
            "padnaam": "persoonsidentificaties",
            "meervoud": "persoonsidentificaties",
            "velden": [
                {
                    "naam": "natuurlijkpersoon_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "rel_id",
                    "type": "integer",
                    "verplicht": true,
                    "autoIncrement": true
                },
                {
                    "naam": "bsn",
                    "type": "string",
                    "verplicht": true
                },
                {
                    "naam": "ingezetene",
                    "type": "boolean",
                    "verplicht": false
                }
            ],
            "tabelnaam": "natuurlijkpersoon_persoonsidentificatie",
            "idKolom": "rel_id",
            "idAutoIncrement": true,
            "heeftPFK": true,
            "entiteitIDKolom": "natuurlijkpersoon_id",
            "momentvoorkomen": "enkelvoudig",
            "onderliggende": [
                {
                    "rolnaam": "Data",
                    "jsonRolnaam": "data",
                    "doeltype": "NatuurlijkPersoon_Persoonsidentificatie_Data",
                    "momentvoorkomen": "enkelvoudig"
                }
            ]
        },
        {
            "typenaam": "NatuurlijkPersoon_Persoonsidentificatie_Data",
            "klassenaam": "Data",
            "description": "Geversioned inhoud van NatuurlijkPersoon_Persoonsidentificatie.",
            "metatype": "gegevenselement",
            "ge_subtype": "data",
            "kleur": "#bfdbfe",
            "veldnaam": "natuurlijkpersoon_persoonsidentificatie_data",
            "padnaam": "natuurlijkpersoon_persoonsidentificatie_data",
            "meervoud": "natuurlijkpersoon_persoonsidentificatie_data",
            "velden": [
                {
                    "naam": "natuurlijkpersoon_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "rel_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "versie",
                    "type": "integer",
                    "verplicht": false,
                    "autoIncrement": true
                },
                {
                    "naam": "bsn",
                    "type": "string",
                    "verplicht": true,
                    "datatype": "BSN"
                },
                {
                    "naam": "ingezetene",
                    "type": "boolean",
                    "verplicht": false
                }
            ],
            "tabelnaam": "natuurlijkpersoon_persoonsidentificatie_data",
            "idKolom": "versie",
            "idAutoIncrement": true,
            "heeftPFK": true,
            "entiteitIDKolom": "natuurlijkpersoon_id",
            "bovenliggendTypenaam": "NatuurlijkPersoon_Persoonsidentificatie",
            "momentvoorkomen": "enkelvoudig"
        },
        {
            "typenaam": "Referentielijst",
            "klassenaam": "Referentielijst",
            "description": "Generieke referentielijst-entiteit. Individuele lijsten (Landenlijst, EULidstaten, etc.) zijn records.",
            "metatype": "entiteit",
            "isMaterieel": true,
            "entiteitSubtype": "referentielijst",
            "domein": "register",
            "kleur": "#fef3c7",
            "veldnaam": "referentielijst",
            "padnaam": "referentielijsten",
            "meervoud": "referentielijsten",
            "velden": [
                {
                    "naam": "id",
                    "type": "integer",
                    "verplicht": true,
                    "autoIncrement": true
                },
                {
                    "naam": "systeemnaam",
                    "type": "string",
                    "verplicht": true
                },
                {
                    "naam": "referentielijstnamen",
                    "type": "Referentielijstnaam",
                    "format": "array",
                    "verplicht": false
                },
                {
                    "naam": "referentielijstomschrijvingen",
                    "type": "Referentielijstomschrijving",
                    "format": "array",
                    "verplicht": false
                },
                {
                    "naam": "visibilities",
                    "type": "ReferentielijstVisibility",
                    "format": "array",
                    "verplicht": false
                },
                {
                    "naam": "internetadressen",
                    "type": "ReferentielijstInternetadres",
                    "format": "array",
                    "verplicht": false
                },
                {
                    "naam": "landenlijst_landen",
                    "type": "LandenlijstLand",
                    "format": "array",
                    "verplicht": false
                },
                {
                    "naam": "adellijke_titels_titels",
                    "type": "AdellijkeTitelsTitel",
                    "format": "array",
                    "verplicht": false
                }
            ],
            "tabelnaam": "register_referentielijst",
            "idKolom": "id",
            "heeftPFK": false,
            "onderliggende": [
                {
                    "rolnaam": "Referentielijstnamen",
                    "jsonRolnaam": "referentielijstnamen",
                    "doeltype": "Referentielijstnaam",
                    "momentvoorkomen": "enkelvoudig"
                },
                {
                    "rolnaam": "Referentielijstomschrijvingen",
                    "jsonRolnaam": "referentielijstomschrijvingen",
                    "doeltype": "Referentielijstomschrijving",
                    "momentvoorkomen": "enkelvoudig"
                },
                {
                    "rolnaam": "Visibilities",
                    "jsonRolnaam": "visibilities",
                    "doeltype": "ReferentielijstVisibility",
                    "momentvoorkomen": "enkelvoudig"
                },
                {
                    "rolnaam": "Internetadressen",
                    "jsonRolnaam": "internetadressen",
                    "doeltype": "ReferentielijstInternetadres",
                    "momentvoorkomen": "meervoudig"
                },
                {
                    "rolnaam": "Aanvang",
                    "jsonRolnaam": "aanvang",
                    "doeltype": "Referentielijst_Aanvang",
                    "momentvoorkomen": "enkelvoudig"
                },
                {
                    "rolnaam": "Einde",
                    "jsonRolnaam": "einde",
                    "doeltype": "Referentielijst_Einde",
                    "momentvoorkomen": "enkelvoudig"
                },
                {
                    "rolnaam": "LandenlijstLanden",
                    "jsonRolnaam": "landenlijst_landen",
                    "doeltype": "LandenlijstLand",
                    "momentvoorkomen": "meervoudig"
                },
                {
                    "rolnaam": "AdellijkeTitelsTitels",
                    "jsonRolnaam": "adellijke_titels_titels",
                    "doeltype": "AdellijkeTitelsTitel",
                    "momentvoorkomen": "meervoudig"
                }
            ]
        },
        {
            "typenaam": "ReferentielijstInternetadres",
            "klassenaam": "Internetadres",
            "description": "Internetadres (URL/URN) van een referentielijst.",
            "metatype": "gegevenselement",
            "ge_subtype": "hub",
            "kleur": "#fef3c7",
            "veldnaam": "internetadres",
            "padnaam": "internetadressen",
            "meervoud": "internetadressen",
            "velden": [
                {
                    "naam": "referentielijst_id",
                    "description": "ID van de Referentielijst-entiteit",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "rel_id",
                    "type": "integer",
                    "verplicht": true,
                    "autoIncrement": true
                },
                {
                    "naam": "data",
                    "type": "ReferentielijstInternetadres_Data",
                    "format": "array",
                    "verplicht": false
                }
            ],
            "tabelnaam": "referentielijstinternetadres",
            "idKolom": "rel_id",
            "idAutoIncrement": true,
            "heeftPFK": true,
            "entiteitIDKolom": "referentielijst_id",
            "bovenliggendTypenaam": "Referentielijst",
            "momentvoorkomen": "meervoudig",
            "onderliggende": [
                {
                    "rolnaam": "Data",
                    "jsonRolnaam": "data",
                    "doeltype": "ReferentielijstInternetadres_Data",
                    "momentvoorkomen": "enkelvoudig"
                }
            ]
        },
        {
            "typenaam": "ReferentielijstInternetadres_Data",
            "klassenaam": "Data",
            "description": "Geversioned inhoud van ReferentielijstInternetadres.",
            "metatype": "gegevenselement",
            "ge_subtype": "data",
            "kleur": "#fef3c7",
            "veldnaam": "referentielijstinternetadres_data",
            "padnaam": "referentielijstinternetadres_data",
            "meervoud": "referentielijstinternetadres_data",
            "velden": [
                {
                    "naam": "referentielijst_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "rel_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "versie",
                    "type": "integer",
                    "verplicht": false,
                    "autoIncrement": true
                },
                {
                    "naam": "adrestype",
                    "description": "Type adres: URL of URN.",
                    "type": "string",
                    "enum": [
                        "URL",
                        "URN"
                    ],
                    "verplicht": true
                },
                {
                    "naam": "adres",
                    "description": "Het volledige internet-adres (URL of URN).",
                    "type": "string",
                    "verplicht": true
                },
                {
                    "naam": "organisatie",
                    "description": "Verantwoordelijke organisatie voor dit adres.",
                    "type": "string",
                    "verplicht": true
                }
            ],
            "tabelnaam": "referentielijstinternetadres_data",
            "idKolom": "versie",
            "idAutoIncrement": true,
            "heeftPFK": true,
            "entiteitIDKolom": "referentielijst_id",
            "bovenliggendTypenaam": "ReferentielijstInternetadres",
            "momentvoorkomen": "enkelvoudig"
        },
        {
            "typenaam": "ReferentielijstVisibility",
            "klassenaam": "Visibility",
            "description": "Domeinzichtbaarheid van een referentielijst (register, modelspecifiek, extern).",
            "metatype": "gegevenselement",
            "ge_subtype": "hub",
            "kleur": "#fef3c7",
            "veldnaam": "visibility",
            "padnaam": "visibilities",
            "meervoud": "visibilities",
            "velden": [
                {
                    "naam": "referentielijst_id",
                    "description": "ID van de Referentielijst-entiteit",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "rel_id",
                    "type": "integer",
                    "verplicht": true,
                    "autoIncrement": true
                },
                {
                    "naam": "data",
                    "type": "ReferentielijstVisibility_Data",
                    "format": "array",
                    "verplicht": false
                }
            ],
            "tabelnaam": "referentielijstvisibility",
            "idKolom": "rel_id",
            "idAutoIncrement": true,
            "heeftPFK": true,
            "entiteitIDKolom": "referentielijst_id",
            "bovenliggendTypenaam": "Referentielijst",
            "momentvoorkomen": "enkelvoudig",
            "onderliggende": [
                {
                    "rolnaam": "Data",
                    "jsonRolnaam": "data",
                    "doeltype": "ReferentielijstVisibility_Data",
                    "momentvoorkomen": "enkelvoudig"
                }
            ]
        },
        {
            "typenaam": "ReferentielijstVisibility_Data",
            "klassenaam": "Data",
            "description": "Geversioned inhoud van ReferentielijstVisibility.",
            "metatype": "gegevenselement",
            "ge_subtype": "data",
            "kleur": "#fef3c7",
            "veldnaam": "referentielijstvisibility_data",
            "padnaam": "referentielijstvisibility_data",
            "meervoud": "referentielijstvisibility_data",
            "velden": [
                {
                    "naam": "referentielijst_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "rel_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "versie",
                    "type": "integer",
                    "verplicht": false,
                    "autoIncrement": true
                },
                {
                    "naam": "domein",
                    "description": "Domeinzichtbaarheid: 'register', modelspecifiek domein, of 'extern'.",
                    "type": "string",
                    "verplicht": true
                }
            ],
            "tabelnaam": "referentielijstvisibility_data",
            "idKolom": "versie",
            "idAutoIncrement": true,
            "heeftPFK": true,
            "entiteitIDKolom": "referentielijst_id",
            "bovenliggendTypenaam": "ReferentielijstVisibility",
            "momentvoorkomen": "enkelvoudig"
        },
        {
            "typenaam": "Referentielijst_Aanvang",
            "klassenaam": "Aanvang",
            "description": "Aanvangsdatum van referentielijst.",
            "metatype": "gegevenselement",
            "ge_subtype": "aanvang",
            "kleur": "#fef3c7",
            "veldnaam": "referentielijst_aanvang",
            "padnaam": "referentielijst_aanvang",
            "meervoud": "referentielijst_aanvang",
            "velden": [
                {
                    "naam": "referentielijst_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "versie",
                    "type": "integer",
                    "verplicht": false,
                    "autoIncrement": true
                },
                {
                    "naam": "datum",
                    "type": "string",
                    "format": "date",
                    "verplicht": false
                }
            ],
            "tabelnaam": "referentielijst_aanvang",
            "idKolom": "versie",
            "idAutoIncrement": true,
            "heeftPFK": true,
            "entiteitIDKolom": "referentielijst_id",
            "bovenliggendTypenaam": "Referentielijst",
            "momentvoorkomen": "enkelvoudig"
        },
        {
            "typenaam": "Referentielijst_Einde",
            "klassenaam": "Einde",
            "description": "Einddatum van referentielijst.",
            "metatype": "gegevenselement",
            "ge_subtype": "einde",
            "kleur": "#fef3c7",
            "veldnaam": "referentielijst_einde",
            "padnaam": "referentielijst_einde",
            "meervoud": "referentielijst_einde",
            "velden": [
                {
                    "naam": "referentielijst_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "versie",
                    "type": "integer",
                    "verplicht": false,
                    "autoIncrement": true
                },
                {
                    "naam": "datum",
                    "type": "string",
                    "format": "date",
                    "verplicht": false
                }
            ],
            "tabelnaam": "referentielijst_einde",
            "idKolom": "versie",
            "idAutoIncrement": true,
            "heeftPFK": true,
            "entiteitIDKolom": "referentielijst_id",
            "bovenliggendTypenaam": "Referentielijst",
            "momentvoorkomen": "enkelvoudig"
        },
        {
            "typenaam": "Referentielijstnaam",
            "klassenaam": "Referentielijstnaam",
            "description": "Leesbare naam van een referentielijst.",
            "metatype": "gegevenselement",
            "ge_subtype": "hub",
            "kleur": "#fef3c7",
            "veldnaam": "referentielijstnaam",
            "padnaam": "referentielijstnamen",
            "meervoud": "referentielijstnamen",
            "velden": [
                {
                    "naam": "referentielijst_id",
                    "description": "ID van de Referentielijst-entiteit",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "rel_id",
                    "type": "integer",
                    "verplicht": true,
                    "autoIncrement": true
                },
                {
                    "naam": "data",
                    "type": "Referentielijstnaam_Data",
                    "format": "array",
                    "verplicht": false
                }
            ],
            "tabelnaam": "referentielijstnaam",
            "idKolom": "rel_id",
            "idAutoIncrement": true,
            "heeftPFK": true,
            "entiteitIDKolom": "referentielijst_id",
            "bovenliggendTypenaam": "Referentielijst",
            "momentvoorkomen": "enkelvoudig",
            "onderliggende": [
                {
                    "rolnaam": "Data",
                    "jsonRolnaam": "data",
                    "doeltype": "Referentielijstnaam_Data",
                    "momentvoorkomen": "enkelvoudig"
                }
            ]
        },
        {
            "typenaam": "Referentielijstnaam_Data",
            "klassenaam": "Data",
            "description": "Geversioned inhoud van Referentielijstnaam.",
            "metatype": "gegevenselement",
            "ge_subtype": "data",
            "kleur": "#fef3c7",
            "veldnaam": "referentielijstnaam_data",
            "padnaam": "referentielijstnaam_data",
            "meervoud": "referentielijstnaam_data",
            "velden": [
                {
                    "naam": "referentielijst_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "rel_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "versie",
                    "type": "integer",
                    "verplicht": false,
                    "autoIncrement": true
                },
                {
                    "naam": "naam",
                    "type": "string",
                    "verplicht": true
                }
            ],
            "tabelnaam": "referentielijstnaam_data",
            "idKolom": "versie",
            "idAutoIncrement": true,
            "heeftPFK": true,
            "entiteitIDKolom": "referentielijst_id",
            "bovenliggendTypenaam": "Referentielijstnaam",
            "momentvoorkomen": "enkelvoudig"
        },
        {
            "typenaam": "Referentielijstomschrijving",
            "klassenaam": "Referentielijstomschrijving",
            "description": "Omschrijving van een referentielijst.",
            "metatype": "gegevenselement",
            "ge_subtype": "hub",
            "kleur": "#fef3c7",
            "veldnaam": "referentielijstomschrijving",
            "padnaam": "referentielijstomschrijvingen",
            "meervoud": "referentielijstomschrijvingen",
            "velden": [
                {
                    "naam": "referentielijst_id",
                    "description": "ID van de Referentielijst-entiteit",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "rel_id",
                    "type": "integer",
                    "verplicht": true,
                    "autoIncrement": true
                },
                {
                    "naam": "data",
                    "type": "Referentielijstomschrijving_Data",
                    "format": "array",
                    "verplicht": false
                }
            ],
            "tabelnaam": "referentielijstomschrijving",
            "idKolom": "rel_id",
            "idAutoIncrement": true,
            "heeftPFK": true,
            "entiteitIDKolom": "referentielijst_id",
            "bovenliggendTypenaam": "Referentielijst",
            "momentvoorkomen": "enkelvoudig",
            "onderliggende": [
                {
                    "rolnaam": "Data",
                    "jsonRolnaam": "data",
                    "doeltype": "Referentielijstomschrijving_Data",
                    "momentvoorkomen": "enkelvoudig"
                }
            ]
        },
        {
            "typenaam": "Referentielijstomschrijving_Data",
            "klassenaam": "Data",
            "description": "Geversioned inhoud van Referentielijstomschrijving.",
            "metatype": "gegevenselement",
            "ge_subtype": "data",
            "kleur": "#fef3c7",
            "veldnaam": "referentielijstomschrijving_data",
            "padnaam": "referentielijstomschrijving_data",
            "meervoud": "referentielijstomschrijving_data",
            "velden": [
                {
                    "naam": "referentielijst_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "rel_id",
                    "type": "integer",
                    "verplicht": true
                },
                {
                    "naam": "versie",
                    "type": "integer",
                    "verplicht": false,
                    "autoIncrement": true
                },
                {
                    "naam": "omschrijving",
                    "type": "string",
                    "verplicht": true
                }
            ],
            "tabelnaam": "referentielijstomschrijving_data",
            "idKolom": "versie",
            "idAutoIncrement": true,
            "heeftPFK": true,
            "entiteitIDKolom": "referentielijst_id",
            "bovenliggendTypenaam": "Referentielijstomschrijving",
            "momentvoorkomen": "enkelvoudig"
        }
    ]
}

---

## 🤖 Assistant

Ja, dit is nu logisch gedrag.

Waarom je nog register ziet bij domein=np-loc:
1. De filtering is nu: gekozen domein + register-basislaag.
2. Die basislaag is bewust mee om referenties geldig te houden.
3. Daarom zie je minstens:
   - 2 register-datatypes: NLPostcode, BSN
   - Land (referentielijst-item in register)
   - Referentielijst (en vaak onderliggende register-types)

Dus:
- AB is eruit: goed.
- np-loc + register samen: ook goed volgens huidige ontwerp.

Gaat dat bijten?
1. In de editor meestal niet, dat is juist bedoeld.
2. Bij codegeneratie kan het wel bijten als je een puur np-loc package wilt zonder register-types.

Voor puur np-loc (zonder register) gebruik:
1. go run ./cmd/export_v3 --domein np-loc --strict > np-loc.v3.json
2. Daarna codegen op dat JSON-bestand.

Als je wilt, kan ik ook direct strict ondersteuning toevoegen op de API-route zelf, bijvoorbeeld:
- /api/schema/model/code?domein=np-loc&strict=true

Dan hoef je niet via de CLI-export tussenstap te werken.

---

## 🧑 User

die laatste optie met strict is een goede

---

## 🤖 Assistant

Ik ga  nu echt op de API implementeren voor zowel  als , met default gedrag ongewijzigd (`register` blijft alleen in niet-strict). Daarna werk ik de API docs bij en draai ik relevante tests.
```

```

```

```

```

```

```

```

```

```

```

```
Ik heb de strict-implementatie en tests toegevoegd; nu draai ik de relevante testsets en controleer ik het gedrag via  als runtime-check.Top, deze optie staat er nu in.

Wat ik heb toegevoegd:
1.  query parameter op schema endpoints:
- 
- 

2. Strict filtering op modelniveau:
- 

3. Strict filtering op platte  (zonder register-roots):
- 
- 

4. Documentatie bijgewerkt:
- 

5. Tests toegevoegd/gedraaid:
- 
- 
- Handler/model tests zijn groen.

Gebruik:
1. Inclusief register-basislaag (huidig default):

2. Strikt alleen np-loc entiteiten/types:
`/api/schema/model/code?domein=np-loc&strict=true`

Belangrijk detail:
1. In strict blijven datatypes bewust staan (zoals BSN/NLPostcode), ook al hebben die , omdat np-loc velden die gebruiken.
2. Land en Referentielijst vallen in strict wel weg uit entiteiten/types.

---

## 🧑 User

ik doe go run ./cmd/codegen --from-url http://localhost:8082/api/schema/model/25 --mode additive --domein np-loc --prefix np-loc --output _tmp_codegen_out/roundtrip2        

en krijg Gegenereerd: _tmp_codegen_out\roundtrip2\np-loc_modellen_input.go
Waarschuwing: gofmt van metaregistry.go mislukt: 7:12: expected '(', found '-' (and 10 more errors) (schrijf ongeformatteerd)
  Gegenereerd: _tmp_codegen_out\roundtrip2\np-loc_metaregistry.go      
Waarschuwing: gofmt van datatype_registry.go mislukt: 6:12: expected '(', found '-' (and 10 more errors) (schrijf ongeformatteerd)
  Gegenereerd: _tmp_codegen_out\roundtrip2\np-loc_datatype_registry.go 
Waarschuwing: gofmt van enum_registry.go mislukt: 7:12: expected '(', found '-' (and 9 more errors) (schrijf ongeformatteerd)
  Gegenereerd: _tmp_codegen_out\roundtrip2\np-loc_enum_registry.go     
Code generatie voltooid.

---

## 🤖 Assistant


```

```
Ik valideer nu dat de codegen compileert en draai exact jouw command opnieuw om te checken dat de gofmt-waarschuwingen met  weg zijn.Exact gevonden en opgelost.

Oorzaak:
1. Je gebruikte .
2. De generator gebruikte die prefix direct in functienamen.
3. Daardoor kreeg je ongeldige Go identifiers zoals `initNp-locMetaRegistry()`.
4. Daarom faalde gofmt met fouten als expected '(', found '-'.

Fix die ik heb gedaan:
1. Prefix wordt nu eerst opgeschoond naar een geldige identifier-part (niet-alfanumeriek → underscore).
2. Daarna pas omgezet naar PascalCase voor init-functies.
3. Resultaat:  wordt `NpLoc` in functienamen.

Gewijzigd in:
1. 

Validatie:
1. Jouw exacte command opnieuw gedraaid:
   `go run ./cmd/codegen --from-url http://localhost:8082/api/schema/model/25 --mode additive --domein np-loc --prefix np-loc --output _tmp_codegen_out/roundtrip2`
2. Geen gofmt-waarschuwingen meer.
3. Gegenereerde functies zijn nu geldig:
   - 
   - 
   - 

Als je wilt, kan ik nog een extra guard toevoegen die een waarschuwing print als prefix tekens bevat die worden genormaliseerd (zodat je meteen ziet dat  intern als `np_loc`/`NpLoc` wordt gebruikt).

---

## 🧑 User

ja graag

---

## 🧑 User

ik krijg nu opeens

Westbroek/Bitemporal_2026/bitemp_register_v06/model
model\np_loc_modellen_ge_rel.go:269:25: undefined: Referentielijst
model\metaregistry_plumbing.go:314:2: undefined: initRegisterMetaRegistry  
model\metaregistry_plumbing.go:315:2: undefined: initRegisterDatatypeRegistry
model\metaregistry_plumbing.go:316:2: undefined: initRegisterEnumRegistry  
PS D:\Git\Bitemporal_2026\bitemp_register_v06>

---

## 🧑 User

op go run ./cmd/codegen --from-url http://localhost:8082/api/schema/model/25 --mode additive --domein np-loc --prefix np-loc --output _tmp_codegen_out/roundtrip2

---

## 🤖 Assistant

Ik zie de oorzaak nu scherp: je np-loc codegen is additief, maar je actieve `model` mist de register-basisbestanden (`initRegister*` en `Referentielijst`). Ik ga nu de ontbrekende register-files uit de bestaande backup in `_tmp_codegen_out` terugzetten en daarna je exacte `go run ./cmd/codegen ...` commando opnieuw draaien.Ik heb bevestigd dat de register-bestanden wel in je backup staan maar niet in de actieve `model` map. Ik zet nu alleen de noodzakelijke `register_*.go` bestanden terug zodat de ontbrekende symbols weer bestaan, en test direct met jouw exacte codegen-command.

---

## 🧑 User

ik heb iets onhandigs gedaan met windows explorer en nu is de model backup map weg. Ik heb wel gecommit in github voor deze poging of de gegende files werken, dus de laatste versie uit git terughalen zou moeten helpen

---

## 🤖 Assistant

Helder, dan herstel ik alleen de map  vanaf de laatste git-versie, zonder andere mappen terug te draaien. Ik check eerst branch/status en zet daarna de map terug vanaf remote HEAD.Top, dan herstel ik nu die verwijderde register-bestanden direct vanuit origin/main en daarna draai ik jouw exacte codegen-commando opnieuw om te checken of het probleem weg is.De ontbrekende register-bestanden staan weer terug op HEAD-niveau. Ik draai nu je exacte codegen-command om te verifiëren dat de compile/symbol errors weg zijn.De restore is gelukt; het codegen faalt nu alleen nog omdat er geen API-server draait op 8082. Ik start de v06 API nu lokaal op, dan run ik meteen je command nogmaals.Status na herstel vanuit git/GitHub:

- De ontbrekende register-bestanden zijn teruggezet in de actieve v06-modelmap:
  - 
  - 
  - 
  - 
  - 
  - 
  - 

- Daarmee zijn de undefined-symbol issues opgelost (zoals Referentielijst en initRegister*).

- Je exacte codegen-run is daarna succesvol uitgevoerd tegen model 25 op poort 8082, met output in:
  - 

- Er staat nu nog een extra nieuw bestand in de working tree:
  - 

Als je wilt, doe ik direct een snelle go test run op v06 en/of ik ruim die model.rar op.

---
