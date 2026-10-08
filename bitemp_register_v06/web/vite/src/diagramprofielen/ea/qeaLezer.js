// @ts-check
/**
 * qeaLezer — opent een Sparx EA `.qea`/`.qeax` (SQLite) in de browser met
 * sql.js (WebAssembly) en levert de rijen die `qeaNaarPuurUml.js` nodig
 * heeft. Alleen lezen; het bestand blijft in het geheugen van de pagina.
 *
 * sql.js wordt lui geladen (dynamische import), zodat de Studio-bundel er
 * niet zwaarder van wordt zolang niemand een .qea importeert. De wasm komt
 * als asset mee via Vite's `?url`.
 */
import { deelboomPakketten } from "./qeaHulp.js";

let _sqlPromise = null;

async function sqlJs() {
  if (!_sqlPromise) {
    _sqlPromise = (async () => {
      const [{ default: initSqlJs }, { default: wasmUrl }] = await Promise.all([
        import("sql.js"),
        import("sql.js/dist/sql-wasm.wasm?url"),
      ]);
      return initSqlJs({ locateFile: () => wasmUrl });
    })();
  }
  return _sqlPromise;
}

/**
 * @param {ArrayBuffer|Uint8Array} bytes
 * @returns {Promise<any>} sql.js Database (sluit hem met `db.close()`)
 */
export async function openQea(bytes) {
  const SQL = await sqlJs();
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const kop = new TextDecoder().decode(data.subarray(0, 15));
  if (kop !== "SQLite format 3") {
    throw new Error("Dit is geen .qea/.qeax (SQLite-bestand). Een .eap/.eapx (Jet/Access) kan niet in de browser worden gelezen.");
  }
  const db = new SQL.Database(data);
  const tabellen = rijen(db, "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('t_object','t_package','t_connector')");
  if (tabellen.length < 3) {
    db.close();
    throw new Error("SQLite-bestand zonder EA-tabellen (t_object/t_package/t_connector).");
  }
  return db;
}

/**
 * Voer een query uit en geef rijen als objecten (kolomnaam → waarde).
 * @param {any} db
 * @param {string} sql
 * @param {any[]} [params]
 * @returns {any[]}
 */
export function rijen(db, sql, params = []) {
  const stmt = db.prepare(sql);
  try {
    stmt.bind(params);
    const uit = [];
    while (stmt.step()) uit.push(stmt.getAsObject());
    return uit;
  } finally {
    stmt.free();
  }
}

/** Alle pakketten (voor de keuzelijst). */
export function leesPakketten(db) {
  return rijen(db, "SELECT Package_ID, Name, Parent_ID, ea_guid FROM t_package ORDER BY Parent_ID, TPos, Name");
}

/**
 * Alle rijen voor één pakket mét deelpakketten — de QeaBron van
 * `qeaNaarPuurUml`. Connectoren worden op beide uiteinden binnen het bereik
 * gefilterd door de vertaler; hier halen we alles op dat aan één kant raakt.
 * @param {any} db
 * @param {number} packageId
 */
