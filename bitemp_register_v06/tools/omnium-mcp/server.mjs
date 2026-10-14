#!/usr/bin/env node
// server.mjs — MCP-server voor Omnium (AI-1, 14-10-2026; opzet zoals de MusicBrain-MCP).
//
// Een AI-client (Claude Code in VS Code, Claude Desktop, …) krijgt hiermee tools om Omnium te
// lezen en meldingen te behandelen, met de rechten van één gebruiker:
//   OMNIUM_URL    bv. https://app.omnium-ide.nl (standaard http://localhost:8082)
//   OMNIUM_TOKEN  persoonlijk API-token (Studio → Gebruikers → Mijn API-tokens)
// Transport: stdio. Registratie in Claude Code: .mcp.json in de root van de repo.
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { maakApi } from "./api.mjs";
import { TOOLS, voerUit } from "./tools.mjs";

const api = maakApi({ basis: process.env.OMNIUM_URL || "http://localhost:8082", token: process.env.OMNIUM_TOKEN || "" });

const server = new Server(
  { name: "omnium", version: "0.1.0" },
  {
    capabilities: { tools: {} },
    instructions:
      "Omnium is een modelgedreven werkbank met een bitemporeel register. Met deze tools lees je meldingen " +
      "(bugs, wensen, vragen, complimenten) met hun context en schermafbeeldingen, reageer je erop en zet je de " +
      "status (als beheerder), en zie je de Studio-projecten waar de gebruiker bij mag. Modellen: bekijk de talen " +
      "(modeltalen) en de map (project_bekijken), maak een plan, en laat model_wijzigen het eerst als voorstel " +
      "controleren; pas daarna toe (toepassen: true). Verwijs naar bestaande elementen met hun id.",
  },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => voerUit(api, req.params.name, req.params.arguments));

await server.connect(new StdioServerTransport());
