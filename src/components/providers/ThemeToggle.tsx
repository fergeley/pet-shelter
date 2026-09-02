"use client";

import React, { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "./ThemeProvider";

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
        <div className="segmented relative h-7 w-13 opacity-60">
          <div className="segmented-thumb size-5" />
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
        className="segmented relative h-7 w-13 shrink-0 cursor-pointer transition-colors duration-200 ease-in-out focus:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        {/* Track Icons */}
        <span className="absolute left-1.5 flex items-center justify-center text-warning-accent pointer-events-none transition-opacity dark:text-muted-foreground/60">
          <Sun className="size-3.5" />
        </span>
        <span className="absolute right-1.5 flex items-center justify-center text-muted-foreground/60 pointer-events-none transition-opacity dark:text-warning-accent">
          <Moon className="size-3.5" />
        </span>

        {/* Sliding Thumb */}
        <span
          className={`segmented-thumb pointer-events-none flex size-5.5 items-center justify-center transition-transform duration-200 ease-in-out ${
            isDark ? "translate-x-6" : "translate-x-0"
          }`}
        >
          {isDark ? (
            <Moon className="size-3 text-warning-accent fill-warning-accent/30" />
          ) : (
            <Sun className="size-3 text-warning-accent fill-warning-accent/30" />
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
