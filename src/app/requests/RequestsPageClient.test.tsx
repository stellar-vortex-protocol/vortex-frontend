import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/components/Nav", () => ({ Nav: () => <nav /> }));
vi.mock("@/components/ConnectWalletButton", () => ({
  ConnectWalletButton: () => <button type="button">Connect Freighter</button>,
}));

import { useWalletStore } from "@/store/wallet";
import { resetSupportRequests } from "@/lib/supportRequestStore";
import RequestsPageClient from "./RequestsPageClient";

const initialWallet = useWalletStore.getState();
const WALLET = "GTESTWALLET";

function connect() {
  useWalletStore.setState({ isConnected: true, address: WALLET });
}

async function submit(user: ReturnType<typeof userEvent.setup>, name: string, why = "Plenty of demand for it here.") {
  await user.type(screen.getByLabelText("Name"), name);
  await user.type(screen.getByLabelText("Why should Vortex support it?"), why);
  await user.click(screen.getByRole("button", { name: "Submit request" }));
}

describe("RequestsPageClient", () => {
  beforeEach(() => {
    resetSupportRequests();
    useWalletStore.setState(initialWallet, true);
  });

  it("asks for a wallet before requests can be submitted", () => {
    render(<RequestsPageClient />);
    expect(screen.getByText("Connect your wallet to submit or upvote a request.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Name")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Upvote BNB Chain/ })).toBeDisabled();
  });

  it("adds a new request with the submitter's upvote", async () => {
    connect();
    const user = userEvent.setup();
    render(<RequestsPageClient />);

    await submit(user, "Solana");

    const upvote = screen.getByRole("button", { name: "Upvote Solana (1 upvotes)" });
    expect(upvote).toHaveAttribute("aria-pressed", "true");
    expect(upvote).toBeDisabled();
  });

  it("explains that an existing chain is already supported", async () => {
    connect();
    const user = userEvent.setup();
    render(<RequestsPageClient />);

    await submit(user, "Arbitrum");

    expect(screen.getByRole("alert")).toHaveTextContent("Arbitrum is already supported by Vortex.");
  });

  it("points to the existing request instead of creating a duplicate", async () => {
    connect();
    const user = userEvent.setup();
    render(<RequestsPageClient />);

    await submit(user, "bnb chain");

    expect(screen.getByRole("alert")).toHaveTextContent("bnb chain has already been requested");
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("allows one upvote per wallet and re-sorts by upvotes", async () => {
    connect();
    const user = userEvent.setup();
    render(<RequestsPageClient />);

    // DAI starts with 1 upvote, BNB Chain with 2.
    await user.click(screen.getByRole("button", { name: "Upvote DAI (1 upvotes)" }));
    const dai = screen.getByRole("button", { name: "Upvote DAI (2 upvotes)" });
    expect(dai).toHaveAttribute("aria-pressed", "true");
    expect(dai).toBeDisabled();

    // Ties keep the older request first, so BNB Chain still leads.
    const items = screen.getAllByRole("listitem");
    expect(within(items[0]!).getByText("BNB Chain")).toBeInTheDocument();
  });
});
