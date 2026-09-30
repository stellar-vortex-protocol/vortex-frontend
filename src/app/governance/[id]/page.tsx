import ProposalDetailClient from "./ProposalDetailClient";
import { parseIntentId } from "@/lib/inputs";

export const metadata = {
  title: "Governance Proposal | Vortex Protocol",
  description: "Governance proposal details and community discussion thread.",
};

export default function ProposalDetailPage({ params }: { params: { id: string } }) {
  const proposalId = parseIntentId(params.id);
  return <ProposalDetailClient proposalId={proposalId ?? ""} />;
}
