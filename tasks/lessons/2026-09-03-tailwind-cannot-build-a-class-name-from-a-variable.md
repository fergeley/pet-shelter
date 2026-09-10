# Tailwind cannot build a class name from a variable

**Learned:** 2026-09-03

The QR panel needed a per-channel accent colour. `` border-[${accent}] `` compiles,
renders, and produces no style at all — the JIT only sees class names that appear
literally in the source. Use an inline `style` for a colour that varies at
runtime, and point it at a CSS custom property so `globals.css` stays the single
source of truth rather than growing a second copy of the hex.
