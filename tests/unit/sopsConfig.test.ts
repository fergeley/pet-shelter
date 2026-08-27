import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("SOPS & age Configuration Guards", () => {
  const rootDir = path.resolve(__dirname, "../../");

  it("ensures .sops.yaml exists with creation rules and age public keys", () => {
    const sopsYamlPath = path.join(rootDir, ".sops.yaml");
    expect(fs.existsSync(sopsYamlPath)).toBe(true);

    const content = fs.readFileSync(sopsYamlPath, "utf-8");
    expect(content).toContain("creation_rules:");
    expect(content).toContain("path_regex:");
    expect(content).toContain("age:");
    expect(content).toMatch(/age1[a-z0-9]+/); // Valid age public key format
  });

  it("ensures .env.production.enc exists and is genuinely encrypted", () => {
    const encPath = path.join(rootDir, ".env.production.enc");
    expect(fs.existsSync(encPath)).toBe(true);

    const content = fs.readFileSync(encPath, "utf-8");
    expect(content).toContain("sops_version");
    expect(content).toContain("sops_mac");
    expect(content).toContain("sops_age__list");
    expect(content).toContain("ENC[AES256_GCM");

    // Ensure plaintext sensitive strings from .env.example are NOT stored raw
    expect(content).not.toContain('SESSION_SECRET="replace-me');
    expect(content).not.toContain('ADMIN_SECRET_KEY="replace-me');
  });

  it("ensures .gitignore correctly permits .env*.enc while ignoring private keys", () => {
    const gitignorePath = path.join(rootDir, ".gitignore");
    expect(fs.existsSync(gitignorePath)).toBe(true);

    const content = fs.readFileSync(gitignorePath, "utf-8");
    expect(content).toContain("!.env*.enc");
    expect(content).toContain("*.key");
    expect(content).toContain("keys.txt");
  });

  it("ensures scripts/secrets.mjs exists and is executable", () => {
    const scriptPath = path.join(rootDir, "scripts", "secrets.mjs");
    expect(fs.existsSync(scriptPath)).toBe(true);
  });
});