import ImageMapKeuze from "../../vormen/ImageMapKeuze";
import ButtonGroupKeuze from "../../vormen/ButtonGroupKeuze";
import CardsKeuze from "../../vormen/CardsKeuze";
import NlMapKeuze from "../../vormen/NlMapKeuze";
import SwitchKeuze from "../../vormen/SwitchKeuze";
import RangeKeuze from "../../vormen/RangeKeuze";
import RotaryKeuze from "../../vormen/RotaryKeuze";
import StepperKeuze from "../../vormen/StepperKeuze";
import ChipsWeergave from "../../vormen/ChipsWeergave";
import MaskedInvoer from "../../vormen/MaskedInvoer";
import PartialDateInvoer from "../../vormen/PartialDateInvoer";
import DurationInvoer from "../../vormen/DurationInvoer";
import NumberStepper from "../../vormen/NumberStepper";
import ColorInvoer from "../../vormen/ColorInvoer";
import TagInvoer from "../../vormen/TagInvoer";
import RankingKeuze from "../../vormen/RankingKeuze";
import CodeVeld from "./CodeVeld";
import AiAssistVeld from "./AiAssistVeld";
import { knoppenUitOpties } from "../../vormen/buttonGroup";
import useRefOpties from "./useRefOpties";

/**
 * VormInvoer — de Omnium-kant van de vormen op ÉÉN veld (los veld, het keuzeveld van een lijst,
 * of een lijst in één veld): haalt de KEUZEBRON op (enum of referentielijst) en kiest het
 * vormcomponent. De vormen zelf halen niets op en kennen Omnium niet (draagbaar naar Imprint).
 *
 * Alle vormen hier werken met sleutels: één (string) of meer (array); de aanroeper zet die om
 * naar de opslag (veldwaarde, lijstrijen, of "a;b" in één veld).
 *
 * Props: vorm, veld (velddefinitie uit het schema), config (vormConfig), waarde, onChange,
 *        meervoudig, readOnly, labelId
 */
export const VORMINVOER = new Set(["image-map", "button-group", "cards", "nl-map", "switch", "range", "rotary", "stepper", "chips",
  "masked", "partial-date", "duration", "number-stepper", "color", "tag-input", "code", "markdown", "ranking", "ai-assist"]);

/** Vormen zonder keuzebron: ze bedienen tekst, een getal of een datum (uit het datatype). */
const ZONDER_KEUZEBRON = { "masked": MaskedInvoer, "partial-date": PartialDateInvoer, "duration": DurationInvoer, "number-stepper": NumberStepper, "color": ColorInvoer };

export default function VormInvoer({ vorm, veld, config = {}, waarde, onChange, meervoudig = false, readOnly = false, labelId }) {
  if (ZONDER_KEUZEBRON[vorm]) {
    const C = ZONDER_KEUZEBRON[vorm];
    return <C waarde={waarde} onChange={onChange} readOnly={readOnly} labelId={labelId} config={config || {}} />;
  }
  if (vorm === "ai-assist") {
    return <AiAssistVeld waarde={waarde} onChange={onChange} readOnly={readOnly} labelId={labelId} config={config || {}} veld={veld} />;
  }
  if (vorm === "code" || vorm === "markdown") {
    return <CodeVeld vorm={vorm} waarde={waarde} onChange={onChange} readOnly={readOnly} labelId={labelId} config={config || {}} />;
  }
  // tag-input zonder keuzebron: vrije labels. In één tekstveld opgeslagen met een
  // scheidingsteken (standaard ";"); als lijst (meervoudig) gewoon de sleutels.
  const heeftBron = (Array.isArray(veld?.enum) && veld.enum.length > 0) || Boolean(veld?.ref);
  if (vorm === "tag-input" && !heeftBron) {
    const sep = config?.separator || ";";
    const lijst = meervoudig ? [].concat(waarde ?? []) : String(waarde ?? "").split(sep).map((s) => s.trim()).filter(Boolean);
    return <TagInvoer waarde={lijst} onChange={(nieuw) => onChange(meervoudig ? nieuw : nieuw.join(sep))} readOnly={readOnly} labelId={labelId} config={config || {}} />;
  }
  return <VormMetKeuzebron vorm={vorm} veld={veld} config={config} waarde={waarde} onChange={onChange} meervoudig={meervoudig} readOnly={readOnly} labelId={labelId} />;
}

/** De vormen met een keuzebron (enum of referentielijst); eigen component vanwege de hook. */
function VormMetKeuzebron({ vorm, veld, config = {}, waarde, onChange, meervoudig = false, readOnly = false, labelId }) {
  const enumOpties = Array.isArray(veld?.enum) ? veld.enum.filter(Boolean) : [];
  const refOpties = useRefOpties(veld?.ref, { actief: enumOpties.length === 0 && Boolean(veld?.ref) });
  const bron = enumOpties.length ? enumOpties : refOpties;
  const cfg = config || {};

  if (vorm === "switch") return <SwitchKeuze waarde={waarde} onChange={onChange} readOnly={readOnly} labelId={labelId} config={cfg} />;
  if (vorm === "range" || vorm === "rotary") {
    // Getal: min/max/step uit de config; geordende lijst: de enum-volgorde.
    const items = bron && bron.length ? knoppenUitOpties(bron) : undefined;
    const C = vorm === "range" ? RangeKeuze : RotaryKeuze;
    return <C items={items} waarde={waarde} onChange={onChange} readOnly={readOnly} labelId={labelId} config={cfg} />;
  }
  if (veld?.ref && bron === null) return <div style={{ color: "var(--cg-donkergrijs, #666)", fontSize: "0.875rem" }}>Laden…</div>;

  const items = knoppenUitOpties(bron || []).map((it, i) => ({
    ...it,
    // nl-map koppelt op de CBS-code van het referentielijst-item (standaard het veld `code`).
    ...(refOpties && !enumOpties.length ? { code: refOpties[i]?.velden?.[cfg.codeField || "code"] } : {}),
  }));
  const gemeenschappelijk = { waarde, onChange, readOnly, labelId, meervoudig };

  switch (vorm) {
    case "image-map":
      return <ImageMapKeuze config={cfg} opties={enumOpties.length ? enumOpties : (refOpties || undefined)} {...gemeenschappelijk} />;
    case "button-group":
      return <ButtonGroupKeuze items={items} config={cfg} {...gemeenschappelijk} />;
    case "cards":
      return <CardsKeuze items={items} config={cfg} {...gemeenschappelijk} />;
    case "nl-map":
      return <NlMapKeuze items={readOnly ? items.filter((i) => [].concat(waarde ?? []).map(String).includes(i.value)) : items} config={cfg} {...gemeenschappelijk} />;
    case "ranking":
      return <RankingKeuze items={items} config={cfg} waarde={[].concat(waarde ?? [])} onChange={onChange} readOnly={readOnly} labelId={labelId} />;
    case "tag-input":
      return <TagInvoer items={items} config={cfg} waarde={[].concat(waarde ?? [])} onChange={onChange} readOnly={readOnly} labelId={labelId} />;
    case "stepper":
      return <StepperKeuze items={items} config={cfg} waarde={waarde} onChange={onChange} readOnly={readOnly} labelId={labelId} />;
    case "chips": {
      const gekozen = [].concat(waarde ?? []).map(String);
      return <ChipsWeergave items={items.filter((i) => gekozen.includes(i.value))} config={cfg} />;
    }
    default:
      return null;
  }
}
