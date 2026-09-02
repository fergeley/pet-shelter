/**
 * End-to-end check of the FAQ admin -> public flow against the running app.
 *
 * Invokes the real Server Actions over HTTP (Next-Action header) with a session
 * cookie signed by the app's own HMAC secret, then reads the public page back.
 * Every FAQ it creates is deleted again at the end.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import { createPool } from "./lib/db.mjs";

const BASE = process.env.E2E_BASE || "http://localhost:3459";
const SECRET =
  process.env.SESSION_SECRET || "hope-for-strays-secret-key-32-chars-long-secure-salt!";

// Server Action ids are hashes emitted at build time, so read them out of the
// build rather than hardcoding. This also documents which routes each action is
// reachable on: a "use server" export is POST-reachable on EVERY route that
// imports its module, public ones included.
const manifest = JSON.parse(
  fs.readFileSync(".next/server/server-reference-manifest.json", "utf8")
);
const ACTIONS = {};
const ACTION_ROUTES = {};
for (const [id, entry] of Object.entries(manifest.node ?? {})) {
  const name = entry.exportedName;
  if (name && /Faq/i.test(name)) {
    ACTIONS[name] = id;
    ACTION_ROUTES[name] = Object.keys(entry.workers ?? {});
  }
}

/**
 * POSTs a Server Action to a PUBLIC route and returns the raw response body.
 *
 * Every export of a "use server" module is reachable on any route that imports
 * the module, so /faq and /pets host the admin actions too. Read actions return
 * an array rather than {success}, so this returns the raw text to inspect.
 */
async function callOnPublicRoute(actionId, args, user, route = "/faq") {
  const res = await fetch(`${BASE}${route}`, {
    method: "POST",
    headers: {
      "Next-Action": actionId,
      "Content-Type": "text/plain;charset=UTF-8",
      ...(user ? { Cookie: cookieFor(user) } : {}),
    },
    body: JSON.stringify(args),
  });
  return { status: res.status, body: await res.text() };
}

function sealSession(user, maxAgeSeconds = 86400) {
  const payload = { ...user, expiresAt: Date.now() + maxAgeSeconds * 1000 };
  const b64 = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = crypto.createHmac("sha256", SECRET).update(b64).digest("hex");
  return `${b64}.${sig}`;
}

const cookieFor = (user) => `hope_shelter_session=${sealSession(user)}`;

const ADMIN = {
  id: "usr-admin-01",
  email: "admin@hopeforstrays.org",
  name: "Dr. Sarah Tan",
  role: "ADMIN",
};
const COORDINATOR = {
  id: "usr-coord-01",
  email: "coordinator@hopeforstrays.org",
  name: "Priya Devi",
  role: "COORDINATOR",
};
const STAFF = {
  id: "usr-staff-01",
  email: "staff@hopeforstrays.org",
  name: "Ahmad Razak",
  role: "STAFF",
};
const VOLUNTEER = {
  id: "usr-vol-01",
  email: "volunteer@hopeforstrays.org",
  name: "Mei Ling",
  role: "VOLUNTEER",
};

/** Calls a Server Action and returns its decoded return value. */
async function callAction(name, args, user) {
  const res = await fetch(`${BASE}/admin/faqs`, {
    method: "POST",
    headers: {
      "Next-Action": ACTIONS[name],
      "Content-Type": "text/plain;charset=UTF-8",
      ...(user ? { Cookie: cookieFor(user) } : {}),
    },
    body: JSON.stringify(args),
  });

  const text = await res.text();
  // The Flight stream encodes the action's return value on a line beginning
  // with an object reference such as `1:{"success":true,...}`.
  for (const line of text.split("\n")) {
    const m = line.match(/^[0-9a-f]+:(\{.*\}|\[.*\])$/);
    if (m) {
      try {
        const parsed = JSON.parse(m[1]);
        if (parsed && typeof parsed === "object" && "success" in parsed) return parsed;
      } catch {
        /* keep scanning */
      }
    }
  }
  return { success: false, error: `unparsed (HTTP ${res.status})`, raw: text.slice(0, 300) };
}

async function getText(path, user) {
  const res = await fetch(`${BASE}${path}`, {
    headers: user ? { Cookie: cookieFor(user) } : {},
    cache: "no-store",
  });
  return { status: res.status, body: await res.text() };
}

let passed = 0;
let failed = 0;
function check(label, condition, detail = "") {
  if (condition) {
    passed++;
    console.log(`  PASS  ${label}`);
  } else {
    failed++;
    console.log(`  FAIL  ${label}${detail ? "  -- " + detail : ""}`);
  }
}

const pool = createPool();

