import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useToastStore } from "@/store/toast";
import { ToastViewport } from "./ToastViewport";

const initialState = useToastStore.getState();

describe("ToastViewport", () => {
  beforeEach(() => {
    useToastStore.setState(initialState, true);
  });

  afterEach(() => {
    useToastStore.setState(initialState, true);
  });

  it("renders nothing when there are no toasts", () => {
    const { container } = render(<ToastViewport />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders a toast's message", () => {
    useToastStore.getState().addToast("Swap submitted", "success");
    render(<ToastViewport />);
    expect(screen.getByText("Swap submitted")).toBeInTheDocument();
  });

  it("renders multiple toasts", () => {
    useToastStore.getState().addToast("First");
    useToastStore.getState().addToast("Second");
    render(<ToastViewport />);
    expect(screen.getByText("First")).toBeInTheDocument();
    expect(screen.getByText("Second")).toBeInTheDocument();
  });

  it("dismisses a toast when its close button is clicked", async () => {
    useToastStore.getState().addToast("Dismiss me");
    const user = userEvent.setup();
    render(<ToastViewport />);

    await user.click(screen.getByLabelText("Dismiss notification"));

    expect(screen.queryByText("Dismiss me")).not.toBeInTheDocument();
  });
});
