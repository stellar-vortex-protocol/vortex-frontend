export type Locale = "en";

export type TranslationValues = Record<string, string | number>;

export const messages = {
  en: {
    solve: {
      nav: {
        label: "Solver Portal",
      },
      hero: {
        eyebrow: "Solver Network",
        title: "Become a Vortex Solver",
        description:
          "Solvers are competitive market makers who fill user swap intents. Deposit a USDC bond, watch the open intent feed, and earn fees on every fill you complete.",
      },
      steps: {
        registerBond: {
          number: "01",
          title: "Register + Bond",
          body:
            "Deposit ≥50 USDC as a bond into the Vortex settlement contract. Your bond backs your reliability — failing to fill after accepting slashes 10%.",
        },
        watchIntentFeed: {
          number: "02",
          title: "Watch the intent feed",
          body:
            "Monitor the open intents API or WebSocket. When you see a profitable opportunity, claim exclusive fill rights for a 5-minute window.",
        },
        fillAndEarn: {
          number: "03",
          title: "Fill and earn",
          body:
            "Execute the source-chain leg, relay to Stellar, transfer dst tokens to the user. Earn the spread between your fill cost and the user's minimum.",
        },
      },
      tabs: {
        ariaLabel: "Solver portal sections",
        leaderboard: "leaderboard",
        intents: "intents",
        register: "register",
      },
      leaderboard: {
        title: "Active Solvers",
        error: "Couldn't load the solver leaderboard right now. Try again shortly.",
        empty: "No active solvers yet.",
        fills: "Fills",
        volume: "Volume",
        avgTime: "Avg Time",
        success: "Success",
      },
      intents: {
        title: "Open Intents",
        available: "{count} available",
        error: "Couldn't load open intents right now. Try again shortly.",
        empty: "No open intents right now — check back soon.",
        accept: "Accept Intent →",
        accepting: "Accepting…",
        id: "ID: {id}",
        details: "Min out: {minOut} {dstToken} · Expires in {timeRemaining}",
      },
      register: {
        title: "Register as Solver",
        description: "Deposit a USDC bond to start filling intents.",
        addressLabel: "Stellar Address",
        bondLabel: "Bond Amount (USDC)",
        addressPlaceholder: "G...",
        bondPlaceholder: "Minimum 50 USDC",
        info: {
          minimumBond: "• Minimum bond: 50 USDC",
          slash: "• Slash on failed fill: 10% of bond",
          withdraw: "• Withdraw bond anytime when inactive",
        },
        button: {
          connect: "Connect Freighter to Register",
          registered: "Registered ✓ — register another",
        },
        states: {
          connecting: "Connecting wallet…",
          building: "Preparing registration…",
          awaitingSignature: "Confirm in Freighter…",
          submitting: "Submitting…",
        },
        validation: {
          invalidAddress: "Enter a valid Stellar address (starts with G).",
          minimumBond: "Minimum bond is {minBond} USDC.",
        },
        onboarding: {
          title: "Before You Register: Solver Readiness & Expectations",
          description: "Review protocol requirements and public tracking metrics before registering as a Vortex solver.",
          dismiss: "Dismiss checklist",
          show: "Show onboarding checklist",
          bondTitle: "1. Bond & Collateral Purpose",
          bondBody: "Depositing a minimum 50 USDC bond backs your execution commitment. Failing to fulfill an accepted intent within 5 minutes results in a 10% bond slash. Your bond is withdrawable anytime when inactive.",
          metricsTitle: "2. Public Performance Metrics",
          metricsBody: "From the moment you register, your Stellar address is publicly listed on the solver leaderboard. Fill count, USD volume, success rate %, and average fill time in seconds are tracked transparently.",
          expectationsTitle: "3. Operational Expectations",
          expectationsBody: "Maintain high node uptime and competitive fill response times. Claiming an intent grants a 5-minute exclusive fill window to complete the cross-chain settlement.",
        },
      },
      governance: {
        title: "Protocol Governance",
        description: "Review proposals, deliberate in community discussions, and participate in protocol voting.",
        connectToComment: "Connect your wallet to join the proposal discussion.",
        postComment: "Post Comment",
        emptyCommentError: "Comment text cannot be empty or whitespace only.",
        commentPlaceholder: "Share your perspective on this proposal...",
        characterCount: "{current} / {max} characters",
      },
    },
  },
} as const;

export const defaultLocale: Locale = "en";

function getNestedMessage(localeMessages: Record<string, unknown>, key: string): string | undefined {
  const parts = key.split(".");
  let current: unknown = localeMessages;

  for (const part of parts) {
    if (typeof current !== "object" || current === null || !(part in current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return typeof current === "string" ? current : undefined;
}

export function getMessage(
  key: string,
  localeOrValues?: Locale | TranslationValues,
  valuesOrLocale?: TranslationValues | Locale,
): string {
  const locale = typeof localeOrValues === "string" ? localeOrValues : defaultLocale;
  const values = typeof localeOrValues === "string"
    ? (valuesOrLocale as TranslationValues | undefined)
    : (localeOrValues as TranslationValues | undefined);

  const localeMessages = messages[locale] as Record<string, unknown>;
  const message = getNestedMessage(localeMessages, key);

  if (message === undefined) {
    return key;
  }

  return message.replace(/\{(\w+)\}/g, (_, placeholder: string) => {
    const replacement = values?.[placeholder];
    return replacement === undefined ? "" : String(replacement);
  });
}

export function useMessages(locale: Locale = defaultLocale) {
  return {
    t: (key: string, values?: TranslationValues) => getMessage(key, locale, values),
  };
}
