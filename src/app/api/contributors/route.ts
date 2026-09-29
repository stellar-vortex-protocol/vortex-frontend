import { NextResponse } from "next/server";
import { CONTRIBUTORS_REVALIDATE_SECONDS, getContributors } from "@/lib/contributors";

// Node runtime: the in-memory last-good cache in getContributors() is only
// meaningful on a long-lived server process.
export const runtime = "nodejs";
export const revalidate = 3600; // keep in sync with CONTRIBUTORS_REVALIDATE_SECONDS

export async function GET() {
  const data = await getContributors();
  return NextResponse.json(data, {
    headers: {
      "Cache-Control": `public, s-maxage=${CONTRIBUTORS_REVALIDATE_SECONDS}, stale-while-revalidate=86400, stale-if-error=86400`,
    },
  });
}
