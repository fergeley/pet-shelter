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

