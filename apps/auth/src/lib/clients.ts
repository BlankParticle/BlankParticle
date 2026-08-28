/** Client identity helpers shared by the API and the pages. Runtime-safe, no worker imports. */

/**
 * Two kinds of client, neither registered:
 * - `origin:<https origin>` for web apps — derived from where the code is sent back to
 * - `com.example.app` (reverse-DNS) for native apps and CLIs — used with loopback redirects or the device flow
 */
export const NATIVE_CLIENT_ID = /^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)+$/;

/** `client_id` for a web app is the origin the code is sent back to */
export const clientFor = (redirectUri: string) => `origin:${new URL(redirectUri).origin}`;

export const isLoopback = (url: URL) => url.protocol === "http:" && ["127.0.0.1", "localhost"].includes(url.hostname);

/** What one approval covers: web loopback clients pick a fresh port every run (RFC 8252), so the port is dropped */
export function clientKey(clientId: string) {
  if (!clientId.startsWith("origin:")) return clientId;
  const url = new URL(clientId.slice("origin:".length));
  return isLoopback(url) ? `origin:${url.protocol}//${url.hostname}` : clientId;
}

/** `origin:https://x` → `https://x` for display; native ids are shown as they are */
export const originOf = (clientId: string) => clientId.replace(/^origin:/, "");

/** Device-flow user codes: 8 letters from an unambiguous alphabet, shown as `XXXX-XXXX` */
export const USER_CODE_ALPHABET = "BCDFGHJKLMNPQRSTVWXZ";
export const USER_CODE_LENGTH = 8;
export const normalizeUserCode = (input: string) => input.toUpperCase().replace(/[^A-Z]/g, "");
export const formatUserCode = (code: string) => `${code.slice(0, 4)}-${code.slice(4)}`;
