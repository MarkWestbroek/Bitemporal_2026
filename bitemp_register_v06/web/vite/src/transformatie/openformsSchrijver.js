// @ts-check
/**
 * openformsSchrijver — **schrijver**: plan → Open Formulieren-export.
 *
 * Laatste stap van een transformatie (docs/TRANSFORMATIES.md §3). Kent alleen
 * het exportformaat van Open Formulieren (4.0.3; golden file van FUNDAMENT in
 * CG-Fundament `docs/voorbeelden/openforms-export-aanvraag/`): de bestanden
 * `forms.json`, `formDefinitions.json`, `formSteps.json`, `formLogic.json`,
 * `formVariables.json` en `_meta.json`. Uitvoer is één JSON-object
 * {bestandsnaam: inhoud} — de payload die de uitrol-adapter van FUNDAMENT
 * aanneemt (RUNBOOK stap 14) en waarover de hash (JCS) gaat.
 *
 * Planvocabulaire:
 *
 *   element.type  "formulier" — precies één; naam → name, data.slug,
 *                               data.inloggen (lijst authenticatie-plugins)
 *                 "stap"      — een stap (formulierstap + definitie), in planvolgorde
 *                 "component" — een Form.io-component in een stap; data:
 *                               type, key, label, hulptekst, verplicht +
 *                               valideerVerplicht, maxLength, pattern, waarden,
 *                               conditional
 *
 * Een export bevat uuid's en url's. De schrijver krijgt ze van `uuidVoor`
 * (deterministisch, uit de identifier afgeleid), zodat dezelfde invoer
 * dezelfde bytes en dus dezelfde hash geeft. De url's volgen het patroon van
 * de export (`http://openforms/api/v2/…`): de import gebruikt ze alleen om
 * stappen aan definities te koppelen.
 *
 * **Inloggen.** In Open Formulieren is "inloggen verplicht" een eigenschap van
 * de formulierdefinities (Form.loginRequired is daarvan afgeleid): bij
 * `inloggen` staat `login_required` op de eerste stap.
 *
 * **Registratie naar Open Object** (`opties.registratie`, afgeleid uit de trace
 * van het objecttype): een `objects_api`-backend versie 2 met per component een
 * `variables_mapping` (key → padsegmenten in het object), vaste waarden als
 * gebruikersvariabelen (formVariables.json) met hun eigen mapping, en het pad
 * voor de BSN uit de inlog (`auth_attribute_path`). Wat per omgeving verschilt,
 * staat er als plaatshouder (afspraak FUNDAMENT 27-10), de uitrol-adapter vult
 * in: `${OBJECTTYPE_URL:<identifier>}`, `${OBJECTTYPE_VERSION:<identifier>}`
 * en `${OBJECTS_API_GROUP}`. Zo blijft het artefact omgevingsvrij.
 *
 * Nog niet: formulierlogica anders dan tonen-als; zie §11.6. Puur.
 */

export const OF_RELEASE = "4.0.3";
const BASIS_URL = "http://openforms/api/v2";

const isLeeg = (w) => w === undefined || w === null || w === "" || (Array.isArray(w) && w.length === 0);
const zonderLeeg = (o) => Object.fromEntries(Object.entries(o).filter(([, w]) => !isLeeg(w) && !(typeof w === "object" && !Array.isArray(w) && Object.keys(w).length === 0)));

const LITERAL = (resolved) => ({ resolved, value: "" });
const STAP_LITERALS = { previous_text: LITERAL("Previous page"), save_text: LITERAL("Save current information"), next_text: LITERAL("Next") };
const STAP_VERTALINGEN = { nl: { previous_text: "", save_text: "", next_text: "" }, en: { previous_text: "", save_text: "", next_text: "" } };

/** Eén Form.io-component uit een plan-element. */
function component(el) {
  const d = el.data || {};
  const validate = zonderLeeg({
    required: d.valideerVerplicht === true ? d.verplicht === true : undefined,
    maxLength: typeof d.maxLength === "number" ? d.maxLength : undefined,
    pattern: d.pattern,
  });
  const waarden = Array.isArray(d.waarden) ? d.waarden : [];
  return zonderLeeg({
    key: d.key || el.naam,
    type: d.type,
    input: true,
    label: d.label,
    description: d.hulptekst,
    // select: keuzes onder data.values; radio: direct onder values (Form.io).
    data: d.type === "select" ? { values: waarden } : undefined,
    dataSrc: d.type === "select" ? "values" : undefined,
    values: d.type === "radio" ? waarden : undefined,
    validate,
    conditional: d.conditional && typeof d.conditional === "object" ? d.conditional : undefined,
  });
}

