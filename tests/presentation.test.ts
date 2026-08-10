import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const styles = readFileSync(fileURLToPath(new URL("../src/styles.css", import.meta.url)), "utf8");

describe("safety presentation", () => {
  it("retains emergency, limitation, privacy, and draft warnings in print output", () => {
    const printRules = styles.slice(styles.indexOf("@media print"));
    const hiddenRule = printRules.match(/[^{}]+\{\s*display:\s*none\s*!important;\s*\}/)?.[0] ?? "";
    expect(hiddenRule).not.toMatch(/emergency-notice|draft-warning|privacy-note|limitation/);
  });
});
