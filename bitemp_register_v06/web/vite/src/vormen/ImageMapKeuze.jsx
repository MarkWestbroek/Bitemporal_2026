import { useMemo, useState } from "react";
import useKeuze from "./useKeuze";
import { itemsUitConfig } from "./imageMap";

/**
 * ImageMapKeuze — de vorm `image-map`: klikbare gebieden op een afbeelding.
 * Bedient twee invoersoorten, zonder dat de data verandert:
 *  - één uit een lijst  (meervoudig = false, XForms select1) → waarde = één sleutel
 *  - meer uit een lijst (meervoudig = true,  XForms select)  → waarde = array van sleutels
 *
 * Tekenen gebeurt hier; toestand, toetsenbord en ARIA komen uit useKeuze (API als
 * downshift). De afbeelding ligt onder een SVG met viewBox 0..1 × 0..1 zonder
 * aspect-behoud, zodat relatieve coördinaten precies over de afbeelding vallen.
 *
 * Props:
 *  - config:     vormConfig (zie imageMap.js)
 *  - opties:     keuzebron (enum-waarden of { id, label }); dient ter controle en voor labels
 *  - meervoudig: false = één, true = meer
 *  - waarde:     sleutel (één) of sleutels (meer)
 *  - onChange:   (sleutel | sleutels) => void — "" als niets gekozen (één)
 *  - readOnly
 *  - labelId:    id van het label van het formulierveld (aria-labelledby)
 */
