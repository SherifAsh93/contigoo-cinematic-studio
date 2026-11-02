import { getModel, type ModelId } from "./catalog";
import { compilePrompt, dimensions, type GenerationInput } from "./contracts";

const REPLICATE_API_URL = "https://api.replicate.com/v1";

interface ReplicatePrediction {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  output?: string | string[];
  error?: string;
  urls: { get: string; cancel: string };
  created_at: string;
  started_at?: string;
  completed_at?: string;
  metrics?: { predict_time: number };
}

interface ReplicateModel {
  owner: string;
  name: string;
  version: string;
  inputSchema: Record<string, unknown>;
}

const MODEL_MAP: Record<string, { owner: string; name: string; version: string }> = {
  "flux-schnell": { owner: "black-forest-labs", name: "flux-schnell", version: "latest" },
  "flux-klein": { owner: "black-forest-labs", name: "flux-klein", version: "latest" },
  "qwen-image": { owner: "qwen", name: "qwen-image", version: "latest" },
  "wan-5b": { owner: "wan-video", name: "wan-2.2-5b", version: "latest" },
  "wan-14b": { owner: "wan-video", name: "wan-2.2-14b", version: "latest" },
  "flux-inpaint": { owner: "black-forest-labs", name: "flux-inpaint", version: "latest" },
  "flux-upscale": { owner: "nightmareai", name: "real-esrgan", version: "latest" },
};

function getReplicateModel(modelId: string) {
  return MODEL_MAP[modelId];
}

export async function replicateGenerate(input: GenerationInput): Promise<{ predictionId: string; outputUrl?: string }> {
  const apiKey = process.env.REPLICATE_API_TOKEN;
  if (!apiKey) throw new Error("REPLICATE_API_TOKEN not set");

  const modelInfo = getReplicateModel(input.modelId);
  if (!modelInfo) throw new Error(`No Replicate model mapping for ${input.modelId}`);

  const model = getModel(input.modelId);
  const isVideo = model?.kind === "video";
  const isEditing = input.modelId === "flux-inpaint" || input.modelId === "flux-upscale";
  const { width, height } = dimensions(input);

  let replicateInput: Record<string, unknown> = {
    prompt: compilePrompt(input),
    width,
    height,
    seed: input.seed,
  };

  if (isVideo) {
    replicateInput = {
      ...replicateInput,
      num_frames: input.duration * 24 + 1,
      fps: 24,
    };
  }

  if (input.modelId === "flux-inpaint") {
    if (!input.init_image || !input.mask) throw new Error("Inpaint requires init_image and mask");
    replicateInput = {
      ...replicateInput,
      image: input.init_image,
      mask: input.mask,
      strength: 0.8,
    };
  }

  if (input.modelId === "flux-upscale") {
    if (!input.init_image) throw new Error("Upscale requires init_image");
    replicateInput = {
      image: input.init_image,
      scale: 4,
      face_enhance: false,
    };
  }

  const body: Record<string, unknown> = {
      version: modelInfo.version,
      input: replicateInput,
    };
    if (process.env.REPLICATE_WEBHOOK_URL) {
      body.webhook = process.env.REPLICATE_WEBHOOK_URL;
      body.webhook_events_filter = ["start", "output", "logs", "completed"];
    }

    const response = await fetch(`${REPLICATE_API_URL}/predictions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Prefer": "respond-async",
      },
      body: JSON.stringify(body),
    });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Replicate API error: ${error.detail || response.statusText}`);
  }

  const prediction = await response.json() as ReplicatePrediction;
  return { predictionId: prediction.id };
}

export async function replicateGetPrediction(predictionId: string): Promise<{ status: string; output?: string | string[]; error?: string }> {
  const apiKey = process.env.REPLICATE_API_TOKEN;
  if (!apiKey) throw new Error("REPLICATE_API_TOKEN not set");

  const response = await fetch(`${REPLICATE_API_URL}/predictions/${predictionId}`, {
    headers: { "Authorization": `Bearer ${apiKey}` },
  });

  if (!response.ok) throw new Error("Failed to get prediction status");

  const prediction = await response.json() as ReplicatePrediction;
  return {
    status: prediction.status,
    output: prediction.output,
    error: prediction.error,
  };
}

export async function replicateCancelPrediction(predictionId: string): Promise<void> {
  const apiKey = process.env.REPLICATE_API_TOKEN;
  if (!apiKey) throw new Error("REPLICATE_API_TOKEN not set");

  await fetch(`${REPLICATE_API_URL}/predictions/${predictionId}/cancel`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}` },
  });
}