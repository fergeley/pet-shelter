# The server-action auth guard extracts action bodies via TypeScript AST

**Decided:** 2026-09-22

Settles `tasks/open/server-action-auth-guard-slices-bodies-by-the-next-export.md`.

## What changed

In `tests/unit/serverActionAuth.test.ts`, `collectServerActions` formerly sliced module source text from one `export async function` match to the next `export async function`. That positional slicing caused any intermediate non-exported functions (such as private helper `getAdminActorOrThrow` in `src/actions/pets.ts`) to be attributed into the body of the preceding action (`getPetById`), falsely conferring authorization tokens.

`collectServerActions` now uses `ts.createSourceFile` from the project's installed `typescript` package to inspect AST function declarations and exported variable statements (e.g. `export const action = async () => ...` and `export const action = async function() ...`). For each exported async action, `node.body.getText(sourceFile)` or `decl.initializer.body.getText(sourceFile)` extracts strictly that action's body.

## Why AST over regex brace matching

A naive brace scanner (e.g. scanning for the first `{` following the export keyword) fails on TypeScript return type annotations containing object types (e.g. `: Promise<{ success: boolean; error?: string }>`) or parameter destructuring patterns, stopping prematurely at the type definition's closing brace and misclassifying 29 actions as unguarded. Using the official TypeScript AST compiler API parses all 66 server actions across 14 modules in ~260ms with complete syntactic precision and zero regex edge cases, while also seamlessly covering both function declarations and exported arrow function / expression variable statements.

## Verification

- `tests/unit/serverActionAuth.test.ts`:
  - Added unit test `does not attribute private helper auth tokens to preceding exported actions` demonstrating that an unallowlisted action followed by a private helper with `verifyAdminSession` is correctly recognized as unguarded.
  - Added unit test `extracts and audits exported async arrow functions and function expressions` demonstrating that arrow-function-style server actions are extracted and checked for authorization tokens.
- Verified against all current server action files: all 66 actions pass cleanly with zero unexpected unguarded exports.
