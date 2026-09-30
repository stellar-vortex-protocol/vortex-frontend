import type { Metadata } from "next";
import { fetcher } from "@/lib/api";
import { sanitizeDisplayText } from "@/lib/textSafety";
import type { IntentDetail } from "@/lib/types";

const SITE_URL =
  process.env["NEXT_PUBLIC_SITE_URL"]?.replace(/\/$/, "") ?? "http://localhost:3000";

async function fetchIntent(id: string): Promise<IntentDetail | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2000);

  try {
    const res = await fetch(`/api/intents/${id}`, {
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      next: { revalidate: 60 },
    });
    clearTimeout(timeoutId);

    if (!res.ok) return null;
    return (await res.json()) as IntentDetail;
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const intent = await fetchIntent(id);

  if (!intent) {
    return {
      title: "Intent Not Found | Vortex",
      description: "The requested intent could not be found or is unavailable.",
      robots: "noindex",
    };
  }

  // Sanitize user-facing strings
  const safeSolver = sanitizeDisplayText(intent.solver);
  const safeSrcToken = sanitizeDisplayText(intent.srcToken);
  const safeDstToken = sanitizeDisplayText(intent.dstToken);

  const srcAmt = intent.srcAmount;
  const dstAmt = intent.dstAmount;

  const title = `${srcAmt} ${safeSrcToken} → ${dstAmt} ${safeDstToken}`;
  const description = `${intent.srcChain} → Stellar via ${safeSolver} · ${intent.status}`;

  const canonicalUrl = `${SITE_URL}/explore/${id}`;
  const ogImageUrl = `${SITE_URL}/explore/${id}/opengraph-image`;

  return {
    title: { default: title, template: "%s | Vortex" },
    description,
    robots: "index, follow",
    openGraph: {
      title,
      description,
      type: "article",
      url: canonicalUrl,
      siteName: "Vortex",
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: `Vortex Intent: ${title}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImageUrl],
    },
    alternates: {
      canonical: canonicalUrl,
    },
  };
}

export default function IntentDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}