/**
 * profielRondreis — de stand van de rondreis descriptor → ontwerp-model → descriptor over alle
 * profielen (web/vite/src/studio/activities/profielRondreis.js), vastgelegd in
 * profielRondreis.vast.json.
 *
 * Het doel is een lege stand: dan kan een profiel volledig uit een model geladen worden (PROF-1,
 * het sidecar-project). Tot dan is dit bestand de werklijst, en de test bewaakt de richting:
 * een verschil dat erbij komt of vaker voorkomt is een fout (het ontwerp verliest meer dan
 * voorheen), een verschil dat verdwijnt of minder wordt vraagt alleen bijwerken.
 *
 *   npm run profielrondreis     vastleggen (weigert als het slechter is geworden; met
 *                               --slechter-mag leg je dat bewust vast, bv. bij een nieuw profiel)
 *   npm test                    faalt als vast.json niet klopt met de profielen
 *
 * Hier in render-svc omdat alleen deze bundel alle profielen in Node laadt.
 */
import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const VAST = fileURLToPath(new URL("./profielRondreis.vast.json", import.meta.url));

export function leesVast() {
  return fs.existsSync(VAST) ? JSON.parse(fs.readFileSync(VAST, "utf8")) : {};
}

/**
 * @param {Record<string, number>} nu
 * @param {Record<string, number>} vast
 * @returns {{slechter: string[], beter: string[]}}
 */
export function vergelijk(nu, vast) {
  const slechter = [];
  const beter = [];
  for (const [verschil, n] of Object.entries(nu)) {
    const was = vast[verschil] || 0;
    if (n > was) slechter.push(`${verschil}: ${was} → ${n}`);
    else if (n < was) beter.push(`${verschil}: ${was} → ${n}`);
  }
  for (const [verschil, was] of Object.entries(vast)) if (!(verschil in nu)) beter.push(`${verschil}: ${was} → 0`);
  return { slechter, beter };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { profielRondreisStand } = await import("./dist/studio-profielen.mjs");
  const nu = profielRondreisStand();
  const { slechter, beter } = vergelijk(nu, leesVast());
  const totaal = Object.values(nu).reduce((s, n) => s + n, 0);
  if (slechter.length && !process.argv.includes("--slechter-mag")) {
    console.error(`De rondreis verliest meer dan voorheen:\n${slechter.join("\n")}\nHerstel het ontwerp, of leg het bewust vast met --slechter-mag.`);
    process.exit(1);
  }
  if (process.argv.includes("--bijwerken")) {
    fs.writeFileSync(VAST, JSON.stringify(nu, null, 2) + "\n");
    console.log([...slechter.map((r) => `slechter  ${r}`), ...beter.map((r) => `beter     ${r}`)].join("\n") || "profielRondreis.vast.json was al bij.");
  }
  console.log(`Stand: ${Object.keys(nu).length} soorten verschil, ${totaal} in totaal.`);
}
