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

async function vraagClaude(profiel, { systeem, vraag, signal }) {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: profiel.sleutel, dangerouslyAllowBrowser: true, maxRetries: 1 });
  const params = {
    model: profiel.model || "claude-opus-5",
    max_tokens: 4000,
    system: systeem,
    messages: [{ role: "user", content: vraag }],
    output_config: { effort: "low" }, // korte herschrijftaak: snel
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

async function vraagOpenAI(profiel, { systeem, vraag, signal, baseUrl }) {
  let res;
  try {
    res = await fetch(endpointVoor(profiel, baseUrl), {
      method: "POST",
      signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${profiel.sleutel}` },
      body: JSON.stringify({ model: profiel.model, messages: [{ role: "system", content: systeem }, { role: "user", content: vraag }] }),
    });
  } catch (e) {
    if (e?.name === "AbortError") throw e;
    throw new AiFout("De AI-dienst is niet bereikbaar.");
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

/** @returns {Promise<{ tekst: string, model: string }>} */
export function vraagAi(profiel, { systeem, vraag, signal, baseUrl = "" }) {
  if (!profiel) return Promise.reject(new AiFout("Er is nog geen AI ingesteld."));
  return profiel.provider === "anthropic" ? vraagClaude(profiel, { systeem, vraag, signal }) : vraagOpenAI(profiel, { systeem, vraag, signal, baseUrl });
}
