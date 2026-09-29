import type { Metadata } from "next";
import { fetcher } from "@/lib/api";
import { sanitizeDisplayText } from "@/lib/textSafety";
import type { Solver } from "@/lib/types";

const SITE_URL =
  process.env["NEXT_PUBLIC_SITE_URL"]?.replace(/\/$/, "") ?? "http://localhost:3000";

async function fetchSolver(address: string): Promise<Solver | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2000);

  try {
    const res = await fetch(`/api/solvers/${address}`, {
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      next: { revalidate: 60 },
    });
    clearTimeout(timeoutId);

    if (!res.ok) return null;
    return (await res.json()) as Solver;
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ address: string }>;
}): Promise<Metadata> {
  const { address } = await params;
  const solver = await fetchSolver(address);

  if (!solver) {
    return {
      title: "Solver Not Found | Vortex",
      description: "The requested solver could not be found or is unavailable.",
      robots: "noindex",
    };
  }

  const safeName = sanitizeDisplayText(solver.name);
  const title = safeName;
  const description = `${solver.fills} fills · ${solver.successRatePct}% success · ${(solver.volumeUsd / 1_000_000).toFixed(1)}M volume`;

  const canonicalUrl = `${SITE_URL}/solve/${address}`;
  const ogImageUrl = `${SITE_URL}/solve/${address}/opengraph-image`;

  return {
    title: { default: title, template: "%s | Vortex" },
    description,
    robots: "index, follow",
    openGraph: {
      title,
      description,
      type: "profile",
      url: canonicalUrl,
      siteName: "Vortex",
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: `Vortex Solver: ${safeName}`,
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

export default function SolverDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}