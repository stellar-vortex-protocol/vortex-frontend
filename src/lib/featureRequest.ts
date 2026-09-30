/**
 * Builds a pre-filled "new issue" URL for the in-app feature-request form.
 * No backend: GitHub's own issue form does the submitting, and the body
 * mirrors `.github/ISSUE_TEMPLATE/feature_request.md`'s sections.
 *
 * The `template` query parameter is deliberately not used: when it's set,
 * GitHub shows the template's empty body instead of the pre-filled one.
 */

export const FEATURE_REQUEST_REPO = "stellar-vortex-protocol/vortex-frontend";
export const MAX_TITLE_LENGTH = 120;
/**
 * Keeps the generated URL comfortably under the ~8 KB that browsers and
 * GitHub reliably accept, even after percent-encoding non-ASCII text.
 */
export const MAX_DESCRIPTION_LENGTH = 2000;

export type FeatureRequest = {
  title: string;
  description: string;
};

export function buildFeatureRequestBody(description: string): string {
  const trimmed = description.trim();
  const capped =
    trimmed.length > MAX_DESCRIPTION_LENGTH
      ? `${trimmed.slice(0, MAX_DESCRIPTION_LENGTH)}\n\n_(Truncated to ${MAX_DESCRIPTION_LENGTH} characters by the in-app form.)_`
      : trimmed;
  return [
    "## Problem",
    "",
    capped,
    "",
    "## Proposed solution",
    "",
    "<!-- Describe the outcome you would like. -->",
    "",
    "## Alternatives considered",
    "",
    "<!-- Describe any alternative solutions or workarounds you considered. -->",
    "",
    "## Additional context",
    "",
    "Submitted from the in-app \"Suggest a feature\" form.",
  ].join("\n");
}

export function buildFeatureRequestUrl({ title, description }: FeatureRequest): string {
  const params = new URLSearchParams({
    title: `feat: ${title.trim().slice(0, MAX_TITLE_LENGTH)}`,
    labels: "enhancement",
    body: buildFeatureRequestBody(description),
  });
  return `https://github.com/${FEATURE_REQUEST_REPO}/issues/new?${params.toString()}`;
}
