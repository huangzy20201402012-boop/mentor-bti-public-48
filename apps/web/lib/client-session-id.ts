type ClientCrypto = Pick<Crypto, "randomUUID" | "getRandomValues">;

/**
 * randomUUID is unavailable on some phones when a LAN development URL uses HTTP.
 * This ID is only a local result-storage key, so a timestamp fallback is enough.
 */
export function createClientSessionId(options?: { cryptoSource?: ClientCrypto | null; now?: number; random?: () => number }): string {
  const cryptoSource = options?.cryptoSource === undefined ? globalThis.crypto : options.cryptoSource;
  if (typeof cryptoSource?.randomUUID === "function") {
    try { return cryptoSource.randomUUID(); } catch { /* insecure HTTP contexts can throw here */ }
  }

  if (typeof cryptoSource?.getRandomValues === "function") {
    try {
      const values = cryptoSource.getRandomValues(new Uint32Array(2));
      return `quick-${values[0]!.toString(36)}${values[1]!.toString(36)}`;
    } catch { /* use the non-cryptographic local-storage-key fallback below */ }
  }

  const now = (options?.now ?? Date.now()).toString(36);
  const random = (options?.random ?? Math.random)().toString(36).slice(2, 10);
  return `quick-${now}-${random}`;
}
