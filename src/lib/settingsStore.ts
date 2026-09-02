"use client";

import { useState, useEffect, useCallback } from "react";
import { ShelterSettingsInput } from "@/lib/validations/settings";
import { DEFAULT_SHELTER_SETTINGS } from "@/lib/domain/shelterSettingsDefaults";

const STORAGE_KEY = "hope_for_strays_settings_v2";

/**
 * Exported so a test can assert the shape stays complete: a persisted key
 * missing from here reaches the form as `undefined` and blanks its column on
 * the next save.
 */
/**
 * Re-exported from the domain module rather than restated here. These two lists
 * were duplicated and had already drifted apart (this copy said
 * "(Closed Mondays)" and the domain copy did not), so whichever fallback path
 * fired decided which opening hours the public site showed.
 */
export const defaultSettings: ShelterSettingsInput = DEFAULT_SHELTER_SETTINGS;

export function useSettingsStore() {
  const [settings, setSettings] = useState<ShelterSettingsInput>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          return { ...defaultSettings, ...JSON.parse(saved) };
        }
      } catch (e) {
        console.error("Failed to load settings", e);
      }
    }
    return defaultSettings;
  });

  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSettings((prev) => ({ ...prev, ...JSON.parse(saved) }));
      }
    } catch (e) {
      console.error(e);
    }
    setIsLoaded(true);
  }, []);

  const saveSettings = useCallback((newSettings: ShelterSettingsInput) => {
    setSettings(newSettings);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
      } catch (e) {
        console.error("Failed to persist settings", e);
      }
    }
  }, []);

  const resetToDefaultSettings = useCallback(() => {
    saveSettings(defaultSettings);
  }, [saveSettings]);

  return {
    settings,
    isLoaded,
    saveSettings,
    resetToDefaultSettings,
  };
}
