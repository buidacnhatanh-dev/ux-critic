import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Tooltip } from "./Tooltip";

function setup() {
  render(
    <Tooltip content="Regions are approximate">
      <button type="button">Why approximate?</button>
    </Tooltip>,
  );
  return screen.getByRole("button", { name: "Why approximate?" });
}

describe("Tooltip", () => {
  it("is hidden at first but still describes the trigger", () => {
    const button = setup();
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    expect(button).toHaveAccessibleDescription("Regions are approximate");
  });

  it("shows on focus and hides on blur", async () => {
    setup();
    await userEvent.tab();
    expect(screen.getByRole("tooltip")).toHaveTextContent("Regions are approximate");
    await userEvent.tab();
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("shows on hover and hides on leave", async () => {
    const button = setup();
    await userEvent.hover(button);
    expect(screen.getByRole("tooltip")).toBeVisible();
    await userEvent.unhover(button);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("hides on Escape and keeps focus on the trigger", async () => {
    const button = setup();
    await userEvent.tab();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    expect(button).toHaveFocus();
  });

  it("keeps an existing aria-describedby", () => {
    render(
      <>
        <p id="other">Other text</p>
        <Tooltip content="Tip">
          <button type="button" aria-describedby="other">
            Go
          </button>
        </Tooltip>
      </>,
    );
    expect(screen.getByRole("button")).toHaveAccessibleDescription("Other text Tip");
  });
});
