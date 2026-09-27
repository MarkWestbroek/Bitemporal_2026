/**
 * markdown.js — de kleine, veilige markdown-naar-HTML-omzetting van de publicatiepagina
 * (koppen, vet/cursief, links, opsommingen, GFM-tabellen, alinea's). Alles wordt eerst
 * ge-escaped; geen externe dependency. Gedeeld door PublicatieDetail en de vorm `markdown`
 * (voorbeeldweergave naast de editor). Verhuisd uit PublicatieDetail.jsx (27-09).
 */
import { normaliseerLink } from "./publicatieUtils.js";

/** Escaped een string voor veilige HTML-weergave. */
export function escapeHtml(tekst) {
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

export function converteerTabellen(html) {
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
export function markdownNaarHtml(md) {
  let html = escapeHtml(md);

  // Headers: # t/m ###
  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");

  // Links: [tekst](url) — alleen http(s), mailto, paden vanaf "/" en kale domeinen
  // (die krijgen https://, zie normaliseerLink)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, tekst, url) => {
    const href = normaliseerLink(url);
    if (!href) return `[${tekst}](${url})`;
    return `<a href="${href}" target="_blank" rel="noopener noreferrer">${tekst}</a>`;
  });

  // Bold: **tekst**
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

  // Italic: *tekst*
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");

  // Opsommingslijst: - item
  html = html.replace(/^- (.+)$/gm, "<li>$1</li>");
  html = html.replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`);

  // GFM-tabellen
  html = converteerTabellen(html);
  // Een ge-escapete pipe (renderTemplate, om tabellen heel te houden) buiten een tabel: gewoon "|".
  html = html.replace(/\\\|/g, "|");

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
