// cmd/export_v3 exporteert de MetaRegistry naar V3 JSON.
// Gebruik: go run ./cmd/export_v3 --domein np-loc --strict > np-loc.v3.json
package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
)

func main() {
	domein := flag.String("domein", "", "Domein filter (bijv. np-loc)")
	strict := flag.Bool("strict", false, "Exporteer alleen het opgegeven domein (niet register etc.)")
	flag.Parse()

	var v3 model.V3Model
	if *domein != "" {
		v3 = model.ExportMetaRegistryToV3(*domein)
	} else {
		v3 = model.ExportMetaRegistryToV3()
	}

	// In strict-modus: verwijder entiteiten die niet tot het opgegeven domein behoren.
	// Dit is nodig omdat de exporter standaard register-domein entiteiten mee-exporteert.
	if *strict && *domein != "" {
		filtered := v3.Entiteiten[:0]
		for _, ent := range v3.Entiteiten {
			if meta, ok := model.MetaRegistry.GetTypeMeta(ent.Typenaam); ok {
				if meta.Domein == *domein {
					filtered = append(filtered, ent)
				}
			}
		}
		v3.Entiteiten = filtered

		// Verwijder ook enums die niet meer gerefereerd worden door de resterende entiteiten.
		usedEnums := map[string]bool{}
		for _, ent := range v3.Entiteiten {
			for _, ge := range ent.Gegevenselementen {
				for _, v := range ge.Velden {
					if v.Enum != "" {
						usedEnums[v.Enum] = true
					}
				}
			}
			for _, rel := range ent.Relaties {
				for _, v := range rel.Velden {
					if v.Enum != "" {
						usedEnums[v.Enum] = true
					}
				}
			}
		}
		filteredEnums := v3.Enums[:0]
		for _, e := range v3.Enums {
			if usedEnums[e.GoType] {
				filteredEnums = append(filteredEnums, e)
			}
		}
		v3.Enums = filteredEnums
	}

	enc := json.NewEncoder(os.Stdout)
	enc.SetIndent("", "  ")
	if err := enc.Encode(v3); err != nil {
		fmt.Fprintf(os.Stderr, "JSON encode error: %v\n", err)
		os.Exit(1)
	}
}
