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
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: { momentvoorkomen: 'meervoudig', kardinaliteit: '0..*' },
    },
    {
      id: 'target-edge',
      source: 'LijstItems',
      target: 'Item',
      type: 'metamodel',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      data: { momentvoorkomen: 'meervoudig', kardinaliteit: '0..*' },
    },
    {
      id: 'binding-edge',
      source: 'refinstantie_Landenlijst',
      target: 'LijstItems',
      type: 'metamodel',
      sourceHandle: 'right',
      targetHandle: 'left',
      data: { isDependency: true },
    },
  ];

  const v3 = editorNaarV3Model(nodes, edges, { naam: 'Roundtrip test' });
  const relatie = v3.entiteiten[0].relaties[0];

  assert.equal(relatie.referentielijstInstantie, 'Landenlijst');
  assert.equal(relatie.instantieId, 'binding-edge');
  assert.equal(relatie.instantieSourceHandle, 'right');
  assert.equal(relatie.instantieTargetHandle, 'left');

  const hersteld = v3ModelNaarEditor(v3);
  const bindingEdge = hersteld.edges.find((e) => e.id === 'binding-edge');

  assert.ok(bindingEdge);
  assert.equal(bindingEdge.source, 'refinstantie_Landenlijst');
  assert.equal(bindingEdge.target, 'LijstItems');
  assert.equal(bindingEdge.sourceHandle, 'right');
  assert.equal(bindingEdge.targetHandle, 'left');
  assert.equal(bindingEdge.data?.isDependency, true);
});
