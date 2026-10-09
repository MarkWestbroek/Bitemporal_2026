/**
 * sjabloon/markdownNaarHtml — kleine Markdown-naar-HTML-omzetter voor het
 * voorbeeldvenster en de HTML-download van documenten. Geen externe lib:
 * koppen, alinea's, lijsten (-, *, 1.), tabellen (|…|), vet/cursief/code,
 * links, scheidingslijnen, en blokken rauwe HTML (een ingesloten <svg>)
 * worden ongewijzigd doorgegeven. Tekst wordt ge-escaped.
 */

export function escHtml(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function inline(tekst) {
  let t = escHtml(tekst);
  t = t.replace(/`([^`]+)`/g, "<code>$1</code>");
  t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  t = t.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, l, u) => `<a href="${escHtml(u)}">${l}</a>`);
  return t;
}

/**
 * @param {string} md
 * @returns {string} HTML-fragment (zonder <html>/<body>)
 */
export function markdownNaarHtml(md) {
  const regels = String(md || "").replace(/\r\n/g, "\n").split("\n");
  const uit = [];
  let i = 0;
  const alinea = [];
  const sluitAlinea = () => {
    if (alinea.length) {
      uit.push(`<p>${inline(alinea.join(" "))}</p>`);
      alinea.length = 0;
    }
  };
  while (i < regels.length) {
    const r = regels[i];
    // Rauwe HTML-blokken (bv. <svg …>…</svg>): doorgeven tot de sluit-tag of een lege regel.
    if (/^\s*<(svg|div|table|figure|section)\b/i.test(r)) {
      sluitAlinea();
      const tag = /^\s*<(\w+)/.exec(r)[1].toLowerCase();
      const blok = [];
      while (i < regels.length) {
        blok.push(regels[i]);
        if (new RegExp(`</${tag}>\\s*$`, "i").test(regels[i])) {
          i++;
          break;
        }
        i++;
      }
      uit.push(blok.join("\n"));
      continue;
    }
    const kop = /^(#{1,6})\s+(.*)$/.exec(r);
    if (kop) {
      sluitAlinea();
      uit.push(`<h${kop[1].length}>${inline(kop[2])}</h${kop[1].length}>`);
      i++;
      continue;
    }
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(r)) {
      sluitAlinea();
      uit.push("<hr>");
      i++;
      continue;
    }
    if (/^\s*[-*]\s+/.test(r) || /^\s*\d+\.\s+/.test(r)) {
      sluitAlinea();
      const geordend = /^\s*\d+\./.test(r);
      const items = [];
      while (i < regels.length && (geordend ? /^\s*\d+\.\s+/.test(regels[i]) : /^\s*[-*]\s+/.test(regels[i]))) {
        let item = regels[i].replace(geordend ? /^\s*\d+\.\s+/ : /^\s*[-*]\s+/, "");
        i++;
        // Ingesprongen vervolgregels (sub-opsomming) als eenvoudige voortzetting.
        while (i < regels.length && /^\s{2,}\S/.test(regels[i]) && !/^\s*[-*]\s+/.test(regels[i].trim())) {
          item += " " + regels[i].trim();
          i++;
        }
        items.push(`<li>${inline(item)}</li>`);
      }
      uit.push(geordend ? `<ol>${items.join("")}</ol>` : `<ul>${items.join("")}</ul>`);
      continue;
    }
    if (/^\s*\|.*\|\s*$/.test(r) && i + 1 < regels.length && /^\s*\|[\s:|-]+\|\s*$/.test(regels[i + 1])) {
      sluitAlinea();
      const cellen = (regel) => regel.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
      const kopCellen = cellen(r);
      i += 2;
      const rijen = [];
      while (i < regels.length && /^\s*\|.*\|\s*$/.test(regels[i])) {
        rijen.push(cellen(regels[i]));
        i++;
      }
      uit.push(
        `<table><thead><tr>${kopCellen.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead><tbody>${rijen
          .map((rij) => `<tr>${rij.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`)
          .join("")}</tbody></table>`
      );
      continue;
    }
    if (!r.trim()) {
      sluitAlinea();
      i++;
      continue;
    }
    alinea.push(r.trim());
    i++;
  }
  sluitAlinea();
  return uit.join("\n");
}

/** Volledige HTML-pagina om te bewaren of af te drukken. */
export function htmlDocument({ titel = "Document", fragment = "" }) {
  return `<!doctype html>
<html lang="nl"><head><meta charset="utf-8"><title>${escHtml(titel)}</title>
<style>
body{font-family:system-ui,Segoe UI,sans-serif;max-width:900px;margin:32px auto;padding:0 24px;color:#0f172a;line-height:1.5}
h1{font-size:26px;border-bottom:2px solid #e2e8f0;padding-bottom:6px}h2{font-size:20px;margin-top:28px}h3{font-size:16px}
table{border-collapse:collapse;margin:8px 0}th,td{border:1px solid #cbd5e1;padding:4px 10px;text-align:left}th{background:#f1f5f9}
svg{max-width:100%;height:auto;display:block;margin:8px 0;border:1px solid #e2e8f0;border-radius:6px;background:#fff}
code{background:#f1f5f9;padding:1px 4px;border-radius:3px}
@media print{body{margin:0;max-width:none}svg{page-break-inside:avoid}}
</style></head><body>
${fragment}
</body></html>`;
}
