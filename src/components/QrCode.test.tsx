import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { encodeQrSvg } from "@/lib/qrCode";
import { QrCode } from "./QrCode";

// ── Utility tests ────────────────────────────────────────────────────────────

describe("encodeQrSvg", () => {
  it("returns a valid SVG string for a Stellar G-address (56 chars)", () => {
    const svg = encodeQrSvg("GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5");
    expect(svg).toMatch(/^<svg /);
    expect(svg).toContain('role="img"');
    expect(svg).toContain("</svg>");
  });

  it("returns a valid SVG string for a short test string", () => {
    const svg = encodeQrSvg("HELLO");
    expect(svg).toMatch(/^<svg /);
    expect(svg).toContain("<rect");
    expect(svg).toContain("</svg>");
  });

  it("produces different SVG output for different inputs", () => {
    const a = encodeQrSvg("GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5");
    const b = encodeQrSvg("GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGKM0JLZWH0M0Q5O8N1BXU");
    expect(a).not.toBe(b);
  });

  it("throws if the input exceeds version-10 capacity", () => {
    expect(() => encodeQrSvg("A".repeat(300))).toThrow();
  });

  it("respects the size option in the SVG viewBox", () => {
    const svg = encodeQrSvg("TEST", { size: 300 });
    expect(svg).toContain('width="300"');
    expect(svg).toContain('height="300"');
  });
});

// ── Component tests ──────────────────────────────────────────────────────────

describe("QrCode component", () => {
  const defaultProps = {
    value: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
    label: "Stellar address GBBD...LA5",
  };

  it("renders a show-QR toggle button initially", () => {
    render(<QrCode {...defaultProps} />);
    expect(screen.getByRole("button", { name: /Show QR code/i })).toBeInTheDocument();
  });

  it("does not render the QR image before the toggle is clicked", () => {
    render(<QrCode {...defaultProps} />);
    expect(screen.queryByLabelText(defaultProps.label)).not.toBeInTheDocument();
  });

  it("shows the QR code after clicking the toggle", async () => {
    const user = userEvent.setup();
    render(<QrCode {...defaultProps} />);
    await user.click(screen.getByRole("button", { name: /Show QR code/i }));
    expect(screen.getByLabelText(defaultProps.label)).toBeInTheDocument();
  });

  it("hides the QR code after clicking the toggle a second time", async () => {
    const user = userEvent.setup();
    render(<QrCode {...defaultProps} />);
    const btn = screen.getByRole("button", { name: /Show QR code/i });
    await user.click(btn);
    expect(screen.getByLabelText(defaultProps.label)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Hide QR code/i }));
    expect(screen.queryByLabelText(defaultProps.label)).not.toBeInTheDocument();
  });

  it("sets aria-expanded correctly on the toggle button", async () => {
    const user = userEvent.setup();
    render(<QrCode {...defaultProps} />);
    const btn = screen.getByRole("button", { name: /Show QR code/i });
    expect(btn).toHaveAttribute("aria-expanded", "false");
    await user.click(btn);
    expect(screen.getByRole("button", { name: /Hide QR code/i })).toHaveAttribute("aria-expanded", "true");
  });
});
