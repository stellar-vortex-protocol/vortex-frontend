import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contributors",
  description:
    "Celebrate the people who've built Vortex through the Drips Wave process — every merged PR makes this project stronger.",
};

export default function ContributorsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
