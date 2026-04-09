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