/**
 * @typedef {Object} Registratie
 * @property {string} objecttype                         - identifier van het objecttype-artefact
 * @property {{variable_key: string, target_path: (string|number)[]}[]} mapping - componenten
 * @property {{key: string, waarde: any, target_path: (string|number)[]}[]} vast - vaste waarden
 * @property {(string|number)[]|null} authPad            - waar de BSN uit de inlog landt
 */

/** Gebruikersvariabele voor een vaste waarde, zoals Open Formulieren hem exporteert. */
const vasteVariabele = (formUrl, v) => ({
  form: formUrl,
  form_definition: null,
  name: v.key,
  key: v.key,
  source: "user_defined",
  service_fetch_configuration: null,
  prefill_plugin: "",
  prefill_attribute: "",
  prefill_identifier_role: "main",
  prefill_options: {},
  data_type: typeof v.waarde === "boolean" ? "boolean" : typeof v.waarde === "number" ? "float" : "string",
  data_format: "",
  is_sensitive_data: false,
  initial_value: v.waarde,
});

/** De registratie-backend naar Open Object (Objects API, versie 2). */
const objectsApiBackend = (r) => ({
  key: "objects_api",
  name: "Open Object",
  backend: "objects_api",
  options: {
    version: 2,
    objects_api_group: "${OBJECTS_API_GROUP}",
    objecttype: `\${OBJECTTYPE_URL:${r.objecttype}}`,
    objecttype_version: `\${OBJECTTYPE_VERSION:${r.objecttype}}`,
    update_existing_object: false,
    auth_attribute_path: r.authPad || [],
    variables_mapping: [...r.mapping, ...r.vast.map((v) => ({ variable_key: v.key, target_path: v.target_path }))],
  },
});

/**
 * @param {{elementen: any[]}} plan
 * @param {{uuidVoor: (deel: string) => string, ofRelease?: string, registratie?: Registratie|null}} opties
 * @returns {{bestanden: Record<string, any>|null, paden: Map<string, string>, diagnostics: any[]}}
 */
export function planNaarOpenforms(plan, { uuidVoor, ofRelease = OF_RELEASE, registratie = null }) {
  const diagnostics = [];
  const paden = new Map();
  const formulieren = plan.elementen.filter((el) => el.type === "formulier");
  if (formulieren.length !== 1) {
    diagnostics.push({ severity: "error", code: "OFS-FORMULIER", message: `Verwacht precies één formulier-element, gevonden: ${formulieren.length}`, sourceId: null, path: null });
    return { bestanden: null, paden, diagnostics };
  }
  const formulier = formulieren[0];
  const slug = formulier.data?.slug || formulier.naam;
  const formUuid = uuidVoor("formulier");
  const formUrl = `${BASIS_URL}/forms/${formUuid}`;
  paden.set(formulier.sleutel, "/forms.json/0");

  const inloggen = Array.isArray(formulier.data?.inloggen) ? formulier.data.inloggen : [];
  const stappen = plan.elementen.filter((el) => el.type === "stap" && el.groep === formulier.sleutel);
  const keys = new Set();
  const definities = [];
  const formStappen = [];
  const stapVerwijzingen = [];
  stappen.forEach((stap, index) => {
    const stapSlug = stap.data?.slug || stap.naam;
    const stapUuid = uuidVoor(`stap:${stapSlug}`);
    const defUuid = uuidVoor(`definitie:${stapSlug}`);
    const defUrl = `${BASIS_URL}/form-definitions/${defUuid}`;
    const stapUrl = `${formUrl}/steps/${stapUuid}`;
    const components = [];
    for (const el of plan.elementen.filter((e) => e.type === "component" && e.groep === stap.sleutel)) {
      const c = component(el);
      if (keys.has(c.key)) {
        diagnostics.push({ severity: "error", code: "OFS-DUBBEL", message: `Component-key "${c.key}" komt twee keer voor in het formulier`, sourceId: el.sleutel, path: null });
        continue;
      }
      keys.add(c.key);
      paden.set(el.sleutel, `/formDefinitions.json/${index}/configuration/components/${components.length}`);
      components.push(c);
    }
    paden.set(stap.sleutel, `/formSteps.json/${index}`);
    const configuration = { display: "form", components };
    // Inloggen verplicht zit op de definitie; de eerste stap volstaat.
    const loginRequired = inloggen.length > 0 && index === 0;
    definities.push({
      url: defUrl,
      uuid: defUuid,
      name: stap.naam,
      internal_name: "",
      slug: stapSlug,
      configuration,
      login_required: loginRequired,
      is_reusable: false,
      translations: { nl: { name: stap.naam }, en: { name: "" } },
    });
    formStappen.push({
      uuid: stapUuid,
      index,
      slug: stapSlug,
      configuration,
      form_definition: defUrl,
      name: stap.naam,
      internal_name: "",
      url: stapUrl,
      is_applicable: true,
      login_required: loginRequired,
      is_reusable: false,
      literals: STAP_LITERALS,
      translations: STAP_VERTALINGEN,
    });
    stapVerwijzingen.push({ uuid: stapUuid, slug: stapSlug, form_definition: stap.naam, index, literals: STAP_LITERALS, url: stapUrl, is_applicable: true });
  });

  if (registratie) {
    registratie.mapping.forEach((m, i) => {
      if (!keys.has(m.variable_key)) diagnostics.push({ severity: "warning", code: "OFS-MAPPING", message: `Mapping voor onbekende component "${m.variable_key}"`, sourceId: null, path: null });
      paden.set(`mapping:${m.variable_key}`, `/forms.json/0/registration_backends/0/options/variables_mapping/${i}`);
    });
    registratie.vast.forEach((v, i) => paden.set(`vast:${v.key}`, `/formVariables.json/${i}`));
    if (registratie.authPad) paden.set("auth", "/forms.json/0/registration_backends/0/options/auth_attribute_path");
  }
  const forms = [
    {
      ...FORMULIER_STANDAARD,
      uuid: formUuid,
      name: formulier.naam,
      internal_name: slug,
      login_required: inloggen.length > 0,
      auth_backends: inloggen.map((backend) => ({ backend, options: {} })),
      slug,
      url: formUrl,
      registration_backends: registratie ? [objectsApiBackend(registratie)] : [],
      steps: stapVerwijzingen,
      translations: { nl: { ...VERTALING_LEEG, name: formulier.naam }, en: { ...VERTALING_LEEG } },
    },
  ];

  return {
    bestanden: {
      "_meta.json": { of_release: ofRelease },
      "formDefinitions.json": definities,
      "formLogic.json": [],
      "formSteps.json": formStappen,
      "formVariables.json": registratie ? registratie.vast.map((v) => vasteVariabele(formUrl, v)) : [],
      "forms.json": forms,
    },
    paden,
    diagnostics,
  };
}

