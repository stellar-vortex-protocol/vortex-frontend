export type SimulationResult = { minResourceFee: string; inclusionFee: string; footprint: { read: string[]; write: string[] }; auth: unknown[]; error?: string };
export class SimulationError extends Error { constructor(message: string, public readonly kind: "unavailable" | "contract" | "timeout" = "contract") { super(message); this.name = "SimulationError"; } }
export async function simulateTransaction(unsignedXdr: string, signal?: AbortSignal): Promise<SimulationResult> {
  const url = process.env.NEXT_PUBLIC_SOROBAN_RPC_URL;
  if (!url) throw new SimulationError("Simulation is unavailable for this network.", "unavailable");
  const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "simulateTransaction", params: [{ transaction: unsignedXdr }] }), signal });
  if (!response.ok) throw new SimulationError(`Simulation failed (${response.status}).`);
  const body = await response.json() as { error?: { message?: string }; result?: { minResourceFee?: string; events?: string[]; transactionData?: string; auth?: unknown[] } };
  if (body.error) throw new SimulationError(body.error.message ?? "The contract rejected this transaction.");
  return { minResourceFee: body.result?.minResourceFee ?? "0", inclusionFee: "0", footprint: { read: [], write: [] }, auth: body.result?.auth ?? [] };
}
