import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Explore Intents",
  description:
    "Browse every swap intent submitted to Vortex — filter by status and chain, sort by time or size, and drill into individual fills.",
};

export default function ExploreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
