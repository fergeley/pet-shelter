import { describe, it, expect } from "vitest";
import {
  MoneyFormatError,
  Sen,
  formatMYR,
  ringgitFromSen,
  senFromInteger,
  senFromRinggit,
  sumSen,
} from "@/lib/domain/money";

describe("senFromRinggit", () => {
  it("converts whole and fractional ringgit exactly", () => {
    expect(senFromRinggit(50)).toBe(5000);
    expect(senFromRinggit(0)).toBe(0);
    expect(senFromRinggit(30)).toBe(3000);
    expect(senFromRinggit(100000)).toBe(10000000);
    expect(senFromRinggit(12.5)).toBe(1250);
    expect(senFromRinggit(12.05)).toBe(1205);
  });

  it("accepts decimal strings, so a form value never round-trips through a float", () => {
    expect(senFromRinggit("250")).toBe(25000);
    expect(senFromRinggit("250.00")).toBe(25000);
    expect(senFromRinggit("0.07")).toBe(7);
    expect(senFromRinggit("  19.90  ")).toBe(1990);
  });

  it("handles negative amounts, for offsetting correction records", () => {
    expect(senFromRinggit(-3.05)).toBe(-305);
    expect(senFromRinggit("-120")).toBe(-12000);
  });

  it("is exact where multiply-and-round is not", () => {
    // The trap this module exists to avoid: 1.005 * 100 is 100.49999999999999 in
    // IEEE-754, so Math.round() of it yields 100 sen — RM 1.00, not RM 1.01.
    // Rejecting the third decimal outright is the honest response; there is no
    // sub-sen denomination in MYR, so the input was already wrong.
    expect(Math.round(1.005 * 100)).toBe(100); // documents the defect being avoided
    expect(() => senFromRinggit(1.005)).toThrow(MoneyFormatError);
  });

  it("refuses an amount carrying accumulated float error rather than silently rounding it", () => {
    // 0.1 + 0.2 is 0.30000000000000004. A tax receipt should not quietly absorb
    // that; the caller is handed an error naming the real problem.
    expect(() => senFromRinggit(0.1 + 0.2)).toThrow(/at most two decimal places/);
  });

  it("rejects more than two decimal places", () => {
    expect(() => senFromRinggit("10.001")).toThrow(MoneyFormatError);
    expect(() => senFromRinggit(99.999)).toThrow(MoneyFormatError);
  });

  it("rejects exponential notation instead of misreading it as a decimal", () => {
    expect(() => senFromRinggit(1e-7)).toThrow(/outside the range/);
    expect(() => senFromRinggit(1e21)).toThrow(/outside the range/);
  });

  it("rejects non-finite and non-numeric input", () => {
    expect(() => senFromRinggit(Number.NaN)).toThrow(MoneyFormatError);
    expect(() => senFromRinggit(Number.POSITIVE_INFINITY)).toThrow(MoneyFormatError);
    expect(() => senFromRinggit("RM 50")).toThrow(MoneyFormatError);
    expect(() => senFromRinggit("")).toThrow(MoneyFormatError);
  });
});

describe("senFromInteger", () => {
  it("wraps an integral column value", () => {
    expect(senFromInteger(25000)).toBe(25000);
    expect(senFromInteger(0)).toBe(0);
  });

  it("rejects a fractional value, so a wrongly-mapped row fails at the boundary", () => {
    expect(() => senFromInteger(25000.5)).toThrow(MoneyFormatError);
    expect(() => senFromInteger(Number.NaN)).toThrow(MoneyFormatError);
  });
});

describe("ringgitFromSen", () => {
  it("round-trips through sen without loss", () => {
    for (const amount of [5, 30, 50, 120, 250, 19.9, 12.05, 100000]) {
      expect(ringgitFromSen(senFromRinggit(amount))).toBe(amount);
    }
  });
});

describe("sumSen", () => {
  it("sums exactly where floating-point ringgit does not", () => {
    const floatTotal = 0.1 + 0.2;
    expect(floatTotal).not.toBe(0.3);

    const exactTotal = sumSen([senFromRinggit("0.10"), senFromRinggit("0.20")]);
    expect(exactTotal).toBe(30);
    expect(ringgitFromSen(exactTotal)).toBe(0.3);
  });

  it("returns zero for an empty ledger", () => {
    expect(sumSen([])).toBe(0);
  });

  it("stays exact across a year of donations", () => {
    // 1,200 donations of RM 19.90. In float ringgit this accumulates visible
    // error; in sen it is a plain integer sum.
    const donations = Array.from({ length: 1200 }, () => senFromRinggit("19.90"));
    expect(sumSen(donations)).toBe(1200 * 1990);
    expect(ringgitFromSen(sumSen(donations))).toBe(23880);
  });
});

describe("formatMYR", () => {
  it("always renders two decimals and thousands grouping for statutory documents", () => {
    expect(formatMYR(senFromRinggit(1250))).toBe("RM 1,250.00");
    expect(formatMYR(senFromRinggit(5))).toBe("RM 5.00");
    expect(formatMYR(senFromRinggit("0.07"))).toBe("RM 0.07");
    expect(formatMYR(senFromRinggit(1234567.89))).toBe("RM 1,234,567.89");
  });

  it("can omit the symbol for CSV columns", () => {
    expect(formatMYR(senFromRinggit(250), { withSymbol: false })).toBe("250.00");
  });

  it("renders negative amounts with the sign ahead of the value", () => {
    expect(formatMYR(senFromRinggit(-12.5))).toBe("RM -12.50");
  });

  it("pads a sen-only remainder rather than truncating it", () => {
    expect(formatMYR(senFromInteger(5))).toBe("RM 0.05");
    expect(formatMYR(senFromInteger(50))).toBe("RM 0.50");
  });
});

describe("the Sen brand", () => {
  it("keeps sen assignable to number at runtime", () => {
    const amount: Sen = senFromRinggit(250);
    const asNumber: number = amount;
    expect(asNumber).toBe(25000);
  });

  // The brand's real value is a compile-time one: `senFromRinggit(x)` cannot be
  // passed where ringgit is expected, and a bare `number` cannot be passed where
  // `Sen` is expected, so the classic 100x money bug is a type error. That is
  // asserted by `npx tsc --noEmit`, not by a runtime test.
});
