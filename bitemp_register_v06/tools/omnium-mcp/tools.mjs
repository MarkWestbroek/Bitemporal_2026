// tools.mjs — de tools van de Omnium-MCP-server (AI-1, 14-10-2026). Zuiver: elke tool krijgt
// een `api` (zie api.mjs) en geeft MCP-inhoud terug; testbaar met een nep-api (tools.test.mjs).
//
// Alles loopt via de gewone Omnium-API met een persoonlijk token, dus met de rechten van die
// gebruiker: een melder ziet de eigen meldingen, een beheerder alle; projecten volgen
// "alles dicht tenzij".
//
// AI-1 stap 2 (14-10): modellen lezen en wijzigen (modeltalen, project_bekijken, model_wijzigen)
// met dezelfde regelset en toepasser als de ✨ assistent in de Studio — zie model.mjs.
import { profielen, zoekProject, leesProject, zoekMap, mapPad, boomTekst, wijzigModel, wijzigingTekst } from "./model.mjs";

const tekst = (t) => ({ content: [{ type: "text", text: t }] });
const fout = (t) => ({ content: [{ type: "text", text: t }], isError: true });

const STATUS = { nieuw: "nieuw", in_behandeling: "in behandeling", opgelost: "opgelost", afgewezen: "afgewezen", dubbel: "dubbel" };
const AFGEROND = new Set(["opgelost", "afgewezen", "dubbel"]);
const datum = (iso) => (iso ? String(iso).slice(0, 16).replace("T", " ") : "");

function meldingKort(m, metMelder) {
  return `#${m.id} [${m.soort}, ${STATUS[m.status] || m.status}${m.prioriteit ? `, ${m.prioriteit}` : ""}] ${m.titel}` +
    `${metMelder && m.melder ? ` — ${m.melder}` : ""} (${datum(m.gemeld_op)})` +
    `${m.reacties?.length ? ` · ${m.reacties.length} reactie(s)` : ""}${m.bijlagen?.length ? ` · ${m.bijlagen.length} bijlage(n)` : ""}`;
}

function meldingLang(m) {
  const r = [`# Melding #${m.id}: ${m.titel}`, `soort: ${m.soort} · status: ${STATUS[m.status] || m.status}` +
    `${m.prioriteit ? ` · prioriteit: ${m.prioriteit}` : ""}${m.melder ? ` · melder: ${m.melder}` : ""}` +
    `${m.behandelaar ? ` · behandelaar: ${m.behandelaar}` : ""} · gemeld: ${datum(m.gemeld_op)}`];
  if (m.beschrijving) r.push("", m.beschrijving);
  if (m.toelichting) r.push("", `Toelichting: ${m.toelichting}`);
  if (m.context && Object.keys(m.context).length) {
    r.push("", "Context:");
    for (const [k, v] of Object.entries(m.context)) r.push(`- ${k}: ${v}`);
  }
  if (m.reacties?.length) {
    r.push("", "Gesprek:");
    for (const x of m.reacties) r.push(`- ${x.auteur} (${datum(x.wanneer)}): ${x.tekst}`);
  }
  if (m.bijlagen?.length) r.push("", `Bijlagen: ${m.bijlagen.map((b) => b.omschrijving || b.bestand).join(", ")} (afbeeldingen staan hieronder)`);
  return r.join("\n");
}

