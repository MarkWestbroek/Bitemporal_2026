/**
 * typeIconen — icoon-registry per ElementType (plan §8.6a, het mechanisme).
 *
 * Een ElementType kan met `icoon` (string-id, Definitie-domein) naar een hier
 * geregistreerd icoon verwijzen; zonder `icoon` valt de keuze terug op de
 * ShapeType (class-box → doosje, bol → cirkel, note → memo, boundary →
 * kader, connector → lijn). Gebruikt in de Maken-/Verbinding-taakbalken en
 * de elementen-browser.
 *
 * De échte merk-iconenset blijft een ontwerp-sessie (plan §8.6a); dit levert
 * het koppelvlak plus neutrale 14px-vormen in currentColor, zodat nieuwe
 * iconen puur registraties zijn.
 */

const basis = (maat, kinderen) => (
  <svg
    width={maat}
    height={maat}
    viewBox="0 0 14 14"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ flexShrink: 0 }}
  >
    {kinderen}
  </svg>
);

const IcoonBox = ({ maat = 14 }) =>
  basis(maat, (
    <>
      <rect x="1.5" y="2" width="11" height="10" rx="1" />
      <line x1="1.5" y1="5.5" x2="12.5" y2="5.5" />
      <line x1="3.5" y1="8" x2="10.5" y2="8" />
    </>
  ));

const IcoonBol = ({ maat = 14 }) =>
  basis(maat, (
    <>
      <circle cx="7" cy="7" r="3.4" />
      <circle cx="7" cy="1.8" r="1.1" />
      <circle cx="2" cy="10" r="1.1" />
      <circle cx="12" cy="10" r="1.1" />
    </>
  ));

const IcoonNote = ({ maat = 14 }) =>
  basis(maat, (
    <>
      <path d="M 2 2 L 9.5 2 L 12 4.5 L 12 12 L 2 12 Z" />
      <path d="M 9.5 2 L 9.5 4.5 L 12 4.5" />
    </>
  ));

const IcoonKader = ({ maat = 14 }) =>
  basis(maat, <rect x="1.5" y="2" width="11" height="10" rx="1" strokeDasharray="2.4 1.8" />);

const IcoonPackage = ({ maat = 14 }) =>
  basis(maat, (
    <>
      <path d="M1.5 4.9V3.3a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1.6Z" fill="currentColor" stroke="none" />
      <rect x="1.5" y="4.9" width="11" height="7.1" rx="1" />
    </>
  ));

const IcoonRounded = ({ maat = 14 }) =>
  basis(maat, <rect x="1.5" y="3" width="11" height="8" rx="3.6" />);

const IcoonLijn = ({ maat = 14 }) =>
  basis(maat, (
    <>
      <path d="M 2 11.5 C 5.5 11.5 8.5 2.5 12 2.5" />
      <path d="M 9.4 2.2 L 12 2.5 L 11 4.8" />
    </>
  ));

const perShape = {
  "class-box": IcoonBox,
  bol: IcoonBol,
  note: IcoonNote,
  boundary: IcoonKader,
  rounded: IcoonRounded,
  package: IcoonPackage,
  edge: IcoonLijn,
};

const _registraties = new Map();

/** @param {string} id @param {Function} Component - ({maat}) => JSX */
export function registreerTypeIcoon(id, Component) {
  _registraties.set(id, Component);
}

/** Icoon voor een ElementType: expliciete `icoon`-id wint, anders de shape. */
export function TypeIcoon({ elementType, maat = 14 }) {
  const Component =
    (elementType?.icoon && _registraties.get(elementType.icoon)) ||
    (elementType?.isConnector ? IcoonLijn : perShape[elementType?.shape]) ||
    IcoonBox;
  return <Component maat={maat} />;
}
