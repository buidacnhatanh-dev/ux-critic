import { act, render, renderHook, screen } from "@testing-library/react";
import { vi } from "vitest";
import { ANNOUNCE_DELAY_MS, AnnouncerProvider, useAnnouncer } from "./Announcer";

function Speaker({
  message,
  politeness,
}: {
  message: string;
  politeness?: "polite" | "assertive";
}) {
  const { announce } = useAnnouncer();
  return (
    <button type="button" onClick={() => announce(message, politeness)}>
      Speak
    </button>
  );
}

describe("Announcer", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("renders exactly one polite and one assertive region", () => {
    render(<AnnouncerProvider>content</AnnouncerProvider>);
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
    expect(screen.getByRole("alert")).toHaveAttribute("aria-live", "assertive");
  });

  it("announces politely by default", () => {
    render(
      <AnnouncerProvider>
        <Speaker message="Measuring done" />
      </AnnouncerProvider>,
    );
    act(() => screen.getByRole("button").click());
    act(() => vi.advanceTimersByTime(ANNOUNCE_DELAY_MS));
    expect(screen.getByRole("status")).toHaveTextContent("Measuring done");
    expect(screen.getByRole("alert")).toBeEmptyDOMElement();
  });

  it("announces assertively when asked", () => {
    render(
      <AnnouncerProvider>
        <Speaker message="Review failed" politeness="assertive" />
      </AnnouncerProvider>,
    );
    act(() => screen.getByRole("button").click());
    act(() => vi.advanceTimersByTime(ANNOUNCE_DELAY_MS));
    expect(screen.getByRole("alert")).toHaveTextContent("Review failed");
  });

  it("clears first so a repeated message is announced again", () => {
    render(
      <AnnouncerProvider>
        <Speaker message="Saved" />
      </AnnouncerProvider>,
    );
    act(() => screen.getByRole("button").click());
    act(() => vi.advanceTimersByTime(ANNOUNCE_DELAY_MS));
    act(() => screen.getByRole("button").click());
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    act(() => vi.advanceTimersByTime(ANNOUNCE_DELAY_MS));
    expect(screen.getByRole("status")).toHaveTextContent("Saved");
  });

  it("throws outside the provider", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useAnnouncer())).toThrow(/AnnouncerProvider/);
  });
});
