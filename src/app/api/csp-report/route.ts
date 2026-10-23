import { secureLogger } from "@/lib/secureLogging";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 8 * 1024;
const FIELD_MAX = 200;

/** Drop query string / fragment (may carry sensitive data) and cap length. */
function redact(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  return value.split(/[?#]/)[0]!.slice(0, FIELD_MAX);
}

function pick(report: unknown) {
  if (typeof report !== "object" || report === null) return null;
  const r = report as Record<string, unknown>;
  // Reporting API wraps the report as { type: "csp-violation", body: {...} }.
  const body = (typeof r.body === "object" && r.body !== null ? r.body : r) as Record<string, unknown>;
  return {
    violatedDirective: redact(body["violated-directive"] ?? body.violatedDirective ?? body.effectiveDirective),
    blockedUri: redact(body["blocked-uri"] ?? body.blockedURL),
    documentUri: redact(body["document-uri"] ?? body.documentURL),
  };
}

/** POST /api/csp-report — collects CSP violation reports. Always answers 204. */
export async function POST(request: Request) {
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) return new Response(null, { status: 204 });
    const parsed: unknown = JSON.parse(text);
    const wrapped = (parsed as Record<string, unknown> | null)?.["csp-report"];
    // Legacy: { "csp-report": {...} }; Reporting API: array of reports.
    const reports = Array.isArray(parsed) ? parsed : [wrapped ?? parsed];
    for (const report of reports.slice(0, 10)) {
      const fields = pick(report);
      if (fields) secureLogger.warn("CSP violation", fields);
    }
  } catch {
    // Untrusted browser input: ignore anything malformed.
  }
  return new Response(null, { status: 204 });
}
