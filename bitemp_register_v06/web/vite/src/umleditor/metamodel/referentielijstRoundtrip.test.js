import test from 'node:test';
import assert from 'node:assert/strict';
import { editorNaarV3Model } from './types.js';
import { v3ModelNaarEditor } from './v3ModelNaarEditor.js';

test('referentielijst-instantie use-edge en handles blijven behouden in V3 roundtrip', () => {
  const nodes = [
    {
      id: 'Lijst',
      type: 'entiteit',
      position: { x: 10, y: 10 },
      data: { typenaam: 'Lijst', metatype: 'entiteit', entiteitSubtype: 'referentielijst', velden: [], afgeleideVelden: [] },
    },
    {
      id: 'LijstItems',
      type: 'relatie',
      position: { x: 100, y: 100 },
      data: {
        typenaam: 'LijstItems',
        metatype: 'relatie',
        relatieSubtype: 'referentielijst_items',
        referentielijstInstantie: 'Landenlijst',
        velden: [],
        afgeleideVelden: [],
      },
    },
    {
      id: 'Item',
      type: 'entiteit',
      position: { x: 220, y: 180 },
      data: { typenaam: 'Item', metatype: 'entiteit', entiteitSubtype: 'referentielijst_item', velden: [], afgeleideVelden: [] },
    },
    {
      id: 'refinstantie_Landenlijst',
      type: 'referentielijstInstantie',
      position: { x: 20, y: 180 },
      data: { systeemnaam: 'Landenlijst', naam: 'Landenlijst', omschrijving: 'landen' },
    },
  ];

  const edges = [
    {
      id: 'owner-edge',
      source: 'Lijst',
      target: 'LijstItems',
      type: 'metamodel',
      sourceHandle: 'source-bottom',
      targetHandle: 'target-top',
      data: { momentvoorkomen: 'meervoudig', kardinaliteit: '0..*' },
    },
    {
      id: 'target-edge',
      source: 'LijstItems',
      target: 'Item',
      type: 'metamodel',
      sourceHandle: 'source-bottom',
      targetHandle: 'target-top',
      data: { momentvoorkomen: 'meervoudig', kardinaliteit: '0..*' },
    },
    {
      id: 'binding-edge',
      source: 'refinstantie_Landenlijst',
      target: 'LijstItems',
      type: 'metamodel',
      sourceHandle: 'source-right',
      targetHandle: 'target-left',
      data: { isDependency: true },
    },
  ];

  const v3 = editorNaarV3Model(nodes, edges, { naam: 'Roundtrip test' });
  const relatie = v3.entiteiten[0].relaties[0];

  assert.equal(relatie.referentielijstInstantie, 'Landenlijst');
  assert.equal(relatie.instantieId, 'binding-edge');
  assert.equal(relatie.instantieSourceHandle, 'source-right');
  assert.equal(relatie.instantieTargetHandle, 'target-left');

  const hersteld = v3ModelNaarEditor(v3);
  const bindingEdge = hersteld.edges.find((e) => e.id === 'binding-edge');

  assert.ok(bindingEdge);
  assert.equal(bindingEdge.source, 'refinstantie_Landenlijst');
  assert.equal(bindingEdge.target, 'LijstItems');
  assert.equal(bindingEdge.sourceHandle, 'source-right');
  assert.equal(bindingEdge.targetHandle, 'target-left');
  assert.equal(bindingEdge.data?.isDependency, true);
});

test('«use» edges naar enums en datatypes bewaren handles in V3 roundtrip', () => {
  const nodes = [
    {
      id: 'Ding',
      type: 'entiteit',
      position: { x: 0, y: 0 },
      data: { typenaam: 'Ding', metatype: 'entiteit', velden: [], afgeleideVelden: [] },
    },
    {
      id: 'Ding_Info',
      type: 'gegevenselement',
      position: { x: 100, y: 100 },
      data: {
        typenaam: 'Ding_Info',
        metatype: 'gegevenselement',
        velden: [
          { naam: 'kleur', enumNaam: 'Kleur', type: 'string' },
          { naam: 'adres', datatypeNaam: 'NLPostcode', type: 'string' },
        ],
        afgeleideVelden: [],
      },
    },
    {
      id: 'enum_Kleur',
      type: 'enumeratie',
      position: { x: 300, y: 50 },
      data: { naam: 'Kleur', waarden: ['Rood', 'Groen', 'Blauw'] },
    },
    {
      id: 'dt_NLPostcode',
      type: 'gegevenstype',
      position: { x: 300, y: 200 },
      data: { naam: 'NLPostcode', basistype: 'string' },
    },
  ];

  const edges = [
    {
      id: 'Ding->Ding_Info',
      source: 'Ding',
      target: 'Ding_Info',
      type: 'metamodel',
      data: { momentvoorkomen: 'enkelvoudig', kardinaliteit: '0..1' },
    },
    {
      id: 'Ding_Info-->Kleur',
      source: 'Ding_Info',
      target: 'enum_Kleur',
      type: 'metamodel',
      sourceHandle: 'source-right',
      targetHandle: 'target-left',
      data: { isDependency: true },
    },
    {
      id: 'Ding_Info--dt-->NLPostcode',
      source: 'Ding_Info',
      target: 'dt_NLPostcode',
      type: 'metamodel',
      sourceHandle: 'source-bottom',
      targetHandle: 'target-top',
      data: { isDependency: true },
    },
  ];

  // Export naar V3
  const v3 = editorNaarV3Model(nodes, edges, { naam: 'UseEdge test' });
  const ge = v3.entiteiten[0].gegevenselementen[0];

  assert.ok(ge.useEdges, 'useEdges moet aanwezig zijn op GE');
  assert.equal(ge.useEdges.length, 2);

  const enumUE = ge.useEdges.find((ue) => ue.doel === 'Kleur');
  assert.ok(enumUE, 'useEdge voor Kleur moet bestaan');
  assert.equal(enumUE.sourceHandle, 'source-right');
  assert.equal(enumUE.targetHandle, 'target-left');

  const dtUE = ge.useEdges.find((ue) => ue.doel === 'NLPostcode');
  assert.ok(dtUE, 'useEdge voor NLPostcode moet bestaan');
  assert.equal(dtUE.sourceHandle, 'source-bottom');
  assert.equal(dtUE.targetHandle, 'target-top');

  // Import terug uit V3
  const hersteld = v3ModelNaarEditor(v3);

  const enumEdge = hersteld.edges.find((e) => e.target === 'enum_Kleur');
  assert.ok(enumEdge, 'enum edge moet bestaan na import');
  assert.equal(enumEdge.sourceHandle, 'source-right');
  assert.equal(enumEdge.targetHandle, 'target-left');

  const dtEdge = hersteld.edges.find((e) => e.target === 'dt_NLPostcode');
  assert.ok(dtEdge, 'datatype edge moet bestaan na import');
  assert.equal(dtEdge.sourceHandle, 'source-bottom');
  assert.equal(dtEdge.targetHandle, 'target-top');
});

