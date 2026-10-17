import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/PagePlaceholder";

export const metadata: Metadata = { title: "Project history" };

export default function ProjectPage() {
  return (
    <PagePlaceholder
      title="Project history"
      note="Every version of this project and its reviews. Built in milestone M2."
    />
  );
}
