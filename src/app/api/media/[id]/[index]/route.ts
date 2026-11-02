import { findJob } from "@/lib/store";
import { comfyFetch, ProviderError } from "@/lib/comfy";
import { apiError } from "@/lib/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string; index: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const { id, index } = await context.params;
    const job = findJob(id);
    if (!job) return Response.json({ error: "Shot not found." }, { status: 404 });
    const assetIndex = parseInt(index, 10);
    if (isNaN(assetIndex) || assetIndex < 0 || assetIndex >= job.assets.length) {
      return Response.json({ error: "Asset not found." }, { status: 404 });
    }
    const asset = job.assets[assetIndex];
    const url = new URL("/view", process.env.COMFYUI_URL || "");
    url.searchParams.set("filename", asset.filename);
    if (asset.subfolder) url.searchParams.set("subfolder", asset.subfolder);
    url.searchParams.set("type", "output");
    const response = await comfyFetch(url.toString());
    if (!response.ok) {
      throw new ProviderError(`ComfyUI returned HTTP ${response.status}.`);
    }
    const contentType = response.headers.get("content-type") || (asset.kind === "video" ? "video/mp4" : "image/png");
    const disposition = new URL(_request.url).searchParams.get("download") === "1"
      ? `attachment; filename="${asset.filename}"`
      : `inline; filename="${asset.filename}"`;
    return new Response(response.body, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": disposition,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}