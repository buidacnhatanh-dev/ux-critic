import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/PagePlaceholder";

export const metadata: Metadata = { title: "Review" };

export default function ReviewPage() {
  return (
    <PagePlaceholder
      title="Review"
      note="Measured and evaluated notes on the screenshot. Built in milestone M2."
    />
  );
}
