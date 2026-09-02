"use client";

import { useState, useEffect, useCallback } from "react";
import { loginAction, registerAction, logoutAction, getCurrentUserAction } from "@/actions/auth";
import { Role } from "@/lib/security/rbac";

const AUTH_STORAGE_KEY = "hope_for_strays_admin_session";

export interface AdminUser {
  id?: string;
  email: string;
  name: string;
  role: "ADMIN" | "COORDINATOR" | "STAFF" | "VOLUNTEER" | "admin" | "staff" | "coordinator";
}

export function useAdminAuth() {
  const [user, setUser] = useState<AdminUser | null>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(AUTH_STORAGE_KEY);
        if (saved) {
          return JSON.parse(saved);
        }
      } catch (e) {
        console.error("Auth session parse error", e);
      }
    }
    return null;
  });

  const [isLoading, setIsLoading] = useState(true);

  // Synchronize with server session on mount
  useEffect(() => {
    let mounted = true;
    async function syncSession() {
      try {
        const res = await getCurrentUserAction();
        if (mounted) {
          if (res.user) {
            setUser(res.user);
            localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(res.user));
          } else {
            const saved = localStorage.getItem(AUTH_STORAGE_KEY);
            if (saved) {
              setUser(JSON.parse(saved));
            }
          }
        }
      } catch (e) {
        console.error("Error syncing session:", e);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    syncSession();
    return () => {
      mounted = false;
    };
  }, []);

  const login = useCallback(
    async (
      email: string,
      pass: string
    ): Promise<{ success: boolean; error?: string; retryAfterSeconds?: number }> => {
      try {
        const result = await loginAction({ email, password: pass });
        if (result.success && result.user) {
          setUser(result.user);
          if (typeof window !== "undefined") {
            localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(result.user));
          }
          return { success: true };
        }
        return {
          success: false,
          error: result.error || "Invalid credentials",
          retryAfterSeconds: result.retryAfterSeconds,
        };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Authentication failed";
        return { success: false, error: msg };
      }
    },
    []
  );

  const register = useCallback(
    async (data: {
      name: string;
      email: string;
      password: string;
      role?: Role;
      staffInviteCode?: string;
    }): Promise<{ success: boolean; error?: string; retryAfterSeconds?: number }> => {
      try {
        const result = await registerAction(data);
        if (result.success && result.user) {
          setUser(result.user);
          if (typeof window !== "undefined") {
            localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(result.user));
          }
          return { success: true };
        }
        return {
          success: false,
          error: result.error || "Registration failed",
          retryAfterSeconds: result.retryAfterSeconds,
        };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Registration failed";
        return { success: false, error: msg };
      }
    },
    []
  );

  const logout = useCallback(async () => {
    try {
      await logoutAction();
    } catch (e) {
      console.error("Logout error", e);
    }
    setUser(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      document.cookie = `hope_admin_token=; path=/; max-age=0; SameSite=Lax`;
    }
  }, []);

  return {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    register,
    logout,
  };
}
