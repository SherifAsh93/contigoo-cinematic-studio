import { type GenerationInput, type Job } from "./contracts";
import { getModel } from "./catalog";
import { submitGeneration as comfySubmit, refreshJob as comfyRefresh, connectionStatus as comfyConnectionStatus } from "./comfy";
import { replicateGenerate, replicateGetPrediction, replicateCancelPrediction } from "./replicate";

export type Provider = "comfyui" | "replicate";

function getProvider(input: GenerationInput): Provider {
  return input.provider || (process.env.REPLICATE_API_TOKEN ? "replicate" : "comfyui");
}

export async function submitGeneration(input: GenerationInput): Promise<{ promptId: string; provider: Provider }> {
  const provider = getProvider(input);
  if (provider === "replicate") {
    const { predictionId } = await replicateGenerate(input);
    return { promptId: predictionId, provider };
  } else {
    const promptId = await comfySubmit(input);
    return { promptId, provider };
  }
}

export async function refreshJob(job: Job): Promise<Job> {
  if (job.status !== "queued" || !job.promptId) return job;
  
  const provider = job.provider || "comfyui";
  
  if (provider === "replicate") {
    const { status, output, error } = await replicateGetPrediction(job.promptId);
    
    if (status === "failed" || status === "canceled") {
      return { ...job, status: "failed", error: error || "Generation failed" };
    }
    
    if (status !== "succeeded" || !output) {
      return job;
    }
    
    const outputs = Array.isArray(output) ? output : [output];
    const modelKind = getModel(job.input.modelId)?.kind || "image";
    const assets = outputs.map((url, i) => ({
      filename: `${job.promptId}_${i}.${modelKind === "video" ? "mp4" : "png"}`,
      subfolder: "",
      type: "output" as const,
      kind: modelKind,
      url,
    }));
    
    return { ...job, status: "completed", assets };
  } else {
    return comfyRefresh(job);
  }
}

export async function cancelJob(job: Job): Promise<void> {
  if (!job.promptId) return;
  
  const provider = job.provider || "comfyui";
  
  if (provider === "replicate") {
    await replicateCancelPrediction(job.promptId);
  }
}

export async function getConnectionStatus() {
  const hasReplicate = !!process.env.REPLICATE_API_TOKEN;
  const hasComfyUI = !!process.env.COMFYUI_URL;
  
  if (hasReplicate) {
    return {
      connected: true,
      configured: true,
      message: "Replicate API connected. Cloud generation available.",
      models: [
        { id: "flux-schnell", configured: true, ready: true, detail: "Available via Replicate" },
        { id: "flux-klein", configured: true, ready: true, detail: "Available via Replicate" },
        { id: "qwen-image", configured: true, ready: true, detail: "Available via Replicate" },
        { id: "wan-5b", configured: true, ready: true, detail: "Available via Replicate" },
        { id: "wan-14b", configured: true, ready: true, detail: "Available via Replicate" },
        { id: "flux-inpaint", configured: true, ready: true, detail: "Available via Replicate" },
        { id: "flux-upscale", configured: true, ready: true, detail: "Available via Replicate" },
      ],
    };
  }
  
  if (hasComfyUI) {
    return comfyConnectionStatus();
  }
  
  return {
    connected: false,
    configured: false,
    message: "Set REPLICATE_API_TOKEN for cloud generation or COMFYUI_URL for local GPU.",
    models: [],
  };
}