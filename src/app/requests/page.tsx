import RequestsPageClient from "./RequestsPageClient";

export const metadata = {
  title: "Chain & Token Requests | Vortex Protocol",
  description: "Request support for a new chain or token and upvote the community's requests.",
};

export default function RequestsPage() {
  return <RequestsPageClient />;
}
