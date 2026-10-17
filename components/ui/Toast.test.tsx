import { act, fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { ANNOUNCE_DELAY_MS, AnnouncerProvider } from "./Announcer";
import { TOAST_DURATION_MS, ToastProvider, useToast, type ToastInput } from "./Toast";

function Trigger({ toast }: { toast: ToastInput }) {
  const { showToast } = useToast();
  return (
    <button type="button" onClick={() => showToast(toast)}>
      Show
    </button>
  );
}

function setup(toast: ToastInput) {
  render(
    <AnnouncerProvider>
      <ToastProvider>
        <Trigger toast={toast} />
      </ToastProvider>
    </AnnouncerProvider>,
  );
  act(() => screen.getByRole("button", { name: "Show" }).click());
}

describe("Toast", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("shows the message in the notifications region and announces it politely", () => {
    setup({ message: "Saved" });
    expect(screen.getByRole("region", { name: "Notifications" })).toHaveTextContent("Saved");
    act(() => vi.advanceTimersByTime(ANNOUNCE_DELAY_MS));
    expect(screen.getByRole("status")).toHaveTextContent("Saved");
  });

  it("disappears after 8 seconds", () => {
    setup({ message: "Saved" });
    act(() => vi.advanceTimersByTime(TOAST_DURATION_MS - 1));
    expect(screen.getByText("Saved", { selector: "p" })).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByText("Saved", { selector: "p" })).not.toBeInTheDocument();
  });

  it("pauses while hovered", () => {
    setup({ message: "Saved" });
    const toast = screen.getByText("Saved", { selector: "p" }).parentElement!;
    act(() => vi.advanceTimersByTime(3000));
    fireEvent.mouseEnter(toast);
    act(() => vi.advanceTimersByTime(20_000));
    expect(screen.getByText("Saved", { selector: "p" })).toBeInTheDocument();
    fireEvent.mouseLeave(toast);
    act(() => vi.advanceTimersByTime(TOAST_DURATION_MS - 3000));
    expect(screen.queryByText("Saved", { selector: "p" })).not.toBeInTheDocument();
  });

  it("pauses while focused", () => {
    setup({ message: "Deleted rule", onUndo: () => {} });
    act(() => screen.getByRole("button", { name: "Undo" }).focus());
    act(() => vi.advanceTimersByTime(20_000));
    expect(screen.getByRole("button", { name: "Undo" })).toBeInTheDocument();
  });

  it("runs Undo and closes", () => {
    const onUndo = vi.fn();
    setup({ message: "Deleted rule", onUndo });
    act(() => vi.advanceTimersByTime(ANNOUNCE_DELAY_MS));
    expect(screen.getByRole("status")).toHaveTextContent("Deleted rule. Undo is available.");
    act(() => screen.getByRole("button", { name: "Undo" }).click());
    expect(onUndo).toHaveBeenCalledOnce();
    expect(screen.queryByRole("button", { name: "Undo" })).not.toBeInTheDocument();
  });

  it("can be dismissed", () => {
    setup({ message: "Saved" });
    act(() => screen.getByRole("button", { name: "Dismiss notification" }).click());
    expect(screen.queryByText("Saved", { selector: "p" })).not.toBeInTheDocument();
  });
});
