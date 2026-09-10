# Hybrid Promises returned from synchronous signatures break caller truthiness

**Learned:** 2026-09-04

In an attempt to bridge asynchronous database queries (`PrismaClient`) into functions called synchronously across the action layer (`findServerPetById`), returning a hybrid Thenable object (`Pet & Promise<Pet | null>`) introduces severe runtime regressions. In JavaScript, all `Promise` objects are truthy (`Boolean(new Promise(...)) === true`). When a record exists neither in memory nor in the database, a returned unsettled Promise causes synchronous guards (`if (!pet) return { error: "Pet not found" }`) to evaluate to false. Callers treat non-existent entities as valid, and subsequent synchronous field access (`pet.name`, `pet.status`) evaluates to `undefined`, silently corrupting downstream payloads.

**Rule:** Never return a Promise (or Thenable object) from a function whose public contract is synchronous (`T | null`). Keep synchronous mirror access (`findServerPetById`) and asynchronous database queries (`findServerPetByIdAsync`) as distinct, strictly typed methods.
