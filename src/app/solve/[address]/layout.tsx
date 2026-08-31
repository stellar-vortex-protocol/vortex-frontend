import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Solver Profile",
  description:
    "Detailed statistics and fill history for an individual Vortex solver.",
};

export default function SolverDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
