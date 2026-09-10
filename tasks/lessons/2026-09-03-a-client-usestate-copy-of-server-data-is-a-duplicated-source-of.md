# A client `useState` copy of server data is a duplicated source of truth

**Learned:** 2026-09-03

The members table seeded `useState` from an `initialMembers` prop, so the server and the client each
believed they owned the roster. Every symptom — an extra round-trip, reconciliation code, a
staleness window — came from that one decision. `revalidatePath` in a Server Action already
re-renders the route and ships new props in the same response, but client state is *preserved*
across that re-render, so the copy silently shadowed them. Deleting the copy deleted all of it.
Server owns data, client owns view state.
