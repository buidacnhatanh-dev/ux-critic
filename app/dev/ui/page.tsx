import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UiPreview } from "./UiPreview";

export const metadata: Metadata = { title: "UI components", robots: { index: false } };

/** Development only: every component in every variant and state. */
export default function DevUiPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <UiPreview />;
}
