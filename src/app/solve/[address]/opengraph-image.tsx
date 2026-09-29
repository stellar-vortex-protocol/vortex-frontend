/**
 * /solve/[address]/opengraph-image
 *
 * Dynamic OG image for solver detail pages.
 * Uses Next.js ImageResponse (Edge runtime) to generate a 1200×630 PNG.
 * Shows: solver name, success rate, fills, volume, bond.
 */

import { ImageResponse } from "next/og";
import { fetcher } from "@/lib/api";
import { sanitizeDisplayText } from "@/lib/textSafety";
import type { Solver } from "@/lib/types";
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
  truncateHash,
  formatAmount,
  getStatusColor,
  getStatusLabel,
} from "@/lib/ogImageHelpers";

export const runtime = "edge";
export const alt = "Vortex Solver — Profile & Metrics";
export const size = { width: OG_IMAGE_WIDTH, height: OG_IMAGE_HEIGHT };
export const contentType = "image/png";

export const revalidate = 60;

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

export default async function SolverOGImage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = await params;
  const solver = await fetchSolver(address);

  if (!solver) {
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
            <div style={{ fontSize: 64, marginBottom: SPACING.md }}>🛡️</div>
            <div style={{ fontSize: 32, fontWeight: 700, color: COLORS.textPrimary, marginBottom: SPACING.sm }}>
              Solver Not Found
            </div>
            <div style={{ fontSize: 20, color: COLORS.textSecondary, maxWidth: 600 }}>
              Solver <code style={{ fontFamily: FONTS.mono, background: COLORS.surface, padding: "4px 8px", borderRadius: RADIUS.sm }}>{truncateHash(address, 6, 6)}</code> could not be located.
            </div>
          </div>
        </OGLayout>
      ),
      { width: OG_IMAGE_WIDTH, height: OG_IMAGE_HEIGHT },
    );
  }

  const safeName = sanitizeDisplayText(solver.name);
  const statusColor = getStatusColor(solver.status, "solver");
  const statusLabel = getStatusLabel(solver.status, "solver");

  const usdFormatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  });

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
          <FlexRow justify="between" style={{ marginBottom: SPACING.xl }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: COLORS.textSecondary, marginBottom: 4 }}>
                Vortex Solver Network
              </div>
              <div style={{ fontSize: 15, fontFamily: FONTS.mono, color: COLORS.textMuted }}>
                {truncateHash(address, 8, 8)}
              </div>
            </div>
            <Badge color={statusColor} bgColor={`${statusColor}20`} borderColor={`${statusColor}40`}>
              {statusLabel}
            </Badge>
          </FlexRow>

          {/* Solver Name & Overview */}
          <Card style={{ marginBottom: SPACING.xl }}>
            <div
              style={{
                fontSize: 48,
                fontWeight: 800,
                color: COLORS.textPrimary,
                marginBottom: SPACING.xs,
              }}
            >
              {truncateTitle(safeName, 36)}
            </div>
            <div style={{ fontSize: 16, color: COLORS.textSecondary }}>
              Supported chains: {solver.chains.join(", ") || "Stellar"}
            </div>
          </Card>

          {/* Metrics Grid */}
          <Grid columns={3} gap={SPACING.md}>
            <KeyValueRow
              label="Successful Fills"
              value={solver.fills.toLocaleString()}
            />
            <KeyValueRow
              label="Success Rate"
              value={`${solver.successRatePct}%`}
              valueColor={COLORS.accentSage}
            />
            <KeyValueRow
              label="Total Volume"
              value={usdFormatter.format(solver.volumeUsd)}
            />
            <KeyValueRow
              label="Failed Fills"
              value={String(solver.failed)}
            />
            <KeyValueRow
              label="Avg Fill Time"
              value={`${solver.avgFillTimeSeconds}s`}
            />
            <KeyValueRow
              label="Bond Amount"
              value={usdFormatter.format(solver.bondUsd)}
            />
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
              Protected by solver bonds · Zero trust assumptions
            </div>
            <div style={{ fontSize: 13, color: COLORS.accentSage, fontWeight: 600 }}>
              vortexprotocol.io
            </div>
          </div>
        </div>
      </OGLayout>
    ),
    { width: OG_IMAGE_WIDTH, height: OG_IMAGE_HEIGHT },
  );
}