export const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:5050/api";

const STORAGE_KEYS = {
  accessToken: "access_token",
  refreshToken: "refresh_token",
  expiresAt: "expires_at",
  displayName: "user_display_name",
  avatarURL: "user_avatar_url",
  deviceID: "device_id",
} as const;

export const AUTH_CHANGE_EVENT = "auth-change";

export type AuthTokens = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
};

export type AuthUser = {
  display_name?: string;
  avatar_url?: string;
  phone?: string;
};

export type AuthSessionPayload = {
  user?: AuthUser;
  tokens?: AuthTokens;
};

export type AuthUserSnapshot = {
  name: string;
  avatar: string;
};

function canUseWindow() {
  return typeof window !== "undefined";
}

function randomPart(length: number) {
  const chars = "abcdef0123456789";
  const arr = new Uint8Array(length);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(arr);
  } else {
    for (let i = 0; i < length; i += 1) arr[i] = Math.floor(Math.random() * 256);
  }
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += chars[arr[i] % chars.length];
  }
  return out;
}

export function getOrCreateDeviceID() {
  if (!canUseWindow()) return "";
  const cached = window.localStorage.getItem(STORAGE_KEYS.deviceID) || "";
  if (/^[A-Za-z0-9_-]{8,128}$/.test(cached)) {
    return cached;
  }
  const deviceID = `dv_${Date.now().toString(36)}_${randomPart(16)}`;
  window.localStorage.setItem(STORAGE_KEYS.deviceID, deviceID);
  return deviceID;
}

export function buildDefaultAvatar(seed: string) {
  const safeSeed = encodeURIComponent(seed || "emoji");
  return `https://api.dicebear.com/7.x/adventurer/svg?seed=${safeSeed}`;
}

export function emitAuthChange() {
  if (!canUseWindow()) return;
  window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
}

export function getAccessToken() {
  if (!canUseWindow()) return "";
  return window.localStorage.getItem(STORAGE_KEYS.accessToken) || "";
}

export function getRefreshToken() {
  if (!canUseWindow()) return "";
  return window.localStorage.getItem(STORAGE_KEYS.refreshToken) || "";
}

export function getAccessTokenExpiry() {
  if (!canUseWindow()) return 0;
  return Number(window.localStorage.getItem(STORAGE_KEYS.expiresAt) || "0");
}

export function hasValidAccessToken() {
  const token = getAccessToken();
  if (!token) return false;
  const expiresAt = getAccessTokenExpiry();
  if (expiresAt > 0 && Date.now() > expiresAt) {
    return false;
  }
  return true;
}

function hasRefreshToken() {
  return Boolean(getRefreshToken());
}

export function hasStoredAuthState() {
  if (!canUseWindow()) return false;
  return Boolean(
    window.localStorage.getItem(STORAGE_KEYS.accessToken) ||
      window.localStorage.getItem(STORAGE_KEYS.refreshToken) ||
      window.localStorage.getItem(STORAGE_KEYS.expiresAt) ||
      window.localStorage.getItem(STORAGE_KEYS.displayName) ||
      window.localStorage.getItem(STORAGE_KEYS.avatarURL)
  );
}

export function getStoredUser(): AuthUserSnapshot {
  if (!canUseWindow()) {
    const name = "表情用户";
    return { name, avatar: buildDefaultAvatar(name) };
  }
  const name = window.localStorage.getItem(STORAGE_KEYS.displayName) || "表情用户";
  const avatar = window.localStorage.getItem(STORAGE_KEYS.avatarURL) || buildDefaultAvatar(name);
  return { name, avatar };
}

export function saveAuthSession(payload: AuthSessionPayload) {
  if (!canUseWindow() || !payload?.tokens?.access_token) return;
  const tokens = payload.tokens;
  const user = payload.user;

  const expiresAt = Date.now() + (tokens.expires_in || 0) * 1000;
  window.localStorage.setItem(STORAGE_KEYS.accessToken, tokens.access_token);
  window.localStorage.setItem(STORAGE_KEYS.refreshToken, tokens.refresh_token || "");
  window.localStorage.setItem(STORAGE_KEYS.expiresAt, String(expiresAt));

  if (user?.display_name) {
    window.localStorage.setItem(STORAGE_KEYS.displayName, user.display_name);
  } else {
    window.localStorage.removeItem(STORAGE_KEYS.displayName);
  }

  if (user?.avatar_url) {
    window.localStorage.setItem(STORAGE_KEYS.avatarURL, user.avatar_url);
  } else {
    window.localStorage.removeItem(STORAGE_KEYS.avatarURL);
  }

  emitAuthChange();
}

export function clearAuthSession() {
  if (!canUseWindow()) return;
  window.localStorage.removeItem(STORAGE_KEYS.accessToken);
  window.localStorage.removeItem(STORAGE_KEYS.refreshToken);
  window.localStorage.removeItem(STORAGE_KEYS.expiresAt);
  window.localStorage.removeItem(STORAGE_KEYS.displayName);
  window.localStorage.removeItem(STORAGE_KEYS.avatarURL);
  emitAuthChange();
}

function withAuthHeaders(headers?: HeadersInit) {
  const next = new Headers(headers || {});
  const token = getAccessToken();
  if (token && !next.has("Authorization")) {
    next.set("Authorization", `Bearer ${token}`);
  }
  if (!next.has("X-Device-ID")) {
    const deviceID = getOrCreateDeviceID();
    if (deviceID) {
      next.set("X-Device-ID", deviceID);
    }
  }
  return next;
}

let refreshingPromise: Promise<boolean> | null = null;

export async function refreshAuthSession() {
  if (refreshingPromise) return refreshingPromise;

  refreshingPromise = (async () => {
    try {
      const refreshToken = getRefreshToken();
      const headers = withAuthHeaders({ "Content-Type": "application/json" });
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify(refreshToken ? { refresh_token: refreshToken } : {}),
      });
      if (!res.ok) return false;
      const data = (await res.json()) as AuthSessionPayload;
      if (data?.tokens?.access_token) {
        saveAuthSession(data);
        return true;
      }
      return hasValidAccessToken();
    } catch {
      return false;
    } finally {
      refreshingPromise = null;
    }
  })();

  return refreshingPromise;
}

export async function ensureAuthSession() {
  if (hasValidAccessToken()) return true;
  if (!hasRefreshToken()) return false;
  const refreshed = await refreshAuthSession();
  if (!refreshed) {
    clearAuthSession();
    return false;
  }
  return true;
}

export async function fetchWithAuth(input: RequestInfo | URL, init: RequestInit = {}) {
  return fetch(input, {
    ...init,
    credentials: "include",
    headers: withAuthHeaders(init.headers),
  });
}

export async function fetchWithAuthRetry(input: RequestInfo | URL, init: RequestInit = {}) {
  const res = await fetchWithAuth(input, init);
  if (res.status !== 401) return res;

  const refreshed = await refreshAuthSession();
  if (!refreshed) {
    clearAuthSession();
    return res;
  }

  return fetchWithAuth(input, init);
}

export async function logoutSession() {
  try {
    const refreshToken = getRefreshToken();
    await fetchWithAuth(`${API_BASE}/auth/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(refreshToken ? { refresh_token: refreshToken } : {}),
    });
  } catch {
    // ignore network errors during logout and clear local session anyway
  } finally {
    clearAuthSession();
  }
}
