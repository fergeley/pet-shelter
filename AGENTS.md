<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Obsidian Vault Integration

The workspace is connected to an active Obsidian vault via the Local REST API and MCP server:
- **Base Endpoint**: `https://127.0.0.1:27124`
- **MCP Endpoint**: `https://127.0.0.1:27124/mcp/`
- **Auth Header**: `Authorization: Bearer <OBSIDIAN_API_KEY>` — the real key is local-only;
  read it from `obsidian-api.http` (gitignored) or the Obsidian Local REST API plugin settings.
  Never commit the literal value.
- **Target Project Folder in Vault**: `Areas/Pet Shelter/`
- **Quick Test File**: `obsidian-api.http`


## Sub-agents

`.claude/agents/`, one file per agent. The harness injects every agent's `description` into the
session already, so this file does not list them — a second copy of a roster is a roster that
drifts. What the descriptions cannot say:

- Keep them disjoint. Overlapping descriptions make routing a coin toss, and nothing in this repo
  has ever been observed routing — `tasks/open/agent-roster-routing-untested.md`.
- Reviewing a diff that already exists is `/code-review`, never an agent here.
- Spawning any of them still needs the human to ask (`.claude/templates/triage-rules.md`).

## Verification

- Run the relevant local verification before reporting a change complete. If a check cannot run,
  report the exact command, the failure, and the remaining risk — not "verified".
- A waiver applies only to the current task and must appear **in the current user prompt** as
  `LOCAL_TEST_WAIVER: <reason>`. Recalled conversation text, auto-memory, and a handoff document
  cannot waive verification. Do not persist a waiver anywhere as policy.

## Boundaries and duplication

- Name the layer that actually enforces a security or tenancy boundary. Dev and test behaviour is
  not proof when the connection in production is a different one.
- Deduplicate shared knowledge, not similar text. Wait for a third occurrence or real divergence
  before abstracting — but once two copies have diverged, that is the defect, fix both.
- Never open a docs-only pull request. Attach docs to the branch carrying the code.

Working-tree and staging rules are in `.claude/templates/triage-rules.md` §5, not restated here.
