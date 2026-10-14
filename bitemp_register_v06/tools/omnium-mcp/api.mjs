// api.mjs — een kleine client voor de Omnium-API met een persoonlijk token
// (Authorization: Bearer omt_…; maak er een in de Studio: Gebruikers → Mijn API-tokens).

export function maakApi({ basis = "http://localhost:8082", token = "", fetchFn = globalThis.fetch } = {}) {
  basis = String(basis).replace(/\/+$/, "");
  const kop = (extra = {}) => ({ ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra });

  async function roep(methode, pad, body) {
    const res = await fetchFn(basis + pad, {
      method: methode,
      headers: kop(body !== undefined ? { "Content-Type": "application/json" } : {}),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (res.status === 204) return null;
    const tekst = await res.text();
    let d = null;
    try { d = tekst ? JSON.parse(tekst) : null; } catch { /* geen JSON */ }
    if (!res.ok) {
      const reden = d?.error || (res.status === 401 ? "niet ingelogd: zet OMNIUM_TOKEN (Studio → Gebruikers → Mijn API-tokens)" : `HTTP ${res.status}`);
      throw new Error(reden);
    }
    return d;
  }

  return {
    basis,
    get: (pad) => roep("GET", pad),
    post: (pad, body) => roep("POST", pad, body),
    put: (pad, body) => roep("PUT", pad, body),
    /** Een bestand als base64, met het mediatype. */
    async bestand(pad) {
      const res = await fetchFn(basis + pad, { headers: kop() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      return { data: buf.toString("base64"), mimeType: (res.headers.get("content-type") || "application/octet-stream").split(";")[0] };
    },
  };
}
