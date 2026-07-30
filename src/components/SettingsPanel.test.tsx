import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nProvider } from "@/lib/i18n/I18nProvider";
import { SettingsPanel } from "./SettingsPanel";

function renderSettingsPanel() {
  return render(
    <I18nProvider locale="en">
      <SettingsPanel />
    </I18nProvider>
  );
}

describe("SettingsPanel", () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.motion;
  });

  it("opens and shows locale and motion controls", async () => {
    const user = userEvent.setup();
    renderSettingsPanel();

    await user.click(screen.getByRole("button", { name: "Settings" }));

    expect(screen.getByRole("combobox", { name: /switch language/i })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /motion preference/i })).toBeInTheDocument();
  });

  it("updates shared locale state", async () => {
    const user = userEvent.setup();
    renderSettingsPanel();

    await user.click(screen.getByRole("button", { name: "Settings" }));
    const select = screen.getByRole("combobox", { name: /switch language/i });
    await user.selectOptions(select, "es");

    expect((select as HTMLSelectElement).value).toBe("es");
  });

  it("persists and applies the reduced-motion override", async () => {
    const user = userEvent.setup();
    renderSettingsPanel();

    await user.click(screen.getByRole("button", { name: "Settings" }));
    const select = screen.getByRole("combobox", { name: /motion preference/i });
    await user.selectOptions(select, "reduce");

    expect((select as HTMLSelectElement).value).toBe("reduce");
    expect(document.documentElement.dataset.motion).toBe("reduce");
    expect(localStorage.getItem("vortex-motion-preference")).toBe("reduce");
  });
});
