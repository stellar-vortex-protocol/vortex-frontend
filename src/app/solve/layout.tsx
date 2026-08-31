import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Solver Dashboard",
  description:
    "Compete as a Vortex solver: browse the leaderboard, accept open swap intents, and register a new solver with a USDC bond.",
};

export default function SolveLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
