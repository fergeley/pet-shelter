# SOPS cannot decrypt the production environment file because its timestamp contains a carriage return

**Status:** open · opened 2026-09-06

`npm run secrets:check` printed:

```text
[FAIL] Decrypting .env.production.enc failed:
parsing time "2026-08-27T16:18:08Z\x0d": extra text: "\x0d"
```

The command nevertheless exited with status 0. The migration's byte-for-byte comparison means this is not evidence of ReFS or Robocopy corruption; the encrypted file and repository state were preserved from the source checkout.

It is asserted from the error, but not yet independently measured, that a carriage return reaches SOPS's timestamp parser. The two practical risks are that the documented flow cannot currently recover production secrets and that automation may accept a failed secrets check because the wrapper exits successfully.

Do not normalize or re-encrypt the only copy while diagnosing. Preserve a backup, confirm the intended line-ending/encryption format, and prove successful decryption with the configured age key before replacing anything. Never record decrypted values in this ledger or command output.

**Settles when:** the existing production environment can be decrypted with the configured age key, `npm run secrets:check` exits nonzero on a decryption failure, and a secret-free regression test covers the relevant CRLF/timestamp case.
