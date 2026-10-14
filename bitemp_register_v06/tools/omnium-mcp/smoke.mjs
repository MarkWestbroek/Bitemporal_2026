// smoke.mjs — de MCP-server end-to-end over stdio, zoals een AI-client hem gebruikt:
// initialize, tools/list en een paar tools/call. Vereist een draaiende Omnium-API en een token:
//   OMNIUM_URL=http://127.0.0.1:8093 OMNIUM_TOKEN=omt_… node smoke.mjs
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "node:url";

const server = fileURLToPath(new URL("./server.mjs", import.meta.url));
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [server],
  env: { ...process.env, OMNIUM_URL: process.env.OMNIUM_URL || "http://localhost:8082", OMNIUM_TOKEN: process.env.OMNIUM_TOKEN || "" },
});
const client = new Client({ name: "smoke", version: "0.0.1" });
await client.connect(transport);

const { tools } = await client.listTools();
console.log("tools:", tools.map((t) => t.name).join(", "));
const toon = (r) => r.content.map((c) => (c.type === "text" ? c.text : `[${c.type} ${c.mimeType}, ${c.data.length} tekens base64]`)).join("\n");
for (const [naam, args] of [["omnium_wie_ben_ik", {}], ["meldingen_lijst", {}], ["melding_bekijken", { id: Number(process.env.MELDING || 5) }], ["projecten_lijst", {}]]) {
  const r = await client.callTool({ name: naam, arguments: args });
  console.log(`\n── ${naam}${r.isError ? " (FOUT)" : ""}\n${toon(r)}`);
}
await client.close();
