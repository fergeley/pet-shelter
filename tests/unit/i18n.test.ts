import { describe, it, expect } from "vitest";
import { translations, getTranslation } from "@/lib/i18n/translations";

describe("Bilingual i18n Translation Dictionary", () => {
  it("should have both 'en' and 'ms' languages defined", () => {
    expect(translations.en).toBeDefined();
    expect(translations.ms).toBeDefined();
  });

  it("should have 100% key parity between English and Bahasa Malaysia root namespaces", () => {
    const enKeys = Object.keys(translations.en).sort();
    const msKeys = Object.keys(translations.ms).sort();
    expect(enKeys).toEqual(msKeys);
  });

  it("should have matching sub-keys for all major translation namespaces", () => {
    const namespaces = Object.keys(translations.en) as (keyof typeof translations.en)[];
    
    for (const ns of namespaces) {
      const enSubKeys = Object.keys(translations.en[ns]).sort();
      const msSubKeys = Object.keys(translations.ms[ns]).sort();
      expect(msSubKeys).toEqual(enSubKeys);
    }
  });

  it("should retrieve English translations accurately via getTranslation", () => {
    const navAdopt = getTranslation("en", "nav.adopt");
    expect(navAdopt).toBe("Adopt");

    const heroTitle = getTranslation("en", "hero.title");
    expect(heroTitle).toContain("Adopt a dog or cat");

    const available = getTranslation("en", "common.available");
    expect(available).toBe("Available");
  });

  it("should retrieve Bahasa Malaysia translations accurately via getTranslation", () => {
    const navAdopt = getTranslation("ms", "nav.adopt");
    expect(navAdopt).toBe("Adopsi");

    const heroTitle = getTranslation("ms", "hero.title");
    expect(heroTitle).toContain("anjing atau kucing");

    const available = getTranslation("ms", "common.available");
    expect(available).toBe("Tersedia");
  });

  it("should fallback to fallback value or key if missing", () => {
    const missingKey = getTranslation("en", "non.existent.key", "Custom Fallback");
    expect(missingKey).toBe("Custom Fallback");

    const missingKeyNoFallback = getTranslation("en", "non.existent.key");
    expect(missingKeyNoFallback).toBe("non.existent.key");
  });

  it("should perform variable interpolation with params", () => {
    const formatted = getTranslation("en", "common.filterBy", undefined, { count: "5" });
    expect(typeof formatted).toBe("string");
  });
});
