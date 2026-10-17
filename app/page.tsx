import type { Metadata } from "next";
import { ProjectsScreen } from "@/components/projects/ProjectsScreen";

// The root page sits beside the layout, so the title template does not apply here.
export const metadata: Metadata = { title: { absolute: "Projects · UX Critic" } };

export default function ProjectsPage() {
  return <ProjectsScreen />;
}
