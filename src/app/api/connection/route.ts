import { getConnectionStatus } from "@/lib/provider";
import { apiError } from "@/lib/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try { return Response.json(await getConnectionStatus()); }
  catch (error) { return apiError(error); }
}