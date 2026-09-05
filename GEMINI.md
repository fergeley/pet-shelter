# GEMINI.md

## Operating Context for Antigravity / Gemini

This file specifies Gemini- and Antigravity-specific behaviors for this repository. Universal repo rules live in `AGENTS.md`.

## Context & Session Hygiene

- **Session reset threshold**: Delegate or start a fresh session at **200K–300K tokens**. While Gemini supports a 1M–2M window, multi-needle precision in active agentic coding drops under long tool traces.
- **Subagent delegation**: Proactively delegate codebase sweeps, multi-file searches, and log audits to the `research` subagent (`invoke_subagent`). Never dump large file scans into the main session.
- **Artifact-driven handoff**: Maintain state in `implementation_plan.md` and `walkthrough.md`. Before crossing the 300K threshold or upon finishing a major milestone in the plan, summarize progress in the artifact so the user can start a fresh session seamlessly.
