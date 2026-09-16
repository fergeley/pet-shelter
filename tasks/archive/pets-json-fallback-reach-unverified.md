# Fallback-path reach is unverified

**Status:** OBSOLETE · settled 2026-08-28 · archived 2026-09-10 · verified that production Neon DB runs populated with live pets

The stale-age fix matters only where `getServerPetsAsync` falls back to the `pets.json` fixture.
That the fixture data *was* stale is measured; that production ever serves it is not.

`DonationWidget` reads `pets.json` directly whenever it gets no `initialPets` prop, so at least one
public surface does not depend on the database at all.

**Settles when:** someone confirms whether the deployed site runs with a populated database.
