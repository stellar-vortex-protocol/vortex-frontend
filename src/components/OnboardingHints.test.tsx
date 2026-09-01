import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OnboardingHints } from "./OnboardingHints";

const STORAGE_KEY = "vortex-onboarding-seen";

function Fixture({ withTargets = true }: { withTargets?: boolean }) {
  return (
    <>
      {withTargets && (
        <>
          <div id="swap-card-region">swap</div>
          <div id="live-feed-region">feed</div>
          <a id="solver-portal-link" href="/solve">
            solver
          </a>
        </>
      )}
      <OnboardingHints />
    </>
  );
}

describe("OnboardingHints", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("shows the first step on a genuine first visit", () => {
    render(<Fixture />);
    expect(screen.getByRole("dialog", { name: "Start a swap here" })).toBeInTheDocument();
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
  });

  it("does not show for a returning visitor", () => {
    localStorage.setItem(STORAGE_KEY, "1");
    render(<Fixture />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does not start if a target element is missing", () => {
    render(<Fixture withTargets={false} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("steps forward and back, then finishes - persisting the dismissal", async () => {
    const user = userEvent.setup();
    render(<Fixture />);

    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("dialog", { name: "Watch it settle live" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("dialog", { name: "Start a swap here" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Done" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(localStorage.getItem(STORAGE_KEY)).toBe("1");
  });

  it("is skippable at any step and stays dismissed", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<Fixture />);

    await user.click(screen.getByRole("button", { name: "Skip" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(localStorage.getItem(STORAGE_KEY)).toBe("1");

    unmount();
    render(<Fixture />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    render(<Fixture />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(localStorage.getItem(STORAGE_KEY)).toBe("1");
  });
});
