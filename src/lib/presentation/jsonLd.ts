/**
 * Serialise structured data for an inline `<script type="application/ld+json">`.
 *
 * `JSON.stringify` is not enough on its own, and the gap is a stored XSS. It leaves `<` as-is, and
 * the HTML parser ends a script element at the first `</script>` it meets *regardless* of the
 * `type` — it does not know the contents are JSON. So a pet name of
 * `</script><script>…</script>` (38 characters, inside the 60 the form allows) closed the JSON-LD
 * block on `/pets/[id]` and ran as script for every visitor to that profile, staff included.
 * Anyone with MANAGE_PETS could plant it.
 *
 * The fix, which the Next 16 guide prescribes (`02-guides/json-ld`, bundled under
 * `node_modules/next/dist/docs/01-app/`): replace every less-than sign with the six-character JSON
 * unicode escape for it — a backslash, the letter u, then the hex digits 003c. That escape means
 * the same character to any JSON reader, so a crawler, or `JSON.parse`, reads back exactly the
 * object that was written, while the HTML parser never sees a `<` inside the element.
 *
 * **The escape is spelled out in words above on purpose. Do not "tidy" it into the literal.** This
 * comment was first written with the escape sequence itself, and the tool that wrote the file
 * decoded it — so it read "escape `<` as `<`", describing a no-op over a line that is not one. A
 * reader trusting that comment could reasonably delete the `.replace` as redundant and reopen the
 * hole. `tests/unit/pets/jsonLd.test.ts` fails if the escape stops working.
 *
 * Typed `object` rather than `unknown`: `JSON.stringify` returns `undefined` — not a string — for
 * `undefined` or a function, and `.replace` on that would throw and take the page render with it.
 */
export function serializeJsonLd(data: object): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
