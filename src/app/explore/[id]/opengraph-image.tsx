/**
 * /explore/[id]/opengraph-image
 *
 * Dynamic OG image for intent detail pages.
 * Uses Next.js ImageResponse (Edge runtime) to generate a 1200×630 PNG.
 * Shows: pair, amount, status chip, truncated tx hash.
 */

import { ImageResponse } from "next/og";
import { fetcher } from "@/lib/api";
import { sanitizeDisplayText } from "@/lib/textSafety";
import type { IntentDetail } from "@/lib/types";
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
  Section,
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
export const alt = "Vortex Intent — Cross-chain Swap";
export const size = { width: OG_IMAGE_WIDTH, height: OG_IMAGE_HEIGHT };
export const contentType = "image/png";

// Cache with 60s revalidation (Next.js will cache this at edge)
export const revalidate = 60;

async function fetchIntent(id: string): Promise<IntentDetail | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2000); // 2s timeout

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

export default async function IntentOGImage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const intent = await fetchIntent(id);

  if (!intent) {
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
            <div style={{ fontSize: 64, marginBottom: SPACING.md }}>🔍</div>
            <div style={{ fontSize: 32, fontWeight: 700, color: COLORS.textPrimary, marginBottom: SPACING.sm }}>
              Intent Not Found
            </div>
            <div style={{ fontSize: 20, color: COLORS.textSecondary, maxWidth: 600 }}>
              The intent <code style={{ fontFamily: FONTS.mono, background: COLORS.surface, padding: "4px 8px", borderRadius: RADIUS.sm }}>{id.slice(0, 12)}</code> could not be loaded.
            </div>
          </div>
        </OGLayout>
      ),
      { width: OG_IMAGE_WIDTH, height: OG_IMAGE_HEIGHT },
    );
  }

  // Sanitize all user-facing strings
  const safeSolver = sanitizeDisplayText(intent.solver);
  const safeSrcToken = sanitizeDisplayText(intent.srcToken);
  const safeDstToken = sanitizeDisplayText(intent.dstToken);
  const safeSrcChain = sanitizeDisplayText(intent.srcChain);

  // Format amounts
  const srcAmt = formatAmount(intent.srcAmount);
  const dstAmt = formatAmount(intent.dstAmount);

  // Build title: "500 USDC → 498.5 USDC"
  const title = truncateTitle(`${srcAmt} ${safeSrcToken} → ${dstAmt} ${safeDstToken}`);
  const subtitle = truncateDescription(`${safeSrcChain} → Stellar via ${safeSolver}`);

  const statusColor = getStatusColor(intent.status, "intent");
  const statusLabel = getStatusLabel(intent.status, "intent");
  const txDisplay = intent.txHash ? truncateHash(intent.txHash) : "—";

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
          {/* Header: Brand + Intent ID */}
          <FlexRow justify="between" style={{ marginBottom: SPACING.xl }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: COLORS.textSecondary, marginBottom: 4 }}>
                Vortex Intent
              </div>
              <div style={{ fontSize: 15, fontFamily: FONTS.mono, color: COLORS.textMuted }}>
                {id.slice(0, 12)}…
              </div>
            </div>
            <Badge color={statusColor} bgColor={`${statusColor}20`} borderColor={`${statusColor}40`}>
              {statusLabel}
            </Badge>
          </FlexRow>

          {/* Main swap details */}
          <Card style={{ marginBottom: SPACING.xl }}>
            <div
              style={{
                fontSize: 42,
                fontWeight: 800,
                lineHeight: 1.1,
                color: COLORS.textPrimary,
                marginBottom: SPACING.sm,
                wordBreak: "break-word",
              }}
            >
              {title}
            </div>
            <div
              style={{
                fontSize: 20,
                color: COLORS.textSecondary,
                lineHeight: 1.4,
              }}
            >
              {subtitle}
            </div>
          </Card>

          {/* Details grid */}
          <Grid columns={2} gap={SPACING.md}>
            <KeyValueRow
              label="Source Amount"
              value={`${srcAmt} ${safeSrcToken}`}
              valueFont="sans"
            />
            <KeyValueRow
              label="Destination Amount"
              value={`${dstAmt} ${safeDstToken}`}
              valueFont="sans"
            />
            <KeyValueRow
              label="Min Output"
              value={`${formatAmount(intent.minOut)} ${safeDstToken}`}
              valueFont="sans"
            />
            <KeyValueRow
              label="Source Chain"
              value={safeSrcChain}
              valueFont="sans"
            />
            <KeyValueRow
              label="Solver"
              value={safeSolver}
              valueFont="sans"
            />
            <KeyValueRow
              label="Settlement TX"
              value={txDisplay}
              valueFont="mono"
              valueColor={intent.txHash ? COLORS.accentSage : COLORS.textMuted}
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
              Vortex Protocol — Cross-chain Swaps via Stellar
            </div>
            <div style={{ fontSize: 13, fontFamily: FONTS.mono, color: COLORS.textMuted }}>
              {new Date(intent.createdAt).toLocaleDateString()}
            </div>
          </div>
        </div>
      </OGLayout>
    ),
    { width: OG_IMAGE_WIDTH, height: OG_IMAGE_HEIGHT },
  );
}