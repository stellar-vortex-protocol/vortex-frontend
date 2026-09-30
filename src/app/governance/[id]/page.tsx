import ProposalDetailClient from "./ProposalDetailClient";
import { parseIntentId } from "@/lib/inputs";

export default function ProposalDetailPage({ params }: { params: { id: string } }) {
  const proposalId = parseIntentId(params.id);
  return <ProposalDetailClient proposalId={proposalId ?? ""} />;
}
