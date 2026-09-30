import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PrivacyPage from "./page";
import { STORAGE_KEYS, storage, __resetStorageForTests } from "@/lib/storage";

vi.mock("@/components/Nav", () => ({ Nav: () => <nav aria-label="nav" /> }));
vi.mock("@/components/Footer", () => ({ Footer: () => <footer aria-label="footer" /> }));

const disconnect = vi.fn();
vi.mock("@/store/wallet", () => ({
  useWalletStore: { getState: () => ({ disconnect }) },
}));

describe("PrivacyPage", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    __resetStorageForTests();
    disconnect.mockClear();
    storage.setItem(STORAGE_KEYS.motionPreference.key, "reduce");
    storage.setItem(STORAGE_KEYS.recentChains.key, "[]");
    localStorage.setItem("vortex-legacy-key", "1");
  });

  it("renders the inventory with purposes and flags legacy keys", async () => {
    render(<PrivacyPage />);
    expect(await screen.findByText(STORAGE_KEYS.motionPreference.key)).toBeInTheDocument();
    expect(screen.getByText("Your reduced-motion preference.")).toBeInTheDocument();
    const legacyRow = screen.getByText("vortex-legacy-key").closest("tr")!;
    expect(within(legacyRow).getByText(/Legacy data/)).toBeInTheDocument();
  });

  it("clears a single key", async () => {
    render(<PrivacyPage />);
    await userEvent.click(
      await screen.findByRole("button", { name: `Clear ${STORAGE_KEYS.motionPreference.key}` }),
    );
    expect(localStorage.getItem(STORAGE_KEYS.motionPreference.key)).toBeNull();
    expect(screen.queryByText(STORAGE_KEYS.motionPreference.key)).not.toBeInTheDocument();
  });

  it("requires confirmation, then clears everything and disconnects", async () => {
    render(<PrivacyPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Clear all & disconnect" }));
    expect(disconnect).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Confirm: clear everything" }));
    expect(disconnect).toHaveBeenCalled();
    expect(screen.getByText("Nothing is stored in this browser.")).toBeInTheDocument();
  });

  it("toggles private mode via an accessible switch", async () => {
    render(<PrivacyPage />);
    const toggle = await screen.findByRole("switch", { name: "Private mode" });
    expect(toggle).toHaveAttribute("aria-checked", "false");
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-checked", "true");
    expect(localStorage.getItem(STORAGE_KEYS.recentChains.key)).toBeNull();
  });
});
