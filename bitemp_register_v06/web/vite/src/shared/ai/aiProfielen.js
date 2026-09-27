/**
 * aiProfielen.js — met welke AI-dienst Omnium praat, per browser (naar het voorbeeld van de
 * MusicBrain-editor, recipe/llm.ts). Puur, op een meegegeven opslag (localStorage in de app).
 *
 * Drie soorten profielen:
 *  - Claude       eigen sleutel ("bring your own key"), rechtstreeks vanuit de browser (SDK);
 *  - DeepSeek     eigen sleutel, OpenAI-compatibel, rechtstreeks vanuit de browser;
 *  - Alibaba Model Studio en "andere OpenAI-compatibele dienst": eigen sleutel én eigen
 *                 endpoint (bij Alibaba hangt dat af van regio en workspace; een sleutel werkt
 *                 alleen in zijn eigen regio). Staat de dienst geen browseraanroepen toe (CORS),
 *                 zet hem dan achter de proxy (AI_UPSTREAM_URL) en gebruik een toegangscode;
 *  - Omnium-server  een TOEGANGSCODE voor de proxy op deze server (handlers/ai_proxy.go), die de
 *                 sleutel van de eigenaar gebruikt. De code gaat in hetzelfde veld als een sleutel.
 *
 * De sleutel staat in de browser (localStorage) en gaat alleen naar de gekozen dienst. Een eigen
 * sleutel is dus zo veilig als de pagina: geef hem niet op een gedeelde computer.
 */

export const OPSLAGSLEUTEL = "omnium.ai.v1";

export const PRESETS = [
  { id: "claude", label: "Claude (eigen sleutel)", provider: "anthropic", endpoint: "", model: "claude-opus-5", sleutelLabel: "Anthropic API-sleutel" },
  { id: "deepseek", label: "DeepSeek (eigen sleutel)", provider: "openai", endpoint: "https://api.deepseek.com/chat/completions", model: "deepseek-chat", sleutelLabel: "DeepSeek API-sleutel" },
  { id: "alibaba", label: "Alibaba Model Studio (eigen sleutel)", provider: "openai", endpoint: "", model: "qwen-plus", sleutelLabel: "Model Studio API-sleutel",
    endpointInvullen: true, endpointVoorbeeld: "https://<WorkspaceId>.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1/chat/completions" },
  { id: "openai-compatibel", label: "Andere OpenAI-compatibele dienst", provider: "openai", endpoint: "", model: "", sleutelLabel: "API-sleutel",
    endpointInvullen: true, endpointVoorbeeld: "https://…/v1/chat/completions" },
  { id: "server", label: "Omnium-server (toegangscode)", provider: "openai", endpoint: "/ai/v1/chat/completions", model: "deepseek-chat", sleutelLabel: "Toegangscode" },
];

const leeg = () => ({ actief: "", profielen: [] });

/** Instellingen lezen; een onleesbare of ontbrekende opslag geeft lege instellingen. */
export function leesInstellingen(opslag) {
  try {
    const ruw = opslag?.getItem(OPSLAGSLEUTEL);
    if (!ruw) return leeg();
    const d = JSON.parse(ruw);
    return { actief: String(d.actief || ""), profielen: Array.isArray(d.profielen) ? d.profielen : [] };
  } catch {
    return leeg();
  }
}

export function bewaarInstellingen(opslag, instellingen) {
  try {
    opslag?.setItem(OPSLAGSLEUTEL, JSON.stringify(instellingen));
    return true;
  } catch {
    return false;
  }
}

/** Een profiel bijwerken of toevoegen (op preset-id) en actief maken. */
export function zetProfiel(instellingen, presetId, { sleutel, model, endpoint } = {}) {
  const preset = PRESETS.find((p) => p.id === presetId);
  if (!preset) return instellingen;
  const bestaand = instellingen.profielen.find((p) => p.id === presetId) || {};
  const profiel = { ...preset, ...bestaand, sleutel: sleutel ?? bestaand.sleutel ?? "", model: model || bestaand.model || preset.model,
    // Een vast endpoint komt altijd uit de preset; alleen bij endpointInvullen telt wat de gebruiker gaf.
    endpoint: preset.endpointInvullen ? String(endpoint ?? bestaand.endpoint ?? "").trim() : preset.endpoint };
  return { actief: presetId, profielen: [...instellingen.profielen.filter((p) => p.id !== presetId), profiel] };
}

/** Het actieve profiel met een sleutel, of null (dan is AI nog niet ingesteld). */
export function actiefProfiel(instellingen) {
  const p = instellingen.profielen.find((x) => x.id === instellingen.actief);
  if (!p || !String(p.sleutel || "").trim()) return null;
  if (PRESETS.find((x) => x.id === p.id)?.endpointInvullen && !/^https:\/\//.test(String(p.endpoint || ""))) return null;
  return p;
}

/** Het endpoint als volle URL: een pad (de proxy) hangt aan de API-basis. */
export function endpointVoor(profiel, baseUrl = "") {
  const e = String(profiel?.endpoint || "");
  return e.startsWith("/") ? `${String(baseUrl).replace(/\/$/, "")}${e}` : e;
}
