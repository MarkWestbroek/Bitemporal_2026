import { useState, useEffect, useMemo } from "react";
import { useParams, Link } from "react-router";
import { useSchema } from "../context/SchemaContext";
import { useWeergaveDefinitie } from "../hooks/useWeergaveDefinitie";
import { safeArray, platSlaHubItems } from "../shared/schemaUtils";

/**
 * Resolvet een veldpad (bijv. "Naam.roepnaam") naar een waarde uit een CEL-context.
 */
function resolveVeldpadUitContext(ctx, veldpad) {
  if (!ctx || !veldpad) return null;
  const delen = veldpad.split(".");
  let huidig = ctx;
  for (const deel of delen) {
    if (huidig == null || typeof huidig !== "object") return null;
    huidig = huidig[deel];
  }
  return huidig ?? null;
}

/**
 * Vervangt alle {{veldpad}} placeholders in een template met waarden uit de CEL-context.
 * HTML-escaped de ingevoegde waarden om XSS te voorkomen.
 */
function renderTemplate(template, ctx) {
  if (!template) return "";
  return template.replace(/\{\{([^}]+)\}\}/g, (_, veldpad) => {
    const waarde = resolveVeldpadUitContext(ctx, veldpad.trim());
    if (waarde == null) return "";
    return escapeHtml(String(waarde));
  });
}

