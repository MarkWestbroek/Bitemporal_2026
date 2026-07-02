/**
 * BpmnEditorDemoPage — stappen 4 + 5 van de "driehoek proces – regels – data".
 *
 * De volledige keten in één scherm:
 *   ModelPicker → Berichttype samenstellen → koppelen aan:
 *     - een BPMN message/signal-event (event-binding, stap 4), OF
 *     - een proces / CallActivity als input- of output-berichttype van het
 *       Procescontract (stap 5).
 *   → exporteren als geldige BPMN XML met canoniek:extensionElements.
 *
 * Bij een CallActivity levert het contract PER VELD GETYPEERDE camunda:in/out-
 * mapping (geen variables="all").
 *
 * Route: /bpmn-demo (zie App.jsx)
 */
import { useCallback, useRef, useState } from "react";
import { ModelPicker } from "../modelpicker";
import { BerichttypeEditor, nieuwBerichttype, voegVeldToe } from "../bericht";
import { BpmnEditor, STARTER_BPMN, contractNaarIoMapping, valideerContract, naarCamundaIoXml } from "../bpmn";
import { apiBase } from "../shared/apiBase.js";

export default function BpmnEditorDemoPage() {
  const editorRef = useRef(null);
  const [bericht, setBericht] = useState(() => nieuwBerichttype("InwonerAanmelding"));
  const [selectie, setSelectie] = useState(null);
  const [xml, setXml] = useState("");

  const onPick = useCallback((ref) => {
    setBericht((b) => voegVeldToe(b, ref));
  }, []);

  const koppel = () => {
    editorRef.current?.bindBerichttype(bericht);
  };
  const wis = () => {
    editorRef.current?.wisBinding();
  };
  const koppelContractKant = (kant) => {
    const huidig = selectie?.contract || { input: null, output: null };
    editorRef.current?.bindContract({ ...huidig, [kant]: bericht });
  };
  const wisContract = () => {
    editorRef.current?.wisContract();
  };
  const exporteer = async () => {
    const out = await editorRef.current?.exportXML();
    setXml(out || "");
  };

  const geselecteerd = bericht.velden.map((v) => ({ typenaam: v.ref.typenaam, veldnaam: v.ref.veldnaam }));
  const soort = selectie?.soort; // "event" | "contract" | null
  const ioMapping = selectie?.isCall && selectie?.contract ? contractNaarIoMapping(selectie.contract) : null;
  const contractMeldingen =
    soort === "contract" && selectie?.contract
      ? valideerContract(selectie.contract, { isCall: selectie.isCall })
      : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", boxSizing: "border-box", padding: 16, gap: 12, fontFamily: "system-ui, sans-serif" }}>
      <div>
        <h2 style={{ margin: "0 0 2px", fontSize: 16 }}>BPMN-editor: getypeerde events én procescontracten</h2>
        <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>
          Selecteer een <b>message/signal-event</b> om een berichttype te koppelen, of een <b>proces / CallActivity</b>{" "}
          om een input-/output-berichttype (procescontract) te zetten. Bij een CallActivity wordt de mapping per veld
          getypeerd (<code>camunda:in/out</code>) — geen <code>variables="all"</code>. Bruikbaar in Valtimo/Operaton.
        </p>
      </div>

      {/* Canvas */}
      <div style={{ height: "46vh", minHeight: 280 }}>
        <BpmnEditor ref={editorRef} xml={STARTER_BPMN} onSelectionChange={setSelectie} />
      </div>

      {/* Gereedschap */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", gap: 16, overflow: "hidden" }}>
        <div style={{ width: 320, minWidth: 260, display: "flex", flexDirection: "column" }}>
          <h3 style={{ margin: "0 0 4px", fontSize: 14 }}>Canoniek model</h3>
          <div style={{ flex: 1, minHeight: 0 }}>
            <ModelPicker baseUrl={apiBase()} onPick={onPick} multiSelect selected={geselecteerd} expandEntiteiten />
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 8, overflow: "auto" }}>
          <h3 style={{ margin: 0, fontSize: 14 }}>Berichttype samenstellen</h3>
          <div className="bpmn-acties">
            {soort === "event" && (
              <button className="bpmn-btn bpmn-btn-primary" onClick={koppel}>
                Koppel aan event ({selectie.kind})
              </button>
            )}
            {soort === "contract" && (
              <>
                <button className="bpmn-btn bpmn-btn-primary" onClick={() => koppelContractKant("input")}>
                  Zet als input
                </button>
                <button className="bpmn-btn bpmn-btn-primary" onClick={() => koppelContractKant("output")}>
                  Zet als output
                </button>
              </>
            )}
            <span style={{ fontSize: 12, color: soort ? "#16a34a" : "#94a3b8" }}>
              {soort === "event"
                ? `Event: ${selectie.naam || selectie.id} (${selectie.kind})`
                : soort === "contract"
                ? `${selectie.isCall ? "CallActivity" : "Proces"}: ${selectie.naam || selectie.id}`
                : "Selecteer een event of proces/CallActivity in het diagram."}
            </span>
          </div>
          <BerichttypeEditor bericht={bericht} onChange={setBericht} />
        </div>

        <div style={{ width: 360, minWidth: 280, display: "flex", flexDirection: "column", gap: 8, overflow: "auto" }}>
          <h3 style={{ margin: 0, fontSize: 14 }}>Selectie & export</h3>
          <div className="bpmn-panel">
            <div className="bpmn-sel">
              {!selectie ? (
                <span className="bpmn-sel-leeg">Geen element geselecteerd.</span>
              ) : (
                <>
                  <div className="bpmn-sel-naam">
                    {selectie.naam || selectie.id}
                    <span className={`bpmn-badge bpmn-badge-${selectie.kind || (soort === "contract" ? "message" : "geen")}`}>
                      {selectie.kind || (selectie.isCall ? "CallActivity" : soort === "contract" ? "proces" : "geen event")}
                    </span>
                  </div>
                  {soort === "event" &&
                    (selectie.binding ? (
                      <div className="bpmn-binding">
                        <div className="bpmn-binding-naam">Berichttype: {selectie.binding.naam || "(naamloos)"}</div>
                        {selectie.binding.velden.map((f, i) => (
                          <div key={i} className={`bpmn-binding-veld${f.afgeleid ? " afgeleid" : ""}`}>
                            {f.afgeleid ? "/ " : ""}
                            {f.veldpad} <span style={{ color: "#94a3b8" }}>({f.t === "materieel" ? "t_m" : "t_f"})</span>
                          </div>
                        ))}
                        <button className="bpmn-btn bpmn-btn-del" style={{ marginTop: 6 }} onClick={wis}>
                          Binding verwijderen
                        </button>
                      </div>
                    ) : (
                      <div className="bpmn-sel-leeg" style={{ marginTop: 6 }}>Nog geen berichttype gekoppeld.</div>
                    ))}
                  {soort === "contract" && (
                    <div className="bpmn-binding">
                      <div className="bpmn-binding-naam">
                        Contract — input: {selectie.contract?.input?.naam || "—"} | output:{" "}
                        {selectie.contract?.output?.naam || "—"}
                      </div>
                      {contractMeldingen.map((m, i) => (
                        <div
                          key={i}
                          className="bpmn-binding-veld"
                          style={{ color: m.niveau === "fout" ? "#dc2626" : m.niveau === "waarschuwing" ? "#b45309" : "#16a34a" }}
                        >
                          {m.tekst}
                        </div>
                      ))}
                      {ioMapping && (
                        <div style={{ marginTop: 6 }}>
                          <div className="bpmn-binding-veld" style={{ color: "#64748b" }}>
                            Getypeerde mapping ({ioMapping.in.length}× in, {ioMapping.out.length}× out):
                          </div>
                          {ioMapping.in.map((x, i) => (
                            <div key={`in${i}`} className="bpmn-binding-veld">↓ in: {x.source}</div>
                          ))}
                          {ioMapping.out.map((x, i) => (
                            <div key={`out${i}`} className="bpmn-binding-veld">↑ out: {x.source}</div>
                          ))}
                        </div>
                      )}
                      {(selectie.contract?.input || selectie.contract?.output) && (
                        <button className="bpmn-btn bpmn-btn-del" style={{ marginTop: 6 }} onClick={wisContract}>
                          Contract verwijderen
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="bpmn-acties">
              <button className="bpmn-btn" onClick={exporteer}>
                Exporteer BPMN XML
              </button>
            </div>
            {ioMapping && (selectie.contract?.input || selectie.contract?.output) && (
              <pre className="bpmn-xml">{naarCamundaIoXml(selectie.contract)}</pre>
            )}
            {xml && <pre className="bpmn-xml">{xml}</pre>}
          </div>
        </div>
      </div>
    </div>
  );
}
