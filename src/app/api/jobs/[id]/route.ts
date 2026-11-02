import { deleteJob, findJob, saveJob } from "@/lib/store";
import { refreshJob } from "@/lib/provider";
import { apiError, checkOrigin } from "@/lib/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, context: Context) {
  try {
    const job = findJob((await context.params).id);
    if (!job) return Response.json({ error: "Shot not found." }, { status: 404 });
    const refreshed = await refreshJob(job);
    if (refreshed !== job) saveJob(refreshed);
    return Response.json({ job: refreshed });
  } catch (error) { return apiError(error); }
}
export async function DELETE(request: Request, context: Context) {
  try {
    checkOrigin(request);
    const id = (await context.params).id;
    const job = findJob(id);
    if (!job) return Response.json({ error: "Shot not found." }, { status: 404 });
    if (["queued", "submitting"].includes(job.status)) return Response.json({ error: "An active shot cannot be removed." }, { status: 409 });
    deleteJob(id);
    return Response.json({ deleted: true });
  } catch (error) { return apiError(error); }
}