import React from "react";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

/**
 * Tier-4 (jsdom) setup, layered on top of `tests/setup/nextMocks.ts`.
 *
 * Registered *after* `nextMocks.ts` on the `components` project only, so the
 * unit and integration lanes never pay for it — they run in `node`, where
 * `document` does not exist and half of this file would throw.
 *
 * `nextMocks.ts` resets `src/lib` module state before every test. It does not
 * and should not know about the DOM, so everything jsdom-shaped lives here.
 */

// ---------------------------------------------------------------------------
// jsdom gaps the components under test actually hit
// ---------------------------------------------------------------------------

/**
 * jsdom implements no layout, so every scrolling API is simply absent rather
 * than a no-op. `PetChooserCarousel` calls both on mount and on click
 * (auto-scrolling the selected card into view, and the arrow buttons), so
 * without these a selection test fails on `scrollIntoView is not a function`
 * — an error about the environment, not about the component.
 */
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = vi.fn();
}
if (!Element.prototype.scrollBy) {
  Element.prototype.scrollBy = vi.fn();
}
if (!Element.prototype.scrollTo) {
  Element.prototype.scrollTo = vi.fn();
}

/**
 * Node 26 ships its own `localStorage` global that throws unless the process
 * was started with `--localstorage-file`, and it shadows the working one jsdom
 * installs. `usePetStore` and `useApplicationStore` read `localStorage` bare, so
 * every access threw and was swallowed by their own try/catch — the stores
 * silently fell back to fixture data and the `clear()` below was a no-op.
 *
 * Probing with a real round-trip rather than a truthiness check: the broken
 * global is present and looks fine until it is actually called.
 */
function storageIsUsable(): boolean {
  try {
    const probe = globalThis.localStorage;
    probe.setItem("__probe__", "1");
    probe.removeItem("__probe__");
    return true;
  } catch {
    return false;
  }
}

if (!storageIsUsable()) {
  const backing = new Map<string, string>();
  const shim: Storage = {
    get length() {
      return backing.size;
    },
    key: (index: number) => Array.from(backing.keys())[index] ?? null,
    getItem: (key: string) => backing.get(key) ?? null,
    setItem: (key: string, value: string) => void backing.set(key, String(value)),
    removeItem: (key: string) => void backing.delete(key),
    clear: () => backing.clear(),
  };

  for (const target of [globalThis, window]) {
    Object.defineProperty(target, "localStorage", { value: shim, configurable: true, writable: true });
    Object.defineProperty(target, "sessionStorage", { value: shim, configurable: true, writable: true });
  }
}

/** Base UI's dialog measures the viewport before it will open a popup. */
if (!window.matchMedia) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

if (!window.ResizeObserver) {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

/**
 * `usePetDetailViewController.handleShare` prefers `navigator.share` and falls
 * back to `navigator.clipboard`. jsdom ships neither. Only the clipboard branch
 * is defined here: leaving `navigator.share` undefined is what routes the share
 * button down the fallback path deterministically, rather than depending on
 * whichever branch the environment happens to expose.
 */
if (!navigator.clipboard) {
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    configurable: true,
  });
}

// ---------------------------------------------------------------------------
// next/image
// ---------------------------------------------------------------------------

/**
 * The real `next/image` resolves its loader and device-size table from config
 * injected at build time, which no Vitest run performs. Rendering a plain `img`
 * keeps the parts a component test can legitimately assert — `src` and the
 * `alt` text every accessible query depends on — and drops the layout props
 * that would otherwise reach the DOM as invalid attributes and fill the output
 * with React warnings.
 */
/** Props that mean something to Next's optimizer and nothing to an `<img>`. */
const NEXT_ONLY_IMAGE_PROPS = [
  "fill",
  "priority",
  "sizes",
  "quality",
  "loader",
  "placeholder",
  "blurDataURL",
  "unoptimized",
] as const;

vi.mock("next/image", () => ({
  __esModule: true,
  default: ({ src, alt, ...rest }: Record<string, unknown>) => {
    // Deleted rather than destructured into discards: the repo's lint config has
    // no underscore exemption, so eight named-but-unused bindings would each
    // raise a warning.
    for (const prop of NEXT_ONLY_IMAGE_PROPS) delete rest[prop];

    return React.createElement("img", {
      src: typeof src === "string" ? src : "",
      alt: typeof alt === "string" ? alt : "",
      ...rest,
    });
  },
}));

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

afterEach(() => {
  // Unmounts every tree React Testing Library rendered. Without it, a component
  // from a finished test stays in `document.body` and `getByRole` throws
  // "found multiple elements" in the next one.
  cleanup();

  // `usePetStore` and `useApplicationStore` persist to localStorage and seed
  // their initial state from it. jsdom shares one Storage across a file, so a
  // test that mutates either store would otherwise dictate the starting state
  // of every test after it.
  try {
    window.localStorage.clear();
    window.sessionStorage.clear();
  } catch {
    // Storage is unavailable in some jsdom configurations; nothing to clear.
  }
});
