// Test-only ComfyUI protocol fixture. No model inference occurs in this server.
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import graph from "../../workflows/flux-schnell.json";

let online = false;
const prompts = new Map<string, unknown>();
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=", "base64");
createServer(async (req, res) => {
  const url = new URL(req.url || "/", "http://127.0.0.1:8189");
  const json = (status: number, value: unknown) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(value)); };
  if (url.pathname === "/health") return json(200, { ok: true });
  if (url.pathname === "/test/online") { online = true; return json(200, { ok: true }); }
  if (url.pathname === "/test/offline") { online = false; return json(200, { ok: true }); }
  if (!online) return json(503, { error: "Test worker offline" });
  if (url.pathname === "/object_info") {
    const info = Object.fromEntries(Object.values(graph).map(node => [node.class_type, { input: { required: {} } }]));
    return json(200, info);
  }
  if (url.pathname === "/prompt" && req.method === "POST") {
    let text = "";
    for await (const chunk of req) text += chunk;
    const body = JSON.parse(text);
    if (!body.prompt?.["6"]?.inputs?.text) return json(400, { error: "Prompt binding is missing" });
    const id = randomUUID();
    prompts.set(id, body.prompt);
    return json(200, { prompt_id: id });
  }
  if (url.pathname.startsWith("/history/")) {
    const id = url.pathname.split("/").pop()!;
    return json(200, prompts.has(id) ? { [id]: { status: { completed: true, status_str: "success" }, outputs: { "9": { images: [{ filename: "fixture.png", type: "output", subfolder: "" }] } } } } : {});
  }
  if (url.pathname === "/view" && url.searchParams.get("filename") === "fixture.png") {
    res.writeHead(200, { "Content-Type": "image/png", "Content-Length": png.length });
    return res.end(png);
  }
  return json(404, { error: "Unknown fixture endpoint" });
}).listen(8189, "127.0.0.1");
