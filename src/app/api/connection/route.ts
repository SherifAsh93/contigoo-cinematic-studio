import { connectionStatus } from "@/lib/comfy";
import { apiError } from "@/lib/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try { return Response.json(await connectionStatus()); }
  catch (error) { return apiError(error); }
}
