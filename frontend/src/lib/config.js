const requiredEnv = (name) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value.replace(/\/+$/, "");
};

export const BACKEND_URL = requiredEnv("REACT_APP_BACKEND_URL");
export const API_URL = `${BACKEND_URL}/api`;

// ---------------------------------------------------------------------------
// Canonical production backend for Google OAuth.
//
// OAuth (Google sign-in) MUST round-trip through the canonical backend so:
//   - the redirect_uri Google sees matches the one registered in Google Console
//   - the token exchange uses the production client_secret
//   - the callback lands back on the canonical frontend
//
// If the frontend is being served from jwoodtechnologies.com we hard-pin the
// OAuth base to https://jwoodtech.onrender.com—even if
// REACT_APP_BACKEND_URL was built pointing at a different backend (e.g. an
// older jwoodtechnologies-com.onrender.com value). This guarantees production auth never
// silently routes to a wrong / dead backend.
// ---------------------------------------------------------------------------
export const PRODUCTION_BACKEND_URL = "https://jwoodtech.onrender.com";
const PRODUCTION_HOSTS = new Set(["jwoodtechnologies.com", "www.jwoodtechnologies.com"]);

function currentHost() {
  try { return window.location.host.replace(/:\d+$/, ""); } catch { return ""; }
}

/** The backend origin OAuth must use. On prod hosts → pinned. Elsewhere → build-time env. */
export function oauthBackendUrl() {
  return PRODUCTION_HOSTS.has(currentHost()) ? PRODUCTION_BACKEND_URL : BACKEND_URL;
}

export const googleLoginUrl = ({ app, next }) => {
  const params = new URLSearchParams({ app });
  if (next) params.set("next", next);
  return `${oauthBackendUrl()}/api/auth/google/login?${params.toString()}`;
};
