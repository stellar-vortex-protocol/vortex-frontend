import { NextResponse } from "next/server";
import { buildInfo } from "@/lib/buildInfo";

// Node runtime: process.uptime() is only meaningful on a long-lived server process.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Public build metadata and process uptime only. Never add env values, hostnames
// or dependency details here; this endpoint is unauthenticated.
//
// Dependency checks are aggregated so uptime monitors can distinguish a healthy
// process from a degraded one: any failing check yields a 503 while the JSON
// body keeps its existing shape and names the failing dependency.
type DependencyCheck = { name: string; check: () => boolean | Promise<boolean> };

const dependencyChecks: DependencyCheck[] = [];

export async function GET() {
  const failed: string[] = [];

  for (const dependency of dependencyChecks) {
    try {
      const healthy = await dependency.check();
      if (!healthy) failed.push(dependency.name);
    } catch {
      failed.push(dependency.name);
    }
  }

  const healthy = failed.length === 0;

  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      version: buildInfo.version,
      commit: buildInfo.commit,
      uptime: Math.floor(process.uptime()),
      ...(healthy ? {} : { failedDependencies: failed }),
    },
    {
      status: healthy ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
