export type ComplexityTier = "Trivial" | "Medium" | "High";
export type IssueStatus = "Open" | "In Progress" | "Completed";

export type WaveIssue = {
  id: number;
  title: string;
  category: string;
  complexity: ComplexityTier;
  points: number;
  status: IssueStatus;
  contributor: string | null;
};

export type CategorySummary = {
  category: string;
  total: number;
  completed: number;
  inProgress: number;
  open: number;
  totalPoints: number;
  earnedPoints: number;
};

export type ComplexitySummary = {
  complexity: ComplexityTier;
  total: number;
  completed: number;
  points: number;
};

export type ContributorTally = {
  contributor: string;
  completedCount: number;
  pointsEarned: number;
};

export type WaveMetrics = {
  totalIssues: number;
  completedIssues: number;
  inProgressIssues: number;
  openIssues: number;
  totalPoints: number;
  earnedPoints: number;
  categories: CategorySummary[];
  complexities: ComplexitySummary[];
  leaderboard: ContributorTally[];
  issues: WaveIssue[];
};

const POINTS_MAP: Record<ComplexityTier, number> = {
  Trivial: 50,
  Medium: 150,
  High: 200,
};

export function parseIssuesMarkdown(markdown: string): WaveMetrics {
  const lines = markdown.split("\n");
  let currentCategory = "General";
  const issues: WaveIssue[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Track category headings (e.g. ## Core Swap UI)
    if (trimmed.startsWith("## ") && !trimmed.toLowerCase().includes("complexity")) {
      currentCategory = trimmed.replace("## ", "").trim();
      continue;
    }

    // Match issue list items starting with - #<number>
    if (trimmed.startsWith("- #")) {
      try {
        const afterHash = trimmed.substring(3);
        const firstSpaceIdx = afterHash.indexOf(" ");
        if (firstSpaceIdx === -1) continue;

        const idNum = parseInt(afterHash.substring(0, firstSpaceIdx), 10);
        if (isNaN(idNum)) continue;

        const rest = afterHash.substring(firstSpaceIdx + 1);

        // Title and parenthesized details: "Title (Complexity: ..., Points: ..., Status: ..., Contributor: ...)"
        const parenStart = rest.indexOf("(");
        const parenEnd = rest.lastIndexOf(")");

        let title = rest;
        let detailsStr = "";

        if (parenStart !== -1 && parenEnd !== -1 && parenEnd > parenStart) {
          title = rest.substring(0, parenStart).trim();
          detailsStr = rest.substring(parenStart + 1, parenEnd).trim();
        }

        // Parse key-value pairs inside parentheses
        const detailsParts = detailsStr.split(",");
        let complexity: ComplexityTier = "Medium";
        let points = 150;
        let status: IssueStatus = "Open";
        let contributor: string | null = null;

        for (const part of detailsParts) {
          const [key, val] = part.split(":").map((s) => s?.trim());
          if (!key || !val) continue;

          const keyLower = key.toLowerCase();
          if (keyLower === "complexity") {
            if (val === "Trivial" || val === "Medium" || val === "High") {
              complexity = val;
              points = POINTS_MAP[val];
            }
          } else if (keyLower === "points") {
            const parsedPts = parseInt(val, 10);
            if (!isNaN(parsedPts)) points = parsedPts;
          } else if (keyLower === "status") {
            if (val === "Completed" || val === "In Progress" || val === "Open") {
              status = val;
            }
          } else if (keyLower === "contributor") {
            if (val && val !== "None") {
              contributor = val;
            }
          }
        }

        issues.push({
          id: idNum,
          title,
          category: currentCategory,
          complexity,
          points,
          status,
          contributor,
        });
      } catch {
        // Graceful error handling for unexpected lines
      }
    }
  }

  // Calculate metrics
  let completedIssues = 0;
  let inProgressIssues = 0;
  let openIssues = 0;
  let totalPoints = 0;
  let earnedPoints = 0;

  const categoryMap: Record<string, CategorySummary> = {};
  const complexityMap: Record<ComplexityTier, ComplexitySummary> = {
    Trivial: { complexity: "Trivial", total: 0, completed: 0, points: 0 },
    Medium: { complexity: "Medium", total: 0, completed: 0, points: 0 },
    High: { complexity: "High", total: 0, completed: 0, points: 0 },
  };
  const contributorMap: Record<string, ContributorTally> = {};

  for (const issue of issues) {
    totalPoints += issue.points;

    if (issue.status === "Completed") {
      completedIssues++;
      earnedPoints += issue.points;
    } else if (issue.status === "In Progress") {
      inProgressIssues++;
    } else {
      openIssues++;
    }

    // Category summary
    if (!categoryMap[issue.category]) {
      categoryMap[issue.category] = {
        category: issue.category,
        total: 0,
        completed: 0,
        inProgress: 0,
        open: 0,
        totalPoints: 0,
        earnedPoints: 0,
      };
    }
    const cat = categoryMap[issue.category];
    cat.total++;
    cat.totalPoints += issue.points;
    if (issue.status === "Completed") {
      cat.completed++;
      cat.earnedPoints += issue.points;
    } else if (issue.status === "In Progress") {
      cat.inProgress++;
    } else {
      cat.open++;
    }

    // Complexity summary
    complexityMap[issue.complexity].total++;
    complexityMap[issue.complexity].points += issue.points;
    if (issue.status === "Completed") {
      complexityMap[issue.complexity].completed++;
    }

    // Contributor leaderboard summary
    if (issue.contributor && issue.status === "Completed") {
      if (!contributorMap[issue.contributor]) {
        contributorMap[issue.contributor] = {
          contributor: issue.contributor,
          completedCount: 0,
          pointsEarned: 0,
        };
      }
      contributorMap[issue.contributor].completedCount++;
      contributorMap[issue.contributor].pointsEarned += issue.points;
    }
  }

  const leaderboard = Object.values(contributorMap).sort(
    (a, b) => b.pointsEarned - a.pointsEarned
  );

  return {
    totalIssues: issues.length,
    completedIssues,
    inProgressIssues,
    openIssues,
    totalPoints,
    earnedPoints,
    categories: Object.values(categoryMap),
    complexities: Object.values(complexityMap),
    leaderboard,
    issues,
  };
}
