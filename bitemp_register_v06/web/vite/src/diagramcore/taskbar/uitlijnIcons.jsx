/**
 * uitlijnIcons — SVG-iconen voor de core-taakbalk "Uitlijnen".
 *
 * Zelfde symboliek als de oude editor-toolbar (lijn = de uitlijnrand, twee
 * blokjes = de elementen), maar een fractie kleiner (15px) en dunner (1.25).
 * currentColor zodat thema-kleuren automatisch volgen.
 */
const S = 15;
const Icoon = ({ children }) => (
  <svg width={S} height={S} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25">
    {children}
  </svg>
);

/** @type {Record<string, JSX.Element>} icoon per uitlijn-mode */
export const UITLIJN_ICONEN = {
  left: (
    <Icoon>
      <line x1="2" y1="1" x2="2" y2="15" />
      <rect x="2" y="3" width="8" height="3" fill="currentColor" stroke="none" />
      <rect x="2" y="9" width="11" height="3" fill="currentColor" stroke="none" />
    </Icoon>
  ),
  "center-h": (
    <Icoon>
      <line x1="8" y1="1" x2="8" y2="15" />
      <rect x="3" y="3" width="10" height="3" fill="currentColor" stroke="none" />
      <rect x="5" y="9" width="6" height="3" fill="currentColor" stroke="none" />
    </Icoon>
  ),
  right: (
    <Icoon>
      <line x1="14" y1="1" x2="14" y2="15" />
      <rect x="6" y="3" width="8" height="3" fill="currentColor" stroke="none" />
      <rect x="3" y="9" width="11" height="3" fill="currentColor" stroke="none" />
    </Icoon>
  ),
  top: (
    <Icoon>
      <line x1="1" y1="2" x2="15" y2="2" />
      <rect x="3" y="2" width="3" height="8" fill="currentColor" stroke="none" />
      <rect x="9" y="2" width="3" height="11" fill="currentColor" stroke="none" />
    </Icoon>
  ),
  "center-v": (
    <Icoon>
      <line x1="1" y1="8" x2="15" y2="8" />
      <rect x="3" y="3" width="3" height="10" fill="currentColor" stroke="none" />
      <rect x="9" y="5" width="3" height="6" fill="currentColor" stroke="none" />
    </Icoon>
  ),
  bottom: (
    <Icoon>
      <line x1="1" y1="14" x2="15" y2="14" />
      <rect x="3" y="6" width="3" height="8" fill="currentColor" stroke="none" />
      <rect x="9" y="3" width="3" height="11" fill="currentColor" stroke="none" />
    </Icoon>
  ),
  "distribute-h": (
    <Icoon>
      <line x1="1" y1="1" x2="1" y2="15" />
      <line x1="15" y1="1" x2="15" y2="15" />
      <rect x="4" y="4" width="3" height="8" fill="currentColor" stroke="none" />
      <rect x="9" y="4" width="3" height="8" fill="currentColor" stroke="none" />
    </Icoon>
  ),
  "distribute-v": (
    <Icoon>
      <line x1="1" y1="1" x2="15" y2="1" />
      <line x1="1" y1="15" x2="15" y2="15" />
      <rect x="4" y="4" width="8" height="3" fill="currentColor" stroke="none" />
      <rect x="4" y="9" width="8" height="3" fill="currentColor" stroke="none" />
    </Icoon>
  ),
  snap: (
    <Icoon>
      <path d="M1 5.5h14M1 10.5h14M5.5 1v14M10.5 1v14" />
    </Icoon>
  ),
};
