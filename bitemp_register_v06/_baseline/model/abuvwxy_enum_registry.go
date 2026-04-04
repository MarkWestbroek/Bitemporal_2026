package model

// Additieve enum-registry entries voor het abuvwxy-basisdomein.

func initAbuvwxyEnumRegistry() {
	EnumWaarden["RelABSoort"] = []string{"LTT", "LAT", "LTA"}
	EnumDomeinen["RelABSoort"] = "abuvwxy"
	EnumWaarden["ABCEnum"] = []string{"Optie A", "Optie B", "Optie C"}
	EnumDomeinen["ABCEnum"] = "abuvwxy"
}
