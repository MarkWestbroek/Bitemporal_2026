// 04-realisatie-ops.mjs — het diagram "Capabilities gerealiseerd door componenten" als operaties:
// bestaande ArchiMate-elementen uit twee mappen op één nieuw diagram, met realisatie-connectoren.
// Het plan-mechanisme (model_wijzigen) kent `bestaand` alleen binnen de doelmap; daarom rechtstreeks.
//
//   node docs/architectuur/plannen/04-realisatie-ops.mjs <basis> <token-env> [projectnaam]
//   (vanuit bitemp_register_v06/; de element-ids zijn die van de plannen 01 en 02)
import { maakApi } from "../../../tools/omnium-mcp/api.mjs";
import { zoekProject, leesProject } from "../../../tools/omnium-mcp/model.mjs";

const [basis, tokenEnv, projectNaam = "Omnium architectuur"] = process.argv.slice(2);
const token = process.env[tokenEnv] || "";
if (!basis || !token) {
  console.error("gebruik: node 04-realisatie-ops.mjs <basis> <token-env> [projectnaam]");
  process.exit(2);
}
const api = maakApi({ basis, token });
const p = await zoekProject(api, projectNaam);
const proj = await leesProject(api, p.id);
const mapCaps = Object.values(proj.mappen).find((m) => m.naam === "1 Capabilities");
if (!mapCaps) throw new Error('map "1 Capabilities" niet gevonden');
const diagramId = "mcp_diagram_capabilities_gerealiseerd_door_componenten";
if (proj.profielen.archimate05?.diagrams?.[diagramId]) {
  console.log("diagram bestaat al; niets gedaan");
  process.exit(0);
}

const caps = [
  "mcp_modelleren_profielgedreven_m3_m2_m1", "mcp_bitemporeel_registreren", "mcp_tijdreizen_en_lezen_op_t",
  "mcp_genereren_codegen_runtime_projectie_m1_m", "mcp_transformeren_tussen_notaties", "mcp_importeren_uit_sparx_ea",
  "mcp_samenwerken_projectsync_live", "mcp_toegang_en_beleid_pap_pdp_pep", "mcp_notificeren_cloudevents",
  "mcp_ai_hulp_assistent_mcp_proxy", "mcp_renderen_van_diagrammen_svg_voor_imprint", "mcp_melden_bugs_wensen_vragen",
];
const comps = [
  "mcp_omnium_studio_react_vite_zustand_react_f", "mcp_diagrammotor_diagramcore_m3_typecontract", "mcp_profielen_m2_descriptors_adapters",
  "mcp_registratie_engine_bitemporeel_schrijven", "mcp_metaregistry_typemeta_per_representatiet", "mcp_dynql_graphql_uit_de_metaregistry",
  "mcp_codegen_en_export_v3_v3_go", "mcp_transformatielaag_lezer_regelset_toepass", "mcp_ea_lezer_qea_browser_en_sidecar",
  "mcp_projectsync_client_operaties_outbox_verz", "mcp_studio_projecten_en_operatielog_sse_hub", "mcp_toegangsspraak_pap_beleid_als_m1",
  "mcp_pdp_beleidsbundel_uitvoerder", "mcp_pep_snoeit_paden_op_route_veld_schrijfpa", "mcp_notificaties_cloudevents_webhook_e_mail",
  "mcp_modelassistent_assistentkern", "mcp_ai_proxy_toegangscodes_lees_url", "mcp_mcp_server_tools_omnium_mcp",
  "mcp_render_svc_node_sidecar_diagramsvg", "mcp_meldingen_domein_api",
];
const real = [
  ["mcp_diagrammotor_diagramcore_m3_typecontract", "mcp_modelleren_profielgedreven_m3_m2_m1"],
  ["mcp_profielen_m2_descriptors_adapters", "mcp_modelleren_profielgedreven_m3_m2_m1"],
  ["mcp_omnium_studio_react_vite_zustand_react_f", "mcp_modelleren_profielgedreven_m3_m2_m1"],
  ["mcp_registratie_engine_bitemporeel_schrijven", "mcp_bitemporeel_registreren"],
  ["mcp_metaregistry_typemeta_per_representatiet", "mcp_bitemporeel_registreren"],
  ["mcp_dynql_graphql_uit_de_metaregistry", "mcp_tijdreizen_en_lezen_op_t"],
  ["mcp_metaregistry_typemeta_per_representatiet", "mcp_tijdreizen_en_lezen_op_t"],
  ["mcp_codegen_en_export_v3_v3_go", "mcp_genereren_codegen_runtime_projectie_m1_m"],
  ["mcp_metaregistry_typemeta_per_representatiet", "mcp_genereren_codegen_runtime_projectie_m1_m"],
  ["mcp_transformatielaag_lezer_regelset_toepass", "mcp_transformeren_tussen_notaties"],
  ["mcp_ea_lezer_qea_browser_en_sidecar", "mcp_importeren_uit_sparx_ea"],
  ["mcp_projectsync_client_operaties_outbox_verz", "mcp_samenwerken_projectsync_live"],
  ["mcp_studio_projecten_en_operatielog_sse_hub", "mcp_samenwerken_projectsync_live"],
  ["mcp_toegangsspraak_pap_beleid_als_m1", "mcp_toegang_en_beleid_pap_pdp_pep"],
  ["mcp_pdp_beleidsbundel_uitvoerder", "mcp_toegang_en_beleid_pap_pdp_pep"],
  ["mcp_pep_snoeit_paden_op_route_veld_schrijfpa", "mcp_toegang_en_beleid_pap_pdp_pep"],
  ["mcp_notificaties_cloudevents_webhook_e_mail", "mcp_notificeren_cloudevents"],
  ["mcp_modelassistent_assistentkern", "mcp_ai_hulp_assistent_mcp_proxy"],
  ["mcp_ai_proxy_toegangscodes_lees_url", "mcp_ai_hulp_assistent_mcp_proxy"],
  ["mcp_mcp_server_tools_omnium_mcp", "mcp_ai_hulp_assistent_mcp_proxy"],
  ["mcp_render_svc_node_sidecar_diagramsvg", "mcp_renderen_van_diagrammen_svg_voor_imprint"],
  ["mcp_meldingen_domein_api", "mcp_melden_bugs_wensen_vragen"],
];
const bekend = proj.profielen.archimate05?.elements || {};
const ontbreekt = [...caps, ...comps].filter((id) => !bekend[id]);
if (ontbreekt.length) throw new Error("elementen ontbreken in het project: " + ontbreekt.join(", "));

