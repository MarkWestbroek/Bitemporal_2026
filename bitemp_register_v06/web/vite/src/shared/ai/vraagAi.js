/**
 * vraagAi.js — één vraag aan de AI-dienst van het actieve profiel (aiProfielen.js), één
 * antwoord terug als tekst. Niet streamend: voor korte teksten in een formulierveld.
 *
 *  - Claude: de officiële SDK (@anthropic-ai/sdk), rechtstreeks vanuit de browser met de eigen
 *    sleutel van de gebruiker (dangerouslyAllowBrowser: de sleutel is van de gebruiker zelf en
 *    blijft in diens browser). Pas geladen als hij nodig is (dynamic import). Met
 *    `fallbacks: "default"`: weigert het model een verzoek, dan probeert de API het zelf opnieuw
 *    met een ander model.
 *  - DeepSeek en de Omnium-proxy: OpenAI-compatibel (chat/completions).
 *
 * Fouten worden Nederlandse meldingen (AiFout), zodat het paneel ze direct kan tonen.
 */
import { endpointVoor } from "./aiProfielen.js";

export class AiFout extends Error {}

/** Modellen waarvoor we de server-side fallback bij een weigering aanzetten. */
const MET_FALLBACK = new Set(["claude-opus-5", "claude-fable-5-1"]);

/** Eerdere beurten ({ role: "user" | "assistant", content }) voor bijsturen in een gesprek. */
const beurten = (geschiedenis) => (Array.isArray(geschiedenis) ? geschiedenis.filter((b) => b && (b.role === "user" || b.role === "assistant") && b.content) : []);

async function vraagClaude(profiel, { systeem, vraag, signal, jsonSchema, effort = "low", geschiedenis }) {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: profiel.sleutel, dangerouslyAllowBrowser: true, maxRetries: 1 });
  const params = {
    model: profiel.model || "claude-opus-5",
    max_tokens: jsonSchema ? 8000 : 4000,
    system: systeem,
    messages: [...beurten(geschiedenis), { role: "user", content: vraag }],
    // Korte herschrijftaak: effort "low". Met een schema: structured outputs (gegarandeerd geldige JSON).
    output_config: { effort, ...(jsonSchema ? { format: { type: "json_schema", schema: jsonSchema } } : {}) },
  };
  let antwoord;
  try {
    antwoord = MET_FALLBACK.has(params.model)
      ? await client.beta.messages.create({ ...params, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" }, { signal })
      : await client.messages.create(params, { signal });
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) throw new AiFout("De Anthropic-sleutel is ongeldig. Controleer hem bij de AI-instellingen.");
    if (e instanceof Anthropic.PermissionDeniedError) throw new AiFout("Deze sleutel mag dit model niet gebruiken.");
    if (e instanceof Anthropic.RateLimitError) throw new AiFout("Te veel verzoeken bij Anthropic; probeer het over een minuut opnieuw.");
    if (e instanceof Anthropic.BadRequestError) throw new AiFout(`Claude weigerde het verzoek: ${e.message}`);
    if (e instanceof Anthropic.APIConnectionError) throw new AiFout("Geen verbinding met Anthropic.");
    if (e instanceof Anthropic.APIError) throw new AiFout(e.status === 529 ? "Claude is even overbelast; probeer het zo opnieuw." : `Fout bij Anthropic (${e.status}).`);
    throw e;
  }
  if (antwoord.stop_reason === "refusal") throw new AiFout("Claude wil hier niet aan meewerken.");
  const tekst = antwoord.content.filter((b) => b.type === "text").map((b) => b.text).join("").trim();
  if (!tekst) throw new AiFout("Leeg antwoord van Claude.");
  return { tekst, model: antwoord.model };
}

/** Diensten waarvan we weten dat ze response_format json_object ondersteunen. */
const JSON_MODUS = new Set(["deepseek", "alibaba", "server"]);

