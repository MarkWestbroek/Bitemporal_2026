#!/usr/bin/env python3
"""
inspecteer-qea.py — doorlicht een Sparx EA `.qea`/`.qeax` (SQLite) en rapporteert
wat een Omnium-lezer tegenkomt: pakketten, elementtypen en stereotypen (uit t_xref),
connectoren, diagrammen per type/MDG-type, zwembanen (diagram-swimlanes én
UML ActivityPartition-elementen), matrix, alternate images, tagged values.

Alleen lezen; opent de database read-only. Standaardbibliotheek, geen afhankelijkheden.

Gebruik:
    python3 inspecteer-qea.py pad/naar/model.qea [--top 30] [--diagrammen]

Zie docs/plans/2026-10-07 Sparx EA-sync — vier routes vergeleken (onderzoek).md §5.
"""
import argparse
import re
import sqlite3
import sys
from collections import Counter
from xml.etree import ElementTree as ET

SQL_LINKS_MET_PAD = "SELECT COUNT(*) FROM t_diagramlinks WHERE Path IS NOT NULL AND Path <> ''"
SQL_BOUNDARY = "SELECT COUNT(*) FROM t_object WHERE Object_Type='Boundary'"
SQL_IMAGEID = "SELECT COUNT(*) FROM t_object WHERE Style LIKE '%ImageID=%'"


def open_ro(pad):
    uri = "file:" + pad.replace("\\", "/") + "?mode=ro"
    return sqlite3.connect(uri, uri=True)


def q(con, sql, params=()):
    try:
        return con.execute(sql, params).fetchall()
    except sqlite3.Error as e:
        return [("FOUT", str(e))]


def kop(t):
    print("\n" + t)
    print("-" * len(t))


def teller(con, sql, top):
    c = Counter()
    for (k,) in q(con, sql):
        c[k if k not in (None, "") else "(leeg)"] += 1
    for k, n in c.most_common(top):
        print(f"  {n:6d}  {k}")
    return c


def stereotypen_uit_xref(con):
    """t_xref Name='Stereotypes': Description = '@STEREO;Name=x;FQName=P::x;@ENDSTEREO;...'"""
    per_client = {}
    for client, desc in q(con, "SELECT Client, Description FROM t_xref WHERE Name='Stereotypes'"):
        namen = []
        for blok in re.findall(r"@STEREO;(.*?)@ENDSTEREO;", desc or "", re.S):
            d = dict(kv.split("=", 1) for kv in blok.strip(";").split(";") if "=" in kv)
            namen.append(d.get("FQName") or d.get("Name") or "?")
        per_client[client] = namen
    return per_client


def swimlanes(xml):
    """t_diagram.Swimlanes: <Swimlanes orientation=.. ><Swimlane title=.. .../></Swimlanes>"""
    if not xml or "<Swimlane" not in xml:
        return None
    try:
        root = ET.fromstring(xml)
    except ET.ParseError:
        return {"lanes": "?", "orientatie": "?", "titels": []}
    lanes = [l for l in root.iter() if l.tag.lower() == "swimlane"]
    return {
        "lanes": len(lanes),
        "orientatie": root.get("orientation"),
        "titels": [l.get("title") or "" for l in lanes],
    }


