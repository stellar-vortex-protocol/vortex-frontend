import { describe, expect, it } from "vitest";
import { config, loadConfig } from "./config";

const CONTRACT = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

type Row = {
  name: string;
  value: string | undefined;
  production: boolean;
  /** Expected config key and value, or the start of the expected error. */
  expected: { key: keyof ReturnType<typeof loadConfig>; value: string | null } | { error: string };
};

// Every variable × (valid, missing, malformed, production-vs-dev).
const rows: Row[] = [
  // NEXT_PUBLIC_API_URL
  { name: "NEXT_PUBLIC_API_URL", value: "https://relay.example.com/", production: true, expected: { key: "apiUrl", value: "https://relay.example.com" } },
  { name: "NEXT_PUBLIC_API_URL", value: undefined, production: false, expected: { key: "apiUrl", value: "http://localhost:4000" } },
  { name: "NEXT_PUBLIC_API_URL", value: "relay.example.com", production: false, expected: { error: "NEXT_PUBLIC_API_URL must be an absolute URL" } },
  { name: "NEXT_PUBLIC_API_URL", value: "ftp://relay.example.com", production: false, expected: { error: "NEXT_PUBLIC_API_URL must use http:// or https://" } },
  { name: "NEXT_PUBLIC_API_URL", value: "http://relay.example.com", production: false, expected: { key: "apiUrl", value: "http://relay.example.com" } },
  { name: "NEXT_PUBLIC_API_URL", value: "http://relay.example.com", production: true, expected: { error: "NEXT_PUBLIC_API_URL must use https:// in production" } },
  { name: "NEXT_PUBLIC_API_URL", value: "http://localhost:4000", production: true, expected: { key: "apiUrl", value: "http://localhost:4000" } },
  // NEXT_PUBLIC_WS_URL
  { name: "NEXT_PUBLIC_WS_URL", value: "wss://relay.example.com/ws", production: true, expected: { key: "wsUrl", value: "wss://relay.example.com/ws" } },
  { name: "NEXT_PUBLIC_WS_URL", value: undefined, production: true, expected: { key: "wsUrl", value: null } },
  { name: "NEXT_PUBLIC_WS_URL", value: "", production: false, expected: { key: "wsUrl", value: null } },
  { name: "NEXT_PUBLIC_WS_URL", value: "https://relay.example.com/ws", production: false, expected: { error: "NEXT_PUBLIC_WS_URL must use ws:// or wss://" } },
  { name: "NEXT_PUBLIC_WS_URL", value: "ws://relay.example.com/ws", production: true, expected: { error: "NEXT_PUBLIC_WS_URL must use wss:// in production" } },
  { name: "NEXT_PUBLIC_WS_URL", value: "ws://127.0.0.1:4000/ws", production: true, expected: { key: "wsUrl", value: "ws://127.0.0.1:4000/ws" } },
  // NEXT_PUBLIC_NETWORK
  { name: "NEXT_PUBLIC_NETWORK", value: "mainnet", production: true, expected: { key: "network", value: "mainnet" } },
  { name: "NEXT_PUBLIC_NETWORK", value: "futurenet", production: false, expected: { key: "network", value: "futurenet" } },
  { name: "NEXT_PUBLIC_NETWORK", value: undefined, production: true, expected: { key: "network", value: "testnet" } },
  { name: "NEXT_PUBLIC_NETWORK", value: "TESTNET", production: false, expected: { error: "NEXT_PUBLIC_NETWORK must be one of testnet | futurenet | mainnet" } },
  // NEXT_PUBLIC_SETTLEMENT_CONTRACT
  { name: "NEXT_PUBLIC_SETTLEMENT_CONTRACT", value: CONTRACT, production: true, expected: { key: "settlementContract", value: CONTRACT } },
  { name: "NEXT_PUBLIC_SETTLEMENT_CONTRACT", value: undefined, production: true, expected: { key: "settlementContract", value: "" } },
  { name: "NEXT_PUBLIC_SETTLEMENT_CONTRACT", value: "GDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC", production: false, expected: { error: "NEXT_PUBLIC_SETTLEMENT_CONTRACT must be a Soroban contract ID" } },
  { name: "NEXT_PUBLIC_SETTLEMENT_CONTRACT", value: CONTRACT.slice(0, 40), production: false, expected: { error: "NEXT_PUBLIC_SETTLEMENT_CONTRACT must be a Soroban contract ID" } },
  // NEXT_PUBLIC_SOLVER_REGISTRY_CONTRACT
  { name: "NEXT_PUBLIC_SOLVER_REGISTRY_CONTRACT", value: CONTRACT, production: false, expected: { key: "solverRegistryContract", value: CONTRACT } },
  { name: "NEXT_PUBLIC_SOLVER_REGISTRY_CONTRACT", value: "", production: true, expected: { key: "solverRegistryContract", value: "" } },
  { name: "NEXT_PUBLIC_SOLVER_REGISTRY_CONTRACT", value: CONTRACT.toLowerCase(), production: true, expected: { error: "NEXT_PUBLIC_SOLVER_REGISTRY_CONTRACT must be a Soroban contract ID" } },
  // NEXT_PUBLIC_SITE_URL
  { name: "NEXT_PUBLIC_SITE_URL", value: "https://vortex.example.com/", production: true, expected: { key: "siteUrl", value: "https://vortex.example.com" } },
  { name: "NEXT_PUBLIC_SITE_URL", value: undefined, production: false, expected: { key: "siteUrl", value: "http://localhost:3000" } },
  { name: "NEXT_PUBLIC_SITE_URL", value: "not a url", production: false, expected: { error: "NEXT_PUBLIC_SITE_URL must be an absolute URL" } },
  { name: "NEXT_PUBLIC_SITE_URL", value: "http://vortex.example.com", production: true, expected: { error: "NEXT_PUBLIC_SITE_URL must use https:// in production" } },
];

describe("loadConfig", () => {
  it.each(rows)("$name=$value (production: $production)", ({ name, value, production, expected }) => {
    const env = { [name]: value };
    if ("error" in expected) {
      expect(() => loadConfig(env, production)).toThrow(expected.error);
    } else {
      expect(loadConfig(env, production)[expected.key]).toBe(expected.value);
    }
  });

  it("reports every invalid variable in one error", () => {
    expect(() =>
      loadConfig({ NEXT_PUBLIC_NETWORK: "moon", NEXT_PUBLIC_API_URL: "nope" }, false),
    ).toThrow(/NEXT_PUBLIC_API_URL[\s\S]*NEXT_PUBLIC_NETWORK/);
  });

  it("returns a frozen object", () => {
    expect(Object.isFrozen(loadConfig({}, false))).toBe(true);
  });
});

describe("config", () => {
  it("is parsed from the test environment with the development defaults", () => {
    expect(config).toEqual({
      apiUrl: "http://localhost:4000",
      wsUrl: null,
      network: "testnet",
      settlementContract: "",
      solverRegistryContract: "",
      siteUrl: "http://localhost:3000",
    });
  });
});
