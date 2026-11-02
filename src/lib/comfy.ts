import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { models, getModel } from "./catalog";
import type { Asset, Connection, GenerationInput, Job } from "./contracts";
import { buildWorkflow, graphSchema, profileSchema, validateBindings, type Graph } from "./workflow";

export class ProviderError extends Error {
  constructor(message: string, public status = 503) { super(message); }
}

export function comfyUrl(route: string) {
  const base = process.env.COMFYUI_URL;
  if (!base) throw new ProviderError("Connect a ComfyUI server first. See workflows/README.md.");
  const url = new URL(base.endsWith("/") ? base : `${base}/`);
  if (!["http:", "https:"].includes(url.protocol)) throw new ProviderError("COMFYUI_URL must use HTTP or HTTPS.");
  return new URL(route.replace(/^\//, ""), url);
}

export async function comfyFetch(route: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (process.env.COMFYUI_API_KEY) headers.set("Authorization", `Bearer ${process.env.COMFYUI_API_KEY}`);
  try {
    return await fetch(comfyUrl(route), { ...init, headers, cache: "no-store", signal: AbortSignal.timeout(15000) });
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    throw new ProviderError("ComfyUI did not respond. Check the server address and GPU worker.");
  }
}

async function readProfiles() {
  const filename = path.resolve(/* turbopackIgnore: true */ process.env.STUDIO_WORKFLOWS || "workflows/profiles.json");
  try {
    const profiles = z.record(z.string(), profileSchema).parse(JSON.parse(await readFile(/* turbopackIgnore: true */ filename, "utf8")));
    return { profiles, directory: path.dirname(filename) };
  } catch {
    throw new ProviderError("Workflow profiles are missing or invalid. Check STUDIO_WORKFLOWS.");
  }
}

export async function loadWorkflow(modelId: string) {
  const { profiles, directory } = await readProfiles();
  const profile = profiles[modelId];
  if (!profile) throw new ProviderError("This model needs a configured ComfyUI workflow. See workflows/README.md.");
  const graph = graphSchema.parse(JSON.parse(await readFile(path.resolve(directory, profile.workflow), "utf8")));
  validateBindings(graph, profile, getModel(modelId)?.kind === "video", modelId);
  return { profile, graph };
}

// /object_info describes installed nodes and the model-file choices for their inputs.
type NodeInfo = Record<string, { input?: { required?: Record<string, unknown[]>; optional?: Record<string, unknown[]> } }>;
export function workflowIssue(graph: Graph, info: NodeInfo): string | undefined {
  for (const node of Object.values(graph)) {
    if (!info[node.class_type]) return `Missing ComfyUI node: ${node.class_type}`;
    const inputs = { ...info[node.class_type].input?.required, ...info[node.class_type].input?.optional };
    for (const [key, value] of Object.entries(node.inputs)) {
      const choices = inputs[key]?.[0];
      if (Array.isArray(choices) && typeof value === "string" && !choices.includes(value)) {
        return `Unavailable ${key}: ${value}`;
      }
    }
  }
}

export async function connectionStatus(): Promise<Connection> {
  let info: NodeInfo = {};
  let connected = false;
  let message = "Set COMFYUI_URL to connect your GPU worker.";
  if (process.env.COMFYUI_URL) {
    try {
      const response = await comfyFetch("object_info");
      if (!response.ok) throw new ProviderError(`ComfyUI returned HTTP ${response.status}.`);
      info = await response.json();
      connected = true;
      message = "ComfyUI connected. Workflow and model files are checked below.";
    } catch (error) { message = error instanceof Error ? error.message : "Connection failed."; }
  }
  const entries = await Promise.all(models.map(async model => {
    try {
      const { graph } = await loadWorkflow(model.id);
      const issue = connected ? workflowIssue(graph, info) : "Connect ComfyUI to validate this workflow.";
      return { id: model.id, configured: true, ready: connected && !issue, detail: issue || "Workflow nodes and model-file selections available. GPU execution still requires a successful generation." };
    } catch (error) {
      return { id: model.id, configured: false, ready: false, detail: error instanceof Error ? error.message : "Workflow unavailable." };
    }
  }));
  return { connected, configured: !!process.env.COMFYUI_URL, message, models: entries };
}

async function uploadImage(base64Data: string, filename: string): Promise<string> {
  const response = await comfyFetch("upload/image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: base64Data, filename, overwrite: true }),
  });
  if (!response.ok) throw new ProviderError(`Failed to upload image: ${response.status}`);
  const body = await response.json();
  return body.name as string;
}

export async function submitGeneration(input: GenerationInput) {
  const { profile, graph } = await loadWorkflow(input.modelId);
  const modelId = input.modelId;
  const isEditing = modelId === "flux-inpaint" || modelId === "flux-upscale";
  let builtGraph = buildWorkflow(graph, profile, input);
  if (isEditing) {
    if (input.init_image) {
      const uploadedName = await uploadImage(input.init_image, `init_${Date.now()}.png`);
      for (const node of Object.values(builtGraph)) {
        if (node.class_type === "LoadImage" && node.inputs.image === "input.png") {
          node.inputs.image = uploadedName;
        }
      }
    }
    if (modelId === "flux-inpaint" && input.mask) {
      const uploadedName = await uploadImage(input.mask, `mask_${Date.now()}.png`);
      for (const node of Object.values(builtGraph)) {
        if (node.class_type === "LoadImage" && node.inputs.image === "mask.png") {
          node.inputs.image = uploadedName;
        }
      }
    }
  }
  const response = await comfyFetch("prompt", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: builtGraph, client_id: "contigoo-studio" }),
  });
  if (!response.ok) throw new ProviderError(`ComfyUI rejected the workflow (HTTP ${response.status}). Check installed weights, nodes and worker logs.`, 502);
  const body = await response.json();
  if (typeof body.prompt_id !== "string") throw new ProviderError("ComfyUI did not return a job ID.", 502);
  return body.prompt_id as string;
}

