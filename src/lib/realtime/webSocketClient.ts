/**
 * Framework-agnostic WebSocket connection state machine.
 *
 * States: idle → connecting → open → (backoff → connecting)* → unavailable
 * `closed` is terminal until `connect()`/`reconnect()` is called again.
 *
 * All environment dependencies (WebSocket constructor, timers, clock, random)
 * are injectable so reconnect schedules can be asserted deterministically.
 */

export type ConnectionState =
  | "idle"
  | "connecting"
  | "open"
  | "backoff"
  | "unavailable"
  | "closed";

export interface WebSocketLike {
  onopen: ((ev?: unknown) => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
  onerror: ((ev?: unknown) => void) | null;
  onclose: ((ev?: { code?: number }) => void) | null;
  close(code?: number): void;
  send?(data: string): void;
}

export type WebSocketCtor = new (url: string) => WebSocketLike;

export interface WebSocketClientOptions {
  WebSocketImpl?: WebSocketCtor;
  setTimeout?: (fn: () => void, ms: number) => unknown;
  clearTimeout?: (id: unknown) => void;
  now?: () => number;
  random?: () => number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  maxAttempts?: number;
  /** Fraction of the delay used as ± jitter. */
  jitter?: number;
  /** An open connection must survive this long before attempts reset. */
  stableAfterMs?: number;
  /** Reconnect when no message arrives within this window (0 disables). */
  heartbeatTimeoutMs?: number;
}

export const DEFAULTS = {
  initialDelayMs: 3000,
  maxDelayMs: 60000,
  maxAttempts: 10,
  jitter: 0.2,
  stableAfterMs: 10000,
  heartbeatTimeoutMs: 45000,
} as const;

/** Close codes that indicate the server rejected us; don't hammer it. */
const FATAL_CLOSE_CODES = new Set([1008, 1003]);

type StateListener = (state: ConnectionState) => void;
type MessageListener = (data: unknown) => void;

export class WebSocketClient {
  private state: ConnectionState = "idle";
  private socket: WebSocketLike | null = null;
  private attempts = 0;
  private backoffTimer: unknown = null;
  private stableTimer: unknown = null;
  private heartbeatTimer: unknown = null;
  private paused = false;
  private readonly stateListeners = new Set<StateListener>();
  private readonly messageListeners = new Set<MessageListener>();
  private readonly opts: Required<WebSocketClientOptions>;

  constructor(
    readonly url: string,
    options: WebSocketClientOptions = {},
  ) {
    this.opts = {
      WebSocketImpl:
        options.WebSocketImpl ?? (globalThis.WebSocket as unknown as WebSocketCtor),
      setTimeout: options.setTimeout ?? ((fn, ms) => globalThis.setTimeout(fn, ms)),
      clearTimeout:
        options.clearTimeout ??
        ((id) => globalThis.clearTimeout(id as ReturnType<typeof setTimeout>)),
      now: options.now ?? (() => Date.now()),
      random: options.random ?? Math.random,
      initialDelayMs: options.initialDelayMs ?? DEFAULTS.initialDelayMs,
      maxDelayMs: options.maxDelayMs ?? DEFAULTS.maxDelayMs,
      maxAttempts: options.maxAttempts ?? DEFAULTS.maxAttempts,
      jitter: options.jitter ?? DEFAULTS.jitter,
      stableAfterMs: options.stableAfterMs ?? DEFAULTS.stableAfterMs,
      heartbeatTimeoutMs: options.heartbeatTimeoutMs ?? DEFAULTS.heartbeatTimeoutMs,
    };
  }

  getState(): ConnectionState {
    return this.state;
  }

  getAttempts(): number {
    return this.attempts;
  }

  onState(listener: StateListener): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  onMessage(listener: MessageListener): () => void {
    this.messageListeners.add(listener);
    return () => this.messageListeners.delete(listener);
  }

  /** Start connecting if idle/closed. No-op while already active. */
  connect(): void {
    if (this.state === "connecting" || this.state === "open" || this.state === "backoff") {
      return;
    }
    this.openSocket();
  }

