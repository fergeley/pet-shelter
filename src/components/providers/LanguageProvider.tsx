"use client";

import React, { createContext, useContext, useState, useCallback, useEffect, useSyncExternalStore } from "react";
import { Language, TranslationDictionary, translations } from "@/lib/i18n/translations";

interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (path: string, fallbackOrParams?: string | Record<string, string | number>, params?: Record<string, string | number>) => string;
  dictionary: TranslationDictionary;
  isMs: boolean;
}

const STORAGE_KEY = "hope_for_strays_lang";

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("languagechange", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("languagechange", callback);
  };
}

function getStoredLanguage(): Language {
  if (typeof window === "undefined") return "en";
  try {
    const stored = localStorage.getItem(STORAGE_KEY) as Language | null;
    if (stored === "en" || stored === "ms") return stored;
  } catch {
    // Ignore localStorage access errors in private browsing
  }
  return "en";
}

function getServerSnapshot(): Language {
  return "en";
}

export function LanguageProvider({
  children,
  defaultLanguage = "en",
}: {
  children: React.ReactNode;
  defaultLanguage?: Language;
}) {
  const storeLanguage = useSyncExternalStore(
    subscribe,
    getStoredLanguage,
    getServerSnapshot
  );
  const [explicitLanguage, setExplicitLanguage] = useState<Language | null>(null);
  const language = explicitLanguage ?? storeLanguage ?? defaultLanguage;

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = language;
    }
  }, [language]);

  const setLanguage = useCallback((newLang: Language) => {
    setExplicitLanguage(newLang);
    try {
      localStorage.setItem(STORAGE_KEY, newLang);
      document.cookie = `${STORAGE_KEY}=${newLang}; path=/; max-age=31536000; SameSite=Lax`;
      if (typeof document !== "undefined") {
        document.documentElement.lang = newLang;
      }
      window.dispatchEvent(new Event("languagechange"));
    } catch {
      // Ignore cookie or storage errors
    }
  }, []);

  const t = useCallback(
    (
      path: string,
      fallbackOrParams?: string | Record<string, string | number>,
      params?: Record<string, string | number>
    ): string => {
      let fallbackText = "";
      let interpolationParams: Record<string, string | number> | undefined = undefined;

      if (typeof fallbackOrParams === "string") {
        fallbackText = fallbackOrParams;
        interpolationParams = params;
      } else if (typeof fallbackOrParams === "object") {
        interpolationParams = fallbackOrParams;
      }

      const dict = translations[language] || translations.en;
      const fallbackDict = translations.en;

      const keys = path.split(".");
      let current: unknown = dict;
      let currentFallback: unknown = fallbackDict;

      for (const k of keys) {
        if (current && typeof current === "object" && k in current) {
          current = (current as Record<string, unknown>)[k];
        } else {
          current = undefined;
        }

        if (currentFallback && typeof currentFallback === "object" && k in currentFallback) {
          currentFallback = (currentFallback as Record<string, unknown>)[k];
        } else {
          currentFallback = undefined;
        }
      }

      let result = typeof current === "string" ? current : typeof currentFallback === "string" ? currentFallback : fallbackText || path;

      if (interpolationParams) {
        Object.entries(interpolationParams).forEach(([paramKey, paramVal]) => {
          result = result.replace(new RegExp(`{${paramKey}}`, "g"), String(paramVal));
        });
      }

      return result;
    },
    [language]
  );

  const value: LanguageContextValue = {
    language,
    setLanguage,
    t,
    dictionary: translations[language] || translations.en,
    isMs: language === "ms",
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) {
    // Return a safe fallback context for tests or isolated component usage
    const fallbackLang: Language = "en";
    const dict = translations.en;
    return {
      language: fallbackLang,
      setLanguage: () => {},
      t: (path: string, fallbackOrParams?: string | Record<string, string | number>) => {
        if (typeof fallbackOrParams === "string") return fallbackOrParams;
        const keys = path.split(".");
        let cur: unknown = dict;
        for (const k of keys) {
          if (cur && typeof cur === "object" && k in cur) {
            cur = (cur as Record<string, unknown>)[k];
          } else {
            return path;
          }
        }
        return typeof cur === "string" ? cur : path;
      },
      dictionary: dict,
      isMs: false,
    };
  }
  return context;
}
