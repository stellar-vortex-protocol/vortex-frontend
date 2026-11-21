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
  /** Curated onboarding signal from `Good first issue: yes` in issues.md. */
  goodFirstIssue: boolean;
  /** Optional GitHub handle (no leading `@`) from `Mentor: handle` in issues.md. */
  mentor: string | null;
};

/**
 * A problem found while parsing. Malformed entries are dropped from `issues`
 * and reported here instead of being silently defaulted; maintainers read these.
 * `line` is `null` for file-level problems.
 */
export type ParseWarning = {
  line: number | null;
  message: string;
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

/** Per-contributor tally for one category, computed from that contributor's issues. */
export type ContributorCategoryBreakdown = {
  category: string;
  completedCount: number;
  pointsEarned: number;
};

/** Per-contributor tally for one complexity tier. */
export type ContributorComplexityBreakdown = {
  complexity: ComplexityTier;
  completedCount: number;
  pointsEarned: number;
};

/**
 * Contributor-scoped breakdown. `completedCount` and `pointsEarned` are the
 * contributor's totals; the category/tier tallies sum to exactly those values.
 */
export type ContributorBreakdown = {
  contributor: string;
  completedCount: number;
  pointsEarned: number;
  categories: ContributorCategoryBreakdown[];
  complexities: ContributorComplexityBreakdown[];
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
  warnings: ParseWarning[];
};

/** The single source of truth for points per complexity tier. */
export const TIER_POINTS: Record<ComplexityTier, number> = {
  Trivial: 50,
  Medium: 150,
  High: 200,
};

// Stellar account strkey: "G" + 55 base32 characters (A-Z, 2-7).
const STRKEY_RE = /^G[A-Z2-7]{55}$/;
// The metadata block is the last parenthesised group with no nested parens,
// so titles such as "Fix (urgent) parser" keep their own parentheses.
const METADATA_RE = /^(.*?)\s*\(([^()]*)\)$/;
const KNOWN_FIELDS = ["complexity", "points", "status", "contributor", "good first issue", "mentor"];

function isTier(value: string | undefined): value is ComplexityTier {
  return value === "Trivial" || value === "Medium" || value === "High";
}

function isStatus(value: string | undefined): value is IssueStatus {
  return value === "Open" || value === "In Progress" || value === "Completed";
}

type EntryResult = { issue: WaveIssue | null; problems: string[] };

/** Parses one bullet body such as `#123 Title (Complexity: High, Status: Open)`. */
function parseEntry(body: string, category: string): EntryResult {
  const idMatch = body.match(/^#(\d+)\s+(.*)$/);
  if (!idMatch) return { issue: null, problems: ["expected `- #<number> <title> (...)`"] };

  const id = Number(idMatch[1]);
  const meta = idMatch[2].match(METADATA_RE);
  if (!meta) return { issue: null, problems: ["missing trailing (Complexity: …, Status: …) block"] };

  const title = meta[1].trim();
  if (!title) return { issue: null, problems: ["empty title"] };

  const problems: string[] = [];
  const fields = new Map<string, string>();
  for (const part of meta[2].split(",")) {
    const colon = part.indexOf(":");
    const key = (colon === -1 ? part : part.slice(0, colon)).trim().toLowerCase();
    const value = colon === -1 ? "" : part.slice(colon + 1).trim();
    if (!key || !value) {
      problems.push(`malformed field "${part.trim()}"`);
      continue;
    }
    if (!KNOWN_FIELDS.includes(key)) problems.push(`unknown field "${key}"`);
    fields.set(key, value);
  }

  const complexity = fields.get("complexity");
  if (!isTier(complexity)) {
    return { issue: null, problems: [...problems, `unknown complexity "${complexity ?? ""}"`] };
  }
  const status = fields.get("status");
  if (!isStatus(status)) {
    return { issue: null, problems: [...problems, `unknown status "${status ?? ""}"`] };
  }

  // Points are derived from the tier table; a declared value is only checked.
  const points = TIER_POINTS[complexity];
  const declaredPoints = fields.get("points");
  if (declaredPoints !== undefined && Number(declaredPoints) !== points) {
    problems.push(`Points ${declaredPoints} does not match ${complexity} tier (${points}); using ${points}`);
  }

  let contributor: string | null = null;
  const declaredContributor = fields.get("contributor");
  if (declaredContributor && declaredContributor !== "None") {
    contributor = declaredContributor;
    if (!STRKEY_RE.test(declaredContributor)) {
      problems.push(`contributor is not a valid Stellar address: ${declaredContributor.slice(0, 12)}…`);
    }
  }

  const goodFirst = fields.get("good first issue");
  if (goodFirst !== undefined && goodFirst !== "yes" && goodFirst !== "no") {
    problems.push(`Good first issue must be yes or no, got "${goodFirst}"`);
  }

  const rawMentor = fields.get("mentor")?.replace(/^@/, "");
  const mentor = rawMentor && rawMentor !== "None" ? rawMentor : null;

  return {
    issue: {
      id,
      title,
      category,
      complexity,
      points,
      status,
      contributor,
      goodFirstIssue: goodFirst?.toLowerCase() === "yes",
      mentor,
    },
    problems,
  };
}

/**
 * Computes a contributor-scoped breakdown from an already-filtered issue list.
 * Only completed issues assigned to `contributor` are tallied, so the category
 * and complexity tallies always sum to the returned totals.
 */
export function computeContributorBreakdown(
  issues: readonly WaveIssue[],
  contributor: string,
): ContributorBreakdown {
  const categoryMap: Record<string, ContributorCategoryBreakdown> = {};
  const complexityMap: Record<ComplexityTier, ContributorComplexityBreakdown> = {
    Trivial: { complexity: "Trivial", completedCount: 0, pointsEarned: 0 },
    Medium: { complexity: "Medium", completedCount: 0, pointsEarned: 0 },
    High: { complexity: "High", completedCount: 0, pointsEarned: 0 },
  };
  let completedCount = 0;
  let pointsEarned = 0;

  for (const issue of issues) {
    if (issue.contributor !== contributor || issue.status !== "Completed") continue;

    completedCount++;
    pointsEarned += issue.points;

    const cat = (categoryMap[issue.category] ??= {
      category: issue.category,
      completedCount: 0,
      pointsEarned: 0,
    });
    cat.completedCount++;
    cat.pointsEarned += issue.points;

    complexityMap[issue.complexity].completedCount++;
    complexityMap[issue.complexity].pointsEarned += issue.points;
  }

  return {
    contributor,
    completedCount,
    pointsEarned,
    categories: Object.values(categoryMap).sort((a, b) => b.pointsEarned - a.pointsEarned),
    complexities: Object.values(complexityMap),
  };
}

export function parseIssuesMarkdown(markdown: string): WaveMetrics {
  const lines = markdown.split(/\r?\n/);
  let currentCategory = "General";
  const issues: WaveIssue[] = [];
  const warnings: ParseWarning[] = [];
  const seenIds = new Set<number>();

  lines.forEach((raw, index) => {
    const line = index + 1;
    const trimmed = raw.trim();

    // Track category headings (e.g. ## Core Swap UI)
    if (trimmed.startsWith("## ") && !trimmed.toLowerCase().includes("complexity")) {
      currentCategory = trimmed.slice(3).trim();
      return;
    }

    if (!trimmed.startsWith("- #")) return;

    const { issue, problems } = parseEntry(trimmed.slice(2).trim(), currentCategory);
    for (const message of problems) warnings.push({ line, message });
    if (!issue) return;

    if (seenIds.has(issue.id)) {
      warnings.push({ line, message: `duplicate issue #${issue.id}; keeping the first entry` });
      return;
    }
    seenIds.add(issue.id);
    issues.push(issue);
  });

  if (issues.length === 0) {
    warnings.push({ line: null, message: "no issue entries found" });
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
    const cat = (categoryMap[issue.category] ??= {
      category: issue.category,
      total: 0,
      completed: 0,
      inProgress: 0,
      open: 0,
      totalPoints: 0,
      earnedPoints: 0,
    });
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
      const tally = (contributorMap[issue.contributor] ??= {
        contributor: issue.contributor,
        completedCount: 0,
        pointsEarned: 0,
      });
      tally.completedCount++;
      tally.pointsEarned += issue.points;
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
    warnings,
  };
}
