import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/PagePlaceholder";

export const metadata: Metadata = { title: "My checklist" };

export default function ChecklistPage() {
  return (
    <PagePlaceholder
      title="My checklist"
      note="Principle sets and your own rules. Built in milestone M3."
    />
  );
}
