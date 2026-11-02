import { NextResponse } from "next/server";
import { ProviderError } from "./comfy";

export function checkOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    throw new ProviderError("Cross-origin writes are not allowed.", 403);
  }
}
export function apiError(error: unknown) {
  if (error instanceof ProviderError) return NextResponse.json({ error: error.message }, { status: error.status });
  console.error("Studio API error", error);
  return NextResponse.json({ error: "The studio could not complete this request. Check the application logs." }, { status: 500 });
}
