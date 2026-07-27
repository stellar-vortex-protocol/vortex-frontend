type MessageParams = Record<string, string | number>;

const messages = {
  "explore.nav.label": "Explore",
  "explore.page.eyebrow": "Intent Explorer",
  "explore.page.hero.title": "Browse all intents",
  "explore.page.hero.description": "Every swap intent submitted to Vortex, from open auctions to completed fills.",
  "explore.page.liveLabel": "Live",
  "explore.page.pollingLabel": "Polling",
  "explore.page.filterStatusLabel": "Filter by status",
  "explore.page.filterChainLabel": "Filter by chain",
  "explore.page.sortLabel": "Sort order",
  "explore.page.status.all": "All statuses",
  "explore.page.chain.all": "All chains",
  "explore.page.sort.newest": "Newest first",
  "explore.page.sort.oldest": "Oldest first",
  "explore.page.sort.largest": "Largest amount",
  "explore.page.errors.load": "Couldn't load intents right now. Try again shortly.",
  "explore.page.errors.empty": "No intents match your filters.",
  "explore.page.intentCount.one": "1 intent",
  "explore.page.intentCount.many": "{count} intents",
  "explore.page.pagination.previous": "Previous",
  "explore.page.pagination.next": "Next",
  "explore.page.pagination.page": "Page {page} of {pageCount}",
  "explore.detail.back": "← Back to explorer",
  "explore.detail.nav.label": "Intent {id}",
  "explore.detail.eyebrow": "Intent",
  "explore.detail.errors.load": "Couldn't find that intent. It may not exist, or the relay is unreachable.",
  "explore.detail.errors.empty": "No details found for this intent.",
  "explore.detail.labels.sourceChain": "Source chain",
  "explore.detail.labels.solver": "Solver",
  "explore.detail.labels.minimumOut": "Minimum out",
  "explore.detail.labels.submitted": "Submitted",
  "explore.detail.labels.deadline": "Deadline",
  "explore.detail.labels.destinationAddress": "Destination address",
  "explore.detail.deadline.expired": "Expired",
  "explore.detail.deadline.remaining.minutes": "{minutes}m {seconds}s remaining",
  "explore.detail.deadline.remaining.seconds": "{seconds}s remaining",
  "explore.detail.txLink": "View settlement tx on stellar.expert →",
} as const;

export type MessageKey = keyof typeof messages;

export function getMessage(key: MessageKey, params?: MessageParams): string {
  let messageKey = key;
  if (key === "explore.page.intentCount" && params?.count !== undefined) {
    messageKey = Number(params.count) === 1 ? "explore.page.intentCount.one" : "explore.page.intentCount.many";
  }

  let message = messages[messageKey as MessageKey] ?? key;

  if (!params) return message;

  for (const [name, value] of Object.entries(params)) {
    message = message.replace(new RegExp(`\\{${name}\\}`, "g"), String(value));
  }

  return message;
}