const nodes = [];
caps.forEach((id, i) => nodes.push({ elementId: id, position: { x: 40 + i * 200, y: 40 }, size: { width: 170, height: 70 } }));
const volgorde = [];
for (const c of caps) for (const [comp, cap] of real) if (cap === c && !volgorde.includes(comp)) volgorde.push(comp);
for (const comp of comps) if (!volgorde.includes(comp)) volgorde.push(comp);
volgorde.forEach((id, i) => nodes.push({ elementId: id, position: { x: 40 + (i % 10) * 240, y: 280 + Math.floor(i / 10) * 140 }, size: { width: 200, height: 70 } }));
const elementen = {};
for (const [comp, cap] of real) {
  const id = `mcp_realisatie_${comp.slice(4, 24)}_${cap.slice(4, 24)}`;
  elementen[id] = { id, naam: "", source: comp, target: cap, elementType: "realisatie", data: {}, compartimenten: [] };
}
const ops = [
  { lokaalNr: 1, store: "model:archimate05", op: "patchElementen", args: [{ wis: [], zet: elementen }] },
  { lokaalNr: 2, store: "model:archimate05", op: "patchDiagrammen", args: [{ wis: [], zet: { [diagramId]: { id: diagramId, naam: "Capabilities gerealiseerd door componenten", edges: [], nodes } } }] },
  { lokaalNr: 3, store: "structuur", op: "plaatsPerMap", args: [{ [mapCaps.id]: [`archimate05::${diagramId}`] }] },
];
const uit = await api.post(`/api/studio/projecten/${encodeURIComponent(p.id)}/ops`, { clientId: "arch-claude", ops });
console.log("realisatie-view geplaatst:", JSON.stringify(uit));
