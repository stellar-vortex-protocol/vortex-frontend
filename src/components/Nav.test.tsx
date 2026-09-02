import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nProvider } from "@/lib/i18n/I18nProvider";
import { useWalletStore } from "@/store/wallet";
import { Nav } from "./Nav";

const initialWalletState = useWalletStore.getState();

/** Wrap Nav in I18nProvider so locale context is available. */
function renderNav(props: Parameters<typeof Nav>[0]) {
  return render(<I18nProvider locale="en"><Nav {...props} /></I18nProvider>);
}

describe("Nav", () => {
  beforeEach(() => {
    useWalletStore.setState(initialWalletState, true);
  });

  it("renders the full link nav for the home variant", () => {
    renderNav({ variant: "home" });
    expect(screen.getByText("Explore")).toBeInTheDocument();
    expect(screen.getByText("Become a Solver")).toBeInTheDocument();
    expect(screen.getByText("Contributors")).toBeInTheDocument();
    expect(screen.getByText("Connect Freighter")).toBeInTheDocument();
  });

  it("does not render My Intents link when wallet is disconnected", () => {
    renderNav({ variant: "home" });
    expect(screen.queryByText("My Intents")).not.toBeInTheDocument();
  });

  it("renders My Intents link when wallet is connected", () => {
    useWalletStore.setState({ isConnected: true });
    renderNav({ variant: "home" });
    expect(
      screen.getByRole("link", { name: "My Intents" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "My Intents" })).toHaveAttribute(
      "href",
      "/my-intents",
    );
  });

  it("renders a breadcrumb for non-home variants", () => {
    renderNav({ variant: "breadcrumb", label: "Solver Portal" });
    expect(screen.getByText("Solver Portal")).toBeInTheDocument();
    expect(screen.queryByText("Explore")).not.toBeInTheDocument();
  });

  it("does not render a mobile menu toggle for the breadcrumb variant", () => {
    renderNav({ variant: "breadcrumb", label: "Solver Portal" });
    expect(screen.queryByLabelText("Open menu")).not.toBeInTheDocument();
  });

  describe("settings panel", () => {
    it("opens the preferences panel from the nav", async () => {
      const user = userEvent.setup();
      renderNav({ variant: "home" });

      expect(
        screen.queryByRole("combobox", { name: /switch language/i }),
      ).not.toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Settings" }));

      expect(
        screen.getByRole("combobox", { name: /switch language/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("combobox", { name: /motion preference/i }),
      ).toBeInTheDocument();
    });

    it("defaults to the locale provided by I18nProvider", async () => {
      const user = userEvent.setup();
      renderNav({ variant: "home" });

      await user.click(screen.getByRole("button", { name: "Settings" }));
      const select = screen.getByRole("combobox", { name: /switch language/i });
      expect((select as HTMLSelectElement).value).toBe("en");
    });

    it("lists all available locales as options", async () => {
      const user = userEvent.setup();
      renderNav({ variant: "home" });

      await user.click(screen.getByRole("button", { name: "Settings" }));
      const options = screen.getAllByRole("option");
      const values = options.map((o) => (o as HTMLOptionElement).value);
      expect(values).toContain("en");
      expect(values).toContain("es");
    });

    it("switches locale when a new option is selected", async () => {
      const user = userEvent.setup();
      renderNav({ variant: "home" });

      await user.click(screen.getByRole("button", { name: "Settings" }));
      const select = screen.getByRole("combobox", { name: /switch language/i });
      await user.selectOptions(select, "es");

      expect((select as HTMLSelectElement).value).toBe("es");
    });

    it("updates the reduced motion override", async () => {
      const user = userEvent.setup();
      renderNav({ variant: "home" });

      await user.click(screen.getByRole("button", { name: "Settings" }));
      const select = screen.getByRole("combobox", {
        name: /motion preference/i,
      });
      await user.selectOptions(select, "reduce");

      expect((select as HTMLSelectElement).value).toBe("reduce");
      expect(document.documentElement.dataset["motion"]).toBe("reduce");
    });

    it("also renders settings in the breadcrumb variant", async () => {
      const user = userEvent.setup();
      renderNav({ variant: "breadcrumb", label: "Solver Portal" });

      await user.click(screen.getByRole("button", { name: "Settings" }));
      expect(
        screen.getByRole("combobox", { name: /switch language/i }),
      ).toBeInTheDocument();
    });
  });

  describe("mobile menu (home variant)", () => {
    it("is closed by default and opens on toggle", async () => {
      const user = userEvent.setup();
      renderNav({ variant: "home" });

      const toggle = screen.getByLabelText("Open menu");
      expect(toggle).toHaveAttribute("aria-expanded", "false");
      expect(screen.getAllByText("Explore")).toHaveLength(1);

      await user.click(toggle);

      expect(screen.getByLabelText("Close menu")).toHaveAttribute(
        "aria-expanded",
        "true",
      );
      expect(screen.getAllByText("Explore")).toHaveLength(2);
    });

    it("closes when a link in the panel is clicked", async () => {
      const user = userEvent.setup();
      renderNav({ variant: "home" });

      await user.click(screen.getByLabelText("Open menu"));
      const links = screen.getAllByText("Explore");
      const lastLink = links[links.length - 1];
      if (lastLink) {
        await user.click(lastLink);
      }

      expect(screen.getByLabelText("Open menu")).toBeInTheDocument();
      expect(screen.getAllByText("Explore")).toHaveLength(1);
    });

    it("includes My Intents link in mobile menu when wallet is connected", async () => {
      useWalletStore.setState({ isConnected: true });
      const user = userEvent.setup();
      renderNav({ variant: "home" });

      await user.click(screen.getByLabelText("Open menu"));

      expect(screen.getAllByRole("link", { name: "My Intents" })).toHaveLength(
        2,
      );
    });

    it("closes menu when My Intents is clicked", async () => {
      useWalletStore.setState({ isConnected: true });
      const user = userEvent.setup();
      renderNav({ variant: "home" });

      await user.click(screen.getByLabelText("Open menu"));
      const mobileMyIntentsLink = screen.getAllByRole("link", { name: "My Intents" })[1]!;
      await user.click(mobileMyIntentsLink);

      expect(screen.getByLabelText("Open menu")).toBeInTheDocument();
    });
  });
});
