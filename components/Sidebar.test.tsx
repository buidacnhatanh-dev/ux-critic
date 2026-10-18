import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { AnnouncerProvider, ToastProvider } from "@/components/ui";
import { DataClientProvider } from "@/lib/data/DataClientProvider";
import { DEMO_STORAGE_KEY } from "@/lib/data/demo-client";
import type { Mode } from "@/lib/data/types";
import { Sidebar, currentFor } from "./Sidebar";

const pathname = vi.hoisted(() => ({ value: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname.value }));

function renderSidebar(mode: Mode, path = "/") {
  pathname.value = path;
  render(
    <AnnouncerProvider>
      <ToastProvider>
        <DataClientProvider mode={mode}>
          <Sidebar mode={mode} sourceLine="Sample reviews written by hand" />
        </DataClientProvider>
      </ToastProvider>
    </AnnouncerProvider>,
  );
  return screen.getByRole("navigation", { name: "Main" });
}

describe("currentFor", () => {
  const projects = { href: "/", matches: (p: string) => p === "/" || p.startsWith("/projects/") };
  it("is page on the exact route", () => expect(currentFor(projects, "/")).toBe("page"));
  it("is true inside the section", () => expect(currentFor(projects, "/projects/a")).toBe("true"));
  it("is undefined elsewhere", () => expect(currentFor(projects, "/checklist")).toBeUndefined());
  it("follows a section named by the screen (Reviewing, Review failed)", () => {
    const newReview = { href: "/new", matches: (p: string) => p === "/new" };
    expect(currentFor(projects, "/reviews/r1", "/new")).toBeUndefined();
    expect(currentFor(newReview, "/reviews/r1", "/new")).toBe("true");
    expect(currentFor(newReview, "/reviews/r1", null)).toBeUndefined();
  });
});

describe("Sidebar", () => {
  it("lists the three destinations and marks the current page", () => {
    const nav = renderSidebar("demo", "/checklist");
    const links = within(nav).getAllByRole("link");
    expect(links.map((l) => l.textContent)).toEqual([
      "UX Critic",
      "Projects",
      "New review",
      "My checklist",
    ]);
    expect(within(nav).getByRole("link", { name: "My checklist" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(nav).getByRole("link", { name: "Projects" })).not.toHaveAttribute("aria-current");
  });

  it("marks Projects as the current section on a review", () => {
    const nav = renderSidebar("demo", "/reviews/abc");
    expect(within(nav).getByRole("link", { name: "Projects" })).toHaveAttribute(
      "aria-current",
      "true",
    );
  });

  it("shows the Demo pill, source line and demo actions in demo mode", () => {
    const nav = renderSidebar("demo");
    expect(within(nav).getByText("Demo")).toBeInTheDocument();
    expect(within(nav).getByText("Sample reviews written by hand")).toBeInTheDocument();
    expect(within(nav).getByRole("button", { name: "How this demo works" })).toBeInTheDocument();
    expect(within(nav).getByRole("button", { name: "Reset demo" })).toBeInTheDocument();
    expect(within(nav).queryByText("Private · runs on this laptop")).not.toBeInTheDocument();
  });

  it("shows the private note and no demo actions in live mode", () => {
    const nav = renderSidebar("live");
    expect(within(nav).getByText("Private · runs on this laptop")).toBeInTheDocument();
    expect(within(nav).queryByText("Demo")).not.toBeInTheDocument();
    expect(within(nav).queryByRole("button", { name: "Reset demo" })).not.toBeInTheDocument();
  });

  it("opens How this demo works with the agreed text and a link to all states", async () => {
    renderSidebar("demo");
    await userEvent.click(screen.getByRole("button", { name: "How this demo works" }));
    const dialog = screen.getByRole("dialog", { name: "How this demo works" });
    expect(dialog).toHaveTextContent("never calls Claude, so it is free and private");
    expect(within(dialog).getByRole("link", { name: "See all screen states" })).toHaveAttribute(
      "href",
      "/states",
    );
  });

  it("asks once before Reset demo, focuses Keep my changes, then clears storage", async () => {
    window.localStorage.setItem(DEMO_STORAGE_KEY, '{"pushbacks":{}}');
    renderSidebar("demo");
    await userEvent.click(screen.getByRole("button", { name: "Reset demo" }));
    const dialog = screen.getByRole("alertdialog", { name: "Reset the demo?" });
    expect(within(dialog).getByRole("button", { name: "Keep my changes" })).toHaveFocus();
    expect(window.localStorage.getItem(DEMO_STORAGE_KEY)).not.toBeNull();
    await userEvent.click(within(dialog).getByRole("button", { name: "Reset demo" }));
    expect(window.localStorage.getItem(DEMO_STORAGE_KEY)).toBeNull();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(
      await screen.findByText("Demo reset. Your changes in this browser are cleared."),
    ).toBeInTheDocument();
  });
});
