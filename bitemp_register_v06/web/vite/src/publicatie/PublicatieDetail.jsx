import { useState, useEffect, useMemo } from "react";
import { useParams, Link } from "react-router";
import { useSchema } from "../context/SchemaContext";
import { useWeergaveDefinitie } from "../hooks/useWeergaveDefinitie";
import { safeArray, platSlaHubItems } from "../shared/schemaUtils";
import {
  parseSegment,
  segmentNaarString,
  resolveVeldpadUitContext,
  buildGraphQLQuery,
} from "./publicatieUtils";

/**
 * Vervangt alle {{veldpad}} placeholders in een template met waarden uit de CEL-context.
 */
function renderTemplate(template, ctx) {
  if (!template) return "";
  return template.replace(/\{\{([^}]+)\}\}/g, (_, veldpad) => {
    const waarde = resolveVeldpadUitContext(ctx, veldpad.trim());
    if (waarde == null) return "";
    // Escape pipes zodat ze markdown-tabellen niet breken
    return String(waarde).replace(/\|/g, "\\|");
  });
}

/** Escaped een string voor veilige HTML-weergave. */
function escapeHtml(tekst) {
  const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return tekst.replace(/[&<>"']/g, (c) => map[c]);
}

function isTabelRij(regel) {
  const trimmed = regel.trim();
  return /^\|.+\|$/.test(trimmed) || (/\|/.test(trimmed) && !/^[-*]\s/.test(trimmed));
}

function isTabelScheiding(regel) {
  const trimmed = regel.trim();
  if (!trimmed.includes("|")) return false;
  return /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(trimmed);
}

function splitTabelRij(regel) {
  let r = regel.trim();
  if (r.startsWith("|")) r = r.slice(1);
  if (r.endsWith("|")) r = r.slice(0, -1);
  // Split op niet-geëscapede pipes, unescape daarna
  return r.split(/(?<!\\)\|/).map((cel) => cel.trim().replace(/\\\|/g, "|"));
}

function alignmentVoorKolom(scheidingCel) {
  const c = scheidingCel.trim();
  const links = c.startsWith(":");
  const rechts = c.endsWith(":");
  if (links && rechts) return "center";
  if (rechts) return "right";
  if (links) return "left";
  return null;
}

function converteerTabellen(html) {
  const regels = html.split("\n");
  const uit = [];

  for (let i = 0; i < regels.length; i += 1) {
    const headerRij = regels[i];
    const scheidingRij = regels[i + 1];

    if (!headerRij || !scheidingRij || !isTabelRij(headerRij) || !isTabelScheiding(scheidingRij)) {
      uit.push(headerRij ?? "");
      continue;
    }

    const headers = splitTabelRij(headerRij);
    const aligns = splitTabelRij(scheidingRij).map(alignmentVoorKolom);
    const bodyRijen = [];
    i += 2;

    while (i < regels.length && isTabelRij(regels[i])) {
      bodyRijen.push(splitTabelRij(regels[i]));
      i += 1;
    }

    i -= 1;

    const thead = `<thead><tr>${headers
      .map((cel, idx) => {
        const align = aligns[idx] ? ` style="text-align:${aligns[idx]}"` : "";
        return `<th${align}>${cel}</th>`;
      })
      .join("")}</tr></thead>`;

    const tbody = bodyRijen.length
      ? `<tbody>${bodyRijen
          .map(
            (rij) => `<tr>${headers
              .map((_, idx) => {
                const align = aligns[idx] ? ` style="text-align:${aligns[idx]}"` : "";
                return `<td${align}>${rij[idx] ?? ""}</td>`;
              })
              .join("")}</tr>`
          )
          .join("")}</tbody>`
      : "";

    uit.push(`<table>${thead}${tbody}</table>`);
  }

  return uit.join("\n");
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

  // GFM-tabellen
  html = converteerTabellen(html);

  // Paragrafen: dubbele newlines → <p>
  html = html
    .split(/\n\n+/)
    .map((blok) => {
      const trimmed = blok.trim();
      if (!trimmed) return "";
      if (/^<(h[1-3]|ul|ol|li|table)/.test(trimmed)) return trimmed;
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
 * Als er een detailTemplate is, wordt data opgehaald via GraphQL (ondersteunt
 * diepe navigatie via forward FK relaties). Zonder template: REST fallback.
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

  // Haal de full entity op.
  // Met detailTemplate → GraphQL (ondersteunt diepe navigatie via forward FK).
  // Zonder template → REST /full/ (fallback voor generieke weergave).
  useEffect(() => {
    if (!apiPath || !baseUrl || !id || wdLoading) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    if (detailTemplate) {
      // GraphQL: bouw query op basis van template veldpaden
      const query = buildGraphQLQuery(detailTemplate, apiPath, id);
      fetch(`${baseUrl}/graphql/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      })
        .then((res) => res.json())
        .then((json) => {
          if (cancelled) return;
          if (json.errors) {
            setError(json.errors.map((e) => e.message).join(", "));
          } else {
            setEntity(json.data?.[`full_${apiPath}`] || null);
          }
          setLoading(false);
        })
        .catch((err) => {
          if (!cancelled) {
            setError(err.message);
            setLoading(false);
          }
        });
    } else {
      // REST fallback
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
    }

    return () => {
      cancelled = true;
    };
  }, [baseUrl, apiPath, id, detailTemplate, wdLoading]);

  // Bouw CEL-context uit de entity data.
  // GraphQL: response is al geflattend — direct als context.
  // REST: bouw context met hub-flattening en klassenaam-mapping.
  const celContext = useMemo(() => {
    if (!entity || !typeMeta) return {};

    // GraphQL-response: al geflattend, direct als context gebruiken.
    // resolveVeldpadUitContext handelt 'data'-segmenten transparant af.
    if (detailTemplate) {
      return entity;
    }

    // REST fallback: bestaande hub-flattening + klassenaam-mapping
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
      const actieveItems = items.filter((item) => !item.afvoer);
      if (actieveItems.length === 0 && items.length === 0) continue;

      const klassenaam = childMeta?.klassenaam || child.doeltype;
      const isMeervoudig = child.momentvoorkomen === "meervoudig";

      if (isMeervoudig) {
        const arr = actieveItems.length > 0 ? actieveItems : items;
        ctx[klassenaam] = arr;
        if (child.jsonRolnaam && child.jsonRolnaam !== klassenaam) {
          ctx[child.jsonRolnaam] = arr;
        }
      } else {
        const actiefItem = actieveItems[0] || items[0] || null;
        if (!actiefItem) continue;
        ctx[klassenaam] = actiefItem;
        if (child.jsonRolnaam && child.jsonRolnaam !== klassenaam) {
          ctx[child.jsonRolnaam] = { ...actiefItem, data: actiefItem };
        }
      }
    }
    return ctx;
  }, [entity, typeMeta, typeMetaByTypenaam, detailTemplate]);

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
