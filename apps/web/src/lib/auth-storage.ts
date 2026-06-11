// Persistence strategy for the auth session.
//
// "Remember me" (default ON) keeps the session in localStorage, so it survives
// browser restarts until the refresh token expires. When the user opts out, the
// session lives in sessionStorage instead and is cleared when the tab/browser
// closes (and the refresh-token cookie is a session cookie on the server side),
// so closing the browser logs the user out.

const AUTH_KEY = "travenest-auth";
const REMEMBER_KEY = "travenest-remember";

const hasWindow = () => typeof window !== "undefined";

/** Whether the session should persist across browser restarts (default true). */
export function isRemembered(): boolean {
  if (!hasWindow()) return true;
  return window.localStorage.getItem(REMEMBER_KEY) !== "false";
}

/** Read the persisted auth blob, preferring whichever store currently holds it. */
export function readAuthRaw(): string | null {
  if (!hasWindow()) return null;
  return (
    window.sessionStorage.getItem(AUTH_KEY) ??
    window.localStorage.getItem(AUTH_KEY)
  );
}

/** Persist the auth blob to localStorage (remembered) or sessionStorage (not). */
export function writeAuthRaw(value: string): void {
  if (!hasWindow()) return;
  if (isRemembered()) {
    window.localStorage.setItem(AUTH_KEY, value);
    window.sessionStorage.removeItem(AUTH_KEY);
  } else {
    window.sessionStorage.setItem(AUTH_KEY, value);
    window.localStorage.removeItem(AUTH_KEY);
  }
}

/** Remove the auth blob from both stores. */
export function clearAuthRaw(): void {
  if (!hasWindow()) return;
  window.localStorage.removeItem(AUTH_KEY);
  window.sessionStorage.removeItem(AUTH_KEY);
}

/**
 * Record the remember-me preference. Call this BEFORE logging in so the auth
 * store persists to the correct storage; it also migrates any existing blob.
 */
export function setRemembered(remember: boolean): void {
  if (!hasWindow()) return;
  window.localStorage.setItem(REMEMBER_KEY, String(remember));
  const existing = readAuthRaw();
  if (existing !== null) writeAuthRaw(existing);
}

export const AUTH_STORAGE_KEY = AUTH_KEY;
