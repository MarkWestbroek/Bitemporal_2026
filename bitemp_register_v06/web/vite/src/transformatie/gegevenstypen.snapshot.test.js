// De Studio laadt de datatypen voor de inrichtingsartefacten uit een kopie
// binnen web/vite (de frontend-image bouwt alleen met web/vite/). Die kopie moet
// gelijk zijn aan testdata/gegevenstypen.json, de snapshot die de Go-test bewaakt.
// Bijwerken: cp testdata/gegevenstypen.json web/vite/src/transformatie/gegevenstypen.snapshot.json
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("gegevenstypen.snapshot.json is gelijk aan testdata/gegevenstypen.json", () => {
  const lees = (url) => JSON.parse(fs.readFileSync(url, "utf8"));
  assert.deepEqual(
    lees(new URL("./gegevenstypen.snapshot.json", import.meta.url)),
    lees(new URL("../../../../testdata/gegevenstypen.json", import.meta.url)),
    "kopie loopt achter: cp testdata/gegevenstypen.json web/vite/src/transformatie/gegevenstypen.snapshot.json"
  );
});
