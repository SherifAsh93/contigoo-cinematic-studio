import { z } from "zod";
import { compilePrompt, dimensions, type GenerationInput } from "./contracts";
import { getModel } from "./catalog";

export const graphSchema = z.record(z.string(), z.object({
  class_type: z.string(),
  inputs: z.record(z.string(), z.unknown()),
  _meta: z.unknown().optional(),
}));
export type Graph = z.infer<typeof graphSchema>;
const bindingSchema = z.object({ node: z.string(), input: z.string() });
export const profileSchema = z.object({
  workflow: z.string(),
  bindings: z.object({
    prompt: bindingSchema.optional(),
    seed: bindingSchema.optional(),
    width: bindingSchema.optional(),
    height: bindingSchema.optional(),
    frames: bindingSchema.optional(),
    fps: bindingSchema.optional(),
    init_image: bindingSchema.optional(),
    mask: bindingSchema.optional(),
  }),
  outputNodes: z.array(z.string()).min(1),
});
export type Profile = z.infer<typeof profileSchema>;

export function validateBindings(graph: Graph, profile: Profile, video: boolean, modelId: string) {
  for (const [key, binding] of Object.entries(profile.bindings)) {
    if (binding && (!graph[binding.node] || !(binding.input in graph[binding.node].inputs))) {
      throw new Error(`Invalid ${key} binding in workflow profile.`);
    }
  }
  for (const node of profile.outputNodes) {
    if (!graph[node]) throw new Error(`Output node ${node} is missing.`);
  }
  if (video && (!profile.bindings.frames || !profile.bindings.fps)) {
    throw new Error("Video workflows must bind both frames and fps.");
  }
  if (modelId === "flux-inpaint" && (!profile.bindings.init_image || !profile.bindings.mask)) {
    throw new Error("Inpaint workflow requires init_image and mask bindings.");
  }
  if (modelId === "flux-upscale" && !profile.bindings.init_image) {
    throw new Error("Upscale workflow requires init_image binding.");
  }
}

export function buildWorkflow(source: Graph, profile: Profile, input: GenerationInput): Graph {
  const modelId = input.modelId;
  const video = getModel(modelId)?.kind === "video";
  validateBindings(source, profile, video, modelId);
  const graph = structuredClone(source);
  const isEditing = modelId === "flux-inpaint" || modelId === "flux-upscale";
  const values: Record<string, unknown> = isEditing
    ? { prompt: compilePrompt(input), seed: input.seed, init_image: input.init_image, mask: input.mask }
    : { prompt: compilePrompt(input), seed: input.seed, ...dimensions(input), frames: input.duration * 24 + 1, fps: 24 };
  for (const [key, binding] of Object.entries(profile.bindings)) {
    if (binding && values[key] !== undefined) {
      graph[binding.node].inputs[binding.input] = values[key];
    }
  }
  return graph;
}