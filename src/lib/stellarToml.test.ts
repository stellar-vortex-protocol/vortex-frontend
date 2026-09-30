import { describe, expect, it } from "vitest";
import { parseStellarToml } from "./stellarToml";
import { evaluateSolverIdentity } from "./solverIdentity";

const A = "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H";
const B = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7";

describe("parseStellarToml", () => {
  it("extracts ACCOUNTS and DOCUMENTATION org fields", () => {
    const toml = `
# comment
VERSION = "2.0.0"
ACCOUNTS = [
  "${A}", # primary
  "${B}",
  "not-a-key",
]

[DOCUMENTATION]
ORG_NAME = "Acme \\"Solvers\\" # Inc"
ORG_URL = "https://acme.example"
ORG_LOGO = "https://evil.example/logo.png"

[[CURRENCIES]]
code = "USDC"
ORG_NAME = "ignored"
`;
    expect(parseStellarToml(toml)).toEqual({
      accounts: [A, B],
      orgName: 'Acme "Solvers" # Inc',
      orgUrl: "https://acme.example",
    });
  });

  it("supports single-line arrays and literal strings, rejects non-https org URLs", () => {
    const toml = `ACCOUNTS = ['${A}']\n[DOCUMENTATION]\nORG_NAME = 'Lit'\nORG_URL = "javascript:alert(1)"`;
    expect(parseStellarToml(toml)).toEqual({ accounts: [A], orgName: "Lit", orgUrl: null });
  });

  it("ignores ACCOUNTS outside the top-level table and malformed values", () => {
    const toml = `[DOCUMENTATION]\nACCOUNTS = ["${A}"]\nORG_NAME = unquoted`;
    expect(parseStellarToml(toml)).toEqual({ accounts: [], orgName: null, orgUrl: null });
  });

  it("survives garbage and oversized strings", () => {
    expect(parseStellarToml("\u0000[[[\n=\n\"")).toEqual({ accounts: [], orgName: null, orgUrl: null });
    expect(parseStellarToml(`[DOCUMENTATION]\nORG_NAME = "${"x".repeat(1000)}"`).orgName).toBeNull();
    const unterminated = `ACCOUNTS = [\n"${A}",\n` + "\n".repeat(20_000);
    expect(parseStellarToml(unterminated).accounts).toEqual([]);
  });
});

describe("evaluateSolverIdentity", () => {
  const toml = { domain: "xn--acm-4la.example", domainUnicode: "acmé.example", accounts: [A], orgName: "Acme‮", orgUrl: null };

  it("returns unverified without a claimed domain", () => {
    expect(evaluateSolverIdentity(A, undefined, null, false).state).toBe("unverified");
  });
  it("returns unavailable when the fetch failed", () => {
    expect(evaluateSolverIdentity(A, "acme.example", null, true).state).toBe("unavailable");
  });
  it("returns verified with a sanitised org name when the account is listed", () => {
    const id = evaluateSolverIdentity(A, "acme.example", toml, false);
    expect(id).toMatchObject({ state: "verified", domain: "xn--acm-4la.example", domainUnicode: "acmé.example" });
    expect(id.orgName).not.toContain("‮");
  });
  it("returns mismatch (and no org name) when the account is not listed", () => {
    expect(evaluateSolverIdentity(B, "acme.example", toml, false)).toMatchObject({ state: "mismatch", orgName: null });
  });
});
