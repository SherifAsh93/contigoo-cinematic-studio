import { NextResponse } from "next/server";
import { ProviderError } from "./comfy";

export function checkOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const requestOrigin = new URL(request.url).origin;
  // Allow same-origin, nip.io deployments, and localhost
  const allowedOrigins = [
    requestOrigin,
    "https://cinematic-studio.76.13.42.219.nip.io",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ];
  if (origin && !allowedOrigins.includes(origin)) {
    throw new ProviderError("Cross-origin writes are not allowed.", 403);
  }
}
export function apiError(error: unknown) {
  if (error instanceof ProviderError) return NextResponse.json({ error: error.message }, { status: error.status });
  console.error("Studio API error", error);
  return NextResponse.json({ error: "The studio could not complete this request. Check the application logs." }, { status: 500 });
}
