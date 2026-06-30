import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Num, Signed } from "./value";

describe("value components", () => {
  it("renders a tabular number", () => {
    render(<Num>1,234.00</Num>);
    expect(screen.getByText("1,234.00")).toBeTruthy();
  });

  it("colors positive values long-green", () => {
    const { container } = render(<Signed positive>+$100.00</Signed>);
    expect(container.querySelector(".text-long")).toBeTruthy();
    expect(container.querySelector(".text-short")).toBeNull();
  });

  it("colors negative values short-red", () => {
    const { container } = render(<Signed positive={false}>-$5.00</Signed>);
    expect(container.querySelector(".text-short")).toBeTruthy();
  });
});
