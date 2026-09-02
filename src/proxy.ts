import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, unsealSession } from "@/lib/security/sessionToken";
import { PERMISSIONS, roleHasPermission, type Permission } from "@/lib/security/permissions";

/**
 * Pre-render authorization for privileged admin routes.
 *
 * This exists for one reason: HTTP status. A page that calls `forbidden()`
 * renders the 403 UI, but the response has already begun streaming as a 200 and
 * Next.js cannot change the status once headers are sent (see
 * node_modules/next/dist/docs/.../loading.md, "Status Codes"). The check has to
 * run before the response streams to produce a real 403, and proxy is where
 * that happens.
 *
 * It is a status layer, not the security boundary. The page and every server
 * action guard themselves independently, and only they can see database state
 * such as a suspension, which this signature-only check cannot. Deleting this
 * file would cost the correct status code, not the protection.
 *
 * Proxy runs on the Node.js runtime in Next 16, so the real token codec and
 * permission matrix are reused here rather than reimplemented.
 */

/** Routes that must answer with an accurate status before rendering. */
const GUARDED_ROUTES: { prefix: string; permission: Permission }[] = [
  { prefix: "/admin/members", permission: PERMISSIONS.MANAGE_MEMBERS },
];

function denialResponse(status: 401 | 403, title: string, message: string): NextResponse {
  // Deliberately minimal: this is a network-boundary rejection, and the styled
  // in-app equivalents are src/app/forbidden.tsx and src/app/unauthorized.tsx.
  const body = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${status} ${title}</title>
</head>
<body style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;margin:0;display:flex;min-height:100vh;align-items:center;justify-content:center;background:#f8fafc;color:#1e293b">
<main style="max-width:32rem;padding:2rem;text-align:center">
<p style="font-size:.75rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#b91c1c;margin:0 0 .5rem">${status} — ${title}</p>
<h1 style="font-size:1.5rem;margin:0 0 .75rem">${message}</h1>
<p style="font-size:.875rem;color:#64748b;margin:0 0 1.5rem">Ask a Super Admin to review your role under Staff &amp; Permissions.</p>
<a href="/admin/pets" style="font-size:.75rem;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:#1e293b;border:1px solid #cbd5e1;padding:.6rem 1rem;text-decoration:none">Back to Admin</a>
</main>
</body>
</html>`;

  return new NextResponse(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex",
    },
  });
}

export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  const guard = GUARDED_ROUTES.find(
    (route) => pathname === route.prefix || pathname.startsWith(`${route.prefix}/`)
  );
  if (!guard) return NextResponse.next();

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? unsealSession(token) : null;

  if (!session) {
    return denialResponse(401, "Sign in required", "Your session has ended");
  }

  // roleHasPermission normalises the role, so a cookie issued before the RBAC
  // migration (role "ADMIN") is still recognised as a Super Admin here.
  if (!roleHasPermission(session.role, guard.permission)) {
    return denialResponse(403, "Forbidden", "You do not have access to this area");
  }

  return NextResponse.next();
}

export const config = {
  // Scoped to the guarded routes so static assets, images and every other page
  // bypass this entirely.
  matcher: ["/admin/members", "/admin/members/:path*"],
};
