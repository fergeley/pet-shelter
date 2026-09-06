# Development checkouts live on the native Windows Developer Drive

**Decided:** 2026-09-06

Ordinary development checkouts live under `D:\Dev\Repos` and use native Windows Git, Node.js, VS Code, and Codex. The VS Code WSL extension remains installed, but these repositories are not opened through `/mnt/d`.

This choice uses the explicitly provisioned Developer Drive, keeps the local Obsidian integration simple, and avoids mixing Linux tools with Windows-mounted working-tree semantics. If a project later requires a Linux-native environment, create a separate checkout inside the WSL Linux filesystem and open it with Remote - WSL; do not reinterpret the `D:` checkout as a WSL repository.

Eighteen repositories were copied and compared exactly before their original locations were retired to recoverable `.migrated-backup` directories. Dirty working trees and local-only files were preserved. The engineering wiki remained inside the Obsidian vault on `C:`.

Implementation details, inventory, recovery steps, and evidence are recorded in [`docs/runbooks/RUNBOOK_CODEX_DEVELOPER_DRIVE.md`](../../docs/runbooks/RUNBOOK_CODEX_DEVELOPER_DRIVE.md).

Reverse this decision only for a concrete Linux-native requirement. The safe reversal is a fresh or verified checkout inside the WSL filesystem, not access to the Windows checkout through `/mnt/d`.
