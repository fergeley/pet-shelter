"use client";

import { useState, useEffect, useCallback } from "react";

const AUTH_STORAGE_KEY = "hope_for_strays_admin_session";

export interface AdminUser {
  email: string;
  name: string;
  role: "admin" | "staff" | "coordinator";
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

  useEffect(() => {
    try {
      const saved = localStorage.getItem(AUTH_STORAGE_KEY);
      if (saved) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setUser(JSON.parse(saved));
      }
    } catch (e) {
      console.error(e);
    }
    setIsLoading(false);
  }, []);

  const login = useCallback((email: string, pass: string): boolean => {
    // Demo credentials & staff pin
    if (
      (email.toLowerCase() === "admin@hopeforstrays.org" && pass === "admin123") ||
      (email.toLowerCase() === "staff@hopeforstrays.org" && pass === "staff123") ||
      pass === "1234"
    ) {
      const userData: AdminUser = {
        email: email || "coordinator@hopeforstrays.org",
        name: email.includes("admin") ? "Shelter Admin" : "Adoption Coordinator",
        role: "admin",
      };
      setUser(userData);
      if (typeof window !== "undefined") {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(userData));
        document.cookie = `hope_admin_token=valid; path=/; max-age=86400; SameSite=Lax`;
      }
      return true;
    }
    return false;
  }, []);

  const logout = useCallback(() => {
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
    logout,
  };
}
