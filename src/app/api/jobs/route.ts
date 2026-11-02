import { randomUUID } from "node:crypto";
import { generationSchema, compilePrompt, type Job } from "@/lib/contracts";
import { listJobs, saveJob } from "@/lib/store";
import { submitGeneration, ProviderError } from "@/lib/comfy";
import { checkOrigin, apiError } from "@/lib/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try { return Response.json({ jobs: listJobs() }); }
  catch (error) { return apiError(error); }
}
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const text = await request.text();
    if (text.length > 20000) throw new ProviderError("Request is too large.", 413);
    let body: unknown;
    try { body = JSON.parse(text); } catch { throw new ProviderError("Invalid JSON request.", 400); }
    const result = generationSchema.safeParse(body);
    if (!result.success) return Response.json({ error: result.error.issues[0].message }, { status: 400 });
    const input = result.data;
    const job: Job = { id: randomUUID(), createdAt: new Date().toISOString(), status: input.action === "draft" ? "draft" : "submitting", input, compiledPrompt: compilePrompt(input), assets: [] };
    saveJob(job);
    if (input.action === "generate") {
      try {
        job.promptId = await submitGeneration(input);
        job.status = "queued";
      } catch (error) {
        job.status = "failed";
        job.error = error instanceof Error ? error.message : "Submission failed.";
        saveJob(job);
        throw error;
      }
      saveJob(job);
    }
    return Response.json({ job }, { status: 201 });
  } catch (error) { return apiError(error); }
}
