import { notFound } from "next/navigation";
import { bondFeatureMode } from "@/lib/bond/flag";
import BondManagePageClient from "./BondManagePageClient";

export const metadata = { title: "Manage Solver Bond" };

export default function BondManagePage() {
  // Hidden until the bond API ships (or a mock is explicitly enabled).
  if (bondFeatureMode() === "off") notFound();
  return <BondManagePageClient />;
}
