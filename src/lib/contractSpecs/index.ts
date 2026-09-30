export type ContractSpec = { contractId: string; functions: Record<string, string[]> };
export const settlementSpec: ContractSpec = { contractId: process.env.NEXT_PUBLIC_SETTLEMENT_CONTRACT ?? "", functions: { create_intent: ["source", "amount", "destination"], settle: ["intent_id"] } };
export const solverRegistrySpec: ContractSpec = { contractId: process.env.NEXT_PUBLIC_SOLVER_REGISTRY_CONTRACT ?? "", functions: { register: ["solver", "bond"], unregister: ["solver"] } };
export const contractSpecs = [settlementSpec, solverRegistrySpec];