export default function ImageMapKeuze({ config, opties, meervoudig = false, waarde, onChange, readOnly = false, labelId }) {
  // hoogte/breedte van de afbeelding; nodig om een `circle` in fracties rond te houden
  const [aspect, setAspect] = useState(config?.width > 0 && config?.height > 0 ? config.height / config.width : 1);
  const [focus, setFocus] = useState(false);
  const { items, fouten } = useMemo(() => itemsUitConfig(config, opties, { aspect }), [config, opties, aspect]);

  const sleutels = meervoudig ? (Array.isArray(waarde) ? waarde.map(String) : []) : (waarde == null || waarde === "" ? [] : [String(waarde)]);
  const gekozen = items.filter((it) => sleutels.includes(it.waarde));

  const {
    getMenuProps, getItemProps, highlightedIndex, isSelected, removeSelectedItem, selectedItems,
  } = useKeuze({
    items,
    itemToKey: (it) => it?.waarde ?? null,
    itemToString: (it) => it?.label ?? "",
    multiple: meervoudig,
    readOnly,
    // Gecontroleerd: de formulierwaarde is de bron van waarheid.
    ...(meervoudig ? { selectedItems: gekozen } : { selectedItem: gekozen[0] ?? null }),
    onSelectedItemChange: ({ selectedItem }) => onChange(selectedItem?.waarde ?? ""),
    onSelectedItemsChange: ({ selectedItems: sel }) => {
      // Sleutels die (nog) niet als area bestaan, blijven staan: een vorm verandert de data niet.
      const bekend = new Set(items.map((it) => it.waarde));
      onChange([...sleutels.filter((k) => !bekend.has(k)), ...sel.map((it) => it.waarde)]);
    },
  });

  if (!config?.image) {
    return <div style={{ color: "var(--cg-fout, red)" }}>image-map zonder afbeelding (vormConfig.image)</div>;
  }

  // Gekozen = heldere rand, de rest gedimd zodra er iets gekozen is: zo blijft de keuze
  // leesbaar op elke afbeelding, ook als die zelf al blauw is. Kleur in te stellen.
  const accent = config.accentColor || "#f59e0b";
  const focusKleur = "var(--cg-blauw, #2563eb)";
  const ietsGekozen = gekozen.length > 0;
  const menuProps = getMenuProps({
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    ...(labelId ? { "aria-labelledby": labelId } : {}),
  });

  return (
    <div className="cg-image-map">
      <div style={{ position: "relative", maxWidth: config.maxWidth || "100%", lineHeight: 0 }}>
        <img
          src={config.image}
          alt={config.alt || ""}
          style={{ display: "block", width: "100%", height: "auto", userSelect: "none" }}
          draggable={false}
          onLoad={(e) => {
            const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
            if (w > 0 && h > 0 && !(config.width > 0)) setAspect(h / w);
          }}
        />
        <svg
          {...menuProps}
          viewBox="0 0 1 1"
          preserveAspectRatio="none"
          style={{
            position: "absolute", inset: 0, width: "100%", height: "100%",
            outline: focus ? `2px solid ${focusKleur}` : "none", outlineOffset: 2, cursor: readOnly ? "default" : "pointer",
          }}
        >
          {/* Witte halo onder elke omtrek: de rand blijft zichtbaar op lichte én donkere afbeeldingen. */}
          <g aria-hidden="true" pointerEvents="none">
            {items.map((item, index) => {
              const { tag: Tag, attrs } = item.svg;
              const breed = isSelected(item) ? 4 : highlightedIndex === index ? 3 : 1.5;
              return <Tag key={item.waarde} {...attrs} vectorEffect="non-scaling-stroke" style={{ fill: "none", stroke: "#ffffff", strokeOpacity: 0.85, strokeWidth: breed + 3 }} />;
            })}
          </g>
          {items.map((item, index) => {
            const { tag: Tag, attrs } = item.svg;
            const aan = isSelected(item);
            const licht = highlightedIndex === index;
            return (
              <Tag
                key={item.waarde}
                {...attrs}
                {...getItemProps({ item, index })}
                vectorEffect="non-scaling-stroke"
                style={{
                  // gekozen: helder, dikke rand · gemarkeerd: licht opgehelderd · rest: gedimd
                  // als er iets gekozen is, anders alleen een gestippelde omtrek
                  fill: aan ? accent : licht ? "#ffffff" : ietsGekozen ? "#0f172a" : "#ffffff",
                  fillOpacity: aan ? 0.12 : licht ? 0.3 : ietsGekozen ? 0.45 : 0.06,
                  stroke: aan ? accent : licht ? focusKleur : "#0f172a",
                  strokeOpacity: aan || licht ? 1 : 0.7,
                  strokeWidth: aan ? 4 : licht ? 3 : 1.5,
                  strokeDasharray: aan || licht ? undefined : "5 4",
                  transition: "fill-opacity 120ms, stroke-width 120ms",
                }}
              >
                <title>{item.label}</title>
              </Tag>
            );
          })}
        </svg>
      </div>

      {/* Legenda: wat er gekozen is, in tekst — ook voor wie de afbeelding niet ziet. */}
      {config.legend !== false && (
        <div aria-live="polite" style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem", marginTop: "0.5rem", lineHeight: 1.4 }}>
          {selectedItems.length === 0 && (
            <span style={{ color: "var(--cg-donkergrijs, #666)", fontSize: "0.875rem" }}>
              {readOnly ? "Niets gekozen." : meervoudig ? "Klik op de gebieden die van toepassing zijn." : "Klik op een gebied."}
            </span>
          )}
          {selectedItems.map((it) => (
            <span key={it.waarde} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "0.2rem 0.6rem", borderRadius: 999, background: "var(--cg-lichtgrijs, #e2e8f0)", fontSize: "0.875rem" }}>
              {it.label}
              {!readOnly && (
                <button type="button" onClick={() => removeSelectedItem(it)} aria-label={`Verwijder ${it.label}`} style={{ border: "none", background: "none", cursor: "pointer", padding: 0, lineHeight: 1, color: "var(--cg-fout, #dc2626)" }}>✕</button>
              )}
            </span>
          ))}
        </div>
      )}

      {fouten.length > 0 && (
        <ul style={{ color: "var(--cg-fout, red)", fontSize: "0.8rem", margin: "0.25rem 0 0", paddingLeft: "1rem" }}>
          {fouten.map((f) => <li key={f}>{f}</li>)}
        </ul>
      )}
    </div>
  );
}
