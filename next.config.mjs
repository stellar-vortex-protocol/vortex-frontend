/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000",
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:4000/ws",
    NEXT_PUBLIC_NETWORK: process.env.NEXT_PUBLIC_NETWORK ?? "testnet",
    NEXT_PUBLIC_SETTLEMENT_CONTRACT: process.env.NEXT_PUBLIC_SETTLEMENT_CONTRACT ?? "",
    NEXT_PUBLIC_SOLVER_REGISTRY_CONTRACT: process.env.NEXT_PUBLIC_SOLVER_REGISTRY_CONTRACT ?? "",
  },
};

export default nextConfig;