  /** Manual retry (e.g. from the `unavailable` state); resets attempts. */
  reconnect(): void {
    this.attempts = 0;
    this.teardownSocket();
    this.clearTimers();
    this.openSocket();
  }

  /** Stop reconnecting while offline; `resume()` retries immediately. */
  pause(): void {
    this.paused = true;
    this.clearTimers();
    this.teardownSocket();
    this.setState("backoff");
  }

  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    this.reconnect();
  }

  /** Permanently close; removes socket listeners and timers. */
  close(): void {
    this.paused = false;
    this.clearTimers();
    this.teardownSocket();
    this.setState("closed");
  }

  send(data: unknown): boolean {
    if (this.state !== "open" || !this.socket?.send) return false;
    this.socket.send(JSON.stringify(data));
    return true;
  }

  private openSocket(): void {
    if (this.attempts >= this.opts.maxAttempts) {
      this.setState("unavailable");
      return;
    }
    this.setState("connecting");
    const socket = new this.opts.WebSocketImpl(this.url);
    this.socket = socket;

    socket.onopen = () => {
      if (socket !== this.socket) return;
      this.setState("open");
      this.armHeartbeat();
      this.stableTimer = this.opts.setTimeout(() => {
        this.stableTimer = null;
        this.attempts = 0;
      }, this.opts.stableAfterMs);
    };

    socket.onmessage = (event) => {
      if (socket !== this.socket) return;
      this.armHeartbeat();
      let parsed: unknown;
      try {
        parsed = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
      } catch {
        return; // Ignore malformed frames rather than crashing the feed.
      }
      this.messageListeners.forEach((l) => l(parsed));
    };

    socket.onerror = () => {
      // onclose always follows; state transitions happen there.
    };

    socket.onclose = (event) => {
      // Late close events from sockets we already replaced are ignored.
      if (socket !== this.socket) return;
      this.socket = null;
      this.clearTimers();
      if (event?.code !== undefined && FATAL_CLOSE_CODES.has(event.code)) {
        this.setState("unavailable");
        return;
      }
      this.scheduleReconnect();
    };
  }

  private scheduleReconnect(): void {
    if (this.paused) return;
    if (this.attempts >= this.opts.maxAttempts) {
      this.setState("unavailable");
      return;
    }
    this.setState("backoff");
    const delay = this.nextDelay();
    this.attempts += 1;
    this.backoffTimer = this.opts.setTimeout(() => {
      this.backoffTimer = null;
      this.openSocket();
    }, delay);
  }

  /** Exponential delay with ± jitter for the current attempt count. */
  nextDelay(): number {
    const base = Math.min(this.opts.initialDelayMs * 2 ** this.attempts, this.opts.maxDelayMs);
    const jitter = (this.opts.random() - 0.5) * 2 * base * this.opts.jitter;
    return Math.max(0, Math.round(base + jitter));
  }

  private armHeartbeat(): void {
    if (!this.opts.heartbeatTimeoutMs) return;
    if (this.heartbeatTimer !== null) this.opts.clearTimeout(this.heartbeatTimer);
    this.heartbeatTimer = this.opts.setTimeout(() => {
      // Half-open connection: nothing heard for too long, force a reconnect.
      this.heartbeatTimer = null;
      this.teardownSocket();
      this.clearTimers();
      this.scheduleReconnect();
    }, this.opts.heartbeatTimeoutMs);
  }

  private teardownSocket(): void {
    const socket = this.socket;
    if (!socket) return;
    this.socket = null;
    socket.onopen = null;
    socket.onmessage = null;
    socket.onerror = null;
    socket.onclose = null;
    try {
      socket.close(1000);
    } catch {
      // Closing a socket that never opened can throw in some browsers.
    }
  }

  private clearTimers(): void {
    for (const t of [this.backoffTimer, this.stableTimer, this.heartbeatTimer]) {
      if (t !== null) this.opts.clearTimeout(t);
    }
    this.backoffTimer = this.stableTimer = this.heartbeatTimer = null;
  }

  private setState(next: ConnectionState): void {
    if (next === this.state) return;
    this.state = next;
    this.stateListeners.forEach((l) => l(next));
  }
}
