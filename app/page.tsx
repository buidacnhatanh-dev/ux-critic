import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/PagePlaceholder";

// The root page sits beside the layout, so the title template does not apply here.
export const metadata: Metadata = { title: { absolute: "Projects · UX Critic" } };

export default function ProjectsPage() {
  return (
    <PagePlaceholder
      title="Projects"
      note="Your projects will appear here. Built in milestone M2."
    />
  );
}
