# Guided Tutorial 03: Multi-Language Expansion (Adding Mandarin & Tamil)

**Target Feature**: Expand the zero-dependency localization engine from bilingual (`en` & `ms`) to a 4-language Malaysian platform supporting **Simplified Chinese (`zh-MY`)** and **Tamil (`ta-MY`)** with strict compile-time key parity.  
**Skill Focus**: TypeScript Union Types, Dictionary Namespaces, React Context State, and Multi-Language Accessible Switchers.

---

## 🎯 Learning Objectives

By completing this stepped tutorial, you will master:
1. Scaling type-safe translation dictionaries in TypeScript strict mode.
2. Enforcing 100% key parity across all languages at compile time.
3. Updating React Context (`LanguageProvider`) to manage multiple locale states.
4. Designing an accessible 4-way language selector dropdown/toggle matching `DESIGN_SYSTEM.md`.
5. Supporting diverse Asian typography line-heights and glyph sets with Google Fonts.

---

## 📋 Step-by-Step Implementation

### Step 1: Update Language Types
📁 **Target File**: [`src/lib/i18n/translations.ts`](file:///c:/Users/User/pet-shelter/src/lib/i18n/translations.ts) (Lines 1–15)

Expand the `Language` type union:

```typescript
export type Language = 'en' | 'ms' | 'zh' | 'ta';

export interface LanguageOption {
  code: Language;
  label: string; // e.g. "English", "Bahasa Melayu", "中文", "தமிழ்"
  shortLabel: string; // e.g. "EN", "BM", "华", "தமி"
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: "en", label: "English", shortLabel: "EN" },
  { code: "ms", label: "Bahasa Melayu", shortLabel: "BM" },
  { code: "zh", label: "简体中文", shortLabel: "中文" },
  { code: "ta", label: "தமிழ்", shortLabel: "தமிழ்" },
];
```

---

### Step 2: Implement Mandarin (`zh`) & Tamil (`ta`) Dictionaries
📁 **Target File**: [`src/lib/i18n/translations.ts`](file:///c:/Users/User/pet-shelter/src/lib/i18n/translations.ts)

Add the new language dictionaries conforming strictly to `TranslationDictionary`:

```typescript
const zh: TranslationDictionary = {
  nav: {
    adopt: "领养",
    donate: "捐款与税收减免",
    track: "申请进度追踪",
    bulletins: "庇护所公告",
    login: "员工登入",
    adminDashboard: "管理后台",
  },
  common: {
    available: "待领养",
    pending: "申请审核中",
    adopted: "已领养",
    freeAdoption: "100% 免费领养",
    filterBy: "筛选条件",
    clearFilters: "重置所有筛选",
  },
  hero: {
    badge: "雪兰莪注册非营利动物庇护所",
    title: "给流浪毛孩一个温暖的家。",
    subtitle: "我们提供完整的兽医健康筛查、绝育手术与核心疫苗接种。不收取商业领养费。",
    ctaAdopt: "寻找毛孩伙伴",
    ctaDonate: "支持医疗基金",
  },
  // ... complete remaining namespaces (pets, adoptionForm, medicalTimeline, footer)
};

const ta: TranslationDictionary = {
  nav: {
    adopt: "தத்தெடுப்பு",
    donate: "நன்கொடை",
    track: "விண்ணப்ப கண்காணிப்பு",
    bulletins: "அறிவிப்புகள்",
    login: "பணியாளர் உள்நுழைவு",
    adminDashboard: "நிர்வாக பலகை",
  },
  common: {
    available: "கிடைக்கும்",
    pending: "பரிசீலனையில்",
    adopted: "தத்தெடுக்கப்பட்டது",
    freeAdoption: "100% இலவச தத்தெடுப்பு",
    filterBy: "வடிகட்டல்",
    clearFilters: "அனைத்தையும் மீட்டமை",
  },
  hero: {
    badge: "பதிவுசெய்யப்பட்ட தொண்டு சரணாலயம்",
    title: "ஆதரவற்ற விலங்குகளுக்கு வாழ்வளிப்போம்.",
    subtitle: "முழுமையான மருத்துவ பரிசோதனை மற்றும் தடுப்பூசி பாதுகாப்புடன்.",
    ctaAdopt: "விலங்குகளைப் பார்க்க",
    ctaDonate: "நன்கொடை அளியுங்கள்",
  },
  // ... complete remaining namespaces
};

export const translations: Record<Language, TranslationDictionary> = {
  en,
  ms,
  zh,
  ta,
};
```

---

### Step 3: Accessible 4-Language Toggle Component
📁 **Target File**: [`src/components/LanguageToggle.tsx`](file:///c:/Users/User/pet-shelter/src/components/LanguageToggle.tsx)

Transform the toggle pill into a multi-language switcher:

```tsx
"use client";

import React from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { Language, SUPPORTED_LANGUAGES } from "@/lib/i18n/translations";
import { Globe } from "lucide-react";

export function LanguageToggle() {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="inline-flex items-center gap-1 p-1 bg-muted/60 border border-border rounded-xl">
      <span className="sr-only">Select Language</span>
      <Globe className="size-3.5 text-muted-foreground ml-1.5 mr-0.5" />
      {SUPPORTED_LANGUAGES.map((lang) => {
        const isActive = language === lang.code;
        return (
          <button
            key={lang.code}
            type="button"
            onClick={() => setLanguage(lang.code)}
            className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              isActive
                ? "bg-background text-foreground shadow-xs border border-border/80"
                : "text-muted-foreground hover:text-foreground hover:bg-background/40"
            }`}
            title={lang.label}
          >
            {lang.shortLabel}
          </button>
        );
      })}
    </div>
  );
}
```

---

### Step 4: Add Automated Unit Tests for Key Parity
📁 **Target File**: [`tests/unit/i18n.test.ts`](file:///c:/Users/User/pet-shelter/tests/unit/i18n.test.ts)

Ensure test suites verify 100% parity across all 4 languages:

```typescript
it("should maintain 100% key parity across en, ms, zh, and ta", () => {
  const languages: Language[] = ["en", "ms", "zh", "ta"];
  const enKeys = Object.keys(translations.en).sort();

  for (const lang of languages) {
    const langKeys = Object.keys(translations[lang]).sort();
    expect(langKeys).toEqual(enKeys);
  }
});
```

---

## 🧪 Verification Commands

```bash
# Verify All Vitest Suites
npm test -- --run

# Strict TypeScript Check
npx tsc --noEmit

# Production Turbopack Build
npm run build
```
