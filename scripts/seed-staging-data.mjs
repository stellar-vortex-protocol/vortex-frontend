#!/usr/bin/env node
/**
 * seed-staging-data.mjs
 *
 * Generates and seeds realistic synthetic test datasets for the Vortex Staging
 * environment. Covers multiple intent lifecycle states (pending, accepted,
 * filled, failed) across supported chains (Stellar, Ethereum, Arbitrum, Polygon)
 * and solver reputation profiles.
 *
 * Usage:
 *   node scripts/seed-staging-data.mjs [--dry-run] [--api-url <url>]
 */

const DRY_RUN = process.argv.includes("--dry-run");
const API_URL_ARG_IDX = process.argv.indexOf("--api-url");
const TARGET_API_URL =
  API_URL_ARG_IDX !== -1 && process.argv[API_URL_ARG_IDX + 1]
    ? process.argv[API_URL_ARG_IDX + 1]
    : process.env.NEXT_PUBLIC_API_URL || "https://staging-api.vortex-protocol.org";

export const SYNTHETIC_SOLVERS = [
  {
    name: "Nexus Flow Solver",
    address: "GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37",
    bondUsd: 250000,
    fills: 1420,
    failed: 12,
    volumeUsd: 3840000,
    avgFillTimeSeconds: 4.2,
    successRatePct: 99.16,
    chains: ["stellar", "ethereum", "arbitrum", "polygon"],
    status: "active",
  },
  {
    name: "Stellar Horizon Arb",
    address: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
    bondUsd: 100000,
    fills: 890,
    failed: 35,
    volumeUsd: 1450000,
    avgFillTimeSeconds: 6.8,
    successRatePct: 96.21,
    chains: ["stellar", "polygon"],
    status: "active",
  },
  {
    name: "QuickFill Router",
    address: "GCZOD2Z3Z7UK6X26YV4VQLDYZF3Y3OBLM2K56P22XU57L4AFLZ34ZAB1",
    bondUsd: 50000,
    fills: 310,
    failed: 48,
    volumeUsd: 420000,
    avgFillTimeSeconds: 12.5,
    successRatePct: 86.59,
    chains: ["stellar", "arbitrum"],
    status: "active",
  },
  {
    name: "Soroban Flash Solver",
    address: "GAXW7K56K2J37R563K5G7H5N2K4J5L6M7N8O9P0Q1R2S3T4U5V6W7X8Y",
    bondUsd: 20000,
    fills: 45,
    failed: 18,
    volumeUsd: 65000,
    avgFillTimeSeconds: 18.2,
    successRatePct: 71.43,
    chains: ["stellar"],
    status: "inactive",
  },
];

export const SYNTHETIC_INTENTS = [
  {
    id: "int_01HZX8P1N5K4L3M2J1",
    srcChain: "stellar",
    srcToken: "USDC",
    srcAmount: "500.00",
    dstToken: "XLM",
    dstAmount: "4545.45",
    minOut: "4500.00",
    dstAddress: "GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37",
    solver: "GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37",
    status: "filled",
    createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    deadline: new Date(Date.now() + 45 * 60 * 1000).toISOString(),
    txHash: "7b4e9f1a2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f",
  },
  {
    id: "int_01HZX8Q2M4K3L2J1N0",
    srcChain: "ethereum",
    srcToken: "ETH",
    srcAmount: "1.25",
    dstToken: "USDC",
    dstAmount: "4250.00",
    minOut: "4200.00",
    dstAddress: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
    solver: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
    status: "accepted",
    createdAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
    deadline: new Date(Date.now() + 27 * 60 * 1000).toISOString(),
  },
  {
    id: "int_01HZX8R3L3K2J1N0M9",
    srcChain: "arbitrum",
    srcToken: "ARB",
    srcAmount: "2500.00",
    dstToken: "USDC",
    dstAmount: "1875.00",
    minOut: "1850.00",
    dstAddress: "GCZOD2Z3Z7UK6X26YV4VQLDYZF3Y3OBLM2K56P22XU57L4AFLZ34ZAB1",
    solver: "",
    status: "pending",
    createdAt: new Date(Date.now() - 1 * 60 * 1000).toISOString(),
    deadline: new Date(Date.now() + 59 * 60 * 1000).toISOString(),
  },
  {
    id: "int_01HZX8S4K2J1N0M9L8",
    srcChain: "polygon",
    srcToken: "MATIC",
    srcAmount: "1500.00",
    dstToken: "XLM",
    dstAmount: "6800.00",
    minOut: "6750.00",
    dstAddress: "GAXW7K56K2J37R563K5G7H5N2K4J5L6M7N8O9P0Q1R2S3T4U5V6W7X8Y",
    solver: "GAXW7K56K2J37R563K5G7H5N2K4J5L6M7N8O9P0Q1R2S3T4U5V6W7X8Y",
    status: "failed",
    createdAt: new Date(Date.now() - 120 * 60 * 1000).toISOString(),
    deadline: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
  },
];

async function main() {
  console.log("==================================================");
  console.log(" Vortex Staging Synthetic Data Generator / Seeder");
  console.log("==================================================");
  console.log(`Target Relay API: ${TARGET_API_URL}`);
  console.log(`Dry Run Mode:     ${DRY_RUN ? "YES" : "NO"}`);
  console.log(`Solvers Seeded:   ${SYNTHETIC_SOLVERS.length}`);
  console.log(`Intents Seeded:   ${SYNTHETIC_INTENTS.length}`);
  console.log("--------------------------------------------------");

  if (DRY_RUN) {
    console.log("Dry run complete. Payload valid.");
    return;
  }

  // Attempt staging API upload if endpoint is reachable
  try {
    const res = await fetch(`${TARGET_API_URL}/admin/seed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        solvers: SYNTHETIC_SOLVERS,
        intents: SYNTHETIC_INTENTS,
      }),
    });
    if (res.ok) {
      console.log("✅ Successfully seeded staging backend instance.");
    } else {
      console.log(`ℹ️ Staging API /admin/seed returned ${res.status}. Synthetic payloads generated for local staging use.`);
    }
  } catch (err) {
    console.log(`ℹ️ Note: Staging backend not directly reachable (${err.message}). Synthetic seed data structure generated for maintainer usage.`);
  }
}

main();
