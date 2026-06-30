import { describe, expect, it } from "vitest";
import { fmtBps, fmtLeverage, fmtSignedUsd, fmtUsd, toScaled, toUnits } from "./format";

describe("format", () => {
  it("formats USD with grouping", () => {
    expect(fmtUsd(toScaled(1234.5))).toBe("$1,234.50");
    expect(fmtUsd(toScaled(0))).toBe("$0.00");
  });

  it("formats signed PnL with explicit +/-", () => {
    expect(fmtSignedUsd(toScaled(100))).toBe("+$100.00");
    expect(fmtSignedUsd(toScaled(-88.4))).toBe("-$88.40");
  });

  it("derives leverage from bps", () => {
    expect(fmtLeverage(100_000)).toBe("10.0x");
    expect(fmtLeverage(25_000)).toBe("2.5x");
  });

  it("round-trips whole units through 7-dp scaling", () => {
    expect(toUnits(toScaled(42.42))).toBeCloseTo(42.42, 6);
    expect(toScaled(1)).toBe(10_000_000n);
  });

  it("formats basis points as percent", () => {
    expect(fmtBps(50)).toBe("0.50%");
    expect(fmtBps(250)).toBe("2.50%");
  });
});
