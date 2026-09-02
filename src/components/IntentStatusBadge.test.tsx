import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { IntentStatus } from "@/lib/types";
import { IntentStatusBadge } from "./IntentStatusBadge";

const STATUSES: IntentStatus[] = ["pending", "accepted", "filled", "failed"];

describe("IntentStatusBadge", () => {
  it.each(STATUSES)(
    "exposes the %s status as text, not just color",
    (status) => {
      render(<IntentStatusBadge status={status} />);
      expect(screen.getByText(status)).toBeInTheDocument();
    },
  );

  it("pairs each status with a distinct, decorative icon so colorblind users don't rely on color alone", () => {
    const rendered = STATUSES.map((status) => {
      const { container, unmount } = render(
        <IntentStatusBadge status={status} />,
      );
      const icon = container.querySelector("svg");
      expect(icon).toHaveAttribute("aria-hidden", "true");
      const shape = icon?.innerHTML ?? "";
      unmount();
      return shape;
    });

    expect(new Set(rendered).size).toBe(STATUSES.length);
  });
});
