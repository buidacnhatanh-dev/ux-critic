import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Checkbox, CheckboxGroup } from "./Checkbox";

describe("Checkbox", () => {
  it("is a native checkbox named by its label only", () => {
    render(<Checkbox label="Nielsen's 10 heuristics" description="Usability basics" />);
    const box = screen.getByRole("checkbox", { name: "Nielsen's 10 heuristics" });
    expect(box).toHaveAccessibleDescription("Usability basics");
  });

  it("toggles when the description (whole row) is clicked", async () => {
    render(<Checkbox label="WCAG 2.2 AA" description="The parts visible in a screenshot" />);
    const box = screen.getByRole("checkbox");
    expect(box).not.toBeChecked();
    await userEvent.click(screen.getByText("The parts visible in a screenshot"));
    expect(box).toBeChecked();
  });

  it("toggles with the keyboard", async () => {
    render(<Checkbox label="Laws of UX" defaultChecked />);
    const box = screen.getByRole("checkbox");
    await userEvent.tab();
    await userEvent.keyboard(" ");
    expect(box).not.toBeChecked();
  });

  it("groups checkboxes in a fieldset with a legend", () => {
    render(
      <CheckboxGroup legend="Principles">
        <Checkbox label="Nielsen" />
        <Checkbox label="WCAG" />
      </CheckboxGroup>,
    );
    const group = screen.getByRole("group", { name: "Principles" });
    expect(group.tagName).toBe("FIELDSET");
  });
});
