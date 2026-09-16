import { describe, it, expect } from "vitest";
import { serializeJsonLd } from "@/lib/presentation/jsonLd";

/**
 * The pet profile inlines its structured data in a `<script type="application/ld+json">`. The HTML
 * parser ends that element at the first `</script>` in the text, whatever the `type` says, so the
 * serialised JSON must never contain one — or a pet's name becomes script on a public page.
 */
describe("serializeJsonLd", () => {
  const payload = "</script><script>alert(document.cookie)</script>";

  it("never emits a sequence that can close the script element", () => {
    const html = serializeJsonLd({ "@type": "Product", name: payload, description: payload });

    // Checked case-insensitively: the parser closes on `</SCRIPT` too.
    expect(html.toLowerCase()).not.toContain("</script");
    expect(html).not.toContain("<");
  });

  it("still parses back to exactly the object that was written", () => {
    // The six-character unicode escape the serialiser writes (backslash, u, 003c — spelled out,
    // because tooling has decoded the literal back into `<` once already) is a JSON escape for the
    // same character, so crawlers see the real name — the fix
    // must not have mangled the data to make it safe.
    const data = { "@type": "Product", name: payload, offers: { price: "0", note: "a < b" } };

    expect(JSON.parse(serializeJsonLd(data))).toEqual(data);
  });
});
