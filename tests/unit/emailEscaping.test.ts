import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Free text typed into a public form must not reach an HTML email body as markup.
 *
 * `escapeHtml()` has existed since the receipt rebuild, but it was applied to two
 * fields and the rest were left — a list the repo's own todo carried as an open
 * task. Per-field assertions would have pinned those two and said nothing about
 * the next field someone interpolates, so this is a source-text guard instead:
 * it re-derives the gap list from the file every run.
 *
 * The plain-text half is deliberately excluded. Escaping there is not neutral —
 * it would show the reader a literal `&amp;` where they should see `&`.
 */
const EMAIL_SOURCE = resolve(process.cwd(), "src/lib/email.ts");

/** Interpolation bodies that carry text a member of the public typed. */
const FORM_SUPPLIED =
  /\b(donorName|donorEmail|donorPhone|tierName|taxIdOrIc|targetPetName|notes|applicantName|applicantNotes|coordinatorNotes|currentPets|currentPetDetails|address|petName|petBreed|housingType|experienceDescription|message|adminNotes|adminReviewNotes|location)\b/;

/** `${ ... }`, tolerating one level of nested braces. */
const INTERPOLATION = /\$\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g;

interface Interpolation {
  line: number;
  expression: string;
  escaped: boolean;
}

/**
 * Walks the file tracking which template literal each line sits in.
 *
 * A sender builds up to three: `plainText`, `html`, and — in the status-update
 * mail — a `messageBody` fragment spliced into `html` later. The third is why
 * this tracks assignment names rather than assuming one HTML block per function.
 */
function htmlInterpolations(source: string): Interpolation[] {
  const found: Interpolation[] = [];
  let mode: "text" | "html" | null = null;

  source.split("\n").forEach((line, index) => {
    if (/const plainText\s*=\s*`/.test(line)) mode = "text";
    else if (/const html\s*=\s*wrapEmailHtml\(`/.test(line) || /const html\s*=\s*`/.test(line))
      mode = "html";
    else if (/messageBody\s*=\s*`/.test(line)) mode = "html";
    else if (/^\s*`\)?[;.]/.test(line) || /`\.trim\(\)/.test(line)) mode = null;

    if (mode !== "html") return;

    for (const match of line.matchAll(INTERPOLATION)) {
      const expression = match[1].trim();
      if (!FORM_SUPPLIED.test(expression)) continue;
      found.push({
        line: index + 1,
        expression,
        escaped: expression.includes("escapeHtml"),
      });
    }
  });

  return found;
}

describe("email HTML escaping", () => {
  const source = readFileSync(EMAIL_SOURCE, "utf8").replace(/\r\n/g, "\n");
  const interpolations = htmlInterpolations(source);

  it("still finds the HTML bodies it is meant to be checking", () => {
    // Guard the guard. If a sender is renamed or restructured so the walker stops
    // recognising its template literal, this suite would otherwise pass by
    // checking nothing at all — the failure mode that makes source-text guards
    // worthless. The count only grows as senders are added.
    expect(
      interpolations.length,
      "The walker found almost no form-supplied values in any HTML body, which means " +
        "it has lost track of the template literals rather than that the file is clean. " +
        "Check the `const html` / `messageBody` patterns in htmlInterpolations()."
    ).toBeGreaterThanOrEqual(30);
  });

  it("escapes every form-supplied value it places in an HTML body", () => {
    const unescaped = interpolations
      .filter((entry) => !entry.escaped)
      .map((entry) => `src/lib/email.ts:${entry.line}  \${${entry.expression}}`);

    expect(
      unescaped,
      "A donor or applicant typed these, and they are being written into an email as markup. " +
        "Wrap each one in escapeHtml() at the call site — not where `fields` is built, because " +
        "the plain-text body reads the same object and must stay unescaped."
    ).toEqual([]);
  });
});