/** De tools: naam, beschrijving, invoerschema, en de uitvoering. */
export const TOOLS = [
  {
    name: "omnium_wie_ben_ik",
    description: "Met welke Omnium-gebruiker en rol deze MCP-server werkt, en tegen welke instantie.",
    inputSchema: { type: "object", properties: {} },
    async run(api) {
      const me = await api.get("/api/auth/me");
      return tekst(`Ingelogd als ${me.gebruikersnaam} (rol ${me.rol}) op ${api.basis}.`);
    },
  },
  {
    name: "meldingen_lijst",
    description: "De meldingen (bugs, wensen, vragen, complimenten) uit Omnium. Een melder ziet de eigen meldingen, een beheerder alle. Standaard alleen de openstaande.",
    inputSchema: {
      type: "object",
      properties: { filter: { type: "string", enum: ["open", "alle"], description: "open (standaard) of alle" } },
    },
    async run(api, { filter = "open" } = {}) {
      const d = await api.get("/api/meldingen");
      const lijst = (d.meldingen || []).filter((m) => filter === "alle" || !AFGEROND.has(m.status));
      if (!lijst.length) return tekst(filter === "alle" ? "Geen meldingen." : "Geen openstaande meldingen.");
      return tekst(`${lijst.length} melding(en)${d.beheerder ? " (beheerder: alle meldingen)" : ""}:\n` + lijst.map((m) => meldingKort(m, d.beheerder)).join("\n"));
    },
  },
  {
    name: "melding_bekijken",
    description: "Eén melding met beschrijving, context (versie, browser, plek, pad in de projectboom), gesprek en de bijlagen als afbeelding.",
    inputSchema: { type: "object", properties: { id: { type: "integer", description: "nummer van de melding" } }, required: ["id"] },
    async run(api, { id }) {
      const m = await api.get(`/api/meldingen/${Number(id)}`);
      const inhoud = [{ type: "text", text: meldingLang(m) }];
      for (const b of m.bijlagen || []) {
        try {
          const { data, mimeType } = await api.bestand(`/api/meldingen/bestanden/${encodeURIComponent(b.bestand)}`);
          if (mimeType.startsWith("image/")) inhoud.push({ type: "image", data, mimeType });
          else inhoud.push({ type: "text", text: `(bijlage ${b.bestand}: ${mimeType}, niet als afbeelding)` });
        } catch (e) {
          inhoud.push({ type: "text", text: `(bijlage ${b.bestand} niet op te halen: ${e.message})` });
        }
      }
      return { content: inhoud };
    },
  },
  {
    name: "melding_reageren",
    description: "Een reactie in het gesprek bij een melding plaatsen (als de ingelogde gebruiker).",
    inputSchema: {
      type: "object",
      properties: { id: { type: "integer" }, tekst: { type: "string", description: "de reactie" } },
      required: ["id", "tekst"],
    },
    async run(api, { id, tekst: t }) {
      if (!String(t || "").trim()) return fout("Geef een reactie.");
      await api.post(`/api/meldingen/${Number(id)}/reacties`, { tekst: String(t).trim() });
      return tekst(`Reactie geplaatst bij melding #${id}.`);
    },
  },
  {
    name: "melding_behandelen",
    description: "Status, toelichting, prioriteit of behandelaar van een melding zetten (alleen een beheerder).",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "integer" },
        status: { type: "string", enum: ["nieuw", "in_behandeling", "opgelost", "afgewezen", "dubbel"] },
        toelichting: { type: "string", description: "uitleg voor de melder, bv. 'opgelost in 0.20.2'" },
        prioriteit: { type: "string", enum: ["laag", "normaal", "hoog"] },
        behandelaar: { type: "string", description: "gebruikersnaam" },
      },
      required: ["id"],
    },
    async run(api, { id, ...w }) {
      const body = Object.fromEntries(Object.entries(w).filter(([, v]) => v !== undefined && v !== ""));
      if (!Object.keys(body).length) return fout("Geef minstens status, prioriteit of behandelaar.");
      await api.put(`/api/meldingen/${Number(id)}/behandeling`, body);
      return tekst(`Melding #${id} bijgewerkt: ${Object.entries(body).map(([k, v]) => `${k}=${v}`).join(", ")}.`);
    },
  },
  {
    name: "projecten_lijst",
    description: "De Studio-projecten op de server waar de gebruiker bij mag, met het recht (lezen, schrijven, beheren).",
    inputSchema: { type: "object", properties: {} },
    async run(api) {
      const lijst = await api.get("/api/studio/projecten");
      if (!lijst?.length) return tekst("Geen projecten (of geen toegang).");
      return tekst(lijst.map((p) => `${p.naam} — id ${p.id} · ${p.recht || "?"} · eigenaar ${p.eigenaar || "—"} · v${p.versie} · bijgewerkt ${datum(p.bijgewerkt)}`).join("\n"));
    },
  },
  {
    name: "modeltalen",
    description:
      "De modelleertalen (M2-profielen) van Omnium: zonder `taal` een lijst; met `taal` (id) de element- en relatietypen, " +
      "de verbindingsregels (bron → doel), eigenschappen en modelleeraanwijzingen. Lees dit vóór je een plan maakt voor model_wijzigen.",
    inputSchema: { type: "object", properties: { taal: { type: "string", description: "profiel-id, bv. usecase05 of activity05" } } },
    async run(_api, { taal } = {}) {
      const lijst = profielen();
      if (!taal) return tekst(lijst.map((p) => `${p.id} — ${p.naam} (${p.elementen.length} elementtypen, ${p.connectoren.length} relatietypen)`).join("\n"));
      const p = lijst.find((x) => x.id === taal || x.naam.toLowerCase() === String(taal).toLowerCase());
      if (!p) return fout(`Onbekende taal ${taal}; zie modeltalen zonder argument.`);
      const r = [`# ${p.naam} (${p.id})`, "Elementtypen:"];
      for (const e of p.elementen) r.push(`- ${e.id}: ${e.label}${e.omschrijving ? ` — ${e.omschrijving}` : ""}${e.container ? ` (container; leden via \`in\`: ${(e.leden || []).join(", ")})` : ""}${e.uitwerking ? " (kan een uitwerking dragen: diagrammen eronder via map)" : ""}${e.eigenschappen ? ` [eigenschappen: ${e.eigenschappen.join(", ")}]` : ""}`);
      r.push("Relaties (bron → doel):");
      for (const c of p.connectoren) r.push(`- ${c.id}: ${c.label} — ${(p.paren?.[c.id] || c.regels.map((x) => [x.bron.join("|"), x.doel.join("|")])).map(([b, d]) => `${b} → ${d}`).join("; ")}${c.eigenschappen ? ` [eigenschappen: ${c.eigenschappen.join(", ")}]` : ""}`);
      if (p.aanwijzingen?.length) r.push("Aanwijzingen:", ...p.aanwijzingen.map((a) => `- ${a}`));
      return tekst(r.join("\n"));
    },
  },
  {
    name: "project_bekijken",
    description:
      "Een Studio-project: zonder `map` de boom (mappen met hun diagrammen per taal); met `map` (pad zoals Test/Uitwerking, of \"/\" " +
      "voor de hoofdmap) wat erin staat: diagrammen, elementen en relaties mét hun ids (voor verwijzingen in model_wijzigen).",
    inputSchema: {
      type: "object",
      properties: { project: { type: "string", description: "naam of id (zie projecten_lijst)" }, map: { type: "string" } },
      required: ["project"],
    },
    async run(api, { project, map }) {
      const p = await zoekProject(api, project);
      const proj = await leesProject(api, p.id);
      if (map === undefined) return tekst(`# ${p.naam} (${p.recht || "?"})\n${boomTekst(proj)}`);
      const { bestaandInMap, bestaandTekst } = await import("../../web/vite/src/studio/assistent/assistentKern.js");
      const doel = zoekMap(proj.mappen, map);
      const inhoud = bestaandTekst(bestaandInMap(proj, doel?.id || null, profielen().map((x) => x.id)), { max: 500 });
      const sub = Object.values(proj.mappen).filter((m) => (m.ouderId || null) === (doel?.id || null)).map((m) => m.naam);
      return tekst(`# ${p.naam} / ${doel ? mapPad(proj, doel.id) : "(hoofdmap)"}${sub.length ? `\nsubmappen: ${sub.join(", ")}` : ""}\n${inhoud || "(leeg)"}`);
    },
  },
  {
    name: "model_wijzigen",
    description:
      "Maak of wijzig modellen in een map van een Studio-project met een plan (JSON), gecontroleerd tegen de modeltalen. " +
      "Standaard alleen een voorstel; met toepassen: true gaat het als projectsync-operaties naar de server en zien open Studio's het live. " +
      "Plan: {uitleg, diagrammen: [{sleutel, taal, naam, map?} | {sleutel, bestaand: <diagram-id>}], " +
      "elementen: [{sleutel, type, naam, diagram: <sleutel>, in?: <container>, eigenschappen?, velden?} | {bestaand: <element-id>, naam?, diagram?, velden?: [{naam, type?}]}] (velden = attributen of enumeratiewaarden), " +
      "connectoren: [{type, bron, doel, naam?, eigenschappen?}] (bron/doel = sleutel van een nieuw element of id van een bestaand), " +
      "verbanden: [{van, naar, soort: komt voort uit|heeft te maken met|genereert|realiseert}] (tussen talen), " +
      "opstelling: [{diagram, actie: naast-elkaar|boven-elkaar|verdeel-horizontaal|verdeel-verticaal|links|rechts|boven|onder|automatisch, elementen?}], " +
      "verwijderen: [<id van een bestaand element of relatie>] (weg uit het model en van alle diagrammen)}. " +
      "`map` op een diagram = (nieuwe) submap van de doelmap, of de naam/het id van een element dat een uitwerking kan dragen (bv. een use case; zie modeltalen): dan hangt het diagram daaronder. Kijk eerst met modeltalen en project_bekijken.",
    inputSchema: {
      type: "object",
      properties: {
        project: { type: "string" },
        map: { type: "string", description: "pad van de doelmap, \"/\" of leeg = hoofdmap" },
        plan: { type: "object", description: "het plan, zie de beschrijving" },
        toepassen: { type: "boolean", description: "false (standaard): alleen voorstel; true: doorvoeren" },
      },
      required: ["project", "plan"],
    },
    async run(api, { project, map, plan, toepassen = false }) {
      const uit = await wijzigModel(api, { project, map, plan: typeof plan === "string" ? JSON.parse(plan) : plan, toepassen });
      return tekst(wijzigingTekst(uit, toepassen));
    },
  },
];

/** Voer een tool uit; fouten van de API worden een nette foutmelding voor het model. */
export async function voerUit(api, naam, args) {
  const tool = TOOLS.find((t) => t.name === naam);
  if (!tool) return fout(`Onbekende tool ${naam}.`);
  try {
    return await tool.run(api, args || {});
  } catch (e) {
    return fout(`${naam} mislukt: ${e.message}`);
  }
}
