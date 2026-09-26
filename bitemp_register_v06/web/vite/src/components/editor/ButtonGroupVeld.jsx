import ButtonGroupKeuze from "../../vormen/ButtonGroupKeuze";
import { knoppenUitOpties } from "../../vormen/buttonGroup";
import useRefOpties from "./useRefOpties";

/**
 * ButtonGroupVeld — koppelt de keuzebron van een veld (enum of referentielijst) aan de
 * vorm `button-group`. Voor een los veld (één uit een lijst) én voor het keuzeveld van een
 * lijst (meer uit een lijst, meervoudig = true).
 */
export default function ButtonGroupVeld({ veld, config, meervoudig = false, waarde, onChange, readOnly, labelId }) {
  const enumOpties = Array.isArray(veld?.enum) ? veld.enum.filter(Boolean) : [];
  const refOpties = useRefOpties(veld?.ref, { actief: enumOpties.length === 0 && Boolean(veld?.ref) });
  const opties = enumOpties.length ? enumOpties : refOpties;

  if (!veld?.ref && enumOpties.length === 0) {
    return <div style={{ color: "var(--cg-fout, red)" }}>Knoppenvlak vraagt een enum of referentielijst: <code>{veld?.naam}</code></div>;
  }
  if (opties === null) return <div style={{ color: "var(--cg-donkergrijs, #666)", fontSize: "0.875rem" }}>Laden…</div>;

  return (
    <ButtonGroupKeuze
      items={knoppenUitOpties(opties)}
      config={config || {}}
      meervoudig={meervoudig}
      waarde={waarde}
      onChange={onChange}
      readOnly={readOnly}
      labelId={labelId}
    />
  );
}
