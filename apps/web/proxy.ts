import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Next.js 16 calls this file `proxy.ts`; the same hook was `middleware.ts` in
 * earlier majors. It exists solely to refresh the Supabase session cookie on the
 * way in. Page authorization is enforced in the routes and by database
 * row-level security, so a request that skips this file cannot read a result.
 *
 * An unconfigured site still serves public pages; account-only pages show
 * their login gate.
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) return response;

  try {
    const supabase = createServerClient(url, publishableKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          // The refreshed cookies are written onto the request first so that
          // anything rendering downstream in this same pass already sees the
          // new session, then onto the response for the browser.
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
          // Without these the response could be cached and one user's session
          // token served to another.
          for (const [headerName, headerValue] of Object.entries(headers)) {
            response.headers.set(headerName, headerValue);
          }
        }
      }
    });

    // Touching the claims is what triggers the refresh; the result is unused
    // because nothing here decides access.
    await supabase.auth.getClaims();
  } catch {
    // Offline or misconfigured. Let the request through unchanged: an
    // unreachable auth service must not take the whole site down with it.
    return response;
  }

  return response;
}

export const config = {
  matcher: [
    // Everything except Next.js build output, static assets and the API routes.
    //
    // `/api` is excluded on purpose: every route under it authenticates with the
    // service role plus an anonymous session id, and they are called on the
    // analytics hot path (a beacon per checkpoint). Running a session refresh in
    // front of each one would add a Supabase round trip to requests that have no
    // use for the result. Pages, which is where the session actually renders,
    // all still traverse this file.
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)"
  ]
};