type HistoryItem = {
  status?: { completed?: boolean; status_str?: string; messages?: [string, { exception_message?: string }][] };
  outputs?: Record<string, Record<string, { filename?: string; subfolder?: string; type?: string }[]>>;
};

export function historyResult(job: Job, item: HistoryItem, outputNodes: string[]): Job {
  if (item.status?.status_str === "error") {
    const error = item.status.messages?.find(([type]) => type === "execution_error")?.[1]?.exception_message;
    return { ...job, status: "failed", error: error?.slice(0, 500) || "The GPU worker could not complete this shot." };
  }
  if (!item.status?.completed) return job;
  const assets: Asset[] = [];
  for (const nodeId of outputNodes) {
    for (const files of Object.values(item.outputs?.[nodeId] || {})) {
      if (!Array.isArray(files)) continue;
      for (const file of files) {
        if (!file || file.type !== "output" || !file.filename) continue;
        const ext = path.extname(file.filename).toLowerCase();
        const kind = [".mp4", ".webm"].includes(ext) ? "video" : [".png", ".jpg", ".jpeg", ".webp"].includes(ext) ? "image" : undefined;
        if (!kind || kind !== getModel(job.input.modelId)?.kind) continue;
        if (!assets.some(asset => asset.filename === file.filename && asset.subfolder === (file.subfolder || ""))) {
          assets.push({ filename: file.filename, subfolder: file.subfolder || "", type: "output", kind });
        }
      }
    }
  }
  return assets.length ? { ...job, assets, status: "completed" } : { ...job, status: "failed", error: "The workflow completed without a supported saved output. Check outputNodes and your save node." };
}

export async function refreshJob(job: Job): Promise<Job> {
  if (job.status !== "queued" || !job.promptId) return job;
  const response = await comfyFetch(`history/${encodeURIComponent(job.promptId)}`);
  if (!response.ok) throw new ProviderError("Unable to read worker history.");
  const history = await response.json();
  const item = history[job.promptId] as HistoryItem | undefined;
  if (!item) return job;
  const { profile } = await loadWorkflow(job.input.modelId);
  return historyResult(job, item, profile.outputNodes);
}
