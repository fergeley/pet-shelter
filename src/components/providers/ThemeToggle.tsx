"use client";

import React, { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

function subscribe() {
  return () => {};
}

export function ThemeToggle({ className = "", showLabel = false }: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme();
  
  const isClient = useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );

  const isDark = resolvedTheme === "dark";

  const handleToggle = () => {
    setTheme(isDark ? "light" : "dark");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      handleToggle();
    }
  };

  if (!isClient) {
    return (
      <div className={`inline-flex items-center gap-2 ${className}`}>
        <div className="relative inline-flex h-7 w-13 items-center rounded-full bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 p-0.5 opacity-60">
          <div className="size-5 rounded-full bg-white dark:bg-zinc-900 shadow-xs" />
        </div>
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      <button
        type="button"
        role="switch"
        aria-checked={isDark}
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        title={isDark ? "Switch to light mode" : "Switch to dark mode"}
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        className="relative inline-flex h-7 w-13 shrink-0 cursor-pointer items-center rounded-full bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 p-0.5 transition-colors duration-200 ease-in-out focus:outline-hidden focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2"
      >
        {/* Track Icons */}
        <span className="absolute left-1.5 flex items-center justify-center text-amber-600 dark:text-zinc-500 pointer-events-none transition-opacity">
          <Sun className="size-3.5" />
        </span>
        <span className="absolute right-1.5 flex items-center justify-center text-zinc-400 dark:text-amber-300 pointer-events-none transition-opacity">
          <Moon className="size-3.5" />
        </span>

        {/* Sliding Thumb */}
        <span
          className={`pointer-events-none flex size-5.5 items-center justify-center rounded-full bg-white dark:bg-zinc-900 shadow-xs transition-transform duration-200 ease-in-out ${
            isDark ? "translate-x-6" : "translate-x-0"
          }`}
        >
          {isDark ? (
            <Moon className="size-3 text-amber-300 fill-amber-300/30" />
          ) : (
            <Sun className="size-3 text-amber-600 fill-amber-600/30" />
          )}
        </span>
      </button>

      {showLabel && (
        <span className="text-xs font-medium text-muted-foreground select-none cursor-pointer" onClick={handleToggle}>
          {isDark ? "Dark" : "Light"}
        </span>
      )}
    </div>
  );
}
