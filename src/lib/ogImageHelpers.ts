/**
 * Shared Open Graph image helpers for dynamic OG image generation.
 *
 * Provides reusable layout components, text truncation utilities, and
 * typographic constants that ensure consistent, RTL/CJK-safe rendering
 * across intent, solver, and proposal OG images.
 */

// ─── Constants ────────────────────────────────────────────────────────────────

export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;

// Colour palette (matches globals.css Vortex theme)
export const COLORS = {
  background: "#080C14",
  surface: "rgba(255,255,255,0.04)",
  surfaceElevated: "rgba(255,255,255,0.08)",
  border: "rgba(255,255,255,0.1)",
  textPrimary: "#E8EDF5",
  textSecondary: "#6B7A8E",
  textMuted: "#4A5568",
  accentSage: "#4CEBA8",
  accentSageBg: "rgba(76,235,168,0.1)",
  accentSageBorder: "rgba(76,235,168,0.25)",
  statusPending: "#F59E0B", // amber
  statusFilled: "#4CEBA8", // sage
  statusFailed: "#EF4444", // red
  statusActive: "#4CEBA8",
  statusInactive: "#6B7A8E",
  statusPassed: "#4CEBA8",
  statusRejected: "#EF4444",
} as const;

// Font stacks (system fonts - no external requests, works in edge runtime)
export const FONTS = {
  sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif",
  mono: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace",
} as const;

// Spacing scale
export const SPACING = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

// Border radius
export const RADIUS = {
  sm: 6,
  md: 10,
  lg: 16,
  full: 9999,
} as const;

// ─── Text Truncation & Safety ─────────────────────────────────────────────────

/**
 * Truncate text to a maximum number of grapheme clusters (visual characters),
 * appending an ellipsis if truncated.
 * Uses Array.from to handle multi-codepoint graphemes (emoji, CJK, RTL).
 */
export function truncateText(text: string, maxLength: number): string {
  const graphemes = Array.from(text);
  if (graphemes.length <= maxLength) return text;
  return graphemes.slice(0, maxLength - 1).join("") + "…";
}

/**
 * Truncate text for OG image titles (handles RTL/CJK/emoji safely).
 * Default cap: 48 characters for single-line titles.
 */
export function truncateTitle(text: string, maxLength = 48): string {
  return truncateText(text, maxLength);
}

/**
 * Truncate text for OG image descriptions.
 * Default cap: 120 characters for multi-line descriptions.
 */
export function truncateDescription(text: string, maxLength = 120): string {
  return truncateText(text, maxLength);
}

/**
 * Truncate a transaction hash or address for display (preserves prefix/suffix).
 */
export function truncateHash(hash: string, prefix = 6, suffix = 6): string {
  if (hash.length <= prefix + suffix + 1) return hash;
  return `${hash.slice(0, prefix)}…${hash.slice(-suffix)}`;
}

/**
 * Format a token amount for display (compact notation for large numbers).
 */
export function formatAmount(amount: string, decimals = 4): string {
  const num = parseFloat(amount);
  if (isNaN(num)) return amount;
  if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(1) + "M";
  }
  if (num >= 1_000) {
    return (num / 1_000).toFixed(1) + "K";
  }
  return num.toFixed(decimals).replace(/\.?0+$/, "");
}

/**
 * Get status colour for a given status string.
 */
export function getStatusColor(
  status: string,
  type: "intent" | "solver" | "proposal"
): string {
  const s = status.toLowerCase();
  switch (type) {
    case "intent":
      if (s === "filled") return COLORS.statusFilled;
      if (s === "pending" || s === "accepted") return COLORS.statusPending;
      if (s === "failed") return COLORS.statusFailed;
      return COLORS.textSecondary;
    case "solver":
      if (s === "active") return COLORS.statusActive;
      return COLORS.statusInactive;
    case "proposal":
      if (s === "passed") return COLORS.statusPassed;
      if (s === "rejected") return COLORS.statusRejected;
      if (s === "active") return COLORS.statusPending;
      return COLORS.textSecondary;
  }
}