const VERTALING_LEEG = {
  name: "",
  submission_confirmation_template: "",
  begin_text: "",
  previous_text: "",
  change_text: "",
  confirm_text: "",
  introduction_page_content: "",
  explanation_template: "",
  help_dialog_content: "",
};

/** De standaardwaarden van een formulier, zoals Open Formulieren 4.0.3 ze exporteert. */
const FORMULIER_STANDAARD = {
  internal_remarks: "",
  translation_enabled: false,
  registration_backends: [],
  auto_login_authentication_backend: "",
  payment_required: false,
  payment_backend: "",
  payment_backend_options: {},
  price_variable_key: "",
  appointment_options: { supports_multiple_products: null },
  literals: { previous_text: LITERAL("Previous page"), begin_text: LITERAL("Begin form"), change_text: LITERAL("Change"), confirm_text: LITERAL("Confirm") },
  product: null,
  type: "regular",
  category: null,
  theme: null,
  show_progress_indicator: true,
  show_summary_progress: false,
  maintenance_mode: false,
  active: true,
  activate_on: null,
  deactivate_on: null,
  is_deleted: false,
  submission_confirmation_template: "",
  introduction_page_content: "",
  explanation_template: "",
  submission_allowed: "yes",
  submission_limit: null,
  submission_counter: 0,
  submission_limit_reached: false,
  suspension_allowed: true,
  ask_privacy_consent: "global_setting",
  ask_statement_of_truth: "global_setting",
  submissions_removal_options: {
    successful_submissions_removal_limit: null,
    successful_submissions_removal_method: "",
    incomplete_submissions_removal_limit: null,
    incomplete_submissions_removal_method: "",
    errored_submissions_removal_limit: null,
    errored_submissions_removal_method: "",
    all_submissions_removal_limit: null,
  },
  confirmation_email_template: null,
  send_confirmation_email: true,
  display_main_website_link: true,
  include_confirmation_page_content_in_pdf: true,
  required_fields_with_asterisk: true,
  communication_preferences_portal_url: "",
  resume_link_lifetime: 7,
  hide_non_applicable_steps: false,
  cosign_login_options: [],
  cosign_has_link_in_email: true,
  submission_statements_configuration: [
    { key: "privacyPolicyAccepted", label: "Yes, I have read the  and explicitly agree to the processing of my submitted information.", validate: { required: true }, type: "checkbox" },
    { key: "statementOfTruthAccepted", label: "I declare that I have filled out the form truthfully and have not omitted any information.", validate: { required: false }, type: "checkbox" },
  ],
  submission_report_download_link_title: "Download PDF",
  brp_personen_request_options: null,
  help_callout_page: { display: "never", content: "", image: null },
  help_dialog: { content: "", image: null },
};
