import fs from "fs";
import path from "path";
import ContributorsPageClient from "./ContributorsPageClient";
import { parseIssuesMarkdown } from "@/lib/issuesParser";

export const metadata = {
  title: "Contributor Wave Dashboard | Vortex Protocol",
  description: "Transparent contribution metrics, issue distribution, and point tallies for the Vortex Protocol Drips Wave program.",
};

export default function ContributorsPage() {
  let markdownContent = "";
  try {
    const issuesFilePath = path.join(process.cwd(), "issues.md");
    if (fs.existsSync(issuesFilePath)) {
      markdownContent = fs.readFileSync(issuesFilePath, "utf8");
    }
  } catch {
    // Fallback if filesystem read fails
  }

  const metrics = parseIssuesMarkdown(markdownContent);

  return <ContributorsPageClient metrics={metrics} />;
}
