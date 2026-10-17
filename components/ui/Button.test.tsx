import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { Button, ButtonLink } from "./Button";

describe("Button", () => {
  it("renders a type=button with its label", () => {
    render(<Button>Save rule</Button>);
    const button = screen.getByRole("button", { name: "Save rule" });
    expect(button).toHaveAttribute("type", "button");
    expect(button).toHaveClass("button", "primary");
  });

  it.each(["primary", "secondary", "danger", "text"] as const)("applies the %s variant", (v) => {
    render(<Button variant={v}>Go</Button>);
    expect(screen.getByRole("button")).toHaveClass(v);
  });

  it("calls onClick when enabled", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Go</Button>);
    await userEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("uses aria-disabled, stays focusable, and ignores clicks", async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Start review
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Start review" });
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).not.toHaveAttribute("disabled");
    await userEvent.tab();
    expect(button).toHaveFocus();
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("does not submit a form while aria-disabled", async () => {
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <Button type="submit" disabled>
          Send
        </Button>
      </form>,
    );
    await userEvent.click(screen.getByRole("button"));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("hides the icon from assistive tech", () => {
    render(<Button icon={<svg data-testid="icon" />}>New review</Button>);
    expect(screen.getByTestId("icon").parentElement).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByRole("button", { name: "New review" })).toBeInTheDocument();
  });

  it("marks destructive text buttons", () => {
    render(
      <Button variant="text" destructive>
        Delete rule
      </Button>,
    );
    expect(screen.getByRole("button")).toHaveClass("text", "destructive");
  });
});

describe("ButtonLink", () => {
  it("renders a link styled as a button", () => {
    render(<ButtonLink href="/new">New review</ButtonLink>);
    const link = screen.getByRole("link", { name: "New review" });
    expect(link).toHaveAttribute("href", "/new");
    expect(link).toHaveClass("button", "primary");
  });
});
