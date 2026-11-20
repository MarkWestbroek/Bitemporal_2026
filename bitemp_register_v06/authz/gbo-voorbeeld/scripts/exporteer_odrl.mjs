// HISTORISCH (19-11-2026). Dit script maakte beleid/gbo-persoon.odrl.json met de oude
// JSON-LD-export (web/vite/src/toegangsspraak/odrl.js, NLGov-termen). Die export bestaat niet
// meer: hij is opgegaan in de export naar ODRL-AP-NL (toegangsspraak/odrlExport.js), die een
// andere vorm en andere termen schrijft dan compiler.py en pdp_odre.py lezen.
//
// De keten van dit voorbeeld werkt op het vastgelegde bestand beleid/gbo-persoon.odrl.json.
// Zie de README ("Bevroren") voor wat een port naar ODRL-AP-NL vraagt.
console.error(
  "exporteer_odrl.mjs is historisch: de NLGov-export (odrl.js) bestaat niet meer.\n" +
    "beleid/gbo-persoon.odrl.json is bevroren; zie de README van gbo-voorbeeld.",
);
process.exit(1);
