import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Intent Detail",
  description:
    "Full details for a single Vortex swap intent, including status, chains, amounts, and settlement transaction.",
};

export default function IntentDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
