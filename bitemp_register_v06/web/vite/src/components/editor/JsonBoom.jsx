import { useState } from "react";

/**
 * JsonBoom — gekleurde, inklapbare JSON-weergave (alleen lezen), opgemaakt als
 * ingesprongen JSON. Kleuren in Common Ground-stijl (zie .cg-json-boom in
 * common-ground-theme.css): sleutels blauw, strings groen, getallen oranje,
 * booleans/null paars, leestekens grijs.
 *
 * Props: data (geparste JSON), openTot (diepte die bij het openen uitgeklapt is;
 * Infinity = alles). Wie alles wil openen of sluiten, geeft een andere `key`.
 */
export default function JsonBoom({ data, openTot = Infinity }) {
  return (
    <pre className="cg-json-boom">
      <code>
        <Knoop waarde={data} diepte={0} openTot={openTot} laatste />
      </code>
    </pre>
  );
}

const L = ({ children }) => <span className="cg-json-boom__leesteken">{children}</span>;

function Primitief({ waarde }) {
  if (waarde === null) return <span className="cg-json-boom__null">null</span>;
  if (typeof waarde === "boolean") return <span className="cg-json-boom__null">{String(waarde)}</span>;
  if (typeof waarde === "number") return <span className="cg-json-boom__getal">{String(waarde)}</span>;
  return <span className="cg-json-boom__string">{JSON.stringify(String(waarde))}</span>;
}

function Knoop({ sleutel, waarde, diepte, openTot, laatste }) {
  const isLijst = Array.isArray(waarde);
  const isObject = waarde !== null && typeof waarde === "object";
  const [open, setOpen] = useState(diepte < openTot);
  const inspring = "  ".repeat(diepte);
  const label = sleutel !== undefined ? (
    <>
      <span className="cg-json-boom__sleutel">{JSON.stringify(sleutel)}</span>
      <L>: </L>
    </>
  ) : null;
  const komma = laatste ? null : <L>,</L>;

  if (!isObject) {
    return (
      <div>
        {inspring}{label}<Primitief waarde={waarde} />{komma}
      </div>
    );
  }

  const items = isLijst ? waarde.map((w, i) => [i, w]) : Object.entries(waarde);
  const [opener, sluiter] = isLijst ? ["[", "]"] : ["{", "}"];
  if (!items.length) {
    return <div>{inspring}{label}<L>{opener}{sluiter}</L>{komma}</div>;
  }
  const knop = (
    <button type="button" className="cg-json-boom__knop" aria-expanded={open} onClick={() => setOpen(!open)}
      title={open ? "Inklappen" : "Uitklappen"}>{open ? "▾" : "▸"}</button>
  );
  if (!open) {
    return (
      <div>
        {inspring}{knop}{label}<L>{opener}</L>
        <button type="button" className="cg-json-boom__samenvatting" onClick={() => setOpen(true)}>
          … {items.length} {isLijst ? (items.length === 1 ? "item" : "items") : (items.length === 1 ? "sleutel" : "sleutels")}
        </button>
        <L>{sluiter}</L>{komma}
      </div>
    );
  }
  return (
    <div>
      <div>{inspring}{knop}{label}<L>{opener}</L></div>
      {items.map(([k, w], i) => (
        <Knoop key={k} sleutel={isLijst ? undefined : k} waarde={w} diepte={diepte + 1} openTot={openTot} laatste={i === items.length - 1} />
      ))}
      <div>{inspring}<L>{sluiter}</L>{komma}</div>
    </div>
  );
}
