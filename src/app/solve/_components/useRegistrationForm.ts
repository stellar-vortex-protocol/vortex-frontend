import { useCallback, useEffect, useReducer } from "react";
import { useLocalStorageDraft } from "@/hooks/useLocalStorageDraft";
import { isValidStellarPublicKey } from "@/lib/stellarAddress";
import { useTranslation } from "@/lib/i18n/I18nProvider";
import { useWalletStore } from "@/store/wallet";

export const MIN_BOND_USDC = 50;
const DRAFT_KEY = "vortex:solver-registration-draft";

type RegistrationDraft = { address: string; bond: string };

type FormState = RegistrationDraft & { submitted: boolean };

type FormAction =
  | { type: "address"; value: string }
  | { type: "bond"; value: string }
  | { type: "submit" }
  | { type: "reset" }
  | { type: "restore"; draft: RegistrationDraft };

const INITIAL: FormState = { address: "", bond: "", submitted: false };

export function registrationReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case "address":
      return { ...state, address: action.value };
    case "bond":
      return { ...state, bond: action.value };
    case "submit":
      return { ...state, submitted: true };
    case "reset":
      return INITIAL;
    case "restore":
      return { ...state, ...action.draft };
  }
}

/** Owns the solver registration form: field state, validation and draft persistence. */
export function useRegistrationForm() {
  const { t } = useTranslation();
  // Draft is scoped to the connected wallet so switching wallets never restores the wrong address.
  const connectedAddress = useWalletStore((s) => s.address);
  const [draft, setDraft, clearDraft] = useLocalStorageDraft<RegistrationDraft>(DRAFT_KEY, connectedAddress ?? null);
  const [state, dispatch] = useReducer(registrationReducer, INITIAL);

  useEffect(() => {
    if (draft) dispatch({ type: "restore", draft });
    // Restore only when the draft source (wallet) changes, not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- draft identity changes on each save
  }, [connectedAddress]);

  const setAddress = useCallback(
    (value: string) => {
      dispatch({ type: "address", value });
      setDraft({ address: value, bond: state.bond });
    },
    [setDraft, state.bond],
  );
  const setBond = useCallback(
    (value: string) => {
      dispatch({ type: "bond", value });
      setDraft({ address: state.address, bond: value });
    },
    [setDraft, state.address],
  );

  const { address, bond, submitted } = state;
  const addressError =
    (address && !isValidStellarPublicKey(address)) || (!address && submitted)
      ? t("solve.register.validation.invalidAddress")
      : null;
  const bondNum = Number(bond);
  const bondError =
    (bond && (!Number.isFinite(bondNum) || bondNum < MIN_BOND_USDC)) || (!bond && submitted)
      ? t("solve.register.validation.minimumBond", { minBond: MIN_BOND_USDC })
      : null;

  return {
    address,
    bond,
    addressError,
    bondError,
    isValid: Boolean(address && bond && !addressError && !bondError),
    setAddress,
    setBond,
    markSubmitted: useCallback(() => dispatch({ type: "submit" }), []),
    reset: useCallback(() => {
      dispatch({ type: "reset" });
      clearDraft();
    }, [clearDraft]),
  };
}
