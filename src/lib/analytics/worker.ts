/**
 * Web Worker glue for analytics aggregation.
 *
 * The worker wraps the same incremental aggregator used by the synchronous
 * `computeAnalytics` path so that both code paths stay equivalent. The main
 * thread talks to it over a small typed message protocol:
 *
 *   main -> worker: { type: 'init', id, intents, options }
 *                   { type: 'apply', id, delta }
 *                   { type: 'snapshot', id }
 *   worker -> main: { type: 'result', id, snapshot }
 *                   { type: 'error', id, message }
 *
 * Keeping the protocol tiny keeps the worker glue well under the 10 KB gz
 * budget called out in the issue.
 */

import {
  AnalyticsAggregator,
  type AnalyticsDelta,
  type AnalyticsOptions,
  type AnalyticsSnapshot,
  type IntentLike,
} from './aggregator';

/** Messages the main thread can post to the worker. */
export type AnalyticsWorkerRequest =
  | { type: 'init'; id: number; intents: IntentLike[]; options?: AnalyticsOptions }
  | { type: 'apply'; id: number; delta: AnalyticsDelta }
  | { type: 'snapshot'; id: number };

/** Messages the worker posts back to the main thread. */
export type AnalyticsWorkerResponse =
  | { type: 'result'; id: number; snapshot: AnalyticsSnapshot }
  | { type: 'error'; id: number; message: string };

/**
 * Minimal structural type for the worker global scope. Declared locally so the
 * module can be imported from the main thread (for the message types) without
 * pulling in the DOM `Worker` lib types or `webworker` lib types.
 */
interface WorkerScope {
  onmessage: ((event: { data: AnalyticsWorkerRequest }) => void) | null;
  postMessage(message: AnalyticsWorkerResponse): void;
}

let aggregator: AnalyticsAggregator | null = null;

function handle(request: AnalyticsWorkerRequest): AnalyticsSnapshot {
  switch (request.type) {
    case 'init': {
      aggregator = new AnalyticsAggregator(request.options);
      aggregator.add(request.intents);
      return aggregator.snapshot();
    }
    case 'apply': {
      if (!aggregator) {
        aggregator = new AnalyticsAggregator();
      }
      aggregator.apply(request.delta);
      return aggregator.snapshot();
    }
    case 'snapshot': {
      if (!aggregator) {
        aggregator = new AnalyticsAggregator();
      }
      return aggregator.snapshot();
    }
    default: {
      // Exhaustiveness guard: unknown message types are rejected by the caller.
      const exhaustive: never = request;
      throw new Error(`Unknown analytics worker request: ${String(exhaustive)}`);
    }
  }
}

const scope = self as unknown as WorkerScope;

scope.onmessage = (event) => {
  const request = event.data;
  try {
    const snapshot = handle(request);
    scope.postMessage({ type: 'result', id: request.id, snapshot });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    scope.postMessage({ type: 'error', id: request.id, message });
  }
};
