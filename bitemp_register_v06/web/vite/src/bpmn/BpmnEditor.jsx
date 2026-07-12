/**
 * BpmnEditor — bpmn-js Modeler-canvas met een custom moddle-extensie waarmee
 * message/signal-events gebonden worden aan een Berichttype (projectie over het
 * canoniek model). Stap 4 van de "driehoek proces – regels – data".
 *
 * De component:
 *  - registreert het `canoniek`-namespace (canoniekModdleDescriptor), zodat de
 *    binding round-trip overleeft als geldige BPMN extensionElements;
 *  - meldt selectiewijzigingen aan de host via onSelectionChange({id, naam, kind,
 *    binding}) — kind is "message" | "signal" | null;
 *  - biedt een imperatieve API (ref): bindBerichttype, wisBinding, exportXML.
 *
 * De daadwerkelijke binding-UI (Berichttype kiezen/samenstellen) leeft in de
 * host-pagina; deze component bewaakt alleen het diagram + de moddle-binding.
 */
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import BpmnModeler from "bpmn-js/lib/Modeler";
import "bpmn-js/dist/assets/diagram-js.css";
import "bpmn-js/dist/assets/bpmn-js.css";
import "bpmn-js/dist/assets/bpmn-font/css/bpmn.css";

import { canoniekModdleDescriptor, CANONIEK_PREFIX } from "./canoniekModdle";
import { eventKind, leesBinding, berichttypeNaarBindingData } from "./bpmnBinding";
import { bindbaarSoort, isCallActivity, leesContract } from "./procesContract";
import "./bpmn.css";

const BpmnEditor = forwardRef(function BpmnEditor({ xml, onSelectionChange, onError }, ref) {
  const containerRef = useRef(null);
  const modelerRef = useRef(null);
  const selectieRef = useRef(null);

  // Bouw de huidige selectie-info voor de host.
  const meldSelectie = (element) => {
    selectieRef.current = element || null;
    if (!onSelectionChange) return;
    if (!element) {
      onSelectionChange(null);
      return;
    }
    const bo = element.businessObject || {};
    onSelectionChange({
      id: element.id,
      naam: bo.name || "",
      kind: eventKind(element),
      soort: bindbaarSoort(element),
      isCall: isCallActivity(element),
      binding: leesBinding(bo),
      contract: leesContract(bo),
    });
  };

  useEffect(() => {
    const modeler = new BpmnModeler({
      container: containerRef.current,
      moddleExtensions: { [CANONIEK_PREFIX]: canoniekModdleDescriptor },
    });
    modelerRef.current = modeler;

    const eventBus = modeler.get("eventBus");
    const onSel = (e) => meldSelectie((e.newSelection && e.newSelection[0]) || null);
    eventBus.on("selection.changed", onSel);

    modeler
      .importXML(xml)
      .then(() => {
        modeler.get("canvas").zoom("fit-viewport");
      })
      .catch((err) => {
        if (onError) onError(err);
        // eslint-disable-next-line no-console
        console.error("[BpmnEditor] importXML faalde:", err);
      });

    return () => {
      eventBus.off("selection.changed", onSel);
      modeler.destroy();
      modelerRef.current = null;
    };
    // xml is alleen de initiële bron; wijzigingen lopen via de modeler zelf.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useImperativeHandle(ref, () => ({
    /** Vervang de volledige inhoud (documentwissel in de Modelleren-host). */
    async laadXML(nieuweXml) {
      const modeler = modelerRef.current;
      if (!modeler || !nieuweXml) return;
      await modeler.importXML(nieuweXml);
      modeler.get("canvas").zoom("fit-viewport");
    },

    /** Koppel (of vervang) het Berichttype op het geselecteerde event. */
    bindBerichttype(berichttype) {
      const modeler = modelerRef.current;
      const element = selectieRef.current;
      if (!modeler || !element || !eventKind(element)) return false;

      const moddle = modeler.get("moddle");
      const modeling = modeler.get("modeling");
      const bo = element.businessObject;

      const data = berichttypeNaarBindingData(berichttype);
      const velden = data.velden.map((f) => moddle.create("canoniek:FieldRef", f));
      const btEl = moddle.create("canoniek:Berichttype", {
        naam: data.naam,
        beschrijving: data.beschrijving,
        velden,
      });

      let ext = bo.extensionElements;
      const behoud = ext && Array.isArray(ext.values)
        ? ext.values.filter((v) => v.$type !== "canoniek:Berichttype")
        : [];
      if (!ext) ext = moddle.create("bpmn:ExtensionElements", { values: [] });
      ext.values = [...behoud, btEl];

      modeling.updateProperties(element, { extensionElements: ext });
      meldSelectie(element);
      return true;
    },

    /** Verwijder de Berichttype-binding van het geselecteerde event. */
    wisBinding() {
      const modeler = modelerRef.current;
      const element = selectieRef.current;
      if (!modeler || !element) return false;
      const bo = element.businessObject;
      const ext = bo.extensionElements;
      if (!ext || !Array.isArray(ext.values)) return false;
      ext.values = ext.values.filter((v) => v.$type !== "canoniek:Berichttype");
      modeler.get("modeling").updateProperties(element, { extensionElements: ext });
      meldSelectie(element);
      return true;
    },

    /**
     * Zet een procescontract (input/output-berichttype) op het geselecteerde
     * proces of de CallActivity. `contract` = {input, output} in berichtModel-
     * vorm. Lege kanten (null) worden weggelaten.
     */
    bindContract(contract) {
      const modeler = modelerRef.current;
      const element = selectieRef.current;
      if (!modeler || !element || bindbaarSoort(element) !== "contract") return false;

      const moddle = modeler.get("moddle");
      const modeling = modeler.get("modeling");
      const bo = element.businessObject;

      const maakBericht = (bericht, kant) => {
        if (!bericht) return null;
        const data = berichttypeNaarBindingData(bericht);
        const velden = data.velden.map((f) => moddle.create("canoniek:FieldRef", f));
        return moddle.create("canoniek:ContractBericht", {
          kant,
          naam: data.naam,
          beschrijving: data.beschrijving,
          velden,
        });
      };
      const berichten = [maakBericht(contract?.input, "input"), maakBericht(contract?.output, "output")].filter(Boolean);
      const contractEl = moddle.create("canoniek:Procescontract", { berichten });

      let ext = bo.extensionElements;
      const behoud = ext && Array.isArray(ext.values)
        ? ext.values.filter((v) => v.$type !== "canoniek:Procescontract")
        : [];
      if (!ext) ext = moddle.create("bpmn:ExtensionElements", { values: [] });
      ext.values = [...behoud, contractEl];

      modeling.updateProperties(element, { extensionElements: ext });
      meldSelectie(element);
      return true;
    },

    /** Verwijder het procescontract van het geselecteerde element. */
    wisContract() {
      const modeler = modelerRef.current;
      const element = selectieRef.current;
      if (!modeler || !element) return false;
      const bo = element.businessObject;
      const ext = bo.extensionElements;
      if (!ext || !Array.isArray(ext.values)) return false;
      ext.values = ext.values.filter((v) => v.$type !== "canoniek:Procescontract");
      modeler.get("modeling").updateProperties(element, { extensionElements: ext });
      meldSelectie(element);
      return true;
    },

    /** Exporteer het diagram als geformatteerde BPMN 2.0 XML. */
    async exportXML() {
      const modeler = modelerRef.current;
      if (!modeler) return "";
      const { xml: out } = await modeler.saveXML({ format: true });
      return out;
    },
  }));

  return <div className="bpmn-canvas" ref={containerRef} />;
});

export default BpmnEditor;
