/**
 * Single resolution point for authentication secrets.
 *
 * No other module reads `process.env` for a secret: every consumer goes through
 * `resolveSecret` (or one of the named accessors below) so that one policy —
 * documented in `docs/tasks/TARGET_SECRET_HARDENING.md` §2 — applies everywhere.
 *
 * Policy, keyed on `NODE_ENV`:
 *
 * | Environment              | Missing / weak / known-default secret                      |
 * |--------------------------|------------------------------------------------------------|
 * | `production`             | throw — fail the boot loudly rather than serve forgeries    |
 * | `development` / `test`   | return a clearly-labelled dev default and warn once         |
 *
 * "Weak" covers three cases: unset (or whitespace), shorter than `minLength`,
 * and *equal to the documented development default* — the last one is what
 * catches an `.env.example` value copied verbatim into a real deploy.
 *
 * This module deliberately imports nothing from the project (layer L-B5): it
 * sits below the rest of `src/lib/security/` and must stay importable from any
 * layer, server or client-adjacent, without dragging dependencies in.
 */

/** Raised when a secret cannot be resolved safely in production. */
export class SecretConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SecretConfigurationError";
  }
}

export interface ResolveSecretOptions {
  /**
   * The value used in development and test when the variable is unset. It is
   * also a *rejected* value in production — publishing it here is what lets
   * `resolveSecret` recognise an unchanged copy-paste deploy.
   */
  devDefault: string;
  /** Minimum acceptable length for a configured value. Defaults to 16. */
  minLength?: number;
}

/**
 * Development fallbacks. These are intentionally long, self-describing, and
 * useless as credentials: any deploy still carrying one refuses to boot.
 */
export const DEV_SECRET_DEFAULTS = {
  SESSION_SECRET: "dev-only-insecure-session-secret-change-me-before-deploy",
  ADMIN_SECRET_KEY: "dev-only-insecure-admin-secret-key-change-me",
  STAFF_INVITE_SECRET: "dev-only-insecure-staff-invite-code-change-me",
} as const;

/** Minimum length for the HMAC key that signs every session cookie. */
const SESSION_SECRET_MIN_LENGTH = 32;

const warnedSecrets = new Set<string>();

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * Describes why a configured value is unacceptable, or `null` when it is fine.
 * The description never includes the value itself — these strings reach logs.
 */
function describeWeakness(value: string, devDefault: string, minLength: number): string | null {
  if (value.length === 0) return "not set";
  if (value === devDefault) return "still set to the documented development default";
  if (value.length < minLength) return `shorter than the required ${minLength} characters`;
  return null;
}

function warnOnce(name: string, message: string): void {
  if (warnedSecrets.has(name)) return;
  warnedSecrets.add(name);
  console.warn(message);
}

/**
 * Resolves a secret from the environment under the policy described above.
 *
 * @throws {SecretConfigurationError} in production when the value is missing,
 * too short, or equal to the documented development default.
 */
export function resolveSecret(name: string, opts: ResolveSecretOptions): string {
  const minLength = opts.minLength ?? 16;
  const value = (process.env[name] ?? "").trim();
  const weakness = describeWeakness(value, opts.devDefault, minLength);

  if (!weakness) return value;

  if (isProduction()) {
    throw new SecretConfigurationError(
      `${name} is ${weakness}. Set a unique, high-entropy ${name} of at least ` +
        `${minLength} characters in the production environment. See .env.example.`
    );
  }

  warnOnce(
    name,
    `[security/secrets] ${name} is ${weakness}; using an insecure development ` +
      `fallback. This configuration refuses to boot with NODE_ENV=production.`
  );

  return value.length === 0 ? opts.devDefault : value;
}

/** HMAC key for sealing the `hope_shelter_session` cookie (and the AES field key). */
export function getSessionSecret(): string {
  return resolveSecret("SESSION_SECRET", {
    devDefault: DEV_SECRET_DEFAULTS.SESSION_SECRET,
    minLength: SESSION_SECRET_MIN_LENGTH,
  });
}

/** Shared secret accepted by the legacy `admin_session` cookie. */
export function getAdminSecretKey(): string {
  return resolveSecret("ADMIN_SECRET_KEY", {
    devDefault: DEV_SECRET_DEFAULTS.ADMIN_SECRET_KEY,
  });
}

/**
 * Invite code required to register any staff account.
 *
 * Resolved per call rather than at module load, so rotating `STAFF_INVITE_SECRET`
 * takes effect without a redeploy. `assertSecretsConfigured()` covers the
 * fail-fast half; this accessor covers the rotation half.
 *
 * Keeps the default 16-character minimum deliberately. A shorter bound (4 was
 * proposed) is not defensible here: this single shared code is the only gate on
 * an account that can read applicant PII under PDPA 2010, and the registration
 * rate limit is keyed on `register:${email}` — an attacker-supplied value — so
 * varying the email defeats it and leaves the code effectively enumerable.
 */
export function getStaffInviteSecret(): string {
  return resolveSecret("STAFF_INVITE_SECRET", {
    devDefault: DEV_SECRET_DEFAULTS.STAFF_INVITE_SECRET,
  });
}

/**
 * Validates every authentication secret in one pass, for the startup hook.
 *
 * Only `SESSION_SECRET` was previously checked at boot (resolved at module load
 * by `crypto.ts`). `ADMIN_SECRET_KEY` and `STAFF_INVITE_SECRET` are read lazily
 * per request, so a production deploy missing either booted green and failed on
 * the first upload or registration instead — the "runtime check per call"
 * failure mode that `TARGET_SECRET_HARDENING.md` §2 explicitly rejects, because
 * it surfaces when nobody is watching.
 *
 * Reports *every* misconfigured secret at once so a single deploy cycle fixes
 * them all, rather than revealing them one restart at a time.
 *
 * @throws {SecretConfigurationError} in production when any secret is unsafe.
 */
export function assertSecretsConfigured(): void {
  const failures: string[] = [];

  for (const accessor of [getSessionSecret, getAdminSecretKey, getStaffInviteSecret]) {
    try {
      accessor();
    } catch (error) {
      if (!(error instanceof SecretConfigurationError)) throw error;
      failures.push(error.message);
    }
  }

  if (failures.length === 0) return;

  throw new SecretConfigurationError(
    `Refusing to start: ${failures.length} authentication secret(s) unsafe for production.\n` +
      failures.map((failure) => `  - ${failure}`).join("\n")
  );
}

/**
 * Clears the "warned once" bookkeeping. Test-only, mirroring `resetUserStore()`:
 * production code has no reason to make a secret warn twice.
 */
export function resetSecretWarnings(): void {
  warnedSecrets.clear();
}
