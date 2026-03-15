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
} from "../shared/schemaUtils";
import SchemaIndexHeader from "../components/index/SchemaIndexHeader";
import SchemaIndexControls from "../components/index/SchemaIndexControls";
import IndexRegistratieVisual from "../components/index/IndexRegistratieVisual";
import IndexRepresentatieVisual from "../components/index/IndexRepresentatieVisual";
import RegistratieActieBox from "../components/actions/RegistratieActieBox";
import EntiteitActieBox from "../components/actions/EntiteitActieBox";
import RepresentatieActieBox from "../components/actions/RepresentatieActieBox";

function normaliseerNietNegatiefGeheelGetal(value, fallback = 0) {
        const parsed = Number.parseInt(String(value), 10);
        if (Number.isNaN(parsed)) {
          return fallback;
        }
        return Math.max(0, parsed);
      }

      function vindEntiteitIdVanuitRegistratie(registratie, entiteiten, entiteitType) {
        const wijzigingen = safeArray(registratie?.wijzigingen);
        const doelType = String(entiteitType || '').toUpperCase();

        for (const wijziging of wijzigingen) {
          if (String(wijziging?.entiteitnaam || '').toUpperCase() !== doelType) {
            continue;
          }

          const kandidaatId = wijziging?.entiteit_id;
          if (kandidaatId === null || kandidaatId === undefined || kandidaatId === '') {
            continue;
          }

          const kandidaatAlsString = String(kandidaatId);
          const bestaat = entiteiten.some((item) => String(item.id) === kandidaatAlsString);
          if (bestaat) {
            return kandidaatAlsString;
          }
        }

        return '';
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
          'Z',
        ].join(' ');
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

      function endpointSegmentVoorEntiteit(entiteitType) {
        return `${String(entiteitType || '').toLowerCase()}s`;
      }

      function responseKeyVoorEntiteiten(entiteitType, responseJson) {
        const type = String(entiteitType || '');
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

      function labelVoorChildType(doeltype, rolnaam) {
        return String(doeltype || rolnaam || '?');
      }

      function leidEntiteitTypeAfUitRegistratie(registratie, beschikbareEntiteitTypen) {
        const wijzigingen = safeArray(registratie?.wijzigingen);
        const beschikbareNamen = new Set(
          safeArray(beschikbareEntiteitTypen)
            .map((item) => String(item?.typenaam || '').trim())
            .filter(Boolean)
        );

        for (const wijziging of wijzigingen) {
          const kandidaat = String(wijziging?.entiteitnaam || '').trim();
          if (kandidaat && beschikbareNamen.has(kandidaat)) {
            return kandidaat;
          }
        }

        return '';
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
        const [entiteitType, setEntiteitType] = useState('A');
        const [t, setT] = useState(1);
        const [registratieId, setRegistratieId] = useState(1);
        const [loading, setLoading] = useState(false);
        const [error, setError] = useState('');
        const [responseData, setResponseData] = useState(null);
        const [responseKey, setResponseKey] = useState('As');
        const [registratieData, setRegistratieData] = useState(null);
        const [ongedaanGemaakteRegistratieData, setOngedaanGemaakteRegistratieData] = useState(null);
        const [selectedEntiteitId, setSelectedEntiteitId] = useState('');
        const [vizSchema, setVizSchema] = useState(null);
        const [schemaError, setSchemaError] = useState('');
        const [geselecteerdeRep, setGeselecteerdeRep] = useState(null); // { item, group }
        const [entiteitActieOpen, setEntiteitActieOpen] = useState(false);
        const [nieuweEntiteitActieOpen, setNieuweEntiteitActieOpen] = useState(false);
        const [nieuweEntiteitID, setNieuweEntiteitID] = useState('');
        const [nieuweEntiteitIDInfo, setNieuweEntiteitIDInfo] = useState({ loading: false, maxId: null, nextId: null, error: '' });
        const [entiteitNieuweGegevens, setEntiteitNieuweGegevens] = useState([]); // [{ id, groupKey, values }]
        const [entiteitNieuweRelaties, setEntiteitNieuweRelaties] = useState([]); // [{ id, groupKey, values }]
        const [nieuweEntiteitGegevens, setNieuweEntiteitGegevens] = useState([]); // [{ id, groupKey, values }]
        const [nieuweEntiteitRelaties, setNieuweEntiteitRelaties] = useState([]); // [{ id, groupKey, values }]
        const [entiteitNieuweGegevensVolgendId, setEntiteitNieuweGegevensVolgendId] = useState(1);
        const [entiteitNieuweRelatiesVolgendId, setEntiteitNieuweRelatiesVolgendId] = useState(1);
        const [nieuweEntiteitGegevensVolgendId, setNieuweEntiteitGegevensVolgendId] = useState(1);
        const [nieuweEntiteitRelatiesVolgendId, setNieuweEntiteitRelatiesVolgendId] = useState(1);
        const [relatieSecondaireOpties, setRelatieSecondaireOpties] = useState({}); // groupKey -> { loading, ids, error }
        const [actieOpmerking, setActieOpmerking] = useState('');
        const [nieuweEntiteitOpmerking, setNieuweEntiteitOpmerking] = useState('');
        const [actieFormVelden, setActieFormVelden] = useState({});
        const [actieBezig, setActieBezig] = useState(false);
        const [nieuweEntiteitBezig, setNieuweEntiteitBezig] = useState(false);
        const [actieResultaat, setActieResultaat] = useState(null); // { ok, bericht }
        const [nieuweEntiteitResultaat, setNieuweEntiteitResultaat] = useState(null); // { ok, bericht }

        const nieuweEntiteitFormRef = useRef(null);
        const registratieActieFormRef = useRef(null);

        const [registratieActieOpen, setRegistratieActieOpen] = useState(false);
        const [registratieActieBezig, setRegistratieActieBezig] = useState(false);
        const [registratieActieResultaat, setRegistratieActieResultaat] = useState(null);
        const [registratieActieOpmerking, setRegistratieActieOpmerking] = useState('');
        const [registratieOngedaanBevestiging, setRegistratieOngedaanBevestiging] = useState(false);
        const [registratieCorrigeerActief, setRegistratieCorrigeerActief] = useState(false);
        const [registratieCorrigeerVelden, setRegistratieCorrigeerVelden] = useState({});

        const entiteitTypen = useMemo(() => {
          const allTypes = safeArray(vizSchema?.types);
          return allTypes.filter((item) => String(item.metatype) === 'entiteit');
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

        const childGroups = useMemo(() => {
          const skeleton = safeArray(selectedEntiteitMeta?.onderliggende).map((child) => ({
            typeMeta: typeMetaByTypenaam[child.doeltype] || null,
            rolnaam: child.rolnaam,
            jsonRolnaam: child.jsonRolnaam || '',
            doeltype: child.doeltype,
            metatype: String(typeMetaByTypenaam[child.doeltype]?.metatype || ''),
            kleur: String(typeMetaByTypenaam[child.doeltype]?.kleur || ''),
            secondaireEntiteitIDKolom: String(typeMetaByTypenaam[child.doeltype]?.secondaireEntiteitIDKolom || ''),
            items: selectedA ? childArrayVoorRol(selectedA, child.rolnaam, child.jsonRolnaam) : [],
          }));

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

          return [...childGroups].sort((a, b) => rank(a) - rank(b));
        }, [childGroups]);

        const gegevenselementGroepOpties = useMemo(() => {
          const overSlaan = new Set(['rel_id', 'id', 'a_id', 'b_id', 'opvoer', 'afvoer', 'aanvang', 'einde']);
          return childGroupsGesorteerd
            .filter((group) => String(group?.metatype || '').toLowerCase() === 'gegevenselement')
            .map((group) => {
              const groupKey = `${group.rolnaam}__${group.doeltype}`;
              const voorbeeld = safeArray(group.items)[0] || {};
              const schemaVeldDefinities = safeArray(group?.typeMeta?.velden)
                .filter((veld) => veld && !overSlaan.has(String(veld.naam || '').toLowerCase()))
                .map((veld) => ({
                  naam: String(veld.naam || ''),
                  type: String(veld.type || 'string'),
                  defaultValue: '',
                  verplicht: Boolean(veld.verplicht),
                }))
                .filter((veld) => veld.naam);
              const afgeleideVeldDefinities = veldEntries(voorbeeld)
                .filter(([k]) => !overSlaan.has(k))
                .map(([k, v]) => ({
                  naam: k,
                  type: typeof v,
                  defaultValue: v === null || v === undefined ? '' : String(v),
                }));
              const veldDefinities = schemaVeldDefinities.length > 0 ? schemaVeldDefinities : afgeleideVeldDefinities;
              return {
                groupKey,
                group,
                label: labelVoorChildType(group.doeltype, group.rolnaam),
                geVeldnaam: String(group?.typeMeta?.veldnaam || group.doeltype.toLowerCase()),
                entiteitIDKolom: String(group?.typeMeta?.entiteitIDKolom || ''),
                veldDefinities,
              };
            });
        }, [childGroupsGesorteerd]);

        const relatieGroepOpties = useMemo(() => {
          const standaardOverSlaan = new Set(['rel_id', 'id', 'opvoer', 'afvoer', 'aanvang', 'einde']);
          return childGroupsGesorteerd
            .filter((group) => String(group?.metatype || '').toLowerCase() === 'relatie')
            .map((group) => {
              const groupKey = `${group.rolnaam}__${group.doeltype}`;
              const primaireKolom = String(group?.typeMeta?.entiteitIDKolom || '').toLowerCase();
              const secondaireKolom = String(group?.typeMeta?.secondaireEntiteitIDKolom || '');
              const overSlaan = new Set(standaardOverSlaan);
              if (primaireKolom) {
                overSlaan.add(primaireKolom);
              }

              const voorbeeld = safeArray(group.items)[0] || {};
              const schemaVeldDefinities = safeArray(group?.typeMeta?.velden)
                .filter((veld) => veld && !overSlaan.has(String(veld.naam || '').toLowerCase()))
                .map((veld) => ({
                  naam: String(veld.naam || ''),
                  type: String(veld.type || 'string'),
                  defaultValue: '',
                  verplicht: Boolean(veld.verplicht),
                }))
                .filter((veld) => veld.naam);
              const afgeleideVeldDefinities = veldEntries(voorbeeld)
                .filter(([k]) => !overSlaan.has(String(k).toLowerCase()))
                .map(([k, v]) => ({
                  naam: k,
                  type: typeof v,
                  defaultValue: v === null || v === undefined ? '' : String(v),
                }));
              const veldDefinities = schemaVeldDefinities.length > 0 ? schemaVeldDefinities : afgeleideVeldDefinities;

              return {
                groupKey,
                group,
                label: labelVoorChildType(group.doeltype, group.rolnaam),
                geVeldnaam: String(group?.typeMeta?.veldnaam || group.doeltype.toLowerCase()),
                entiteitIDKolom: String(group?.typeMeta?.entiteitIDKolom || ''),
                secondaireEntiteitIDKolom: secondaireKolom,
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
                if (veld.type === 'number') {
                  const parsed = Number(raw);
                  item[veld.naam] = Number.isNaN(parsed) ? raw : parsed;
                } else if (veld.type === 'boolean') {
                  item[veld.naam] = raw === true || raw === 'true';
                } else {
                  item[veld.naam] = raw;
                }
              });
              return { opvoer: { [optie.geVeldnaam]: item } };
            });
            return { ok: true, payload: { registratie, wijzigingen } };
          } catch (err) {
            return { ok: false, fout: String(err?.message || err) };
          }
        }, [selectedA, selectedEntiteitMeta, entiteitType, entiteitNieuweGegevens, entiteitNieuweRelaties, actieOpmerking, gegevenselementGroepOpties, relatieGroepOpties]);

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
                item[veld.naam] = coercedWaardeVoorType(raw, veld.type, `${optie.label}.${veld.naam}`);
              });
              wijzigingen.push({ opvoer: { [optie.geVeldnaam]: item } });
            });

            return { ok: true, payload: { registratie, wijzigingen } };
          } catch (err) {
            return { ok: false, fout: String(err?.message || err) };
          }
        }, [selectedEntiteitMeta, entiteitType, nieuweEntiteitOpmerking, nieuweEntiteitID, nieuweEntiteitGegevens, nieuweEntiteitRelaties, gegevenselementGroepOpties, relatieGroepOpties]);

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
          if (!entiteitActieOpen && !nieuweEntiteitActieOpen) {
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
        }, [baseUrl, entiteitActieOpen, nieuweEntiteitActieOpen, relatieGroepOpties, relatieSecondaireOpties]);

        // Live preview voor de rep-actiebox (afvoer + correctie).
        const repActiePreview = useMemo(() => {
          if (!geselecteerdeRep) return null;
          const { item, group } = geselecteerdeRep;
          const veldnaam = group.typeMeta?.veldnaam || group.doeltype.toLowerCase();
          const opmerking = actieOpmerking.trim() || undefined;
          try {
            const afvoerPayload = {
              registratie: { registratietype: 'registratie', ...(opmerking ? { opmerking } : {}) },
              wijzigingen: [{ afvoer: { [veldnaam]: { ...item } } }],
            };
            const nieuwItem = { ...item };
            Object.entries(actieFormVelden).forEach(([k, v]) => {
              const origineel = item[k];
              if (typeof origineel === 'number') {
                const parsed = Number(v);
                nieuwItem[k] = Number.isNaN(parsed) ? v : parsed;
              } else if (typeof origineel === 'boolean') {
                nieuwItem[k] = v === 'true' || v === true;
              } else {
                nieuwItem[k] = v;
              }
            });
            const corrigeerPayload = {
              registratie: { registratietype: 'correctie', ...(opmerking ? { opmerking } : {}) },
              wijzigingen: [{ opvoer: { [veldnaam]: nieuwItem } }],
            };
            return { ok: true, afvoer: afvoerPayload, corrigeer: corrigeerPayload };
          } catch (err) {
            return { ok: false, fout: String(err?.message || err) };
          }
        }, [geselecteerdeRep, actieOpmerking, actieFormVelden]);

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

        async function loadData({ tValue = t, registratieIdValue = registratieId, selecteerVanuitRegistratie = false } = {}) {
          let doelEntiteitType = entiteitType;
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

            const segment = endpointSegmentVoorEntiteit(doelEntiteitType);
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

        const plumbingVelden = new Set(['rel_id', 'id', 'a_id', 'b_id', 'opvoer', 'afvoer', 'aanvang', 'einde']);

        function selecteerRep(item, group) {
          const bewerkbaar = {};
          veldEntries(item)
            .filter(([k]) => !plumbingVelden.has(k))
            .forEach(([k, v]) => { bewerkbaar[k] = v ?? ''; });
          setEntiteitActieOpen(false);
          setNieuweEntiteitActieOpen(false);
          setGeselecteerdeRep({ item, group });
          setActieFormVelden(bewerkbaar);
          setActieOpmerking('');
          setActieResultaat(null);
        }

        function initialiseerGeWaardenVoorOptie(optie) {
          const values = {};
          safeArray(optie?.veldDefinities).forEach((veld) => {
            values[veld.naam] = veld.defaultValue;
          });
          return values;
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

        function zoekGroupEnItemVoorWijziging(w) {
          if (!w.representatienaam || !w.representatie_id) return null;
          for (const group of childGroups) {
            const typeNaam = String(group.doeltype || '').toLowerCase();
            const rolNaam = String(group.rolnaam || '').toLowerCase();
            const repNaam = String(w.representatienaam || '').toLowerCase();
            if (typeNaam === repNaam || rolNaam === repNaam) {
              const gevonden = group.items.find((item) => String(item.rel_id ?? item.id) === String(w.representatie_id));
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
                veldEntries(match.item)
                  .filter(([k]) => !plumbingVelden.has(k))
                  .forEach(([k, v]) => { bewerkbaar[k] = String(v ?? ''); });
                initieleVelden[String(w.representatie_id)] = bewerkbaar;
              }
            });
          setRegistratieCorrigeerVelden(initieleVelden);
          setRegistratieCorrigeerActief(true);
          setRegistratieActieResultaat(null);
        }

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
            const registratie = { registratietype: 'correctie', ...(opmerking ? { opmerking } : {}) };
            const wijzigingen = selectedRegistratieWijzigingen
              .filter((w) => w.wijzigingstype === 'opvoer' && w.representatienaam && w.representatie_id)
              .map((w) => {
                const match = zoekGroupEnItemVoorWijziging(w);
                if (!match) return null;
                const { group, item } = match;
                if (item.afvoer != null && item.afvoer !== '' && item.afvoer !== 0) return null;
                const veldnaam = group.typeMeta?.veldnaam || String(group.doeltype || w.representatienaam).toLowerCase();
                const bewerkteVelden = registratieCorrigeerVelden[String(w.representatie_id)] || {};
                const nieuwItem = { ...item };
                Object.entries(bewerkteVelden).forEach(([k, v]) => {
                  const origineel = item[k];
                  if (typeof origineel === 'number') {
                    const parsed = Number(v);
                    nieuwItem[k] = Number.isNaN(parsed) ? v : parsed;
                  } else if (typeof origineel === 'boolean') {
                    nieuwItem[k] = v === 'true' || v === true;
                  } else {
                    nieuwItem[k] = v;
                  }
                });
                return { opvoer: { [veldnaam]: nieuwItem } };
              })
              .filter(Boolean);
            if (wijzigingen.length === 0) {
              throw new Error('Geen corrigeerbare opvoer-wijzigingen gevonden (representaties zijn mogelijk afgevoerd of niet geladen).');
            }
            const res = await fetch(`${baseUrl}/registratie/`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ registratie, wijzigingen }),
            });
            const json = await res.json().catch(() => ({}));
            if (res.ok) {
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
          setNieuweEntiteitActieOpen(true);
          setSelectedEntiteitId('');
          setRegistratieData(null);
          setOngedaanGemaakteRegistratieData(null);
          if (nieuweEntiteitGegevens.length === 0 && gegevenselementGroepOpties.length > 0) {
            voegNieuweEntiteitGegevenRijToe(gegevenselementGroepOpties[0].groupKey);
          }
          if (nieuweEntiteitRelaties.length === 0 && relatieGroepOpties.length > 0) {
            voegNieuweEntiteitRelatieRijToe(relatieGroepOpties[0].groupKey);
          }
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

        function coercedWaardeVoorType(rawValue, jsType, veldLabel) {
          if (jsType === 'number') {
            const parsed = Number(rawValue);
            if (Number.isNaN(parsed)) {
              throw new Error(`Veld ${veldLabel} moet een getal zijn.`);
            }
            return parsed;
          }
          if (jsType === 'boolean') {
            return rawValue === true || rawValue === 'true';
          }
          return rawValue;
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
              if (alleRijen.length === 0) {
                throw new Error('Voeg minimaal 1 gegevenselement of relatie toe.');
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
                  item[veld.naam] = coercedWaardeVoorType(raw, veld.type, `${optie.label}.${veld.naam}`);
                });
                return { opvoer: { [optie.geVeldnaam]: item } };
              });
            }

            const res = await fetch(`${baseUrl}/registratie/`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ registratie, wijzigingen }),
            });
            const json = await res.json().catch(() => ({}));
            if (res.ok) {
              const nieuweRegistratieID = registratieIDUitResponse(json);
              setActieResultaat({ ok: true, bericht: `${actie === 'afvoer' ? 'Entiteit-afvoer' : 'GE-opvoer'} geslaagd (registratie id=${nieuweRegistratieID || '-'})` });
              if (actie !== 'afvoer') {
                setEntiteitNieuweGegevens([]);
                setEntiteitNieuweRelaties([]);
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
                item[veld.naam] = coercedWaardeVoorType(raw, veld.type, `${optie.label}.${veld.naam}`);
              });
              wijzigingen.push({ opvoer: { [optie.geVeldnaam]: item } });
            });

            const res = await fetch(`${baseUrl}/registratie/`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ registratie, wijzigingen }),
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) {
              throw new Error(json.error || `HTTP ${res.status}: ${res.statusText}`);
            }

            const nieuweRegistratieID = registratieIDUitResponse(json);
            if (nieuweRegistratieID > 0) {
              setRegistratieId(nieuweRegistratieID);
              await loadData({ tValue: t, registratieIdValue: nieuweRegistratieID, selecteerVanuitRegistratie: true });
            } else {
              await loadData();
            }

            setNieuweEntiteitResultaat({ ok: true, bericht: `Nieuwe entiteit-opvoer geslaagd (registratie id=${nieuweRegistratieID || '-'})` });
            setNieuweEntiteitActieOpen(false);
            setNieuweEntiteitGegevens([]);
            setNieuweEntiteitRelaties([]);
          } catch (err) {
            setNieuweEntiteitResultaat({ ok: false, bericht: String(err?.message || err) });
          } finally {
            setNieuweEntiteitBezig(false);
          }
        }

        async function voerActieUit(actie) {
          if (!geselecteerdeRep) return;
          const { item, group } = geselecteerdeRep;
          const veldnaam = group.typeMeta?.veldnaam || group.doeltype.toLowerCase();
          setActieBezig(true);
          setActieResultaat(null);
          try {
            const opmerking = actieOpmerking.trim() || undefined;
            const registratietype = actie === 'corrigeer' ? 'correctie' : 'registratie';
            const registratie = { registratietype, ...(opmerking ? { opmerking } : {}) };
            let wijzigingen;
            if (actie === 'afvoer') {
              wijzigingen = [{ afvoer: { [veldnaam]: { ...item } } }];
            } else {
              // corrigeer: alleen opvoer; de API voert de bestaande representatie zelf af
              const nieuwItem = { ...item };
              Object.entries(actieFormVelden).forEach(([k, v]) => {
                const origineel = item[k];
                if (typeof origineel === 'number') {
                  const parsed = Number(v);
                  nieuwItem[k] = Number.isNaN(parsed) ? v : parsed;
                } else if (typeof origineel === 'boolean') {
                  nieuwItem[k] = v === 'true' || v === true;
                } else {
                  nieuwItem[k] = v;
                }
              });
              wijzigingen = [{ opvoer: { [veldnaam]: nieuwItem } }];
            }
            const res = await fetch(`${baseUrl}/registratie/`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ registratie, wijzigingen }),
            });
            const json = await res.json().catch(() => ({}));
            if (res.ok) {
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
        }, [t, registratieId, loading, entiteitType, geselecteerdeRep, entiteitActieOpen, registratieActieOpen]);

        const selectedRegistratie = registratieData;
        const selectedRegistratieWijzigingen = safeArray(registratieData?.wijzigingen);
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
              <div className="card" ref={nieuweEntiteitFormRef} style={{ marginTop: 12, border: '1.5px dashed #0f766e', background: '#f0fdfa' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <strong style={{ fontSize: 16 }}>Nieuwe entiteit {entiteitType} opvoeren</strong>
                  <button
                    onClick={() => { setNieuweEntiteitActieOpen(false); setNieuweEntiteitResultaat(null); }}
                    style={{ background: 'transparent', color: '#475569', border: '1px solid #cbd5e1', padding: '3px 10px', fontSize: 13 }}
                  >✕</button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, marginBottom: 10 }}>
                  <label>
                    Nieuwe {entiteitType}-id
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={nieuweEntiteitID}
                      onChange={(e) => setNieuweEntiteitID(e.target.value)}
                    />
                  </label>
                  <label>
                    Opmerking
                    <input value={nieuweEntiteitOpmerking} onChange={(e) => setNieuweEntiteitOpmerking(e.target.value)} placeholder="optioneel" />
                  </label>
                  <div style={{ display: 'flex', alignItems: 'end', gap: 8 }}>
                    <button
                      onClick={openNieuweEntiteitActieBox}
                      disabled={nieuweEntiteitIDInfo.loading || !entiteitType}
                      style={{ background: '#0f766e' }}
                    >
                      {nieuweEntiteitIDInfo.loading ? 'Zoeken...' : 'Zoek volgende vrije id'}
                    </button>
                    <span className="muted" style={{ fontSize: 12 }}>
                      {nieuweEntiteitIDInfo.error
                        ? `Fout: ${nieuweEntiteitIDInfo.error}`
                        : (nieuweEntiteitIDInfo.nextId !== null
                          ? `max=${nieuweEntiteitIDInfo.maxId ?? '-'} | suggestie=${nieuweEntiteitIDInfo.nextId}`
                          : 'Geen id-suggestie geladen')}
                    </span>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid #99f6e4', paddingTop: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <strong style={{ fontSize: 14 }}>Gegevenselementen toevoegen</strong>
                    <button onClick={() => voegNieuweEntiteitGegevenRijToe(gegevenselementGroepOpties[0]?.groupKey)} disabled={nieuweEntiteitBezig || gegevenselementGroepOpties.length === 0}>+ GE-regel</button>
                  </div>
                  {nieuweEntiteitGegevens.map((row) => (
                    <div key={`new-ge-${row.id}`} style={{ border: '1px solid #d1fae5', borderRadius: 8, padding: 10, marginBottom: 8, background: '#ffffff' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(170px, 260px) 1fr auto', gap: 8, alignItems: 'start' }}>
                        <label>
                          Type
                          <select value={row.groupKey} onChange={(e) => veranderNieuweEntiteitGegevenRijType(row.id, e.target.value)}>
                            {gegevenselementGroepOpties.map((optie) => (
                              <option key={`new-ge-opt-${optie.groupKey}`} value={optie.groupKey}>{optie.label}</option>
                            ))}
                          </select>
                        </label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8 }}>
                          {(() => {
                            const optie = gegevenselementGroepOpties.find((o) => o.groupKey === row.groupKey);
                            const velden = safeArray(optie?.veldDefinities);
                            if (velden.length === 0) return <span className="muted" style={{ fontSize: 12 }}>Geen veldinformatie beschikbaar.</span>;
                            return velden.map((veld) => {
                              const huidigeWaarde = row?.values?.[veld.naam] ?? '';
                              if (veld.type === 'boolean') {
                                return (
                                  <label key={`new-ge-${row.id}-${veld.naam}`}>
                                    {veld.naam}
                                    <select value={String(huidigeWaarde)} onChange={(e) => updateNieuweEntiteitGegevenRijVeld(row.id, veld.naam, e.target.value)}>
                                      <option value="">(leeg)</option>
                                      <option value="true">true</option>
                                      <option value="false">false</option>
                                    </select>
                                  </label>
                                );
                              }
                              return (
                                <label key={`new-ge-${row.id}-${veld.naam}`}>
                                  {veld.naam}
                                  <input
                                    type={veld.type === 'number' ? 'number' : 'text'}
                                    step={veld.type === 'number' ? 'any' : undefined}
                                    value={String(huidigeWaarde)}
                                    onChange={(e) => updateNieuweEntiteitGegevenRijVeld(row.id, veld.naam, e.target.value)}
                                  />
                                </label>
                              );
                            });
                          })()}
                        </div>
                        <button onClick={() => setNieuweEntiteitGegevens((prev) => prev.filter((r) => r.id !== row.id))} disabled={nieuweEntiteitBezig} style={{ background: '#475569', alignSelf: 'end' }}>Verwijder</button>
                      </div>
                    </div>
                  ))}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '10px 0 8px' }}>
                    <strong style={{ fontSize: 14 }}>Relaties toevoegen</strong>
                    <button onClick={() => voegNieuweEntiteitRelatieRijToe(relatieGroepOpties[0]?.groupKey)} disabled={nieuweEntiteitBezig || relatieGroepOpties.length === 0}>+ Relatie-regel</button>
                  </div>
                  {nieuweEntiteitRelaties.map((row) => (
                    <div key={`new-rel-${row.id}`} style={{ border: '1px solid #d1fae5', borderRadius: 8, padding: 10, marginBottom: 8, background: '#ffffff' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(170px, 260px) 1fr auto', gap: 8, alignItems: 'start' }}>
                        <label>
                          Type
                          <select value={row.groupKey} onChange={(e) => veranderNieuweEntiteitRelatieRijType(row.id, e.target.value)}>
                            {relatieGroepOpties.map((optie) => (
                              <option key={`new-rel-opt-${optie.groupKey}`} value={optie.groupKey}>{optie.label}</option>
                            ))}
                          </select>
                        </label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8 }}>
                          {(() => {
                            const optie = relatieGroepOpties.find((o) => o.groupKey === row.groupKey);
                            const velden = safeArray(optie?.veldDefinities);
                            if (velden.length === 0) return <span className="muted" style={{ fontSize: 12 }}>Geen veldinformatie beschikbaar.</span>;
                            const secondaireInfo = relatieSecondaireOpties[row.groupKey] || { loading: false, ids: [], error: '' };
                            return velden.map((veld) => {
                              const huidigeWaarde = row?.values?.[veld.naam] ?? '';
                              if (veld.naam === optie?.secondaireEntiteitIDKolom && safeArray(secondaireInfo.ids).length > 0) {
                                return (
                                  <label key={`new-rel-${row.id}-${veld.naam}`}>
                                    {veld.naam}
                                    <select value={String(huidigeWaarde)} onChange={(e) => updateNieuweEntiteitRelatieRijVeld(row.id, veld.naam, e.target.value)}>
                                      <option value="">(kies id)</option>
                                      {safeArray(secondaireInfo.ids).map((idOptie) => (
                                        <option key={`new-rel-id-${row.id}-${idOptie}`} value={String(idOptie)}>{String(idOptie)}</option>
                                      ))}
                                    </select>
                                  </label>
                                );
                              }
                              if (veld.type === 'boolean') {
                                return (
                                  <label key={`new-rel-${row.id}-${veld.naam}`}>
                                    {veld.naam}
                                    <select value={String(huidigeWaarde)} onChange={(e) => updateNieuweEntiteitRelatieRijVeld(row.id, veld.naam, e.target.value)}>
                                      <option value="">(leeg)</option>
                                      <option value="true">true</option>
                                      <option value="false">false</option>
                                    </select>
                                  </label>
                                );
                              }
                              return (
                                <label key={`new-rel-${row.id}-${veld.naam}`}>
                                  {veld.naam}
                                  <input
                                    type={veld.type === 'number' ? 'number' : 'text'}
                                    step={veld.type === 'number' ? 'any' : undefined}
                                    value={String(huidigeWaarde)}
                                    onChange={(e) => updateNieuweEntiteitRelatieRijVeld(row.id, veld.naam, e.target.value)}
                                  />
                                </label>
                              );
                            });
                          })()}
                        </div>
                        <button onClick={() => setNieuweEntiteitRelaties((prev) => prev.filter((r) => r.id !== row.id))} disabled={nieuweEntiteitBezig} style={{ background: '#475569', alignSelf: 'end' }}>Verwijder</button>
                      </div>
                    </div>
                  ))}

                  {nieuweEntiteitOpvoerPreview && (
                    <div style={{ margin: '10px 0', borderRadius: 6, overflow: 'hidden', border: '1px solid #99f6e4' }}>
                      <div style={{ background: '#ccfbf1', padding: '4px 10px', fontSize: 12, fontWeight: 600, color: '#115e59' }}>Preview: te versturen payload (nieuwe entiteit + onderliggende opvoer)</div>
                      {nieuweEntiteitOpvoerPreview.ok
                        ? <pre style={{ margin: 0, padding: '8px 10px', fontSize: 12, background: '#f0fdfa', overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{JSON.stringify(nieuweEntiteitOpvoerPreview.payload, null, 2)}</pre>
                        : <p style={{ margin: 0, padding: '6px 10px', color: '#dc2626', fontSize: 12 }}>{nieuweEntiteitOpvoerPreview.fout}</p>
                      }
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <button onClick={voerNieuweEntiteitActieUit} disabled={nieuweEntiteitBezig || !nieuweEntiteitOpvoerPreview?.ok} style={{ background: '#0f766e' }}>
                      {nieuweEntiteitBezig ? 'Bezig...' : `Voer nieuwe ${entiteitType} op`}
                    </button>
                    <span className="muted" style={{ fontSize: 12 }}>Na succes wordt automatisch naar de nieuwe registratie gesprongen.</span>
                  </div>
                </div>

                {nieuweEntiteitResultaat && (
                  <p style={{ marginTop: 8, marginBottom: 0, color: nieuweEntiteitResultaat.ok ? '#166534' : '#dc2626', fontWeight: 600 }}>
                    {nieuweEntiteitResultaat.bericht}
                  </p>
                )}
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
                                  {w.wijzigingstype} | entiteit={w.entiteitnaam}:{w.entiteit_id} | rep={w.representatienaam || '-'}:{w.representatie_id || '-'}
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
                              {w.wijzigingstype} | entiteit={w.entiteitnaam}:{w.entiteit_id} | rep={w.representatienaam || '-'}:{w.representatie_id || '-'}
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
              {childGroups.length === 0 && (
                <div className="card">
                  <h3>Gegevenselement-details</h3>
                  <ul>
                    <li>Geen records</li>
                  </ul>
                </div>
              )}

              {childGroupsGesorteerd.map((group) => {
                const typeLabel = labelVoorChildType(group.doeltype, group.rolnaam);
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
                <div className="action-overlay-dialog" onClick={(event) => event.stopPropagation()}>
                  <RegistratieActieBox
                    registratieActieFormRef={registratieActieFormRef}
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
                    plumbingVelden={plumbingVelden}
                    registratieCorrigeerVelden={registratieCorrigeerVelden}
                    setRegistratieCorrigeerVelden={setRegistratieCorrigeerVelden}
                    voerRegistratieCorrectieUit={voerRegistratieCorrectieUit}
                    registratieActieResultaat={registratieActieResultaat}
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
                <div className="action-overlay-dialog" onClick={(event) => event.stopPropagation()}>
                  <EntiteitActieBox
                    entiteitType={entiteitType}
                    selectedA={selectedA}
                    setEntiteitActieOpen={setEntiteitActieOpen}
                    setActieResultaat={setActieResultaat}
                    actieOpmerking={actieOpmerking}
                    setActieOpmerking={setActieOpmerking}
                    voerEntiteitActieUit={voerEntiteitActieUit}
                    actieBezig={actieBezig}
                    gegevenselementGroepOpties={gegevenselementGroepOpties}
                    voegEntiteitGegevenToe={voegEntiteitGegevenToe}
                    entiteitNieuweGegevens={entiteitNieuweGegevens}
                    veranderEntiteitGegevenRijType={veranderEntiteitGegevenRijType}
                    updateEntiteitGegevenRijVeld={updateEntiteitGegevenRijVeld}
                    setEntiteitNieuweGegevens={setEntiteitNieuweGegevens}
                    relatieGroepOpties={relatieGroepOpties}
                    voegEntiteitRelatieToe={voegEntiteitRelatieToe}
                    entiteitNieuweRelaties={entiteitNieuweRelaties}
                    veranderEntiteitRelatieRijType={veranderEntiteitRelatieRijType}
                    updateEntiteitRelatieRijVeld={updateEntiteitRelatieRijVeld}
                    relatieSecondaireOpties={relatieSecondaireOpties}
                    setEntiteitNieuweRelaties={setEntiteitNieuweRelaties}
                    entiteitOpvoerPreview={entiteitOpvoerPreview}
                    actieResultaat={actieResultaat}
                    safeArray={safeArray}
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
                <div className="action-overlay-dialog" onClick={(event) => event.stopPropagation()}>
                  <RepresentatieActieBox
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
                  />
                </div>
              </div>
            )}
          </div>
        );
      }
