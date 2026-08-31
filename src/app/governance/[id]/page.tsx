import ProposalDetailClient from "./ProposalDetailClient";

export const metadata = {
  title: "Governance Proposal | Vortex Protocol",
  description: "Governance proposal details and community discussion thread.",
};

export default function ProposalDetailPage({ params }: { params: { id: string } }) {
  return <ProposalDetailClient proposalId={params.id} />;
}
