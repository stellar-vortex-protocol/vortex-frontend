import type { Metadata } from "next";
import { getGovernanceProposalById } from "@/lib/governanceStore";
import { sanitizeDisplayText } from "@/lib/textSafety";

const SITE_URL =
  process.env["NEXT_PUBLIC_SITE_URL"]?.replace(/\/$/, "") ?? "http://localhost:3000";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const proposal = getGovernanceProposalById(id);

  if (!proposal) {
    return {
      title: "Proposal Not Found | Vortex",
      description: "The requested governance proposal could not be found or is unavailable.",
      robots: "noindex",
    };
  }

  const safeTitle = sanitizeDisplayText(proposal.title);
  const safeDesc = sanitizeDisplayText(proposal.description);

  const totalVotes = proposal.votesFor + proposal.votesAgainst;
  const forPct = totalVotes > 0 ? Math.round((proposal.votesFor / totalVotes) * 100) : 0;

  const title = `${proposal.id}: ${safeTitle}`;
  const description = `${safeDesc} · ${proposal.votesFor.toLocaleString()} for / ${proposal.votesAgainst.toLocaleString()} against (${forPct}% for)`;

  const canonicalUrl = `${SITE_URL}/governance/${id}`;
  const ogImageUrl = `${SITE_URL}/governance/${id}/opengraph-image`;

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
          alt: `Vortex Governance: ${safeTitle}`,
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

export default function ProposalDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}