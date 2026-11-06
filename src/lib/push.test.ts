import { describe, expect, it } from "vitest";
import { keyToBytes } from "./push";

describe("keyToBytes", () => {
  it("decodes a base64url VAPID key", () => {
    // "hello" em base64url sem preenchimento
    expect(Array.from(keyToBytes("aGVsbG8"))).toEqual([104, 101, 108, 108, 111]);
    expect(Array.from(keyToBytes("-_8"))).toEqual([251, 255]);
  });
});
