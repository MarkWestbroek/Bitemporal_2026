/**
 * jsonPlaats — vind waar een JSON-tekst ongeldig wordt (regel/kolom).
 *
 * JSON.parse noemt de positie niet in elke engine/versie ("Unexpected token
 * ',', … is not valid JSON"). Alleen als JSON.parse faalt, loopt deze kleine
 * recursieve-afdaling-scanner de tekst door tot de eerste fout.
 */

class Stop extends Error {
  constructor(i) {
    super("stop");
    this.i = i;
  }
}

export function jsonFoutIndex(s) {
  let i = 0;
  const ws = () => {
    while (i < s.length && " \t\n\r".includes(s[i])) i++;
  };
  const verwacht = (c) => {
    if (s[i] !== c) throw new Stop(i);
    i++;
  };
  const woord = (w) => {
    if (s.slice(i, i + w.length) !== w) throw new Stop(i);
    i += w.length;
  };
  const tekst = () => {
    verwacht('"');
    while (i < s.length && s[i] !== '"') {
      if (s[i] === "\\") i++;
      else if (s.charCodeAt(i) < 0x20) throw new Stop(i);
      i++;
    }
    verwacht('"');
  };
  const getal = () => {
    const m = /^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?/.exec(s.slice(i));
    if (!m) throw new Stop(i);
    i += m[0].length;
  };
  const waarde = () => {
    ws();
    const c = s[i];
    if (c === "{") {
      i++;
      ws();
      if (s[i] === "}") return void i++;
      for (;;) {
        ws();
        tekst();
        ws();
        verwacht(":");
        waarde();
        ws();
        if (s[i] === ",") i++;
        else return verwacht("}");
      }
    }
    if (c === "[") {
      i++;
      ws();
      if (s[i] === "]") return void i++;
      for (;;) {
        waarde();
        ws();
        if (s[i] === ",") i++;
        else return verwacht("]");
      }
    }
    if (c === '"') return tekst();
    if (c === "t") return woord("true");
    if (c === "f") return woord("false");
    if (c === "n") return woord("null");
    return getal();
  };
  try {
    waarde();
    ws();
    return i < s.length ? i : -1;
  } catch (e) {
    if (e instanceof Stop) return e.i;
    throw e;
  }
}

/** Index → { regel, kolom } (1-based). */
export function regelKolom(s, index) {
  const voor = s.slice(0, index).split("\n");
  return { regel: voor.length, kolom: voor[voor.length - 1].length + 1 };
}
