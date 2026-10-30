import { useEffect, useRef, useState } from "react";

/**
 * BpmnWeergave — toont BPMN 2.0 XML als diagram (alleen lezen, met slepen en
 * zoomen) via de NavigatedViewer van bpmn-js. bpmn-js wordt pas geladen als er
 * een BPMN te tonen is, zodat de Inhoud Editor er niet zwaarder van wordt.
 *
 * Zonder BPMNDI (geen diagramgegevens) kan bpmn-js niets tekenen; dat meldt hij.
 */
export default function BpmnWeergave({ xml, hoogte = 520 }) {
  const houder = useRef(null);
  const viewer = useRef(null);
  const [fout, setFout] = useState("");

  useEffect(() => {
    let weg = false;
    (async () => {
      const [{ default: NavigatedViewer }] = await Promise.all([
        import("bpmn-js/lib/NavigatedViewer"),
        import("bpmn-js/dist/assets/diagram-js.css"),
        import("bpmn-js/dist/assets/bpmn-js.css"),
        import("bpmn-js/dist/assets/bpmn-font/css/bpmn.css"),
      ]);
      if (weg || !houder.current) return;
      viewer.current = viewer.current || new NavigatedViewer({ container: houder.current });
      try {
        const { warnings } = await viewer.current.importXML(xml);
        if (weg) return;
        viewer.current.get("canvas").zoom("fit-viewport", "auto");
        setFout(warnings?.length ? `${warnings.length} waarschuwing(en) bij het inlezen` : "");
      } catch (e) {
        if (!weg) setFout(`BPMN niet te tonen: ${e?.message || e}`);
      }
    })();
    return () => { weg = true; };
  }, [xml]);

  useEffect(() => () => { viewer.current?.destroy(); viewer.current = null; }, []);

  const passend = () => viewer.current?.get("canvas").zoom("fit-viewport", "auto");
  const zoom = (factor) => {
    const canvas = viewer.current?.get("canvas");
    if (canvas) canvas.zoom(canvas.zoom() * factor);
  };

  return (
    <div className="cg-bpmn-weergave">
      <div className="cg-bpmn-weergave__balk">
        <button type="button" onClick={() => zoom(1.2)} title="Inzoomen">＋</button>
        <button type="button" onClick={() => zoom(1 / 1.2)} title="Uitzoomen">－</button>
        <button type="button" onClick={passend} title="Passend maken">⤢</button>
        {fout && <span className="cg-bpmn-weergave__fout">{fout}</span>}
      </div>
      <div ref={houder} className="cg-bpmn-weergave__canvas" style={{ height: hoogte }} />
    </div>
  );
}
