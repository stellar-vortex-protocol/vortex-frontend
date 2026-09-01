import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { I18nProvider } from "@/lib/i18n/I18nProvider";
import { Footer } from "./Footer";

describe("Footer", () => {
  it("renders copyright and social links", () => {
    render(<Footer />);
    expect(screen.getByText(/Vortex Protocol/)).toBeInTheDocument();
    expect(screen.getByText("GitHub")).toBeInTheDocument();
    expect(screen.getByText("Discord")).toBeInTheDocument();
  });

  it("renders English copy under an English provider", () => {
    render(
      <I18nProvider locale="en">
        <Footer />
      </I18nProvider>
    );
    expect(screen.getByText("© 2025 Vortex Protocol · MIT License")).toBeInTheDocument();
  });

  it("renders Spanish copy under a Spanish provider", () => {
    render(
      <I18nProvider locale="es">
        <Footer />
      </I18nProvider>
    );
    expect(screen.getByText("© 2025 Vortex Protocol · Licencia MIT")).toBeInTheDocument();
  });
});
