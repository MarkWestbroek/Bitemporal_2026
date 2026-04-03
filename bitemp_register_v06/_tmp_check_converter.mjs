import { v3ModelNaarEditor } from './uml-editor/src/metamodel/v3ModelNaarEditor.js';

const res = await fetch('http://localhost:8082/api/schema/model/code');
const data = await res.json();
const v3 = (data?.model && data.model.entiteiten) ? data.model : data;
const result = v3ModelNaarEditor(v3);
const rows = result.nodes
  .filter((n) => ['entiteit', 'gegevenselement', 'relatie'].includes(n.type))
  .filter((n) => /NatuurlijkPersoon|Locatie|Bereikbaarheid|Naam|Burgerschap|Partnernaam|Adres|BAGlocatie/.test(String(n.id)))
  .map((n) => ({ id: n.id, type: n.type, domein: n.data?.domein || '' }));
console.table(rows);
