/** Restrict email sign-in links to our own web origins. */
export function getAuthCallbackUrl(rawOrigin: string): string | null {
  let origin: URL;
  try {
    origin = new URL(rawOrigin);
  } catch {
    return null;
  }

  if (origin.origin !== rawOrigin || origin.username || origin.password) return null;

  const allowedOrigins = new Set<string>();
  const configuredSite = process.env.NEXT_PUBLIC_SITE_URL;
  if (configuredSite) {
    try {
      const configuredOrigin = new URL(configuredSite);
      if (configuredOrigin.protocol === "https:" && configuredOrigin.origin === configuredSite) {
        allowedOrigins.add(configuredOrigin.origin);
      }
    } catch {
      // A malformed configuration must not widen the redirect allowlist.
    }
  }

  const localDevelopment = process.env.NODE_ENV === "development" &&
    origin.protocol === "http:" && origin.hostname === "localhost";
  if (!allowedOrigins.has(rawOrigin) && !localDevelopment) return null;
  return `${rawOrigin}/auth/callback`;
}
