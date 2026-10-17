import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/PagePlaceholder";

export const metadata: Metadata = { title: "Compare versions" };

export default function ComparePage() {
  return (
    <PagePlaceholder
      title="Compare versions"
      note="Fixed, still open and new issues between two versions. Built in milestone M2."
    />
  );
}