const MARKER = `E2E probe ${Date.now()}`;
let createdId = null;
/** (id, displayOrder) of the reordered category, captured before section 8. */
let orderSnapshot = null;

try {
  console.log("\n1. Role gate on /admin/faqs");
  {
    // The admin layout is a client component that renders a "Verifying Staff
    // Session" placeholder during SSR, so no admin page's interactive chrome
    // reaches the server HTML. Assert on the RSC payload instead: an allowed
    // role gets the FAQ rows as props, a denied role gets the refusal text and
    // no data at all.
    const DENIAL = "do not have access to FAQ management";
    const DATA = "All of our adoptions are free of charge";

    const anon = await getText("/admin/faqs");
    check("anonymous is denied", anon.body.includes(DENIAL));
    check("anonymous receives no FAQ data", !anon.body.includes(DATA));

    const admin = await getText("/admin/faqs", ADMIN);
    check("ADMIN is not denied", !admin.body.includes(DENIAL));
    check("ADMIN receives the FAQ rows", admin.body.includes(DATA));

    const coord = await getText("/admin/faqs", COORDINATOR);
    check("COORDINATOR is not denied", !coord.body.includes(DENIAL));
    check("COORDINATOR receives the FAQ rows", coord.body.includes(DATA));

    const staff = await getText("/admin/faqs", STAFF);
    check("STAFF is denied", staff.body.includes(DENIAL));
    check("STAFF receives no FAQ data", !staff.body.includes(DATA));

    const vol = await getText("/admin/faqs", VOLUNTEER);
    check("VOLUNTEER is denied", vol.body.includes(DENIAL));
    check("VOLUNTEER receives no FAQ data", !vol.body.includes(DATA));
  }

  console.log("\n2. Public page is database-backed");
  {
    const faq = await getText("/faq");
    check("/faq returns 200", faq.status === 200);
    check("/faq shows seeded question", faq.body.includes("How much does it cost to adopt"));
    check("/faq shows TNRM answer", faq.body.includes("Trap-Neuter-Release-Manage"));
    const n = await pool.query('select count(*)::int n from "faqs"');
    check(`database holds the 15 seeded rows (got ${n.rows[0].n})`, n.rows[0].n === 15);
  }

  console.log("\n3. Unauthorised callers cannot mutate");
  {
    const anon = await callAction("createFaq", [
      {
        category: "ADOPTION",
        question: "Anonymous injection attempt question?",
        answer: "This must never be written to the database at all.",
        displayOrder: 99,
        isPublished: true,
      },
    ]);
    check("anonymous createFaq is refused", anon.success === false, JSON.stringify(anon));

    const vol = await callAction(
      "createFaq",
      [
        {
          category: "ADOPTION",
          question: "Volunteer injection attempt question?",
          answer: "This must never be written to the database at all.",
          displayOrder: 99,
          isPublished: true,
        },
      ],
      VOLUNTEER
    );
    check("VOLUNTEER createFaq is refused", vol.success === false, JSON.stringify(vol));

    const staff = await callAction(
      "createFaq",
      [
        {
          category: "ADOPTION",
          question: "Staff injection attempt question?",
          answer: "This must never be written to the database at all.",
          displayOrder: 99,
          isPublished: true,
        },
      ],
      STAFF
    );
    check("STAFF createFaq is refused", staff.success === false, JSON.stringify(staff));

    const staffDelete = await callAction("deleteFaq", ["faq-adopt-01"], STAFF);
    check("STAFF deleteFaq is refused", staffDelete.success === false, JSON.stringify(staffDelete));
    const survivor = await pool.query(
      `select count(*)::int n from "faqs" where id = 'faq-adopt-01'`
    );
    check("the targeted seeded row still exists", survivor.rows[0].n === 1);

    const leaked = await pool.query(
      `select count(*)::int n from "faqs" where question like '%injection attempt%'`
    );
    check("no unauthorised row reached the database", leaked.rows[0].n === 0);
  }

  console.log("\n4. Validation is enforced server-side");
  {
    const bad = await callAction(
      "createFaq",
      [
        {
          category: "PAYROLL",
          question: "Q?",
          answer: "short",
          displayOrder: 0,
          isPublished: true,
        },
      ],
      ADMIN
    );
    check("invalid payload is rejected", bad.success === false, JSON.stringify(bad));
  }

  console.log("\n5. ADMIN creates an FAQ, and it appears on /faq immediately");
  {
    const created = await callAction(
      "createFaq",
      [
        {
          category: "VOLUNTEERING",
          question: `${MARKER} — can I volunteer on weekends?`,
          answer:
            "Yes. Weekend shifts run on Saturday and Sunday mornings at the Petaling Jaya sanctuary.",
          questionMs: `${MARKER} — bolehkah saya menjadi sukarelawan pada hujung minggu?`,
          answerMs:
            "Boleh. Syif hujung minggu diadakan pada pagi Sabtu dan Ahad di santuari Petaling Jaya.",
          displayOrder: 50,
          isPublished: true,
        },
      ],
      ADMIN
    );
    check("createFaq succeeds", created.success === true, JSON.stringify(created));
    createdId = created?.data?.id ?? null;
    check("createFaq returns the new id", !!createdId);

    const faq = await getText("/faq");
    check("new question is live on /faq", faq.body.includes(`${MARKER} — can I volunteer`));
    check("Malay translation is stored", faq.body.includes("Syif hujung minggu"));
  }

  console.log("\n6. Editing updates /faq immediately");
  {
    const updated = await callAction(
      "updateFaq",
      [
        createdId,
        {
          category: "VOLUNTEERING",
          question: `${MARKER} — EDITED weekend volunteering hours?`,
          answer: "Updated answer: weekend shifts now start at 9:00 AM.",
          displayOrder: 50,
          isPublished: true,
        },
      ],
      ADMIN
    );
    check("updateFaq succeeds", updated.success === true, JSON.stringify(updated));

    const faq = await getText("/faq");
    check("edited question is live", faq.body.includes(`${MARKER} — EDITED weekend`));
    check("old question is gone", !faq.body.includes(`${MARKER} — can I volunteer`));
    check("edited answer is live", faq.body.includes("weekend shifts now start at 9:00 AM"));
  }

  console.log("\n7. Unpublishing hides it from the public page only");
  {
    const toggled = await callAction("toggleFaqPublished", [createdId, false], ADMIN);
    check("toggleFaqPublished succeeds", toggled.success === true, JSON.stringify(toggled));

    const faq = await getText("/faq");
    check("draft is hidden from /faq", !faq.body.includes(`${MARKER} — EDITED weekend`));

    const admin = await getText("/admin/faqs", ADMIN);
    check("draft still visible in admin", admin.body.includes(`${MARKER} — EDITED weekend`));

    const republished = await callAction("toggleFaqPublished", [createdId, true], ADMIN);
    check("republishing succeeds", republished.success === true);
    const back = await getText("/faq");
    check("republished entry returns to /faq", back.body.includes(`${MARKER} — EDITED weekend`));
  }

  console.log("\n8. Reordering swaps displayOrder within the category");
  {
    const before = await pool.query(
      `select id, "displayOrder" from "faqs" where category='VOLUNTEERING' order by "displayOrder", question`
    );
    // Captured so the finally block can put the seeded rows back exactly as
    // they were, rather than leaving the live ordering reshuffled.
    orderSnapshot = before.rows.map((r) => ({ id: r.id, displayOrder: r.displayOrder }));

    const idx = before.rows.findIndex((r) => r.id === createdId);
    check("probe row is last in its category", idx === before.rows.length - 1);

    // Guard before indexing: with idx <= 0 there is no preceding sibling, and
    // `before.rows[-1].displayOrder` would throw a TypeError that escapes to
    // the outer catch, skipping the remaining sections — including the delete
    // that removes the probe row from the live public page.
    if (idx <= 0) {
      check("cannot test reordering without a preceding sibling", false, `idx=${idx}`);
    } else {
      const neighbour = before.rows[idx - 1];
      const moved = await callAction("reorderFaq", [createdId, "up"], ADMIN);
      check("reorderFaq succeeds", moved.success === true, JSON.stringify(moved));

      // Assert the ordering outcome rather than exact numbers: the action
      // renumbers the category contiguously, so the absolute values change.
      const after = await pool.query(
        `select id, "displayOrder" from "faqs" where category='VOLUNTEERING' order by "displayOrder", question`
      );
      const posMoved = after.rows.findIndex((r) => r.id === createdId);
      const posNeighbour = after.rows.findIndex((r) => r.id === neighbour.id);
      const orders = Object.fromEntries(after.rows.map((r) => [r.id, r.displayOrder]));
      check(
        `moved row now sorts before its neighbour (orders ${before.rows[idx].displayOrder}/${neighbour.displayOrder} -> ${orders[createdId]}/${orders[neighbour.id]})`,
        posMoved === idx - 1 && posNeighbour === idx
      );
      check(
        "the category still holds the same number of rows",
        after.rows.length === before.rows.length
      );
      check(
        "renumbering leaves no negative displayOrder",
        after.rows.every((r) => r.displayOrder >= 0),
        JSON.stringify(orders)
      );
    }

    const atTop = await pool.query(
      `select id from "faqs" where category='VOLUNTEERING' order by "displayOrder", question limit 1`
    );
    const noop = await callAction("reorderFaq", [atTop.rows[0].id, "up"], ADMIN);
    check("moving the first entry up is a safe no-op", noop.success === true);
  }

  console.log("\n9. Every mutation was written to the audit log");
  {
    const logs = await pool.query(
      `select action from "audit_logs" where "targetId" = $1 order by "createdAt"`,
      [createdId]
    );
    const actions = logs.rows.map((r) => r.action);
    for (const expected of [
      "FAQ_CREATED",
      "FAQ_UPDATED",
      "FAQ_UNPUBLISHED",
      "FAQ_PUBLISHED",
      "FAQ_REORDERED",
    ]) {
      check(`audit log contains ${expected}`, actions.includes(expected), actions.join(","));
    }
    const actor = await pool.query(
      `select "actorEmail", "actorRole" from "audit_logs" where "targetId" = $1 limit 1`,
      [createdId]
    );
    check(
      "audit log records the acting admin",
      actor.rows[0]?.actorEmail === ADMIN.email && actor.rows[0]?.actorRole === "ADMIN",
      JSON.stringify(actor.rows[0])
    );
  }

  console.log("\n10. Read actions are POST-reachable on public routes and must not leak drafts");
  {
    console.log(
      `     getAdminFaqs is registered on: ${(ACTION_ROUTES.getAdminFaqs ?? []).join(", ")}`
    );
    check(
      "getAdminFaqs really is hosted on a public route",
      (ACTION_ROUTES.getAdminFaqs ?? []).some((r) => r === "app/faq/page" || r === "app/pets/page")
    );

    // Hide the probe entry so there is a draft that only getAdminFaqs can see.
    await callAction("toggleFaqPublished", [createdId, false], ADMIN);
    const draftText = `${MARKER} — EDITED weekend`;

    const anon = await callOnPublicRoute(ACTIONS.getAdminFaqs, [], null, "/faq");
    check("anonymous getAdminFaqs does not return drafts", !anon.body.includes(draftText));

    const vol = await callOnPublicRoute(ACTIONS.getAdminFaqs, [], VOLUNTEER, "/faq");
    check("VOLUNTEER getAdminFaqs does not return drafts", !vol.body.includes(draftText));

    const admin = await callOnPublicRoute(ACTIONS.getAdminFaqs, [], ADMIN, "/faq");
    check("ADMIN getAdminFaqs still returns drafts", admin.body.includes(draftText));

    const pub = await callOnPublicRoute(ACTIONS.getPublicFaqs, [], null, "/faq");
    check("anonymous getPublicFaqs returns published content", pub.body.includes("TNRM"));
    check("anonymous getPublicFaqs omits drafts", !pub.body.includes(draftText));

    await callAction("toggleFaqPublished", [createdId, true], ADMIN);
  }

  console.log("\n11. Deleting removes it from /faq");
  {
    const deleted = await callAction("deleteFaq", [createdId], ADMIN);
    check("deleteFaq succeeds", deleted.success === true, JSON.stringify(deleted));
    createdId = null;

    const faq = await getText("/faq");
    check("deleted entry is gone from /faq", !faq.body.includes(MARKER));

    const remaining = await pool.query('select count(*)::int n from "faqs"');
    check(
      `database is back to the 15 seeded rows (got ${remaining.rows[0].n})`,
      remaining.rows[0].n === 15
    );
  }
} catch (e) {
  failed++;
  console.error("\nUNEXPECTED ERROR:", e);
} finally {
  if (createdId) {
    await pool.query('delete from "faqs" where id = $1', [createdId]).catch(() => {});
    console.log("\ncleanup: removed leftover probe row");
  }
  await pool.query(`delete from "faqs" where question like '%E2E probe%'`).catch(() => {});

  // Section 8 rewrites displayOrder on real seeded rows. Restore them here
  // rather than printing a note asking a human to re-run the seeder: this
  // suite runs against the Neon production branch, so a forgotten follow-up
  // would leave the public FAQ page permanently reshuffled for real visitors.
  if (orderSnapshot) {
    let restored = 0;
    for (const row of orderSnapshot) {
      if (row.id === createdId) continue;
      const r = await pool
        .query('update "faqs" set "displayOrder" = $1 where id = $2 and "displayOrder" <> $1', [
          row.displayOrder,
          row.id,
        ])
        .catch(() => null);
      if (r?.rowCount) restored += r.rowCount;
    }
    console.log(`cleanup: probe rows removed, ${restored} seeded displayOrder value(s) restored`);
  } else {
    console.log("cleanup: probe rows removed");
  }
  await pool.end();
}

console.log(`\n================  ${passed} passed, ${failed} failed  ================`);
process.exit(failed === 0 ? 0 : 1);
