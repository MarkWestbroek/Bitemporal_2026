/**
 * EdgeEditPanel — Sidebar voor het bewerken van een geselecteerde edge (relatie).
 *
 * Toont:
 *   - Bron en doel type (readonly)
 *   - Rolnaam, JSON rolnaam
 *   - Momentvoorkomen (enkelvoudig/meervoudig)
 *   - Kardinaliteit
 *
 * Props:
 *   - edge: de geselecteerde React Flow edge
 *   - nodes: alle nodes (voor naam-lookup)
 *   - onUpdate(edgeId, newData): callback om edge data bij te werken
 *   - onDelete(edgeId): callback om de edge te verwijderen
 */
import { MOMENTVOORKOMENS } from "../../metamodel/types";

const KARDINALITEITEN = ["0..1", "1", "0..*", "1..*"];

export default function EdgeEditPanel({ edge, nodes, onUpdate, onDelete }) {
  if (!edge) return null;

  const data = edge.data || {};
  const sourceNode = nodes.find((n) => n.id === edge.source);
  const targetNode = nodes.find((n) => n.id === edge.target);

  function updateField(key, value) {
    onUpdate(edge.id, { ...data, [key]: value });
  }

  return (
    <div className="edit-panel">
      <h3>Relatie bewerken</h3>

      <div className="edge-endpoints">
        <div className="endpoint">
          <span className="endpoint-label">Bron:</span>
          <span className="endpoint-value">
            {sourceNode?.data?.typenaam || edge.source}
          </span>
        </div>
        <div className="endpoint">
          <span className="endpoint-label">Doel:</span>
          <span className="endpoint-value">
            {targetNode?.data?.typenaam || edge.target}
          </span>
        </div>
      </div>

      <label>
        Rolnaam
        <input
          type="text"
          value={data.rolnaam || ""}
          onChange={(e) => updateField("rolnaam", e.target.value)}
        />
      </label>

      <label>
        JSON-rolnaam
        <input
          type="text"
          value={data.jsonRolnaam || ""}
          onChange={(e) => updateField("jsonRolnaam", e.target.value)}
        />
      </label>

      <label>
        Momentvoorkomen
        <select
          value={data.momentvoorkomen || "enkelvoudig"}
          onChange={(e) => updateField("momentvoorkomen", e.target.value)}
        >
          {MOMENTVOORKOMENS.map((mv) => (
            <option key={mv} value={mv}>
              {mv}
            </option>
          ))}
        </select>
      </label>

      <label>
        Kardinaliteit
        <select
          value={data.kardinaliteit || "0..1"}
          onChange={(e) => updateField("kardinaliteit", e.target.value)}
        >
          {KARDINALITEITEN.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </label>

      <h4>Aansluitpunten</h4>

      <label>
        Bron (vertrek)
        <select
          value={edge.sourceHandle || "bottom"}
          onChange={(e) => onUpdate(edge.id, data, { sourceHandle: e.target.value })}
        >
          <option value="top">Boven</option>
          <option value="right">Rechts</option>
          <option value="bottom">Onder</option>
          <option value="left">Links</option>
        </select>
      </label>

      <label>
        Doel (aankomst)
        <select
          value={edge.targetHandle || "top"}
          onChange={(e) => onUpdate(edge.id, data, { targetHandle: e.target.value })}
        >
          <option value="top">Boven</option>
          <option value="right">Rechts</option>
          <option value="bottom">Onder</option>
          <option value="left">Links</option>
        </select>
      </label>

      <div className="panel-actions">
        <button className="btn-danger" onClick={() => onDelete(edge.id)}>
          Verwijder relatie
        </button>
      </div>
    </div>
  );
}
