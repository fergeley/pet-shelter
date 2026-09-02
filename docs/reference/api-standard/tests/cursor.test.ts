import { describe, expect, it } from "vitest";
import { decodeCursor, encodeCursor, sortFingerprint } from "../cursor";

const SECRET = "test-signing-key-not-a-real-one";

const payload = {
  k: ["2026-08-19T10:00:00Z", 42] as (string | number | null)[],
  id: "prod_01JQZX3K9ABCDEFGHJKMNPQRST",
  s: "updated_at:desc,id:asc",
};

describe("cursor", () => {
  it("round-trips a payload", async () => {
    const token = await encodeCursor(payload, SECRET);
    const result = await decodeCursor(token, SECRET);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.k).toEqual(payload.k);
    expect(result.value.id).toBe(payload.id);
    expect(result.value.s).toBe(payload.s);
    expect(result.value.v).toBe(1);
  });

  it("is opaque — the payload is not readable as plain text", async () => {
    const token = await encodeCursor(payload, SECRET);
    expect(token).not.toContain("prod_");
    expect(token).not.toContain("updated_at");
  });

  it("rejects a tampered payload", async () => {
    const token = await encodeCursor(payload, SECRET);
    const [body, signature] = token.split(".");

    // Flip a character in the body while keeping the original signature.
    const tampered = `${body.slice(0, -1)}${body.at(-1) === "A" ? "B" : "A"}.${signature}`;
    const result = await decodeCursor(tampered, SECRET);

    expect(result).toEqual({ ok: false, reason: "bad_signature" });
  });

  it("rejects a cursor minted with a different key", async () => {
    const token = await encodeCursor(payload, "some-other-key");
    expect(await decodeCursor(token, SECRET)).toEqual({
      ok: false,
      reason: "bad_signature",
    });
  });

  it("rejects structurally malformed input", async () => {
    for (const bad of ["", "no-separator", ".", "abc."]) {
      const result = await decodeCursor(bad, SECRET);
      expect(result.ok).toBe(false);
    }
  });

  it("binds a cursor to the sort it was minted under", async () => {
    const ascending = sortFingerprint([{ field: "updated_at", dir: "asc" }]);
    const descending = sortFingerprint([{ field: "updated_at", dir: "desc" }]);

    expect(ascending).not.toBe(descending);

    const token = await encodeCursor({ ...payload, s: descending }, SECRET);
    const result = await decodeCursor(token, SECRET);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // The route compares these and returns 400 cursor_sort_mismatch on a difference,
    // rather than serving pages that silently overlap.
    expect(result.value.s).not.toBe(ascending);
  });

  it("produces a stable fingerprint for the same sort spec", () => {
    const terms = [
      { field: "price", dir: "asc" },
      { field: "id", dir: "asc" },
    ];
    expect(sortFingerprint(terms)).toBe(sortFingerprint([...terms]));
  });
});
