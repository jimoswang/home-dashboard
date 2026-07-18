import { describe, expect, it } from "vitest";
import { createPinRecord, verifyPin } from "./pin";

describe("admin PIN", () => {
  it("stores a derived hash and verifies exactly six digits", async () => {
    const record = await createPinRecord("123456");
    expect(record.hash).not.toContain("123456");
    await expect(verifyPin("123456", record)).resolves.toBe(true);
    await expect(verifyPin("123455", record)).resolves.toBe(false);
    await expect(verifyPin("12345", record)).resolves.toBe(false);
  });
});