/** Escaped een string voor veilige HTML-weergave. */
function escapeHtml(tekst) {
  const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return tekst.replace(/[&<>"']/g, (c) => map[c]);
}

/**
 * Simpele Markdown-naar-HTML converter voor de meest voorkomende patronen.
 * Geen externe dependency; bewust beperkt tot veilige subset.
 */
function markdownNaarHtml(md) {
  let html = escapeHtml(md);

  // Headers: # t/m ###
  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");

  // Bold: **tekst**
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

  // Italic: *tekst*
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");

  // Opsommingslijst: - item
  html = html.replace(/^- (.+)$/gm, "<li>$1</li>");
  html = html.replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`);

  // Paragrafen: dubbele newlines → <p>
  html = html
    .split(/\n\n+/)
    .map((blok) => {
      const trimmed = blok.trim();
      if (!trimmed) return "";
      if (/^<(h[1-3]|ul|ol|li)/.test(trimmed)) return trimmed;
      return `<p>${trimmed}</p>`;
    })
    .join("\n");

  // Enkele newlines binnen paragrafen → <br>
  html = html.replace(/([^>\n])\n([^<\n])/g, "$1<br>\n$2");

  return html;
}

/**
 * PublicatieDetail — read-only detailpagina voor een entiteit, gerenderd via
 * een WeergaveDefinitie template met {{veldpad}} inserts.
 *
 * Als er geen detailTemplate is, wordt een fallback getoond met alle GE-velden.
 */
export default function PublicatieDetail() {
  const { typePad, id } = useParams();
  const { baseUrl, allTypes: types, typeMetaByTypenaam } = useSchema();

  const typeMeta = useMemo(() => {
    return (types || []).find(
      (t) => (t.padnaam || t.meervoud || t.veldnaam) === typePad && t.metatype === "entiteit"
    );
  }, [types, typePad]);

  const { detailTemplate, loading: wdLoading, error: wdError } =
    useWeergaveDefinitie(typeMeta?.typenaam);

  const [entity, setEntity] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const apiPath = typeMeta?.padnaam || typeMeta?.meervoud || typeMeta?.veldnaam;

  // Haal de full entity op
  useEffect(() => {
    if (!apiPath || !baseUrl || !id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`${baseUrl}/full/${apiPath}/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => {
        if (!cancelled) {
          setEntity(json);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [baseUrl, apiPath, id]);

  // Bouw CEL-context uit de full-entity data.
  // Voeg entries toe op zowel klassenaam als jsonRolnaam, zodat veldpaden
  // als "Namen.roepnaam" én "namen.data.roepnaam" beide werken.
  const celContext = useMemo(() => {
    if (!entity || !typeMeta) return {};
    const onderliggende = safeArray(typeMeta?.onderliggende);
    const ctx = {};

    // Voeg direct entity-velden toe (bijv. id)
    for (const key of Object.keys(entity)) {
      if (typeof entity[key] !== "object" || entity[key] === null) {
        ctx[key] = entity[key];
      }
    }

    for (const child of onderliggende) {
      const childMeta = typeMetaByTypenaam?.[child.doeltype];
      const rawItems = safeArray(entity[child.jsonRolnaam] || entity[child.rolnaam]);
      const items = platSlaHubItems(rawItems, childMeta, typeMetaByTypenaam);
      const actiefItem = items.find((item) => !item.afvoer) || items[0] || null;
      if (!actiefItem) continue;

      // Maak het item beschikbaar onder klassenaam (PascalCase) én jsonRolnaam (snake_case)
      const klassenaam = childMeta?.klassenaam || child.doeltype;
      ctx[klassenaam] = actiefItem;
      if (child.jsonRolnaam && child.jsonRolnaam !== klassenaam) {
        // "namen" → { roepnaam: "Jan", ... } EN "namen.data" → dezelfde
        ctx[child.jsonRolnaam] = { ...actiefItem, data: actiefItem };
      }
    }
    return ctx;
  }, [entity, typeMeta, typeMetaByTypenaam]);

  // Render het template (of fallback)
  const gerenderdHtml = useMemo(() => {
    if (!entity) return "";
    if (detailTemplate) {
      const gevuld = renderTemplate(detailTemplate, celContext);
      return markdownNaarHtml(gevuld);
    }
    // Fallback: toon alle GE-velden als key-value pairs
    return fallbackHtml(celContext);
  }, [entity, detailTemplate, celContext]);

  if (!typeMeta) {
    return (
      <div style={{ padding: "2rem" }}>
        <p>Type &ldquo;{typePad}&rdquo; niet gevonden.</p>
        <Link to="/">← Terug</Link>
      </div>
    );
  }

  if (error || wdError) {
    return <div className="cg-feedback--fout">Fout: {error || wdError}</div>;
  }

  if (loading || wdLoading) {
    return <div style={{ padding: "2rem", color: "var(--cg-donkergrijs)" }}>Laden…</div>;
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1rem" }}>
        <Link to={`/t/${typePad}`} style={{ color: "var(--cg-blauw)", textDecoration: "none" }}>
          ← Terug naar lijst
        </Link>
        <h2 className="utrecht-heading-2" style={{ margin: 0 }}>
          {typeMeta.klassenaam || typeMeta.typenaam} #{id}
        </h2>
      </div>

      <div
        className="cg-form-card"
        style={{ maxWidth: 800 }}
        dangerouslySetInnerHTML={{ __html: gerenderdHtml }}
      />
    </div>
  );
}

/** Fallback HTML: toon alle GE-velden als een beschrijvingslijst. */
function fallbackHtml(ctx) {
  const delen = [];
  const overTeSlaan = new Set([
    "id", "rel_id", "opvoer", "afvoer", "versie", "_data_versie",
  ]);

  for (const [groepNaam, groepData] of Object.entries(ctx)) {
    if (groepData == null || typeof groepData !== "object") continue;
    delen.push(`<h3>${escapeHtml(groepNaam)}</h3>`);
    delen.push("<dl>");
    for (const [veld, waarde] of Object.entries(groepData)) {
      if (overTeSlaan.has(veld)) continue;
      if (waarde == null || (typeof waarde === "object" && !Array.isArray(waarde))) continue;
      delen.push(
        `<dt><strong>${escapeHtml(veld)}</strong></dt><dd>${escapeHtml(String(waarde))}</dd>`
      );
    }
    delen.push("</dl>");
  }

  return delen.join("\n") || "<p>Geen gegevens beschikbaar.</p>";
}
