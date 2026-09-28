import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { useWalletStore, WALLET_ERROR_FALLBACK } from "@/store/wallet";
import { isWalletError } from "@/lib/wallet";
import { classifyFlowError, isAbortError } from "./errors";
import {
  flowReducer,
  INITIAL_FLOW_SNAPSHOT,
  isPendingStatus,
  type FlowErrorKind,
  type FlowStatus,
  type FlowStep,
} from "./machine";

export type FlowRunContext = {
  /** Aborted on cancel(), reset(), unmount or a wallet switch. Pass it to network calls. */
  signal: AbortSignal;
  /**
   * Enters `name` and runs its handler. Throws an AbortError instead of
   * returning if the run was cancelled while the handler was in flight, so a
   * late response can never advance a cancelled flow.
   */
  step: <T>(name: FlowStep, handler: (signal: AbortSignal) => Promise<T> | T) => Promise<T>;
};

export type TransactionFlowConfig<TParams, TResult> = {
  /** The step handlers. Must call `ctx.step` at least once. */
  run: (params: TParams, ctx: FlowRunContext) => Promise<TResult>;
  onSuccess?: (result: TResult, params: TParams) => void;
  onError?: (message: string, kind: FlowErrorKind, err: unknown) => void;
  /** Maps a thrown error to the user-facing message. Defaults to `err.message`. */
  getErrorMessage?: (err: unknown) => string;
  classifyError?: (err: unknown) => FlowErrorKind;
  /** Used when the thrown value carries no message. */
  fallbackMessage?: string;
};

export type TransactionFlow<TParams, TResult> = {
  status: FlowStatus;
  error: string | null;
  errorKind: FlowErrorKind | null;
  errorStep: FlowStep | null;
  isPending: boolean;
  /** Params of the in-flight run, or null when nothing is pending. */
  activeParams: TParams | null;
  /** Starts a run. Resolves to undefined when ignored (double submit), cancelled or failed. */
  start: (params: TParams) => Promise<TResult | undefined>;
  /** User-initiated retry of the last failed run. Never called automatically. */
  retry: () => Promise<TResult | undefined>;
  cancel: () => void;
  reset: () => void;
};

type ActiveRun = { id: number; controller: AbortController };

function abortError(): Error {
  const err = new Error("The operation was aborted.");
  err.name = "AbortError";
  return err;
}

export function useTransactionFlow<TParams, TResult>(
  config: TransactionFlowConfig<TParams, TResult>,
): TransactionFlow<TParams, TResult> {
  const [snapshot, dispatch] = useReducer(flowReducer, INITIAL_FLOW_SNAPSHOT);
  const [activeParams, setActiveParams] = useState<TParams | null>(null);
  const configRef = useRef(config);
  const runRef = useRef<ActiveRun | null>(null);
  const nextRunIdRef = useRef(0);
  const lastParamsRef = useRef<{ params: TParams } | null>(null);

  useEffect(() => {
    configRef.current = config;
  });

  const cancel = useCallback(() => {
    const run = runRef.current;
    if (!run) return;
    runRef.current = null;
    run.controller.abort();
    setActiveParams(null);
    dispatch({ type: "CANCEL" });
  }, []);

  const start = useCallback(async (params: TParams): Promise<TResult | undefined> => {
    // Synchronous double-submit guard (state would be stale inside the same tick).
    if (runRef.current) return undefined;

    const run: ActiveRun = { id: ++nextRunIdRef.current, controller: new AbortController() };
    const { signal } = run.controller;
    runRef.current = run;
    lastParamsRef.current = { params };
    setActiveParams(params);

    const isLive = () => runRef.current === run && !signal.aborted;
    let started = false;

    const step = async <T,>(
      name: FlowStep,
      handler: (signal: AbortSignal) => Promise<T> | T,
    ): Promise<T> => {
      if (!isLive()) throw abortError();
      dispatch(
        started
          ? { type: "ADVANCE", runId: run.id, step: name }
          : { type: "START", runId: run.id, step: name },
      );
      started = true;
      const value = await handler(signal);
      if (!isLive()) throw abortError();
      return value;
    };

    const {
      run: execute,
      onSuccess,
      onError,
      getErrorMessage,
      classifyError = classifyFlowError,
      fallbackMessage = "Something went wrong.",
    } = configRef.current;

    try {
      const result = await execute(params, { signal, step });
      if (!isLive()) return undefined;
      runRef.current = null;
      setActiveParams(null);
      dispatch({ type: "SUCCEED", runId: run.id });
      onSuccess?.(result, params);
      return result;
    } catch (err) {
      // Cancelled runs stay silent: no error state, no toast.
      if (!isLive() || isAbortError(err)) {
        if (runRef.current === run) cancel();
        return undefined;
      }
      runRef.current = null;
      setActiveParams(null);
      // WalletError messages are just the kind (#417); show our own copy.
      const message = getErrorMessage
        ? getErrorMessage(err)
        : isWalletError(err)
          ? WALLET_ERROR_FALLBACK[err.kind]
          : err instanceof Error && err.message
          ? err.message
          : fallbackMessage;
      const kind = classifyError(err);
      dispatch({ type: "FAIL", runId: run.id, error: message, errorKind: kind });
      onError?.(message, kind, err);
      return undefined;
    }
  }, [cancel]);

  const retry = useCallback(async () => {
    if (snapshot.status !== "error" || !lastParamsRef.current) return undefined;
    return start(lastParamsRef.current.params);
  }, [snapshot.status, start]);

  const reset = useCallback(() => {
    cancel();
    dispatch({ type: "RESET" });
  }, [cancel]);

  // Abort in-flight work on unmount. Safe under strict-mode double effects:
  // runs only exist after a user action, never during the mount/unmount probe.
  useEffect(() => () => {
    const run = runRef.current;
    runRef.current = null;
    run?.controller.abort();
  }, []);

  // A wallet switch or disconnect mid-flow invalidates the run. The initial
  // null → address transition caused by the flow's own connect step is not a change.
  useEffect(
    () =>
      useWalletStore.subscribe((state, prev) => {
        if (prev.address && state.address !== prev.address) cancel();
      }),
    [cancel],
  );

  return {
    status: snapshot.status,
    error: snapshot.error,
    errorKind: snapshot.errorKind,
    errorStep: snapshot.errorStep,
    isPending: isPendingStatus(snapshot.status),
    activeParams,
    start,
    retry,
    cancel,
    reset,
  };
}
