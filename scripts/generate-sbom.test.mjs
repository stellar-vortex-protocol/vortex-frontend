import { describe, it, expect } from "vitest";
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

import {
  readJson,
  getProductionDeps,
  buildComponent,
  collectComponents,
  generateSbom,
  APPROVED_REGISTRIES,
} from "./generate-sbom.mjs";

describe("readJson", () => {
  it("should parse a valid JSON file", () => {
    const result = readJson(join(__dirname, "fixtures/lockfile-good.json"));
    expect(result).not.toBeNull();
    expect(result.lockfileVersion).toBe(3);
  });

  it("should return null for a missing file", () => {
    expect(readJson("/nonexistent/path/file.json")).toBeNull();
  });
});

describe("getProductionDeps", () => {
  it("should extract production dependency names", () => {
    const pkg = {
      dependencies: { react: "^18", lodash: "^4.17" },
      devDependencies: { vitest: "^2" },
    };
    const deps = getProductionDeps(pkg);
    expect(deps.has("react")).toBe(true);
    expect(deps.has("lodash")).toBe(true);
    expect(deps.has("vitest")).toBe(false);
  });

  it("should return an empty set when there are no dependencies", () => {
    const deps = getProductionDeps({});
    expect(deps.size).toBe(0);
  });
});

describe("buildComponent", () => {
  it("should build a minimal component", () => {
    const comp = buildComponent("react", "18.2.0");
    expect(comp.type).toBe("library");
    expect(comp.name).toBe("react");
    expect(comp.version).toBe("18.2.0");
    expect(comp.licenses).toBeUndefined();
  });

  it("should include a license when provided", () => {
    const comp = buildComponent("react", "18.2.0", "MIT");
    expect(comp.licenses).toEqual([{ license: { name: "MIT" } }]);
  });
});

describe("collectComponents", () => {
  it("should collect only top-level production dependencies", () => {
    const lockfile = {
      lockfileVersion: 3,
      packages: {
        "": { name: "test", version: "0.1.0" },
        "node_modules/react": {
          version: "18.2.0",
          resolved: "https://registry.npmjs.org/react/-/react-18.2.0.tgz",
          integrity: "sha512-abc",
          license: "MIT",
        },
        "node_modules/react-dom": {
          version: "18.2.0",
          resolved: "https://registry.npmjs.org/react-dom/-/react-dom-18.2.0.tgz",
          integrity: "sha512-def",
          license: "MIT",
          dev: true,
        },
        "node_modules/vitest": {
          version: "2.1.0",
          resolved: "https://registry.npmjs.org/vitest/-/vitest-2.1.0.tgz",
          integrity: "sha512-ghi",
          license: "MIT",
          dev: true,
        },
        "node_modules/next": {
          version: "14.2.3",
          resolved: "https://registry.npmjs.org/next/-/next-14.2.3.tgz",
          integrity: "sha512-jkl",
          license: "MIT",
        },
        "node_modules/next/node_modules/async": {
          version: "3.2.0",
          resolved: "https://registry.npmjs.org/async/-/async-3.2.0.tgz",
          integrity: "sha512-mno",
          license: "MIT",
        },
      },
    };

    const prodDeps = new Set(["react", "next"]);
    const components = collectComponents(lockfile, prodDeps);

    const names = components.map((c) => c.name);
    expect(names).toContain("react");
    expect(names).toContain("next");
    expect(names).not.toContain("react-dom"); // dev-only
    expect(names).not.toContain("vitest"); // dev-only
    expect(names).not.toContain("async"); // transitive (nested)
  });

  it("should return an empty array for an empty lockfile", () => {
    const components = collectComponents({ lockfileVersion: 3, packages: {} }, new Set());
    expect(components).toHaveLength(0);
  });
});

describe("generateSbom", () => {
  it("should generate a valid CycloneDX SBOM", () => {
    const pkg = { name: "vortex-frontend", version: "0.1.0" };
    const lockfile = {
      lockfileVersion: 3,
      packages: {
        "": { name: "vortex-frontend", version: "0.1.0" },
        "node_modules/react": {
          version: "18.2.0",
          resolved: "https://registry.npmjs.org/react/-/react-18.2.0.tgz",
          integrity: "sha512-abc",
          license: "MIT",
        },
      },
    };

    const sbom = generateSbom(pkg, lockfile);
    expect(sbom.bomFormat).toBe("CycloneDX");
    expect(sbom.specVersion).toBe("1.6");
    expect(sbom.components).toHaveLength(1);
    expect(sbom.components[0].name).toBe("react");
    expect(sbom.metadata.component.name).toBe("vortex-frontend");
  });

  it("should throw on unsupported lockfile versions", () => {
    const pkg = { name: "test", version: "0.1.0" };
    const lockfile = { lockfileVersion: 2, packages: {} };
    expect(() => generateSbom(pkg, lockfile)).toThrow("Unsupported lockfile version");
  });
});

describe("APPROVED_REGISTRIES", () => {
  it("should include registry.npmjs.org", () => {
    expect(APPROVED_REGISTRIES.has("registry.npmjs.org")).toBe(true);
  });
});
