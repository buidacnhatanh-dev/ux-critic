import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Select } from "./Select";

describe("Select", () => {
  const options = [
    { value: "a", label: "Checkout practice" },
    { value: "b", label: "Sign up form" },
  ];

  it("renders options and changes value", async () => {
    render(<Select label="Project" options={options} defaultValue="a" />);
    const select = screen.getByRole("combobox", { name: "Project" });
    expect(select).toHaveValue("a");
    await userEvent.selectOptions(select, "b");
    expect(select).toHaveValue("b");
  });

  it("marks errors", () => {
    render(<Select label="Project" options={options} error="Pick a project" />);
    const select = screen.getByRole("combobox", { name: "Project" });
    expect(select).toHaveAttribute("aria-invalid", "true");
    expect(select).toHaveAccessibleDescription("Pick a project");
  });
});
