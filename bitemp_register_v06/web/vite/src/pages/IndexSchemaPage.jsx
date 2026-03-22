import { useEffect, useMemo, useRef, useState } from "react";
import "../shared/schema-viz.css";
import "../styles/index-schema.css";
import {
  safeArray,
  tUitRegistratieTijdstip,
  microsecondeIntVanTijdstip,
  wijzigingKleur,
  wijzigingPatroonId,
  isPrimitiveWaarde,
  veldEntries,
  korteSamenvatting,
  donkerdereRandkleurVanHex,
  leidEntiteitTypeAfUitKolomnaam,
  platSlaHubItems,
} from "../shared/schemaUtils";
import { bepaalHubOortjes } from "../shared/oortjesUtils";
import SchemaIndexHeader from "../components/index/SchemaIndexHeader";
import SchemaIndexControls from "../components/index/SchemaIndexControls";
import IndexRegistratieVisual from "../components/index/IndexRegistratieVisual";
import IndexRepresentatieVisual from "../components/index/IndexRepresentatieVisual";
import RegistratieActieBox from "../components/actions/RegistratieActieBox";
import EntiteitActieBox from "../components/actions/EntiteitActieBox";
import RepresentatieActieBox from "../components/actions/RepresentatieActieBox";
import NieuweEntiteitActieBox from "../components/actions/NieuweEntiteitActieBox";
import { ActionTooltip } from "../components/actions/ActionFormParts";
import { coercedWaardeVoorVeld } from "../components/actions/ActionFormParts";

const TEMPORALE_PLUMBING_VELDEN = new Set(["opvoer", "afvoer", "aanvang", "einde"]);

function isPlumbingVeld(naam, typeMeta) {
  const k = String(naam).toLowerCase();
  if (TEMPORALE_PLUMBING_VELDEN.has(k)) return true;
  if (typeMeta?.entiteitIDKolom && k === String(typeMeta.entiteitIDKolom).toLowerCase()) return true;
  // v06: de IDKolom van het type (bijv. rel_id voor hubs) is plumbing als autoIncrement actief is.
  if (typeMeta?.idAutoIncrement && typeMeta?.idKolom && k === String(typeMeta.idKolom).toLowerCase()) return true;

  if (import.meta.env.DEV && !Array.isArray(typeMeta?.velden)) {
    const typeLabel = String(typeMeta?.typenaam || typeMeta?.doeltype || typeMeta?.veldnaam || "onbekend");
    console.warn(
      `[IndexSchemaPage] Geen schema-velddefinities voor type '${typeLabel}'. Veld '${String(naam)}' wordt beoordeeld zonder autoIncrement-informatie.`
    );
  }

  const veldDef = safeArray(typeMeta?.velden).find((v) => v.naam === naam);
  if (veldDef?.autoIncrement) return true;
  return false;
}

function normaliseerNietNegatiefGeheelGetal(value, fallback = 0) {
  const parsed = Number.parseInt(String(value), 10);
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  return Math.max(0, parsed);
}

function vindEntiteitIdVanuitRegistratie(registratie, entiteiten, entiteitType) {
  const wijzigingen = safeArray(registratie?.wijzigingen);
  const doelType = String(entiteitType || "").toUpperCase();

  for (const wijziging of wijzigingen) {
    if (String(wijziging?.entiteitnaam || "").toUpperCase() !== doelType) {
      continue;
    }

    const kandidaatId = wijziging?.entiteit_id;
    if (kandidaatId === null || kandidaatId === undefined || kandidaatId === "") {
      continue;
    }

    const kandidaatAlsString = String(kandidaatId);
    const bestaat = entiteiten.some((item) => String(item.id) === kandidaatAlsString);
    if (bestaat) {
      return kandidaatAlsString;
    }
  }

  return "";
}

function afgeknotteHoekPad(x, y, width, height, hoek = 8) {
  const h = Math.max(0, Math.min(hoek, Math.floor(Math.min(width, height) / 2)));
  return [
    `M ${x + h} ${y}`,
    `L ${x + width - h} ${y}`,
    `L ${x + width} ${y + h}`,
    `L ${x + width} ${y + height - h}`,
    `L ${x + width - h} ${y + height}`,
    `L ${x + h} ${y + height}`,
    `L ${x} ${y + height - h}`,
    `L ${x} ${y + h}`,
    "Z",
  ].join(" ");
}

function registratieIDUitOpvoerTijdstip(tijdstipRaw) {
  const viaMicroseconde = microsecondeIntVanTijdstip(tijdstipRaw);
  if (Number.isInteger(viaMicroseconde) && viaMicroseconde > 0) {
    return viaMicroseconde;
  }
  const viaT = tUitRegistratieTijdstip(tijdstipRaw);
  if (Number.isInteger(viaT) && viaT > 0) {
    return viaT;
  }
  return 0;
}

function endpointSegmentVoorEntiteit(entiteitType, entiteitTypen) {
  const gekozenType = String(entiteitType || "");
  const meta = safeArray(entiteitTypen).find((item) => String(item?.typenaam || "") === gekozenType) || null;
  const segment = String(meta?.meervoud || meta?.padnaam || "").trim();
  if (segment) {
    return segment;
  }
  return `${gekozenType.toLowerCase()}s`;
}

function responseKeyVoorEntiteiten(entiteitType, responseJson) {
  const type = String(entiteitType || "");
  const kandidaten = [
    `${type}s`,
    `${type.toUpperCase()}s`,
    `${type.toLowerCase()}s`,
  ];

  for (const key of kandidaten) {
    if (Array.isArray(responseJson?.[key])) {
      return key;
    }
  }

  const dynKey = Object.keys(responseJson || {}).find((k) => Array.isArray(responseJson[k]));
  return dynKey || `${type}s`;
}

function childArrayVoorRol(selectedEntiteit, rolnaam, jsonRolnaam) {
  const directeKandidaten = [jsonRolnaam, rolnaam].filter(Boolean);
  for (const kandidaat of directeKandidaten) {
    const direct = selectedEntiteit?.[kandidaat];
    if (Array.isArray(direct)) {
      return direct;
    }
  }

  const direct = selectedEntiteit?.[rolnaam];
  if (Array.isArray(direct)) {
    return direct;
  }

  const key = Object.keys(selectedEntiteit || {}).find((k) => k.toLowerCase() === String(rolnaam).toLowerCase());
  if (!key) {
    return [];
  }
  return safeArray(selectedEntiteit[key]);
}

function labelVoorChildType(doeltype, rolnaam, klassenaam) {
  return String(klassenaam || doeltype || rolnaam || "?");
}

function labelVoorTypeNaam(typeNaam, typeMetaByTypenaam, fallback = "-") {
  const naam = String(typeNaam || "").trim();
  if (!naam) return fallback;
  const meta = typeMetaByTypenaam?.[naam] || null;
  return String(meta?.klassenaam || meta?.typenaam || naam);
}

function leidEntiteitTypeAfUitRegistratie(registratie, beschikbareEntiteitTypen) {
  const wijzigingen = safeArray(registratie?.wijzigingen);
  const beschikbareNamen = new Set(
    safeArray(beschikbareEntiteitTypen)
      .map((item) => String(item?.typenaam || "").trim())
      .filter(Boolean)
  );

  for (const wijziging of wijzigingen) {
    const kandidaat = String(wijziging?.entiteitnaam || "").trim();
    if (kandidaat && beschikbareNamen.has(kandidaat)) {
      return kandidaat;
    }
  }

  return "";
}

async function fetchVizSchema(baseUrl) {
  const res = await fetch(`${baseUrl}/api/viz/schema`);
  if (!res.ok) {
    throw new Error(`Schema HTTP ${res.status}: ${res.statusText}`);
  }
  return await res.json();
}

async function fetchVizEntiteitMaxID(baseUrl, typeNaam) {
  const res = await fetch(`${baseUrl}/api/viz/entiteit/${encodeURIComponent(typeNaam)}/max-id`);
  if (!res.ok) {
    throw new Error(`Max-id HTTP ${res.status}: ${res.statusText}`);
  }
  return await res.json();
}

