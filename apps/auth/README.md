# BlankParticle Auth

BlankParticle Auth is a registration-free OAuth broker. Web apps can add sign-in with a hosted
script and a normal link—no package, build plugin, client secret, or callback server is required.

## Two-line setup

```html
<script src="https://auth.blankparticle.com/auth.js"></script>
<a href="https://auth.blankparticle.com/authorize?redirect_uri=https%3A%2F%2Fexample.com%2Fauth%2Fcallback">
  Sign in
</a>
```

`auth.js` intercepts that link and adds an S256 PKCE challenge, state, the derived web client ID,
and `client_type=web`. After GitHub sign-in, the broker redirects to `/auth/callback`; the script
validates state, exchanges the authorization code through the CORS-enabled `/token` endpoint,
stores the identity, removes the callback parameters, and returns to the page that started sign-in.

The app's client ID is derived from its redirect origin (`origin:https://example.com`), so there is
no registration step. Different origins receive different pairwise user IDs.

The callback path must be served by the app and load `auth.js`. A single-page app fallback is
enough; no callback-specific application code is needed.

## Reading identity

```js
const identity = window.BPAuth.getIdentity();

identity.userId; // stable pairwise ID for this app origin, or null
identity.token; // signed id_token, or null
identity.claims; // decoded JWT claims for display only
```

The identity is stored in `localStorage` under `bp_identity` by default. Decoded browser claims are
not proof of identity. Send the token to your server and verify its ES256 signature, issuer,
audience, and expiration against `/.well-known/jwks.json` before authorizing anything.

## Programmatic use

```js
// Basic sign-in
window.BPAuth.startSignIn();

// Return somewhere specific after the callback
window.BPAuth.startSignIn({ returnTo: "/dashboard" });

// Ask for GitHub profile claims after user consent
window.BPAuth.startSignIn({ requestPii: true });

// Request a token for an HTTPS API origin
window.BPAuth.startSignIn({ resource: "https://api.example.com" });

// Revoke the current token and clear local identity
window.BPAuth.signOut();
```

The public API also exposes `checkSession()`, `startSessionMonitor()`, `handleCallback()`,
`clearIdentity()`, and the lower-level PKCE/callback helpers on `window.BPAuth`.

## Script configuration

Options are set as `data-*` attributes on the script:

```html
<script
  src="https://auth.blankparticle.com/auth.js"
  data-callback-path="/signed-in"
  data-storage-key="my_identity"
  data-client-name="Example App"
  data-logo-uri="https://example.com/logo.png"
></script>
```

| Attribute                      | Default                  | Purpose                                                    |
| ------------------------------ | ------------------------ | ---------------------------------------------------------- |
| `data-base-url`                | Origin serving `auth.js` | Override the auth broker, primarily for local development. |
| `data-callback-path`           | `/auth/callback`         | Local path that receives the authorization response.       |
| `data-storage-key`             | `bp_identity`            | `localStorage` key for the identity.                       |
| `data-client-name`             | none                     | Name shown on consent and account pages.                   |
| `data-logo-uri`                | none                     | HTTPS logo shown with the client name.                     |
| `data-auto-callback="false"`   | enabled                  | Disable automatic callback exchange.                       |
| `data-session-monitor="false"` | enabled                  | Disable background revocation checks.                      |

## Plain-link parameters

The zero-setup link understands these optional parameters in addition to `redirect_uri`:

- `pii=true` requests GitHub name, username, picture, and email after consent.
- `resource=https://api.example.com` changes the token audience to that HTTPS origin.
- `client_name` and `logo_uri` describe the app on consent screens.
- `return_to` controls the local page restored after callback processing.

Web clients use this script. Native apps and CLIs use `client_type=native` with a reverse-DNS
client ID and loopback redirect, or the RFC 8628 device flow through `/device/code`.

The design follows the same hosted-script, automatically upgraded PKCE flow demonstrated by
[Shoo's vanilla JavaScript integration](https://docs.shoo.dev/docs/getting-started-vanilla).
