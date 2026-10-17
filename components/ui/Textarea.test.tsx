import { render, screen } from "@testing-library/react";
import { Textarea } from "./Textarea";

describe("Textarea", () => {
  it("is labelled, described and marks errors", () => {
    render(
      <Textarea
        label="What is this screen for?"
        hint="Optional. Helps the evaluation."
        error="Keep it under 500 characters."
      />,
    );
    const area = screen.getByRole("textbox", { name: "What is this screen for?" });
    expect(area.tagName).toBe("TEXTAREA");
    expect(area).toHaveAttribute("aria-invalid", "true");
    expect(area).toHaveAccessibleDescription(
      "Keep it under 500 characters. Optional. Helps the evaluation.",
    );
  });
});
