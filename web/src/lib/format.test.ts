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

