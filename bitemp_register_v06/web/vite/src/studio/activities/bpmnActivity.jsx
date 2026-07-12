/**
 * bpmnActivity — BPMN-processen als activiteit (was: BpmnEditorDemoPage).
 *
 * Slot-indeling:
 *   Sidebar   → ModelPicker — velden kiezen voor het te koppelen berichttype
 *   Main      → BpmnEditor (bpmn.io canvas)
 *   Inspector → koppel-gereedschap (event / procescontract) + BPMN XML-export
 *
 * Gedeelde state (berichttype, selectie, editor-ref, xml) loopt via context.
 */
import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { ModelPicker } from "../../modelpicker";
import { nieuwBerichttype, voegVeldToe } from "../../bericht";
import { BpmnEditor, STARTER_BPMN, contractNaarIoMapping, valideerContract } from "../../bpmn";
import { IconBPMN } from "../icons";
import { menuBus } from "../menuBus";
import { apiBase, downloadTekst } from "../studioUtils";
import { registreerDocumentKoppeling } from "./activiteitAlsProfieltype.jsx";

const Ctx = createContext(null);

function BpmnProvider({ children }) {
  const editorRef = useRef(null);
  const [bericht, setBericht] = useState(() => nieuwBerichttype("InwonerAanmelding"));
  const [selectie, setSelectie] = useState(null);
  const [xml, setXml] = useState("");

  // Menubalk-acties (activiteit-specifiek "Proces"-menu) via de menuBus.
  useEffect(() => {
    const af = [
      menuBus.on("bpmn:nieuw-bericht", () => setBericht(nieuwBerichttype("NieuwBerichttype"))),
      menuBus.on("bpmn:export-xml", async () => {
        const out = (await editorRef.current?.exportXML()) || "";
        setXml(out);
        if (out) downloadTekst(out, "proces.bpmn", "application/xml");
      }),
    ];
    return () => af.forEach((off) => off());
  }, []);

  // Documentkoppeling voor de Modelleren-host: meerdere BPMN-documenten,
  // per document bewaard (inhoud = de BPMN-XML; null = starter).
  useEffect(
    () =>
      registreerDocumentKoppeling("bpmn", {
        haal: async () => (await editorRef.current?.exportXML()) || null,
        zet: async (inhoud) => {
          await editorRef.current?.laadXML(inhoud || STARTER_BPMN);
        },
      }),
    []
  );

  return (
    <Ctx.Provider value={{ editorRef, bericht, setBericht, selectie, setSelectie, xml, setXml }}>
      {children}
    </Ctx.Provider>
  );
}

function BpmnSidebar() {
  const { setBericht, bericht } = useContext(Ctx);
  const onPick = useCallback((ref) => setBericht((b) => voegVeldToe(b, ref)), [setBericht]);
  const geselecteerd = bericht.velden.map((v) => ({ typenaam: v.ref.typenaam, veldnaam: v.ref.veldnaam }));
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <p style={{ margin: 0, padding: "8px 10px", fontSize: 12, color: "var(--s-fg-muted)" }}>
        Stel een berichttype samen; koppel het rechts aan een event of procescontract.
      </p>
      <div style={{ flex: 1, minHeight: 0 }}>
        <ModelPicker baseUrl={apiBase()} onPick={onPick} multiSelect selected={geselecteerd} expandEntiteiten />
      </div>
    </div>
  );
}

function BpmnMain() {
  const { editorRef, setSelectie } = useContext(Ctx);
  // Vaste lichte "papier"-ondergrond: bpmn-js ondersteunt geen dark-thema.
  return (
    <div className="studio-paper" style={{ position: "absolute", inset: 0 }}>
      <BpmnEditor ref={editorRef} xml={STARTER_BPMN} onSelectionChange={setSelectie} />
    </div>
  );
}

