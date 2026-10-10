// @ts-check
/**
 * zip — minimale ZIP-schrijver (methode STORE, geen compressie), zonder
 * afhankelijkheden. Genoeg voor een handvol tekstbestanden (een document met
 * zijn SVG's); voor grote archieven is een echte bibliotheek beter.
 *
 * Formaat volgens PKWARE APPNOTE: per bestand een local file header + data,
 * daarna de central directory en het end-of-central-directory-record.
 * Bestandsnamen in UTF-8 (vlag 0x0800). Puur en node-testbaar.
 */

let CRC_TABEL = null;
function crcTabel() {
  if (CRC_TABEL) return CRC_TABEL;
  CRC_TABEL = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    CRC_TABEL[n] = c >>> 0;
  }
  return CRC_TABEL;
}

/** CRC-32 (IEEE) van een byte-array. */
export function crc32(bytes) {
  const t = crcTabel();
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = t[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** MS-DOS tijd en datum (lokale tijd) voor de headers. */
function dosTijd(d) {
  const tijd = (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2);
  const datum = ((Math.max(d.getFullYear(), 1980) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return { tijd, datum };
}

/**
 * Bouw een ZIP-archief.
 * @param {Array<{naam: string, inhoud: string|Uint8Array}>} bestanden
 * @param {Date} [moment] - tijdstempel voor alle bestanden (default: nu)
 * @returns {Uint8Array}
 */
export function maakZip(bestanden, moment = new Date()) {
  const enc = new TextEncoder();
  const { tijd, datum } = dosTijd(moment);
  /** @type {Uint8Array[]} */
  const delen = [];
  /** @type {Uint8Array[]} */
  const centraal = [];
  let offset = 0;
  for (const b of bestanden) {
    const naam = enc.encode(b.naam);
    const data = typeof b.inhoud === "string" ? enc.encode(b.inhoud) : b.inhoud;
    const crc = crc32(data);
    const lokaal = new DataView(new ArrayBuffer(30));
    lokaal.setUint32(0, 0x04034b50, true);
    lokaal.setUint16(4, 20, true); // versie nodig
    lokaal.setUint16(6, 0x0800, true); // UTF-8-namen
    lokaal.setUint16(8, 0, true); // STORE
    lokaal.setUint16(10, tijd, true);
    lokaal.setUint16(12, datum, true);
    lokaal.setUint32(14, crc, true);
    lokaal.setUint32(18, data.length, true);
    lokaal.setUint32(22, data.length, true);
    lokaal.setUint16(26, naam.length, true);
    lokaal.setUint16(28, 0, true);
    delen.push(new Uint8Array(lokaal.buffer), naam, data);

    const cd = new DataView(new ArrayBuffer(46));
    cd.setUint32(0, 0x02014b50, true);
    cd.setUint16(4, 20, true); // gemaakt door
    cd.setUint16(6, 20, true); // nodig
    cd.setUint16(8, 0x0800, true);
    cd.setUint16(10, 0, true);
    cd.setUint16(12, tijd, true);
    cd.setUint16(14, datum, true);
    cd.setUint32(16, crc, true);
    cd.setUint32(20, data.length, true);
    cd.setUint32(24, data.length, true);
    cd.setUint16(28, naam.length, true);
    // extra, commentaar, schijf, interne attributen: 0
    cd.setUint32(38, 0, true); // externe attributen
    cd.setUint32(42, offset, true);
    centraal.push(new Uint8Array(cd.buffer), naam);
    offset += 30 + naam.length + data.length;
  }
  const cdGrootte = centraal.reduce((n, d) => n + d.length, 0);
  const eind = new DataView(new ArrayBuffer(22));
  eind.setUint32(0, 0x06054b50, true);
  eind.setUint16(8, bestanden.length, true);
  eind.setUint16(10, bestanden.length, true);
  eind.setUint32(12, cdGrootte, true);
  eind.setUint32(16, offset, true);
  const alles = [...delen, ...centraal, new Uint8Array(eind.buffer)];
  const uit = new Uint8Array(alles.reduce((n, d) => n + d.length, 0));
  let p = 0;
  for (const d of alles) {
    uit.set(d, p);
    p += d.length;
  }
  return uit;
}