def stylex(s):
    return dict(kv.split("=", 1) for kv in (s or "").split(";") if "=" in kv)


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser()
    ap.add_argument("qea")
    ap.add_argument("--top", type=int, default=30)
    ap.add_argument("--diagrammen", action="store_true", help="elk diagram apart tonen")
    a = ap.parse_args()

    con = open_ro(a.qea)

    kop("Bestand")
    with open(a.qea, "rb") as f:
        print("  SQLite-header:", f.read(16))
    tabellen = [t for (t,) in q(con, "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")]
    print(f"  tabellen: {len(tabellen)}  (t_object: {'t_object' in tabellen}, t_xref: {'t_xref' in tabellen}, t_diagram: {'t_diagram' in tabellen})")
    for r in q(con, "SELECT * FROM t_version"):
        print("  t_version:", r)

    kop("Pakketten")
    print(f"  aantal: {q(con, 'SELECT COUNT(*) FROM t_package')[0][0]}")
    for pid, naam, parent in q(con, "SELECT Package_ID, Name, Parent_ID FROM t_package WHERE Parent_ID=0 OR Parent_ID IS NULL"):
        print(f"  wortel: {naam} (id {pid})")
    for pid, naam, n in q(con, """
        SELECT p.Package_ID, p.Name, COUNT(o.Object_ID) FROM t_package p
        LEFT JOIN t_object o ON o.Package_ID = p.Package_ID AND o.Object_Type <> 'Package'
        GROUP BY p.Package_ID ORDER BY 3 DESC LIMIT ?""", (a.top,)):
        print(f"  {n:6d}  {naam}")

    kop("Elementen per Object_Type")
    teller(con, "SELECT Object_Type FROM t_object", a.top)

    kop("Stereotypen (t_xref, FQName; leidend) op elementen")
    st = stereotypen_uit_xref(con)
    c = Counter()
    guids = {g: t for g, t in q(con, "SELECT ea_guid, Object_Type FROM t_object")}
    for client, namen in st.items():
        for n in namen:
            c[(n, guids.get(client, "connector/attr/ander"))] += 1
    for (n, t), k in c.most_common(a.top):
        print(f"  {k:6d}  «{n}» op {t}")
    kop("Stereotypen alleen in t_object.Stereotype (niet in t_xref)")
    alleen = Counter()
    for g, s in q(con, "SELECT ea_guid, Stereotype FROM t_object WHERE Stereotype IS NOT NULL AND Stereotype <> ''"):
        if g not in st:
            alleen[s] += 1
    for s, k in alleen.most_common(a.top):
        print(f"  {k:6d}  «{s}»")
    if not alleen:
        print("  (geen)")

    kop("Connectoren per Connector_Type / Stereotype")
    teller(con, "SELECT Connector_Type || COALESCE(' «' || NULLIF(Stereotype,'') || '»','') FROM t_connector", a.top)

    kop("Attributen en operaties")
    print(f"  attributen: {q(con, 'SELECT COUNT(*) FROM t_attribute')[0][0]}"
          f"  (met Classifier: {q(con, 'SELECT COUNT(*) FROM t_attribute WHERE Classifier IS NOT NULL AND Classifier <> 0')[0][0]})")
    print(f"  operaties:  {q(con, 'SELECT COUNT(*) FROM t_operation')[0][0]}")
    print(f"  tagged values op elementen: {q(con, 'SELECT COUNT(*) FROM t_objectproperties')[0][0]}"
          f", op attributen: {q(con, 'SELECT COUNT(*) FROM t_attributetag')[0][0]}"
          f", op connectoren: {q(con, 'SELECT COUNT(*) FROM t_connectortag')[0][0]}")
    kop("Meest gebruikte tagged-value-namen (elementen)")
    teller(con, "SELECT Property FROM t_objectproperties", a.top)

    kop("Diagrammen per Diagram_Type / MDG-diagramtype (StyleEx MDGDgm)")
    c = Counter()
    rijen = q(con, "SELECT Diagram_ID, Name, Diagram_Type, Stereotype, StyleEx, Swimlanes, PDATA FROM t_diagram")
    zwem = []
    matrix = []
    for did, naam, dtype, stereo, sx, sw, pdata in rijen:
        s = stylex(sx)
        mdg = s.get("MDGDgm")
        c[f"{dtype}" + (f"  [{mdg}]" if mdg else "") + (f"  «{stereo}»" if stereo else "")] += 1
        lanes = swimlanes(sw)
        if lanes:
            zwem.append((naam, dtype, lanes))
        if s.get("MatrixActive") == "1" or (s.get("SwimlanesActive") == "1"):
            matrix.append((naam, dtype, s.get("MatrixActive"), s.get("SwimlanesActive")))
    for k, n in c.most_common(a.top):
        print(f"  {n:6d}  {k}")
    print(f"  totaal diagrammen: {len(rijen)}; diagramobjecten: {q(con, 'SELECT COUNT(*) FROM t_diagramobjects')[0][0]};"
          f" diagramlinks: {q(con, 'SELECT COUNT(*) FROM t_diagramlinks')[0][0]}"
          f" (met eigen Path: {q(con, SQL_LINKS_MET_PAD)[0][0]})")

    kop("Zwembanen — soort 1: diagram-swimlanes (t_diagram.Swimlanes, cosmetisch)")
    if zwem:
        for naam, dtype, l in zwem:
            print(f"  {naam} ({dtype}): {l['lanes']} banen, orientatie {l['orientatie']}: {', '.join(l['titels'])}")
    else:
        print("  (geen)")
    kop("Zwembanen — matrix/swimlanes-actief in StyleEx")
    for naam, dtype, m, s in matrix:
        print(f"  {naam} ({dtype}): MatrixActive={m} SwimlanesActive={s}")
    if not matrix:
        print("  (geen)")

    kop("Zwembanen — soort 2: UML ActivityPartition-elementen (t_object)")
    n = q(con, "SELECT COUNT(*) FROM t_object WHERE Object_Type='ActivityPartition'")[0][0]
    print(f"  ActivityPartition: {n}")
    for naam, pk in q(con, """SELECT o.Name, p.Name FROM t_object o JOIN t_package p ON p.Package_ID=o.Package_ID
                               WHERE o.Object_Type='ActivityPartition' LIMIT ?""", (a.top,)):
        print(f"    {naam}  (pakket {pk})")
    print(f"  elementen met ParentID (genest in ander element): "
          f"{q(con, 'SELECT COUNT(*) FROM t_object WHERE ParentID IS NOT NULL AND ParentID <> 0')[0][0]}")
    print(f"  Boundary-elementen: {q(con, SQL_BOUNDARY)[0][0]}")

    kop("Alternate images en MDG")
    print(f"  t_image (eigen afbeeldingen): {q(con, 'SELECT COUNT(*) FROM t_image')[0][0]}")
    print(f"  elementen met ImageID in Style: "
          f"{q(con, SQL_IMAGEID)[0][0]}")
    for r in q(con, "SELECT DocName, DocType FROM t_document WHERE DocType='TECHNOLOGY'"):
        print(f"  MDG-technologie in model: {r[0]}")
    for r in q(con, "SELECT Stereotype, AppliesTo FROM t_stereotypes ORDER BY Stereotype"):
        print(f"  eigen stereotype-definitie: «{r[0]}» op {r[1]}")

    if a.diagrammen:
        kop("Alle diagrammen")
        for did, naam, dtype, stereo, sx, sw, pdata in rijen:
            n_obj = q(con, "SELECT COUNT(*) FROM t_diagramobjects WHERE Diagram_ID=?", (did,))[0][0]
            print(f"  [{did}] {naam} — {dtype}  objecten {n_obj}  StyleEx={str(sx)[:100]}")

    con.close()


if __name__ == "__main__":
    sys.exit(main())
