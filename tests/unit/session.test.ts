import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { sealSession, unsealSession, SessionUser } from "@/lib/security/session";

describe("Session Management & Cryptographic Sealing", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-15T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const sampleUser: Omit<SessionUser, "expiresAt"> = {
    id: "user-staff-42",
    email: "sarah.connor@hopeforstrays.org",
    name: "Sarah Connor",
    role: "COORDINATOR",
  };

  it("should seal and successfully unseal a valid user session", () => {
    const token = sealSession(sampleUser);
    expect(token).toBeTypeOf("string");

    const parts = token.split(".");
    expect(parts).toHaveLength(2);

    const session = unsealSession(token);
    expect(session).not.toBeNull();
    expect(session?.id).toBe(sampleUser.id);
    expect(session?.email).toBe(sampleUser.email);
    expect(session?.name).toBe(sampleUser.name);
    expect(session?.role).toBe(sampleUser.role);
    expect(session?.expiresAt).toBeGreaterThan(Date.now());
  });

  it("should reject session token if time has passed expiration (TTL)", () => {
    // 1 hour expiry
    const maxAgeSeconds = 3600;
    const token = sealSession(sampleUser, maxAgeSeconds);

    // Valid immediately
    expect(unsealSession(token)).not.toBeNull();

    // Advance time past 1 hour (3601 seconds)
    vi.advanceTimersByTime(3601 * 1000);

    // Should return null (expired)
    expect(unsealSession(token)).toBeNull();
  });

  it("should reject session token if payload was tampered with", () => {
    const token = sealSession(sampleUser);
    const [payloadBase64, signature] = token.split(".");

    // Decode, modify role to ADMIN, re-encode
    const json = JSON.parse(Buffer.from(payloadBase64, "base64url").toString("utf8"));
    json.role = "ADMIN";
    const tamperedPayload = Buffer.from(JSON.stringify(json), "utf8").toString("base64url");

    const tamperedToken = `${tamperedPayload}.${signature}`;
    expect(unsealSession(tamperedToken)).toBeNull();
  });

  it("should reject session token if signature was tampered with", () => {
    const token = sealSession(sampleUser);
    const [payloadBase64, signature] = token.split(".");

    // Modify last char of signature
    const lastChar = signature.slice(-1);
    const flippedChar = lastChar === "a" ? "b" : "a";
    const tamperedSig = signature.slice(0, -1) + flippedChar;

    const tamperedToken = `${payloadBase64}.${tamperedSig}`;
    expect(unsealSession(tamperedToken)).toBeNull();
  });

  it("should return null for malformed session tokens", () => {
    const badTokens = [
      "",
      "singleparttoken",
      "one.two.three",
      "invalid-base64.signature",
      "null",
      "undefined",
    ];

    for (const badToken of badTokens) {
      expect(unsealSession(badToken)).toBeNull();
    }
  });
});