function BpmnInspector() {
  const { editorRef, bericht, selectie, xml, setXml } = useContext(Ctx);
  const soort = selectie?.soort; // "event" | "contract" | null
  const contractMeldingen =
    soort === "contract" && selectie?.contract
      ? valideerContract(selectie.contract, { isCall: selectie.isCall })
      : [];
  const ioMapping = selectie?.isCall && selectie?.contract ? contractNaarIoMapping(selectie.contract) : null;

  const knop = { padding: "5px 10px", fontSize: 12, borderRadius: 5, border: "1px solid var(--s-border)", background: "var(--s-panel-head)", color: "var(--s-fg)", cursor: "pointer" };

  const koppelEvent = () => editorRef.current?.bindBerichttype(bericht);
  const wisEvent = () => editorRef.current?.wisBinding();
  const koppelContractKant = (kant) => {
    const huidig = selectie?.contract || { input: null, output: null };
    editorRef.current?.bindContract({ ...huidig, [kant]: bericht });
  };
  const wisContract = () => editorRef.current?.wisContract();
  const exporteer = async () => setXml((await editorRef.current?.exportXML()) || "");

  return (
    <div className="studio-inspector-pad">
      <h3 style={{ margin: "0 0 4px", fontSize: 13 }}>Selectie</h3>
      <p style={{ margin: "0 0 10px", color: "var(--s-fg-muted)" }}>
        {soort === "event" ? "Message/signal-event" : soort === "contract" ? (selectie.isCall ? "CallActivity" : "Proces") : "— niets geselecteerd —"}
      </p>

      {soort === "event" && (
        <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
          <button style={knop} onClick={koppelEvent}>Koppel berichttype</button>
          <button style={knop} onClick={wisEvent}>Wis</button>
        </div>
      )}

      {soort === "contract" && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
          <button style={knop} onClick={() => koppelContractKant("input")}>Als input</button>
          <button style={knop} onClick={() => koppelContractKant("output")}>Als output</button>
          <button style={knop} onClick={wisContract}>Wis contract</button>
        </div>
      )}

      {contractMeldingen.length > 0 && (
        <ul style={{ margin: "0 0 12px", paddingLeft: 16, fontSize: 12, color: "#f59e0b" }}>
          {contractMeldingen.map((m, i) => <li key={i}>{String(m.tekst || m)}</li>)}
        </ul>
      )}

      {ioMapping && (
        <details style={{ marginBottom: 12 }}>
          <summary style={{ cursor: "pointer", fontSize: 12 }}>camunda:in/out mapping</summary>
          <pre style={{ margin: "6px 0 0", background: "var(--s-panel-head)", padding: 8, borderRadius: 6, fontSize: 11, overflow: "auto" }}>
            {JSON.stringify(ioMapping, null, 2)}
          </pre>
        </details>
      )}

      <button style={{ ...knop, marginBottom: 8 }} onClick={exporteer}>Exporteer BPMN XML</button>
      {xml && (
        <pre style={{ margin: 0, background: "var(--s-panel-head)", padding: 8, borderRadius: 6, fontSize: 10, overflow: "auto", maxHeight: 280 }}>
          {xml}
        </pre>
      )}
    </div>
  );
}

export default {
  id: "bpmn",
  label: "BPMN-processen",
  icon: <IconBPMN />,
  groep: "modelleren",
  Provider: BpmnProvider,
  Sidebar: BpmnSidebar,
  Main: BpmnMain,
  Inspector: BpmnInspector,
  sidebarLabel: "Canoniek model",
  inspectorLabel: "Koppeling & export",
  // Activiteit-specifiek "Proces"-menu via de menuBus.
  menus: [
    {
      id: "proces",
      label: "Proces",
      items: [
        { id: "bpmn-nieuw-bericht", label: "Nieuw berichttype", onClick: () => menuBus.emit("bpmn:nieuw-bericht") },
        { type: "separator" },
        { id: "bpmn-export-xml", label: "Exporteer BPMN XML…", onClick: () => menuBus.emit("bpmn:export-xml") },
      ],
    },
  ],
};
