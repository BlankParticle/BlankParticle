/**
 * BlankParticle Auth browser client.
 *
 * Add this script and a plain /authorize link. The script supplies PKCE and state, handles the
 * callback, exchanges the code, and stores the resulting identity without requiring a build step.
 */
(() => {
  const script = document.currentScript;
  const options = script?.dataset ?? {};
  const baseUrl = options.baseUrl || (script ? new URL(script.src).origin : location.origin);
  const config = {
    callbackPath: options.callbackPath || "/auth/callback",
    storageKey: options.storageKey || "bp_identity",
    pkceKey: "bp_pkce",
    returnToKey: "bp_return_to",
    fallbackPath: "/",
    sessionMonitorIntervalMs: 60_000,
    clientName: options.clientName,
    logoUri: options.logoUri,
  };

  const base64url = (bytes) =>
    btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

  const randomString = (length) => base64url(crypto.getRandomValues(new Uint8Array(length)));

  const readJson = (storage, key) => {
    try {
      return JSON.parse(storage.getItem(key) || "null");
    } catch {
      return null;
    }
  };

  const redirectUriFor = (params = {}) => params.redirectUri || new URL(config.callbackPath, location.origin).href;

  const clientIdFor = (redirectUri) => `origin:${new URL(redirectUri).origin}`;

  async function createPkceBundle() {
    const verifier = randomString(48);
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
    return {
      state: randomString(24),
      verifier,
      challenge: base64url(new Uint8Array(digest)),
      createdAt: Date.now(),
    };
  }

  function createSignInUrl(params) {
    const redirectUri = redirectUriFor(params);
    const url = new URL("/authorize", baseUrl);
    url.searchParams.set("client_type", "web");
    url.searchParams.set("client_id", clientIdFor(redirectUri));
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("state", params.state);
    url.searchParams.set("code_challenge", params.challenge);
    url.searchParams.set("code_challenge_method", "S256");
    if (params.requestPii) url.searchParams.set("pii", "true");
    if (params.resource) url.searchParams.set("resource", params.resource);

    const clientName = params.clientName || config.clientName;
    const logoUri = params.logoUri || config.logoUri;
    if (clientName) url.searchParams.set("client_name", clientName);
    if (logoUri) url.searchParams.set("logo_uri", logoUri);
    return url.href;
  }

  async function startSignIn(params = {}) {
    const pkce = await createPkceBundle();
    const redirectUri = redirectUriFor(params);
    sessionStorage.setItem(config.pkceKey, JSON.stringify({ ...pkce, redirectUri }));
    sessionStorage.setItem(config.returnToKey, params.returnTo || location.pathname + location.search + location.hash);
    location.assign(
      createSignInUrl({
        ...params,
        redirectUri,
        state: pkce.state,
        challenge: pkce.challenge,
      }),
    );
  }

  function parseCallback(href = location.href) {
    const url = new URL(href);
    return {
      code: url.searchParams.get("code"),
      state: url.searchParams.get("state"),
      error: url.searchParams.get("error"),
    };
  }

  function clearCallbackParams() {
    const url = new URL(location.href);
    for (const name of ["code", "state", "error"]) url.searchParams.delete(name);
    history.replaceState(history.state, "", url.href);
  }

  async function exchangeCode({ code, codeVerifier, redirectUri }) {
    const response = await fetch(new URL("/token", baseUrl), {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: clientIdFor(redirectUri),
        redirect_uri: redirectUri,
        code,
        code_verifier: codeVerifier,
      }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(body?.error || `token exchange failed (${response.status})`);
    }
    return response.json();
  }

  function decodeClaims(token) {
    try {
      const encoded = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
      const padded = encoded.padEnd(Math.ceil(encoded.length / 4) * 4, "=");
      return JSON.parse(atob(padded));
    } catch {
      return null;
    }
  }

  const emptyIdentity = () => ({ userId: null, token: null, claims: null });
  const getIdentity = () => readJson(localStorage, config.storageKey) || emptyIdentity();

  function persistIdentity(userId, token, extras = {}) {
    const identity = {
      userId,
      token,
      claims: decodeClaims(token),
      receivedAt: Date.now(),
      ...extras,
    };
    localStorage.setItem(config.storageKey, JSON.stringify(identity));
    return identity;
  }

  const clearIdentity = () => localStorage.removeItem(config.storageKey);

  async function finishSignIn() {
    const callback = parseCallback();
    const pkce = readJson(sessionStorage, config.pkceKey);
    const returnTo = sessionStorage.getItem(config.returnToKey) || config.fallbackPath;
    sessionStorage.removeItem(config.pkceKey);
    sessionStorage.removeItem(config.returnToKey);
    clearCallbackParams();

    if (callback.error) throw new Error(callback.error);
    if (!pkce || !callback.code || callback.state !== pkce.state) {
      throw new Error("invalid callback state");
    }
    const tokens = await exchangeCode({
      code: callback.code,
      codeVerifier: pkce.verifier,
      redirectUri: pkce.redirectUri,
    });
    const identity = persistIdentity(tokens.pairwise_sub, tokens.id_token, {
      expiresIn: tokens.expires_in,
    });
    return { identity, returnTo };
  }

  let callbackInFlight;
  function handleCallback(params = {}) {
    callbackInFlight ||= finishSignIn().finally(() => {
      callbackInFlight = undefined;
    });
    return callbackInFlight.then((result) => {
      if (params.navigate !== false) location.replace(result.returnTo);
      return result;
    });
  }

  async function checkSession(token = getIdentity().token) {
    if (!token) return { status: "login_required", reason: "invalid_token" };
    const response = await fetch(new URL("/session/check", baseUrl), {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
    });
    const body = await response.json().catch(() => ({}));
    return response.ok ? { status: "active" } : { status: "login_required", reason: body.reason || "invalid_token" };
  }

  async function signOut() {
    const { token } = getIdentity();
    clearIdentity();
    if (!token) return;
    await fetch(new URL("/session/revoke", baseUrl), {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
    }).catch(() => undefined);
  }

  function startSessionMonitor(params = {}) {
    const interval = params.intervalMs || config.sessionMonitorIntervalMs;
    const tick = async () => {
      if (!getIdentity().token) return;
      const result = await checkSession().catch(() => null);
      if (result?.status === "login_required") {
        clearIdentity();
        params.onLoginRequired?.(result);
      }
    };
    const timer = setInterval(tick, interval);
    return () => clearInterval(timer);
  }

  document.addEventListener("click", (event) => {
    const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
    if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;

    const url = new URL(anchor.href, location.href);
    if (url.origin !== baseUrl || url.pathname !== "/authorize" || url.searchParams.has("code_challenge")) {
      return;
    }
    event.preventDefault();
    void startSignIn({
      redirectUri: url.searchParams.get("redirect_uri") || undefined,
      requestPii: url.searchParams.get("pii") === "true",
      resource: url.searchParams.get("resource") || undefined,
      clientName: url.searchParams.get("client_name") || undefined,
      logoUri: url.searchParams.get("logo_uri") || undefined,
      returnTo: url.searchParams.get("return_to") || undefined,
    });
  });

  window.BPAuth = {
    baseUrl,
    config,
    createPkceBundle,
    createSignInUrl,
    startSignIn,
    parseCallback,
    clearCallbackParams,
    exchangeCode,
    finishSignIn,
    handleCallback,
    checkSession,
    startSessionMonitor,
    getIdentity,
    persistIdentity,
    clearIdentity,
    decodeClaims,
    signOut,
  };

  const isCallback = location.pathname === config.callbackPath && /[?&](code|error)=/.test(location.search);
  if (isCallback && options.autoCallback !== "false") {
    void handleCallback().catch((error) => console.error("[bp-auth]", error));
  } else if (options.sessionMonitor !== "false" && getIdentity().token) {
    startSessionMonitor();
  }
})();
