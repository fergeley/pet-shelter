"use client";

import React from "react";
import { useLanguage } from "./LanguageProvider";
import { Globe } from "lucide-react";

interface LanguageToggleProps {
  className?: string;
  showIcon?: boolean;
}

export function LanguageToggle({ className = "", showIcon = true }: LanguageToggleProps) {
  const { language, setLanguage } = useLanguage();

  return (
    <div
      className={`segmented text-xs font-semibold select-none ${className}`}
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
            ? "segmented-thumb text-foreground font-bold"
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
            ? "segmented-thumb text-foreground font-bold"
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
