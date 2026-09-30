"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useWalletStore } from "@/store/wallet";
import { useToastStore } from "@/store/toast";
import { useSolvers } from "@/hooks/useSolvers";
import { useSetLocale, useTranslation } from "@/lib/i18n/I18nProvider";
import { LOCALES } from "@/lib/i18n";
import { useRegisterCommands, type CommandDefinition } from "@/lib/commands/registry";

// Shared with SettingsPanel so both controls read and write the same preference.
const MOTION_KEY = "vortex-motion-preference";
// Hundreds of solvers would swamp the palette; the top entries by the relay's order are enough.
const MAX_SOLVER_COMMANDS = 50;

function applyMotion(reduce: boolean) {
  document.documentElement.dataset["motion"] = reduce ? "reduce" : "allow";
}

/** Registers the palette's built-in wallet, preference and solver commands. */
export function BuiltinCommands() {
  const router = useRouter();
  const { t, locale } = useTranslation();
  const setLocale = useSetLocale();
  const address = useWalletStore((state) => state.address);
  const connect = useWalletStore((state) => state.connect);
  const disconnect = useWalletStore((state) => state.disconnect);
  const addToast = useToastStore((state) => state.addToast);
  const { solvers } = useSolvers();
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(MOTION_KEY);
    } catch {
      // Storage unavailable — keep the system default.
    }
    setReduceMotion(stored === "reduce");
    if (stored === "reduce" || stored === "allow") applyMotion(stored === "reduce");
  }, []);

  const commands = useMemo<CommandDefinition[]>(() => {
    const connected = () => Boolean(address);
    const list: CommandDefinition[] = [
      {
        id: "wallet-connect",
        title: t("commands.wallet.connect"),
        keywords: ["wallet", "freighter", "login"],
        group: "Wallet",
        when: () => !connected(),
        run: connect,
      },
      {
        id: "wallet-disconnect",
        title: t("commands.wallet.disconnect"),
        keywords: ["wallet", "logout", "sign out"],
        group: "Wallet",
        when: connected,
        dangerous: true,
        run: disconnect,
      },
      {
        id: "wallet-copy",
        title: t("commands.wallet.copy"),
        keywords: ["wallet", "address", "clipboard"],
        group: "Wallet",
        when: connected,
        run: async () => {
          if (!address) return;
          try {
            await navigator.clipboard.writeText(address);
            addToast(t("commands.wallet.copied"), "success");
          } catch {
            addToast(t("commands.wallet.copyFailed"), "error");
          }
        },
      },
      {
        id: "pref-motion",
        title: reduceMotion ? t("commands.motion.enable") : t("commands.motion.reduce"),
        keywords: ["motion", "animation", "accessibility"],
        group: "Preferences",
        run: () => {
          const next = !reduceMotion;
          setReduceMotion(next);
          applyMotion(next);
          try {
            window.localStorage.setItem(MOTION_KEY, next ? "reduce" : "allow");
          } catch {
            // Preference still applies for this session.
          }
        },
      },
      {
        id: "nav-my-intents",
        title: t("commands.openMyIntents"),
        keywords: ["history", "mine"],
        group: "Navigation",
        hint: "/my-intents",
        run: () => router.push("/my-intents"),
      },
      ...LOCALES.filter((l) => l !== locale).map<CommandDefinition>((l) => ({
        id: `pref-locale-${l}`,
        title: t("commands.locale", { locale: l.toUpperCase() }),
        keywords: ["language", "idioma", "locale", l],
        group: "Preferences",
        run: () => setLocale(l),
      })),
      ...solvers.slice(0, MAX_SOLVER_COMMANDS).map<CommandDefinition>((solver) => ({
        id: `solver-${solver.address}`,
        title: t("commands.viewSolver", { name: solver.name }),
        keywords: [solver.address, "solver"],
        group: "Solvers",
        run: () => router.push(`/solve/${solver.address}`),
      })),
    ];
    return list;
  }, [address, addToast, connect, disconnect, locale, reduceMotion, router, setLocale, solvers, t]);

  useRegisterCommands(commands);
  return null;
}
