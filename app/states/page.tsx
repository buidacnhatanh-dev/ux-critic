import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/PagePlaceholder";

export const metadata: Metadata = { title: "Screen states", robots: { index: false } };

export default function StatesPage() {
  return (
    <PagePlaceholder
      title="Screen states"
      note="Connect Claude, Review failed and Evaluation unreadable with sample data. Built in milestone M3."
    />
  );
}
