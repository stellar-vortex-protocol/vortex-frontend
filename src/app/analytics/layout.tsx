import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Protocol Analytics",
  description: "Track aggregate protocol volume, route popularity, and intent lifecycle health from the live intent feed.",
};

export default function AnalyticsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
