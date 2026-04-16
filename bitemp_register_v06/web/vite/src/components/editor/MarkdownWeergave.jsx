/**
 * MarkdownWeergave — rendert een markdown-string als opgemaakte HTML-preview.
 *
 * Gebruikt dezelfde veilige subset-converter als PublicatieDetail (geen externe
 * dependency). Ondersteunt: # t/m ###, **vet**, *cursief*, - lijsten, paragrafen.
 *
 * Props:
 *  - value:  de ruwe markdown-string
 *  - title:  optionele titel boven de preview (default: "Markdown-preview")
 */

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
  return r.split("|").map((cel) => cel.trim());
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
 * Simpele Markdown-naar-HTML converter — bewust beperkt tot een veilige subset.
 * Identiek aan de versie in PublicatieDetail.jsx.
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

export default function MarkdownWeergave({ value, title = "Markdown-preview" }) {
  if (value == null || value === "") {
    return null;
  }

  const htmlContent = markdownNaarHtml(String(value));

  return (
    <div className="cg-markdown-viewer">
      <div className="cg-markdown-viewer__header">
        <span className="cg-markdown-viewer__title">{title}</span>
      </div>
      <div
        className="cg-markdown-viewer__body"
        dangerouslySetInnerHTML={{ __html: htmlContent }}
      />
    </div>
  );
}
