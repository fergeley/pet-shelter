import crypto from "node:crypto";

const DEFAULT_SECRET = process.env.SESSION_SECRET || "hope-for-strays-secret-key-32-chars-long-secure-salt!";
const ENCRYPTION_KEY = crypto.createHash("sha256").update(DEFAULT_SECRET).digest(); // 32 bytes key for AES-256
const IV_LENGTH = 12; // 12 bytes for GCM

/**
 * Derives a cryptographically strong scrypt hash for password storage.
 */
export async function hashPassword(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString("hex");
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(`${salt}:${derivedKey.toString("hex")}`);
    });
  });
}

/**
 * Constant-time password verification to prevent timing attacks.
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const parts = storedHash.split(":");
      if (parts.length !== 2) return resolve(false);

      const [salt, key] = parts;
      const keyBuffer = Buffer.from(key, "hex");

      crypto.scrypt(password, salt, 64, (err, derivedKey) => {
        if (err) return resolve(false);
        // timingSafeEqual prevents timing attacks
        if (derivedKey.length !== keyBuffer.length) return resolve(false);
        resolve(crypto.timingSafeEqual(derivedKey, keyBuffer));
      });
    } catch {
      resolve(false);
    }
  });
}

/**
 * Generates an HMAC-SHA256 signature for a given payload string.
 */
export function signPayload(payload: string): string {
  const hmac = crypto.createHmac("sha256", DEFAULT_SECRET);
  hmac.update(payload);
  return hmac.digest("hex");
}

/**
 * Verifies that a signed payload has not been tampered with.
 */
export function verifySignature(payload: string, signature: string): boolean {
  try {
    const expectedSignature = signPayload(payload);
    const expectedBuf = Buffer.from(expectedSignature, "hex");
    const actualBuf = Buffer.from(signature, "hex");

    if (expectedBuf.length !== actualBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, actualBuf);
  } catch {
    return false;
  }
}

/**
 * Encrypts sensitive text using AES-256-GCM.
 */
export function encryptField(plainText: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(plainText, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");

  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

/**
 * Decrypts text encrypted via AES-256-GCM.
 */
export function decryptField(encryptedPayload: string): string | null {
  try {
    const parts = encryptedPayload.split(":");
    if (parts.length !== 3) return null;

    const [ivHex, authTagHex, encryptedHex] = parts;
    if (!ivHex || !authTagHex || encryptedHex === undefined) return null;

    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const decipher = crypto.createDecipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedHex, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch {
    return null;
  }
}