test('verborgen «use» edges worden bewaard in V3 roundtrip', () => {
  const nodes = [
    {
      id: 'X',
      type: 'entiteit',
      position: { x: 0, y: 0 },
      data: { typenaam: 'X', metatype: 'entiteit', velden: [], afgeleideVelden: [] },
    },
    {
      id: 'X_Data',
      type: 'gegevenselement',
      position: { x: 100, y: 100 },
      data: {
        typenaam: 'X_Data',
        metatype: 'gegevenselement',
        velden: [{ naam: 'status', enumNaam: 'Status', type: 'string' }],
        afgeleideVelden: [],
      },
    },
    {
      id: 'enum_Status',
      type: 'enumeratie',
      position: { x: 300, y: 50 },
      data: { naam: 'Status', waarden: ['Open', 'Gesloten'] },
    },
  ];

  const edges = [
    {
      id: 'X->X_Data',
      source: 'X',
      target: 'X_Data',
      type: 'metamodel',
      data: { momentvoorkomen: 'enkelvoudig', kardinaliteit: '0..1' },
    },
    {
      id: 'X_Data-->Status',
      source: 'X_Data',
      target: 'enum_Status',
      type: 'metamodel',
      hidden: true,
      data: { isDependency: true },
    },
  ];

  const v3 = editorNaarV3Model(nodes, edges, { naam: 'Hidden test' });
  const ge = v3.entiteiten[0].gegevenselementen[0];
  assert.ok(ge.useEdges, 'useEdges aanwezig');
  assert.equal(ge.useEdges[0].hidden, true);

  const hersteld = v3ModelNaarEditor(v3);
  const statusEdge = hersteld.edges.find((e) => e.target === 'enum_Status');
  assert.ok(statusEdge, 'edge bestaat na import');
  assert.equal(statusEdge.hidden, true, 'edge moet verborgen zijn');
});

test('datatype met foutieve enum-verwijzing maakt geen wees-lijntje', () => {
  const v3 = {
    versie: 'v3',
    naam: 'orphan-edge-regression',
    datatypes: [
      { naam: 'Datum', basistype: 'string', format: 'date' },
    ],
    enums: [
      { goType: 'Fase', waarden: [{ waarde: 'Idee' }] },
    ],
    entiteiten: [
      {
        typenaam: 'Initiatief',
        meervoud: 'initiatieven',
        gegevenselementen: [
          {
            naam: 'Planning',
            meervoud: 'planningen',
            momentvoorkomen: 'enkelvoudig',
            velden: [
              { naam: 'startdatum', goType: 'Datum', enum: 'Datum', datatype: 'Datum' },
              { naam: 'fase', goType: 'Fase', enum: 'Fase' },
            ],
          },
        ],
        relaties: [],
      },
    ],
  };

  const hersteld = v3ModelNaarEditor(v3);
  const depEdges = hersteld.edges.filter((e) => e.source === 'Initiatief_Planning' && e.data?.isDependency);

  assert.equal(depEdges.length, 2, 'alleen Datum-datatype en Fase-enum mogen een edge maken');
  assert.ok(depEdges.some((e) => e.target === 'dt_Datum'), 'datatype-edge naar dt_Datum moet bestaan');
  assert.ok(depEdges.some((e) => e.target === 'enum_Fase'), 'enum-edge naar enum_Fase moet bestaan');
  assert.equal(depEdges.some((e) => e.target === 'enum_Datum'), false, 'er mag geen wees-lijntje naar enum_Datum ontstaan');
});
