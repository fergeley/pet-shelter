"use client";

import React from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { Globe } from "lucide-react";

interface LanguageToggleProps {
  className?: string;
  showIcon?: boolean;
}

export function LanguageToggle({ className = "", showIcon = true }: LanguageToggleProps) {
  const { language, setLanguage } = useLanguage();

  return (
    <div
      className={`inline-flex items-center rounded-full bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 p-0.5 text-xs font-semibold select-none ${className}`}
      role="group"
      aria-label="Language Selector"
    >
      {showIcon && (
        <span className="pl-1.5 pr-0.5 text-muted-foreground">
          <Globe className="size-3" />
        </span>
      )}
      <button
        type="button"
        onClick={() => setLanguage("en")}
        className={`px-2 py-0.5 rounded-full transition-all duration-200 cursor-pointer ${
          language === "en"
            ? "bg-white dark:bg-zinc-900 text-foreground font-bold shadow-xs"
            : "text-muted-foreground hover:text-foreground"
        }`}
        aria-pressed={language === "en"}
        title="Switch to English"
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => setLanguage("ms")}
        className={`px-2 py-0.5 rounded-full transition-all duration-200 cursor-pointer ${
          language === "ms"
            ? "bg-white dark:bg-zinc-900 text-foreground font-bold shadow-xs"
            : "text-muted-foreground hover:text-foreground"
        }`}
        aria-pressed={language === "ms"}
        title="Tukar ke Bahasa Malaysia"
      >
        BM
      </button>
    </div>
  );
}
