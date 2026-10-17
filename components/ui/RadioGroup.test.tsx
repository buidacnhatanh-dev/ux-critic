import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { RadioGroup } from "./RadioGroup";

const options = [
  { value: "measured", label: "Measured", description: "Exact, for sizes and colours only" },
  { value: "evaluated", label: "Evaluated", description: "For anything that needs an opinion" },
];

describe("RadioGroup", () => {
  it("is a fieldset with a legend and native radios", () => {
    render(<RadioGroup legend="Checked by" name="kind" options={options} />);
    expect(screen.getByRole("group", { name: "Checked by" }).tagName).toBe("FIELDSET");
    expect(screen.getAllByRole("radio")).toHaveLength(2);
    expect(screen.getByRole("radio", { name: "Measured" })).toHaveAccessibleDescription(
      "Exact, for sizes and colours only",
    );
  });

  it("works uncontrolled and selects by clicking the row text", async () => {
    const onChange = vi.fn();
    render(
      <RadioGroup
        legend="Checked by"
        name="kind"
        options={options}
        defaultValue="measured"
        onChange={onChange}
      />,
    );
    expect(screen.getByRole("radio", { name: "Measured" })).toBeChecked();
    await userEvent.click(screen.getByText("For anything that needs an opinion"));
    expect(screen.getByRole("radio", { name: "Evaluated" })).toBeChecked();
    expect(onChange).toHaveBeenCalledWith("evaluated");
  });

  it("follows the value prop when controlled", async () => {
    const onChange = vi.fn();
    render(
      <RadioGroup
        legend="Checked by"
        name="kind"
        options={options}
        value="measured"
        onChange={onChange}
      />,
    );
    await userEvent.click(screen.getByRole("radio", { name: "Evaluated" }));
    expect(onChange).toHaveBeenCalledWith("evaluated");
    expect(screen.getByRole("radio", { name: "Measured" })).toBeChecked();
  });

  it("moves with arrow keys", async () => {
    render(
      <RadioGroup legend="Checked by" name="kind" options={options} defaultValue="measured" />,
    );
    await userEvent.tab();
    expect(screen.getByRole("radio", { name: "Measured" })).toHaveFocus();
    await userEvent.keyboard("{ArrowDown}");
    expect(screen.getByRole("radio", { name: "Evaluated" })).toBeChecked();
  });

  it("describes the group with its error", () => {
    render(<RadioGroup legend="Checked by" name="kind" options={options} error="Pick one" />);
    expect(screen.getByRole("group", { name: "Checked by" })).toHaveAccessibleDescription(
      "Pick one",
    );
  });
});
