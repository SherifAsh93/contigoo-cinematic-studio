import { z } from "zod";
import { cameraMoves, getModel, looks } from "./catalog";

const baseSchema = z.object({
  prompt: z.string().trim().min(1).max(4000),
  project: z.string().trim().min(1).max(100).default("Untitled film"),
  modelId: z.string().refine(id => !!getModel(id), "Unknown model."),
  seed: z.number().int().min(0).max(2147483647).default(42),
  action: z.enum(["draft", "generate"]).default("generate"),
  provider: z.enum(["comfyui", "replicate"]).optional(),
});

export const generationSchema = baseSchema.extend({
  aspect: z.enum(["16:9", "9:16", "1:1"]).default("16:9"),
  duration: z.union([z.literal(3), z.literal(5)]).default(5),
  camera: z.enum(["static", "dolly", "orbit", "crane", "handheld"]).default("static"),
  look: z.enum(["natural", "golden", "noir", "dream"]).default("natural"),
  init_image: z.string().optional(),
  mask: z.string().optional(),
}).superRefine((data, ctx) => {
  const model = getModel(data.modelId);
  if (model?.kind === "video" && data.aspect === "1:1") {
    ctx.addIssue({ code: "custom", path: ["aspect"], message: "Use landscape or portrait for the video workflow." });
  }
  if (model?.id === "flux-inpaint" && !data.mask) {
    ctx.addIssue({ code: "custom", path: ["mask"], message: "Inpaint requires a mask image." });
  }
  if (model?.id === "flux-upscale" && !data.init_image) {
    ctx.addIssue({ code: "custom", path: ["init_image"], message: "Upscale requires an input image." });
  }
});

export type GenerationInput = z.infer<typeof generationSchema>;
export type Asset = { filename: string; subfolder: string; type: "output"; kind: "image" | "video" };
export type Job = {
  id: string;
  createdAt: string;
  status: "draft" | "submitting" | "queued" | "completed" | "failed";
  input: GenerationInput;
  compiledPrompt: string;
  promptId?: string;
  assets: Asset[];
  error?: string;
  provider?: "comfyui" | "replicate";
};
export type Connection = {
  connected: boolean;
  configured: boolean;
  message: string;
  models: { id: string; configured: boolean; ready: boolean; detail: string }[];
};

export function compilePrompt(input: GenerationInput) {
  const model = getModel(input.modelId);
  if (model?.id === "flux-inpaint" || model?.id === "flux-upscale") {
    return input.prompt;
  }
  const image = model?.kind === "image";
  return [input.prompt, looks[input.look], ...(image ? [] : [cameraMoves[input.camera]])].join(". ");
}

export function dimensions(input: GenerationInput) {
  const model = getModel(input.modelId);
  if (model?.id === "flux-upscale") {
    return { width: 1024, height: 1024 };
  }
  if (model?.kind === "video") {
    return input.aspect === "9:16" ? { width: 704, height: 1280 } : { width: 1280, height: 704 };
  }
  return input.aspect === "16:9" ? { width: 1344, height: 768 } : input.aspect === "9:16" ? { width: 768, height: 1344 } : { width: 1024, height: 1024 };
}