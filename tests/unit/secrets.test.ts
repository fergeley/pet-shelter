import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  DEV_SECRET_DEFAULTS,
  SecretConfigurationError,
  getAdminSecretKey,
  getSessionSecret,
  getStaffInviteSecret,
  resetSecretWarnings,
  assertSecretsConfigured,
  resolveSecret,
} from "@/lib/security/secrets";

const DEV_DEFAULT = "dev-only-insecure-test-secret-change-me";
const STRONG = "9f2c1d7a4b8e6035aa17cc93de40b52f7168e0d4";

describe("resolveSecret", () => {
  beforeEach(() => {
    resetSecretWarnings();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  describe("production", () => {
    beforeEach(() => {
      vi.stubEnv("NODE_ENV", "production");
    });

    it("throws when the variable is unset", () => {
      vi.stubEnv("TEST_SECRET", undefined);

      expect(() => resolveSecret("TEST_SECRET", { devDefault: DEV_DEFAULT })).toThrow(
        SecretConfigurationError
      );
      expect(() => resolveSecret("TEST_SECRET", { devDefault: DEV_DEFAULT })).toThrow(
        /TEST_SECRET/
      );
    });

    it("throws when the variable is only whitespace", () => {
      vi.stubEnv("TEST_SECRET", "   ");

      expect(() => resolveSecret("TEST_SECRET", { devDefault: DEV_DEFAULT })).toThrow(
        SecretConfigurationError
      );
    });

    it("throws when the variable equals the documented development default", () => {
      vi.stubEnv("TEST_SECRET", DEV_DEFAULT);

      expect(() => resolveSecret("TEST_SECRET", { devDefault: DEV_DEFAULT })).toThrow(
        SecretConfigurationError
      );
    });

    it("throws when SESSION_SECRET is shorter than 32 characters", () => {
      vi.stubEnv("SESSION_SECRET", "too-short-for-an-hmac-key");

      expect(() => getSessionSecret()).toThrow(SecretConfigurationError);
      expect(() => getSessionSecret()).toThrow(/32/);
    });

    it("returns a strong value unchanged", () => {
      vi.stubEnv("TEST_SECRET", STRONG);

      expect(resolveSecret("TEST_SECRET", { devDefault: DEV_DEFAULT, minLength: 32 })).toBe(STRONG);
    });

    it("returns a strong SESSION_SECRET unchanged", () => {
      vi.stubEnv("SESSION_SECRET", STRONG);

      expect(getSessionSecret()).toBe(STRONG);
    });

    it("never leaks the resolved value in the thrown message", () => {
      vi.stubEnv("TEST_SECRET", DEV_DEFAULT);

      try {
        resolveSecret("TEST_SECRET", { devDefault: DEV_DEFAULT });
        expect.unreachable("resolveSecret should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(SecretConfigurationError);
        expect((error as Error).message).not.toContain(DEV_DEFAULT);
      }
    });
  });

  describe("development and test", () => {
    beforeEach(() => {
      vi.stubEnv("NODE_ENV", "development");
    });

    it("returns the dev default when unset and warns exactly once per secret", () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      vi.stubEnv("TEST_SECRET", undefined);

      expect(resolveSecret("TEST_SECRET", { devDefault: DEV_DEFAULT })).toBe(DEV_DEFAULT);
      expect(resolveSecret("TEST_SECRET", { devDefault: DEV_DEFAULT })).toBe(DEV_DEFAULT);
      expect(resolveSecret("TEST_SECRET", { devDefault: DEV_DEFAULT })).toBe(DEV_DEFAULT);

      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0][0])).toContain("TEST_SECRET");
    });

    it("does not warn when a strong value is configured", () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      vi.stubEnv("TEST_SECRET", STRONG);

      expect(resolveSecret("TEST_SECRET", { devDefault: DEV_DEFAULT, minLength: 32 })).toBe(STRONG);
      expect(warn).not.toHaveBeenCalled();
    });

    it("does not throw for a weak value, it degrades with a warning", () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      vi.stubEnv("TEST_SECRET", "short");

      expect(resolveSecret("TEST_SECRET", { devDefault: DEV_DEFAULT, minLength: 32 })).toBe("short");
    });

    it("still resolves in NODE_ENV=test without throwing", () => {
      vi.stubEnv("NODE_ENV", "test");
      vi.spyOn(console, "warn").mockImplementation(() => {});
      vi.stubEnv("STAFF_INVITE_SECRET", undefined);

      expect(getStaffInviteSecret()).toBe(DEV_SECRET_DEFAULTS.STAFF_INVITE_SECRET);
    });
  });

  describe("named secret accessors", () => {
    beforeEach(() => {
      vi.stubEnv("NODE_ENV", "development");
      vi.spyOn(console, "warn").mockImplementation(() => {});
    });

    it("reads the environment on every call rather than caching at import time", () => {
      vi.stubEnv("ADMIN_SECRET_KEY", "first-admin-secret-key-value");
      expect(getAdminSecretKey()).toBe("first-admin-secret-key-value");

      vi.stubEnv("ADMIN_SECRET_KEY", "second-admin-secret-key-value");
      expect(getAdminSecretKey()).toBe("second-admin-secret-key-value");
    });

    it("trims surrounding whitespace from configured values", () => {
      vi.stubEnv("STAFF_INVITE_SECRET", "  padded-invite-code  ");
      expect(getStaffInviteSecret()).toBe("padded-invite-code");
    });

    it("exposes development defaults that are clearly labelled as insecure", () => {
      for (const value of Object.values(DEV_SECRET_DEFAULTS)) {
        expect(value).toMatch(/dev-only-insecure/);
      }
      // The HMAC key must satisfy its own minimum length even in development.
      expect(DEV_SECRET_DEFAULTS.SESSION_SECRET.length).toBeGreaterThanOrEqual(32);
    });

    it("does not resurrect the removed credential literals as defaults", () => {
      for (const value of Object.values(DEV_SECRET_DEFAULTS)) {
        expect(value).not.toBe("1234");
        expect(value).not.toBe("HOPE2026");
      }
    });
  });
});

