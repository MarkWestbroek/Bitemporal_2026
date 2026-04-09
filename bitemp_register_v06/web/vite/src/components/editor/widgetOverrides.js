const CONFIG_JSON_WIDGETS = {
  FormulierDefinitie_Layout: {
    layout_json: "json",
  },
  WeergaveDefinitie_TabelConfig: {
    tabel_config_json: "json",
  },
  WeergaveDefinitie_DetailTemplate: {
    template_tekst: "markdown",
  },
};

export function bepaalWidgetOverride(typeMeta, veldNaam, explicieteWidget) {
  if (explicieteWidget) {
    return explicieteWidget;
  }

  const typeWidgets = CONFIG_JSON_WIDGETS[typeMeta?.typenaam];
  if (!typeWidgets || !veldNaam) {
    return null;
  }

  return typeWidgets[veldNaam] || null;
}