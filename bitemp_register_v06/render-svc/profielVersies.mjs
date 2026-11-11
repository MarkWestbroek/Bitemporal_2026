/**
 * profielVersies — bewaking van de versie per profiel (M2), zie
 * web/vite/src/diagramcore/types/profielVersie.js.
 *
 * profielVersies.vast.json legt per profiel de versie en de vingerafdruk van de structuur vast
 * (typen, eigenschappen, vakken, verbindingsregels; geen weergave). Verandert de structuur, dan
 * moet de versie van het profiel omhoog (`versie` in de descriptor): een project noteert die
 * versie, en een oudere Studio herkent er een nieuwer project aan.
 *
 *   npm run profielversies      vastleggen na een versieverhoging (weigert zonder verhoging)
 *   npm test                    faalt als vast.json niet klopt met de profielen
 *
 * Hier in render-svc omdat alleen deze bundel alle profielen in Node laadt (JSX als stub).
 */
import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const VAST = fileURLToPath(new URL("./profielVersies.vast.json", import.meta.url));

export function leesVast() {
  return fs.existsSync(VAST) ? JSON.parse(fs.readFileSync(VAST, "utf8")) : {};
}

const delen = (v) => String(v).split(".").map(Number);
const nieuwer = (a, b) => {
  const [x, y] = [delen(a), delen(b)];
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i];
  return false;
};

/**
 * @param {Record<string, {versie: string, vingerafdruk: string}>} nu - uit de bundel
 * @param {Record<string, {versie: string, vingerafdruk: string}>} vast
 * @returns {{fouten: string[], bijTeWerken: string[]}} fouten = versie moet eerst omhoog;
 *   bijTeWerken = alleen vast.json loopt achter
 */
export function vergelijk(nu, vast) {
  const fouten = [];
  const bijTeWerken = [];
  for (const [pid, n] of Object.entries(nu)) {
    const v = vast[pid];
    if (!v) bijTeWerken.push(`${pid}: nieuw profiel (${n.versie})`);
    else if (n.vingerafdruk !== v.vingerafdruk && !nieuwer(n.versie, v.versie)) {
      fouten.push(`${pid}: de structuur is veranderd, maar de versie is nog ${n.versie}. Verhoog 'versie' in de descriptor (regels: types/profielVersie.js).`);
    } else if (n.vingerafdruk !== v.vingerafdruk || n.versie !== v.versie) {
      if (nieuwer(v.versie, n.versie)) fouten.push(`${pid}: versie ${n.versie} is lager dan de vastgelegde ${v.versie}.`);
      else bijTeWerken.push(`${pid}: ${v.versie} → ${n.versie}`);
    }
  }
  for (const pid of Object.keys(vast)) if (!nu[pid]) bijTeWerken.push(`${pid}: profiel bestaat niet meer`);
  return { fouten, bijTeWerken };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { profielVersieOverzicht } = await import("./dist/studio-profielen.mjs");
  const nu = profielVersieOverzicht();
  const { fouten, bijTeWerken } = vergelijk(nu, leesVast());
  if (fouten.length) {
    console.error(fouten.join("\n"));
    process.exit(1);
  }
  if (process.argv.includes("--bijwerken")) {
    fs.writeFileSync(VAST, JSON.stringify(nu, null, 2) + "\n");
    console.log(bijTeWerken.length ? `profielVersies.vast.json bijgewerkt:\n${bijTeWerken.join("\n")}` : "profielVersies.vast.json was al bij.");
  } else {
    console.log(bijTeWerken.length ? `Bij te werken (npm run profielversies):\n${bijTeWerken.join("\n")}` : "profielVersies.vast.json klopt.");
  }
}
