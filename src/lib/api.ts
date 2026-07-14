import type {
  CreateIntentRequest,
  CreateIntentResponse,
  RegisterSolverRequest,
  RegisterSolverResponse,
  SubmitIntentResponse,
  SubmitRegistrationResponse,
} from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new ApiError(body || res.statusText, res.status);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
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
