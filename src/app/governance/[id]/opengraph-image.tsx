/**
 * /governance/[id]/opengraph-image
 *
 * Dynamic OG image for governance proposal detail pages.
 * Uses Next.js ImageResponse (Edge runtime) to generate a 1200×630 PNG.
 * Shows: title, status, tally (votes for/against).
 */

import { ImageResponse } from "next/og";
import { getGovernanceProposalById } from "@/lib/governanceStore";
import { sanitizeDisplayText } from "@/lib/textSafety";
import {
  OG_IMAGE_WIDTH,
  OG_IMAGE_HEIGHT,
  COLORS,
  FONTS,
  SPACING,
  RADIUS,
  OGLayout,
  Card,
  Badge,
  KeyValueRow,
  FlexRow,
  Grid,
  truncateTitle,
  truncateDescription,
  getStatusColor,
  getStatusLabel,
} from "@/lib/ogImageHelpers";

export const runtime = "edge";
export const alt = "Vortex Governance Proposal";
export const size = { width: OG_IMAGE_WIDTH, height: OG_IMAGE_HEIGHT };
export const contentType = "image/png";

export const revalidate = 60;

export default async function ProposalOGImage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const proposal = getGovernanceProposalById(id);

  if (!proposal) {
    return new ImageResponse(
      (
        <OGLayout>
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: SPACING.xxl,
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 64, marginBottom: SPACING.md }}>🗳️</div>
            <div style={{ fontSize: 32, fontWeight: 700, color: COLORS.textPrimary, marginBottom: SPACING.sm }}>
              Proposal Not Found
            </div>
            <div style={{ fontSize: 20, color: COLORS.textSecondary, maxWidth: 600 }}>
              Governance proposal <code style={{ fontFamily: FONTS.mono, background: COLORS.surface, padding: "4px 8px", borderRadius: RADIUS.sm }}>{id}</code> could not be located.
            </div>
          </div>
        </OGLayout>
      ),
      { width: OG_IMAGE_WIDTH, height: OG_IMAGE_HEIGHT },
    );
  }

  const safeTitle = sanitizeDisplayText(proposal.title);
  const safeDesc = sanitizeDisplayText(proposal.description);
  const statusColor = getStatusColor(proposal.status, "proposal");
  const statusLabel = getStatusLabel(proposal.status, "proposal");

  const totalVotes = proposal.votesFor + proposal.votesAgainst;
  const forPct = totalVotes > 0 ? Math.round((proposal.votesFor / totalVotes) * 100) : 0;

  return new ImageResponse(
    (
      <OGLayout accentColor={statusColor}>
        <div
          style={{
            width: "100%",
            height: "100%",
            padding: SPACING.xxl,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          {/* Header */}
          <FlexRow justify="between" style={{ marginBottom: SPACING.lg }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: COLORS.textSecondary, marginBottom: 4 }}>
                Vortex Governance · {proposal.category}
              </div>
              <div style={{ fontSize: 16, fontFamily: FONTS.mono, fontWeight: 700, color: COLORS.accentSage }}>
                {proposal.id}
              </div>
            </div>
            <Badge color={statusColor} bgColor={`${statusColor}20`} borderColor={`${statusColor}40`}>
              {statusLabel}
            </Badge>
          </FlexRow>

          {/* Title & Description */}
          <Card style={{ marginBottom: SPACING.xl }}>
            <div
              style={{
                fontSize: 36,
                fontWeight: 800,
                color: COLORS.textPrimary,
                marginBottom: SPACING.sm,
                lineHeight: 1.2,
              }}
            >
              {truncateTitle(safeTitle, 55)}
            </div>
            <div style={{ fontSize: 15, color: COLORS.textSecondary, lineHeight: 1.4 }}>
              {truncateDescription(safeDesc, 130)}
            </div>
          </Card>

          {/* Votes Tally Grid */}
          <Grid columns={2} gap={SPACING.md}>
            <Card>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: SPACING.xs }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.textSecondary, textTransform: "uppercase" }}>Votes For</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.statusFilled }}>{forPct}%</div>
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: COLORS.textPrimary, fontFamily: FONTS.mono }}>
                {proposal.votesFor.toLocaleString()}
              </div>
            </Card>

            <Card>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: SPACING.xs }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.textSecondary, textTransform: "uppercase" }}>Votes Against</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.statusFailed }}>{100 - forPct}%</div>
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: COLORS.textPrimary, fontFamily: FONTS.mono }}>
                {proposal.votesAgainst.toLocaleString()}
              </div>
            </Card>
          </Grid>

          {/* Footer */}
          <div
            style={{
              marginTop: "auto",
              paddingTop: SPACING.xl,
              borderTop: `1px solid ${COLORS.border}`,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div style={{ fontSize: 13, color: COLORS.textMuted }}>
              Decentralized Protocol Governance
            </div>
            <div style={{ fontSize: 13, fontFamily: FONTS.mono, color: COLORS.textMuted }}>
              Proposer: {proposal.proposer.slice(0, 6)}…{proposal.proposer.slice(-4)}
            </div>
          </div>
        </div>
      </OGLayout>
    ),
    { width: OG_IMAGE_WIDTH, height: OG_IMAGE_HEIGHT },
  );
}