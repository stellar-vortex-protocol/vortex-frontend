import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy & Data",
  description: "See, export and clear everything Vortex stores in this browser.",
};

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
