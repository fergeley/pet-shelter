# A client-side layout gate says nothing about what the payload contains

**Learned:** 2026-09-03

`/admin/pets` is a Server Component calling an unguarded `getAdminPets()`. The admin layout renders
a spinner until its session effect resolves, so the table never appeared — but server-component
output is serialised into the RSC flight payload regardless, and an anonymous request received the
whole inventory: 75,453 bytes with `applicationCount`, `rescueStory` and pet names. When adding
authorization anywhere, enumerate every sibling entry point. "The UI does not render it" is not a
boundary.
