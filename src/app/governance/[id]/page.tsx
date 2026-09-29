import ProposalDetailClient from "./ProposalDetailClient";

export default function ProposalDetailPage({ params }: { params: { id: string } }) {
  return <ProposalDetailClient proposalId={params.id} />;
}
