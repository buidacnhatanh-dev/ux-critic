import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef, useState } from "react";
import { Button } from "./Button";
import { Dialog } from "./Dialog";

function Harness({ alert = false }: { alert?: boolean }) {
  const [open, setOpen] = useState(false);
  const keepRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Delete project</Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={alert ? 'Delete "Checkout practice"?' : "Edit rule"}
        role={alert ? "alertdialog" : "dialog"}
        initialFocus={alert ? keepRef : undefined}
        footer={
          <>
            <Button ref={keepRef} variant="secondary" onClick={() => setOpen(false)}>
              Keep project
            </Button>
            <Button variant="danger">Delete project for good</Button>
          </>
        }
      >
        <p>You can&apos;t undo this.</p>
      </Dialog>
    </>
  );
}

describe("Dialog", () => {
  it("renders nothing visible while closed", () => {
    render(<Harness />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens modally with a labelled title and a Close button", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: "Delete project" }));
    const dialog = screen.getByRole("dialog", { name: "Edit rule" });
    expect(dialog).toHaveAttribute("open");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  });

  it("closes with the Close button and returns focus to the opener", async () => {
    render(<Harness />);
    const opener = screen.getByRole("button", { name: "Delete project" });
    await userEvent.click(opener);
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it("closes on Escape (cancel event)", async () => {
    render(<Harness />);
    const opener = screen.getByRole("button", { name: "Delete project" });
    await userEvent.click(opener);
    const dialog = screen.getByRole("dialog");
    dialog.dispatchEvent(new Event("cancel", { cancelable: true }));
    expect(await screen.findByRole("button", { name: "Delete project" })).toHaveFocus();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("focuses the initialFocus element (safe action) in alert dialogs", async () => {
    render(<Harness alert />);
    await userEvent.click(screen.getByRole("button", { name: "Delete project" }));
    const dialog = screen.getByRole("alertdialog", { name: 'Delete "Checkout practice"?' });
    expect(dialog).toHaveAccessibleDescription("You can't undo this.");
    expect(screen.getByRole("button", { name: "Keep project" })).toHaveFocus();
    expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
  });
});
