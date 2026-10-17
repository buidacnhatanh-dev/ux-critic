import { render, screen } from "@testing-library/react";
import { KindPill, Pill, SeverityCountPill, SeverityPill } from "./Pill";

describe("Pill", () => {
  it.each(["high", "medium", "low", "measured", "evaluated", "neutral", "demo"] as const)(
    "renders the %s tone with its text",
    (tone) => {
      render(<Pill tone={tone}>Label</Pill>);
      const pill = screen.getByText("Label");
      expect(pill).toHaveClass("pill", tone);
      expect(pill).toHaveAttribute("data-tone", tone);
    },
  );

  it("hides a decorative icon", () => {
    render(
      <Pill tone="high" icon={<svg data-testid="i" />}>
        High
      </Pill>,
    );
    expect(screen.getByTestId("i").parentElement).toHaveAttribute("aria-hidden", "true");
  });
});

describe("SeverityPill and KindPill", () => {
  it("always spell out severity and kind", () => {
    render(
      <>
        <SeverityPill severity="medium" />
        <KindPill kind="measured" />
        <KindPill kind="evaluated" />
      </>,
    );
    expect(screen.getByText("Medium")).toHaveAttribute("data-tone", "medium");
    expect(screen.getByText("Measured")).toHaveAttribute("data-tone", "measured");
    expect(screen.getByText("Evaluated")).toHaveAttribute("data-tone", "evaluated");
  });
});

describe("SeverityCountPill", () => {
  it("shows the label and count", () => {
    render(<SeverityCountPill severity="high" count={1} />);
    expect(screen.getByText("High 1")).toHaveAttribute("data-tone", "high");
  });

  it("is neutral when the count is zero", () => {
    render(<SeverityCountPill severity="high" count={0} />);
    expect(screen.getByText("High 0")).toHaveAttribute("data-tone", "neutral");
  });
});
