import { NextResponse } from "next/server";
import { safeFetch } from "@/lib/server/safeFetch";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const alias = new URL(request.url).searchParams.get("address") ?? "";
  if (!/^[^\s*@]+\*[^\s*@]+$/.test(alias)) return NextResponse.json({ error: "invalid address" }, { status: 400 });
  const [name, domain] = alias.split("*");
  if (!name || !domain || domain.length > 253 || !/^[a-z0-9.-]+$/i.test(domain) || domain.endsWith(".") || domain === "localhost") {
    return NextResponse.json({ error: "invalid domain" }, { status: 400 });
  }
  try {
    // safeFetch validates every resolved address inside the socket's own lookup,
    // so there is no second DNS resolution between check and connect (no rebinding).
    const response = await safeFetch(`https://${domain}/federation?type=name&q=${encodeURIComponent(name)}`, {
      timeoutMs: 4000,
      maxRedirects: 0,
    });
    return NextResponse.json(JSON.parse(response.body));
  } catch (err) {
    if ((err as { code?: string }).code === "blocked-address" || (err as { code?: string }).code === "invalid-url") {
      return NextResponse.json({ error: "blocked domain" }, { status: 403 });
    }
    return NextResponse.json({ error: "federation unavailable" }, { status: 502 });
  }
}
