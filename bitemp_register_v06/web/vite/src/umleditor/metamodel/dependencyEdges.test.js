import test from 'node:test';
import assert from 'node:assert/strict';
import { bepaalDependencyTargetIds } from './dependencyEdges.js';

test('bepaalt dependency-targets voor enum, datatype en refItem', () => {
  const beschikbareNodes = [
    { id: 'enum_soort', type: 'enumeratie', data: { naam: 'Soort' } },
    { id: 'dt_bsn', type: 'gegevenstype', data: { naam: 'BSN' } },
    { id: 'ref_land', type: 'entiteit', data: { entiteitSubtype: 'referentielijst_item', typenaam: 'Land' } },
    { id: 'refinst_landenlijst', type: 'referentielijstInstantie', data: { systeemnaam: 'Landenlijst' } },
  ];

  const nodeData = {
    referentielijstInstantie: 'Landenlijst',
    velden: [
      { naam: 'soort', enumNaam: 'Soort' },
      { naam: 'bsn', datatypeNaam: 'BSN' },
      { naam: 'land', refItemNaam: 'Land' },
    ],
  };

  assert.deepEqual(
    bepaalDependencyTargetIds(nodeData, beschikbareNodes).sort(),
    ['dt_bsn', 'enum_soort', 'ref_land', 'refinst_landenlijst'].sort()
  );
});

test('ondersteunt legacy goType en dedupliceert dubbele datatype-verwijzingen', () => {
  const beschikbareNodes = [
    { id: 'dt_bsn', type: 'gegevenstype', data: { naam: 'BSN' } },
  ];

  const nodeData = {
    velden: [
      { naam: 'bsn', datatypeNaam: 'BSN' },
      { naam: 'bsn_backup', goType: 'BSN' },
    ],
  };

  assert.deepEqual(bepaalDependencyTargetIds(nodeData, beschikbareNodes), ['dt_bsn']);
});
