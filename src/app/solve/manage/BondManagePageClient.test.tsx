import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import BondManagePageClient from "./BondManagePageClient";
import { getBondState } from "@/lib/bond/adapter";

vi.mock("@/lib/bond/adapter", () => ({
  getBondState: vi.fn(),
}));

const mockedGetBondState = vi.mocked(getBondState);

describe("BondManagePageClient", () => {
  beforeEach(() => {
    mockedGetBondState.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("shows an error panel with a retry action when the adapter read rejects", async () => {
    mockedGetBondState.mockRejectedValueOnce(new Error("rpc unavailable"));

    render(<BondManagePageClient />);

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
  });

  it("retries the adapter read and renders the bond state on success", async () => {
    mockedGetBondState
      .mockRejectedValueOnce(new Error("rpc unavailable"))
      .mockResolvedValueOnce({
        amount: 0n,
        token: "0x0000000000000000000000000000000000000000",
      } as never);

    render(<BondManagePageClient />);

    const retry = await screen.findByRole("button", { name: /retry/i });
    await userEvent.click(retry);

    await waitFor(() => {
      expect(mockedGetBondState).toHaveBeenCalledTimes(2);
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