export default function IndexSchemaPage() {
  const [baseUrl, setBaseUrl] = useState(import.meta.env.VITE_API_BASE_URL || window.location.origin);
  const [entiteitType, setEntiteitType] = useState("A");
  const [t, setT] = useState(1);
  const [registratieId, setRegistratieId] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [responseData, setResponseData] = useState(null);
  const [responseKey, setResponseKey] = useState("As");
  const [registratieData, setRegistratieData] = useState(null);
  const [ongedaanGemaakteRegistratieData, setOngedaanGemaakteRegistratieData] = useState(null);
  const [selectedEntiteitId, setSelectedEntiteitId] = useState("");
  const [vizSchema, setVizSchema] = useState(null);
  const [schemaError, setSchemaError] = useState("");
  const [geselecteerdeRep, setGeselecteerdeRep] = useState(null);
  const [entiteitActieOpen, setEntiteitActieOpen] = useState(false);
  const [nieuweEntiteitActieOpen, setNieuweEntiteitActieOpen] = useState(false);
  const [nieuweEntiteitID, setNieuweEntiteitID] = useState("");
  const [nieuweEntiteitIDInfo, setNieuweEntiteitIDInfo] = useState({ loading: false, maxId: null, nextId: null, error: "" });
  const [entiteitNieuweGegevens, setEntiteitNieuweGegevens] = useState([]);
  const [entiteitNieuweRelaties, setEntiteitNieuweRelaties] = useState([]);
  const [nieuweEntiteitGegevens, setNieuweEntiteitGegevens] = useState([]);
  const [nieuweEntiteitRelaties, setNieuweEntiteitRelaties] = useState([]);
  const [entiteitNieuweGegevensVolgendId, setEntiteitNieuweGegevensVolgendId] = useState(1);
  const [entiteitNieuweRelatiesVolgendId, setEntiteitNieuweRelatiesVolgendId] = useState(1);
  const [nieuweEntiteitGegevensVolgendId, setNieuweEntiteitGegevensVolgendId] = useState(1);
  const [nieuweEntiteitRelatiesVolgendId, setNieuweEntiteitRelatiesVolgendId] = useState(1);
  const [relatieSecondaireOpties, setRelatieSecondaireOpties] = useState({});
  const [actieOpmerking, setActieOpmerking] = useState("");
  const [nieuweEntiteitOpmerking, setNieuweEntiteitOpmerking] = useState("");
  const [nieuweEntiteitOpmerkingAangepast, setNieuweEntiteitOpmerkingAangepast] = useState(false);
  // Materiële tijd: datumvelden voor aanvang/einde bij het opvoeren van een nieuwe entiteit.
  const [nieuweEntiteitAanvang, setNieuweEntiteitAanvang] = useState("");
  const [nieuweEntiteitEinde, setNieuweEntiteitEinde] = useState("");
  // Materiële tijd: datumvelden voor aanvang/einde bij het opvoeren onder een bestaande entiteit.
  const [entiteitAanvangDatum, setEntiteitAanvangDatum] = useState("");
  const [entiteitEindeDatum, setEntiteitEindeDatum] = useState("");
  // Materiële tijd: datumvelden voor aanvang/einde bij het corrigeren van een materiële hub-GE of REL.
  const [repAanvangDatum, setRepAanvangDatum] = useState("");
  const [repEindeDatum, setRepEindeDatum] = useState("");
  const [actieFormVelden, setActieFormVelden] = useState({});
  const [actieBezig, setActieBezig] = useState(false);
  const [nieuweEntiteitBezig, setNieuweEntiteitBezig] = useState(false);
  const [actieResultaat, setActieResultaat] = useState(null);
  const [nieuweEntiteitResultaat, setNieuweEntiteitResultaat] = useState(null);

  const nieuweEntiteitFormRef = useRef(null);
  const registratieActieFormRef = useRef(null);

  const [registratieActieOpen, setRegistratieActieOpen] = useState(false);
  const [registratieActieBezig, setRegistratieActieBezig] = useState(false);
  const [registratieActieResultaat, setRegistratieActieResultaat] = useState(null);
  const [registratieActieOpmerking, setRegistratieActieOpmerking] = useState("");
  const [registratieOngedaanBevestiging, setRegistratieOngedaanBevestiging] = useState(false);
  const [registratieCorrigeerActief, setRegistratieCorrigeerActief] = useState(false);
  const [registratieCorrigeerVelden, setRegistratieCorrigeerVelden] = useState({});
  const [overlayOffsets, setOverlayOffsets] = useState({
    nieuweEntiteit: { x: 0, y: 0 },
    registratie: { x: 0, y: 0 },
    entiteit: { x: 0, y: 0 },
    representatie: { x: 0, y: 0 },
  });

  const overlayDragRef = useRef(null);

  const selectedRegistratie = registratieData;
  const selectedRegistratieWijzigingen = safeArray(selectedRegistratie?.wijzigingen);

  const entiteitTypen = useMemo(() => {
    const allTypes = safeArray(vizSchema?.types);
    return allTypes.filter((item) => String(item.metatype) === "entiteit");
  }, [vizSchema]);

  const typeMetaByTypenaam = useMemo(() => {
    const result = {};
    safeArray(vizSchema?.types).forEach((item) => {
      if (item?.typenaam) {
        result[item.typenaam] = item;
      }
    });
    return result;
  }, [vizSchema]);

        const selectedEntiteitMeta = useMemo(
          () => entiteitTypen.find((item) => item.typenaam === entiteitType) || null,
          [entiteitTypen, entiteitType]
        );

        const as = safeArray(responseData?.[responseKey]);
        const selectedA = useMemo(() => as.find((item) => String(item.id) === String(selectedEntiteitId)) || null, [as, selectedEntiteitId]);

        const startOverlayDrag = (overlayKey) => (event) => {
          if (event.button !== 0) {
            return;
          }
          const huidigOffset = overlayOffsets[overlayKey] || { x: 0, y: 0 };
          overlayDragRef.current = {
            overlayKey,
            startX: event.clientX,
            startY: event.clientY,
            originX: huidigOffset.x,
            originY: huidigOffset.y,
          };
          event.preventDefault();
        };

        const overlayDialogStyle = (overlayKey, extraStyle = null) => {
          const offset = overlayOffsets[overlayKey] || { x: 0, y: 0 };
          return {
            transform: `translate(${offset.x}px, ${offset.y}px)`,
            cursor: overlayDragRef.current?.overlayKey === overlayKey ? 'grabbing' : undefined,
            ...extraStyle,
          };
        };

        useEffect(() => {
          const handleMouseMove = (event) => {
            const dragState = overlayDragRef.current;
            if (!dragState) {
              return;
            }

            setOverlayOffsets((current) => ({
              ...current,
              [dragState.overlayKey]: {
                x: dragState.originX + (event.clientX - dragState.startX),
                y: dragState.originY + (event.clientY - dragState.startY),
              },
            }));
          };

          const stopDrag = () => {
            overlayDragRef.current = null;
          };

          window.addEventListener('mousemove', handleMouseMove);
          window.addEventListener('mouseup', stopDrag);
          return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', stopDrag);
          };
        }, []);

        const childGroups = useMemo(() => {
          const skeleton = safeArray(selectedEntiteitMeta?.onderliggende).map((child) => {
            const childTypeMeta = typeMetaByTypenaam[child.doeltype] || null;
            // v06 hub+data: als het child-type een hub is, plat slaan zodat
            // inhoudsvelden van het actieve data-record direct beschikbaar zijn.
            const rawItems = selectedA ? childArrayVoorRol(selectedA, child.rolnaam, child.jsonRolnaam) : [];
            const items = childTypeMeta?.ge_subtype === 'hub'
              ? platSlaHubItems(rawItems, childTypeMeta, typeMetaByTypenaam)
              : rawItems;
            return {
              typeMeta: childTypeMeta,
              rolnaam: child.rolnaam,
              jsonRolnaam: child.jsonRolnaam || '',
              doeltype: child.doeltype,
              metatype: String(childTypeMeta?.metatype || ''),
              kleur: String(childTypeMeta?.kleur || ''),
              secondaireEntiteitIDKolom: String(childTypeMeta?.secondaireEntiteitIDKolom || ''),
              items,
            };
          });

          if (skeleton.length > 0) {
            return skeleton;
          }

          if (!selectedA) {
            return [];
          }

          return Object.keys(selectedA)
            .filter((k) => Array.isArray(selectedA[k]))
            .map((k) => ({
              rolnaam: k,
              doeltype: String(k).replace(/s$/i, '').toUpperCase(),
              metatype: '',
              kleur: '',
              secondaireEntiteitIDKolom: '',
              items: safeArray(selectedA[k]),
            }));
        }, [selectedA, selectedEntiteitMeta, typeMetaByTypenaam]);

        const childGroupsGesorteerd = useMemo(() => {
          const rank = (group) => {
            const metatype = String(group?.metatype || '').toLowerCase();
            if (metatype === 'gegevenselement') {
              return 1;
            }
            if (metatype === 'relatie') {
              return 2;
            }
            return 3;
          };

          // Materiële tijd: filter aanvang/einde plumbing-types uit de reguliere weergave.
          // Deze worden niet als GE-kaarten getoond, maar als "oortjes" boven de entiteitskaart.
          // Herkenning: plumbing-types hebben een bovenliggendTypenaam in de schema-metadata.
          return [...childGroups]
            .filter((group) => !typeMetaByTypenaam[group.doeltype]?.bovenliggendTypenaam)
            .sort((a, b) => rank(a) - rank(b));
        }, [childGroups, typeMetaByTypenaam]);

        // Materiële "oortjes": de actieve aanvang- en einddatum voor de geselecteerde entiteit.
        // Actief = het item zonder afvoer (er is maximaal één actief per entiteit, want enkelvoudig).
        // Geeft item + group terug zodat de oortjes klikbaar zijn als GE (selecteerRep opent bewerkformulier).
        const entiteitOortjes = useMemo(() => {
          if (!selectedA || !selectedEntiteitMeta?.isMaterieel) return { aanvang: null, einde: null };
          const aanvangGroep = childGroups.find((g) => g.doeltype?.endsWith("_Aanvang") && typeMetaByTypenaam[g.doeltype]?.bovenliggendTypenaam);
          const eindeGroep = childGroups.find((g) => g.doeltype?.endsWith("_Einde") && typeMetaByTypenaam[g.doeltype]?.bovenliggendTypenaam);
          const actiefItem = (items) => safeArray(items).find((item) => !item.afvoer) || null;
          const aanvangItem = actiefItem(aanvangGroep?.items);
          const eindeItem = actiefItem(eindeGroep?.items);
          return {
            aanvang: aanvangItem ? { item: aanvangItem, group: aanvangGroep, datum: aanvangItem.datum } : null,
            einde: eindeItem ? { item: eindeItem, group: eindeGroep, datum: eindeItem.datum } : null,
          };
        }, [selectedA, selectedEntiteitMeta, childGroups, typeMetaByTypenaam]);

        // Materiële-tijd metadata: veldnaam en entiteitIDKolom van de aanvang/einde plumbing-groepen.
        // Gebruikt door de opvoer-payloads om aanvang/einde wijzigingen toe te voegen.
        const materieleTijdMeta = useMemo(() => {
          if (!selectedEntiteitMeta?.isMaterieel) return null;
          const aanvangGroep = childGroups.find((g) => g.doeltype?.endsWith("_Aanvang") && typeMetaByTypenaam[g.doeltype]?.bovenliggendTypenaam);
          const eindeGroep = childGroups.find((g) => g.doeltype?.endsWith("_Einde") && typeMetaByTypenaam[g.doeltype]?.bovenliggendTypenaam);
          if (!aanvangGroep && !eindeGroep) return null;
          return {
            aanvangVeldnaam: aanvangGroep?.typeMeta?.veldnaam || null,
            eindeVeldnaam: eindeGroep?.typeMeta?.veldnaam || null,
            aanvangEntiteitIDKolom: aanvangGroep?.typeMeta?.entiteitIDKolom || null,
            eindeEntiteitIDKolom: eindeGroep?.typeMeta?.entiteitIDKolom || null,
          };
        }, [selectedEntiteitMeta, childGroups, typeMetaByTypenaam]);

        // Materiële-tijd meta voor de geselecteerde hub-GE/REL (indien materieel).
        // Zoekt de _Aanvang en _Einde kinderen van het hubtype in de schema metadata.
        const repMaterieleTijdMeta = useMemo(() => {
          if (!geselecteerdeRep) return null;
          const hubMeta = typeMetaByTypenaam?.[geselecteerdeRep.group?.doeltype];
          if (!hubMeta?.isMaterieel || hubMeta?.ge_subtype !== "hub") return null;
          const onderliggende = safeArray(hubMeta.onderliggende);
          const aanvangChild = onderliggende.find((o) => o.doeltype?.endsWith("_Aanvang"));
          const eindeChild = onderliggende.find((o) => o.doeltype?.endsWith("_Einde"));
          const aanvangTypeMeta = aanvangChild ? typeMetaByTypenaam[aanvangChild.doeltype] : null;
          const eindeTypeMeta = eindeChild ? typeMetaByTypenaam[eindeChild.doeltype] : null;
          if (!aanvangTypeMeta && !eindeTypeMeta) return null;
          return {
            aanvangVeldnaam: aanvangTypeMeta?.veldnaam || null,
            eindeVeldnaam: eindeTypeMeta?.veldnaam || null,
            aanvangEntiteitIDKolom: aanvangTypeMeta?.entiteitIDKolom || null,
            eindeEntiteitIDKolom: eindeTypeMeta?.entiteitIDKolom || null,
          };
        }, [geselecteerdeRep, typeMetaByTypenaam]);

        const gegevenselementGroepOpties = useMemo(() => {
          return childGroupsGesorteerd
            .filter((group) => String(group?.metatype || '').toLowerCase() === 'gegevenselement')
            .map((group) => {
              const groupKey = `${group.rolnaam}__${group.doeltype}`;
              const voorbeeld = safeArray(group.items)[0] || {};
              const entKolom = String(group?.typeMeta?.entiteitIDKolom || '').toLowerCase();
              const idKolom = String(group?.typeMeta?.idKolom || '').toLowerCase();
              const schemaVeldDefinities = safeArray(group?.typeMeta?.velden)
                .filter((veld) => {
                  if (!veld) return false;
                  const naam = String(veld.naam || '').toLowerCase();
                  if (TEMPORALE_PLUMBING_VELDEN.has(naam)) return false;
                  if (entKolom && naam === entKolom) return false;
                  if (veld.autoIncrement) return false;
                  return true;
                })
                .map((veld) => ({
                  naam: String(veld.naam || ''),
                  description: String(veld.description || ''),
                  type: String(veld.type || 'string'),
                  format: String(veld.format || ''),
                  enum: safeArray(veld.enum).map((waarde) => String(waarde || '')).filter(Boolean),
                  defaultValue: '',
                  verplicht: Boolean(veld.verplicht),
                }))
                .filter((veld) => veld.naam);
              const afgeleideVeldDefinities = veldEntries(voorbeeld)
                .filter(([k]) => {
                  const naam = k.toLowerCase();
                  if (TEMPORALE_PLUMBING_VELDEN.has(naam)) return false;
                  if (entKolom && naam === entKolom) return false;
                  if (idKolom && naam === idKolom) return false;
                  return true;
                })
                .map(([k, v]) => ({
                  naam: k,
                  type: typeof v,
                  format: '',
                  defaultValue: v === null || v === undefined ? '' : String(v),
                }));
              const veldDefinities = schemaVeldDefinities.length > 0 ? schemaVeldDefinities : afgeleideVeldDefinities;
              return {
                groupKey,
                group,
                label: labelVoorChildType(group.doeltype, group.rolnaam, group.typeMeta?.klassenaam),
                geVeldnaam: String(group?.typeMeta?.veldnaam || group.doeltype.toLowerCase()),
                entiteitIDKolom: String(group?.typeMeta?.entiteitIDKolom || ''),
                isMaterieel: Boolean(group?.typeMeta?.isMaterieel && group?.typeMeta?.ge_subtype === 'hub'),
                veldDefinities,
              };
            });
        }, [childGroupsGesorteerd]);

        const relatieGroepOpties = useMemo(() => {
          return childGroupsGesorteerd
            .filter((group) => String(group?.metatype || '').toLowerCase() === 'relatie')
            .map((group) => {
              const groupKey = `${group.rolnaam}__${group.doeltype}`;
              const primaireKolom = String(group?.typeMeta?.entiteitIDKolom || '').toLowerCase();
              const secondaireKolom = String(group?.typeMeta?.secondaireEntiteitIDKolom || '');
              const idKolom = String(group?.typeMeta?.idKolom || '').toLowerCase();

              const voorbeeld = safeArray(group.items)[0] || {};
              const schemaVeldDefinities = safeArray(group?.typeMeta?.velden)
                .filter((veld) => {
                  if (!veld) return false;
                  const naam = String(veld.naam || '').toLowerCase();
                  if (TEMPORALE_PLUMBING_VELDEN.has(naam)) return false;
                  if (primaireKolom && naam === primaireKolom) return false;
                  if (veld.autoIncrement) return false;
                  return true;
                })
                .map((veld) => ({
                  naam: String(veld.naam || ''),
                  description: String(veld.description || ''),
                  type: String(veld.type || 'string'),
                  format: String(veld.format || ''),
                  enum: safeArray(veld.enum).map((waarde) => String(waarde || '')).filter(Boolean),
                  defaultValue: '',
                  verplicht: Boolean(veld.verplicht),
                }))
                .filter((veld) => veld.naam);
              const afgeleideVeldDefinities = veldEntries(voorbeeld)
                .filter(([k]) => {
                  const naam = k.toLowerCase();
                  if (TEMPORALE_PLUMBING_VELDEN.has(naam)) return false;
                  if (primaireKolom && naam === primaireKolom) return false;
                  if (idKolom && naam === idKolom) return false;
                  return true;
                })
                .map(([k, v]) => ({
                  naam: k,
                  type: typeof v,
                  format: '',
                  defaultValue: v === null || v === undefined ? '' : String(v),
                }));
              const veldDefinities = schemaVeldDefinities.length > 0 ? schemaVeldDefinities : afgeleideVeldDefinities;

              return {
                groupKey,
                group,
                label: labelVoorChildType(group.doeltype, group.rolnaam, group.typeMeta?.klassenaam),
                geVeldnaam: String(group?.typeMeta?.veldnaam || group.doeltype.toLowerCase()),
                entiteitIDKolom: String(group?.typeMeta?.entiteitIDKolom || ''),
                secondaireEntiteitIDKolom: secondaireKolom,
                isMaterieel: Boolean(group?.typeMeta?.isMaterieel && group?.typeMeta?.ge_subtype === 'hub'),
                veldDefinities,
              };
            });
        }, [childGroupsGesorteerd]);

        const geNodesVoorGrafiek = useMemo(() => {
          const geGroups = childGroupsGesorteerd.filter((group) => String(group?.metatype || '').toLowerCase() !== 'relatie');
          const nodes = [];
          const startY = 65;
          const binnenGroepStap = 74;
          const tussenGroepMarge = 38;
          let leftY = startY;
          let rightY = startY;

          geGroups.forEach((group, groupIndex) => {
            const side = groupIndex % 2 === 0 ? 'left' : 'right';
            const items = safeArray(group.items);

            items.forEach((item, index) => {
              const baseY = side === 'left' ? leftY : rightY;
              nodes.push({
                side,
                y: baseY + (index * binnenGroepStap),
                group,
                item,
                key: `${group.rolnaam}-${index}`,
              });
            });

            const groephoogte = items.length > 0 ? (items.length * binnenGroepStap) : 0;
            if (side === 'left') {
              leftY += groephoogte + tussenGroepMarge;
            } else {
              rightY += groephoogte + tussenGroepMarge;
            }
          });

          return nodes;
        }, [childGroupsGesorteerd]);

        const geGroepenVoorGrafiek = useMemo(() => {
          const byKey = new Map();

          geNodesVoorGrafiek.forEach((node) => {
            const key = `${node.group.rolnaam}__${node.group.doeltype}`;
            if (!byKey.has(key)) {
              byKey.set(key, {
                key,
                side: node.side,
                group: node.group,
                ys: [],
              });
            }
            byKey.get(key).ys.push(node.y);
          });

          return Array.from(byKey.values())
            .map((group) => ({
              ...group,
              ys: [...group.ys].sort((a, b) => a - b),
            }))
            .sort((a, b) => {
              if (a.side !== b.side) {
                return a.side === 'left' ? -1 : 1;
              }
              return (a.ys[0] || 0) - (b.ys[0] || 0);
            });
        }, [geNodesVoorGrafiek]);

        const geGroepenMetLayout = useMemo(() => {
          const leftStartX = 248;
          const leftMaxX = 320;
          const rightStartX = 652;
          const rightMinX = 580;
          const inwardStep = 18;
          const basisFromY = 64;
          const anchorY = 80;

          let leftIndex = 0;
          let rightIndex = 0;

          return geGroepenVoorGrafiek.map((group) => {
            const isLeft = group.side === 'left';
            const index = isLeft ? leftIndex : rightIndex;
            const minY = group.ys[0] || basisFromY;
            const fromY = index === 0 ? minY : anchorY;

            let branchX;
            if (isLeft) {
              branchX = Math.min(leftStartX + (index * inwardStep), leftMaxX);
              leftIndex += 1;
            } else {
              branchX = Math.max(rightStartX - (index * inwardStep), rightMinX);
              rightIndex += 1;
            }

            return {
              ...group,
              sideIndex: index,
              fromX: isLeft ? 330 : 570,
              anchorY,
              fromY,
              targetX: isLeft ? 210 : 690,
              branchX,
            };
          });
        }, [geGroepenVoorGrafiek]);

        const relatieNodesVoorGrafiek = useMemo(() => {
          const relatieGroups = childGroupsGesorteerd.filter((group) => String(group?.metatype || '').toLowerCase() === 'relatie');
          const nodes = [];
          let relIndex = 0;
          // Zelfde verticale afstand als tussen GE-groepen:
          // effectieve box-gap = (binnenGroepStap + tussenGroepMarge) - boxHoogte.
          const binnenGroepStap = 74;
          const tussenGroepMarge = 38;
          const geBoxHoogte = 60;
          const centraleEntiteitBottomY = 120;
          const relatieBoxHalveHoogte = 24;
          const geGroepVerticaleGap = (binnenGroepStap + tussenGroepMarge) - geBoxHoogte;
          const relatieTopY = centraleEntiteitBottomY + geGroepVerticaleGap;
          const relatieStartY = relatieTopY + relatieBoxHalveHoogte;

          relatieGroups.forEach((group) => {
            safeArray(group.items).forEach((item, index) => {
              const secondaireKolom = String(group?.secondaireEntiteitIDKolom || '');
              const tweedeEntiteitID = secondaireKolom ? item?.[secondaireKolom] : null;
              const tweedeEntiteitType = leidEntiteitTypeAfUitKolomnaam(secondaireKolom, entiteitTypen);
              const tweedeEntiteitKleur = tweedeEntiteitType ? String(typeMetaByTypenaam[tweedeEntiteitType]?.kleur || '') : '';
              const tweedeEntiteitRandkleur = tweedeEntiteitKleur ? donkerdereRandkleurVanHex(tweedeEntiteitKleur) : '#1e3a8a';
              const tweedeEntiteitIDTekst = (tweedeEntiteitID === null || tweedeEntiteitID === undefined || tweedeEntiteitID === '') ? '' : String(tweedeEntiteitID);
              const tweedeEntiteitLabel = (tweedeEntiteitID !== null && tweedeEntiteitID !== undefined && tweedeEntiteitID !== '')
                ? `${tweedeEntiteitType || 'Ent'} id=${tweedeEntiteitID}`
                : '';

              nodes.push({
                y: relatieStartY + (relIndex * 82),
                group,
                item,
                tweedeEntiteitLabel,
                tweedeEntiteitType,
                tweedeEntiteitIDTekst,
                tweedeEntiteitKleur,
                tweedeEntiteitRandkleur,
                key: `${group.rolnaam}-${index}`,
              });
              relIndex += 1;
            });
          });

          return nodes;
        }, [childGroupsGesorteerd, entiteitTypen]);

        const svgHoogte = useMemo(() => {
          const geBottom = geNodesVoorGrafiek.reduce((max, node) => Math.max(max, node.y + 32), 130);
          const relBottom = relatieNodesVoorGrafiek.reduce((max, node) => Math.max(max, node.y + 50), 130);
          return Math.max(350, Math.min(900, Math.max(geBottom, relBottom) + 24));
        }, [geNodesVoorGrafiek, relatieNodesVoorGrafiek]);

        // Live preview van de te versturen payload voor de GE-opvoer in de entiteit-actiebox.
        const entiteitOpvoerPreview = useMemo(() => {
          if (!selectedA || !selectedEntiteitMeta) return null;
          try {
            const entiteitVeldnaam = selectedEntiteitMeta.veldnaam || String(entiteitType || '').toLowerCase();
            const opmerking = actieOpmerking.trim() || undefined;
            const registratie = { registratietype: 'registratie', ...(opmerking ? { opmerking } : {}) };
            // Eén opvoer-wijziging per GE/relatie-rij, met de representatie eigen veldnaam.
            const alleRijen = [
              ...entiteitNieuweGegevens.map((row) => ({ row, opties: gegevenselementGroepOpties })),
              ...entiteitNieuweRelaties.map((row) => ({ row, opties: relatieGroepOpties })),
            ];
            const wijzigingen = alleRijen.map(({ row, opties }) => {
              const optie = opties.find((o) => o.groupKey === row.groupKey);
              if (!optie) throw new Error('Onbekend type in entiteit-opvoer.');
              const item = {};
              if (optie.entiteitIDKolom) item[optie.entiteitIDKolom] = selectedA.id;
              safeArray(optie.veldDefinities).forEach((veld) => {
                const raw = row?.values?.[veld.naam];
                if (raw === undefined || raw === null || raw === '') return;
                item[veld.naam] = coercedWaardeVoorVeld(raw, veld, `${optie.label}.${veld.naam}`);
              });
              vulMaterieleTijdVoorHubInput(item, row, optie);
              return { opvoer: { [optie.geVeldnaam]: item } };
            });
            // Materiële tijd: voeg aanvang/einde opvoer-wijzigingen toe als de datums zijn ingevuld.
            if (materieleTijdMeta && entiteitAanvangDatum) {
              const mtItem = {};
              if (materieleTijdMeta.aanvangEntiteitIDKolom) mtItem[materieleTijdMeta.aanvangEntiteitIDKolom] = selectedA.id;
              mtItem.datum = entiteitAanvangDatum;
              wijzigingen.push({ opvoer: { [materieleTijdMeta.aanvangVeldnaam]: mtItem } });
            }
            if (materieleTijdMeta && entiteitEindeDatum) {
              const mtItem = {};
              if (materieleTijdMeta.eindeEntiteitIDKolom) mtItem[materieleTijdMeta.eindeEntiteitIDKolom] = selectedA.id;
              mtItem.datum = entiteitEindeDatum;
              wijzigingen.push({ opvoer: { [materieleTijdMeta.eindeVeldnaam]: mtItem } });
            }
            return { ok: true, payload: { registratie, wijzigingen } };
          } catch (err) {
            return { ok: false, fout: String(err?.message || err) };
          }
        }, [selectedA, selectedEntiteitMeta, entiteitType, entiteitNieuweGegevens, entiteitNieuweRelaties, actieOpmerking, gegevenselementGroepOpties, relatieGroepOpties, materieleTijdMeta, entiteitAanvangDatum, entiteitEindeDatum]);

        const nieuweEntiteitOpvoerPreview = useMemo(() => {
          if (!selectedEntiteitMeta) return null;
          try {
            const entiteitVeldnaam = selectedEntiteitMeta.veldnaam || String(entiteitType || '').toLowerCase();
            const opmerking = nieuweEntiteitOpmerking.trim() || undefined;
            const registratie = { registratietype: 'registratie', ...(opmerking ? { opmerking } : {}) };
            const idNummer = Number(nieuweEntiteitID);
            if (!Number.isInteger(idNummer) || idNummer <= 0) {
              throw new Error('Entiteit-id moet een positief geheel getal zijn.');
            }

            const wijzigingen = [{ opvoer: { [entiteitVeldnaam]: { id: idNummer } } }];

            const alleRijen = [
              ...nieuweEntiteitGegevens.map((row) => ({ row, opties: gegevenselementGroepOpties })),
              ...nieuweEntiteitRelaties.map((row) => ({ row, opties: relatieGroepOpties })),
            ];

            alleRijen.forEach(({ row, opties }) => {
              const optie = opties.find((o) => o.groupKey === row.groupKey);
              if (!optie) throw new Error('Onbekend type in nieuwe-entiteit-opvoer.');
              const item = {};
              if (optie.entiteitIDKolom) item[optie.entiteitIDKolom] = idNummer;
              safeArray(optie.veldDefinities).forEach((veld) => {
                const raw = row?.values?.[veld.naam];
                if (raw === undefined || raw === null || raw === '') return;
                item[veld.naam] = coercedWaardeVoorVeld(raw, veld, `${optie.label}.${veld.naam}`);
              });
              vulMaterieleTijdVoorHubInput(item, row, optie);
              wijzigingen.push({ opvoer: { [optie.geVeldnaam]: item } });
            });

            // Materiële tijd: voeg aanvang/einde opvoer-wijzigingen toe als de datums zijn ingevuld.
            if (materieleTijdMeta && nieuweEntiteitAanvang) {
              const mtItem = {};
              if (materieleTijdMeta.aanvangEntiteitIDKolom) mtItem[materieleTijdMeta.aanvangEntiteitIDKolom] = idNummer;
              mtItem.datum = nieuweEntiteitAanvang;
              wijzigingen.push({ opvoer: { [materieleTijdMeta.aanvangVeldnaam]: mtItem } });
            }
            if (materieleTijdMeta && nieuweEntiteitEinde) {
              const mtItem = {};
              if (materieleTijdMeta.eindeEntiteitIDKolom) mtItem[materieleTijdMeta.eindeEntiteitIDKolom] = idNummer;
              mtItem.datum = nieuweEntiteitEinde;
              wijzigingen.push({ opvoer: { [materieleTijdMeta.eindeVeldnaam]: mtItem } });
            }

            return { ok: true, payload: { registratie, wijzigingen } };
          } catch (err) {
            return { ok: false, fout: String(err?.message || err) };
          }
        }, [selectedEntiteitMeta, entiteitType, nieuweEntiteitOpmerking, nieuweEntiteitID, nieuweEntiteitGegevens, nieuweEntiteitRelaties, gegevenselementGroepOpties, relatieGroepOpties, materieleTijdMeta, nieuweEntiteitAanvang, nieuweEntiteitEinde]);

        useEffect(() => {
          if (!nieuweEntiteitActieOpen || !entiteitType) {
            return;
          }

          let cancelled = false;
          setNieuweEntiteitIDInfo({ loading: true, maxId: null, nextId: null, error: '' });

          fetchVizEntiteitMaxID(baseUrl, entiteitType)
            .then((json) => {
              if (cancelled) return;
              const nextID = Number(json?.nextId || 1);
              setNieuweEntiteitIDInfo({ loading: false, maxId: Number(json?.maxId || 0), nextId: nextID, error: '' });
              setNieuweEntiteitID(String(nextID));
            })
            .catch((err) => {
              if (cancelled) return;
              setNieuweEntiteitIDInfo({ loading: false, maxId: null, nextId: null, error: String(err?.message || err) });
            });

          return () => {
            cancelled = true;
          };
        }, [baseUrl, entiteitType, nieuweEntiteitActieOpen]);

        const defaultNieuweEntiteitOpmerking = useMemo(() => {
          const idTekst = String(nieuweEntiteitID || '').trim();
          return `Nieuwe ${entiteitType || 'Entiteit'}=${idTekst || '?'}`;
        }, [entiteitType, nieuweEntiteitID]);

        useEffect(() => {
          if (!nieuweEntiteitActieOpen || nieuweEntiteitOpmerkingAangepast) {
            return;
          }
          setNieuweEntiteitOpmerking(defaultNieuweEntiteitOpmerking);
        }, [nieuweEntiteitActieOpen, nieuweEntiteitOpmerkingAangepast, defaultNieuweEntiteitOpmerking]);

        useEffect(() => {
          if (!nieuweEntiteitActieOpen) {
            return;
          }
          const node = nieuweEntiteitFormRef.current;
          if (!node || typeof node.scrollIntoView !== 'function') {
            return;
          }
          node.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, [nieuweEntiteitActieOpen]);

        useEffect(() => {
          if (!registratieActieOpen) return;
          const node = registratieActieFormRef.current;
          if (!node || typeof node.scrollIntoView !== 'function') return;
          node.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, [registratieActieOpen]);

        useEffect(() => {
          setRegistratieActieOpen(false);
          setRegistratieCorrigeerActief(false);
          setRegistratieOngedaanBevestiging(false);
        }, [registratieId]);

        useEffect(() => {
          const repIsRelatie = !!geselecteerdeRep && String(geselecteerdeRep.group?.metatype || '').toLowerCase() === 'relatie';
          if (!entiteitActieOpen && !nieuweEntiteitActieOpen && !repIsRelatie && !registratieCorrigeerActief) {
            return;
          }

          const teLaden = relatieGroepOpties.filter((optie) => {
            if (!optie.secondaireEntiteitIDKolom) {
              return false;
            }
            return !relatieSecondaireOpties[optie.groupKey];
          });

          if (teLaden.length === 0) {
            return;
          }

          teLaden.forEach((optie) => {
            setRelatieSecondaireOpties((prev) => ({
              ...prev,
              [optie.groupKey]: { loading: true, ids: [], error: '' },
            }));

            fetch(`${baseUrl}/api/viz/relatie/${encodeURIComponent(optie.group.doeltype)}/secondaire-ids`)
              .then((res) => res.json().then((json) => ({ ok: res.ok, json, status: res.status, statusText: res.statusText })))
              .then(({ ok, json, status, statusText }) => {
                if (!ok) {
                  throw new Error(json?.error || `HTTP ${status}: ${statusText}`);
                }
                setRelatieSecondaireOpties((prev) => ({
                  ...prev,
                  [optie.groupKey]: { loading: false, ids: safeArray(json?.ids), error: '' },
                }));
              })
              .catch((err) => {
                setRelatieSecondaireOpties((prev) => ({
                  ...prev,
                  [optie.groupKey]: { loading: false, ids: [], error: String(err?.message || err) },
                }));
              });
          });
        }, [baseUrl, entiteitActieOpen, nieuweEntiteitActieOpen, geselecteerdeRep, registratieCorrigeerActief, relatieGroepOpties, relatieSecondaireOpties]);

        function invalidateRelatieSecondaireOpties() {
          setRelatieSecondaireOpties({});
        }

        function bouwRepresentatieActiePayloads(item, group, actieVelden, opmerking) {
          const veldnaam = group.typeMeta?.veldnaam || group.doeltype.toLowerCase();
          const idKolom = String(group?.typeMeta?.idKolom || '');
          const entiteitIDKolom = String(group?.typeMeta?.entiteitIDKolom || '');

          const sleutelItem = {};
          if (idKolom && item[idKolom] !== undefined) {
            sleutelItem[idKolom] = item[idKolom];
          }
          if (entiteitIDKolom && item[entiteitIDKolom] !== undefined) {
            sleutelItem[entiteitIDKolom] = item[entiteitIDKolom];
          }
          if (!idKolom && item.rel_id !== undefined) {
            sleutelItem.rel_id = item.rel_id;
          } else if (!idKolom && item.id !== undefined) {
            sleutelItem.id = item.id;
          }

          const afvoerPayload = {
            registratie: { registratietype: 'registratie', ...(opmerking ? { opmerking } : {}) },
            wijzigingen: [{ afvoer: { [veldnaam]: sleutelItem } }],
          };

          const nieuwItem = { ...sleutelItem };
          let heeftWijziging = false;
          Object.entries(actieVelden || {}).forEach(([k, v]) => {
            const origineel = item[k];
            const veldDef = Array.isArray(group?.typeMeta?.velden)
              ? (group.typeMeta.velden.find((veld) => veld.naam === k) || { naam: k, type: typeof origineel, format: '' })
              : { naam: k, type: typeof origineel, format: '' };
            let nieuw = coercedWaardeVoorVeld(v, veldDef, `${labelVoorChildType(group.doeltype, group.rolnaam, group.typeMeta?.klassenaam)}.${k}`);
            if (nieuw !== origineel) {
              nieuwItem[k] = nieuw;
              heeftWijziging = true;
            }
          });

          const corrigeerPayload = {
            registratie: { registratietype: 'correctie', ...(opmerking ? { opmerking } : {}) },
            wijzigingen: [{ opvoer: { [veldnaam]: nieuwItem } }],
          };

          return { afvoerPayload, corrigeerPayload, heeftWijziging };
        }

        function bouwRepMaterieleTijdWijzigingen(item, group, meta, aanvangDatum, eindeDatum) {
          if (!meta) return [];

          const entIDKolom = String(group?.typeMeta?.entiteitIDKolom || '');
          const relID = item?.rel_id;
          const wijzigingen = [];

          function bouwMtItem(datum) {
            const mtItem = {};
            if (entIDKolom && item?.[entIDKolom] !== undefined) {
              mtItem[entIDKolom] = item[entIDKolom];
            }
            // Hub-kinderen (_Aanvang/_Einde) horen bij exact dezelfde hub-scope als de gekozen GE/REL.
            // Daarom moet rel_id van de hub expliciet mee; alleen versie mag op 0 blijven voor autoincrement.
            if (relID !== undefined && relID !== null) {
              mtItem.rel_id = relID;
            }
            mtItem.datum = datum;
            return mtItem;
          }

          if (meta.aanvangVeldnaam && aanvangDatum) {
            wijzigingen.push({ opvoer: { [meta.aanvangVeldnaam]: bouwMtItem(aanvangDatum) } });
          }
          if (meta.eindeVeldnaam && eindeDatum) {
            wijzigingen.push({ opvoer: { [meta.eindeVeldnaam]: bouwMtItem(eindeDatum) } });
          }

          return wijzigingen;
        }

        // Live preview voor de rep-actiebox (afvoer + correctie).
        const repActiePreview = useMemo(() => {
          if (!geselecteerdeRep) return null;
          const { item, group } = geselecteerdeRep;
          const opmerking = actieOpmerking.trim() || undefined;
          try {
            const { afvoerPayload, corrigeerPayload, heeftWijziging } = bouwRepresentatieActiePayloads(item, group, actieFormVelden, opmerking);
            const heeftMaterieleTijd = repMaterieleTijdMeta && (repAanvangDatum || repEindeDatum);
            if (!heeftWijziging && !heeftMaterieleTijd) {
              return { ok: false, fout: 'Geen gewijzigde velden voor correctie. Pas minimaal 1 veld aan.' };
            }
            corrigeerPayload.wijzigingen.push(
              ...bouwRepMaterieleTijdWijzigingen(item, group, repMaterieleTijdMeta, repAanvangDatum, repEindeDatum)
            );
            return { ok: true, afvoer: afvoerPayload, corrigeer: corrigeerPayload };
          } catch (err) {
            return { ok: false, fout: String(err?.message || err) };
          }
        }, [geselecteerdeRep, actieOpmerking, actieFormVelden, repMaterieleTijdMeta, repAanvangDatum, repEindeDatum]);

        useEffect(() => {
          let cancelled = false;

          async function loadSchema() {
            setSchemaError('');
            try {
              const schema = await fetchVizSchema(baseUrl);
              if (!cancelled) {
                setVizSchema(schema);
                const types = safeArray(schema?.types).filter((item) => String(item.metatype) === 'entiteit');
                if (types.length > 0 && !types.some((item) => item.typenaam === entiteitType)) {
                  setEntiteitType(types[0].typenaam);
                }
              }
            } catch (err) {
              if (!cancelled) {
                setVizSchema(null);
                setSchemaError(err instanceof Error ? err.message : String(err));
              }
            }
          }

          loadSchema();
          return () => {
            cancelled = true;
          };
        }, [baseUrl]);

        async function loadData({ tValue = t, registratieIdValue = registratieId, selecteerVanuitRegistratie = false, entiteitTypeValue = null, doelEntiteitIdValue = null } = {}) {
          let doelEntiteitType = entiteitTypeValue || entiteitType;
          setLoading(true);
          setError('');
          try {
            const doelRegistratieId = normaliseerNietNegatiefGeheelGetal(registratieIdValue, normaliseerNietNegatiefGeheelGetal(registratieId, 0));
            const defaultPeilmoment = normaliseerNietNegatiefGeheelGetal(tValue, normaliseerNietNegatiefGeheelGetal(t, 0));
            let peilmomentVoorEntiteiten = defaultPeilmoment;

            const registratieByIdUrl = `${baseUrl}/full/registraties/${encodeURIComponent(doelRegistratieId)}`;
            const registratieByIdRes = await fetch(registratieByIdUrl);

            if (!registratieByIdRes.ok && registratieByIdRes.status !== 404) {
              throw new Error(`Registratie HTTP ${registratieByIdRes.status}: ${registratieByIdRes.statusText}`);
            }

            let registratieJson = null;
            if (registratieByIdRes.ok) {
              registratieJson = await registratieByIdRes.json();
            }

            if (selecteerVanuitRegistratie && registratieJson?.tijdstip) {
              const afgeleidT = tUitRegistratieTijdstip(registratieJson.tijdstip);
              if (afgeleidT !== null) {
                peilmomentVoorEntiteiten = afgeleidT;
                setT(afgeleidT);
              }
            }

            if (selecteerVanuitRegistratie && registratieJson) {
              const afgeleidType = leidEntiteitTypeAfUitRegistratie(registratieJson, entiteitTypen);
              if (afgeleidType) {
                doelEntiteitType = afgeleidType;
                if (afgeleidType !== entiteitType) {
                  setEntiteitType(afgeleidType);
                }
              }
            }

            const segment = endpointSegmentVoorEntiteit(doelEntiteitType, entiteitTypen);
            const entiteitenUrl = `${baseUrl}/full/${segment}/?t=${encodeURIComponent(peilmomentVoorEntiteiten)}`;
            const entiteitenRes = await fetch(entiteitenUrl);

            if (!entiteitenRes.ok) {
              throw new Error(`Entiteiten HTTP ${entiteitenRes.status}: ${entiteitenRes.statusText}`);
            }

            const entiteitenJson = await entiteitenRes.json();
            const entiteitenKey = responseKeyVoorEntiteiten(doelEntiteitType, entiteitenJson);
            const entiteiten = safeArray(entiteitenJson?.[entiteitenKey]);

            let ongedaanGemaakteRegistratieJson = null;
            if (registratieJson?.registratietype === 'ongedaanmaking' && registratieJson?.maakt_ongedaan_registratie_id) {
              const doelId = registratieJson.maakt_ongedaan_registratie_id;
              const doelRes = await fetch(`${baseUrl}/full/registraties/${encodeURIComponent(doelId)}`);
              if (doelRes.ok) {
                ongedaanGemaakteRegistratieJson = await doelRes.json();
              }
            }

            setResponseData(entiteitenJson);
            setResponseKey(entiteitenKey);
            setRegistratieData(registratieJson);
            setOngedaanGemaakteRegistratieData(ongedaanGemaakteRegistratieJson);

            const entiteitIdVanuitRegistratie = vindEntiteitIdVanuitRegistratie(registratieJson, entiteiten, doelEntiteitType);
            setSelectedEntiteitId((vorigeEntiteitId) => {
              if (entiteiten.length === 0) {
                return '';
              }

              // Navigatie naar een specifieke entiteit (bijv. secondaire entiteit klik)
              if (doelEntiteitIdValue) {
                const heeftDoel = entiteiten.some((item) => String(item.id) === String(doelEntiteitIdValue));
                if (heeftDoel) return String(doelEntiteitIdValue);
              }

              if (selecteerVanuitRegistratie && entiteitIdVanuitRegistratie) {
                return entiteitIdVanuitRegistratie;
              }

              const heeftVorigeNog = entiteiten.some((item) => String(item.id) === String(vorigeEntiteitId));
              if (heeftVorigeNog) {
                return String(vorigeEntiteitId);
              }

              return String(entiteiten[0].id);
            });
          } catch (err) {
            setError(err.message || 'Onbekende fout bij ophalen data');
            setResponseData(null);
            setResponseKey(`${String(doelEntiteitType || entiteitType || '').toUpperCase()}s`);
            setRegistratieData(null);
            setOngedaanGemaakteRegistratieData(null);
            setSelectedEntiteitId('');
          } finally {
            setLoading(false);
          }
        }

        function incrementRegistratieAndReload() {
          if (loading) {
            return;
          }
          const currentRegistratieId = normaliseerNietNegatiefGeheelGetal(registratieId, 0);
          const nextRegistratieId = currentRegistratieId + 1;
          setRegistratieId(nextRegistratieId);
          loadData({ tValue: t, registratieIdValue: nextRegistratieId, selecteerVanuitRegistratie: true });
        }

        function decrementRegistratieAndReload() {
          if (loading) {
            return;
          }
          const currentRegistratieId = normaliseerNietNegatiefGeheelGetal(registratieId, 0);
          const nextRegistratieId = Math.max(0, currentRegistratieId - 1);
          setRegistratieId(nextRegistratieId);
          loadData({ tValue: t, registratieIdValue: nextRegistratieId, selecteerVanuitRegistratie: true });
        }

        function incrementTAndReload() {
          if (loading) {
            return;
          }
          const currentT = normaliseerNietNegatiefGeheelGetal(t, 0);
          const nextT = currentT + 1;
          setT(nextT);
          loadData({ tValue: nextT, registratieIdValue: registratieId, selecteerVanuitRegistratie: false });
        }

        function decrementTAndReload() {
          if (loading) {
            return;
          }
          const currentT = normaliseerNietNegatiefGeheelGetal(t, 0);
          const nextT = Math.max(0, currentT - 1);
          setT(nextT);
          loadData({ tValue: nextT, registratieIdValue: registratieId, selecteerVanuitRegistratie: false });
        }

        function selecteerRep(item, group) {
          const bewerkbaar = {};
          const secondaireKolom = String(group?.typeMeta?.secondaireEntiteitIDKolom || '');
          veldEntries(item)
            .filter(([k]) => !isPlumbingVeld(k, group?.typeMeta))
            .forEach(([k, v]) => { bewerkbaar[k] = v ?? ''; });
          setEntiteitActieOpen(false);
          setNieuweEntiteitActieOpen(false);
          setGeselecteerdeRep({ item, group });
          setActieFormVelden(bewerkbaar);
          setActieOpmerking('');
          setActieResultaat(null);
          setRepAanvangDatum('');
          setRepEindeDatum('');
        }

        function initialiseerGeWaardenVoorOptie(optie) {
          const values = {};
          safeArray(optie?.veldDefinities).forEach((veld) => {
            values[veld.naam] = veld.defaultValue;
          });
          if (optie?.isMaterieel) {
            values.aanvang = '';
            values.einde = '';
          }
          return values;
        }

        function vulMaterieleTijdVoorHubInput(item, row, optie) {
          if (!optie?.isMaterieel) {
            return;
          }
          const aanvang = String(row?.values?.aanvang || '').trim();
          const einde = String(row?.values?.einde || '').trim();
          if (aanvang) {
            item.aanvang = aanvang;
          }
          if (einde) {
            item.einde = einde;
          }
        }

        function isMeervoudigOptie(optie) {
          const mv = String(optie?.group?.typeMeta?.momentvoorkomen || optie?.group?.momentvoorkomen || '').toLowerCase();
          return mv === 'meervoudig';
        }

        function bouwInitieleRijenVoorOpties(opties, startId) {
          const rows = [];
          let nextId = startId;
          safeArray(opties).forEach((optie) => {
            const aantal = isMeervoudigOptie(optie) ? 2 : 1;
            for (let i = 0; i < aantal; i += 1) {
              rows.push({
                id: nextId,
                groupKey: optie.groupKey,
                values: initialiseerGeWaardenVoorOptie(optie),
              });
              nextId += 1;
            }
          });
          return { rows, nextId };
        }

        function voegEntiteitGegevenRijToe(groupKey) {
          const optie = gegevenselementGroepOpties.find((o) => o.groupKey === groupKey) || gegevenselementGroepOpties[0];
          if (!optie) {
            return;
          }
          setEntiteitNieuweGegevens((prev) => [...prev, {
            id: entiteitNieuweGegevensVolgendId,
            groupKey: optie.groupKey,
            values: initialiseerGeWaardenVoorOptie(optie),
          }]);
          setEntiteitNieuweGegevensVolgendId((prev) => prev + 1);
        }

        function openEntiteitActieBox() {
          if (!selectedA) {
            return;
          }
          setNieuweEntiteitActieOpen(false);
          setGeselecteerdeRep(null);
          setEntiteitActieOpen(true);
          setActieResultaat(null);
          setActieOpmerking('');
          if (entiteitNieuweGegevens.length === 0 && gegevenselementGroepOpties.length > 0) {
            voegEntiteitGegevenRijToe(gegevenselementGroepOpties[0].groupKey);
          }
          if (entiteitNieuweRelaties.length === 0 && relatieGroepOpties.length > 0) {
            voegEntiteitRelatieRijToe(relatieGroepOpties[0].groupKey);
          }
        }

        function voegEntiteitGegevenToe() {
          if (gegevenselementGroepOpties.length === 0) {
            return;
          }
          voegEntiteitGegevenRijToe(gegevenselementGroepOpties[0].groupKey);
        }

        function voegEntiteitRelatieRijToe(groupKey) {
          const optie = relatieGroepOpties.find((o) => o.groupKey === groupKey) || relatieGroepOpties[0];
          if (!optie) {
            return;
          }
          setEntiteitNieuweRelaties((prev) => [...prev, {
            id: entiteitNieuweRelatiesVolgendId,
            groupKey: optie.groupKey,
            values: initialiseerGeWaardenVoorOptie(optie),
          }]);
          setEntiteitNieuweRelatiesVolgendId((prev) => prev + 1);
        }

        function voegEntiteitRelatieToe() {
          if (relatieGroepOpties.length === 0) {
            return;
          }
          voegEntiteitRelatieRijToe(relatieGroepOpties[0].groupKey);
        }

        function veranderEntiteitGegevenRijType(rowId, nieuwGroupKey) {
          const optie = gegevenselementGroepOpties.find((o) => o.groupKey === nieuwGroupKey);
          if (!optie) {
            return;
          }
          setEntiteitNieuweGegevens((prev) => prev.map((row) => (row.id === rowId
            ? { ...row, groupKey: nieuwGroupKey, values: initialiseerGeWaardenVoorOptie(optie) }
            : row)));
        }

        function veranderEntiteitRelatieRijType(rowId, nieuwGroupKey) {
          const optie = relatieGroepOpties.find((o) => o.groupKey === nieuwGroupKey);
          if (!optie) {
            return;
          }
          setEntiteitNieuweRelaties((prev) => prev.map((row) => (row.id === rowId
            ? { ...row, groupKey: nieuwGroupKey, values: initialiseerGeWaardenVoorOptie(optie) }
            : row)));
        }

        function updateEntiteitGegevenRijVeld(rowId, veldnaam, waarde) {
          setEntiteitNieuweGegevens((prev) => prev.map((row) => (row.id === rowId
            ? { ...row, values: { ...(row.values || {}), [veldnaam]: waarde } }
            : row)));
        }

        function updateEntiteitRelatieRijVeld(rowId, veldnaam, waarde) {
          setEntiteitNieuweRelaties((prev) => prev.map((row) => (row.id === rowId
            ? { ...row, values: { ...(row.values || {}), [veldnaam]: waarde } }
            : row)));
        }

        function voegNieuweEntiteitGegevenRijToe(groupKey) {
          const optie = gegevenselementGroepOpties.find((o) => o.groupKey === groupKey) || gegevenselementGroepOpties[0];
          if (!optie) {
            return;
          }
          setNieuweEntiteitGegevens((prev) => [...prev, {
            id: nieuweEntiteitGegevensVolgendId,
            groupKey: optie.groupKey,
            values: initialiseerGeWaardenVoorOptie(optie),
          }]);
          setNieuweEntiteitGegevensVolgendId((prev) => prev + 1);
        }

        function voegNieuweEntiteitRelatieRijToe(groupKey) {
          const optie = relatieGroepOpties.find((o) => o.groupKey === groupKey) || relatieGroepOpties[0];
          if (!optie) {
            return;
          }
          setNieuweEntiteitRelaties((prev) => [...prev, {
            id: nieuweEntiteitRelatiesVolgendId,
            groupKey: optie.groupKey,
            values: initialiseerGeWaardenVoorOptie(optie),
          }]);
          setNieuweEntiteitRelatiesVolgendId((prev) => prev + 1);
        }

        // Zoek het childGroup-item dat bij een wijziging hoort op basis van representatienaam en representatie_id.
        // Standaard GE-types matchen via item.rel_id of item.id.
        // Materiële-tijd plumbing types (A_Aanvang, A_Einde etc.) hebben geen id/rel_id;
        // daar is de idKolom "versie", dus we gebruiken item[idKolom] als fallback.
        function zoekGroupEnItemVoorWijziging(w) {
          if (!w.representatienaam || !w.representatie_id) return null;
          for (const group of childGroups) {
            const typeNaam = String(group.doeltype || '').toLowerCase();
            const rolNaam = String(group.rolnaam || '').toLowerCase();
            const repNaam = String(w.representatienaam || '').toLowerCase();
            const dataTypeNaam = String(group?.typeMeta?.dataTypenaam || '').toLowerCase();
            if (typeNaam === repNaam || rolNaam === repNaam || dataTypeNaam === repNaam) {
              const idKolom = group.typeMeta?.idKolom;
              const gevonden = group.items.find((item) => {
                const itemId = item.rel_id ?? item.id ?? (idKolom ? item[idKolom] : undefined);
                return String(itemId) === String(w.representatie_id);
              });
              if (gevonden) return { group, item: gevonden };
            }
          }
          return null;
        }

        function openRegistratieActieBox() {
          if (!selectedRegistratie) return;
          setRegistratieCorrigeerActief(false);
          setRegistratieOngedaanBevestiging(false);
          setRegistratieActieResultaat(null);
          setRegistratieActieOpmerking('');
          setRegistratieActieOpen(true);
        }

        function openRegistratieCorrigeren() {
          const initieleVelden = {};
          selectedRegistratieWijzigingen
            .filter((w) => w.wijzigingstype === 'opvoer' && w.representatienaam && w.representatie_id)
            .forEach((w) => {
              const match = zoekGroupEnItemVoorWijziging(w);
              if (match) {
                const bewerkbaar = {};
                const secKolom = String(match.group?.typeMeta?.secondaireEntiteitIDKolom || '');
                veldEntries(match.item)
                  .filter(([k]) => !isPlumbingVeld(k, match.group?.typeMeta))
                  .forEach(([k, v]) => { bewerkbaar[k] = String(v ?? ''); });
                initieleVelden[String(w.representatie_id)] = bewerkbaar;
              }
            });
          setRegistratieCorrigeerVelden(initieleVelden);
          setRegistratieCorrigeerActief(true);
          setRegistratieActieResultaat(null);
        }

        function bouwRegistratieCorrectiePayload(opmerking) {
          const registratie = { registratietype: 'correctie', ...(opmerking ? { opmerking } : {}) };
          const wijzigingen = selectedRegistratieWijzigingen
            .filter((w) => w.wijzigingstype === 'opvoer' && w.representatienaam && w.representatie_id)
            .map((w) => {
              const match = zoekGroupEnItemVoorWijziging(w);
              if (!match) return null;
              const { group, item } = match;
              if (item.afvoer != null && item.afvoer !== '' && item.afvoer !== 0) return null;
              const repTypeMeta = typeMetaByTypenaam?.[String(w.representatienaam || '')] || null;
              const corrigeerDataSubtype = String(repTypeMeta?.ge_subtype || '').toLowerCase() === 'data';
              const veldnaam = corrigeerDataSubtype
                ? String(repTypeMeta?.veldnaam || '').trim()
                : String(group.typeMeta?.veldnaam || String(group.doeltype || w.representatienaam).toLowerCase());
              const bewerkteVelden = registratieCorrigeerVelden[String(w.representatie_id)] || {};
              const nieuwItem = {};
              let heeftWijziging = false;

              // Voor correctie moet de backend de bestaande representatie kunnen identificeren
              // en de entiteit-context kunnen afleiden.
              const idKolom = String(group?.typeMeta?.idKolom || '');
              const entiteitIDKolom = String(group?.typeMeta?.entiteitIDKolom || '');
              if (idKolom && item[idKolom] !== undefined) {
                nieuwItem[idKolom] = item[idKolom];
              }
              if (entiteitIDKolom && item[entiteitIDKolom] !== undefined) {
                nieuwItem[entiteitIDKolom] = item[entiteitIDKolom];
              }

              Object.entries(bewerkteVelden).forEach(([k, v]) => {
                const origineel = item[k];
                const veldDef = Array.isArray(group?.typeMeta?.velden)
                  ? (group.typeMeta.velden.find((veld) => veld.naam === k) || { naam: k, type: typeof origineel, format: '' })
                  : { naam: k, type: typeof origineel, format: '' };
                let nieuw = coercedWaardeVoorVeld(v, veldDef, `${w.representatienaam}.${k}`);

                if (nieuw !== origineel) {
                  nieuwItem[k] = nieuw;
                  heeftWijziging = true;
                }
              });
              if (!heeftWijziging) return null;
              return { opvoer: { [veldnaam]: nieuwItem } };
            })
            .filter(Boolean);

          return { registratie, wijzigingen };
        }

        const registratieCorrectiePreview = useMemo(() => {
          if (!selectedRegistratie || !registratieCorrigeerActief) return null;
          try {
            const opmerking = registratieActieOpmerking.trim() || undefined;
            const payload = bouwRegistratieCorrectiePayload(opmerking);
            if (payload.wijzigingen.length === 0) {
              return { ok: false, fout: 'Geen gewijzigde velden gevonden voor correctie. Pas minimaal 1 veld aan.' };
            }
            return { ok: true, payload };
          } catch (err) {
            return { ok: false, fout: String(err?.message || err) };
          }
        }, [selectedRegistratie, registratieCorrigeerActief, registratieActieOpmerking, selectedRegistratieWijzigingen, registratieCorrigeerVelden]);

        async function voerRegistratieOngedaanMakingUit() {
          if (!selectedRegistratie) return;
          setRegistratieActieBezig(true);
          setRegistratieActieResultaat(null);
          try {
            const opmerking = registratieActieOpmerking.trim() || undefined;
            const payload = {
              registratie: {
                registratietype: 'ongedaanmaking',
                maakt_ongedaan_registratie_id: selectedRegistratie.id,
                ...(opmerking ? { opmerking } : {}),
              },
              wijzigingen: [],
            };
            const res = await fetch(`${baseUrl}/registratie/`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            });
            const json = await res.json().catch(() => ({}));
            if (res.ok) {
              invalidateRelatieSecondaireOpties();
              const nieuweRegistratieID = registratieIDUitResponse(json);
              setRegistratieActieResultaat({ ok: true, bericht: `Ongedaanmaking geslaagd (nieuwe registratie id=${nieuweRegistratieID || '-'})` });
              setRegistratieActieOpen(false);
              setRegistratieOngedaanBevestiging(false);
              if (nieuweRegistratieID > 0) {
                setRegistratieId(nieuweRegistratieID);
                await loadData({ tValue: t, registratieIdValue: nieuweRegistratieID, selecteerVanuitRegistratie: true });
              } else {
                await loadData();
              }
            } else {
              setRegistratieActieResultaat({ ok: false, bericht: json.error || `HTTP ${res.status}: ${res.statusText}` });
            }
          } catch (err) {
            setRegistratieActieResultaat({ ok: false, bericht: String(err?.message || err) });
          } finally {
            setRegistratieActieBezig(false);
          }
        }

        async function voerRegistratieCorrectieUit() {
          if (!selectedRegistratie) return;
          setRegistratieActieBezig(true);
          setRegistratieActieResultaat(null);
          try {
            const opmerking = registratieActieOpmerking.trim() || undefined;
            const { registratie, wijzigingen } = bouwRegistratieCorrectiePayload(opmerking);
            if (wijzigingen.length === 0) {
              throw new Error('Geen gewijzigde velden gevonden voor correctie. Pas minimaal 1 veld aan.');
            }
            const res = await fetch(`${baseUrl}/registratie/`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ registratie, wijzigingen }),
            });
            const json = await res.json().catch(() => ({}));
            if (res.ok) {
              invalidateRelatieSecondaireOpties();
              const nieuweRegistratieID = registratieIDUitResponse(json);
              setRegistratieActieResultaat({ ok: true, bericht: `Correctie geslaagd (nieuwe registratie id=${nieuweRegistratieID || '-'})` });
              setRegistratieActieOpen(false);
              setRegistratieCorrigeerActief(false);
              if (nieuweRegistratieID > 0) {
                setRegistratieId(nieuweRegistratieID);
                await loadData({ tValue: t, registratieIdValue: nieuweRegistratieID, selecteerVanuitRegistratie: true });
              } else {
                await loadData();
              }
            } else {
              setRegistratieActieResultaat({ ok: false, bericht: json.error || `HTTP ${res.status}: ${res.statusText}` });
            }
          } catch (err) {
            setRegistratieActieResultaat({ ok: false, bericht: String(err?.message || err) });
          } finally {
            setRegistratieActieBezig(false);
          }
        }

        function openNieuweEntiteitActieBox() {
          setGeselecteerdeRep(null);
          setEntiteitActieOpen(false);
          setActieResultaat(null);
          setNieuweEntiteitResultaat(null);
          setNieuweEntiteitOpmerkingAangepast(false);
          setNieuweEntiteitActieOpen(true);
          setSelectedEntiteitId('');
          setRegistratieData(null);
          setOngedaanGemaakteRegistratieData(null);
          const geInit = bouwInitieleRijenVoorOpties(gegevenselementGroepOpties, 1);
          const relInit = bouwInitieleRijenVoorOpties(relatieGroepOpties, 1);
          setNieuweEntiteitGegevens(geInit.rows);
          setNieuweEntiteitGegevensVolgendId(geInit.nextId);
          setNieuweEntiteitRelaties(relInit.rows);
          setNieuweEntiteitRelatiesVolgendId(relInit.nextId);
        }

        function veranderNieuweEntiteitGegevenRijType(rowId, nieuwGroupKey) {
          const optie = gegevenselementGroepOpties.find((o) => o.groupKey === nieuwGroupKey);
          if (!optie) {
            return;
          }
          setNieuweEntiteitGegevens((prev) => prev.map((row) => (row.id === rowId
            ? { ...row, groupKey: nieuwGroupKey, values: initialiseerGeWaardenVoorOptie(optie) }
            : row)));
        }

        function veranderNieuweEntiteitRelatieRijType(rowId, nieuwGroupKey) {
          const optie = relatieGroepOpties.find((o) => o.groupKey === nieuwGroupKey);
          if (!optie) {
            return;
          }
          setNieuweEntiteitRelaties((prev) => prev.map((row) => (row.id === rowId
            ? { ...row, groupKey: nieuwGroupKey, values: initialiseerGeWaardenVoorOptie(optie) }
            : row)));
        }

        function updateNieuweEntiteitGegevenRijVeld(rowId, veldnaam, waarde) {
          setNieuweEntiteitGegevens((prev) => prev.map((row) => (row.id === rowId
            ? { ...row, values: { ...(row.values || {}), [veldnaam]: waarde } }
            : row)));
        }

        function updateNieuweEntiteitRelatieRijVeld(rowId, veldnaam, waarde) {
          setNieuweEntiteitRelaties((prev) => prev.map((row) => (row.id === rowId
            ? { ...row, values: { ...(row.values || {}), [veldnaam]: waarde } }
            : row)));
        }

        async function navigeerNaarSecondaireEntiteit(event, tweedeEntiteitType, tweedeEntiteitId) {
          event.stopPropagation();
          if (!tweedeEntiteitType || !tweedeEntiteitId) return;
          // Vind de juiste typenaam (case-insensitive) uit de beschikbare entiteittypen
          const match = entiteitTypen.find((item) => String(item.typenaam).toUpperCase() === String(tweedeEntiteitType).toUpperCase());
          const doelType = match ? match.typenaam : tweedeEntiteitType;
          setEntiteitType(doelType);
          await loadData({ entiteitTypeValue: doelType, doelEntiteitIdValue: String(tweedeEntiteitId) });
        }

        async function navigeerNaarRegistratieVanOpvoer(event, opvoerTijdstip) {
          event.stopPropagation();
          const registratieID = registratieIDUitOpvoerTijdstip(opvoerTijdstip);
          if (!registratieID) {
            return;
          }
          setRegistratieId(registratieID);
          await loadData({ tValue: t, registratieIdValue: registratieID, selecteerVanuitRegistratie: true });
        }

        function registratieIDUitResponse(json) {
          const kandidaat = Number(json?.registratie_id ?? json?.registratieId ?? 0);
          return Number.isInteger(kandidaat) && kandidaat > 0 ? kandidaat : 0;
        }

        async function voerEntiteitActieUit(actie) {
          if (!selectedA || !selectedEntiteitMeta) return;
          const entiteitVeldnaam = selectedEntiteitMeta.veldnaam || String(entiteitType || '').toLowerCase();
          setActieBezig(true);
          setActieResultaat(null);
          try {
            const opmerking = actieOpmerking.trim() || undefined;
            const registratie = { registratietype: 'registratie', ...(opmerking ? { opmerking } : {}) };
            let wijzigingen;

            if (actie === 'afvoer') {
              wijzigingen = [{ afvoer: { [entiteitVeldnaam]: { id: selectedA.id } } }];
            } else {
              const alleRijen = [
                ...entiteitNieuweGegevens.map((row) => ({ row, opties: gegevenselementGroepOpties })),
                ...entiteitNieuweRelaties.map((row) => ({ row, opties: relatieGroepOpties })),
              ];
              const heeftMaterieleTijd = materieleTijdMeta && (entiteitAanvangDatum || entiteitEindeDatum);
              if (alleRijen.length === 0 && !heeftMaterieleTijd) {
                throw new Error('Voeg minimaal 1 gegevenselement, relatie of materiële datum toe.');
              }

              // Eén opvoer-wijziging per GE/relatie-rij, met de eigen veldnaam.
              wijzigingen = alleRijen.map(({ row, opties }) => {
                const optie = opties.find((o) => o.groupKey === row.groupKey);
                if (!optie) {
                  throw new Error('Onbekend type in invoer.');
                }
                const item = {};
                if (optie.entiteitIDKolom) {
                  item[optie.entiteitIDKolom] = selectedA.id;
                }
                safeArray(optie.veldDefinities).forEach((veld) => {
                  const raw = row?.values?.[veld.naam];
                  const isLeeg = raw === undefined || raw === null || raw === '';
                  if (isLeeg) {
                    return;
                  }
                  item[veld.naam] = coercedWaardeVoorVeld(raw, veld, `${optie.label}.${veld.naam}`);
                });
                vulMaterieleTijdVoorHubInput(item, row, optie);
                return { opvoer: { [optie.geVeldnaam]: item } };
              });
              // Materiële tijd: voeg aanvang/einde opvoer-wijzigingen toe.
              if (materieleTijdMeta && entiteitAanvangDatum) {
                const mtItem = {};
                if (materieleTijdMeta.aanvangEntiteitIDKolom) mtItem[materieleTijdMeta.aanvangEntiteitIDKolom] = selectedA.id;
                mtItem.datum = entiteitAanvangDatum;
                wijzigingen.push({ opvoer: { [materieleTijdMeta.aanvangVeldnaam]: mtItem } });
              }
              if (materieleTijdMeta && entiteitEindeDatum) {
                const mtItem = {};
                if (materieleTijdMeta.eindeEntiteitIDKolom) mtItem[materieleTijdMeta.eindeEntiteitIDKolom] = selectedA.id;
                mtItem.datum = entiteitEindeDatum;
                wijzigingen.push({ opvoer: { [materieleTijdMeta.eindeVeldnaam]: mtItem } });
              }
            }

            const res = await fetch(`${baseUrl}/registratie/`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ registratie, wijzigingen }),
            });
            const json = await res.json().catch(() => ({}));
            if (res.ok) {
              invalidateRelatieSecondaireOpties();
              const nieuweRegistratieID = registratieIDUitResponse(json);
              setActieResultaat({ ok: true, bericht: `${actie === 'afvoer' ? 'Entiteit-afvoer' : 'GE-opvoer'} geslaagd (registratie id=${nieuweRegistratieID || '-'})` });
              if (actie !== 'afvoer') {
                setEntiteitNieuweGegevens([]);
                setEntiteitNieuweRelaties([]);
                setEntiteitAanvangDatum("");
                setEntiteitEindeDatum("");
              }
              if (nieuweRegistratieID > 0) {
                setRegistratieId(nieuweRegistratieID);
                await loadData({ tValue: t, registratieIdValue: nieuweRegistratieID, selecteerVanuitRegistratie: true });
              } else {
                await loadData();
              }
            } else {
              setActieResultaat({ ok: false, bericht: json.error || `HTTP ${res.status}: ${res.statusText}` });
            }
          } catch (err) {
            setActieResultaat({ ok: false, bericht: String(err?.message || err) });
          } finally {
            setActieBezig(false);
          }
        }

        async function voerNieuweEntiteitActieUit() {
          if (!selectedEntiteitMeta) return;
          setNieuweEntiteitBezig(true);
          setNieuweEntiteitResultaat(null);
          try {
            const entiteitVeldnaam = selectedEntiteitMeta.veldnaam || String(entiteitType || '').toLowerCase();
            const idNummer = Number(nieuweEntiteitID);
            if (!Number.isInteger(idNummer) || idNummer <= 0) {
              throw new Error('Entiteit-id moet een positief geheel getal zijn.');
            }

            const opmerking = nieuweEntiteitOpmerking.trim() || undefined;
            const registratie = { registratietype: 'registratie', ...(opmerking ? { opmerking } : {}) };
            const wijzigingen = [{ opvoer: { [entiteitVeldnaam]: { id: idNummer } } }];

            const alleRijen = [
              ...nieuweEntiteitGegevens.map((row) => ({ row, opties: gegevenselementGroepOpties })),
              ...nieuweEntiteitRelaties.map((row) => ({ row, opties: relatieGroepOpties })),
            ];

            alleRijen.forEach(({ row, opties }) => {
              const optie = opties.find((o) => o.groupKey === row.groupKey);
              if (!optie) {
                throw new Error('Onbekend type in invoer.');
              }
              const item = {};
              if (optie.entiteitIDKolom) {
                item[optie.entiteitIDKolom] = idNummer;
              }
              safeArray(optie.veldDefinities).forEach((veld) => {
                const raw = row?.values?.[veld.naam];
                const isLeeg = raw === undefined || raw === null || raw === '';
                if (isLeeg) {
                  return;
                }
                item[veld.naam] = coercedWaardeVoorVeld(raw, veld, `${optie.label}.${veld.naam}`);
              });
              vulMaterieleTijdVoorHubInput(item, row, optie);
              wijzigingen.push({ opvoer: { [optie.geVeldnaam]: item } });
            });

            // Materiële tijd: voeg aanvang/einde opvoer-wijzigingen toe.
            if (materieleTijdMeta && nieuweEntiteitAanvang) {
              const mtItem = {};
              if (materieleTijdMeta.aanvangEntiteitIDKolom) mtItem[materieleTijdMeta.aanvangEntiteitIDKolom] = idNummer;
              mtItem.datum = nieuweEntiteitAanvang;
              wijzigingen.push({ opvoer: { [materieleTijdMeta.aanvangVeldnaam]: mtItem } });
            }
            if (materieleTijdMeta && nieuweEntiteitEinde) {
              const mtItem = {};
              if (materieleTijdMeta.eindeEntiteitIDKolom) mtItem[materieleTijdMeta.eindeEntiteitIDKolom] = idNummer;
              mtItem.datum = nieuweEntiteitEinde;
              wijzigingen.push({ opvoer: { [materieleTijdMeta.eindeVeldnaam]: mtItem } });
            }

            const res = await fetch(`${baseUrl}/registratie/`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ registratie, wijzigingen }),
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) {
              throw new Error(json.error || `HTTP ${res.status}: ${res.statusText}`);
            }

            invalidateRelatieSecondaireOpties();
            const nieuweRegistratieID = registratieIDUitResponse(json);
            // Zet eerst het succesresultaat, zodat een selectie-update tijdens loadData
            // de zichtbare terugkoppeling in de actiebox niet direct wegneemt.
            setNieuweEntiteitResultaat({ ok: true, bericht: `Nieuwe entiteit-opvoer geslaagd (registratie id=${nieuweRegistratieID || '-'})` });
            if (nieuweRegistratieID > 0) {
              setRegistratieId(nieuweRegistratieID);
              await loadData({ tValue: t, registratieIdValue: nieuweRegistratieID, selecteerVanuitRegistratie: true });
            } else {
              await loadData();
            }

            setNieuweEntiteitGegevens([]);
            setNieuweEntiteitRelaties([]);
            setNieuweEntiteitAanvang("");
            setNieuweEntiteitEinde("");
          } catch (err) {
            setNieuweEntiteitResultaat({ ok: false, bericht: String(err?.message || err) });
          } finally {
            setNieuweEntiteitBezig(false);
          }
        }

        async function voerActieUit(actie) {
          if (!geselecteerdeRep) return;
          const { item, group } = geselecteerdeRep;
          setActieBezig(true);
          setActieResultaat(null);
          try {
            const opmerking = actieOpmerking.trim() || undefined;
            let wijzigingen;
            let registratie;
            const { afvoerPayload, corrigeerPayload, heeftWijziging } = bouwRepresentatieActiePayloads(item, group, actieFormVelden, opmerking);
            const heeftMaterieleTijd = repMaterieleTijdMeta && (repAanvangDatum || repEindeDatum);
            if (actie === 'afvoer') {
              registratie = afvoerPayload.registratie;
              wijzigingen = afvoerPayload.wijzigingen;
            } else {
              if (!heeftWijziging && !heeftMaterieleTijd) {
                throw new Error('Geen gewijzigde velden voor correctie. Pas minimaal 1 veld aan.');
              }
              registratie = corrigeerPayload.registratie;
              wijzigingen = [...corrigeerPayload.wijzigingen];
              wijzigingen.push(
                ...bouwRepMaterieleTijdWijzigingen(item, group, repMaterieleTijdMeta, repAanvangDatum, repEindeDatum)
              );
            }
            const res = await fetch(`${baseUrl}/registratie/`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ registratie, wijzigingen }),
            });
            const json = await res.json().catch(() => ({}));
            if (res.ok) {
              invalidateRelatieSecondaireOpties();
              const nieuweRegistratieID = registratieIDUitResponse(json);
              setActieResultaat({ ok: true, bericht: `${actie === 'afvoer' ? 'Afvoer' : 'Correctie'} geslaagd (registratie id=${nieuweRegistratieID || '-'})` });
              setGeselecteerdeRep(null);
              if (nieuweRegistratieID > 0) {
                setRegistratieId(nieuweRegistratieID);
                await loadData({ tValue: t, registratieIdValue: nieuweRegistratieID, selecteerVanuitRegistratie: true });
              } else {
                await loadData();
              }
            } else {
              setActieResultaat({ ok: false, bericht: json.error || `HTTP ${res.status}: ${res.statusText}` });
            }
          } catch (err) {
            setActieResultaat({ ok: false, bericht: String(err?.message || err) });
          } finally {
            setActieBezig(false);
          }
        }

        useEffect(() => {
          loadData();
        }, []);

        // Reset selectie als entiteit wisselt
        useEffect(() => {
          const heeftGeselecteerdeEntiteit = String(selectedEntiteitId || '').trim() !== '';
          setGeselecteerdeRep(null);
          setEntiteitActieOpen(false);
          // Bij lege selectie (bewust voor "nieuwe entiteit opvoeren") laten we deze box open.
          if (heeftGeselecteerdeEntiteit) {
            setNieuweEntiteitActieOpen(false);
          }
          setEntiteitNieuweGegevens([]);
          setEntiteitNieuweRelaties([]);
          setActieResultaat(null);
        }, [selectedEntiteitId]);

        useEffect(() => {
          function handleKeyDown(event) {
            const tagName = event.target?.tagName || '';
            if (tagName === 'INPUT' || tagName === 'SELECT' || tagName === 'TEXTAREA') {
              return;
            }

            if (event.key === 'Escape') {
              if (geselecteerdeRep) {
                setGeselecteerdeRep(null);
                setActieResultaat(null);
              } else if (entiteitActieOpen) {
                setEntiteitActieOpen(false);
                setActieResultaat(null);
              } else if (nieuweEntiteitActieOpen) {
                setNieuweEntiteitActieOpen(false);
                setNieuweEntiteitResultaat(null);
              } else if (registratieActieOpen) {
                setRegistratieActieOpen(false);
                setRegistratieCorrigeerActief(false);
                setRegistratieOngedaanBevestiging(false);
                setRegistratieActieResultaat(null);
              }
              return;
            }

            if (event.key === 'ArrowRight') {
              event.preventDefault();
              incrementRegistratieAndReload();
            }
            if (event.key === 'ArrowLeft') {
              event.preventDefault();
              decrementRegistratieAndReload();
            }
            if (event.key === 'ArrowUp') {
              event.preventDefault();
              incrementTAndReload();
            }
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              decrementTAndReload();
            }
          }

          window.addEventListener('keydown', handleKeyDown);
          return () => window.removeEventListener('keydown', handleKeyDown);
        }, [t, registratieId, loading, entiteitType, geselecteerdeRep, entiteitActieOpen, nieuweEntiteitActieOpen, registratieActieOpen]);

        const isOngedaanmaking = selectedRegistratie?.registratietype === 'ongedaanmaking';
        const ongedaanGemaakteWijzigingen = safeArray(ongedaanGemaakteRegistratieData?.wijzigingen);
        const visualRegistratie = isOngedaanmaking ? ongedaanGemaakteRegistratieData : selectedRegistratie;
        const visualWijzigingen = isOngedaanmaking ? ongedaanGemaakteWijzigingen : selectedRegistratieWijzigingen;
        const registratieTitel = selectedRegistratie?.registratietype
          ? selectedRegistratie.registratietype.charAt(0).toUpperCase() + selectedRegistratie.registratietype.slice(1)
          : 'Registratie';
        const registratieOpmerking = typeof selectedRegistratie?.opmerking === 'string' ? selectedRegistratie.opmerking : '';
        const doelRegistratieOpmerking = typeof ongedaanGemaakteRegistratieData?.opmerking === 'string' ? ongedaanGemaakteRegistratieData.opmerking : '';
        const nadrukStyle = { fontWeight: 700, fontSize: '15px' };
        const nadrukStyleLinks = { fontWeight: 700, fontSize: '18px' };
        const centraleEntiteitLabelStyle = { fontWeight: 900, fontSize: '24px' };
        const grootKruisEindY = visualWijzigingen.length > 0
          ? 108 + ((visualWijzigingen.length - 1) * 92) + 84
          : 82;
        const registratieSvgHoogte = Math.max(200, grootKruisEindY + 30);

        return (
          <div className="container">
            <SchemaIndexHeader schemaError={schemaError} vizSchema={vizSchema} />

            <SchemaIndexControls
              baseUrl={baseUrl}
              setBaseUrl={setBaseUrl}
              entiteitType={entiteitType}
              setEntiteitType={setEntiteitType}
              entiteitTypen={entiteitTypen}
              openNieuweEntiteitActieBox={openNieuweEntiteitActieBox}
              loading={loading}
              registratieId={registratieId}
              setRegistratieId={setRegistratieId}
              t={t}
              setT={setT}
              selectedEntiteitId={selectedEntiteitId}
              setSelectedEntiteitId={setSelectedEntiteitId}
              as={as}
              decrementRegistratieAndReload={decrementRegistratieAndReload}
              incrementRegistratieAndReload={incrementRegistratieAndReload}
              decrementTAndReload={decrementTAndReload}
              incrementTAndReload={incrementTAndReload}
              loadData={loadData}
              normaliseerNietNegatiefGeheelGetal={normaliseerNietNegatiefGeheelGetal}
              error={error}
              responseData={responseData}
            />

            {nieuweEntiteitActieOpen && (
              <div
                className="action-overlay-backdrop"
                onClick={() => {
                  setNieuweEntiteitActieOpen(false);
                  setNieuweEntiteitResultaat(null);
                }}
              >
                <div
                  className="action-overlay-dialog"
                  style={overlayDialogStyle('nieuweEntiteit', {
                    borderColor: donkerdereRandkleurVanHex(selectedEntiteitMeta?.kleur || '#0f766e'),
                  })}
                  onClick={(event) => event.stopPropagation()}
                >
                  <div
                    className="action-overlay-drag-handle"
                    onMouseDown={startOverlayDrag('nieuweEntiteit')}
                    style={{
                      background: selectedEntiteitMeta?.kleur || '#0f766e',
                      borderColor: donkerdereRandkleurVanHex(selectedEntiteitMeta?.kleur || '#0f766e'),
                      color: '#111827',
                    }}
                  >
                    <span className="action-section-title">
                      <span>Nieuwe entiteit {entiteitType} opvoeren</span>
                      <ActionTooltip text={String(selectedEntiteitMeta?.description || "")} placement="below" />
                    </span>
                    <button
                      onMouseDown={(event) => event.stopPropagation()}
                      onClick={() => { setNieuweEntiteitActieOpen(false); setNieuweEntiteitResultaat(null); }}
                      style={{ background: 'transparent', color: '#111827', border: '1px solid rgba(15,23,42,0.28)', padding: '2px 10px', fontSize: 14, cursor: 'pointer', borderRadius: 5, flexShrink: 0 }}
                    >✕</button>
                  </div>
                  <NieuweEntiteitActieBox
                    nieuweEntiteitFormRef={nieuweEntiteitFormRef}
                    accentColor={donkerdereRandkleurVanHex(selectedEntiteitMeta?.kleur || '#0f766e')}
                    entiteitType={entiteitType}
                    nieuweEntiteitID={nieuweEntiteitID}
                    setNieuweEntiteitID={setNieuweEntiteitID}
                    nieuweEntiteitOpmerking={nieuweEntiteitOpmerking}
                    setNieuweEntiteitOpmerking={setNieuweEntiteitOpmerking}
                    setNieuweEntiteitOpmerkingAangepast={setNieuweEntiteitOpmerkingAangepast}
                    nieuweEntiteitIDInfo={nieuweEntiteitIDInfo}
                    gegevenselementGroepOpties={gegevenselementGroepOpties}
                    relatieGroepOpties={relatieGroepOpties}
                    nieuweEntiteitGegevens={nieuweEntiteitGegevens}
                    setNieuweEntiteitGegevens={setNieuweEntiteitGegevens}
                    nieuweEntiteitRelaties={nieuweEntiteitRelaties}
                    setNieuweEntiteitRelaties={setNieuweEntiteitRelaties}
                    voegNieuweEntiteitGegevenRijToe={voegNieuweEntiteitGegevenRijToe}
                    updateNieuweEntiteitGegevenRijVeld={updateNieuweEntiteitGegevenRijVeld}
                    voegNieuweEntiteitRelatieRijToe={voegNieuweEntiteitRelatieRijToe}
                    updateNieuweEntiteitRelatieRijVeld={updateNieuweEntiteitRelatieRijVeld}
                    relatieSecondaireOpties={relatieSecondaireOpties}
                    isMeervoudigOptie={isMeervoudigOptie}
                    nieuweEntiteitOpvoerPreview={nieuweEntiteitOpvoerPreview}
                    voerNieuweEntiteitActieUit={voerNieuweEntiteitActieUit}
                    nieuweEntiteitBezig={nieuweEntiteitBezig}
                    nieuweEntiteitResultaat={nieuweEntiteitResultaat}
                    isMaterieel={!!selectedEntiteitMeta?.isMaterieel}
                    nieuweEntiteitAanvang={nieuweEntiteitAanvang}
                    setNieuweEntiteitAanvang={setNieuweEntiteitAanvang}
                    nieuweEntiteitEinde={nieuweEntiteitEinde}
                    setNieuweEntiteitEinde={setNieuweEntiteitEinde}
                  />
                </div>
              </div>
            )}

            <p className="muted" style={{ margin: 0 }}>
              Huidige selectie: type={entiteitType || '-'} | peilmoment t={normaliseerNietNegatiefGeheelGetal(t, 0)} | registratie-id={normaliseerNietNegatiefGeheelGetal(registratieId, 0)}
            </p>

            <div className="row" style={{ marginTop: 16 }}>
              <div className="card">
                <h2>
                  {selectedRegistratie ? `${registratieTitel} ${selectedRegistratie.id}` : registratieTitel}
                  {!!registratieOpmerking && (
                    <span className="muted" style={{ marginLeft: 10, fontWeight: 400, fontSize: '0.9em' }}>
                      {registratieOpmerking}
                    </span>
                  )}
                </h2>

                {!selectedRegistratie ? (
                  <p className="muted">Geen registratie met dit registratie-id gevonden.</p>
                ) : (
                  <>
                    {!visualRegistratie ? (
                      <p className="muted">Geen registratie om te visualiseren.</p>
                    ) : (
                      <IndexRegistratieVisual
                        registratieSvgHoogte={registratieSvgHoogte}
                        registratieActieOpen={registratieActieOpen}
                        openRegistratieActieBox={openRegistratieActieBox}
                        afgeknotteHoekPad={afgeknotteHoekPad}
                        microsecondeIntVanTijdstip={microsecondeIntVanTijdstip}
                        visualRegistratie={visualRegistratie}
                        nadrukStyleLinks={nadrukStyleLinks}
                        visualWijzigingen={visualWijzigingen}
                        wijzigingPatroonId={wijzigingPatroonId}
                        nadrukStyle={nadrukStyle}
                        isOngedaanmaking={isOngedaanmaking}
                        grootKruisEindY={grootKruisEindY}
                        typeMetaByTypenaam={typeMetaByTypenaam}
                      />
                    )}

                    {isOngedaanmaking ? (
                      <>
                        <h3 style={{ marginTop: 12 }}>Ongedaan gemaakte registratie</h3>
                        {!ongedaanGemaakteRegistratieData ? (
                          <p className="muted">Doelregistratie niet gevonden.</p>
                        ) : (
                          <>
                            <p className="muted" style={{ margin: 0 }}>
                              id={ongedaanGemaakteRegistratieData.id} | type={ongedaanGemaakteRegistratieData.registratietype} | tijdstip={microsecondeIntVanTijdstip(ongedaanGemaakteRegistratieData.tijdstip)}
                            </p>
                            {!!doelRegistratieOpmerking && (
                              <p className="muted" style={{ marginTop: 6, marginBottom: 0 }}>
                                {doelRegistratieOpmerking}
                              </p>
                            )}
                            <h3 style={{ marginTop: 12 }}>Wijzigingen onder doelregistratie</h3>
                            <ul>
                              {ongedaanGemaakteWijzigingen.length === 0 && <li>Geen wijzigingen onder deze doelregistratie</li>}
                              {ongedaanGemaakteWijzigingen.map((w, index) => (
                                <li key={`wz-doel-${w.id || index}`}>
                                  {w.wijzigingstype} | entiteit={labelVoorTypeNaam(w.entiteitnaam, typeMetaByTypenaam, w.entiteitnaam)}:{w.entiteit_id} | rep={labelVoorTypeNaam(w.representatienaam, typeMetaByTypenaam, w.representatienaam || '-') }:{w.representatie_id || '-'}
                                </li>
                              ))}
                            </ul>
                          </>
                        )}
                      </>
                    ) : (
                      <>
                        <h3 style={{ marginTop: 12 }}>Wijzigingen</h3>
                        <ul>
                          {selectedRegistratieWijzigingen.length === 0 && <li>Geen wijzigingen onder deze registratie</li>}
                          {selectedRegistratieWijzigingen.map((w, index) => (
                            <li key={`wz-${w.id || index}`}>
                              {w.wijzigingstype} | entiteit={labelVoorTypeNaam(w.entiteitnaam, typeMetaByTypenaam, w.entiteitnaam)}:{w.entiteit_id} | rep={labelVoorTypeNaam(w.representatienaam, typeMetaByTypenaam, w.representatienaam || '-') }:{w.representatie_id || '-'}
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </>
                )}

              </div>

              <div className="card">
                <h2>Representaties</h2>
                {!selectedA ? (
                  <p className="muted">Geen entiteit geselecteerd.</p>
                ) : (
                  <>
                  <IndexRepresentatieVisual
                    svgHoogte={svgHoogte}
                    geGroepenMetLayout={geGroepenMetLayout}
                    geNodesVoorGrafiek={geNodesVoorGrafiek}
                    geselecteerdeRep={geselecteerdeRep}
                    registratieIDUitOpvoerTijdstip={registratieIDUitOpvoerTijdstip}
                    selecteerRep={selecteerRep}
                    navigeerNaarRegistratieVanOpvoer={navigeerNaarRegistratieVanOpvoer}
                    microsecondeIntVanTijdstip={microsecondeIntVanTijdstip}
                    labelVoorChildType={labelVoorChildType}
                    korteSamenvatting={korteSamenvatting}
                    nadrukStyle={nadrukStyle}
                    entiteitActieOpen={entiteitActieOpen}
                    openEntiteitActieBox={openEntiteitActieBox}
                    selectedEntiteitMeta={selectedEntiteitMeta}
                    selectedA={selectedA}
                    entiteitType={entiteitType}
                    centraleEntiteitLabelStyle={centraleEntiteitLabelStyle}
                    relatieNodesVoorGrafiek={relatieNodesVoorGrafiek}
                    entiteitOortjes={entiteitOortjes}
                    typeMetaByTypenaam={typeMetaByTypenaam}
                    navigeerNaarSecondaireEntiteit={navigeerNaarSecondaireEntiteit}
                  />

                  {actieResultaat && !geselecteerdeRep && (
                    <p style={{ marginTop: 8, color: actieResultaat.ok ? '#166534' : '#dc2626', fontWeight: 600 }}>
                      {actieResultaat.bericht}
                    </p>
                  )}
                  </>
                )}
              </div>
            </div>

            <div className="row" style={{ gridTemplateColumns: '1fr 1fr' }}>
              {childGroupsGesorteerd.length === 0 && (
                <div className="card">
                  <h3>Gegevenselement-details</h3>
                  <ul>
                    <li>Geen records</li>
                  </ul>
                </div>
              )}

              {childGroupsGesorteerd.map((group) => {
                const typeLabel = labelVoorChildType(group.doeltype, group.rolnaam, group.typeMeta?.klassenaam);
                const items = safeArray(group.items);
                return (
                  <div className="card" key={`details-${group.rolnaam}`}>
                    <h3>{typeLabel.toUpperCase()}-details</h3>
                    <ul>
                      {items.length === 0 && <li>Geen {typeLabel}-records</li>}
                      {items.map((item, index) => (
                        <li key={`${group.rolnaam}-${index}`}>
                          {veldEntries(item).map(([k, v]) => `${k}=${v ?? '-'}`).join(' | ')}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>

            {registratieActieOpen && selectedRegistratie && (
              <div
                className="action-overlay-backdrop"
                onClick={() => {
                  setRegistratieActieOpen(false);
                  setRegistratieCorrigeerActief(false);
                  setRegistratieOngedaanBevestiging(false);
                  setRegistratieActieResultaat(null);
                }}
              >
                <div
                  className="action-overlay-dialog"
                  style={overlayDialogStyle('registratie', {
                    borderColor: donkerdereRandkleurVanHex(selectedEntiteitMeta?.kleur || '#64748b'),
                  })}
                  onClick={(event) => event.stopPropagation()}
                >
                  <div
                    className="action-overlay-drag-handle"
                    onMouseDown={startOverlayDrag('registratie')}
                    style={{
                      background: selectedEntiteitMeta?.kleur || '#64748b',
                      borderColor: donkerdereRandkleurVanHex(selectedEntiteitMeta?.kleur || '#64748b'),
                      color: '#111827',
                    }}
                  >
                    <span className="action-section-title">
                      <span>Registratie {selectedRegistratie.id} - acties</span>
                      <ActionTooltip text="Acties op de geselecteerde registratie, inclusief ongedaan maken en corrigeren van opvoer-wijzigingen." placement="below" />
                    </span>
                    <button
                      onMouseDown={(event) => event.stopPropagation()}
                      onClick={() => { setRegistratieActieOpen(false); setRegistratieCorrigeerActief(false); setRegistratieOngedaanBevestiging(false); setRegistratieActieResultaat(null); }}
                      style={{ background: 'transparent', color: '#111827', border: '1px solid rgba(15,23,42,0.28)', padding: '2px 10px', fontSize: 14, cursor: 'pointer', borderRadius: 5, flexShrink: 0 }}
                    >✕</button>
                  </div>
                  <RegistratieActieBox
                    registratieActieFormRef={registratieActieFormRef}
                    accentColor={donkerdereRandkleurVanHex(selectedEntiteitMeta?.kleur || '#64748b')}
                    selectedRegistratie={selectedRegistratie}
                    setRegistratieActieOpen={setRegistratieActieOpen}
                    setRegistratieCorrigeerActief={setRegistratieCorrigeerActief}
                    setRegistratieOngedaanBevestiging={setRegistratieOngedaanBevestiging}
                    setRegistratieActieResultaat={setRegistratieActieResultaat}
                    registratieActieOpmerking={registratieActieOpmerking}
                    setRegistratieActieOpmerking={setRegistratieActieOpmerking}
                    registratieOngedaanBevestiging={registratieOngedaanBevestiging}
                    registratieActieBezig={registratieActieBezig}
                    voerRegistratieOngedaanMakingUit={voerRegistratieOngedaanMakingUit}
                    registratieCorrigeerActief={registratieCorrigeerActief}
                    openRegistratieCorrigeren={openRegistratieCorrigeren}
                    selectedRegistratieWijzigingen={selectedRegistratieWijzigingen}
                    zoekGroupEnItemVoorWijziging={zoekGroupEnItemVoorWijziging}
                    registratieCorrigeerVelden={registratieCorrigeerVelden}
                    setRegistratieCorrigeerVelden={setRegistratieCorrigeerVelden}
                    relatieSecondaireOpties={relatieSecondaireOpties}
                    voerRegistratieCorrectieUit={voerRegistratieCorrectieUit}
                    registratieCorrectiePreview={registratieCorrectiePreview}
                    registratieActieResultaat={registratieActieResultaat}
                    typeMetaByTypenaam={typeMetaByTypenaam}
                  />
                </div>
              </div>
            )}

            {entiteitActieOpen && selectedA && (
              <div
                className="action-overlay-backdrop"
                onClick={() => {
                  setEntiteitActieOpen(false);
                  setActieResultaat(null);
                }}
              >
                <div
                  className="action-overlay-dialog"
                  style={overlayDialogStyle('entiteit', {
                    borderColor: donkerdereRandkleurVanHex(selectedEntiteitMeta?.kleur || '#64748b'),
                  })}
                  onClick={(event) => event.stopPropagation()}
                >
                  <div
                    className="action-overlay-drag-handle"
                    onMouseDown={startOverlayDrag('entiteit')}
                    style={{
                      background: selectedEntiteitMeta?.kleur || '#64748b',
                      borderColor: donkerdereRandkleurVanHex(selectedEntiteitMeta?.kleur || '#64748b'),
                      color: '#111827',
                    }}
                  >
                    <span className="action-section-title">
                      <span>Entiteit {entiteitType} id={selectedA.id} - acties</span>
                      <ActionTooltip text={String(selectedEntiteitMeta?.description || "")} placement="below" />
                    </span>
                    <button
                      onMouseDown={(event) => event.stopPropagation()}
                      onClick={() => { setEntiteitActieOpen(false); setActieResultaat(null); }}
                      style={{ background: 'transparent', color: '#111827', border: '1px solid rgba(15,23,42,0.28)', padding: '2px 10px', fontSize: 14, cursor: 'pointer', borderRadius: 5, flexShrink: 0 }}
                    >✕</button>
                  </div>
                  <EntiteitActieBox
                    accentColor={donkerdereRandkleurVanHex(selectedEntiteitMeta?.kleur || '#64748b')}
                    entiteitType={entiteitType}
                    selectedA={selectedA}
                    setEntiteitActieOpen={setEntiteitActieOpen}
                    setActieResultaat={setActieResultaat}
                    actieOpmerking={actieOpmerking}
                    setActieOpmerking={setActieOpmerking}
                    voerEntiteitActieUit={voerEntiteitActieUit}
                    actieBezig={actieBezig}
                    gegevenselementGroepOpties={gegevenselementGroepOpties}
                    voegEntiteitGegevenRijToe={voegEntiteitGegevenRijToe}
                    entiteitNieuweGegevens={entiteitNieuweGegevens}
                    veranderEntiteitGegevenRijType={veranderEntiteitGegevenRijType}
                    updateEntiteitGegevenRijVeld={updateEntiteitGegevenRijVeld}
                    setEntiteitNieuweGegevens={setEntiteitNieuweGegevens}
                    relatieGroepOpties={relatieGroepOpties}
                    voegEntiteitRelatieRijToe={voegEntiteitRelatieRijToe}
                    entiteitNieuweRelaties={entiteitNieuweRelaties}
                    veranderEntiteitRelatieRijType={veranderEntiteitRelatieRijType}
                    updateEntiteitRelatieRijVeld={updateEntiteitRelatieRijVeld}
                    relatieSecondaireOpties={relatieSecondaireOpties}
                    setEntiteitNieuweRelaties={setEntiteitNieuweRelaties}
                    entiteitOpvoerPreview={entiteitOpvoerPreview}
                    actieResultaat={actieResultaat}
                    safeArray={safeArray}
                    isMaterieel={!!selectedEntiteitMeta?.isMaterieel}
                    entiteitAanvangDatum={entiteitAanvangDatum}
                    setEntiteitAanvangDatum={setEntiteitAanvangDatum}
                    entiteitEindeDatum={entiteitEindeDatum}
                    setEntiteitEindeDatum={setEntiteitEindeDatum}
                    entiteitOortjes={entiteitOortjes}
                  />
                </div>
              </div>
            )}

            {geselecteerdeRep && (
              <div
                className="action-overlay-backdrop"
                onClick={() => {
                  setGeselecteerdeRep(null);
                  setActieResultaat(null);
                }}
              >
                <div
                  className="action-overlay-dialog"
                  style={overlayDialogStyle('representatie', {
                    borderColor: donkerdereRandkleurVanHex(geselecteerdeRep?.group?.kleur || '#64748b'),
                  })}
                  onClick={(event) => event.stopPropagation()}
                >
                  <div
                    className="action-overlay-drag-handle"
                    onMouseDown={startOverlayDrag('representatie')}
                    style={{
                      background: geselecteerdeRep?.group?.kleur || '#64748b',
                      borderColor: donkerdereRandkleurVanHex(geselecteerdeRep?.group?.kleur || '#64748b'),
                      color: '#111827',
                    }}
                  >
                    <span className="action-section-title">
                      {/* Titel toont het dynamische idKolom (bijv. "versie" voor plumbing types, "rel_id" voor reguliere GE's).
                          De waarde wordt opgezocht via het JSON-veldnaam dat door de schema API vertaald is via jsonNaamVoorBunKolom. */}
                      <span>{geselecteerdeRep.group.doeltype} - {geselecteerdeRep.group.typeMeta?.idKolom || 'rel_id'}={geselecteerdeRep.item[geselecteerdeRep.group.typeMeta?.idKolom] ?? geselecteerdeRep.item.rel_id ?? geselecteerdeRep.item.id ?? '?'}</span>
                      <ActionTooltip text={String(geselecteerdeRep?.group?.typeMeta?.description || "")} placement="below" />
                    </span>
                    <button
                      onMouseDown={(event) => event.stopPropagation()}
                      onClick={() => { setGeselecteerdeRep(null); setActieResultaat(null); }}
                      style={{ background: 'transparent', color: '#111827', border: '1px solid rgba(15,23,42,0.28)', padding: '2px 10px', fontSize: 14, cursor: 'pointer', borderRadius: 5, flexShrink: 0 }}
                    >✕</button>
                  </div>
                  <RepresentatieActieBox
                    accentColor={donkerdereRandkleurVanHex(geselecteerdeRep?.group?.kleur || '#64748b')}
                    geselecteerdeRep={geselecteerdeRep}
                    setGeselecteerdeRep={setGeselecteerdeRep}
                    setActieResultaat={setActieResultaat}
                    actieOpmerking={actieOpmerking}
                    setActieOpmerking={setActieOpmerking}
                    actieFormVelden={actieFormVelden}
                    setActieFormVelden={setActieFormVelden}
                    repActiePreview={repActiePreview}
                    voerActieUit={voerActieUit}
                    actieBezig={actieBezig}
                    actieResultaat={actieResultaat}
                    secondaireEntiteitIDKolom={String(geselecteerdeRep?.group?.typeMeta?.secondaireEntiteitIDKolom || '').toLowerCase()}
                    secondaireInfo={relatieSecondaireOpties[`${geselecteerdeRep?.group?.rolnaam}__${geselecteerdeRep?.group?.doeltype}`] || { loading: false, ids: [], error: "" }}
                    isMaterieel={!!(typeMetaByTypenaam?.[geselecteerdeRep?.group?.doeltype]?.isMaterieel && typeMetaByTypenaam?.[geselecteerdeRep?.group?.doeltype]?.ge_subtype === "hub")}
                    repAanvangDatum={repAanvangDatum}
                    setRepAanvangDatum={setRepAanvangDatum}
                    repEindeDatum={repEindeDatum}
                    setRepEindeDatum={setRepEindeDatum}
                    repOortjes={typeMetaByTypenaam?.[geselecteerdeRep?.group?.doeltype]?.isMaterieel ? bepaalHubOortjes(geselecteerdeRep?.item) : null}
                  />
                </div>
              </div>
            )}
          </div>
        );
      }