describe("assertSecretsConfigured", () => {
  const STRONG_SESSION = "b41f8c02d97e653a1cf0a8b25d6e34917fa0c8b3e25d71f4";
  const STRONG_ADMIN = "7d3e1a95c4820bf6e73a1d05c9284fbe";
  const STRONG_INVITE = "e08b7c46193fa2d5b0e94c71a836df20";

  beforeEach(() => {
    resetSecretWarnings();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  describe("production", () => {
    beforeEach(() => {
      vi.stubEnv("NODE_ENV", "production");
    });

    it("passes when all three secrets are strong", () => {
      vi.stubEnv("SESSION_SECRET", STRONG_SESSION);
      vi.stubEnv("ADMIN_SECRET_KEY", STRONG_ADMIN);
      vi.stubEnv("STAFF_INVITE_SECRET", STRONG_INVITE);

      expect(() => assertSecretsConfigured()).not.toThrow();
    });

    // The gap this function closes: only SESSION_SECRET was validated at boot,
    // so a deploy missing either of the other two started and failed later.
    it("throws when ADMIN_SECRET_KEY is unset even though the session secret is fine", () => {
      vi.stubEnv("SESSION_SECRET", STRONG_SESSION);
      vi.stubEnv("ADMIN_SECRET_KEY", undefined);
      vi.stubEnv("STAFF_INVITE_SECRET", STRONG_INVITE);

      expect(() => assertSecretsConfigured()).toThrow(SecretConfigurationError);
      expect(() => assertSecretsConfigured()).toThrow(/ADMIN_SECRET_KEY/);
    });

    it("throws when STAFF_INVITE_SECRET is unset even though the others are fine", () => {
      vi.stubEnv("SESSION_SECRET", STRONG_SESSION);
      vi.stubEnv("ADMIN_SECRET_KEY", STRONG_ADMIN);
      vi.stubEnv("STAFF_INVITE_SECRET", undefined);

      expect(() => assertSecretsConfigured()).toThrow(/STAFF_INVITE_SECRET/);
    });

    // One deploy cycle should be enough to fix every problem.
    it("reports every misconfigured secret at once, not just the first", () => {
      vi.stubEnv("SESSION_SECRET", undefined);
      vi.stubEnv("ADMIN_SECRET_KEY", undefined);
      vi.stubEnv("STAFF_INVITE_SECRET", undefined);

      let message = "";
      try {
        assertSecretsConfigured();
      } catch (error) {
        message = (error as Error).message;
      }

      expect(message).toMatch(/SESSION_SECRET/);
      expect(message).toMatch(/ADMIN_SECRET_KEY/);
      expect(message).toMatch(/STAFF_INVITE_SECRET/);
      expect(message).toMatch(/3 authentication secret\(s\)/);
    });

    it("rejects a dev default copied verbatim into production", () => {
      vi.stubEnv("SESSION_SECRET", DEV_SECRET_DEFAULTS.SESSION_SECRET);
      vi.stubEnv("ADMIN_SECRET_KEY", STRONG_ADMIN);
      vi.stubEnv("STAFF_INVITE_SECRET", STRONG_INVITE);

      expect(() => assertSecretsConfigured()).toThrow(/SESSION_SECRET/);
    });

    it("never puts a secret value into the failure message", () => {
      // Distinctive values that cannot collide with the message's own wording.
      vi.stubEnv("SESSION_SECRET", "zqxvw1");
      vi.stubEnv("ADMIN_SECRET_KEY", "jkmpq2");
      vi.stubEnv("STAFF_INVITE_SECRET", "bhtrv3");

      let message = "";
      try {
        assertSecretsConfigured();
      } catch (error) {
        message = (error as Error).message;
      }

      expect(message).not.toMatch(/zqxvw1/);
      expect(message).not.toMatch(/jkmpq2/);
      expect(message).not.toMatch(/bhtrv3/);
    });

    // A 4-character invite code was proposed; it is rejected because the
    // registration rate limit is keyed on the attacker-supplied email.
    it("rejects a 4-character staff invite code", () => {
      vi.stubEnv("SESSION_SECRET", STRONG_SESSION);
      vi.stubEnv("ADMIN_SECRET_KEY", STRONG_ADMIN);
      vi.stubEnv("STAFF_INVITE_SECRET", "1234");

      expect(() => assertSecretsConfigured()).toThrow(/STAFF_INVITE_SECRET/);
    });
  });

  describe("development", () => {
    beforeEach(() => {
      vi.stubEnv("NODE_ENV", "development");
    });

    it("does not throw when secrets are unset, so local onboarding still works", () => {
      vi.stubEnv("SESSION_SECRET", undefined);
      vi.stubEnv("ADMIN_SECRET_KEY", undefined);
      vi.stubEnv("STAFF_INVITE_SECRET", undefined);
      vi.spyOn(console, "warn").mockImplementation(() => {});

      expect(() => assertSecretsConfigured()).not.toThrow();
    });

    it("surfaces the warning for each weak secret once, at startup", () => {
      vi.stubEnv("SESSION_SECRET", undefined);
      vi.stubEnv("ADMIN_SECRET_KEY", undefined);
      vi.stubEnv("STAFF_INVITE_SECRET", undefined);
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

      assertSecretsConfigured();
      assertSecretsConfigured();

      expect(warn).toHaveBeenCalledTimes(3);
    });
  });
});

/**
 * `.env.example` is the file an operator copies into a real environment.
 *
 * `resolveSecret` recognises an unchanged copy by comparing the value against
 * its own `DEV_SECRET_DEFAULTS` — that is the entire mechanism, and it works
 * only while the two files publish the same strings. A placeholder unique to
 * `.env.example` (`"replace-me-with-a-random-32-plus-character-secret"`, 49
 * characters, which is what this file used to carry) clears every other rule:
 * it is set, it is not the dev default, and it is longer than the minimum. It
 * boots green in production while looking obviously fake to a human.
 *
 * These tests pin the two lists together so that hole cannot reopen.
 */
describe(".env.example authentication secrets", () => {
  const documented: Record<string, string> = {};

  {
    const raw = readFileSync(resolve(__dirname, "../../.env.example"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      if (line.trimStart().startsWith("#")) continue;
      const match = /^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/.exec(line);
      if (match) documented[match[1]] = match[2];
    }
  }

  const SECRETS = [
    ["SESSION_SECRET", DEV_SECRET_DEFAULTS.SESSION_SECRET, 32],
    ["ADMIN_SECRET_KEY", DEV_SECRET_DEFAULTS.ADMIN_SECRET_KEY, 16],
    ["STAFF_INVITE_SECRET", DEV_SECRET_DEFAULTS.STAFF_INVITE_SECRET, 16],
  ] as const;

  beforeEach(() => {
    resetSecretWarnings();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it.each(SECRETS)("documents %s as the development default, not a novel placeholder", (name, devDefault) => {
    expect(documented[name]).toBe(devDefault);
  });

  it.each(SECRETS)("refuses to boot production with the documented %s", (name, devDefault, minLength) => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv(name, documented[name]);

    expect(() => resolveSecret(name, { devDefault, minLength })).toThrow(SecretConfigurationError);
  });

  it("names EMAIL_FROM rather than the unread SENDER_EMAIL", () => {
    // src/lib/email.ts and src/actions/settings.ts both read EMAIL_FROM. An
    // operator who sets the documented name instead leaves the From-address on
    // Resend's shared sandbox sender, which does not deliver to arbitrary
    // recipients — a silent failure with no error anywhere.
    expect(documented).toHaveProperty("EMAIL_FROM");
    expect(documented).not.toHaveProperty("SENDER_EMAIL");
  });
});
