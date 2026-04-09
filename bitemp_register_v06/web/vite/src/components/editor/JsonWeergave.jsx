function formatteerJsonVoorWeergave(value) {
  if (value == null || value === "") {
    return { status: "empty", text: "" };
  }

  if (typeof value === "string") {
    try {
      return {
        status: "ok",
        text: JSON.stringify(JSON.parse(value), null, 2),
      };
    } catch (error) {
      return {
        status: "invalid",
        text: value,
        error: error?.message || "Ongeldige JSON",
      };
    }
  }

  try {
    return {
      status: "ok",
      text: JSON.stringify(value, null, 2),
    };
  } catch (error) {
    return {
      status: "invalid",
      text: String(value),
      error: error?.message || "JSON kon niet worden geformatteerd",
    };
  }
}

function tokenizeJson(text) {
  const tokenRegex = /("(?:\\u[0-9a-fA-F]{4}|\\[^u]|[^\\"])*"\s*:?)|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g;
  const nodes = [];
  let cursor = 0;
  let matchIndex = 0;
  let match;

  while ((match = tokenRegex.exec(text)) !== null) {
    const [fullMatch] = match;
    const start = match.index;

    if (start > cursor) {
      nodes.push(text.slice(cursor, start));
    }

    let className = "cg-json-viewer__token";
    if (fullMatch.startsWith('"')) {
      className = fullMatch.endsWith(":")
        ? "cg-json-viewer__token cg-json-viewer__token--key"
        : "cg-json-viewer__token cg-json-viewer__token--string";
    } else if (fullMatch === "true" || fullMatch === "false") {
      className = "cg-json-viewer__token cg-json-viewer__token--boolean";
    } else if (fullMatch === "null") {
      className = "cg-json-viewer__token cg-json-viewer__token--null";
    } else {
      className = "cg-json-viewer__token cg-json-viewer__token--number";
    }

    nodes.push(
      <span key={`json-token-${matchIndex}`} className={className}>
        {fullMatch}
      </span>
    );

    cursor = start + fullMatch.length;
    matchIndex += 1;
  }

  if (cursor < text.length) {
    nodes.push(text.slice(cursor));
  }

  return nodes;
}

export default function JsonWeergave({ value, title = "JSON-preview" }) {
  const formatted = formatteerJsonVoorWeergave(value);

  if (formatted.status === "empty") {
    return null;
  }

  return (
    <div className={`cg-json-viewer ${formatted.status === "invalid" ? "cg-json-viewer--invalid" : ""}`}>
      <div className="cg-json-viewer__header">
        <span className="cg-json-viewer__title">{title}</span>
        {formatted.status === "invalid" && (
          <span className="cg-json-viewer__error">{formatted.error}</span>
        )}
      </div>
      <pre className="cg-json-viewer__body">
        <code>{tokenizeJson(formatted.text)}</code>
      </pre>
    </div>
  );
}