/**
 * Get human-readable status label.
 */
export function getStatusLabel(status: string, type: "intent" | "solver" | "proposal"): string {
  const s = status.toLowerCase();
  switch (type) {
    case "intent":
      if (s === "filled") return "Filled";
      if (s === "pending") return "Pending";
      if (s === "accepted") return "Accepted";
      if (s === "failed") return "Failed";
      return status;
    case "solver":
      if (s === "active") return "Active";
      return "Inactive";
    case "proposal":
      if (s === "passed") return "Passed";
      if (s === "rejected") return "Rejected";
      if (s === "active") return "Active";
      return status;
  }
}

// ─── Shared Layout Components (for use in ImageResponse JSX) ──────────────────

export interface OGLayoutProps {
  children: React.ReactNode;
  accentColor?: string;
}

export function OGLayout({ children, accentColor = COLORS.accentSage }: OGLayoutProps) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: COLORS.background,
        position: "relative",
        fontFamily: FONTS.sans,
        color: COLORS.textPrimary,
      }}
    >
      {/* Subtle radial accent glow - top center */}
      <div
        style={{
          position: "absolute",
          top: -80,
          left: "50%",
          transform: "translateX(-50%)",
          width: 900,
          height: 500,
          background: `radial-gradient(ellipse at center, ${accentColor}20 0%, transparent 70%)`,
          pointerEvents: "none",
        }}
      />
      {children}
    </div>
  );
}

export interface CardProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
}

export function Card({ children, style = {} }: CardProps) {
  return (
    <div
      style={{
        background: COLORS.surfaceElevated,
        border: `1px solid ${COLORS.border}`,
        borderRadius: RADIUS.lg,
        padding: SPACING.lg,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export interface BadgeProps {
  children: React.ReactNode;
  color: string;
  bgColor?: string;
  borderColor?: string;
  style?: React.CSSProperties;
}

export function Badge({
  children,
  color,
  bgColor,
  borderColor,
  style = {},
}: BadgeProps) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: `${SPACING.xs}px ${SPACING.md}px`,
        borderRadius: RADIUS.full,
        fontSize: 14,
        fontWeight: 600,
        color,
        background: bgColor || `${color}20`,
        border: `1px solid ${borderColor || `${color}40`}`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export interface KeyValueRowProps {
  label: string;
  value: string;
  valueColor?: string;
  valueFont?: "sans" | "mono";
}

export function KeyValueRow({ label, value, valueColor = COLORS.textPrimary, valueFont = "sans" }: KeyValueRowProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          color: COLORS.textSecondary,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 15,
          fontWeight: 500,
          color: valueColor,
          fontFamily: valueFont === "mono" ? FONTS.mono : FONTS.sans,
          wordBreak: "break-all",
        }}
      >
        {value}
      </div>
    </div>
  );
}

export interface SectionProps {
  title: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}

export function Section({ title, children, style = {} }: SectionProps) {
  return (
    <div style={{ marginBottom: SPACING.xl, ...style }}>
      <div
        style={{
          fontSize: 13,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: COLORS.textSecondary,
          marginBottom: SPACING.md,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

export interface FlexRowProps {
  children: React.ReactNode;
  gap?: number;
  align?: "center" | "start" | "end" | "stretch";
  justify?: "start" | "center" | "end" | "between" | "around";
}

export function FlexRow({ children, gap = SPACING.md, align = "center", justify = "start" }: FlexRowProps) {
  return (
    <div
      style={{
        display: "flex",
        gap,
        alignItems: align,
        justifyContent: justify,
        flexWrap: "wrap",
      }}
    >
      {children}
    </div>
  );
}

export interface GridProps {
  children: React.ReactNode;
  columns?: number;
  gap?: number;
}

export function Grid({ children, columns = 2, gap = SPACING.md }: GridProps) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap,
      }}
    >
      {children}
    </div>
  );
}