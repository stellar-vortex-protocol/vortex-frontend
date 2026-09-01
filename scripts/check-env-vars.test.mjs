import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Helper function to check if URL is localhost
function isLocalhost(url) {
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname === "localhost" ||
      parsed.hostname === "127.0.0.1" ||
      parsed.hostname === "[::1]"
    );
  } catch {
    return false;
  }
}

describe("Environment Variable Security Checks", () => {
  describe("isLocalhost", () => {
    it("should recognize localhost as local", () => {
      expect(isLocalhost("http://localhost:4000")).toBe(true);
      expect(isLocalhost("https://localhost:4000")).toBe(true);
      expect(isLocalhost("ws://localhost:4000")).toBe(true);
      expect(isLocalhost("wss://localhost:4000")).toBe(true);
    });

    it("should recognize 127.0.0.1 as local", () => {
      expect(isLocalhost("http://127.0.0.1:4000")).toBe(true);
      expect(isLocalhost("https://127.0.0.1:4000")).toBe(true);
    });

    it("should recognize [::1] as local (IPv6)", () => {
      expect(isLocalhost("http://[::1]:4000")).toBe(true);
      expect(isLocalhost("https://[::1]:4000")).toBe(true);
    });

    it("should not recognize remote hosts as local", () => {
      expect(isLocalhost("http://example.com")).toBe(false);
      expect(isLocalhost("https://api.example.com")).toBe(false);
      expect(isLocalhost("ws://relay.service.com")).toBe(false);
    });

    it("should handle invalid URLs gracefully", () => {
      expect(isLocalhost("not a url")).toBe(false);
      expect(isLocalhost("")).toBe(false);
      expect(isLocalhost(null)).toBe(false);
    });
  });

  describe("Scheme validation", () => {
    it("should identify insecure http in production", () => {
      const url = "http://api.example.com";
      const insecure = url.startsWith("http://") && !isLocalhost(url);
      expect(insecure).toBe(true);
    });

    it("should allow https in production", () => {
      const url = "https://api.example.com";
      const insecure = url.startsWith("http://") && !isLocalhost(url);
      expect(insecure).toBe(false);
    });

    it("should identify insecure ws in production", () => {
      const url = "ws://relay.example.com/ws";
      const insecure = url.startsWith("ws://") && !isLocalhost(url);
      expect(insecure).toBe(true);
    });

    it("should allow wss in production", () => {
      const url = "wss://relay.example.com/ws";
      const insecure = url.startsWith("ws://") && !isLocalhost(url);
      expect(insecure).toBe(false);
    });

    it("should allow http/ws for localhost", () => {
      const apiUrl = "http://localhost:4000";
      const wsUrl = "ws://localhost:4000/ws";
      expect(apiUrl.startsWith("http://") && !isLocalhost(apiUrl)).toBe(false);
      expect(wsUrl.startsWith("ws://") && !isLocalhost(wsUrl)).toBe(false);
    });
  });

  describe("Combined validation scenarios", () => {
    it("should pass when all URLs are secure in production", () => {
      const API_URL = "https://api.stellar-vortex.io";
      const WS_URL = "wss://relay.stellar-vortex.io/ws";

      let hasIssues = false;
      if (API_URL.startsWith("http://") && !isLocalhost(API_URL)) hasIssues = true;
      if (WS_URL.startsWith("ws://") && !isLocalhost(WS_URL)) hasIssues = true;

      expect(hasIssues).toBe(false);
    });

    it("should fail when API uses http in production", () => {
      const API_URL = "http://api.stellar-vortex.io";
      const WS_URL = "wss://relay.stellar-vortex.io/ws";

      let hasIssues = false;
      if (API_URL.startsWith("http://") && !isLocalhost(API_URL)) hasIssues = true;
      if (WS_URL.startsWith("ws://") && !isLocalhost(WS_URL)) hasIssues = true;

      expect(hasIssues).toBe(true);
    });

    it("should fail when WebSocket uses ws in production", () => {
      const API_URL = "https://api.stellar-vortex.io";
      const WS_URL = "ws://relay.stellar-vortex.io/ws";

      let hasIssues = false;
      if (API_URL.startsWith("http://") && !isLocalhost(API_URL)) hasIssues = true;
      if (WS_URL.startsWith("ws://") && !isLocalhost(WS_URL)) hasIssues = true;

      expect(hasIssues).toBe(true);
    });

    it("should pass development environment with localhost URLs", () => {
      const API_URL = "http://localhost:4000";
      const WS_URL = "ws://localhost:4000/ws";

      let hasIssues = false;
      if (API_URL.startsWith("http://") && !isLocalhost(API_URL)) hasIssues = true;
      if (WS_URL.startsWith("ws://") && !isLocalhost(WS_URL)) hasIssues = true;

      expect(hasIssues).toBe(false);
    });
  });
});
