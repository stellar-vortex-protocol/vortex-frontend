import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nProvider } from "@/lib/i18n/I18nProvider";
import type { Locale } from "@/lib/i18n";

const { isConnectedMock, requestAccessMock, getNetworkMock, addToastMock } =
  vi.hoisted(() => ({
    isConnectedMock: vi.fn(),
    requestAccessMock: vi.fn(),
    getNetworkMock: vi.fn(),
    addToastMock: vi.fn(),
  }));

vi.mock("@stellar/freighter-api", () => ({
  default: {
    isConnected: isConnectedMock,
    requestAccess: requestAccessMock,
    getNetwork: getNetworkMock,
  },
}));

vi.mock("@/store/toast", () => ({
  useToastStore: { getState: () => ({ addToast: addToastMock }) },
}));

import { useWalletStore } from "@/store/wallet";
import { ConnectWalletButton, freighterInstallUrl } from "./ConnectWalletButton";

const initialState = useWalletStore.getState();

function renderButton(locale: Locale = "en") {
  return render(
    <I18nProvider locale={locale}>
      <ConnectWalletButton />
    </I18nProvider>,
  );
}

describe("ConnectWalletButton", () => {
  beforeEach(() => {
    useWalletStore.setState(initialState, true);
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_NETWORK", "testnet");
  });

  afterEach(() => {
    useWalletStore.setState(initialState, true);
    vi.unstubAllEnvs();
  });

  it("shows a Connect Freighter prompt when disconnected", () => {
    renderButton();
    expect(screen.getByText("Connect Freighter")).toBeInTheDocument();
  });

  it("shows a reconnect prompt with a truncated last-known address after a cleared session", () => {
    useWalletStore.setState({
      isConnected: false,
      address: null,
      lastKnownAddress: "GABCDEFGHIJKLMNOPQRSTUVWXYZ23456",
      wasSessionCleared: true,
    });

    render(<ConnectWalletButton />);

    expect(screen.getByText("Reconnect GABC...3456")).toBeInTheDocument();
  });

  it("connects the wallet and shows the truncated address on click", async () => {
    isConnectedMock.mockResolvedValue(true);
    requestAccessMock.mockResolvedValue("GABCDEFGHIJKLMNOPQRSTUVWXYZ23456");
    getNetworkMock.mockResolvedValue("TESTNET");

    const user = userEvent.setup();
    renderButton();

    await user.click(screen.getByText("Connect Freighter"));

    await waitFor(() => {
      expect(screen.getByText("GABC...3456")).toBeInTheDocument();
    });
  });

  it("disconnects when the connected button is clicked", async () => {
    isConnectedMock.mockResolvedValue(true);
    requestAccessMock.mockResolvedValue("GABCDEFGHIJKLMNOPQRSTUVWXYZ23456");
    getNetworkMock.mockResolvedValue("TESTNET");

    const user = userEvent.setup();
    renderButton();
    await user.click(screen.getByText("Connect Freighter"));
    await waitFor(() => screen.getByText("GABC...3456"));

    await user.click(screen.getByText("GABC...3456"));

    expect(useWalletStore.getState().isConnected).toBe(false);
  });

  it("shows a toast when a direct connect attempt fails", async () => {
    isConnectedMock.mockResolvedValue(false);

    const user = userEvent.setup();
    renderButton();
    await user.click(screen.getByText("Connect Freighter"));

    await waitFor(() => {
      expect(addToastMock).toHaveBeenCalledWith(
        "Freighter extension is not installed or enabled.",
        "error",
      );
    });
  });

  it("surfaces a real (non-undefined) toast message when connect() rejects", async () => {
    isConnectedMock.mockResolvedValue(true);
    requestAccessMock.mockRejectedValue(new Error("User declined access"));

    const user = userEvent.setup();
    renderButton();
    await user.click(screen.getByText("Connect Freighter"));

    await waitFor(() => {
      expect(addToastMock).toHaveBeenCalledWith(
        "The request was declined in Freighter.",
        "error",
      );
    });
    // Regression guard for the original bug: the toast text must never be the
    // string "undefined" (from a missing translation key or an undeclared var).
    for (const [message] of addToastMock.mock.calls) {
      expect(message).toBeTruthy();
      expect(message).not.toBe("undefined");
    }
  });

  it("puts the localised failure text in the retry button's tooltip", async () => {
    isConnectedMock.mockResolvedValue(true);
    requestAccessMock.mockRejectedValue(new Error("User declined access"));

    const user = userEvent.setup();
    renderButton();
    await user.click(screen.getByText("Connect Freighter"));

    const retry = await screen.findByText("Retry Connection");
    expect(retry.closest("button")).toHaveAttribute(
      "title",
      "The request was declined in Freighter.",
    );
  });

  // ── Issue #1: network-mismatch warning ───────────────────────────────────

  it("shows a network-mismatch warning when connected to the wrong network", async () => {
    vi.stubEnv("NEXT_PUBLIC_NETWORK", "testnet");
    isConnectedMock.mockResolvedValue(true);
    requestAccessMock.mockResolvedValue("GABCDEFGHIJKLMNOPQRSTUVWXYZ23456");
    // Freighter is on mainnet but the app expects testnet
    getNetworkMock.mockResolvedValue("MAINNET");

    const user = userEvent.setup();
    render(<ConnectWalletButton />);
    await user.click(screen.getByText("Connect Freighter"));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/wrong network/i);
    });
  });

  it("does not show a network-mismatch warning when connected to the correct network", async () => {
    vi.stubEnv("NEXT_PUBLIC_NETWORK", "testnet");
    isConnectedMock.mockResolvedValue(true);
    requestAccessMock.mockResolvedValue("GABCDEFGHIJKLMNOPQRSTUVWXYZ23456");
    getNetworkMock.mockResolvedValue("TESTNET");

    const user = userEvent.setup();
    render(<ConnectWalletButton />);
    await user.click(screen.getByText("Connect Freighter"));

    await waitFor(() => {
      expect(screen.getByText("GABC...3456")).toBeInTheDocument();
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  // ── Issue #2: not-installed CTA ──────────────────────────────────────────

  it("shows an Install Freighter link (not a retry button) when Freighter is not installed", async () => {
    isConnectedMock.mockResolvedValue(false);

    const user = userEvent.setup();
    render(<ConnectWalletButton />);
    await user.click(screen.getByText("Connect Freighter"));

    await waitFor(() => {
      const link = screen.getByRole("link", { name: /install.*freighter/i });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute("href", "https://www.freighter.app/");
    });
    // The generic "Retry Connection" button must NOT be present
    expect(screen.queryByText("Retry Connection")).not.toBeInTheDocument();
  });

  it("shows Retry Connection for a generic (non-install) failure", async () => {
    isConnectedMock.mockResolvedValue(true);
    requestAccessMock.mockRejectedValue(new Error("User declined access"));

    const user = userEvent.setup();
    render(<ConnectWalletButton />);
    await user.click(screen.getByText("Connect Freighter"));

    await waitFor(() => {
      expect(screen.getByText("Retry Connection")).toBeInTheDocument();
    });
    expect(
      screen.queryByRole("link", { name: /install.*freighter/i }),
    ).not.toBeInTheDocument();
  });

  // ── #417: kind-specific recovery guidance ────────────────────────────────

  it.each([
    ["locked", "Freighter is locked.", "I've unlocked it — retry"],
    ["user-rejected", "The request was declined in Freighter.", "Retry Connection"],
    ["timeout", "Freighter didn't respond in time.", "Retry Connection"],
    ["unsupported-method", "This version of Freighter doesn't support this action.", "Retry Connection"],
    ["unknown", "Failed to connect wallet.", "Retry Connection"],
  ] as const)("renders %s guidance in an alert with a retry action", (kind, message, action) => {
    useWalletStore.setState({
      errorKind: kind,
      errorKey: `wallet.error.${kind}`,
      error: message,
    });
    renderButton();
    expect(screen.getByRole("alert")).toHaveTextContent(message);
    expect(screen.getByRole("button", { name: action })).toBeInTheDocument();
  });

  it("renders localised (es) guidance for a locked wallet", () => {
    useWalletStore.setState({
      errorKind: "locked",
      errorKey: "wallet.error.locked",
      error: "Freighter is locked.",
    });
    renderButton("es");
    expect(screen.getByRole("alert")).toHaveTextContent("Freighter está bloqueado.");
  });

  it("points the install link at the right store for the browser", () => {
    expect(freighterInstallUrl("Mozilla/5.0 (X11) Gecko/20100101 Firefox/130.0")).toMatch(
      /addons\.mozilla\.org/,
    );
    expect(
      freighterInstallUrl("Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/128.0 Safari/537.36"),
    ).toMatch(/chromewebstore/);
    expect(
      freighterInstallUrl("Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1"),
    ).toBe("https://www.freighter.app/");
  });
});
