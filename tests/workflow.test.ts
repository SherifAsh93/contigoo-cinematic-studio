import assert from "node:assert/strict";
import { test } from "node:test";
import { buildWorkflow, type Graph, type Profile } from "../src/lib/workflow";
import { compilePrompt, generationSchema, type GenerationInput, type Job } from "../src/lib/contracts";
import { historyResult, workflowIssue } from "../src/lib/comfy";
import graph from "../workflows/flux-schnell.json";
import profiles from "../workflows/profiles.json";

const input: GenerationInput = { prompt: "A lighthouse at dawn", project: "Test film", modelId: "flux-schnell", aspect: "16:9", duration: 5, seed: 101, camera: "dolly", look: "golden", action: "generate" };
const profile = profiles["flux-schnell"];
const job: Job = { id: "unit-job", createdAt: new Date().toISOString(), status: "queued", input, compiledPrompt: compilePrompt(input), assets: [] };

test("generation validation rejects unknown models, invalid seeds and square video", () => {
  for (const patch of [{ modelId: "closed-model" }, { seed: -1 }, { prompt: " " }, { duration: 60 }, { modelId: "wan-5b", aspect: "1:1" }]) {
    assert.equal(generationSchema.safeParse({ ...input, ...patch }).success, false);
  }
  assert.equal(generationSchema.parse(input).seed, 101);
});

test("FLUX workflow receives prompt, dimensions and seed without mutating the template", () => {
  const result = buildWorkflow(graph, profile, input);
  assert.equal(result["3"].inputs.seed, 101);
  assert.equal(result["5"].inputs.width, 1344);
  assert.equal(result["6"].inputs.text, compilePrompt(input));
  assert.equal(graph["3"].inputs.seed, 42);
  assert.equal(compilePrompt(input).includes("dolly"), false, "camera motion must not leak into image prompts");
});

test("video workflow binds 4n+1 frames at 24 fps and includes camera direction", () => {
  const videoGraph: Graph = { "1": { class_type: "VideoTest", inputs: { prompt: "", seed: 0, width: 0, height: 0, frames: 0, fps: 0 } } };
  const videoProfile: Profile = { workflow: "test.json", outputNodes: ["1"], bindings: Object.fromEntries(["prompt", "seed", "width", "height", "frames", "fps"].map(key => [key, { node: "1", input: key }])) as Profile["bindings"] };
  const result = buildWorkflow(videoGraph, videoProfile, { ...input, modelId: "wan-5b", aspect: "9:16", duration: 3 });
  assert.equal(result["1"].inputs.frames, 73);
  assert.equal(result["1"].inputs.fps, 24);
  assert.equal(result["1"].inputs.width, 704);
  assert.equal(result["1"].inputs.height, 1280);
  assert.match(result["1"].inputs.prompt as string, /dolly/);
  delete videoProfile.bindings.fps;
  assert.throws(() => buildWorkflow(videoGraph, videoProfile, { ...input, modelId: "wan-5b" }), /both frames and fps/);
});

test("invalid bindings and missing installed nodes or weights are reported", () => {
  assert.throws(() => buildWorkflow(graph, { ...profile, bindings: { ...profile.bindings, seed: { node: "missing", input: "seed" } } }, input), /Invalid seed/);
  assert.match(workflowIssue(graph, {})!, /Missing ComfyUI node/);
  const info = Object.fromEntries(Object.values(graph).map(node => [node.class_type, {}]));
  assert.equal(workflowIssue(graph, info), undefined);
  assert.match(workflowIssue(graph, { ...info, UNETLoader: { input: { required: { unet_name: [["other.safetensors"]] } } } })!, /Unavailable unet_name/);
});

test("only saved compatible outputs from configured output nodes become assets", () => {
  const result = historyResult(job, { status: { completed: true }, outputs: {
    "9": { images: [{ filename: "result.png", type: "output", subfolder: "Contigoo" }, { filename: "temp.png", type: "temp" }, { filename: "unsafe.svg", type: "output" }] },
    "10": { images: [{ filename: "unrelated.png", type: "output" }] },
  } }, ["9"]);
  assert.equal(result.status, "completed");
  assert.deepEqual(result.assets, [{ filename: "result.png", subfolder: "Contigoo", type: "output", kind: "image" }]);
});

test("video outputs, worker failures, and completed-without-output have distinct handling", () => {
  const videoJob = { ...job, input: { ...input, modelId: "wan-5b" } };
  const video = historyResult(videoJob, { status: { completed: true }, outputs: { "9": { gifs: [{ filename: "movie.mp4", type: "output" }] } } }, ["9"]);
  assert.equal(video.assets[0].kind, "video");
  assert.equal(historyResult(job, { status: { completed: false } }, ["9"]), job);
  assert.equal(historyResult(job, { status: { completed: true } }, ["9"]).status, "failed");
  const failed = historyResult(job, { status: { status_str: "error", messages: [["execution_error", { exception_message: "GPU out of memory" }]] } }, ["9"]);
  assert.equal(failed.status, "failed");
  assert.equal(failed.error, "GPU out of memory");
});
