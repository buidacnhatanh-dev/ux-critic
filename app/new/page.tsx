import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/PagePlaceholder";

export const metadata: Metadata = { title: "New review" };

export default function NewReviewPage() {
  return (
    <PagePlaceholder
      title="New review"
      note="Start a review of a screenshot. Built in milestone M3."
    />
  );
}
