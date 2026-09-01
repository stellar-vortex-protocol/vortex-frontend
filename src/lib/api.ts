import type {
  CreateIntentRequest,
  CreateIntentResponse,
  RegisterSolverRequest,
  RegisterSolverResponse,
  SubmitIntentResponse,
  SubmitRegistrationResponse,
} from "./types";

const TIMEOUT_MS = 10_000;

// Validate API_URL at module load time for supply-chain defense
function validateApiUrl(urlString: string): string {
  try {
    const url = new URL(urlString);

    // In production, require https:// for security
    if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
      throw new Error(
        `API_URL must use https:// in production. Got: ${url.protocol}//`
      );
    }

    // Allow http:// in development (localhost)
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new Error(
        `API_URL must use http:// or https://. Got: ${url.protocol}//`
      );
    }

    return urlString;
  } catch (err) {
    if (err instanceof Error && err.message.includes("API_URL must")) {
      throw err;
    }
    throw new Error(
      `NEXT_PUBLIC_API_URL is not a valid URL: "${urlString}". Error: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

const API_URL = validateApiUrl(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000");

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export class TimeoutError extends Error {
  constructor() {
    super("Request timed out. Please try again.");
    this.name = "TimeoutError";
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${API_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new ApiError(body || res.statusText, res.status);
    }

    if (res.status === 204) return undefined as T;
    return res.json() as Promise<T>;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new TimeoutError();
    }
    throw err;
  }
}

export const fetcher = <T>(path: string) => apiFetch<T>(path);

export function createIntent(req: CreateIntentRequest) {
  return apiFetch<CreateIntentResponse>("/intents", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

export function submitIntent(intentId: string, signedXdr: string) {
  return apiFetch<SubmitIntentResponse>(`/intents/${intentId}/submit`, {
    method: "POST",
    body: JSON.stringify({ signedXdr }),
  });
}

export function acceptIntent(intentId: string, solverAddress: string) {
  return apiFetch<SubmitIntentResponse>(`/intents/${intentId}/accept`, {
    method: "POST",
    body: JSON.stringify({ solverAddress }),
  });
}

export function registerSolver(req: RegisterSolverRequest) {
  return apiFetch<RegisterSolverResponse>("/solvers", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

export function submitSolverRegistration(registrationId: string, signedXdr: string) {
  return apiFetch<SubmitRegistrationResponse>(`/solvers/${registrationId}/submit`, {
    method: "POST",
    body: JSON.stringify({ signedXdr }),
  });
}