async function vraagOpenAI(profiel, { systeem, vraag, signal, baseUrl, jsonSchema, geschiedenis }) {
  let res;
  try {
    res = await fetch(endpointVoor(profiel, baseUrl), {
      method: "POST",
      signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${profiel.sleutel}` },
      body: JSON.stringify({
        model: profiel.model,
        messages: [{ role: "system", content: systeem }, ...beurten(geschiedenis), { role: "user", content: vraag }],
        ...(jsonSchema && JSON_MODUS.has(profiel.id) ? { response_format: { type: "json_object" } } : {}),
      }),
    });
  } catch (e) {
    if (e?.name === "AbortError") throw e;
    // Een netwerkfout zonder status is vaak CORS: de dienst staat geen aanroepen vanuit de browser toe.
    throw new AiFout(profiel.id === "server"
      ? "De AI-proxy van deze server is niet bereikbaar."
      : "De AI-dienst is niet bereikbaar vanuit de browser. Klopt het endpoint? Staat de dienst geen browseraanroepen toe (CORS), zet hem dan achter de Omnium-proxy (AI_UPSTREAM_URL) en gebruik een toegangscode.");
  }
  const d = await res.json().catch(() => ({}));
  if (!res.ok) {
    const bericht = d?.error?.message || `status ${res.status}`;
    if (res.status === 401) throw new AiFout(profiel.id === "server" ? `Toegangscode: ${bericht}` : "De sleutel is ongeldig.");
    if (res.status === 429) throw new AiFout(bericht);
    throw new AiFout(`Fout bij de AI-dienst: ${bericht}`);
  }
  const tekst = String(d?.choices?.[0]?.message?.content || "").trim();
  if (!tekst) throw new AiFout("Leeg antwoord van de AI-dienst.");
  return { tekst, model: d.model || profiel.model };
}

/**
 * @param {object} opties  systeem, vraag, signal, baseUrl; jsonSchema (optioneel: antwoord als JSON
 *   volgens dit schema — Claude via structured outputs, anders JSON-modus); effort (Claude).
 * @returns {Promise<{ tekst: string, model: string }>}
 */
export function vraagAi(profiel, { systeem, vraag, signal, baseUrl = "", jsonSchema = null, effort, geschiedenis = [] }) {
  if (!profiel) return Promise.reject(new AiFout("Er is nog geen AI ingesteld."));
  return profiel.provider === "anthropic"
    ? vraagClaude(profiel, { systeem, vraag, signal, jsonSchema, geschiedenis, ...(effort ? { effort } : {}) })
    : vraagOpenAI(profiel, { systeem, vraag, signal, baseUrl, jsonSchema, geschiedenis });
}

/**
 * De modellen die de dienst zelf aanbiedt, zodat je een submodel kiest zonder namen te raden.
 * Claude: models.list() (SDK, pagineert vanzelf). OpenAI-compatibel: GET …/models naast het
 * chat/completions-endpoint. De Omnium-proxy: geen lijst (de server kiest het model).
 * @returns {Promise<Array<{ id: string, naam: string }>>}
 */
export async function haalModellen(profiel, { baseUrl = "", signal } = {}) {
  if (!profiel || !String(profiel.sleutel || "").trim()) throw new AiFout("Vul eerst een sleutel in.");
  if (profiel.id === "server") return [];
  if (profiel.provider === "anthropic") {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey: profiel.sleutel, dangerouslyAllowBrowser: true, maxRetries: 1 });
    const uit = [];
    try {
      for await (const m of client.models.list({}, { signal })) uit.push({ id: m.id, naam: m.display_name || m.id });
    } catch (e) {
      if (e instanceof Anthropic.AuthenticationError) throw new AiFout("De Anthropic-sleutel is ongeldig.");
      throw new AiFout(`Modellen ophalen bij Anthropic mislukt: ${e?.message || e}`);
    }
    return uit;
  }
  const url = endpointVoor(profiel, baseUrl).replace(/\/chat\/completions\/?$/, "/models");
  let res;
  try {
    res = await fetch(url, { signal, headers: { Authorization: `Bearer ${profiel.sleutel}` } });
  } catch (e) {
    if (e?.name === "AbortError") throw e;
    throw new AiFout("De modellenlijst is niet bereikbaar vanuit de browser.");
  }
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new AiFout(res.status === 401 ? "De sleutel is ongeldig." : `Modellen ophalen mislukt: ${d?.error?.message || res.status}`);
  return (Array.isArray(d?.data) ? d.data : []).map((m) => ({ id: String(m.id), naam: String(m.id) })).sort((a, b) => a.id.localeCompare(b.id));
}
