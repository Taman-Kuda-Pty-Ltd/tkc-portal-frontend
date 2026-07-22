import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { notifications } from "@mantine/notifications";
import { api, getToken, setToken, setUnauthorizedHandler } from "../api/client";
import type { Me } from "../api/types";

interface AuthState {
  me: Me | null;
  loading: boolean;
  // Returns { requires2fa, challenge } — when requires2fa, call complete2fa to finish.
  login: (email: string, password: string) => Promise<{ requires2fa: boolean; challenge?: string }>;
  complete2fa: (challenge: string, code: string) => Promise<void>;
  logout: () => void;
  can: (capability: string) => boolean;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  // Mirror `me` into a ref so the once-registered 401 handler reads current state;
  // `handledExpiry` collapses a burst of concurrent 401s into a single sign-out.
  const meRef = useRef<Me | null>(null);
  meRef.current = me;
  const handledExpiry = useRef(false);

  const loadMe = useCallback(async () => {
    if (!getToken()) {
      setMe(null);
      setLoading(false);
      return;
    }
    try {
      setMe(await api.get<Me>("/auth/me"));
      handledExpiry.current = false;
    } catch {
      setToken(null);
      setMe(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMe();
  }, [loadMe]);

  // On an authenticated 401 (session expired mid-use), sign out and let App route
  // to /login — instead of leaving stale data on screen. Ignored while logged out
  // (the initial /auth/me with a stale token is handled by loadMe's catch).
  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (!meRef.current || handledExpiry.current) return;
      handledExpiry.current = true;
      setToken(null);
      setMe(null);
      notifications.show({
        color: "orange",
        title: "Session expired",
        message: "You’ve been signed out. Please sign in again.",
      });
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await api.login(email, password);
      if (!res.requires2fa) {
        setLoading(true);
        await loadMe();
      }
      return res;
    },
    [loadMe],
  );

  const complete2fa = useCallback(
    async (challenge: string, code: string) => {
      await api.verify2fa(challenge, code);
      setLoading(true);
      await loadMe();
    },
    [loadMe],
  );

  const logout = useCallback(() => {
    setToken(null);
    setMe(null);
  }, []);

  const can = useCallback(
    (capability: string) => !!me?.capabilities.includes(capability),
    [me],
  );

  return (
    <AuthContext.Provider value={{ me, loading, login, complete2fa, logout, can }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
