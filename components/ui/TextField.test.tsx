import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TextField } from "./TextField";

describe("TextField", () => {
  it("has a visible label linked to the input", () => {
    render(<TextField label="Version name" />);
    expect(screen.getByLabelText("Version name")).toHaveAttribute("type", "text");
    expect(screen.getByText("Version name").tagName).toBe("LABEL");
  });

  it("links the hint with aria-describedby", () => {
    render(<TextField label="Version name" hint="For example v2" />);
    const input = screen.getByRole("textbox", { name: "Version name" });
    expect(input).toHaveAccessibleDescription("For example v2");
    expect(input).not.toHaveAttribute("aria-invalid");
  });

  it("marks the error with aria-invalid and reads error before hint", () => {
    render(<TextField label="Version name" hint="For example v2" error='"v2" already exists.' />);
    const input = screen.getByRole("textbox", { name: "Version name" });
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription('"v2" already exists. For example v2');
  });

  it("accepts typing", async () => {
    render(<TextField label="Project name" />);
    const input = screen.getByRole("textbox", { name: "Project name" });
    await userEvent.type(input, "NeighborGoods");
    expect(input).toHaveValue("NeighborGoods");
  });

  it("uses a given id", () => {
    render(<TextField id="version" label="Version name" error="Required" />);
    expect(screen.getByRole("textbox")).toHaveAttribute("id", "version");
    expect(screen.getByText("Required").closest("p")).toHaveAttribute("id", "version-error");
  });
});
