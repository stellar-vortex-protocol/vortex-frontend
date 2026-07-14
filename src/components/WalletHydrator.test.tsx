import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

const { hydrateMock } = vi.hoisted(() => ({ hydrateMock: vi.fn() }));

vi.mock("@/store/wallet", () => ({
  useWalletStore: { getState: () => ({ hydrate: hydrateMock }) },
}));

import { WalletHydrator } from "./WalletHydrator";

describe("WalletHydrator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("triggers a wallet session hydration on mount and renders nothing", () => {
    const { container } = render(<WalletHydrator />);
    expect(hydrateMock).toHaveBeenCalledTimes(1);
    expect(container).toBeEmptyDOMElement();
  });
});
