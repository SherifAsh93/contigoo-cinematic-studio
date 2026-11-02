export type MediaKind = "image" | "video";

export const models = [
  { id: "flux-schnell", name: "FLUX.1 Schnell", maker: "Black Forest Labs", kind: "image", tag: "Fast drafts", description: "A four-step image model for exploring compositions and visual directions.", license: "Apache-2.0", source: "https://huggingface.co/black-forest-labs/FLUX.1-schnell", hardware: "Memory depends on precision and offloading; benchmark on your GPU.", color: "peach" },
  { id: "flux-klein", name: "FLUX.2 Klein 4B", maker: "Black Forest Labs", kind: "image", tag: "Creative iteration", description: "Compact image generation. The 4B variant is Apache-2.0 licensed.", license: "Apache-2.0", source: "https://huggingface.co/black-forest-labs/FLUX.2-klein-4B", hardware: "Publisher reports approximately 13 GB VRAM; 8 GB requires a tested optimized workflow.", color: "lavender" },
  { id: "qwen-image", name: "Qwen-Image-2512", maker: "Qwen", kind: "image", tag: "Fine detail", description: "Detailed image generation with improvements in realism and text rendering.", license: "Apache-2.0", source: "https://huggingface.co/Qwen/Qwen-Image-2512", hardware: "Large model; validate full-pipeline memory, offloading and latency before deployment.", color: "mint" },
  { id: "wan-5b", name: "Wan 2.2 · 5B", maker: "Wan", kind: "video", tag: "Video essentials", description: "Text-to-video generation. The underlying model also supports image-to-video.", license: "Apache-2.0", source: "https://huggingface.co/Wan-AI/Wan2.2-TI2V-5B", hardware: "Official 720p offloaded example requires at least 24 GB VRAM.", color: "blue" },
  { id: "wan-14b", name: "Wan 2.2 · A14B", maker: "Wan", kind: "video", tag: "Quality candidate", description: "Mixture-of-experts text-to-video model for a higher-compute production workflow.", license: "Apache-2.0", source: "https://huggingface.co/Wan-AI/Wan2.2-T2V-A14B", hardware: "High-memory GPU deployment; benchmark your workflow before purchasing hardware.", color: "peach" },
  { id: "flux-inpaint", name: "FLUX Inpaint", maker: "Black Forest Labs", kind: "image", tag: "Edit & repair", description: "Inpaint and edit regions of an image using a mask. Upload an image, draw a mask, and describe the change.", license: "Apache-2.0", source: "https://huggingface.co/black-forest-labs/FLUX.1-schnell", hardware: "Same as FLUX Schnell; requires mask input.", color: "coral" },
  { id: "flux-upscale", name: "FLUX Upscale", maker: "Community", kind: "image", tag: "Enhance", description: "Upscale images 4x with AI detail enhancement. Upload any image to increase resolution.", license: "Various", source: "https://github.com/comfyanonymous/ComfyUI", hardware: "Lightweight; runs on most GPUs.", color: "emerald" },
] as const;

export type ModelId = typeof models[number]["id"];
export const getModel = (id: string) => models.find(model => model.id === id);

export const cameraMoves = {
  static: "Locked-off camera, stable framing",
  dolly: "Slow cinematic dolly forward toward the subject",
  orbit: "Smooth camera orbit around the subject",
  crane: "Slow crane up revealing the surrounding landscape",
  handheld: "Subtle organic handheld camera movement",
} as const;

export const looks = {
  natural: "Natural color, realistic light, restrained contrast",
  golden: "Warm golden-hour light, soft amber highlights, delicate film grain",
  noir: "Film noir, deep shadows, high contrast, muted colors",
  dream: "Dreamlike atmosphere, soft diffusion, pastel highlights",
} as const;

export const presets = [
  { id: "dunes", title: "Beyond the horizon", category: "Landscape", scene: "dunes", camera: "crane", look: "golden", prompt: "A lone traveler crosses vast sculpted desert dunes at sunset. Wind lifts fine sand from the ridges, distant mountains dissolve into atmospheric haze. Wide cinematic composition, realistic textures, quiet wonder." },
  { id: "nocturne", title: "After the rain", category: "Urban", scene: "city", camera: "dolly", look: "noir", prompt: "A rain-soaked city street at midnight, a lone figure under an umbrella, amber windows and teal reflections shimmering across the asphalt. Atmospheric cinematic composition with realistic wet surfaces." },
  { id: "alpine", title: "A world untouched", category: "Nature", scene: "mountains", camera: "crane", look: "natural", prompt: "Layers of alpine mountains emerge above a still glacial lake at dawn. Mist drifts between dark pine forests, delicate sunrise light touches the distant peaks. Expansive cinematic composition, natural realism." },
  { id: "orbital", title: "Somewhere, elsewhere", category: "Experimental", scene: "space", camera: "orbit", look: "dream", prompt: "A monumental ring-shaped space station floats above the luminous limb of a distant planet. A small spacecraft approaches, sunlight grazes brushed metal. Precise science-fiction production design, cinematic scale." },
] as const;
