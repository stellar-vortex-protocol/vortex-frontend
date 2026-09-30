import { describe, it, expect } from "vitest";
import { checkManifest, findDuplicateKeys, findScriptReferences } from "./check-manifest.mjs";

const validManifest = JSON.stringify(
  {
    name: "fixture",
    scripts: { build: "next build", test: "vitest run", "test:e2e": "playwright test" },
    devDependencies: { vitest: "^2.1.9" },
  },
  null,
  2,
);

const duplicateKeyManifest = `{
  "name": "fixture",
  "scripts": {
    "check:env": "node a.mjs",
    "test": "vitest run",
    "check:env": "node b.mjs"
  }
}`;

const workflow = `
steps:
  - run: npm ci
  - run: npm test
  - run: npm run build
  - run: npm run test:e2e -- --list
`;

describe("findDuplicateKeys", () => {
  it("reports duplicate keys with their path", () => {
    expect(findDuplicateKeys(duplicateKeyManifest)).toEqual(["scripts.check:env"]);
  });

  it("accepts a manifest without duplicates", () => {
    expect(findDuplicateKeys(validManifest)).toEqual([]);
  });

  it("does not confuse equal keys in different objects or string values", () => {
    const text = '{"a": {"x": "a"}, "b": {"x": "a"}, "c": ["a", "a"]}';
    expect(findDuplicateKeys(text)).toEqual([]);
  });
});

describe("findScriptReferences", () => {
  it("collects npm run, npm test and npm start invocations", () => {
    expect([...findScriptReferences(workflow)].sort()).toEqual(["build", "test", "test:e2e"]);
    expect(findScriptReferences("npm start")).toEqual(new Set(["start"]));
  });

  it("ignores npm ci and npm install", () => {
    expect(findScriptReferences("npm ci && npm install")).toEqual(new Set());
  });
});

describe("checkManifest", () => {
  it("passes a valid manifest whose scripts all exist", () => {
    expect(checkManifest(validManifest, [{ file: "ci.yml", text: workflow }])).toEqual([]);
  });

  it("fails on a workflow referencing a missing script", () => {
    const errors = checkManifest(validManifest, [
      { file: "ci.yml", text: "- run: npm run build:storybook" },
    ]);
    expect(errors).toEqual([
      'ci.yml: runs "npm run build:storybook" but package.json has no "build:storybook" script',
    ]);
  });

  it("fails on duplicate keys", () => {
    expect(checkManifest(duplicateKeyManifest, [])).toEqual([
      'package.json: duplicate key "scripts.check:env"',
    ]);
  });
});