export function leesBron(db, packageId) {
  const pakketten = leesPakketten(db);
  const ids = deelboomPakketten(pakketten, packageId);
  const q = ids.map(() => "?").join(",") || "0";
  // Objecten in de pakketten, plus objecten van elders die op een diagram van
  // deze pakketten staan (EA tekent gerust klassen uit zes andere pakketten
  // op één diagram) — die komen mee als element zonder package-lidmaatschap.
  const OBJECT_KOLOMMEN = `Object_ID, Object_Type, Name, Alias, Note, Package_ID, Stereotype, NType, Abstract, Classifier, ParentID,
            ea_guid, Style, Backcolor, BorderWidth, PDATA1, PDATA2, PDATA3, PDATA4, PDATA5, Multiplicity`;
  const t_object = rijen(
    db,
    `SELECT ${OBJECT_KOLOMMEN} FROM t_object
       WHERE Package_ID IN (${q})
          OR Object_ID IN (SELECT o.Object_ID FROM t_diagramobjects o JOIN t_diagram d ON d.Diagram_ID = o.Diagram_ID WHERE d.Package_ID IN (${q}))`,
    [...ids, ...ids]
  );
  const objectIds = t_object.map((o) => o.Object_ID);
  const oq = objectIds.map(() => "?").join(",") || "0";
  const t_attribute = rijen(
    db,
    `SELECT Object_ID, Name, Scope, Stereotype, LowerBound, UpperBound, Notes, Derived, ID, Pos, Const, Classifier,
            "Default" AS "Default", Type, ea_guid
       FROM t_attribute WHERE Object_ID IN (${oq}) ORDER BY Object_ID, Pos`,
    objectIds
  );
  const t_operation = rijen(
    db,
    `SELECT Object_ID, Name, Scope, Type, Stereotype, Notes, Pos, ea_guid, Classifier
       FROM t_operation WHERE Object_ID IN (${oq}) ORDER BY Object_ID, Pos`,
    objectIds
  );
  const t_connector = rijen(
    db,
    `SELECT Connector_ID, Name, Direction, Notes, Connector_Type, SubType, SourceCard, DestCard, SourceRole, DestRole,
            SourceIsAggregate, DestIsAggregate, SourceIsNavigable, DestIsNavigable, Start_Object_ID, End_Object_ID,
            Stereotype, LineStyle, PDATA1, PDATA2, PDATA3, PDATA4, ea_guid
       FROM t_connector WHERE Start_Object_ID IN (${oq}) AND End_Object_ID IN (${oq})`,
    [...objectIds, ...objectIds]
  );
  const klassifiers = [...new Set(t_object.map((o) => o.Classifier).filter((c) => c && c !== 0 && c !== "0"))];
  const classifiers = klassifiers.length
    ? rijen(db, `SELECT Object_ID, Name, Object_Type, Package_ID, ea_guid FROM t_object WHERE Object_ID IN (${klassifiers.map(() => "?").join(",")})`, klassifiers)
    : [];
  const guids = [...t_object.map((o) => o.ea_guid), ...t_connector.map((c) => c.ea_guid)];
  const t_xref = [];
  // In porties: SQLite kent een grens op het aantal parameters.
  for (let i = 0; i < guids.length; i += 500) {
    const deel = guids.slice(i, i + 500);
    const gq = deel.map(() => "?").join(",");
    t_xref.push(
      ...rijen(db, `SELECT Client, Name, Type, Description FROM t_xref WHERE Client IN (${gq}) AND Name IN ('Stereotypes','CustomProperties')`, deel)
    );
  }
  const t_objectproperties = rijen(db, `SELECT Object_ID, Property, Value, Notes FROM t_objectproperties WHERE Object_ID IN (${oq})`, objectIds);
  const t_diagram = rijen(
    db,
    `SELECT Diagram_ID, Package_ID, ParentID, Diagram_Type, Name, Notes, Stereotype, cx, cy, Scale, PDATA, ea_guid, StyleEx
       FROM t_diagram WHERE Package_ID IN (${q})`,
    ids
  );
  const diagramIds = t_diagram.map((d) => d.Diagram_ID);
  const dq = diagramIds.map(() => "?").join(",") || "0";
  const t_diagramobjects = rijen(
    db,
    `SELECT Diagram_ID, Object_ID, RectTop, RectLeft, RectRight, RectBottom, Sequence, ObjectStyle, Instance_ID
       FROM t_diagramobjects WHERE Diagram_ID IN (${dq}) ORDER BY Diagram_ID, Sequence`,
    diagramIds
  );
  const t_diagramlinks = rijen(
    db,
    `SELECT DiagramID, ConnectorID, Geometry, Style, Hidden, Path, Instance_ID FROM t_diagramlinks WHERE DiagramID IN (${dq})`,
    diagramIds
  );
  return {
    t_package: pakketten,
    t_object,
    classifiers,
    t_attribute,
    t_operation,
    t_connector,
    t_xref,
    t_objectproperties,
    t_diagram,
    t_diagramobjects,
    t_diagramlinks,
  };
}
