// 04b — wat het BPMN-plan niet kan zetten: het signaal op het eind- en het startevent, het type
// van het data-object (verwijzing naar de cm-entiteit; daaruit volgt ook de tracering) en de
// plaats en maat van de black-box-pools.
export default (proj, { zoek }) => {
  const m = proj.profielen.bpmnMotor05;
  const zet = {};
  const met = (naam, type, data) => {
    const el = zoek("bpmnMotor05", naam, type);
    zet[el.id] = { ...el, data: { ...el.data, ...data } };
    return el;
  };
  met("Vergunning verleend", "eind-event", { soort: "signaal", signaal: "vergunning-verleend" });
  met("Vergunning verleend", "start-event", { soort: "signaal", signaal: "vergunning-verleend" });
  const aanvraag = zoek("diagram05", "Evenementaanvraag", "entiteit");
  met("Aanvraag", "data-object", { type: { profielId: "diagram05", elementId: aanvraag.id }, rol: "invoer" });
  // Pools als brede balk boven of onder het proces.
  const plek = {
    Organisator: { x: 40, y: -110, w: 1640, h: 80 },
    Brandweer: { x: 240, y: 10, w: 440, h: 80 },
    Politie: { x: 240, y: 430, w: 440, h: 80 },
  };
  const diagrammen = {};
  for (const d of Object.values(m.diagrams)) {
    let geraakt = false;
    const nodes = d.nodes.map((n) => {
      const p = plek[m.elements[n.elementId]?.naam];
      if (!p || m.elements[n.elementId].elementType !== "pool") return n;
      geraakt = true;
      return { ...n, position: { x: p.x, y: p.y }, size: { width: p.w, height: p.h } };
    });
    if (geraakt) diagrammen[d.id] = { ...d, nodes };
  }
  return [
    { store: "model:bpmnMotor05", op: "patchElementen", args: [{ zet, wis: [] }] },
    { store: "model:bpmnMotor05", op: "patchDiagrammen", args: [{ zet: diagrammen, wis: [] }] },
  ];
};
