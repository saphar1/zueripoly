import { describe, expect, it } from "vitest";
import { ENGINE_VERSION } from "../src";

describe("Engine-Gerüst", () => {
  it("lässt sich importieren", () => {
    expect(ENGINE_VERSION).toBe("0.3.0");
  });
});
