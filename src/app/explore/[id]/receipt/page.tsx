import type { Metadata } from "next";
import ReceiptClient from "./ReceiptClient";

export const metadata: Metadata = {
  title: "Intent Receipt",
  description: "Printable receipt for a filled Vortex swap intent.",
};

// Server Component shell; live intent data is fetched and rendered client-side.
export default function ReceiptPage({ params }: { params: { id: string } }) {
  return <ReceiptClient id={params.id} />;
}
