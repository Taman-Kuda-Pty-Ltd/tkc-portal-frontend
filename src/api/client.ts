// Thin typed fetch wrapper. Uses relative "/api" so the same code works in dev
// (Vite proxy) and prod (Caddy same-origin). JWT is kept in localStorage.

const TOKEN_KEY = "tkc_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

// Invoked when an *authenticated* request 401s (expired/invalid session). Lets the
// auth layer reset state and redirect to /login instead of leaving stale data on
// screen (which otherwise reads as e.g. a terminal falsely showing "offline").
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn;
}

export class ApiError extends Error {
  status: number;
  // Per-field messages from a 422, keyed by the field path (loc without the
  // leading "body"), e.g. { "tax.tfn": "...", "mobile": "..." }.
  fields?: Record<string, string>;
  constructor(status: number, message: string, fields?: Record<string, string>) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  isForm = false,
  signal?: AbortSignal,
): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let payload: BodyInit | undefined;
  if (isForm) {
    payload = body as BodyInit;
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  const res = await fetch(`/api${path}`, { method, headers, body: payload, signal });

  if (res.status === 401) {
    setToken(null);
    // Only treat as an expired session when the request was actually authenticated.
    // A 401 on login / 2FA carries no token and must NOT trigger the redirect.
    if (token) onUnauthorized?.();
    throw new ApiError(401, "Session expired — please sign in again.");
  }
  if (!res.ok) {
    let detail = res.statusText;
    let fields: Record<string, string> | undefined;
    try {
      const data = await res.json();
      if (typeof data.detail === "string") {
        detail = data.detail;
      } else if (Array.isArray(data.detail)) {
        // FastAPI validation errors: [{ loc, msg, type }] — surface a readable message
        // instead of dumping raw JSON (ST-4), and expose per-field errors (VAL-2).
        fields = {};
        detail = data.detail
          .map((e: { loc?: (string | number)[]; msg?: string }) => {
            const loc = Array.isArray(e.loc) ? e.loc : [];
            const field = loc.length ? loc[loc.length - 1] : undefined;
            const msg = (e.msg ?? "Invalid value").replace(/^Value error,\s*/, "");
            // Field path without the leading "body" wrapper, e.g. "tax.tfn".
            const path = loc.filter((p) => p !== "body").join(".");
            if (path) fields![path] = msg;
            return typeof field === "string" && field !== "body" ? `${field}: ${msg}` : msg;
          })
          .join("; ");
        if (fields && Object.keys(fields).length === 0) fields = undefined;
      } else if (data.detail) {
        detail = String(data.detail);
      }
    } catch {
      /* keep statusText */
    }
    throw new ApiError(res.status, detail, fields);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  get: <T>(p: string, opts?: { signal?: AbortSignal }) =>
    request<T>("GET", p, undefined, false, opts?.signal),
  post: <T>(p: string, body?: unknown) => request<T>("POST", p, body),
  put: <T>(p: string, body?: unknown) => request<T>("PUT", p, body),
  patch: <T>(p: string, body?: unknown) => request<T>("PATCH", p, body),
  del: <T>(p: string) => request<T>("DELETE", p),

  login: async (email: string, password: string): Promise<{ requires2fa: boolean; challenge?: string }> => {
    const form = new URLSearchParams();
    form.set("username", email);
    form.set("password", password);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
    });
    if (!res.ok) throw new ApiError(res.status, "Incorrect email or password");
    const data = (await res.json()) as {
      access_token: string | null; requires_2fa?: boolean; challenge?: string;
    };
    // FU-2FA-LOGIN: a 2FA account gets no token yet — the caller must complete the code step.
    if (data.requires_2fa) return { requires2fa: true, challenge: data.challenge };
    setToken(data.access_token);
    return { requires2fa: false };
  },

  verify2fa: async (challenge: string, code: string) => {
    const data = await api.post<{ access_token: string | null }>("/auth/login/2fa", { challenge, code });
    setToken(data.access_token);
  },
};
